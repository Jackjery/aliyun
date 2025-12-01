/**
 * Deep Analysis Application
 * 深度分析页面主应用逻辑
 * 使用移动平均算法识别导致总计划ID数下滑的客户
 */

class DeepAnalysisApp {
    constructor() {
        // WebSocket 管理器
        this.wsManager = null;

        // 多选下拉框实例
        this.filters = {
            customer: null,
            customerChart: null
        };

        // 图表实例
        this.charts = {
            totalTrend: null,
            customerStack: null
        };

        // 当前筛选条件
        this.currentFilters = {
            startDate: '',
            endDate: '',
            groupBy: 'day',
            movingAvgWindow: 5,
            customers: []
        };

        // 分析结果数据
        this.analysisData = {
            rawData: [],
            periods: [],
            totalTrend: [],
            movingAverage: [],
            customerData: {},
            contributionAnalysis: [],
            declineAnalysis: null
        };

        // 数据标签显示状态
        this.showDataLabels = {
            total: false,
            customer: false
        };
    }

    /**
     * 初始化应用
     */
    async init() {
        console.log('🚀 DeepAnalysisApp 初始化开始');

        // 初始化日期
        this.initializeDates();

        // 初始化 WebSocket
        await this.initWebSocket();

        // 更新连接状态显示
        this.updateConnectionStatus();

        // 初始化筛选器
        this.initFilters();

        // 初始化事件监听
        this.initEventListeners();

        // 加载客户选项（如果已连接）
        if (this.wsManager && this.wsManager.isConnected) {
            await this.loadCustomerOptions();
        } else {
            console.warn('⚠️ WebSocket 未连接，跳过加载客户选项');
        }

        console.log('✅ DeepAnalysisApp 初始化完成');
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
        document.getElementById('startDate').value = this.currentFilters.startDate;
        document.getElementById('endDate').value = this.currentFilters.endDate;

        console.log(`📅 日期已初始化: ${this.currentFilters.startDate} ~ ${this.currentFilters.endDate}`);
    }

    /**
     * 初始化 WebSocket 连接
     */
    async initWebSocket() {
        try {
            // 等待 WebSocketManager 初始化
            await this.waitForWebSocketManager();

            if (window.wsManager) {
                this.wsManager = window.wsManager;

                // 如果未连接，尝试连接
                if (!this.wsManager.isConnected) {
                    console.log('🔄 WebSocket 未连接，尝试建立连接...');
                    await this.ensureConnection();
                }

                console.log('✅ WebSocket 已就绪');
            } else {
                console.error('❌ WebSocketManager 未找到');
                throw new Error('WebSocket连接失败');
            }
        } catch (error) {
            console.error('❌ WebSocket 初始化失败:', error);
            // 不抛出错误，让页面继续加载，但禁用需要连接的功能
            this.wsManager = null;
        }
    }

    /**
     * 等待 WebSocketManager 初始化
     */
    async waitForWebSocketManager(maxWait = 3000) {
        const startTime = Date.now();
        while (!window.wsManager && (Date.now() - startTime < maxWait)) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (!window.wsManager) {
            throw new Error('WebSocket管理器初始化超时');
        }
    }

    /**
     * 确保 WebSocket 连接
     */
    async ensureConnection(maxAttempts = 3) {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                console.log(`🔄 连接尝试 ${attempt}/${maxAttempts}...`);

                // 尝试连接
                if (!this.wsManager.ws || this.wsManager.ws.readyState === WebSocket.CLOSED) {
                    this.wsManager.connect();
                }

                // 等待连接建立（最多10秒）
                const connected = await this.waitForConnection(10000);

                if (connected) {
                    console.log('✅ WebSocket 连接成功');
                    return true;
                }

                console.warn(`⚠️ 第 ${attempt} 次连接尝试失败`);

                if (attempt < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒后重试
                }
            } catch (error) {
                console.error(`❌ 连接尝试 ${attempt} 失败:`, error);
            }
        }

        throw new Error('WebSocket连接失败，请检查后端服务');
    }

    /**
     * 等待连接建立
     */
    async waitForConnection(timeout = 10000) {
        return new Promise((resolve) => {
            const startTime = Date.now();

            const checkConnection = setInterval(() => {
                if (this.wsManager.isConnected) {
                    clearInterval(checkConnection);
                    resolve(true);
                } else if (Date.now() - startTime > timeout) {
                    clearInterval(checkConnection);
                    resolve(false);
                }
            }, 100);
        });
    }

    /**
     * 初始化筛选器
     */
    initFilters() {
        // 初始化客户多选下拉框
        if (typeof MultiSelectDropdown !== 'undefined') {
            this.filters.customer = new MultiSelectDropdown(
                'customerDropdown',      // 下拉框容器
                'customerOptions',       // 选项容器
                null,                    // 显示区域（使用内联标签）
                'customerValue',         // 隐藏值字段
                'customerTags',          // 标签容器
                'customerSearch',        // 搜索框
                'selectAllCustomers',    // 全选按钮
                null                     // onChange 回调
            );

            this.filters.customerChart = new MultiSelectDropdown(
                'customerChartDropdown',
                'customerChartOptions',
                null,
                'customerChartValue',
                'customerChartTags',
                'customerChartSearch',
                'selectAllCustomerChart',
                null
            );

            console.log('✅ 筛选器已初始化');
        }
    }

    /**
     * 初始化事件监听
     */
    initEventListeners() {
        // 应用筛选按钮
        document.getElementById('applyFilters')?.addEventListener('click', () => {
            this.applyFilters();
        });

        // 移动平均窗口变化
        document.getElementById('movingAvgWindow')?.addEventListener('change', (e) => {
            this.currentFilters.movingAvgWindow = parseInt(e.target.value);
        });

        // 统计周期变化
        document.getElementById('groupBy')?.addEventListener('change', (e) => {
            this.currentFilters.groupBy = e.target.value;
        });

        // 数据标签切换
        document.getElementById('showTotalLabels')?.addEventListener('change', (e) => {
            this.showDataLabels.total = e.target.checked;
            this.updateChartDataLabels('totalTrend');
        });

        document.getElementById('showCustomerLabels')?.addEventListener('change', (e) => {
            this.showDataLabels.customer = e.target.checked;
            this.updateChartDataLabels('customerStack');
        });

        // 重置客户图表筛选
        document.getElementById('resetCustomerChart')?.addEventListener('click', () => {
            this.resetCustomerChartFilter();
        });

        // 图表下载按钮
        document.querySelectorAll('.chart-download-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const chartId = e.currentTarget.dataset.chart;
                const type = e.currentTarget.dataset.type;
                this.downloadChart(chartId, type);
            });
        });

        // 导出表格
        document.getElementById('exportTableBtn')?.addEventListener('click', () => {
            this.exportContributionTable();
        });
    }

    /**
     * 加载客户选项
     */
    async loadCustomerOptions() {
        try {
            // 检查 WebSocket 是否可用
            if (!this.wsManager || !this.wsManager.isConnected) {
                console.warn('⚠️ WebSocket 未连接，无法加载客户列表');
                this.showError('WebSocket 未连接，请刷新页面重试');
                return;
            }

            this.showLoading('正在加载客户列表...');

            // 通过 WebSocket 获取筛选选项
            const result = await this.wsManager.queryStats('filter_options', {
                dimension: 'customer'
            });

            console.log('📦 filter_options 返回数据:', result);

            // 检查不同的返回格式
            let customerOptions = [];

            if (result && result.options) {
                // 格式1: { options: [...] }
                customerOptions = result.options;
            } else if (Array.isArray(result)) {
                // 格式2: [...]
                customerOptions = result;
            } else if (result && result.customers) {
                // 格式3: { customers: [...] }
                customerOptions = result.customers;
            } else {
                console.error('❌ 未知的返回格式:', result);
                throw new Error('获取客户列表失败：数据格式不正确');
            }

            const formattedOptions = customerOptions.map(c => ({
                value: c,
                label: c
            }));

            // 更新下拉框选项
            if (this.filters.customer) {
                this.filters.customer.setOptions(formattedOptions);
            }

            this.hideLoading();
            console.log(`✅ 已加载 ${formattedOptions.length} 个客户`);
        } catch (error) {
            console.error('❌ 加载客户选项失败:', error);
            this.showError('加载客户列表失败: ' + error.message);
            this.hideLoading();
        }
    }

    /**
     * 应用筛选并执行分析
     */
    async applyFilters() {
        try {
            // 检查 WebSocket 是否可用
            if (!this.wsManager || !this.wsManager.isConnected) {
                this.showError('WebSocket 未连接！请检查后端服务是否运行，或刷新页面重试。');
                console.error('❌ WebSocket 未连接，无法执行分析');
                return;
            }

            // 获取筛选条件
            this.currentFilters.startDate = document.getElementById('startDate').value;
            this.currentFilters.endDate = document.getElementById('endDate').value;
            this.currentFilters.groupBy = document.getElementById('groupBy').value;
            this.currentFilters.movingAvgWindow = parseInt(document.getElementById('movingAvgWindow').value);
            this.currentFilters.customers = this.filters.customer ? this.filters.customer.getSelectedValues() : [];

            // 验证日期
            if (!this.currentFilters.startDate || !this.currentFilters.endDate) {
                this.showError('请选择开始和结束日期');
                return;
            }

            if (new Date(this.currentFilters.startDate) > new Date(this.currentFilters.endDate)) {
                this.showError('开始日期不能晚于结束日期');
                return;
            }

            console.log('📊 开始分析，筛选条件:', this.currentFilters);

            this.showLoading('正在获取数据并进行分析...');

            // 获取原始数据
            await this.fetchData();

            // 处理和分析数据
            this.processData();

            // 渲染结果
            this.renderResults();

            this.hideLoading();

            // 显示结果区域
            document.getElementById('resultsSection').classList.remove('hidden');

            console.log('✅ 分析完成');
        } catch (error) {
            console.error('❌ 分析失败:', error);
            this.showError('分析失败: ' + error.message);
            this.hideLoading();
        }
    }

    /**
     * 获取数据
     */
    async fetchData() {
        // 使用 WebSocket 查询客户维度趋势数据
        const result = await this.wsManager.queryStats('customer_dimension_trend', {
            startDate: this.currentFilters.startDate,
            endDate: this.currentFilters.endDate,
            groupBy: this.currentFilters.groupBy,
            customers: this.currentFilters.customers.length > 0 ? this.currentFilters.customers : undefined
        });

        console.log('📦 customer_dimension_trend 返回数据:', result);

        // 检查数据格式
        let periods, customerData;

        if (result && result.periods && result.customerData) {
            // 格式1: 已处理的趋势数据 { periods: [...], customerData: {...} }
            periods = result.periods;
            customerData = result.customerData;
        } else if (result && result.labels && result.datasets) {
            // 格式2: Chart.js 格式 { labels: [...], datasets: [...] }
            periods = result.labels;
            customerData = {};
            result.datasets.forEach(dataset => {
                customerData[dataset.label] = dataset.data;
            });
        } else if (result && result.records && Array.isArray(result.records)) {
            // 格式3: 原始数据记录 { records: [...], meta: {...} }
            console.log('📊 处理原始数据记录...');
            const processed = this.processRawRecords(result.records);
            periods = processed.periods;
            customerData = processed.customerData;
        } else {
            console.error('❌ 未知的返回格式:', result);
            throw new Error('获取数据失败：数据格式不正确');
        }

        // 转换数据格式
        this.analysisData.periods = periods;
        this.analysisData.customerData = customerData;

        // 计算总趋势（所有客户的计划ID数总和）
        this.analysisData.totalTrend = periods.map((_, index) => {
            return Object.values(customerData).reduce((sum, values) => {
                return sum + (values[index] || 0);
            }, 0);
        });

        console.log(`✅ 获取到 ${periods.length} 个周期的数据`);
        console.log(`✅ 包含 ${Object.keys(customerData).length} 个客户`);
    }

    /**
     * 处理后端返回的聚合数据
     * 后端返回格式：[{period: "2025-11-01", customer_name: "客户A", record_count: 10}, ...]
     */
    processRawRecords(records) {
        console.log(`📊 处理 ${records.length} 条聚合记录...`);

        // 提取所有周期和客户
        const periodsSet = new Set();
        const customersSet = new Set();

        records.forEach(record => {
            periodsSet.add(record.period);
            customersSet.add(record.customer_name);
        });

        const periods = Array.from(periodsSet).sort();
        const customers = Array.from(customersSet).sort();

        console.log(`📊 找到 ${periods.length} 个周期, ${customers.length} 个客户`);

        // 构建数据映射 key: "period|customer" -> record_count
        const dataMap = {};
        records.forEach(record => {
            const key = `${record.period}|${record.customer_name}`;
            dataMap[key] = record.record_count || 0;
        });

        // 构建 customerData（确保每个客户在每个周期都有值，缺失的填0）
        const customerData = {};
        customers.forEach(customer => {
            customerData[customer] = periods.map(period => {
                const key = `${period}|${customer}`;
                return dataMap[key] || 0;
            });
        });

        console.log(`✅ 处理完成: ${periods.length} 个周期, ${customers.length} 个客户`);

        return { periods, customerData };
    }

    /**
     * 处理和分析数据
     */
    processData() {
        // 数据已在fetchData中获取并处理，这里只需要计算移动平均和分析

        // 计算移动平均
        this.analysisData.movingAverage = calculateMovingAverage(
            this.analysisData.totalTrend,
            this.currentFilters.movingAvgWindow
        );

        // 检测趋势下滑
        this.analysisData.declineAnalysis = detectTrendDecline(this.analysisData.movingAverage);

        // 分析客户贡献度
        this.analysisData.contributionAnalysis = analyzeCustomerContribution(
            this.analysisData.customerData,
            this.analysisData.periods
        );

        console.log('✅ 数据处理完成:', this.analysisData);
    }

    /**
     * 渲染分析结果
     */
    renderResults() {
        // 渲染总趋势图
        this.renderTotalTrendChart();

        // 渲染下滑分析结果
        this.renderDeclineAnalysis();

        // 渲染客户堆叠图
        this.renderCustomerStackChart();

        // 渲染贡献度表格
        this.renderContributionTable();
    }

    /**
     * 渲染总趋势图
     */
    renderTotalTrendChart() {
        const canvas = document.getElementById('totalTrendChart');
        const ctx = canvas.getContext('2d');

        // 销毁旧图表
        if (this.charts.totalTrend) {
            this.charts.totalTrend.destroy();
        }

        const data = {
            labels: this.analysisData.periods,
            datasets: [
                {
                    label: '实际计划ID数',
                    data: this.analysisData.totalTrend,
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointHoverRadius: 5
                },
                {
                    label: `移动平均线(${this.currentFilters.movingAvgWindow}期)`,
                    data: this.analysisData.movingAverage,
                    borderColor: 'rgb(239, 68, 68)',
                    backgroundColor: 'rgba(239, 68, 68, 0)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.4,
                    pointRadius: 0
                }
            ]
        };

        this.charts.totalTrend = new Chart(ctx, {
            type: 'line',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    datalabels: {
                        display: this.showDataLabels.total,
                        color: '#666',
                        font: { size: 10 },
                        formatter: (val) => val
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: '计划ID数'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: '时间周期'
                        }
                    }
                }
            }
        });
    }

    /**
     * 渲染下滑分析结果
     */
    renderDeclineAnalysis() {
        const container = document.getElementById('declineAnalysisResult');
        const analysis = this.analysisData.declineAnalysis;

        if (!analysis) {
            container.innerHTML = '<p class="text-gray-500">无法进行趋势分析</p>';
            return;
        }

        // 识别下滑客户
        const decliningCustomers = identifyDecliningCustomers(this.analysisData.contributionAnalysis, 5);

        let html = `
            <div class="decline-analysis-card">
                <div class="decline-analysis-header">
                    <span class="decline-status ${analysis.status}">
                        ${analysis.status === 'declining' ? '📉 趋势下滑' :
                          analysis.status === 'growing' ? '📈 趋势增长' : '➡️ 趋势平稳'}
                    </span>
                    <span class="decline-info">${analysis.message}</span>
                </div>

                <div class="grid grid-cols-4 gap-4 mb-4">
                    <div class="text-center">
                        <div class="text-xs text-gray-500">前半期平均</div>
                        <div class="text-lg font-bold text-primary">${formatNumber(analysis.firstHalfAvg, 0)}</div>
                    </div>
                    <div class="text-center">
                        <div class="text-xs text-gray-500">后半期平均</div>
                        <div class="text-lg font-bold text-primary">${formatNumber(analysis.secondHalfAvg, 0)}</div>
                    </div>
                    <div class="text-center">
                        <div class="text-xs text-gray-500">峰值</div>
                        <div class="text-lg font-bold text-success">${formatNumber(analysis.peak, 0)}</div>
                    </div>
                    <div class="text-center">
                        <div class="text-xs text-gray-500">谷值</div>
                        <div class="text-lg font-bold text-danger">${formatNumber(analysis.valley, 0)}</div>
                    </div>
                </div>`;

        if (decliningCustomers.length > 0) {
            html += `
                <div class="mt-4">
                    <h4 class="font-semibold mb-3 text-sm">主要下滑客户 (按影响力排序)</h4>
                    <div class="contributor-list">`;

            decliningCustomers.forEach((customer, index) => {
                html += `
                    <div class="contributor-item">
                        <span class="contributor-rank">#${index + 1}</span>
                        <span class="contributor-name">${customer.customer}</span>
                        <span class="contributor-trend trend-negative">
                            <span class="trend-icon">↓</span>
                            <span class="contributor-change">${formatNumber(Math.abs(customer.trendChange), 1)}%</span>
                        </span>
                        <span class="text-xs text-gray-500">平均: ${formatNumber(customer.avg, 1)}</span>
                    </div>`;
            });

            html += `
                    </div>
                </div>`;
        } else {
            html += `
                <div class="mt-4 text-center text-gray-500 text-sm">
                    <p>未发现显著下滑的客户</p>
                </div>`;
        }

        html += `</div>`;

        container.innerHTML = html;
    }

    /**
     * 渲染客户堆叠图
     */
    renderCustomerStackChart() {
        const canvas = document.getElementById('customerStackChart');
        const ctx = canvas.getContext('2d');

        // 销毁旧图表
        if (this.charts.customerStack) {
            this.charts.customerStack.destroy();
        }

        // 准备数据集
        const customerData = this.analysisData.customerData;
        const customers = Object.keys(customerData);

        // 更新图表筛选器选项
        if (this.filters.customerChart) {
            const options = customers.map(c => ({ value: c, label: c }));
            this.filters.customerChart.setOptions(options);
        }

        const datasets = customers.map((customer, index) => {
            const color = generateChartColor(index, customers.length);
            return {
                label: customer,
                data: customerData[customer],
                backgroundColor: `rgba(${color}, 0.7)`,
                borderColor: `rgb(${color})`,
                borderWidth: 1
            };
        });

        this.charts.customerStack = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: this.analysisData.periods,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false // 使用自定义图例
                    },
                    datalabels: {
                        display: false // 堆叠图不显示标签
                    }
                },
                scales: {
                    x: {
                        stacked: true,
                        title: {
                            display: true,
                            text: '时间周期'
                        }
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: '计划ID数'
                        }
                    }
                }
            }
        });

        // 渲染自定义图例
        this.renderCustomLegend('customerStackChartLegend', this.charts.customerStack);
    }

    /**
     * 渲染自定义图例
     */
    renderCustomLegend(containerId, chart) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';

        chart.data.datasets.forEach((dataset, index) => {
            const item = document.createElement('div');
            item.className = 'chart-legend-item';
            item.innerHTML = `
                <div class="chart-legend-color" style="background-color: ${dataset.backgroundColor}"></div>
                <div class="chart-legend-label" title="${dataset.label}">${dataset.label}</div>
            `;

            item.addEventListener('click', () => {
                const meta = chart.getDatasetMeta(index);
                meta.hidden = !meta.hidden;
                item.classList.toggle('hidden');
                chart.update();
            });

            container.appendChild(item);
        });
    }

    /**
     * 渲染贡献度表格
     */
    renderContributionTable() {
        const tbody = document.getElementById('contributionTableBody');
        if (!tbody) return;

        tbody.innerHTML = '';

        this.analysisData.contributionAnalysis.forEach(customer => {
            const row = document.createElement('tr');

            const trendBadge = customer.trendDirection === 'up' ?
                `<span class="trend-badge up">↑ ${formatNumber(customer.trendChange, 1)}%</span>` :
                customer.trendDirection === 'down' ?
                `<span class="trend-badge down">↓ ${formatNumber(Math.abs(customer.trendChange), 1)}%</span>` :
                `<span class="trend-badge flat">→ ${formatNumber(customer.trendChange, 1)}%</span>`;

            row.innerHTML = `
                <td>${customer.customer}</td>
                <td class="text-right">${formatNumber(customer.avg, 1)}</td>
                <td class="text-right">${trendBadge}</td>
                <td class="text-right">${formatNumber(customer.max, 0)}</td>
                <td class="text-right">${formatNumber(customer.min, 0)}</td>
                <td class="text-right">${formatNumber(customer.coefficientOfVariation, 1)}%</td>
            `;

            tbody.appendChild(row);
        });
    }

    /**
     * 重置客户图表筛选
     */
    resetCustomerChartFilter() {
        if (this.filters.customerChart) {
            this.filters.customerChart.clearSelection();
        }
        this.renderCustomerStackChart();
    }

    /**
     * 更新图表数据标签
     */
    updateChartDataLabels(chartName) {
        const chart = this.charts[chartName === 'totalTrend' ? 'totalTrend' : 'customerStack'];
        if (!chart) return;

        const showLabels = this.showDataLabels[chartName === 'totalTrend' ? 'total' : 'customer'];

        chart.options.plugins.datalabels.display = showLabels;
        chart.update();
    }

    /**
     * 下载图表
     */
    downloadChart(chartId, type) {
        const chartMap = {
            'totalTrendChart': 'totalTrend',
            'customerStackChart': 'customerStack'
        };

        const chart = this.charts[chartMap[chartId]];
        if (!chart) return;

        const timestamp = new Date().toISOString().split('T')[0];

        if (type === 'image') {
            downloadChartAsImage(chart, `${chartId}_${timestamp}.png`);
        } else if (type === 'csv') {
            // 导出CSV数据
            const data = [];
            this.analysisData.periods.forEach((period, index) => {
                const row = { 周期: period };
                if (chartId === 'totalTrendChart') {
                    row['实际值'] = this.analysisData.totalTrend[index];
                    row['移动平均'] = formatNumber(this.analysisData.movingAverage[index], 2);
                } else {
                    Object.entries(this.analysisData.customerData).forEach(([customer, values]) => {
                        row[customer] = values[index];
                    });
                }
                data.push(row);
            });

            exportToCSV(data, `${chartId}_${timestamp}.csv`);
        }
    }

    /**
     * 导出贡献度表格
     */
    exportContributionTable() {
        const data = this.analysisData.contributionAnalysis.map(c => ({
            '客户名称': c.customer,
            '平均贡献度': formatNumber(c.avg, 1),
            '趋势变化': formatNumber(c.trendChange, 1) + '%',
            '最大值': formatNumber(c.max, 0),
            '最小值': formatNumber(c.min, 0),
            '波动系数': formatNumber(c.coefficientOfVariation, 1) + '%'
        }));

        const timestamp = new Date().toISOString().split('T')[0];
        exportToCSV(data, `客户贡献度分析_${timestamp}.csv`);
    }

    /**
     * 显示加载状态
     */
    showLoading(message = '正在加载...') {
        const loadingAlert = document.getElementById('loadingAlert');
        const loadingMessage = document.getElementById('loadingMessage');

        if (loadingMessage) loadingMessage.textContent = message;
        if (loadingAlert) loadingAlert.classList.remove('hidden');
    }

    /**
     * 隐藏加载状态
     */
    hideLoading() {
        const loadingAlert = document.getElementById('loadingAlert');
        if (loadingAlert) loadingAlert.classList.add('hidden');
    }

    /**
     * 显示错误信息
     */
    showError(message) {
        const errorAlert = document.getElementById('errorAlert');
        const errorMessage = document.getElementById('errorMessage');

        if (errorMessage) errorMessage.textContent = message;
        if (errorAlert) {
            errorAlert.classList.remove('hidden');
            setTimeout(() => errorAlert.classList.add('hidden'), 5000);
        }
    }

    /**
     * 更新连接状态显示
     */
    updateConnectionStatus() {
        const statusDot = document.getElementById('wsStatusDot');
        const statusText = document.getElementById('wsStatusText');

        if (!statusDot || !statusText) return;

        if (this.wsManager && this.wsManager.isConnected) {
            statusDot.className = 'w-2 h-2 rounded-full bg-green-500 animate-pulse';
            statusText.textContent = '已连接';
            statusText.className = 'text-sm text-green-600 font-medium';
        } else {
            statusDot.className = 'w-2 h-2 rounded-full bg-red-500';
            statusText.textContent = '未连接';
            statusText.className = 'text-sm text-red-600 font-medium';
        }
    }
}

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', async () => {
    const app = new DeepAnalysisApp();
    await app.init();

    // 暴露到全局供调试使用
    window.deepAnalysisApp = app;
    console.log('💡 提示：可在控制台使用 window.deepAnalysisApp 访问应用实例');
    console.log('💡 提示：可在控制台使用 DeepAnalysisDebugHelper.diagnose() 进行诊断');
});
