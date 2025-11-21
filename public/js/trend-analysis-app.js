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

        // 数据标签显示状态
        this.showDataLabels = false;
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
        const startDateEl = document.getElementById('start-date');
        const endDateEl = document.getElementById('end-date');
        if (startDateEl) startDateEl.value = this.currentFilters.startDate;
        if (endDateEl) endDateEl.value = this.currentFilters.endDate;

        console.log(`📅 日期已初始化: ${this.currentFilters.startDate} ~ ${this.currentFilters.endDate}`);
    }

    /**
     * 初始化 WebSocket 连接
     */
    async initWebSocket() {
        if (window.wsManager) {
            this.wsManager = window.wsManager;
            console.log('✅ 使用已存在的 WebSocket 连接');
            return;
        }

        return new Promise((resolve, reject) => {
            const checkInterval = setInterval(() => {
                if (window.wsManager) {
                    this.wsManager = window.wsManager;
                    console.log('✅ WebSocket 连接已建立');
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);

            setTimeout(() => {
                clearInterval(checkInterval);
                if (!this.wsManager) {
                    console.error('❌ WebSocket 连接超时');
                    reject(new Error('WebSocket 连接超时'));
                }
            }, 5000);
        });
    }

    /**
     * 初始化顶部筛选器
     */
    initTopFilters() {
        this.topFilters.station = new MultiSelectDropdown(
            'station-dropdown',
            'station-options',
            'station-display',
            'station-value',
            'station-tags',
            'station-search',
            'station-select-all',
            (values) => this.onTopFilterChange('stations', values)
        );

        this.topFilters.customer = new MultiSelectDropdown(
            'customer-dropdown',
            'customer-options',
            'customer-display',
            'customer-value',
            'customer-tags',
            'customer-search',
            'customer-select-all',
            (values) => this.onTopFilterChange('customers', values)
        );

        this.topFilters.satellite = new MultiSelectDropdown(
            'satellite-dropdown',
            'satellite-options',
            'satellite-display',
            'satellite-value',
            'satellite-tags',
            'satellite-search',
            'satellite-select-all',
            (values) => this.onTopFilterChange('satellites', values)
        );

        this.topFilters.taskType = new MultiSelectDropdown(
            'task-type-dropdown',
            'task-type-options',
            'task-type-display',
            'task-type-value',
            'task-type-tags',
            'task-type-search',
            'task-type-select-all',
            (values) => this.onTopFilterChange('taskTypes', values)
        );

        this.topFilters.taskStatus = new MultiSelectDropdown(
            'task-status-dropdown',
            'task-status-options',
            'task-status-display',
            'task-status-value',
            'task-status-tags',
            'task-status-search',
            'task-status-select-all',
            (values) => this.onTopFilterChange('taskStatuses', values)
        );

        console.log('✅ 顶部筛选器初始化完成');
    }

    /**
     * 初始化图表筛选器
     */
    initChartFilters() {
        this.chartFilters.station = new MultiSelectDropdown(
            'station-chart-dropdown',
            'station-chart-options',
            'station-chart-display',
            'station-chart-value',
            'station-chart-tags',
            'station-chart-search',
            'station-chart-select-all',
            (values) => this.onChartFilterChange('stations', values)
        );

        this.chartFilters.customer = new MultiSelectDropdown(
            'customer-chart-dropdown',
            'customer-chart-options',
            'customer-chart-display',
            'customer-chart-value',
            'customer-chart-tags',
            'customer-chart-search',
            'customer-chart-select-all',
            (values) => this.onChartFilterChange('customers', values)
        );

        this.chartFilters.satellite = new MultiSelectDropdown(
            'satellite-chart-dropdown',
            'satellite-chart-options',
            'satellite-chart-display',
            'satellite-chart-value',
            'satellite-chart-tags',
            'satellite-chart-search',
            'satellite-chart-select-all',
            (values) => this.onChartFilterChange('satellites', values)
        );

        this.chartFilters.taskType = new MultiSelectDropdown(
            'task-type-chart-dropdown',
            'task-type-chart-options',
            'task-type-chart-display',
            'task-type-chart-value',
            'task-type-chart-tags',
            'task-type-chart-search',
            'task-type-chart-select-all',
            (values) => this.onChartFilterChange('taskTypes', values)
        );

        this.chartFilters.taskStatus = new MultiSelectDropdown(
            'task-status-chart-dropdown',
            'task-status-chart-options',
            'task-status-chart-display',
            'task-status-chart-value',
            'task-status-chart-tags',
            'task-status-chart-search',
            'task-status-chart-select-all',
            (values) => this.onChartFilterChange('taskStatuses', values)
        );

        console.log('✅ 图表筛选器初始化完成');
    }

    /**
     * 初始化事件监听
     */
    initEventListeners() {
        // 日期和周期变化
        const startDateEl = document.getElementById('start-date');
        const endDateEl = document.getElementById('end-date');
        const groupByEl = document.getElementById('group-by');

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

        // 重置按钮
        const resetBtns = document.querySelectorAll('[id$="-reset"]');
        resetBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const chartType = btn.id.replace('-reset', '');
                this.resetChartFilter(chartType);
            });
        });

        // 数据标签复选框
        const dataLabelCheckboxes = document.querySelectorAll('[id$="-data-labels"]');
        dataLabelCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const chartType = checkbox.id.replace('-data-labels', '');
                this.toggleDataLabels(chartType, checkbox.checked);
            });
        });

        // 下载图表按钮
        const downloadChartBtns = document.querySelectorAll('[id$="-download-chart"]');
        downloadChartBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const chartType = btn.id.replace('-download-chart', '');
                this.downloadChart(chartType);
            });
        });

        // 下载数据按钮
        const downloadDataBtns = document.querySelectorAll('[id$="-download-data"]');
        downloadDataBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const chartType = btn.id.replace('-download-data', '');
                this.downloadData(chartType);
            });
        });

        console.log('✅ 事件监听初始化完成');
    }

    /**
     * 初始化周期规则模态框
     */
    initCycleRulesModal() {
        const settingsBtn = document.getElementById('cycle-settings-btn');
        const modal = document.getElementById('cycle-modal');
        const closeBtn = document.getElementById('cycle-modal-close');
        const saveBtn = document.getElementById('cycle-modal-save');

        if (settingsBtn && modal) {
            settingsBtn.addEventListener('click', () => {
                this.showCycleRulesModal();
            });
        }

        if (closeBtn && modal) {
            closeBtn.addEventListener('click', () => {
                modal.classList.add('hidden');
            });
        }

        if (saveBtn && modal) {
            saveBtn.addEventListener('click', () => {
                this.saveCycleRules();
                modal.classList.add('hidden');
                this.triggerAutoApply();
            });
        }

        console.log('✅ 周期规则模态框初始化完成');
    }

    /**
     * 显示周期规则模态框
     */
    showCycleRulesModal() {
        // 填充当前规则
        const dayStartEl = document.getElementById('day-start');
        const dayEndEl = document.getElementById('day-end');
        const weekStartEl = document.getElementById('week-start');
        const weekEndEl = document.getElementById('week-end');
        const monthStartEl = document.getElementById('month-start');
        const monthEndEl = document.getElementById('month-end');
        const quarterStartEl = document.getElementById('quarter-start');
        const quarterEndEl = document.getElementById('quarter-end');

        if (dayStartEl) dayStartEl.value = this.cycleRules.day.start || '';
        if (dayEndEl) dayEndEl.value = this.cycleRules.day.end || '';
        if (weekStartEl) weekStartEl.value = this.cycleRules.week.start || '';
        if (weekEndEl) weekEndEl.value = this.cycleRules.week.end || '';
        if (monthStartEl) monthStartEl.value = this.cycleRules.month.start || '';
        if (monthEndEl) monthEndEl.value = this.cycleRules.month.end || '';
        if (quarterStartEl) quarterStartEl.value = this.cycleRules.quarter.start || '';
        if (quarterEndEl) quarterEndEl.value = this.cycleRules.quarter.end || '';

        const modal = document.getElementById('cycle-modal');
        if (modal) modal.classList.remove('hidden');
    }

    /**
     * 保存周期规则
     */
    saveCycleRules() {
        const dayStartEl = document.getElementById('day-start');
        const dayEndEl = document.getElementById('day-end');
        const weekStartEl = document.getElementById('week-start');
        const weekEndEl = document.getElementById('week-end');
        const monthStartEl = document.getElementById('month-start');
        const monthEndEl = document.getElementById('month-end');
        const quarterStartEl = document.getElementById('quarter-start');
        const quarterEndEl = document.getElementById('quarter-end');

        this.cycleRules = {
            day: {
                start: dayStartEl?.value || '',
                end: dayEndEl?.value || ''
            },
            week: {
                start: weekStartEl?.value || '',
                end: weekEndEl?.value || ''
            },
            month: {
                start: monthStartEl?.value || '',
                end: monthEndEl?.value || ''
            },
            quarter: {
                start: quarterStartEl?.value || '',
                end: quarterEndEl?.value || ''
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
                return JSON.parse(saved);
            } catch (e) {
                console.error('加载周期规则失败', e);
            }
        }

        // 默认规则
        return {
            day: { start: '', end: '' },
            week: { start: '', end: '' },
            month: { start: '', end: '' },
            quarter: { start: '', end: '' }
        };
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
            // 查询级联后的选项
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
            const canvas = document.getElementById('station-chart');
            const emptyState = document.getElementById('station-empty');
            if (!canvas) return;

            this.showChartLoading('station');

            const result = await this.wsManager.queryStats('station_trend', {
                ...this.currentFilters,
                cycleRules: this.cycleRules
            });

            if (result && result.records && result.records.length > 0) {
                const chartData = convertToChartData(result.records, 'station_name', 'record_count');

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
                    options: this.getChartOptions('测站趋势')
                });

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
            const canvas = document.getElementById('customer-chart');
            const emptyState = document.getElementById('customer-empty');
            if (!canvas) return;

            this.showChartLoading('customer');

            const result = await this.wsManager.queryStats('customer_trend', {
                ...this.currentFilters,
                cycleRules: this.cycleRules
            });

            if (result && result.records && result.records.length > 0) {
                const chartData = convertToChartData(result.records, 'customer_name', 'record_count');

                chartData.labels = chartData.labels.map(label =>
                    formatPeriodLabel(label, this.currentFilters.groupBy)
                );

                if (this.charts.customer) {
                    this.charts.customer.destroy();
                }

                this.charts.customer = new Chart(canvas, {
                    type: 'line',
                    data: chartData,
                    options: this.getChartOptions('客户趋势')
                });

                canvas.style.display = 'block';
                if (emptyState) emptyState.classList.add('hidden');
            } else {
                if (this.charts.customer) {
                    this.charts.customer.destroy();
                    this.charts.customer = null;
                }
                canvas.style.display = 'none';
                if (emptyState) emptyState.classList.remove('hidden');
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
            const canvas = document.getElementById('satellite-chart');
            const emptyState = document.getElementById('satellite-empty');
            if (!canvas) return;

            this.showChartLoading('satellite');

            const result = await this.wsManager.queryStats('satellite_trend', {
                ...this.currentFilters,
                cycleRules: this.cycleRules
            });

            if (result && result.records && result.records.length > 0) {
                const chartData = convertToChartData(result.records, 'satellite_name', 'record_count');

                chartData.labels = chartData.labels.map(label =>
                    formatPeriodLabel(label, this.currentFilters.groupBy)
                );

                if (this.charts.satellite) {
                    this.charts.satellite.destroy();
                }

                this.charts.satellite = new Chart(canvas, {
                    type: 'line',
                    data: chartData,
                    options: this.getChartOptions('卫星趋势')
                });

                canvas.style.display = 'block';
                if (emptyState) emptyState.classList.add('hidden');
            } else {
                if (this.charts.satellite) {
                    this.charts.satellite.destroy();
                    this.charts.satellite = null;
                }
                canvas.style.display = 'none';
                if (emptyState) emptyState.classList.remove('hidden');
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
            const canvas = document.getElementById('task-type-chart');
            const emptyState = document.getElementById('task-type-empty');
            if (!canvas) return;

            this.showChartLoading('task-type');

            const result = await this.wsManager.queryStats('task_type_trend', {
                ...this.currentFilters,
                cycleRules: this.cycleRules
            });

            if (result && result.records && result.records.length > 0) {
                const chartData = convertToChartData(result.records, 'task_type', 'record_count');

                chartData.labels = chartData.labels.map(label =>
                    formatPeriodLabel(label, this.currentFilters.groupBy)
                );

                if (this.charts.taskType) {
                    this.charts.taskType.destroy();
                }

                this.charts.taskType = new Chart(canvas, {
                    type: 'line',
                    data: chartData,
                    options: this.getChartOptions('任务类型趋势')
                });

                canvas.style.display = 'block';
                if (emptyState) emptyState.classList.add('hidden');
            } else {
                if (this.charts.taskType) {
                    this.charts.taskType.destroy();
                    this.charts.taskType = null;
                }
                canvas.style.display = 'none';
                if (emptyState) emptyState.classList.remove('hidden');
            }

            this.hideChartLoading('task-type');
        } catch (error) {
            console.error('❌ 渲染任务类型趋势图失败', error);
            this.hideChartLoading('task-type');
            this.showError('渲染任务类型趋势图失败');
        }
    }

    /**
     * 渲染任务结果状态趋势图
     */
    async renderTaskStatusChart() {
        try {
            const canvas = document.getElementById('task-status-chart');
            const emptyState = document.getElementById('task-status-empty');
            if (!canvas) return;

            this.showChartLoading('task-status');

            const result = await this.wsManager.queryStats('task_status_trend', {
                ...this.currentFilters,
                cycleRules: this.cycleRules
            });

            if (result && result.records && result.records.length > 0) {
                const chartData = convertToChartData(result.records, 'task_status', 'record_count');

                chartData.labels = chartData.labels.map(label =>
                    formatPeriodLabel(label, this.currentFilters.groupBy)
                );

                if (this.charts.taskStatus) {
                    this.charts.taskStatus.destroy();
                }

                this.charts.taskStatus = new Chart(canvas, {
                    type: 'line',
                    data: chartData,
                    options: this.getChartOptions('任务结果状态趋势')
                });

                canvas.style.display = 'block';
                if (emptyState) emptyState.classList.add('hidden');
            } else {
                if (this.charts.taskStatus) {
                    this.charts.taskStatus.destroy();
                    this.charts.taskStatus = null;
                }
                canvas.style.display = 'none';
                if (emptyState) emptyState.classList.remove('hidden');
            }

            this.hideChartLoading('task-status');
        } catch (error) {
            console.error('❌ 渲染任务结果状态趋势图失败', error);
            this.hideChartLoading('task-status');
            this.showError('渲染任务结果状态趋势图失败');
        }
    }

    /**
     * 获取图表配置选项
     */
    getChartOptions(title) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: false
                },
                legend: {
                    display: true,
                    position: 'top'
                },
                datalabels: {
                    display: this.showDataLabels,
                    align: 'top',
                    anchor: 'end',
                    font: {
                        size: 10
                    },
                    formatter: (value) => {
                        return value > 0 ? value : '';
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
                    beginAtZero: true
                }
            }
        };
    }

    /**
     * 重置图表筛选器
     */
    resetChartFilter(chartType) {
        const filterMap = {
            'station': 'stations',
            'customer': 'customers',
            'satellite': 'satellites',
            'task-type': 'taskTypes',
            'task-status': 'taskStatuses'
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

        // 如果是全局切换（不指定图表类型）
        if (!chartType) {
            this.showDataLabels = show;

            // 更新所有图表
            Object.keys(this.charts).forEach(key => {
                if (this.charts[key]) {
                    this.charts[key].options.plugins.datalabels.display = show;
                    this.charts[key].update();
                }
            });

            return;
        }

        // 单个图表切换
        const chartMap = {
            'station': 'station',
            'customer': 'customer',
            'satellite': 'satellite',
            'task-type': 'taskType',
            'task-status': 'taskStatus'
        };

        const chartKey = chartMap[chartType];
        if (chartKey && this.charts[chartKey]) {
            this.charts[chartKey].options.plugins.datalabels.display = show;
            this.charts[chartKey].update();
        }
    }

    /**
     * 下载图表（PNG）
     */
    downloadChart(chartType) {
        const chartMap = {
            'station': { chart: this.charts.station, name: '测站趋势' },
            'customer': { chart: this.charts.customer, name: '客户趋势' },
            'satellite': { chart: this.charts.satellite, name: '卫星趋势' },
            'task-type': { chart: this.charts.taskType, name: '任务类型趋势' },
            'task-status': { chart: this.charts.taskStatus, name: '任务结果状态趋势' }
        };

        const chartInfo = chartMap[chartType];
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
    downloadData(chartType) {
        const chartMap = {
            'station': { chart: this.charts.station, name: '测站趋势' },
            'customer': { chart: this.charts.customer, name: '客户趋势' },
            'satellite': { chart: this.charts.satellite, name: '卫星趋势' },
            'task-type': { chart: this.charts.taskType, name: '任务类型趋势' },
            'task-status': { chart: this.charts.taskStatus, name: '任务结果状态趋势' }
        };

        const chartInfo = chartMap[chartType];
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
        const loadingEl = document.getElementById('loading-alert');
        const messageEl = document.getElementById('loading-message');
        if (loadingEl && messageEl) {
            messageEl.textContent = message;
            loadingEl.classList.remove('hidden');
        }
    }

    /**
     * 隐藏加载中
     */
    hideLoading() {
        const loadingEl = document.getElementById('loading-alert');
        if (loadingEl) {
            loadingEl.classList.add('hidden');
        }
    }

    /**
     * 显示图表加载中
     */
    showChartLoading(chartType) {
        const canvas = document.getElementById(`${chartType}-chart`);
        if (canvas) {
            canvas.style.opacity = '0.5';
        }
    }

    /**
     * 隐藏图表加载中
     */
    hideChartLoading(chartType) {
        const canvas = document.getElementById(`${chartType}-chart`);
        if (canvas) {
            canvas.style.opacity = '1';
        }
    }

    /**
     * 显示错误
     */
    showError(message) {
        const errorEl = document.getElementById('error-alert');
        const messageEl = document.getElementById('error-message');
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
