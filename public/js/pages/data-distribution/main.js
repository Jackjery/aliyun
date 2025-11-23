// 注册 ChartDataLabels 插件
if (typeof Chart !== 'undefined' && typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels);
    console.log('✅ Chart.js datalabels插件已注册');
} else {
    console.error('❌ Chart.js或datalabels插件未正确加载');
}

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

// 主应用类
class DataDistributionApp {
    constructor() {
        this.wsManager = new WebSocketManager();
        this.charts = {};
        this.selectedCustomers = [];
        this.allCustomers = [];
        this.rawData = { customers: [], stations: [], satellites: [] };
        this.showDataLabels = {
            customerBar: false,
            stationBar: false,
            customerSatellite: false
        };
        this.hasLoadedData = false; // 标记是否已加载过数据
    }

    async init() {
        try {
            // 显示加载状态
            this.showLoading();

            // 连接 WebSocket
            await this.wsManager.connect();

            // 设置默认时间范围
            this.setDefaultDateTimeRange();

            // 绑定事件
            this.setupEventListeners();

            this.hideLoading();
        } catch (error) {
            this.showError('初始化失败: ' + error.message);
        }
    }

    setupEventListeners() {
        // 时间筛选自动重新渲染
        const startDateTime = document.getElementById('startDateTime');
        const endDateTime = document.getElementById('endDateTime');

        // 防抖函数，避免频繁触发
        let autoRefreshTimeout = null;
        const autoRefresh = () => {
            clearTimeout(autoRefreshTimeout);
            autoRefreshTimeout = setTimeout(() => {
                // 只有在已经加载过数据后才自动刷新
                if (this.hasLoadedData) {
                    console.log('🔄 时间筛选条件已改变，自动重新渲染图表...');
                    this.applyFilters();
                }
            }, 800); // 800ms 防抖延迟
        };

        startDateTime.addEventListener('change', autoRefresh);
        endDateTime.addEventListener('change', autoRefresh);

        // 手动应用筛选按钮（保留以便用户手动控制）
        document.getElementById('applyFilters').addEventListener('click', () => this.applyFilters());

        document.getElementById('customerSelectDropdown').addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleCustomerDropdown();
        });
        document.getElementById('selectAllBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectAllCustomers();
        });
        document.getElementById('deselectAllBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.deselectAllCustomers();
        });
        document.getElementById('customerSearchInput').addEventListener('input', (e) => {
            e.stopPropagation();
            this.filterCustomerOptions(e.target.value);
        });
        document.getElementById('customerSearchInput').addEventListener('click', (e) => {
            e.stopPropagation();
        });
        document.addEventListener('click', () => this.closeDropdown());

        // 数据标签显示切换
        const showCustomerBarLabels = document.getElementById('showCustomerBarLabels');
        const showStationBarLabels = document.getElementById('showStationBarLabels');
        const showCustomerSatelliteLabels = document.getElementById('showCustomerSatelliteLabels');

        if (showCustomerBarLabels) {
            showCustomerBarLabels.addEventListener('change', (e) => this.toggleDataLabels('customerBar', e.target.checked));
        }
        if (showStationBarLabels) {
            showStationBarLabels.addEventListener('change', (e) => this.toggleDataLabels('stationBar', e.target.checked));
        }
        if (showCustomerSatelliteLabels) {
            showCustomerSatelliteLabels.addEventListener('change', (e) => this.toggleDataLabels('customerSatellite', e.target.checked));
        }

        // 下载按钮（使用事件委托处理动态生成的按钮）
        document.addEventListener('click', (e) => {
            if (e.target.closest('.chart-download-btn')) {
                const btn = e.target.closest('.chart-download-btn');
                const chartName = btn.dataset.chart;
                const type = btn.dataset.type;
                if (type === 'image') {
                    this.downloadChart(chartName);
                } else if (type === 'csv') {
                    this.downloadData(chartName);
                }
            }
        });
    }

    setDefaultDateTimeRange() {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);

        document.getElementById('startDateTime').value = this.formatDateTimeForInput(startDate);
        document.getElementById('endDateTime').value = this.formatDateTimeForInput(endDate);
    }

    formatDateTimeForInput(date) {
        // 使用本地时间而不是 UTC 时间
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    async applyFilters() {
        const startDateTime = document.getElementById('startDateTime').value;
        const endDateTime = document.getElementById('endDateTime').value;

        if (!startDateTime || !endDateTime) {
            this.showError('请选择完整的时间范围');
            return;
        }

        if (new Date(startDateTime) > new Date(endDateTime)) {
            this.showError('开始时间不能晚于结束时间');
            return;
        }

        try {
            this.showLoading();

            // 转换为完整的日期时间字符串（YYYY-MM-DD HH:MM:SS）
            const startDate = startDateTime.replace('T', ' ') + ':00';
            const endDate = endDateTime.replace('T', ' ') + ':00';

            // 并行查询所有数据
            const [overview, customerDist, stationDist, satelliteDist] = await Promise.all([
                this.wsManager.query('distribution_overview', { startDate, endDate }),
                this.wsManager.query('customer_distribution', { startDate, endDate }),
                this.wsManager.query('station_distribution', { startDate, endDate }),
                this.wsManager.query('satellite_distribution', { startDate, endDate })
            ]);

            // 保存原始数据
            this.rawData = {
                customers: customerDist.records,
                stations: stationDist.records,
                satellites: satelliteDist.records
            };

            // 更新统计卡片
            this.updateStatsCards(overview.records[0]);

            // 生成图表
            this.generateCustomerPieChart(customerDist.records);
            this.generateCustomerBarChart(customerDist.records);
            this.generateStationBarChart(stationDist.records);

            // 保存之前选择的客户
            const previouslySelectedCustomers = [...this.selectedCustomers];
            console.log('💾 保存之前选择的客户:', previouslySelectedCustomers);

            // 初始化客户选项（会重置 selectedCustomers）
            this.initializeCustomerOptions(customerDist.records);

            // 恢复之前的客户选择
            if (previouslySelectedCustomers.length > 0) {
                console.log('🔄 恢复客户选择...');
                previouslySelectedCustomers.forEach(customer => {
                    // 只恢复在新数据中仍然存在的客户
                    if (this.allCustomers.includes(customer)) {
                        if (!this.selectedCustomers.includes(customer)) {
                            this.selectedCustomers.push(customer);
                        }
                        // 更新复选框状态
                        const checkbox = document.querySelector(`.customer-checkbox[data-customer="${customer}"]`);
                        if (checkbox) {
                            checkbox.checked = true;
                        }
                    }
                });

                // 更新客户标签显示
                this.updateCustomerTags();

                // 自动重新渲染客户相关图表
                if (this.selectedCustomers.length > 0) {
                    console.log('🎨 自动重新渲染客户相关图表...');
                    this.updateCustomerSatelliteChart();
                    this.updateCustomerStationPreferenceCharts();
                }
            }

            // 标记已加载过数据
            this.hasLoadedData = true;

            this.hideLoading();
        } catch (error) {
            this.showError('查询失败: ' + error.message);
        }
    }

    updateStatsCards(data) {
        document.getElementById('totalCycles').textContent = data.total_cycles || 0;
        document.getElementById('satelliteCount').textContent = data.satellite_count || 0;
        document.getElementById('customerCount').textContent = data.customer_count || 0;
        document.getElementById('stationCount').textContent = data.station_count || 0;
    }

    generateCustomerPieChart(records) {
        this.destroyChart('customerPieChart');
        const ctx = document.getElementById('customerPieChart').getContext('2d');
        const labels = records.map(r => r.customer_name);
        const data = records.map(r => r.record_count);

        // 使用 trend-utils.js 的颜色函数
        const backgroundColor = labels.map((_, i) => getChartColor(i, 0.8));
        const borderColor = labels.map((_, i) => getChartColor(i, 1));

        const total = data.reduce((sum, val) => sum + val, 0);

        this.charts.customerPieChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor,
                    borderColor,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right' },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    },
                    datalabels: {
                        display: false
                    }
                }
            }
        });
    }

    generateCustomerBarChart(records) {
        this.destroyChart('customerBar');
        const ctx = document.getElementById('customerBarChart').getContext('2d');
        const labels = records.map(r => r.customer_name);
        const data = records.map(r => r.record_count);

        this.charts.customerBar = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: '跟踪圈次',
                    data,
                    backgroundColor: getChartColor(0, 0.6),
                    borderColor: getChartColor(0, 1),
                    borderWidth: 1.5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true }
                },
                plugins: {
                    legend: {
                        display: false  // 禁用原生图例，使用自定义HTML图例
                    },
                    datalabels: {
                        display: this.showDataLabels.customerBar || false,
                        align: 'end',
                        anchor: 'end',
                        offset: 4,
                        font: {
                            size: 11,
                            weight: 'bold'
                        },
                        color: 'rgb(var(--text-primary))',
                        formatter: (value) => value
                    }
                }
            }
        });

        // 创建自定义图例
        this.createCustomLegend(this.charts.customerBar, 'customerBarChartLegend');
    }

    generateStationBarChart(records) {
        this.destroyChart('stationBar');
        const ctx = document.getElementById('stationBarChart').getContext('2d');
        const labels = records.map(r => r.station_name);
        const data = records.map(r => r.record_count);

        this.charts.stationBar = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: '跟踪圈次',
                    data,
                    backgroundColor: getChartColor(2, 0.6),
                    borderColor: getChartColor(2, 1),
                    borderWidth: 1.5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true }
                },
                plugins: {
                    legend: {
                        display: false  // 禁用原生图例，使用自定义HTML图例
                    },
                    datalabels: {
                        display: this.showDataLabels.stationBar || false,
                        align: 'end',
                        anchor: 'end',
                        offset: 4,
                        font: {
                            size: 11,
                            weight: 'bold'
                        },
                        color: 'rgb(var(--text-primary))',
                        formatter: (value) => value
                    }
                }
            }
        });

        // 创建自定义图例
        this.createCustomLegend(this.charts.stationBar, 'stationBarChartLegend');
    }

    initializeCustomerOptions(records) {
        this.allCustomers = records.map(r => r.customer_name);
        const list = document.getElementById('customerOptionsList');
        list.innerHTML = '';

        this.allCustomers.forEach(customer => {
            const option = document.createElement('div');
            option.className = 'dropdown-option-item';
            option.innerHTML = `
                <input type="checkbox" class="customer-checkbox" data-customer="${customer}">
                <span>${customer}</span>
            `;
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                const checkbox = option.querySelector('.customer-checkbox');
                checkbox.checked = !checkbox.checked;
                this.handleCustomerCheckboxChange(customer, checkbox.checked);
            });
            list.appendChild(option);
        });
    }

    handleCustomerCheckboxChange(customer, checked) {
        if (checked && !this.selectedCustomers.includes(customer)) {
            this.selectedCustomers.push(customer);
        } else if (!checked) {
            this.selectedCustomers = this.selectedCustomers.filter(c => c !== customer);
        }
        this.updateCustomerTags();
        this.updateCustomerSatelliteChart();
        this.updateCustomerStationPreferenceCharts();
    }

    updateCustomerTags() {
        const container = document.getElementById('selectedCustomerTags');
        container.innerHTML = '';

        if (!this.selectedCustomers.length) {
            container.innerHTML = '<span class="text-gray-500 italic text-sm">请选择客户</span>';
            return;
        }

        // 显示第一个标签
        if (this.selectedCustomers.length > 0) {
            const firstTag = document.createElement('div');
            firstTag.className = 'selected-tag-inline';
            firstTag.innerHTML = `
                <span class="tag-label">${this.selectedCustomers[0]}</span>
                <span class="tag-remove" data-customer="${this.selectedCustomers[0]}">×</span>
            `;
            firstTag.querySelector('.tag-remove').addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleCustomerCheckboxChange(this.selectedCustomers[0], false);
                document.querySelectorAll('.customer-checkbox').forEach(cb => {
                    if (cb.dataset.customer === this.selectedCustomers[0]) cb.checked = false;
                });
            });
            container.appendChild(firstTag);
        }

        // 显示 +N
        if (this.selectedCustomers.length > 1) {
            const moreCount = document.createElement('span');
            moreCount.className = 'more-count';
            moreCount.textContent = `+${this.selectedCustomers.length - 1}`;
            container.appendChild(moreCount);
        }
    }

    async updateCustomerSatelliteChart() {
        if (!this.selectedCustomers.length) {
            console.log('⚠️ 未选择客户，跳过客户-卫星图表渲染');
            return;
        }

        try {
            console.log('🔄 开始渲染客户-卫星图表，选中客户:', this.selectedCustomers);
            const startDateTime = document.getElementById('startDateTime').value;
            const endDateTime = document.getElementById('endDateTime').value;
            const startDate = startDateTime.replace('T', ' ') + ':00';
            const endDate = endDateTime.replace('T', ' ') + ':00';

            console.log('📊 查询参数:', { startDate, endDate, customers: this.selectedCustomers });

            const result = await this.wsManager.query('customer_satellite_distribution', {
                startDate,
                endDate,
                customers: this.selectedCustomers
            });

            console.log('✅ 查询结果:', result);
            console.log('   记录数:', result.records.length);

            this.destroyChart('customerSatellite');
            const ctx = document.getElementById('customerSatelliteBarChart').getContext('2d');

            // 组织数据
            const satellites = [...new Set(result.records.map(r => r.satellite_name))];
            const datasets = this.selectedCustomers.map((customer, i) => ({
                label: customer,
                data: satellites.map(sat => {
                    const record = result.records.find(r =>
                        r.customer_name === customer && r.satellite_name === sat
                    );
                    return record ? record.record_count : 0;
                }),
                backgroundColor: getChartColor(i, 0.6),
                borderColor: getChartColor(i, 1),
                borderWidth: 1.5
            }));

            this.charts.customerSatellite = new Chart(ctx, {
                type: 'bar',
                data: { labels: satellites, datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: { y: { beginAtZero: true } },
                    plugins: {
                        legend: {
                            display: false  // 禁用原生图例，使用自定义HTML图例
                        },
                        datalabels: {
                            display: this.showDataLabels.customerSatellite || false,
                            align: 'end',
                            anchor: 'end',
                            offset: 4,
                            font: {
                                size: 11,
                                weight: 'bold'
                            },
                            color: 'rgb(var(--text-primary))',
                            formatter: (value) => value
                        }
                    }
                }
            });

            // 创建自定义图例
            this.createCustomLegend(this.charts.customerSatellite, 'customerSatelliteBarChartLegend');
            console.log('✅ 客户-卫星图表渲染完成');
        } catch (error) {
            console.error('❌ 更新客户-卫星图表失败:', error);
            this.showError('客户-卫星图表加载失败: ' + error.message);
        }
    }

    async updateCustomerStationPreferenceCharts() {
        const container = document.getElementById('stationPreferenceCharts');

        if (!this.selectedCustomers.length) {
            console.log('⚠️ 未选择客户，显示提示信息');
            container.innerHTML = `
                <div class="bg-card rounded-lg p-4 card-shadow flex items-center justify-center h-80">
                    <div class="text-center text-gray-500">
                        <p>请选择客户查看测站偏好</p>
                    </div>
                </div>
            `;
            return;
        }

        try {
            console.log('🔄 开始渲染客户-测站偏好图表，选中客户:', this.selectedCustomers);
            const startDateTime = document.getElementById('startDateTime').value;
            const endDateTime = document.getElementById('endDateTime').value;
            const startDate = startDateTime.replace('T', ' ') + ':00';
            const endDate = endDateTime.replace('T', ' ') + ':00';

            console.log('📊 查询参数:', { startDate, endDate, customers: this.selectedCustomers });

            const result = await this.wsManager.query('customer_station_distribution', {
                startDate,
                endDate,
                customers: this.selectedCustomers
            });

            console.log('✅ 查询结果:', result);
            console.log('   记录数:', result.records.length);

            container.innerHTML = '';

            this.selectedCustomers.forEach((customer, index) => {
                const chartId = `stationPref_${index}`;
                const labelId = `showStationPref_${index}`;
                const chartDiv = document.createElement('div');
                chartDiv.className = 'bg-card rounded-lg p-4 card-shadow';
                chartDiv.innerHTML = `
                    <div class="flex items-center justify-between mb-4">
                        <h4 class="text-base font-medium">${customer} 的测站偏好</h4>
                        <div class="flex items-center gap-2">
                            <label class="flex items-center justify-center px-2.5 bg-primary/10 text-primary rounded cursor-pointer hover:bg-primary/20 transition whitespace-nowrap" style="height: 32px;">
                                <input type="checkbox" id="${labelId}" class="mr-1.5 w-4 h-4">
                                <span class="text-sm font-medium">显示数据标签</span>
                            </label>
                            <button class="chart-download-btn flex items-center justify-center px-2.5 text-sm bg-primary/10 text-primary rounded hover:bg-primary/20 transition whitespace-nowrap" style="height: 32px;"
                                    data-chart="${chartId}" data-type="image">
                                <svg class="icon"><use href="#icon-download"/></svg>
                                <span>下载图表</span>
                            </button>
                            <button class="chart-download-btn flex items-center justify-center px-2.5 text-sm bg-primary/10 text-primary rounded hover:bg-primary/20 transition whitespace-nowrap" style="height: 32px;"
                                    data-chart="${chartId}" data-type="csv">
                                <svg class="icon"><use href="#icon-table"/></svg>
                                <span>CSV</span>
                            </button>
                        </div>
                    </div>
                    <div class="chart-container border border-default rounded-lg p-4">
                        <canvas id="${chartId}"></canvas>
                    </div>
                `;
                container.appendChild(chartDiv);

                const customerData = result.records.filter(r => r.customer_name === customer);
                const labels = customerData.map(r => r.station_name);
                const data = customerData.map(r => r.record_count);

                // 使用 trend-utils.js 的颜色
                const backgroundColor = labels.map((_, i) => getChartColor(i, 0.8));
                const borderColor = labels.map((_, i) => getChartColor(i, 1));

                const total = data.reduce((sum, val) => sum + val, 0);
                const ctx = document.getElementById(chartId).getContext('2d');
                this.charts[chartId] = new Chart(ctx, {
                    type: 'pie',
                    data: {
                        labels,
                        datasets: [{
                            data,
                            backgroundColor,
                            borderColor,
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'right' },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        const label = context.label || '';
                                        const value = context.parsed || 0;
                                        const percentage = ((value / total) * 100).toFixed(1);
                                        return `${label}: ${value} (${percentage}%)`;
                                    }
                                }
                            },
                            datalabels: {
                                display: false,
                                color: '#fff',
                                font: {
                                    size: 11,
                                    weight: 'bold'
                                },
                                formatter: (value, context) => {
                                    const percentage = ((value / total) * 100).toFixed(1);
                                    return `${percentage}%`;
                                }
                            }
                        }
                    }
                });

                // 为checkbox添加事件监听
                const labelCheckbox = document.getElementById(labelId);
                if (labelCheckbox) {
                    labelCheckbox.addEventListener('change', (e) => {
                        this.charts[chartId].options.plugins.datalabels.display = e.target.checked;
                        this.charts[chartId].update();
                    });
                }
            });
            console.log(`✅ 客户-测站偏好图表渲染完成，共 ${this.selectedCustomers.length} 个客户`);
        } catch (error) {
            console.error('❌ 更新客户-测站图表失败:', error);
            this.showError('客户-测站图表加载失败: ' + error.message);
        }
    }

    toggleCustomerDropdown() {
        const dropdown = document.getElementById('customerSelectDropdown');
        const options = document.getElementById('customerSelectOptions');
        const searchInput = document.getElementById('customerSearchInput');
        const tagsContainer = document.getElementById('selectedCustomerTags');

        options.classList.toggle('hidden');
        dropdown.classList.toggle('dropdown-open');

        // 切换搜索框和标签的显示
        if (!options.classList.contains('hidden')) {
            searchInput.style.display = 'block';
            tagsContainer.style.display = 'none';
            searchInput.focus();
        } else {
            searchInput.style.display = 'none';
            tagsContainer.style.display = 'flex';
            searchInput.value = '';
            this.filterCustomerOptions('');
        }
    }

    closeDropdown() {
        const dropdown = document.getElementById('customerSelectDropdown');
        const searchInput = document.getElementById('customerSearchInput');
        const tagsContainer = document.getElementById('selectedCustomerTags');

        dropdown.classList.remove('dropdown-open');
        document.getElementById('customerSelectOptions').classList.add('hidden');

        // 恢复标签显示，隐藏搜索框
        searchInput.style.display = 'none';
        tagsContainer.style.display = 'flex';
        searchInput.value = '';
        this.filterCustomerOptions('');
    }

    filterCustomerOptions(searchTerm) {
        const list = document.getElementById('customerOptionsList');
        const options = list.querySelectorAll('.dropdown-option-item');
        const lowerSearch = searchTerm.toLowerCase();

        options.forEach(option => {
            const customerName = option.querySelector('span').textContent.toLowerCase();
            if (customerName.includes(lowerSearch)) {
                option.style.display = 'flex';
            } else {
                option.style.display = 'none';
            }
        });
    }

    selectAllCustomers() {
        this.selectedCustomers = [...this.allCustomers];
        document.querySelectorAll('.customer-checkbox').forEach(cb => cb.checked = true);
        this.updateCustomerTags();
        this.updateCustomerSatelliteChart();
        this.updateCustomerStationPreferenceCharts();
    }

    deselectAllCustomers() {
        this.selectedCustomers = [];
        document.querySelectorAll('.customer-checkbox').forEach(cb => cb.checked = false);
        this.updateCustomerTags();
        this.destroyChart('customerSatellite');
        document.getElementById('stationPreferenceCharts').innerHTML = `
            <div class="bg-card rounded-lg p-4 card-shadow flex items-center justify-center h-80">
                <div class="text-center text-gray-500">
                    <p>请选择客户查看测站偏好</p>
                </div>
            </div>
        `;
    }

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

    downloadChart(chartName) {
        // 动态构建chartMap（包括动态生成的饼图）
        const chartMap = {
            'customerBar': { chart: this.charts.customerBar, name: '各客户跟踪圈次数量' },
            'stationBar': { chart: this.charts.stationBar, name: '各测站跟踪圈次数量' },
            'customerSatellite': { chart: this.charts.customerSatellite, name: '客户所属卫星跟踪圈次' },
            ...Object.keys(this.charts)
                .filter(key => key.startsWith('stationPref_'))
                .reduce((acc, key) => {
                    const index = parseInt(key.split('_')[1]);
                    const customerName = this.selectedCustomers[index] || '客户';
                    acc[key] = { chart: this.charts[key], name: `${customerName}的测站偏好` };
                    return acc;
                }, {})
        };

        const chartInfo = chartMap[chartName];
        if (!chartInfo || !chartInfo.chart) {
            console.warn('图表不存在或未渲染');
            return;
        }

        const url = chartInfo.chart.toBase64Image();
        const link = document.createElement('a');
        const startDate = document.getElementById('startDateTime').value.split('T')[0];
        const endDate = document.getElementById('endDateTime').value.split('T')[0];
        link.download = `${chartInfo.name}_${startDate}_${endDate}.png`;
        link.href = url;
        link.click();

        console.log(`📥 下载图表: ${chartInfo.name}`);
    }

    downloadData(chartName) {
        // 动态构建chartMap（包括动态生成的饼图）
        const chartMap = {
            'customerBar': { chart: this.charts.customerBar, name: '各客户跟踪圈次数量' },
            'stationBar': { chart: this.charts.stationBar, name: '各测站跟踪圈次数量' },
            'customerSatellite': { chart: this.charts.customerSatellite, name: '客户所属卫星跟踪圈次' },
            ...Object.keys(this.charts)
                .filter(key => key.startsWith('stationPref_'))
                .reduce((acc, key) => {
                    const index = parseInt(key.split('_')[1]);
                    const customerName = this.selectedCustomers[index] || '客户';
                    acc[key] = { chart: this.charts[key], name: `${customerName}的测站偏好` };
                    return acc;
                }, {})
        };

        const chartInfo = chartMap[chartName];
        if (!chartInfo || !chartInfo.chart) {
            console.warn('图表不存在或未渲染');
            return;
        }

        const csv = chartToCSV(chartInfo.chart);
        const startDate = document.getElementById('startDateTime').value.split('T')[0];
        const endDate = document.getElementById('endDateTime').value.split('T')[0];
        const filename = `${chartInfo.name}_${startDate}_${endDate}.csv`;
        downloadFile(filename, csv, 'text/csv;charset=utf-8');

        console.log(`📥 下载数据: ${chartInfo.name}`);
    }

    destroyChart(chartId) {
        if (this.charts[chartId]) {
            this.charts[chartId].destroy();
            delete this.charts[chartId];
        }
    }

    showLoading() {
        document.getElementById('loading').classList.remove('hidden');
        document.getElementById('error').classList.add('hidden');
    }

    hideLoading() {
        document.getElementById('loading').classList.add('hidden');
    }

    showError(message) {
        document.getElementById('error').textContent = message;
        document.getElementById('error').classList.remove('hidden');
        document.getElementById('loading').classList.add('hidden');
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', async () => {
    window.app = new DataDistributionApp();
    await window.app.init();
});
