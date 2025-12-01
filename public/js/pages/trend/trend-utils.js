/**
 * Trend Analysis 工具函数
 */

/**
 * 图表颜色调色板（清爽透明风格）
 */
const CHART_COLORS = [
    { r: 54, g: 162, b: 235 },   // 蓝色
    { r: 255, g: 99, b: 132 },   // 红色
    { r: 75, g: 192, b: 192 },   // 青色
    { r: 255, g: 159, b: 64 },   // 橙色
    { r: 153, g: 102, b: 255 },  // 紫色
    { r: 255, g: 206, b: 86 },   // 黄色
    { r: 231, g: 233, b: 237 },  // 灰色
    { r: 75, g: 192, b: 75 },    // 绿色
    { r: 201, g: 203, b: 207 },  // 浅灰色
    { r: 255, g: 99, b: 255 }    // 粉色
];

/**
 * 获取图表颜色
 */
function getChartColor(index, alpha = 1) {
    const color = CHART_COLORS[index % CHART_COLORS.length];
    return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
}

/**
 * 下载文件
 */
function downloadFile(filename, content, mimeType = 'application/octet-stream') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 500);
}

/**
 * 生成完整的时间周期序列（确保0值时间点不被跳过）
 * @param {string} startDate - 开始日期 YYYY-MM-DD
 * @param {string} endDate - 结束日期 YYYY-MM-DD
 * @param {string} groupBy - 周期类型 (day/week/month/quarter)
 * @param {Array} existingPeriods - 已有的周期数组（用于合并）
 * @returns {Array} - 完整的周期数组
 */
function generateCompletePeriods(startDate, endDate, groupBy, existingPeriods = []) {
    const periods = new Set(existingPeriods);
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');

    let current = new Date(start);

    // 🔧 读取周期规则配置（用于按周分组）
    let weekConfig = { startDay: 1, startTime: '00:00' }; // 默认周一0点
    if (groupBy === 'week') {
        try {
            const savedConfig = localStorage.getItem('cycleRules');
            if (savedConfig) {
                const config = JSON.parse(savedConfig);
                if (config.week) {
                    weekConfig = config.week;
                }
            }
        } catch (e) {
            console.warn('读取周期规则配置失败，使用默认配置', e);
        }
    }

    while (current <= end) {
        let periodLabel = '';

        switch (groupBy) {
            case 'day':
                periodLabel = formatDate(current);
                break;
            case 'week':
                // 🔧 使用自定义周起始日（与 CycleRuleEngine 一致）
                const startDay = weekConfig.startDay;
                const [hours, minutes] = weekConfig.startTime.split(':').map(Number);

                const fileDate = new Date(current);
                const currentDay = fileDate.getDay();

                // 计算距离本周起始日的天数差
                let dayDiff = currentDay - startDay;
                if (dayDiff < 0) {
                    dayDiff += 7;
                }

                // 本周起始日的起始时间点
                const referenceStart = new Date(fileDate);
                referenceStart.setDate(fileDate.getDate() - dayDiff);
                referenceStart.setHours(hours || 0, minutes || 0, 0, 0);

                // 计算周期起始时间
                const weekStart = fileDate >= referenceStart
                    ? new Date(referenceStart)
                    : new Date(referenceStart.getTime() - 7 * 24 * 60 * 60 * 1000);

                periodLabel = formatDate(weekStart);
                break;
            case 'month':
                periodLabel = formatDate(new Date(current.getFullYear(), current.getMonth(), 1));
                break;
            case 'quarter':
                const quarterMonth = Math.floor(current.getMonth() / 3) * 3;
                periodLabel = formatDate(new Date(current.getFullYear(), quarterMonth, 1));
                break;
        }

        periods.add(periodLabel);

        // 移动到下一个周期
        switch (groupBy) {
            case 'day':
                current.setDate(current.getDate() + 1);
                break;
            case 'week':
                current.setDate(current.getDate() + 7);
                break;
            case 'month':
                current.setMonth(current.getMonth() + 1);
                break;
            case 'quarter':
                current.setMonth(current.getMonth() + 3);
                break;
        }
    }

    return Array.from(periods).sort();
}

/**
 * 格式化日期为 YYYY-MM-DD
 */
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * 将图表数据转换为CSV
 */
function chartToCSV(chart) {
    if (!chart) return '';
    const labels = chart.data.labels || [];
    const datasets = chart.data.datasets || [];

    const header = ['分组', ...datasets.map(ds => ds.label || '')];
    const rows = [header];

    for (let i = 0; i < labels.length; i++) {
        const row = [labels[i]];
        for (let j = 0; j < datasets.length; j++) {
            row.push(datasets[j].data[i] ?? '');
        }
        rows.push(row);
    }

    const csvLines = rows.map(cols => cols.map(cell => {
        if (cell === null || cell === undefined) return '';
        const str = String(cell);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    }).join(','));

    return '\uFEFF' + csvLines.join('\n');
}

/**
 * 将后端返回的扁平数据转换为Chart.js格式
 * @param {Array} records - 后端返回的记录 [{period, dimension_name, record_count}, ...]
 * @param {string} dimensionField - 维度字段名 (如 'station_name', 'task_type')
 * @param {string} valueField - 值字段名 (如 'record_count')
 * @param {Object} options - 可选参数 {startDate, endDate, groupBy} 用于生成完整时间序列
 * @returns {Object} - {labels: [], datasets: []}
 */
function convertToChartData(records, dimensionField, valueField = 'record_count', options = {}) {
    if (!records || records.length === 0) {
        return { labels: [], datasets: [] };
    }

    // 提取所有唯一的周期
    const periodsSet = new Set();
    records.forEach(r => periodsSet.add(r.period));
    let periods = Array.from(periodsSet).sort();

    // 🔧 如果提供了日期范围，生成完整的时间序列（确保0值时间点不被跳过）
    if (options.startDate && options.endDate && options.groupBy) {
        periods = generateCompletePeriods(options.startDate, options.endDate, options.groupBy, periods);
    }

    // 提取所有唯一的维度值
    const dimensionsSet = new Set();
    records.forEach(r => {
        if (r[dimensionField]) {
            dimensionsSet.add(r[dimensionField]);
        }
    });
    const dimensions = Array.from(dimensionsSet).sort();

    // 构建数据集（带清爽透明样式）
    const datasets = dimensions.map((dimension, index) => {
        const data = periods.map(period => {
            const record = records.find(r =>
                r.period === period && r[dimensionField] === dimension
            );
            // 强制转换为数字，确保0值不被跳过
            const rawValue = record ? record[valueField] : 0;
            const numValue = Number(rawValue);
            // 使用 isNaN 检查，确保0值被正确保留
            return isNaN(numValue) ? 0 : numValue;
        });

        return {
            label: dimension,
            data: data,
            backgroundColor: getChartColor(index, 0.1),      // 0.1 透明度的背景色
            borderColor: getChartColor(index, 1),            // 不透明的边框色
            borderWidth: 1.5,     // 更细的线条（多条线时更清爽）
            pointBackgroundColor: getChartColor(index, 1),
            pointBorderColor: '#fff',
            pointBorderWidth: 1.5,
            pointRadius: 3,       // 更小的数据点
            pointHoverRadius: 5,  // 悬停时稍大
            fill: true,           // 填充区域
            tension: 0.4,         // 平滑曲线
            spanGaps: false,      // 不跳过空值
            showLine: true        // 确保始终显示线条
        };
    });

    return {
        labels: periods,
        datasets: datasets
    };
}

/**
 * 格式化周期标签
 */
function formatPeriodLabel(period, groupBy) {
    if (!period) return period;

    // 移除时间部分（如果有）
    let cleanPeriod = period;
    if (typeof period === 'string' && (period.includes(' ') || period.includes('T'))) {
        cleanPeriod = period.split(/[T ]/)[0];
    }

    switch (groupBy) {
        case 'day':
            return cleanPeriod;
        case 'week':
            if (cleanPeriod.includes('-')) {
                const date = new Date(cleanPeriod + 'T00:00:00');
                const year = date.getFullYear();
                // 🔧 使用与 CycleRuleEngine 一致的周数计算逻辑
                const weekNum = getWeekNumberWithCustomStart(date);
                return `${year}-W${String(weekNum).padStart(2, '0')}`;
            }
            return cleanPeriod;
        case 'month':
            if (cleanPeriod.includes('-')) {
                const parts = cleanPeriod.split('-');
                const year = parts[0];
                const month = parts[1];
                return `${year}-${month}`;
            }
            return cleanPeriod;
        case 'quarter':
            if (typeof cleanPeriod === 'string' && cleanPeriod.includes('-Q')) {
                // cleanPeriod 格式已经是 "YYYY-Q1"，直接返回
                return cleanPeriod;
            }
            return cleanPeriod;
        default:
            return cleanPeriod;
    }
}

/**
 * 获取周数（ISO 8601）
 */
function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return weekNo;
}

/**
 * 获取周数（使用自定义周起始日配置，与 CycleRuleEngine 一致）
 * 该函数确保前端显示的周数与后端分组逻辑保持一致
 */
function getWeekNumberWithCustomStart(date) {
    // 从 localStorage 读取周期规则配置
    let weekConfig = { startDay: 1, startTime: '00:00' }; // 默认周一0点
    try {
        const savedConfig = localStorage.getItem('cycleRules');
        if (savedConfig) {
            const config = JSON.parse(savedConfig);
            if (config.week) {
                weekConfig = config.week;
            }
        }
    } catch (e) {
        console.warn('读取周期规则配置失败，使用默认配置', e);
    }

    const startDay = weekConfig.startDay; // 0=周日, 1=周一...6=周六
    const [hours, minutes] = weekConfig.startTime.split(':').map(Number);

    // 创建文件时间对象
    const fileDate = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        date.getHours(),
        date.getMinutes(),
        date.getSeconds()
    );

    // 获取当前日期是星期几
    const currentDay = fileDate.getDay();

    // 计算距离本周起始日的天数差
    let dayDiff = currentDay - startDay;
    if (dayDiff < 0) {
        dayDiff += 7;
    }

    // 创建参考日期：本周起始日的起始时间点
    const referenceStart = new Date(fileDate);
    referenceStart.setDate(fileDate.getDate() - dayDiff);
    referenceStart.setHours(hours || 0, minutes || 0, 0, 0);

    // 计算周期起始时间
    const cycleStart = fileDate >= referenceStart
        ? new Date(referenceStart)
        : new Date(referenceStart.getTime() - 7 * 24 * 60 * 60 * 1000);

    // 计算年份和周数（使用与 CycleRuleEngine 相同的算法）
    const year = cycleStart.getFullYear();
    const firstDayOfYear = new Date(year, 0, 1);
    const pastDaysOfYear = (cycleStart - firstDayOfYear) / 86400000;
    const week = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);

    return week;
}
