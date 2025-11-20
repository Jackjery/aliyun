/**
 * 🔧 周期规则引擎 - 用于按自定义时间规则分组数据
 * 支持：按日、按周、按月、按季度分组
 * 所有时间处理均基于文件时间（北京时间），不进行时区转换
 */
class CycleRuleEngine {
    constructor() {
        this.config = {
            day: { start: '00:00' },
            week: { startDay: 1, startTime: '00:00' },
            month: { startDate: 1, startTime: '00:00' },
            quarter: { startMonth: 1, startTime: '00:00' }
        };
        this.loadConfig();
    }

    loadConfig() {
        const savedConfig = localStorage.getItem('cycleRules');
        if (savedConfig) this.config = JSON.parse(savedConfig);
    }

    saveConfig() {
        localStorage.setItem('cycleRules', JSON.stringify(this.config));
    }

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.saveConfig();
    }

    groupByStartTime(data, groupBy, planIdField, startTimeField) {
        const sortedData = [...data].sort((a, b) => {
            // a[startTimeField] 可能是 Date 或 字符串，转换为 Date 对象比较
            const dateA = a[startTimeField] instanceof Date ? a[startTimeField] : new Date(a[startTimeField]);
            const dateB = b[startTimeField] instanceof Date ? b[startTimeField] : new Date(b[startTimeField]);
            return dateA - dateB;
        });

        const groups = {};
        const groupMetadata = {};

        sortedData.forEach(item => {
            const startTime = item[startTimeField];
            if (!startTime) return;

            const itemDate = startTime instanceof Date ? startTime : new Date(startTime);
            let group;

            switch (groupBy) {
                case 'day': group = this.getDayGroup(itemDate); break;
                case 'week': group = this.getWeekGroup(itemDate); break;
                case 'month': group = this.getMonthGroup(itemDate); break;
                case 'quarter': group = this.getQuarterGroup(itemDate); break;
                default: return;
            }

            if (!groups[group.key]) {
                groups[group.key] = [];
                groupMetadata[group.key] = group;
            }
            groups[group.key].push(item);
        });

        const sortedKeys = Object.keys(groups).sort((a, b) =>
            groupMetadata[a].rangeStart - groupMetadata[b].rangeStart
        );

        return { groups, groupMetadata, sortedKeys };
    }

    getDayGroup(date) {
        const dayConfig = this.config.day;
        const { hours, minutes } = this.parseTimeToHoursMinutes(dayConfig.start);

        // 创建严格的文件时间对象，不考虑浏览器时区
        const fileDate = this.createFileDate(date);

        // 创建参考日期：与原始日期同一天的周期起始时间点（文件时间）
        const referenceStart = this.createFileDate(fileDate);
        referenceStart.setHours(hours, minutes, 0, 0);

        // 计算周期起始时间（文件时间）
        const cycleStart = fileDate >= referenceStart
            ? new Date(referenceStart)
            : new Date(referenceStart.getTime() - 24 * 60 * 60 * 1000);

        // 周期结束时间 = 周期起始时间 + 1天（文件时间）
        const cycleEnd = new Date(cycleStart.getTime() + 24 * 60 * 60 * 1000);

        // 周期标签为周期起始时间的日期（文件时间）
        const groupDate = new Date(cycleStart);
        const groupKey = this.formatDate(groupDate);
        const groupLabel = this.formatDateCorrected(groupDate);

        return {
            key: groupKey,
            label: groupLabel,
            rangeStart: cycleStart,
            rangeEnd: cycleEnd
        };
    }

    getWeekGroup(date) {
        const weekConfig = this.config.week;
        const startDay = weekConfig.startDay; // 0=周日, 1=周一...6=周六
        const { hours, minutes } = this.parseTimeToHoursMinutes(weekConfig.startTime);

        // 创建严格的文件时间对象
        const fileDate = this.createFileDate(date);

        // 获取当前日期是星期几（文件时间）
        const currentDay = fileDate.getDay();

        // 计算距离本周起始日的天数差
        let dayDiff = currentDay - startDay;
        if (dayDiff < 0) {
            dayDiff += 7; // 如果是上周的日期，调整差值
        }

        // 创建参考日期：本周起始日的起始时间点（文件时间）
        const referenceStart = this.createFileDate(fileDate);
        referenceStart.setDate(fileDate.getDate() - dayDiff);
        referenceStart.setHours(hours, minutes, 0, 0);

        // 计算周期起始时间（文件时间）
        const cycleStart = fileDate >= referenceStart
            ? new Date(referenceStart)
            : new Date(referenceStart.getTime() - 7 * 24 * 60 * 60 * 1000);

        // 周期结束时间 = 周期起始时间 + 7天（文件时间）
        const cycleEnd = new Date(cycleStart.getTime() + 7 * 24 * 60 * 60 * 1000);

        // 计算年份和周数（直接使用周期起始时间，不需要修正）
        const year = cycleStart.getFullYear();
        const firstDayOfYear = new Date(year, 0, 1);
        const pastDaysOfYear = (cycleStart - firstDayOfYear) / 86400000;
        const week = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);

        const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        const startDayName = weekDays[startDay];

        return {
            key: `${year}-W${String(week).padStart(2, '0')}`,
            label: `${year}年第${week}周（${startDayName}）`,
            rangeStart: cycleStart,
            rangeEnd: cycleEnd
        };
    }

    getMonthGroup(date) {
        const monthConfig = this.config.month;
        const startDate = monthConfig.startDate;
        const { hours, minutes } = this.parseTimeToHoursMinutes(monthConfig.startTime);

        // 创建严格的文件时间对象
        const fileDate = this.createFileDate(date);

        const currentYear = fileDate.getFullYear();
        const currentMonth = fileDate.getMonth(); // 0-11（文件时间月份）

        // 创建参考日期：本月起始日的起始时间点（文件时间）
        const referenceStart = new Date(currentYear, currentMonth, startDate);
        referenceStart.setHours(hours, minutes, 0, 0);

        // 处理月份最后一天可能小于startDate的情况（如2月30日）
        if (referenceStart.getDate() !== startDate) {
            // 自动调整为当月最后一天
            referenceStart.setMonth(referenceStart.getMonth() + 1, 0);
            referenceStart.setHours(hours, minutes, 0, 0);
        }

        // 计算周期起始时间（文件时间）
        let cycleStart;
        if (fileDate >= referenceStart) {
            cycleStart = new Date(referenceStart);
        } else {
            // 上个月的起始时间（文件时间）
            const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
            const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

            cycleStart = new Date(prevYear, prevMonth, startDate);
            cycleStart.setHours(hours, minutes, 0, 0);

            // 再次检查上个月的日期是否有效
            if (cycleStart.getDate() !== startDate) {
                cycleStart.setMonth(cycleStart.getMonth() + 1, 0);
                cycleStart.setHours(hours, minutes, 0, 0);
            }
        }

        // 计算周期结束时间（下个月的起始时间，文件时间）
        const nextMonth = cycleStart.getMonth() + 1;
        const nextYear = cycleStart.getFullYear() + (nextMonth > 11 ? 1 : 0);
        const adjustedNextMonth = nextMonth > 11 ? 0 : nextMonth;

        const cycleEnd = new Date(nextYear, adjustedNextMonth, startDate);
        cycleEnd.setHours(hours, minutes, 0, 0);

        // 处理下个月日期可能无效的情况
        if (cycleEnd.getDate() !== startDate) {
            cycleEnd.setMonth(cycleEnd.getMonth() + 1, 0);
            cycleEnd.setHours(hours, minutes, 0, 0);
        }

        const groupKey = `${cycleStart.getFullYear()}-${String(cycleStart.getMonth() + 1).padStart(2, '0')}`;
        const groupLabel = `${cycleStart.getFullYear()}年${cycleStart.getMonth() + 1}月`;

        return {
            key: groupKey,
            label: groupLabel,
            rangeStart: cycleStart,
            rangeEnd: cycleEnd
        };
    }

    getQuarterGroup(date) {
        const quarterConfig = this.config.quarter;
        const startMonth = parseInt(quarterConfig.startMonth); // 1,4,7,10
        const { hours, minutes } = this.parseTimeToHoursMinutes(quarterConfig.startTime);

        // 创建严格的文件时间对象
        const fileDate = this.createFileDate(date);

        const currentYear = fileDate.getFullYear();
        const currentMonth = fileDate.getMonth() + 1; // 1-12（文件时间月份）

        // 确定当前季度的起始月份
        let currentQuarterStart;
        if (startMonth === 1) {
            currentQuarterStart = currentMonth <= 3 ? 1 :
                                currentMonth <= 6 ? 4 :
                                currentMonth <= 9 ? 7 : 10;
        } else if (startMonth === 4) {
            currentQuarterStart = currentMonth <= 6 ? 4 :
                                currentMonth <= 9 ? 7 :
                                currentMonth <= 12 ? 10 : 1;
        } else if (startMonth === 7) {
            currentQuarterStart = currentMonth <= 9 ? 7 :
                                currentMonth <= 12 ? 10 :
                                currentMonth <= 3 ? 1 : 4;
        } else { // startMonth === 10
            currentQuarterStart = currentMonth <= 12 ? 10 :
                                currentMonth <= 3 ? 1 :
                                currentMonth <= 6 ? 4 : 7;
        }

        // 创建参考日期：本季度起始月1日的起始时间点（文件时间）
        const referenceStart = new Date(
            currentQuarterStart <= currentMonth ? currentYear : currentYear - 1,
            currentQuarterStart - 1, // 转换为0-based月份
            1
        );
        referenceStart.setHours(hours, minutes, 0, 0);

        // 计算周期起始时间（文件时间）
        const cycleStart = fileDate >= referenceStart ? referenceStart :
            new Date(referenceStart.getTime() - 3 * 30 * 24 * 60 * 60 * 1000); // 大约3个月前

        // 计算周期结束时间（下一季度的起始时间，文件时间）
        let nextQuarterStart = currentQuarterStart + 3;
        let nextQuarterYear = cycleStart.getFullYear();

        if (nextQuarterStart > 12) {
            nextQuarterStart = nextQuarterStart - 12;
            nextQuarterYear++;
        }

        const cycleEnd = new Date(nextQuarterYear, nextQuarterStart - 1, 1);
        cycleEnd.setHours(hours, minutes, 0, 0);

        // 生成标签（直接使用周期起始时间，不需要修正）
        const year = cycleStart.getFullYear();
        const quarter = Math.floor((currentQuarterStart - 1) / 3) + 1;

        return {
            key: `${year}-Q${quarter}`,
            label: `${year}年第${quarter}季度`,
            rangeStart: cycleStart,
            rangeEnd: cycleEnd
        };
    }

    parseTimeToHoursMinutes(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return { hours: hours || 0, minutes: minutes || 0 };
    }

    // 格式化日期为YYYY-MM-DD（文件时间）
    formatDate(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    // 格式化日期显示（不再需要时区修正，数据库时间已是北京时间）
    formatDateCorrected(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    // 创建严格基于文件时间的日期对象，不进行任何时区转换
    createFileDate(originalDate) {
        // 精确复制原始日期的年月日时分秒，完全基于文件中的时间
        return new Date(
            originalDate.getFullYear(),
            originalDate.getMonth(),
            originalDate.getDate(),
            originalDate.getHours(),
            originalDate.getMinutes(),
            originalDate.getSeconds()
        );
    }

    // 获取日期所属的周期组（完全基于文件时间）
    getGroup(date, groupType) {
        // 确保输入是Date对象
        const dateObj = date instanceof Date ? date : new Date(date);

        // 验证日期有效性
        if (isNaN(dateObj.getTime())) {
            console.error('无效的日期:', date);
            throw new Error('无效的日期');
        }

        // 所有时间处理都基于文件中的原始时间，不进行时区转换
        switch (groupType) {
            case 'day':
                return this.getDayGroup(dateObj);
            case 'week':
                return this.getWeekGroup(dateObj);
            case 'month':
                return this.getMonthGroup(dateObj);
            case 'quarter':
                return this.getQuarterGroup(dateObj);
            default:
                console.error('未知的分组类型:', groupType);
                return this.getDayGroup(dateObj);
        }
    }

    getWeekNumber(date) {
        const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
        const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
        return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    }
}

// 导出（如果使用模块化）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CycleRuleEngine;
}
