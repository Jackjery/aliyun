// 圈次数据预警模块 - JavaScript 代码

// WebSocket 管理类
class WebSocketManager {
    constructor() {
        this.ws = null;
        this.connected = false;
        this.requestCallbacks = new Map();
        this.requestId = 0;
    }

    connect() {
        return new Promise((resolve, reject) => {
            const wsUrl = window.getWebSocketUrl();
            console.log('🔌 连接 WebSocket:', wsUrl);

            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                this.connected = true;
                console.log('✅ WebSocket 连接成功');
                resolve();
            };

            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);

                    if (message.type === 'stats_query_response' && message.requestId) {
                        const callback = this.requestCallbacks.get(message.requestId);
                        if (callback) {
                            callback(message.data);
                            this.requestCallbacks.delete(message.requestId);
                        }
                    }
                } catch (error) {
                    console.error('❌ 解析消息失败:', error);
                }
            };

            this.ws.onerror = (error) => {
                console.error('❌ WebSocket 错误:', error);
                reject(error);
            };

            this.ws.onclose = () => {
                this.connected = false;
                console.log('🔌 WebSocket 连接已关闭');
            };
        });
    }

    async query(queryType, options) {
        if (!this.connected) {
            throw new Error('WebSocket 未连接');
        }

        return new Promise((resolve, reject) => {
            const requestId = `req_${++this.requestId}_${Date.now()}`;

            this.requestCallbacks.set(requestId, (data) => {
                if (data.success) {
                    resolve(data.result);
                } else {
                    reject(new Error(data.error || '查询失败'));
                }
            });

            this.ws.send(JSON.stringify({
                type: 'stats_query',
                requestId,
                data: {
                    queryType,
                    options
                }
            }));

            // 30秒超时
            setTimeout(() => {
                if (this.requestCallbacks.has(requestId)) {
                    this.requestCallbacks.delete(requestId);
                    reject(new Error('查询超时'));
                }
            }, 30000);
        });
    }
}

// 预警分析引擎
class WarningAnalysisEngine {
    constructor() {}

    /**
     * 分析数据并生成预警结果
     * @param {Object} baseData - 基期分布数据 { customer, station, satellite }
     * @param {Object} currentData - 现期分布数据 { customer, station, satellite }
     * @param {Date} baseStart - 基期开始时间
     * @param {Date} baseEnd - 基期结束时间
     * @param {Date} currentStart - 现期开始时间
     * @param {Date} currentEnd - 现期结束时间
     * @param {number} threshold - 预警阈值（百分比）
     * @returns {Object} 预警结果
     */
    analyze(baseData, currentData, baseStart, baseEnd, currentStart, currentEnd, threshold) {
        // 确保时间顺序正确（开始时间 <= 结束时间）
        if (baseStart > baseEnd) [baseStart, baseEnd] = [baseEnd, baseStart];
        if (currentStart > currentEnd) [currentStart, currentEnd] = [currentEnd, currentStart];

        // 检查是否有足够数据
        const hasEnoughData = (
            (baseData.customer.length > 0 || currentData.customer.length > 0) ||
            (baseData.station.length > 0 || currentData.station.length > 0) ||
            (baseData.satellite.length > 0 || currentData.satellite.length > 0)
        );

        // 将数组转换为计数对象
        const baseCounts = {
            customer: this.arrayToCountMap(baseData.customer, 'customer_name'),
            station: this.arrayToCountMap(baseData.station, 'station_name'),
            satellite: this.arrayToCountMap(baseData.satellite, 'satellite_name')
        };

        const currentCounts = {
            customer: this.arrayToCountMap(currentData.customer, 'customer_name'),
            station: this.arrayToCountMap(currentData.station, 'station_name'),
            satellite: this.arrayToCountMap(currentData.satellite, 'satellite_name')
        };

        // 分析各维度的波动情况
        const stationWarnings = this.analyzeDimension(
            baseCounts.station, currentCounts.station, threshold
        );

        const customerWarnings = this.analyzeDimension(
            baseCounts.customer, currentCounts.customer, threshold
        );

        const satelliteWarnings = this.analyzeDimension(
            baseCounts.satellite, currentCounts.satellite, threshold
        );

        // 统计异常项总数
        const increaseCount = [
            ...stationWarnings,
            ...customerWarnings,
            ...satelliteWarnings
        ].filter(item => item.status === 'increase').length;

        const decreaseCount = [
            ...stationWarnings,
            ...customerWarnings,
            ...satelliteWarnings
        ].filter(item => item.status === 'decrease').length;

        // 计算总圈次
        const baseTotal = Object.values(baseCounts.customer).reduce((sum, val) => sum + val, 0);
        const currentTotal = Object.values(currentCounts.customer).reduce((sum, val) => sum + val, 0);

        return {
            hasEnoughData,
            stationWarnings,
            customerWarnings,
            satelliteWarnings,
            increaseCount,
            decreaseCount,
            basePeriod: { start: baseStart, end: baseEnd },
            currentPeriod: { start: currentStart, end: currentEnd },
            baseTotal,
            currentTotal
        };
    }

    /**
     * 将数组转换为计数映射
     * @param {Array} dataArray - 数据数组
     * @param {string} nameField - 名称字段
     * @returns {Object} 计数映射
     */
    arrayToCountMap(dataArray, nameField) {
        const countMap = {};
        dataArray.forEach(item => {
            const name = item[nameField] || '未知';
            countMap[name] = item.record_count || 0;
        });
        return countMap;
    }

    /**
     * 分析特定维度的波动情况
     * 波动幅度 = (现期值 - 基期值) / 基期值 × 100%
     */
    analyzeDimension(baseCounts, currentCounts, threshold) {
        const warnings = [];

        // 获取所有相关项（现期和基期的并集）
        const allItems = new Set([...Object.keys(currentCounts), ...Object.keys(baseCounts)]);

        allItems.forEach(item => {
            const currentValue = currentCounts[item] || 0;
            const baseValue = baseCounts[item] || 0;

            // 计算波动幅度
            let fluctuation;
            if (baseValue === 0) {
                // 基期值为0的特殊情况
                fluctuation = currentValue > 0 ? 100 : 0; // 从0到有值，视为100%增长
            } else {
                fluctuation = ((currentValue - baseValue) / baseValue) * 100;
            }

            // 确定预警状态
            let status = 'normal';
            if (fluctuation >= threshold) {
                status = 'increase'; // 增长异常
            } else if (fluctuation <= -threshold) {
                status = 'decrease'; // 下降异常
            }

            warnings.push({
                item,
                baseValue,
                currentValue,
                fluctuation,
                status
            });
        });

        // 按波动幅度绝对值排序
        return warnings.sort((a, b) => Math.abs(b.fluctuation) - Math.abs(a.fluctuation));
    }
}

// 数据导出工具
class DataExporter {
    /**
     * 导出表格数据为CSV文件
     * @param {Array} data - 要导出的数据
     * @param {string} filename - 文件名
     * @param {string} dimension - 维度名称（测站/客户/卫星）
     */
    exportToCSV(data, filename, dimension) {
        if (!data || !data.length) {
            alert('没有可导出的数据');
            return;
        }

        // CSV表头
        const headers = [
            dimension,
            '基期圈次',
            '现期圈次',
            '波动幅度(%)',
            '预警状态'
        ];

        // 转换数据为CSV行
        const rows = [headers.join(',')];

        data.forEach(item => {
            const statusText = item.status === 'increase' ? '增长异常' :
                              item.status === 'decrease' ? '下降异常' : '正常';

            const row = [
                `"${item.item}"`, // 处理包含逗号的情况
                item.baseValue,
                item.currentValue,
                item.fluctuation.toFixed(2),
                `"${statusText}"`
            ];
            rows.push(row.join(','));
        });

        // 创建CSV内容
        const csvContent = rows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

        // 使用FileSaver保存文件
        saveAs(blob, `${filename}.csv`);
    }
}

// 日期时间工具
class DateTimeUtil {
    /**
     * 获取默认的时间范围：现期为当日早8点到前一日早8点，基期为前一日早8点到前前一日早8点
     * 基于当前系统时间（北京时间）
     */
    getDefaultPeriods() {
        // 获取当前系统时间（北京时间由浏览器自动处理）
        const now = new Date();

        // 计算现期结束时间：当前日期的早上8点
        const currentEnd = new Date(now);
        currentEnd.setHours(8, 0, 0, 0);

        // 计算现期开始时间：前一天的早上8点
        const currentStart = new Date(currentEnd);
        currentStart.setDate(currentStart.getDate() - 1);

        // 计算基期结束时间：现期开始时间（前一天的早上8点）
        const baseEnd = new Date(currentStart);

        // 计算基期开始时间：前两天的早上8点
        const baseStart = new Date(baseEnd);
        baseStart.setDate(baseStart.getDate() - 1);

        return {
            baseStart,
            baseEnd,
            currentStart,
            currentEnd
        };
    }

    /**
     * 将日期转换为datetime-local输入框所需的格式 (YYYY-MM-DDThh:mm)
     */
    formatForInput(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');

        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    /**
     * 格式化日期为可读性更好的字符串
     */
    formatForDisplay(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');

        return `${year}-${month}-${day} ${hours}:${minutes}`;
    }
}

// 主应用类
class WarningApp {
    constructor() {
        this.wsManager = new WebSocketManager();
        this.warningEngine = new WarningAnalysisEngine();
        this.exporter = new DataExporter();
        this.dateUtil = new DateTimeUtil();

        // 应用状态
        this.warningResults = null;
        // 存储原始表格数据用于筛选
        this.tableData = {
            station: [],
            customer: [],
            satellite: []
        };

        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.setDefaultPeriods();
        await this.connectWebSocket();
    }

    async connectWebSocket() {
        const dbLoading = document.getElementById('dbLoading');
        dbLoading.classList.remove('hidden');
        document.getElementById('loadingStatus').textContent = '正在连接服务器...';

        try {
            await this.wsManager.connect();

            dbLoading.classList.add('hidden');
            document.getElementById('settingsSection').classList.remove('hidden');
            document.getElementById('resultsSection').classList.remove('hidden');
            console.log('✅ WebSocket 连接成功，页面已就绪');
        } catch (error) {
            dbLoading.classList.add('hidden');
            console.error('❌ WebSocket 连接失败:', error);
            document.getElementById('dbErrorAlert').classList.remove('hidden');
            document.getElementById('dbErrorMsg').textContent = 'WebSocket 连接失败: ' + error.message;
        }
    }

    setupEventListeners() {
        // 阈值滑块事件
        const thresholdSlider = document.getElementById('fluctuationThreshold');
        const thresholdValue = document.getElementById('thresholdValue');

        thresholdSlider.addEventListener('input', (e) => {
            thresholdValue.textContent = e.target.value;
        });

        // 计算预警数据按钮
        document.getElementById('calculateWarning').addEventListener('click', () => this.calculateWarnings());

        // 下载按钮事件
        document.getElementById('downloadStationData').addEventListener('click', () => {
            if (this.warningResults) {
                this.exporter.exportToCSV(
                    this.warningResults.stationWarnings,
                    '测站波动预警数据',
                    '测站名称'
                );
            }
        });

        document.getElementById('downloadCustomerData').addEventListener('click', () => {
            if (this.warningResults) {
                this.exporter.exportToCSV(
                    this.warningResults.customerWarnings,
                    '客户波动预警数据',
                    '客户名称'
                );
            }
        });

        document.getElementById('downloadSatelliteData').addEventListener('click', () => {
            if (this.warningResults) {
                this.exporter.exportToCSV(
                    this.warningResults.satelliteWarnings,
                    '卫星波动预警数据',
                    '卫星名称'
                );
            }
        });

        // 状态筛选按钮事件
        document.querySelectorAll('.status-filter').forEach(button => {
            button.addEventListener('click', (e) => {
                const status = e.target.dataset.status;
                const target = e.target.dataset.target;
                this.filterTableByStatus(target, status);
            });
        });
    }

    // 设置默认的基期和现期时间
    setDefaultPeriods() {
        const periods = this.dateUtil.getDefaultPeriods();

        document.getElementById('basePeriodStart').value = this.dateUtil.formatForInput(periods.baseStart);
        document.getElementById('basePeriodEnd').value = this.dateUtil.formatForInput(periods.baseEnd);
        document.getElementById('currentPeriodStart').value = this.dateUtil.formatForInput(periods.currentStart);
        document.getElementById('currentPeriodEnd').value = this.dateUtil.formatForInput(periods.currentEnd);
    }

    // 按状态筛选表格数据
    filterTableByStatus(target, status) {
        // 更新筛选按钮状态
        document.querySelectorAll(`.status-filter[data-target="${target}"]`).forEach(btn => {
            btn.classList.remove('filter-active');
        });
        document.querySelector(`.status-filter[data-target="${target}"][data-status="${status}"]`).classList.add('filter-active');

        // 获取表格数据和表格体
        const tableData = this.tableData[target];
        const tableBody = document.getElementById(`${target}WarningTable`);

        // 清空表格
        tableBody.innerHTML = '';

        // 如果没有数据
        if (!tableData || !tableData.length) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="px-6 py-10 text-center" style="color: rgb(var(--text-muted));">
                        没有数据或未达到预警阈值
                    </td>
                </tr>
            `;
            return;
        }

        // 筛选数据
        const filteredData = status === 'all'
            ? tableData
            : tableData.filter(item => item.status === status);

        // 如果筛选后没有数据
        if (!filteredData.length) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="px-6 py-10 text-center" style="color: rgb(var(--text-muted));">
                        没有符合筛选条件的数据
                    </td>
                </tr>
            `;
            return;
        }

        // 添加筛选后的数据行
        filteredData.forEach(item => {
            const row = document.createElement('tr');
            row.className = 'table-hover-row';

            // 格式化波动幅度
            const fluctuation = item.fluctuation.toFixed(2);
            const fluctuationClass = fluctuation >= 0 ? 'text-success' : 'text-danger';
            const fluctuationIcon = fluctuation >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';

            // 确定状态标签
            let statusHtml = '';
            if (item.status === 'increase') {
                statusHtml = '<span class="px-2 py-1 text-xs font-medium text-success rounded-full" style="background-color: rgba(var(--color-success), 0.1);">增长异常</span>';
            } else if (item.status === 'decrease') {
                statusHtml = '<span class="px-2 py-1 text-xs font-medium text-danger rounded-full" style="background-color: rgba(var(--color-danger), 0.1);">下降异常</span>';
            } else {
                statusHtml = '<span class="px-2 py-1 text-xs font-medium rounded-full" style="background-color: rgb(var(--bg-secondary)); color: rgb(var(--text-secondary));">正常</span>';
            }

            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium">${item.item}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm" style="color: rgb(var(--text-secondary));">${item.baseValue}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm" style="color: rgb(var(--text-secondary));">${item.currentValue}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm ${fluctuationClass}">
                        <i class="fa ${fluctuationIcon} mr-1"></i>${Math.abs(fluctuation)}%
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    ${statusHtml}
                </td>
            `;

            tableBody.appendChild(row);
        });
    }

    async calculateWarnings() {

        // 获取时间范围值
        const baseStartValue = document.getElementById('basePeriodStart').value;
        const baseEndValue = document.getElementById('basePeriodEnd').value;
        const currentStartValue = document.getElementById('currentPeriodStart').value;
        const currentEndValue = document.getElementById('currentPeriodEnd').value;

        // 验证时间输入
        if (!baseStartValue || !baseEndValue || !currentStartValue || !currentEndValue) {
            alert('请设置完整的基期和现期时间范围');
            return;
        }

        // 转换为日期对象
        const baseStart = new Date(baseStartValue);
        const baseEnd = new Date(baseEndValue);
        const currentStart = new Date(currentStartValue);
        const currentEnd = new Date(currentEndValue);

        // 验证日期有效性
        if (isNaN(baseStart.getTime()) || isNaN(baseEnd.getTime()) ||
            isNaN(currentStart.getTime()) || isNaN(currentEnd.getTime())) {
            alert('请输入有效的时间');
            return;
        }

        // 获取阈值
        const threshold = parseInt(document.getElementById('fluctuationThreshold').value);

        // 显示加载状态
        const calculateBtn = document.getElementById('calculateWarning');
        const originalBtnText = calculateBtn.innerHTML;
        calculateBtn.disabled = true;
        calculateBtn.innerHTML = '<i class="fa fa-spinner fa-spin mr-1"></i> 计算中...';

        try {
            // 格式化日期时间为后端需要的格式 (YYYY-MM-DD HH:MM:SS)
            const formatDateTime = (dateStr) => {
                return dateStr.replace('T', ' ') + ':00';
            };

            const baseStartDate = formatDateTime(baseStartValue);
            const baseEndDate = formatDateTime(baseEndValue);
            const currentStartDate = formatDateTime(currentStartValue);
            const currentEndDate = formatDateTime(currentEndValue);

            console.log('📊 查询基期数据:', baseStartDate, '-', baseEndDate);
            console.log('📊 查询现期数据:', currentStartDate, '-', currentEndDate);

            // 并行查询基期和现期的数据
            const [baseCustomer, baseStation, baseSatellite, currentCustomer, currentStation, currentSatellite] = await Promise.all([
                this.wsManager.query('customer_distribution', { startDate: baseStartDate, endDate: baseEndDate }),
                this.wsManager.query('station_distribution', { startDate: baseStartDate, endDate: baseEndDate }),
                this.wsManager.query('satellite_distribution', { startDate: baseStartDate, endDate: baseEndDate }),
                this.wsManager.query('customer_distribution', { startDate: currentStartDate, endDate: currentEndDate }),
                this.wsManager.query('station_distribution', { startDate: currentStartDate, endDate: currentEndDate }),
                this.wsManager.query('satellite_distribution', { startDate: currentStartDate, endDate: currentEndDate })
            ]);

            console.log('✅ 数据查询完成');
            console.log('   基期客户:', baseCustomer.records.length, '条');
            console.log('   基期测站:', baseStation.records.length, '条');
            console.log('   基期卫星:', baseSatellite.records.length, '条');
            console.log('   现期客户:', currentCustomer.records.length, '条');
            console.log('   现期测站:', currentStation.records.length, '条');
            console.log('   现期卫星:', currentSatellite.records.length, '条');

            // 组织数据
            const baseData = {
                customer: baseCustomer.records,
                station: baseStation.records,
                satellite: baseSatellite.records
            };

            const currentData = {
                customer: currentCustomer.records,
                station: currentStation.records,
                satellite: currentSatellite.records
            };

            // 执行预警分析
            this.warningResults = this.warningEngine.analyze(
                baseData,
                currentData,
                baseStart,
                baseEnd,
                currentStart,
                currentEnd,
                threshold
            );

            // 保存原始表格数据用于筛选
            this.tableData.station = this.warningResults.stationWarnings;
            this.tableData.customer = this.warningResults.customerWarnings;
            this.tableData.satellite = this.warningResults.satelliteWarnings;

            // 更新概览统计
            document.getElementById('increaseCount').textContent =
                this.warningResults.increaseCount || 0;
            document.getElementById('decreaseCount').textContent =
                this.warningResults.decreaseCount || 0;

            // 显示周期信息
            document.getElementById('basePeriodDisplay').textContent =
                `${this.dateUtil.formatForDisplay(this.warningResults.basePeriod.start)} - ${this.dateUtil.formatForDisplay(this.warningResults.basePeriod.end)}`;
            document.getElementById('currentPeriodDisplay').textContent =
                `${this.dateUtil.formatForDisplay(this.warningResults.currentPeriod.start)} - ${this.dateUtil.formatForDisplay(this.warningResults.currentPeriod.end)}`;

            // 显示警告信息（如果数据不足）
            if (!this.warningResults.hasEnoughData) {
                alert('所选时间范围内没有足够的数据进行分析');
            }

            // 初始渲染表格（默认显示异常项：上涨和下降）
            this.filterTableByStatus('station', 'increase');
            this.filterTableByStatus('customer', 'increase');
            this.filterTableByStatus('satellite', 'increase');

        } catch (error) {
            console.error('计算预警数据失败:', error);
            alert('计算预警数据时发生错误，请重试');
        } finally {
            // 恢复按钮状态
            calculateBtn.disabled = false;
            calculateBtn.innerHTML = originalBtnText;
        }
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    const app = new WarningApp();
});
