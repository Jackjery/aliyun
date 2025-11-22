/**
 * Trend Analysis Application
 * 趋势分析页面主应用逻辑
 * 使用 WebSocket 获取后端计算的统计数据，前端负责渲染
 */

class TrendAnalysisApp {
    constructor() {
        // WebSocket 管理器
        this.wsManager = null;

        // 多选下拉框实例（顶部筛选器）
        this.topFilters = {
            station: null,
            customer: null,
            satellite: null,
            taskType: null,
            taskStatus: null
        };

        // 多选下拉框实例（图表筛选器）
        this.chartFilters = {
            station: null,
            customer: null,
            satellite: null,
            taskType: null,
            taskStatus: null
        };

        // 图表实例
        this.charts = {
            station: null,
            customer: null,
            satellite: null,
            taskType: null,
            taskStatus: null
        };

        // 当前筛选条件
        this.currentFilters = {
            startDate: '',
            endDate: '',
            groupBy: 'day',
            stations: [],
            customers: [],
            satellites: [],
            taskTypes: [],
            taskStatuses: []
        };

        // 全部可用选项（用于级联筛选）
        this.allOptions = {
            stations: [],
            customers: [],
            satellites: [],
            taskTypes: [],
            taskStatuses: []
        };

        // 防抖计时器
        this.autoApplyTimer = null;

        // 同步锁（防止双向同步死循环）
        this.syncLock = false;

        // 周期规则配置
        this.cycleRules = this.loadCycleRules();

        // 数据标签显示状态（每个图表独立）
        this.showDataLabels = {
            station: false,
            customer: false,
            satellite: false,
            taskType: false,
            taskStatus: false
        };
    }

    /**
     * 初始化应用
     */
    async init() {
        console.log('🚀 TrendAnalysisApp 初始化开始');

        // 清除缓存（页面刷新时）
        this.clearPageCache();

        // 初始化日期
        this.initializeDates();

        // 初始化 WebSocket
        await this.initWebSocket();

        // 初始化顶部筛选器
        this.initTopFilters();

        // 初始化图表筛选器
        this.initChartFilters();

        // 初始化事件监听
        this.initEventListeners();

        // 初始化周期规则模态框
        this.initCycleRulesModal();

        // 加载筛选器选项
        await this.loadFilterOptions();

        console.log('✅ TrendAnalysisApp 初始化完成');
    }

    /**
     * 清除页面缓存
     */
    clearPageCache() {
        // 清除 sessionStorage 中的图表缓存
        sessionStorage.removeItem('trend_chart_cache');
        sessionStorage.removeItem('trend_filter_state');
        console.log('🗑️ 页面缓存已清除');
    }

    /**
     * 初始化日期（开始日期 = 一个月前，结束日期 = 今天）
     */
    initializeDates() {
        const today = new Date();
        const oneMonthAgo = new Date(today);
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        const formatDate = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        this.currentFilters.startDate = formatDate(oneMonthAgo);
        this.currentFilters.endDate = formatDate(today);

        // 更新 UI
        const startDateEl = document.getElementById('startDate');
        const endDateEl = document.getElementById('endDate');
        if (startDateEl) startDateEl.value = this.currentFilters.startDate;
        if (endDateEl) endDateEl.value = this.currentFilters.endDate;

        console.log(`📅 日期已初始化: ${this.currentFilters.startDate} ~ ${this.currentFilters.endDate}`);
    }

    /**
     * 初始化 WebSocket 连接
     */
    async initWebSocket() {
        // 等待 wsManager 实例创建
        if (!window.wsManager) {
            await new Promise((resolve) => {
                const checkInterval = setInterval(() => {
                    if (window.wsManager) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 50);
            });
        }

        this.wsManager = window.wsManager;

        // 连接 WebSocket
        this.wsManager.connect();

        // 设置连接状态回调
        this.wsManager.onConnectionChange = (connected) => {
            if (connected) {
                console.log('✅ WebSocket 已连接');
            } else {
                console.warn('⚠️ WebSocket 连接断开');
            }
        };

        // 等待连接成功
        return new Promise((resolve, reject) => {
            const checkInterval = setInterval(() => {
                if (this.wsManager.isConnected) {
                    clearInterval(checkInterval);
                    console.log('✅ WebSocket 连接成功');
                    resolve();
                }
            }, 100);

            setTimeout(() => {
                clearInterval(checkInterval);
                if (!this.wsManager.isConnected) {
                    console.warn('⚠️ WebSocket 连接超时，但继续初始化');
                    resolve(); // 不要阻塞，允许继续初始化
                }
            }, 5000);
        });
    }

    /**
     * 初始化顶部筛选器
     */
    initTopFilters() {
        this.topFilters.station = new MultiSelectDropdown(
            'stationDropdown',
            'stationOptions',
            'stationDisplay',
            'stationValue',
            'stationTags',
            'stationSearch',
            'selectAllStations',
            (values) => this.onTopFilterChange('stations', values)
        );

        this.topFilters.customer = new MultiSelectDropdown(
            'customerDropdown',
            'customerOptions',
            'customerDisplay',
            'customerValue',
            'customerTags',
            'customerSearch',
            'selectAllCustomers',
            (values) => this.onTopFilterChange('customers', values)
        );

        this.topFilters.satellite = new MultiSelectDropdown(
            'satelliteDropdown',
            'satelliteOptions',
            'satelliteDisplay',
            'satelliteValue',
            'satelliteTags',
            'satelliteSearch',
            'selectAllSatellites',
            (values) => this.onTopFilterChange('satellites', values)
        );

        this.topFilters.taskType = new MultiSelectDropdown(
            'typeDropdown',
            'typeOptions',
            'typeDisplay',
            'typeValue',
            'typeTags',
            'typeSearch',
            'selectAllTypes',
            (values) => this.onTopFilterChange('taskTypes', values)
        );

        this.topFilters.taskStatus = new MultiSelectDropdown(
            'statusDropdown',
            'statusOptions',
            'statusDisplay',
            'statusValue',
            'statusTags',
            'statusSearch',
            'selectAllStatuses',
            (values) => this.onTopFilterChange('taskStatuses', values)
        );

        console.log('✅ 顶部筛选器初始化完成');
    }

    /**
     * 初始化图表筛选器
     */
    initChartFilters() {
        this.chartFilters.station = new MultiSelectDropdown(
            'stationChartDropdown',
            'stationChartOptions',
            'stationChartDisplay',
            'stationChartValue',
            'stationChartTags',
            'stationChartSearch',
            'selectAllStationChart',
            (values) => this.onChartFilterChange('stations', values)
        );

        this.chartFilters.customer = new MultiSelectDropdown(
            'customerChartDropdown',
            'customerChartOptions',
            'customerChartDisplay',
            'customerChartValue',
            'customerChartTags',
            'customerChartSearch',
            'selectAllCustomerChart',
            (values) => this.onChartFilterChange('customers', values)
        );

        this.chartFilters.satellite = new MultiSelectDropdown(
            'satelliteChartDropdown',
            'satelliteChartOptions',
            'satelliteChartDisplay',
            'satelliteChartValue',
            'satelliteChartTags',
            'satelliteChartSearch',
            'selectAllSatelliteChart',
            (values) => this.onChartFilterChange('satellites', values)
        );

        this.chartFilters.taskType = new MultiSelectDropdown(
            'typeChartDropdown',
            'typeChartOptions',
            'typeChartDisplay',
            'typeChartValue',
            'typeChartTags',
            'typeChartSearch',
            'selectAllTypeChart',
            (values) => this.onChartFilterChange('taskTypes', values)
        );

        this.chartFilters.taskStatus = new MultiSelectDropdown(
            'statusChartDropdown',
            'statusChartOptions',
            'statusChartDisplay',
            'statusChartValue',
            'statusChartTags',
            'statusChartSearch',
            'selectAllStatusChart',
            (values) => this.onChartFilterChange('taskStatuses', values)
        );

        console.log('✅ 图表筛选器初始化完成');
    }

    /**
     * 初始化事件监听
     */
    initEventListeners() {
        // 日期和周期变化
        const startDateEl = document.getElementById('startDate');
        const endDateEl = document.getElementById('endDate');
        const groupByEl = document.getElementById('groupBy');

        if (startDateEl) {
            startDateEl.addEventListener('change', () => {
                this.currentFilters.startDate = startDateEl.value;
                this.triggerAutoApply();
            });
        }

        if (endDateEl) {
            endDateEl.addEventListener('change', () => {
                this.currentFilters.endDate = endDateEl.value;
                this.triggerAutoApply();
            });
        }

        if (groupByEl) {
            groupByEl.addEventListener('change', () => {
                this.currentFilters.groupBy = groupByEl.value;
                this.triggerAutoApply();
            });
        }

        // 应用筛选按钮
        const applyBtn = document.getElementById('applyFilters');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                this.renderAllCharts();
            });
        }

        // 重置筛选按钮
        const resetBtn = document.getElementById('resetFilters');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetAllFilters();
            });
        }

        // 重置图表按钮
        const resetStationBtn = document.getElementById('resetStationChart');
        const resetCustomerBtn = document.getElementById('resetCustomerChart');
        const resetSatelliteBtn = document.getElementById('resetSatelliteChart');
        const resetTypeBtn = document.getElementById('resetTypeChart');
        const resetStatusBtn = document.getElementById('resetStatusChart');

        if (resetStationBtn) resetStationBtn.addEventListener('click', () => this.resetChartFilter('station'));
        if (resetCustomerBtn) resetCustomerBtn.addEventListener('click', () => this.resetChartFilter('customer'));
        if (resetSatelliteBtn) resetSatelliteBtn.addEventListener('click', () => this.resetChartFilter('satellite'));
        if (resetTypeBtn) resetTypeBtn.addEventListener('click', () => this.resetChartFilter('type'));
        if (resetStatusBtn) resetStatusBtn.addEventListener('click', () => this.resetChartFilter('status'));

        // 数据标签复选框
        const showStationLabels = document.getElementById('showStationLabels');
        const showCustomerLabels = document.getElementById('showCustomerLabels');
        const showSatelliteLabels = document.getElementById('showSatelliteLabels');
        const showTypeLabels = document.getElementById('showTypeLabels');
        const showStatusLabels = document.getElementById('showStatusLabels');

        if (showStationLabels) showStationLabels.addEventListener('change', (e) => this.toggleDataLabels('station', e.target.checked));
        if (showCustomerLabels) showCustomerLabels.addEventListener('change', (e) => this.toggleDataLabels('customer', e.target.checked));
        if (showSatelliteLabels) showSatelliteLabels.addEventListener('change', (e) => this.toggleDataLabels('satellite', e.target.checked));
        if (showTypeLabels) showTypeLabels.addEventListener('change', (e) => this.toggleDataLabels('taskType', e.target.checked));
        if (showStatusLabels) showStatusLabels.addEventListener('change', (e) => this.toggleDataLabels('taskStatus', e.target.checked));

        // 下载按钮
        const downloadBtns = document.querySelectorAll('.chart-download-btn');
        downloadBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const chartName = btn.dataset.chart;
                const type = btn.dataset.type;
                if (type === 'image') {
                    this.downloadChart(chartName);
                } else if (type === 'csv') {
                    this.downloadData(chartName);
                }
            });
        });

        console.log('✅ 事件监听初始化完成');
    }

    /**
     * 初始化周期规则模态框
     */
    initCycleRulesModal() {
        const settingsBtn = document.getElementById('configGroupingBtn');
        const modal = document.getElementById('groupingConfigModal');
        const closeBtn = document.getElementById('closeConfigModal');
        const saveBtn = document.getElementById('saveGroupingConfig');

        if (settingsBtn && modal) {
            settingsBtn.addEventListener('click', () => {
                this.showCycleRulesModal();
            });
        }

        if (closeBtn && modal) {
            closeBtn.addEventListener('click', () => {
                this.hideCycleRulesModal();
            });
        }

        if (saveBtn && modal) {
            saveBtn.addEventListener('click', () => {
                this.saveCycleRules();
                this.hideCycleRulesModal();
                this.triggerAutoApply();
            });
        }

        // 日周期时间输入实时更新显示
        const dayStartInput = document.getElementById('dayStart');
        if (dayStartInput) {
            dayStartInput.addEventListener('input', (e) => {
                const startTime = e.target.value;
                const dayStartDisplay = document.getElementById('dayStartDisplay');
                const dayEndDisplay = document.getElementById('dayEndDisplay');
                if (dayStartDisplay) dayStartDisplay.textContent = startTime;
                if (dayEndDisplay) dayEndDisplay.textContent = startTime;
            });
        }

        console.log('✅ 周期规则模态框初始化完成');
    }

    /**
     * 显示周期规则模态框
     */
    showCycleRulesModal() {
        const modal = document.getElementById('groupingConfigModal');
        if (modal) {
            // 加载当前配置到表单
            this.loadConfigToForm();

            modal.classList.remove('hidden');
            setTimeout(() => {
                const modalContent = document.getElementById('modalContent');
                if (modalContent) {
                    modalContent.classList.remove('scale-95', 'opacity-0');
                }
            }, 10);
        }
    }

    /**
     * 隐藏周期规则模态框
     */
    hideCycleRulesModal() {
        const modal = document.getElementById('groupingConfigModal');
        if (modal) {
            const modalContent = document.getElementById('modalContent');
            if (modalContent) {
                modalContent.classList.add('scale-95', 'opacity-0');
            }
            setTimeout(() => {
                modal.classList.add('hidden');
            }, 300);
        }
    }

    /**
     * 保存周期规则
     */
    saveCycleRules() {
        const dayStart = document.getElementById('dayStart');
        const weekStartDay = document.getElementById('weekStartDay');
        const weekStartTime = document.getElementById('weekStartTime');
        const monthStartDate = document.getElementById('monthStartDate');
        const monthStartTime = document.getElementById('monthStartTime');
        const quarterStartMonth = document.getElementById('quarterStartMonth');
        const quarterStartTime = document.getElementById('quarterStartTime');

        this.cycleRules = {
            day: {
                startTime: dayStart?.value || '00:00'
            },
            week: {
                startDay: parseInt(weekStartDay?.value || '1'),
                startTime: weekStartTime?.value || '00:00'
            },
            month: {
                startDate: parseInt(monthStartDate?.value || '1'),
                startTime: monthStartTime?.value || '00:00'
            },
            quarter: {
                startMonth: parseInt(quarterStartMonth?.value || '1'),
                startTime: quarterStartTime?.value || '00:00'
            }
        };

        // 保存到 localStorage
        localStorage.setItem('cycle_rules', JSON.stringify(this.cycleRules));
        console.log('💾 周期规则已保存', this.cycleRules);
    }

    /**
     * 加载周期规则
     */
    loadCycleRules() {
        const saved = localStorage.getItem('cycle_rules');
        if (saved) {
            try {
                const rules = JSON.parse(saved);

                // 🔄 数据迁移：将旧格式 day.start 转换为 day.startTime
                if (rules.day && rules.day.start && !rules.day.startTime) {
                    rules.day.startTime = rules.day.start;
                    delete rules.day.start;
                    console.log('🔄 已迁移周期规则格式：day.start -> day.startTime');
                    // 保存迁移后的数据
                    localStorage.setItem('cycle_rules', JSON.stringify(rules));
                }

                // 确保数值类型正确
                if (rules.week && typeof rules.week.startDay === 'string') {
                    rules.week.startDay = parseInt(rules.week.startDay);
                }
                if (rules.month && typeof rules.month.startDate === 'string') {
                    rules.month.startDate = parseInt(rules.month.startDate);
                }
                if (rules.quarter && typeof rules.quarter.startMonth === 'string') {
                    rules.quarter.startMonth = parseInt(rules.quarter.startMonth);
                }

                return rules;
            } catch (e) {
                console.error('加载周期规则失败', e);
            }
        }

        // 默认规则
        return {
            day: { startTime: '00:00' },
            week: { startDay: 1, startTime: '00:00' },
            month: { startDate: 1, startTime: '00:00' },
            quarter: { startMonth: 1, startTime: '00:00' }
        };
    }

    /**
     * 加载配置到表单
     */
    loadConfigToForm() {
        // 日周期
        const dayStartTime = this.cycleRules.day.startTime;
        const dayStartInput = document.getElementById('dayStart');
        const dayStartDisplay = document.getElementById('dayStartDisplay');
        const dayEndDisplay = document.getElementById('dayEndDisplay');

        if (dayStartInput) dayStartInput.value = dayStartTime;
        if (dayStartDisplay) dayStartDisplay.textContent = dayStartTime;
        if (dayEndDisplay) dayEndDisplay.textContent = dayStartTime;

        // 周周期
        const weekStartDay = document.getElementById('weekStartDay');
        const weekStartTime = document.getElementById('weekStartTime');
        if (weekStartDay) weekStartDay.value = this.cycleRules.week.startDay;
        if (weekStartTime) weekStartTime.value = this.cycleRules.week.startTime;

        // 月周期
        const monthStartDate = document.getElementById('monthStartDate');
        const monthStartTime = document.getElementById('monthStartTime');
        if (monthStartDate) monthStartDate.value = this.cycleRules.month.startDate;
        if (monthStartTime) monthStartTime.value = this.cycleRules.month.startTime;

        // 季度周期
        const quarterStartMonth = document.getElementById('quarterStartMonth');
        const quarterStartTime = document.getElementById('quarterStartTime');
        if (quarterStartMonth) quarterStartMonth.value = this.cycleRules.quarter.startMonth;
        if (quarterStartTime) quarterStartTime.value = this.cycleRules.quarter.startTime;

        console.log('📋 配置已加载到表单', this.cycleRules);
    }

    /**
     * 加载筛选器选项
     */
    async loadFilterOptions() {
        try {
            this.showLoading('正在加载筛选器选项...');

            const result = await this.wsManager.queryStats('filter_options', {
                startDate: this.currentFilters.startDate,
                endDate: this.currentFilters.endDate,
                filters: {
                    stations: this.currentFilters.stations,
                    customers: this.currentFilters.customers,
                    satellites: this.currentFilters.satellites,
                    taskTypes: this.currentFilters.taskTypes,
                    taskStatuses: this.currentFilters.taskStatuses
                }
            });

            if (result) {
                // 转换后端返回的数组为 {label, value} 格式
                const transformOptions = (arr) => {
                    return (arr || []).map(item => ({
                        label: item,
                        value: item
                    }));
                };

                this.allOptions.stations = transformOptions(result.stations);
                this.allOptions.customers = transformOptions(result.customers);
                this.allOptions.satellites = transformOptions(result.satellites);
                this.allOptions.taskTypes = transformOptions(result.taskTypes);
                this.allOptions.taskStatuses = transformOptions(result.taskStatuses);

                // 设置顶部筛选器选项
                this.topFilters.station.setOptions(this.allOptions.stations);
                this.topFilters.customer.setOptions(this.allOptions.customers);
                this.topFilters.satellite.setOptions(this.allOptions.satellites);
                this.topFilters.taskType.setOptions(this.allOptions.taskTypes);
                this.topFilters.taskStatus.setOptions(this.allOptions.taskStatuses);

                // 设置图表筛选器选项
                this.chartFilters.station.setOptions(this.allOptions.stations);
                this.chartFilters.customer.setOptions(this.allOptions.customers);
                this.chartFilters.satellite.setOptions(this.allOptions.satellites);
                this.chartFilters.taskType.setOptions(this.allOptions.taskTypes);
                this.chartFilters.taskStatus.setOptions(this.allOptions.taskStatuses);

                console.log('✅ 筛选器选项加载完成', {
                    stations: this.allOptions.stations.length,
                    customers: this.allOptions.customers.length,
                    satellites: this.allOptions.satellites.length,
                    taskTypes: this.allOptions.taskTypes.length,
                    taskStatuses: this.allOptions.taskStatuses.length
                });
            }

            this.hideLoading();
        } catch (error) {
            console.error('❌ 加载筛选器选项失败', error);
            this.showError('加载筛选器选项失败');
            this.hideLoading();
        }
    }

    /**
     * 顶部筛选器变化时
     */
    onTopFilterChange(filterName, values) {
        if (this.syncLock) return;

        console.log(`🔄 顶部筛选器变化: ${filterName}`, values);

        // 更新当前筛选条件
        this.currentFilters[filterName] = values;

        // 级联更新下游筛选器选项
        this.cascadeFilterOptions(filterName);

        // 同步到对应的图表筛选器
        this.syncToChartFilter(filterName, values);

        // 触发自动应用
        this.triggerAutoApply();
    }

    /**
     * 图表筛选器变化时
     */
    onChartFilterChange(filterName, values) {
        if (this.syncLock) return;

        console.log(`🔄 图表筛选器变化: ${filterName}`, values);

        // 同步到对应的顶部筛选器
        this.syncToTopFilter(filterName, values);

        // 级联更新下游筛选器选项
        this.cascadeFilterOptions(filterName);

        // 触发自动应用
        this.triggerAutoApply();
    }

    /**
     * 级联更新筛选器选项
     * 层级关系: 测站 → 客户 → 卫星 → 任务类型 → 任务结果状态
     */
    async cascadeFilterOptions(changedFilterName) {
        try {
            // 查询级联后的选项（filter_options 使用不同的参数格式）
            const result = await this.wsManager.queryStats('filter_options', {
                startDate: this.currentFilters.startDate,
                endDate: this.currentFilters.endDate,
                filters: {
                    stations: this.currentFilters.stations,
                    customers: this.currentFilters.customers,
                    satellites: this.currentFilters.satellites,
                    taskTypes: this.currentFilters.taskTypes,
                    taskStatuses: this.currentFilters.taskStatuses
                }
            });

            if (result) {
                // 转换后端返回的数组为 {label, value} 格式
                const transformOptions = (arr) => {
                    return (arr || []).map(item => ({
                        label: item,
                        value: item
                    }));
                };

                // 根据变化的筛选器，更新下游筛选器
                const filterHierarchy = ['stations', 'customers', 'satellites', 'taskTypes', 'taskStatuses'];
                const changedIndex = filterHierarchy.indexOf(changedFilterName);

                if (changedIndex >= 0) {
                    // 更新下游筛选器选项
                    for (let i = changedIndex + 1; i < filterHierarchy.length; i++) {
                        const downstreamFilter = filterHierarchy[i];
                        const newOptions = transformOptions(result[downstreamFilter]);

                        // 更新全部选项
                        this.allOptions[downstreamFilter] = newOptions;

                        // 更新顶部筛选器选项
                        const topFilterKey = this.getFilterKey(downstreamFilter);
                        if (this.topFilters[topFilterKey]) {
                            this.topFilters[topFilterKey].setOptions(newOptions);
                        }

                        // 更新图表筛选器选项
                        if (this.chartFilters[topFilterKey]) {
                            this.chartFilters[topFilterKey].setOptions(newOptions);
                        }

                        // 移除不再有效的选中值
                        const validValues = newOptions.map(opt => opt.value);
                        const currentValues = this.currentFilters[downstreamFilter] || [];
                        const filteredValues = currentValues.filter(v => validValues.includes(v));

                        if (filteredValues.length !== currentValues.length) {
                            this.currentFilters[downstreamFilter] = filteredValues;

                            // 更新 UI（不触发 onChange）
                            this.syncLock = true;
                            if (this.topFilters[topFilterKey]) {
                                this.topFilters[topFilterKey].setSelectedValues(filteredValues);
                            }
                            if (this.chartFilters[topFilterKey]) {
                                this.chartFilters[topFilterKey].setSelectedValues(filteredValues);
                            }
                            this.syncLock = false;
                        }
                    }
                }

                console.log('✅ 级联筛选器选项更新完成');
            }
        } catch (error) {
            console.error('❌ 级联更新失败', error);
        }
    }

    /**
     * 同步到图表筛选器
     */
    syncToChartFilter(filterName, values) {
        this.syncLock = true;

        const filterKey = this.getFilterKey(filterName);
        if (this.chartFilters[filterKey]) {
            this.chartFilters[filterKey].setSelectedValues(values);
        }

        this.syncLock = false;
    }

    /**
     * 同步到顶部筛选器
     */
    syncToTopFilter(filterName, values) {
        this.syncLock = true;

        // 更新当前筛选条件
        this.currentFilters[filterName] = values;

        const filterKey = this.getFilterKey(filterName);
        if (this.topFilters[filterKey]) {
            this.topFilters[filterKey].setSelectedValues(values);
        }

        this.syncLock = false;
    }

    /**
     * 获取筛选器键名
     */
    getFilterKey(filterName) {
        const keyMap = {
            'stations': 'station',
            'customers': 'customer',
            'satellites': 'satellite',
            'taskTypes': 'taskType',
            'taskStatuses': 'taskStatus'
        };
        return keyMap[filterName] || filterName;
    }

    /**
     * 触发自动应用（防抖）
     */
    triggerAutoApply() {
        if (this.autoApplyTimer) {
            clearTimeout(this.autoApplyTimer);
        }

        this.autoApplyTimer = setTimeout(() => {
            requestAnimationFrame(() => {
                this.renderAllCharts();
            });
        }, 300);
    }

    /**
     * 渲染所有图表
     */
    async renderAllCharts() {
        console.log('🎨 开始渲染所有图表', this.currentFilters);

        // 显示图表区域
        const chartsSection = document.getElementById('chartsSection');
        if (chartsSection) {
            chartsSection.classList.remove('hidden');
        }

        await Promise.all([
            this.renderStationChart(),
            this.renderCustomerChart(),
            this.renderSatelliteChart(),
            this.renderTaskTypeChart(),
            this.renderTaskStatusChart()
        ]);

        console.log('✅ 所有图表渲染完成');
    }

    /**
     * 渲染测站趋势图
     */
    async renderStationChart() {
        try {
            const canvas = document.getElementById('stationChart');
            const emptyState = document.getElementById('stationChartEmpty');
            if (!canvas) return;

            this.showChartLoading('station');

            const result = await this.wsManager.queryStats('station_trend', {
                startDate: this.currentFilters.startDate,
                endDate: this.currentFilters.endDate,
                groupBy: this.currentFilters.groupBy,
                groupingRule: this.cycleRules[this.currentFilters.groupBy],
                filters: {
                    stations: this.currentFilters.stations,
                    customers: this.currentFilters.customers,
                    satellites: this.currentFilters.satellites,
                    taskTypes: this.currentFilters.taskTypes,
                    taskStatuses: this.currentFilters.taskStatuses
                }
            });

            if (result && result.records && result.records.length > 0) {
                const chartData = convertToChartData(result.records, 'station_name', 'record_count', {
                    startDate: this.currentFilters.startDate,
                    endDate: this.currentFilters.endDate,
                    groupBy: this.currentFilters.groupBy
                });

                // 格式化周期标签
                chartData.labels = chartData.labels.map(label =>
                    formatPeriodLabel(label, this.currentFilters.groupBy)
                );

                // 销毁旧图表
                if (this.charts.station) {
                    this.charts.station.destroy();
                }

                // 创建新图表
                this.charts.station = new Chart(canvas, {
                    type: 'line',
                    data: chartData,
                    options: this.getChartOptions('测站趋势', 'station')
                });

                // 创建自定义图例
                this.createCustomLegend(this.charts.station, 'stationChartLegend');

                // 显示图表
                canvas.style.display = 'block';
                if (emptyState) emptyState.classList.add('hidden');
            } else {
                // 显示空状态
                if (this.charts.station) {
                    this.charts.station.destroy();
                    this.charts.station = null;
                }
                canvas.style.display = 'none';
                if (emptyState) emptyState.classList.remove('hidden');
                // 清空图例
                const legendContainer = document.getElementById('stationChartLegend');
                if (legendContainer) legendContainer.innerHTML = '';
            }

            this.hideChartLoading('station');
        } catch (error) {
            console.error('❌ 渲染测站趋势图失败', error);
            this.hideChartLoading('station');
            this.showError('渲染测站趋势图失败');
        }
    }

    /**
     * 渲染客户趋势图
     */
    async renderCustomerChart() {
        try {
            const canvas = document.getElementById('customerChart');
            const emptyState = document.getElementById('customerChartEmpty');
            if (!canvas) return;

            this.showChartLoading('customer');

            const result = await this.wsManager.queryStats('customer_dimension_trend', {
                startDate: this.currentFilters.startDate,
                endDate: this.currentFilters.endDate,
                groupBy: this.currentFilters.groupBy,
                groupingRule: this.cycleRules[this.currentFilters.groupBy],
                filters: {
                    stations: this.currentFilters.stations,
                    customers: this.currentFilters.customers,
                    satellites: this.currentFilters.satellites,
                    taskTypes: this.currentFilters.taskTypes,
                    taskStatuses: this.currentFilters.taskStatuses
                }
            });

            if (result && result.records && result.records.length > 0) {
                const chartData = convertToChartData(result.records, 'customer_name', 'record_count', {
                    startDate: this.currentFilters.startDate,
                    endDate: this.currentFilters.endDate,
                    groupBy: this.currentFilters.groupBy
                });

                chartData.labels = chartData.labels.map(label =>
                    formatPeriodLabel(label, this.currentFilters.groupBy)
                );

                if (this.charts.customer) {
                    this.charts.customer.destroy();
                }

                this.charts.customer = new Chart(canvas, {
                    type: 'line',
                    data: chartData,
                    options: this.getChartOptions('客户趋势', 'customer')
                });

                // 创建自定义图例
                this.createCustomLegend(this.charts.customer, 'customerChartLegend');

                canvas.style.display = 'block';
                if (emptyState) emptyState.classList.add('hidden');
            } else {
                if (this.charts.customer) {
                    this.charts.customer.destroy();
                    this.charts.customer = null;
                }
                canvas.style.display = 'none';
                if (emptyState) emptyState.classList.remove('hidden');
                // 清空图例
                const legendContainer = document.getElementById('customerChartLegend');
                if (legendContainer) legendContainer.innerHTML = '';
            }

            this.hideChartLoading('customer');
        } catch (error) {
            console.error('❌ 渲染客户趋势图失败', error);
            this.hideChartLoading('customer');
            this.showError('渲染客户趋势图失败');
        }
    }

    /**
     * 渲染卫星趋势图
     */
    async renderSatelliteChart() {
        try {
            const canvas = document.getElementById('satelliteChart');
            const emptyState = document.getElementById('satelliteChartEmpty');
            if (!canvas) return;

            this.showChartLoading('satellite');

            const result = await this.wsManager.queryStats('satellite_dimension_trend', {
                startDate: this.currentFilters.startDate,
                endDate: this.currentFilters.endDate,
                groupBy: this.currentFilters.groupBy,
                groupingRule: this.cycleRules[this.currentFilters.groupBy],
                filters: {
                    stations: this.currentFilters.stations,
                    customers: this.currentFilters.customers,
                    satellites: this.currentFilters.satellites,
                    taskTypes: this.currentFilters.taskTypes,
                    taskStatuses: this.currentFilters.taskStatuses
                }
            });

            if (result && result.records && result.records.length > 0) {
                const chartData = convertToChartData(result.records, 'satellite_name', 'record_count', {
                    startDate: this.currentFilters.startDate,
                    endDate: this.currentFilters.endDate,
                    groupBy: this.currentFilters.groupBy
                });

                chartData.labels = chartData.labels.map(label =>
                    formatPeriodLabel(label, this.currentFilters.groupBy)
                );

                if (this.charts.satellite) {
                    this.charts.satellite.destroy();
                }

                this.charts.satellite = new Chart(canvas, {
                    type: 'line',
                    data: chartData,
                    options: this.getChartOptions('卫星趋势', 'satellite')
                });

                // 创建自定义图例
                this.createCustomLegend(this.charts.satellite, 'satelliteChartLegend');

                canvas.style.display = 'block';
                if (emptyState) emptyState.classList.add('hidden');
            } else {
                if (this.charts.satellite) {
                    this.charts.satellite.destroy();
                    this.charts.satellite = null;
                }
                canvas.style.display = 'none';
                if (emptyState) emptyState.classList.remove('hidden');
                // 清空图例
                const legendContainer = document.getElementById('satelliteChartLegend');
                if (legendContainer) legendContainer.innerHTML = '';
            }

            this.hideChartLoading('satellite');
        } catch (error) {
            console.error('❌ 渲染卫星趋势图失败', error);
            this.hideChartLoading('satellite');
            this.showError('渲染卫星趋势图失败');
        }
    }

    /**
     * 渲染任务类型趋势图
     */
    async renderTaskTypeChart() {
        try {
            const canvas = document.getElementById('typeChart');
            const emptyState = document.getElementById('typeChartEmpty');
            if (!canvas) return;

            this.showChartLoading('type');

            const result = await this.wsManager.queryStats('task_type_trend', {
                startDate: this.currentFilters.startDate,
                endDate: this.currentFilters.endDate,
                groupBy: this.currentFilters.groupBy,
                groupingRule: this.cycleRules[this.currentFilters.groupBy],
                filters: {
                    stations: this.currentFilters.stations,
                    customers: this.currentFilters.customers,
                    satellites: this.currentFilters.satellites,
                    taskTypes: this.currentFilters.taskTypes,
                    taskStatuses: this.currentFilters.taskStatuses
                }
            });

            if (result && result.records && result.records.length > 0) {
                const chartData = convertToChartData(result.records, 'task_type', 'record_count', {
                    startDate: this.currentFilters.startDate,
                    endDate: this.currentFilters.endDate,
                    groupBy: this.currentFilters.groupBy
                });

                chartData.labels = chartData.labels.map(label =>
                    formatPeriodLabel(label, this.currentFilters.groupBy)
                );

                if (this.charts.taskType) {
                    this.charts.taskType.destroy();
                }

                this.charts.taskType = new Chart(canvas, {
                    type: 'line',
                    data: chartData,
                    options: this.getChartOptions('任务类型趋势', 'taskType')
                });

                // 创建自定义图例
                this.createCustomLegend(this.charts.taskType, 'typeChartLegend');

                canvas.style.display = 'block';
                if (emptyState) emptyState.classList.add('hidden');
            } else {
                if (this.charts.taskType) {
                    this.charts.taskType.destroy();
                    this.charts.taskType = null;
                }
                canvas.style.display = 'none';
                if (emptyState) emptyState.classList.remove('hidden');
                // 清空图例
                const legendContainer = document.getElementById('typeChartLegend');
                if (legendContainer) legendContainer.innerHTML = '';
            }

            this.hideChartLoading('type');
        } catch (error) {
            console.error('❌ 渲染任务类型趋势图失败', error);
            this.hideChartLoading('type');
            this.showError('渲染任务类型趋势图失败');
        }
    }

    /**
     * 渲染任务结果状态趋势图
     */
    async renderTaskStatusChart() {
        try {
            const canvas = document.getElementById('statusChart');
            const emptyState = document.getElementById('statusChartEmpty');
            if (!canvas) return;

            this.showChartLoading('status');

            const result = await this.wsManager.queryStats('task_status_trend', {
                startDate: this.currentFilters.startDate,
                endDate: this.currentFilters.endDate,
                groupBy: this.currentFilters.groupBy,
                groupingRule: this.cycleRules[this.currentFilters.groupBy],
                filters: {
                    stations: this.currentFilters.stations,
                    customers: this.currentFilters.customers,
                    satellites: this.currentFilters.satellites,
                    taskTypes: this.currentFilters.taskTypes,
                    taskStatuses: this.currentFilters.taskStatuses
                }
            });

            if (result && result.records && result.records.length > 0) {
                const chartData = convertToChartData(result.records, 'task_status', 'record_count', {
                    startDate: this.currentFilters.startDate,
                    endDate: this.currentFilters.endDate,
                    groupBy: this.currentFilters.groupBy
                });

                chartData.labels = chartData.labels.map(label =>
                    formatPeriodLabel(label, this.currentFilters.groupBy)
                );

                if (this.charts.taskStatus) {
                    this.charts.taskStatus.destroy();
                }

                this.charts.taskStatus = new Chart(canvas, {
                    type: 'line',
                    data: chartData,
                    options: this.getChartOptions('任务结果状态趋势', 'taskStatus')
                });

                // 创建自定义图例
                this.createCustomLegend(this.charts.taskStatus, 'statusChartLegend');

                canvas.style.display = 'block';
                if (emptyState) emptyState.classList.add('hidden');
            } else {
                if (this.charts.taskStatus) {
                    this.charts.taskStatus.destroy();
                    this.charts.taskStatus = null;
                }
                canvas.style.display = 'none';
                if (emptyState) emptyState.classList.remove('hidden');
                // 清空图例
                const legendContainer = document.getElementById('statusChartLegend');
                if (legendContainer) legendContainer.innerHTML = '';
            }

            this.hideChartLoading('status');
        } catch (error) {
            console.error('❌ 渲染任务结果状态趋势图失败', error);
            this.hideChartLoading('status');
            this.showError('渲染任务结果状态趋势图失败');
        }
    }

    /**
     * 获取图表配置选项
     * @param {string} title - 图表标题
     * @param {string} chartType - 图表类型 (station, customer, satellite, taskType, taskStatus)
     */
    getChartOptions(title, chartType) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    top: 30,      // 顶部留空间，防止数据标签被遮挡
                    right: 50,    // 右侧留较大空间，防止标签被遮挡
                    bottom: 10,   // 底部留空间
                    left: 20      // 左侧留空间
                }
            },
            interaction: {
                mode: 'index',  // 交互模式：显示同一索引位置的所有数据
                intersect: false // 不需要精确悬停在点上
            },
            elements: {
                line: {
                    spanGaps: false  // 确保不跳过0值或空值
                },
                point: {
                    radius: 3,       // 确保所有点都显示，包括0值
                    hoverRadius: 5
                }
            },
            plugins: {
                title: {
                    display: false
                },
                legend: {
                    display: false  // 禁用原生图例，使用自定义 HTML 图例
                },
                tooltip: {
                    enabled: false,  // 禁用默认tooltip
                    mode: 'index',
                    intersect: false,
                    external: this.createScrollableTooltip.bind(this)  // 使用自定义HTML tooltip
                },
                datalabels: {
                    display: this.showDataLabels[chartType] || false,
                    align: 'top',
                    anchor: 'end',
                    offset: 4,        // 标签距离数据点的偏移量
                    font: {
                        size: 10,
                        weight: 'bold'
                    },
                    formatter: (value) => {
                        // 显示所有值，包括0
                        return value !== null && value !== undefined ? value : '';
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: '周期'
                    }
                },
                y: {
                    display: true,
                    title: {
                        display: true,
                        text: '数量'
                    },
                    beginAtZero: true,
                    min: 0  // 明确设置最小值为0，确保0值点显示
                }
            }
        };
    }

    /**
     * 创建自定义 HTML 图例
     */
    createCustomLegend(chart, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // 清空现有内容
        container.innerHTML = '';

        // 生成图例项
        chart.data.datasets.forEach((dataset, index) => {
            const meta = chart.getDatasetMeta(index);
            const isHidden = meta.hidden;

            const item = document.createElement('div');
            item.className = `chart-legend-item ${isHidden ? 'hidden' : ''}`;
            item.title = dataset.label; // 悬停显示完整名称
            item.innerHTML = `
                <span class="chart-legend-color" style="background-color: ${dataset.borderColor}"></span>
                <span class="chart-legend-label">${dataset.label}</span>
            `;

            // 点击切换显示/隐藏
            item.addEventListener('click', () => {
                meta.hidden = !meta.hidden;
                item.classList.toggle('hidden');
                chart.update();
            });

            container.appendChild(item);
        });
    }

    /**
     * 创建可滚动的自定义 Tooltip
     */
    createScrollableTooltip(context) {
        // Tooltip 元素
        let tooltipEl = document.getElementById('chartjs-tooltip');

        // 创建元素（首次调用时）
        if (!tooltipEl) {
            tooltipEl = document.createElement('div');
            tooltipEl.id = 'chartjs-tooltip';
            tooltipEl.style.cssText = `
                position: absolute;
                background: rgba(0, 0, 0, 0.9);
                color: white;
                border-radius: 8px;
                pointer-events: auto;
                transition: all 0.1s ease;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                z-index: 9999;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            `;
            document.body.appendChild(tooltipEl);

            // 鼠标进入tooltip时保持显示
            tooltipEl.addEventListener('mouseenter', () => {
                tooltipEl._hovered = true;
            });

            // 鼠标离开tooltip时延迟隐藏
            tooltipEl.addEventListener('mouseleave', () => {
                tooltipEl._hovered = false;
                setTimeout(() => {
                    if (!tooltipEl._hovered) {
                        tooltipEl.style.opacity = '0';
                    }
                }, 300);
            });
        }

        // 隐藏 tooltip（但如果鼠标在tooltip上则保持显示）
        const tooltipModel = context.tooltip;
        if (tooltipModel.opacity === 0) {
            if (!tooltipEl._hovered) {
                tooltipEl.style.opacity = '0';
            }
            return;
        }

        // 设置内容
        if (tooltipModel.body) {
            const titleLines = tooltipModel.title || [];
            const bodyLines = tooltipModel.body.map(item => item.lines);

            // 计算总计和平均值
            let total = 0;
            let count = 0;
            const dataPoints = tooltipModel.dataPoints || [];

            // 按值排序
            const sortedPoints = [...dataPoints].sort((a, b) => b.parsed.y - a.parsed.y);

            sortedPoints.forEach(point => {
                if (point.parsed.y !== null && !isNaN(point.parsed.y)) {
                    total += point.parsed.y;
                    count++;
                }
            });

            const average = count > 0 ? (total / count).toFixed(1) : 0;

            // 构建 HTML
            let innerHtml = '<div style="padding: 12px;">';

            // 标题
            innerHtml += '<div style="font-weight: bold; font-size: 13px; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.2);">';
            innerHtml += `📅 ${titleLines[0]}`;
            innerHtml += '</div>';

            // 数据项列表（可滚动）
            innerHtml += `<div style="
                max-height: 300px;
                overflow-y: auto;
                margin-bottom: 10px;
                scrollbar-width: thin;
                scrollbar-color: rgba(74, 222, 128, 0.5) rgba(255, 255, 255, 0.1);
            " class="custom-scrollbar">`;

            sortedPoints.forEach((point, index) => {
                const dataset = context.chart.data.datasets[point.datasetIndex];
                const value = point.parsed.y;
                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                const color = dataset.borderColor;

                // 排名标识
                let rankEmoji = '';
                if (count > 3) {
                    if (index === 0) rankEmoji = '🥇 ';
                    else if (index === 1) rankEmoji = '🥈 ';
                    else if (index === 2) rankEmoji = '🥉 ';
                }

                innerHtml += '<div style="display: flex; align-items: center; margin: 6px 0; font-size: 12px;">';
                innerHtml += `<span style="display: inline-block; width: 10px; height: 10px; background: ${color}; margin-right: 8px; border-radius: 2px;"></span>`;
                innerHtml += `<span style="flex: 1;">${rankEmoji}${dataset.label}</span>`;
                innerHtml += `<span style="font-weight: bold; margin-left: 8px;">${value}</span>`;
                innerHtml += `<span style="color: #a0aec0; margin-left: 6px; font-size: 11px;">(${percentage}%)</span>`;
                innerHtml += '</div>';
            });

            innerHtml += '</div>';

            // 总计区域
            innerHtml += '<div style="border-top: 2px solid rgba(74, 222, 128, 0.3); padding-top: 10px; font-size: 13px;">';
            innerHtml += `<div style="display: flex; justify-content: space-between; margin: 4px 0; color: #4ade80; font-weight: bold;">`;
            innerHtml += `<span>📊 总计</span><span>${total}</span>`;
            innerHtml += '</div>';
            innerHtml += `<div style="display: flex; justify-content: space-between; margin: 4px 0; color: #60a5fa;">`;
            innerHtml += `<span>📈 平均</span><span>${average}</span>`;
            innerHtml += '</div>';
            innerHtml += `<div style="display: flex; justify-content: space-between; margin: 4px 0; color: #a0aec0;">`;
            innerHtml += `<span>📋 系列数</span><span>${count}</span>`;
            innerHtml += '</div>';
            innerHtml += '</div>';

            innerHtml += '</div>';

            tooltipEl.innerHTML = innerHtml;
        }

        // 定位 - 跟随光标Y坐标
        const position = context.chart.canvas.getBoundingClientRect();
        const tooltipHeight = tooltipEl.offsetHeight;
        const windowHeight = window.innerHeight;

        // X坐标：显示在光标右侧
        let left = position.left + window.pageXOffset + tooltipModel.caretX + 15;

        // Y坐标：跟随光标，但避免溢出屏幕
        let top = position.top + window.pageYOffset + tooltipModel.caretY;

        // 如果tooltip会超出屏幕底部，则向上调整
        if (top + tooltipHeight > window.pageYOffset + windowHeight) {
            top = window.pageYOffset + windowHeight - tooltipHeight - 10;
        }

        // 如果tooltip会超出屏幕顶部，则向下调整
        if (top < window.pageYOffset) {
            top = window.pageYOffset + 10;
        }

        tooltipEl.style.opacity = '1';
        tooltipEl.style.left = left + 'px';
        tooltipEl.style.top = top + 'px';
    }

    /**
     * 重置所有筛选器
     */
    resetAllFilters() {
        this.syncLock = true;

        // 重置所有筛选器
        Object.keys(this.topFilters).forEach(key => {
            if (this.topFilters[key]) {
                this.topFilters[key].setSelectedValues([]);
            }
        });

        Object.keys(this.chartFilters).forEach(key => {
            if (this.chartFilters[key]) {
                this.chartFilters[key].setSelectedValues([]);
            }
        });

        // 重置筛选条件
        this.currentFilters.stations = [];
        this.currentFilters.customers = [];
        this.currentFilters.satellites = [];
        this.currentFilters.taskTypes = [];
        this.currentFilters.taskStatuses = [];

        this.syncLock = false;

        // 重新加载选项并渲染
        this.loadFilterOptions().then(() => {
            this.triggerAutoApply();
        });
    }

    /**
     * 重置图表筛选器
     */
    resetChartFilter(chartType) {
        const filterMap = {
            'station': 'stations',
            'customer': 'customers',
            'satellite': 'satellites',
            'type': 'taskTypes',
            'status': 'taskStatuses'
        };

        const filterName = filterMap[chartType];
        if (!filterName) return;

        console.log(`🔄 重置图表筛选器: ${chartType}`);

        // 清空选中值
        this.syncLock = true;

        const filterKey = this.getFilterKey(filterName);
        if (this.chartFilters[filterKey]) {
            this.chartFilters[filterKey].setSelectedValues([]);
        }
        if (this.topFilters[filterKey]) {
            this.topFilters[filterKey].setSelectedValues([]);
        }

        this.currentFilters[filterName] = [];

        this.syncLock = false;

        // 重新加载筛选器选项
        this.loadFilterOptions().then(() => {
            this.triggerAutoApply();
        });
    }

    /**
     * 切换数据标签显示
     */
    toggleDataLabels(chartType, show) {
        console.log(`🏷️ 切换数据标签: ${chartType}, 显示: ${show}`);

        // 保存状态
        this.showDataLabels[chartType] = show;

        const chart = this.charts[chartType];
        if (chart) {
            chart.options.plugins.datalabels.display = show;
            chart.update();
        }
    }

    /**
     * 下载图表（PNG）
     */
    downloadChart(chartName) {
        const chartMap = {
            'stationChart': { chart: this.charts.station, name: '测站趋势' },
            'customerChart': { chart: this.charts.customer, name: '客户趋势' },
            'satelliteChart': { chart: this.charts.satellite, name: '卫星趋势' },
            'typeChart': { chart: this.charts.taskType, name: '任务类型趋势' },
            'statusChart': { chart: this.charts.taskStatus, name: '任务结果状态趋势' }
        };

        const chartInfo = chartMap[chartName];
        if (!chartInfo || !chartInfo.chart) {
            console.warn('图表不存在或未渲染');
            return;
        }

        const url = chartInfo.chart.toBase64Image();
        const link = document.createElement('a');
        link.download = `${chartInfo.name}_${this.currentFilters.startDate}_${this.currentFilters.endDate}.png`;
        link.href = url;
        link.click();

        console.log(`📥 下载图表: ${chartInfo.name}`);
    }

    /**
     * 下载数据（CSV）
     */
    downloadData(chartName) {
        const chartMap = {
            'stationChart': { chart: this.charts.station, name: '测站趋势' },
            'customerChart': { chart: this.charts.customer, name: '客户趋势' },
            'satelliteChart': { chart: this.charts.satellite, name: '卫星趋势' },
            'typeChart': { chart: this.charts.taskType, name: '任务类型趋势' },
            'statusChart': { chart: this.charts.taskStatus, name: '任务结果状态趋势' }
        };

        const chartInfo = chartMap[chartName];
        if (!chartInfo || !chartInfo.chart) {
            console.warn('图表不存在或未渲染');
            return;
        }

        const csv = chartToCSV(chartInfo.chart);
        const filename = `${chartInfo.name}_${this.currentFilters.startDate}_${this.currentFilters.endDate}.csv`;
        downloadFile(filename, csv, 'text/csv;charset=utf-8');

        console.log(`📥 下载数据: ${chartInfo.name}`);
    }

    /**
     * 显示加载中
     */
    showLoading(message = '加载中...') {
        const loadingEl = document.getElementById('loadingAlert');
        const messageEl = document.getElementById('loadingMessage');
        if (loadingEl && messageEl) {
            messageEl.textContent = message;
            loadingEl.classList.remove('hidden');
        }
    }

    /**
     * 隐藏加载中
     */
    hideLoading() {
        const loadingEl = document.getElementById('loadingAlert');
        if (loadingEl) {
            loadingEl.classList.add('hidden');
        }
    }

    /**
     * 显示图表加载中
     */
    showChartLoading(chartType) {
        const canvas = document.getElementById(`${chartType}Chart`);
        if (canvas) {
            canvas.style.opacity = '0.5';
        }
    }

    /**
     * 隐藏图表加载中
     */
    hideChartLoading(chartType) {
        const canvas = document.getElementById(`${chartType}Chart`);
        if (canvas) {
            canvas.style.opacity = '1';
        }
    }

    /**
     * 显示错误
     */
    showError(message) {
        const errorEl = document.getElementById('errorAlert');
        const messageEl = document.getElementById('errorMessage');
        if (errorEl && messageEl) {
            messageEl.textContent = message;
            errorEl.classList.remove('hidden');

            // 3秒后自动隐藏
            setTimeout(() => {
                errorEl.classList.add('hidden');
            }, 3000);
        }
    }
}

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', async () => {
    window.trendApp = new TrendAnalysisApp();
    await window.trendApp.init();
});
