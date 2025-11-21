/**
 * 卫星任务数据分析应用 - 简化版（后端统计）
 * 功能：通过WebSocket查询后端统计结果并渲染图表
 */
class SatelliteApp {
    constructor() {
        this.charts = {}; // 图表实例
        this.currentFilters = null; // 当前筛选条件
        this.isLoading = false;

        // 默认周期规则配置
        this.groupingConfig = {
            day: {
                startTime: '00:00'
            },
            week: {
                startDay: 1, // 周一
                startTime: '00:00'
            },
            month: {
                startDate: 1, // 1号
                startTime: '00:00'
            },
            quarter: {
                startMonth: 1, // 1月（Q1）
                startTime: '00:00'
            }
        };
    }

    /**
     * 初始化应用
     */
    async init() {
        console.log('📊 初始化卫星任务分析应用...');

        // 初始化日期选择器
        this.initDatePickers();

        // 初始化周期配置
        this.initGroupingConfig();

        // 初始化事件监听
        this.initEventListeners();

        // 初始化WebSocket数据变更监听
        this.initWebSocketListeners();

        console.log('✅ 应用初始化完成');
    }

    /**
     * 初始化日期选择器
     */
    initDatePickers() {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 3); // 默认最近3个月

        document.getElementById('startDate').valueAsDate = startDate;
        document.getElementById('endDate').valueAsDate = endDate;
    }

    /**
     * 初始化周期配置（从localStorage加载）
     */
    initGroupingConfig() {
        const savedConfig = localStorage.getItem('groupingConfig');
        if (savedConfig) {
            try {
                this.groupingConfig = JSON.parse(savedConfig);
                console.log('✅ 加载周期配置:', this.groupingConfig);
            } catch (e) {
                console.warn('⚠️ 周期配置解析失败，使用默认配置');
            }
        }
    }

    /**
     * 初始化事件监听
     */
    initEventListeners() {
        // 生成统计按钮
        document.getElementById('generateChart').addEventListener('click', () => {
            this.generateChart();
        });

        // 显示数据标签checkbox
        const showDataLabels = document.getElementById('showDataLabels');
        if (showDataLabels) {
            showDataLabels.addEventListener('change', (e) => {
                this.toggleDataLabels(e.target.checked);
            });
        }

        // 卫星数量卡片点击
        const satelliteCard = document.getElementById('satelliteCountCard');
        if (satelliteCard) {
            satelliteCard.addEventListener('click', () => {
                this.showSatelliteTrend();
            });
        }

        // 客户数量卡片点击
        const customerCard = document.getElementById('customerCountCard');
        if (customerCard) {
            customerCard.addEventListener('click', () => {
                this.showCustomerTrend();
            });
        }

        // 周期规则配置按钮
        const configBtn = document.getElementById('configGroupingBtn');
        if (configBtn) {
            configBtn.addEventListener('click', () => {
                this.showGroupingConfig();
            });
        }

        // 关闭配置模态框
        const closeConfigBtn = document.getElementById('closeConfigModal');
        if (closeConfigBtn) {
            closeConfigBtn.addEventListener('click', () => {
                this.hideGroupingConfig();
            });
        }

        // 保存周期配置
        const saveConfigBtn = document.getElementById('saveGroupingConfig');
        if (saveConfigBtn) {
            saveConfigBtn.addEventListener('click', () => {
                this.saveGroupingConfig();
            });
        }

        // 日周期时间输入实时更新显示
        const dayStartInput = document.getElementById('dayStart');
        if (dayStartInput) {
            dayStartInput.addEventListener('input', (e) => {
                const startTime = e.target.value;
                document.getElementById('dayStartDisplay').textContent = startTime;
                document.getElementById('dayEndDisplay').textContent = startTime;
            });
        }

        // 下载按钮
        document.querySelectorAll('.chart-download-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const chartId = e.currentTarget.dataset.chart;
                const downloadType = e.currentTarget.dataset.type;
                this.downloadChart(chartId, downloadType);
            });
        });

        // 日期选择器自动渲染
        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');
        if (startDateInput && endDateInput) {
            const autoRender = () => {
                const startDate = startDateInput.value;
                const endDate = endDateInput.value;
                // 只有当开始和结束日期都选择后才自动渲染
                if (startDate && endDate) {
                    this.showInfoToast('正在重新渲染图表...');
                    setTimeout(() => this.generateChart(), 100);
                }
            };
            startDateInput.addEventListener('change', autoRender);
            endDateInput.addEventListener('change', autoRender);
        }

        // 统计周期选择器自动渲染
        const groupBySelect = document.getElementById('groupBy');
        if (groupBySelect) {
            groupBySelect.addEventListener('change', () => {
                const startDate = document.getElementById('startDate').value;
                const endDate = document.getElementById('endDate').value;
                if (startDate && endDate) {
                    this.showInfoToast('统计周期已更改，正在重新渲染图表...');
                    setTimeout(() => this.generateChart(), 100);
                }
            });
        }
    }

    /**
     * 初始化WebSocket监听
     */
    initWebSocketListeners() {
        // 数据变更时提示用户刷新
        window.wsManager.onDataChange = (data) => {
            this.showDataChangeNotification();
        };

        // 连接状态变化
        window.wsManager.onConnectionChange = (connected) => {
            this.updateConnectionStatus(connected);
        };
    }

    /**
     * 生成统计图表
     */
    async generateChart() {
        if (this.isLoading) {
            console.log('⚠️ 正在加载中，请稍候');
            return;
        }

        try {
            this.isLoading = true;
            this.showLoading(true);

            // 获取筛选条件
            const filters = this.getFilters();
            this.currentFilters = filters;

            console.log('📊 查询统计数据:', filters);

            // 查询计划统计数据
            const planStats = await window.wsManager.queryStats('plan_stats', filters);
            console.log('✅ 计划统计数据:', planStats);

            // 查询概览数据
            const overview = await window.wsManager.queryStats('overview', filters);
            console.log('✅ 概览数据:', overview);

            // 渲染图表
            this.renderMainChart(planStats.records, filters.groupBy);

            // 更新统计卡片
            this.updateStatsCards(overview.records[0], planStats.records);

            // 更新详细表格
            this.updateDetailTable(planStats.records);

            this.showLoading(false);

        } catch (error) {
            console.error('❌ 生成统计失败:', error);
            this.showError('生成统计失败: ' + error.message);
            this.showLoading(false);
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * 计算日期是一年中的第几周（ISO 8601标准）
     */
    getWeekNumber(date) {
        // 复制日期对象，避免修改原始对象
        const target = new Date(date.valueOf());
        const dayNum = (date.getDay() + 6) % 7; // 转换为周一=0
        target.setDate(target.getDate() - dayNum + 3); // 调整到周四
        const firstThursday = target.valueOf();
        target.setMonth(0, 1); // 设置为1月1日
        if (target.getDay() !== 4) {
            target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
        }
        // 计算周数
        return 1 + Math.ceil((firstThursday - target) / 604800000);
    }

    /**
     * 获取筛选条件
     */
    getFilters() {
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        const groupBy = document.getElementById('groupBy').value;

        // 获取当前选择的周期规则
        const groupingRule = this.groupingConfig[groupBy];

        return {
            startDate,
            endDate,
            groupBy,
            groupingRule // 添加周期规则参数
        };
    }

    /**
     * 渲染主图表
     */
    renderMainChart(records, groupBy) {
        const canvas = document.getElementById('dataChart');
        if (!canvas) return;

        // 销毁旧图表
        if (this.charts.main) {
            this.charts.main.destroy();
        }

        // 准备数据 - 根据统计周期格式化显示
        const labels = records.map((r, index) => {
            const period = r.period;
            let cleanPeriod = period;

            // 如果包含时间部分（空格或T），只保留日期部分
            if (typeof period === 'string' && (period.includes(' ') || period.includes('T'))) {
                cleanPeriod = period.split(/[T ]/)[0];
            }

            // 根据统计周期格式化标签
            switch(groupBy) {
                case 'day':
                    // 按日：显示完整日期
                    return cleanPeriod;

                case 'week':
                    // 按周：计算是一年中的第几周
                    if (cleanPeriod.includes('-')) {
                        const date = new Date(cleanPeriod + 'T00:00:00');
                        const weekNum = this.getWeekNumber(date);
                        return `W${weekNum}`;
                    }
                    return `W${index + 1}`;

                case 'month':
                    // 按月：提取月份显示如"10月"
                    if (cleanPeriod.includes('-')) {
                        const month = cleanPeriod.split('-')[1];
                        return `${parseInt(month)}月`;
                    }
                    return cleanPeriod;

                case 'quarter':
                    // 按季度：显示如"Q1"
                    if (typeof cleanPeriod === 'string' && cleanPeriod.includes('-Q')) {
                        return cleanPeriod.split('-')[1]; // 提取"Q1"部分
                    }
                    return cleanPeriod;

                default:
                    return cleanPeriod;
            }
        });
        const planCounts = records.map(r => r.plan_count);
        const failureCounts = records.map(r => r.failure_count);
        const successRates = records.map(r => r.success_rate);

        // 创建图表 - 全部使用折线图
        const ctx = canvas.getContext('2d');
        this.charts.main = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: '计划ID数量',
                        data: planCounts,
                        backgroundColor: 'rgba(54, 162, 235, 0.1)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 2,
                        pointBackgroundColor: 'rgba(54, 162, 235, 1)',
                        pointBorderColor: '#fff',
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        fill: true,
                        tension: 0.4,
                        yAxisID: 'y',
                        datalabels: {
                            color: 'rgba(54, 162, 235, 1)',
                            anchor: 'end',
                            align: 'top',
                            offset: 4,
                            font: {
                                weight: 'bold',
                                size: 10
                            }
                        }
                    },
                    {
                        label: '失败圈次',
                        data: failureCounts,
                        backgroundColor: 'rgba(255, 99, 132, 0.1)',
                        borderColor: 'rgba(255, 99, 132, 1)',
                        borderWidth: 2,
                        pointBackgroundColor: 'rgba(255, 99, 132, 1)',
                        pointBorderColor: '#fff',
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        fill: true,
                        tension: 0.4,
                        yAxisID: 'y',
                        datalabels: {
                            color: 'rgba(255, 99, 132, 1)',
                            anchor: 'end',
                            align: 'bottom',
                            offset: 4,
                            font: {
                                weight: 'bold',
                                size: 10
                            }
                        }
                    },
                    {
                        label: '成功率(%)',
                        data: successRates,
                        backgroundColor: 'rgba(75, 192, 192, 0.1)',
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 2,
                        pointBackgroundColor: 'rgba(75, 192, 192, 1)',
                        pointBorderColor: '#fff',
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        fill: true,
                        tension: 0.4,
                        yAxisID: 'y1',
                        datalabels: {
                            color: 'rgba(75, 192, 192, 1)',
                            anchor: 'start',
                            align: 'top',
                            offset: 4,
                            font: {
                                weight: 'bold',
                                size: 10
                            },
                            formatter: (value) => {
                                if (value == null) return '';
                                const num = typeof value === 'string' ? parseFloat(value) : value;
                                return num.toFixed(1) + '%';
                            }
                        }
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        top: 30,
                        right: 20,
                        bottom: 10,
                        left: 20
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: `计划ID计数与任务状态趋势图 (按${this.getGroupByLabel(groupBy)})`
                    },
                    legend: {
                        display: true,
                        position: 'bottom'
                    },
                    datalabels: {
                        display: false // 默认不显示，由checkbox控制，每个dataset有自己的配置
                    },
                    tooltip: {
                        mode: 'index', // 显示所有数据集在同一个X轴位置的值
                        intersect: false, // 不需要精确悬停在点上
                        callbacks: {
                            title: (context) => {
                                // 显示时间点
                                return context[0].label;
                            },
                            label: (context) => {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                // 为成功率添加百分号
                                if (context.dataset.label === '成功率(%)') {
                                    label += context.parsed.y.toFixed(1) + '%';
                                } else {
                                    label += context.parsed.y;
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: '数量'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: '成功率(%)'
                        },
                        grid: {
                            drawOnChartArea: false
                        },
                        min: 0,
                        max: 100
                    }
                }
            }
        });

        console.log('✅ 主图表渲染完成');

        // 同步checkbox状态到数据标签显示
        const showDataLabelsCheckbox = document.getElementById('showDataLabels');
        if (showDataLabelsCheckbox) {
            this.toggleDataLabels(showDataLabelsCheckbox.checked);
        }
    }

    /**
     * 更新统计卡片
     */
    updateStatsCards(overview, planStats) {
        if (!overview) return;

        // 总计划数
        document.getElementById('totalCount').textContent = overview.total_plans || 0;

        // 平均周期计划数
        const avgCount = planStats.length > 0
            ? Math.round(planStats.reduce((sum, r) => sum + r.plan_count, 0) / planStats.length)
            : 0;
        document.getElementById('avgCount').textContent = avgCount;

        // 总失败圈次
        document.getElementById('totalFailures').textContent = overview.total_failures || 0;

        // 平均成功率（后端可能返回字符串或数字）
        const avgRate = overview.avg_success_rate || 0;
        const rateValue = typeof avgRate === 'string' ? parseFloat(avgRate) : avgRate;
        document.getElementById('avgSuccessRate').textContent = rateValue.toFixed(2) + '%';

        // 最大/最小周期计划数
        if (planStats.length > 0) {
            const counts = planStats.map(r => r.plan_count);
            document.getElementById('maxCount').textContent = Math.max(...counts);
            document.getElementById('minCount').textContent = Math.min(...counts);
        }

        // 卫星/客户数量
        document.getElementById('satelliteCount').textContent = overview.satellite_count || 0;
        document.getElementById('customerCount').textContent = overview.customer_count || 0;
    }

    /**
     * 更新详细表格
     */
    updateDetailTable(records) {
        const tbody = document.getElementById('detailTableBody');
        if (!tbody) return;

        tbody.innerHTML = '';

        records.forEach(record => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${record.period}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${record.plan_count}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-red-600">${record.failure_count}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-green-600">${record.success_rate}%</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${record.range_start} ~ ${record.range_end}</td>
            `;
            tbody.appendChild(row);
        });
    }

    /**
     * 显示卫星趋势
     */
    async showSatelliteTrend() {
        if (!this.currentFilters) {
            alert('请先生成统计结果');
            return;
        }

        try {
            console.log('📊 查询卫星趋势...');
            const result = await window.wsManager.queryStats('satellite_trend', this.currentFilters);

            // TODO: 渲染卫星趋势图表
            console.log('✅ 卫星趋势数据:', result);
            alert('卫星趋势功能开发中...');

        } catch (error) {
            console.error('❌ 查询卫星趋势失败:', error);
            this.showError('查询失败: ' + error.message);
        }
    }

    /**
     * 显示客户趋势
     */
    async showCustomerTrend() {
        if (!this.currentFilters) {
            alert('请先生成统计结果');
            return;
        }

        try {
            console.log('📊 查询客户趋势...');
            const result = await window.wsManager.queryStats('customer_trend', this.currentFilters);

            // TODO: 渲染客户趋势图表
            console.log('✅ 客户趋势数据:', result);
            alert('客户趋势功能开发中...');

        } catch (error) {
            console.error('❌ 查询客户趋势失败:', error);
            this.showError('查询失败: ' + error.message);
        }
    }

    /**
     * 显示/隐藏配置模态框
     */
    showGroupingConfig() {
        const modal = document.getElementById('groupingConfigModal');
        if (modal) {
            // 加载当前配置到表单
            this.loadConfigToForm();

            modal.classList.remove('hidden');
            setTimeout(() => {
                document.getElementById('modalContent').classList.remove('scale-95', 'opacity-0');
            }, 10);
        }
    }

    hideGroupingConfig() {
        const modal = document.getElementById('groupingConfigModal');
        if (modal) {
            document.getElementById('modalContent').classList.add('scale-95', 'opacity-0');
            setTimeout(() => {
                modal.classList.add('hidden');
            }, 300);
        }
    }

    /**
     * 加载配置到表单
     */
    loadConfigToForm() {
        // 日周期
        const dayStartTime = this.groupingConfig.day.startTime;
        document.getElementById('dayStart').value = dayStartTime;
        document.getElementById('dayStartDisplay').textContent = dayStartTime;
        document.getElementById('dayEndDisplay').textContent = dayStartTime;

        // 周周期
        document.getElementById('weekStartDay').value = this.groupingConfig.week.startDay;
        document.getElementById('weekStartTime').value = this.groupingConfig.week.startTime;

        // 月周期
        document.getElementById('monthStartDate').value = this.groupingConfig.month.startDate;
        document.getElementById('monthStartTime').value = this.groupingConfig.month.startTime;

        // 季度周期
        document.getElementById('quarterStartMonth').value = this.groupingConfig.quarter.startMonth;
        document.getElementById('quarterStartTime').value = this.groupingConfig.quarter.startTime;

        console.log('✅ 配置已加载到表单');
    }

    /**
     * 保存周期配置
     */
    saveGroupingConfig() {
        // 从表单读取配置
        this.groupingConfig = {
            day: {
                startTime: document.getElementById('dayStart').value
            },
            week: {
                startDay: parseInt(document.getElementById('weekStartDay').value),
                startTime: document.getElementById('weekStartTime').value
            },
            month: {
                startDate: parseInt(document.getElementById('monthStartDate').value),
                startTime: document.getElementById('monthStartTime').value
            },
            quarter: {
                startMonth: parseInt(document.getElementById('quarterStartMonth').value),
                startTime: document.getElementById('quarterStartTime').value
            }
        };

        // 保存到localStorage
        localStorage.setItem('groupingConfig', JSON.stringify(this.groupingConfig));

        console.log('✅ 周期配置已保存:', this.groupingConfig);

        // 显示成功提示
        this.showSuccessNotification('周期配置已保存');

        // 关闭模态框
        this.hideGroupingConfig();

        // 自动重新渲染图表
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        if (startDate && endDate) {
            this.showInfoToast('周期规则已更新，正在重新渲染图表...');
            setTimeout(() => this.generateChart(), 300);
        }
    }

    /**
     * 显示数据变更通知
     */
    showDataChangeNotification() {
        // 简单提示，可以改为更友好的UI
        const notification = document.createElement('div');
        notification.className = 'fixed top-20 right-4 bg-blue-500 text-white px-4 py-2 rounded shadow-lg z-50';
        notification.innerHTML = `
            <div class="flex items-center">
                <span class="mr-2">🔄</span>
                <span>数据已更新，建议重新查询</span>
                <button class="ml-4 text-white hover:text-gray-200" onclick="this.parentElement.parentElement.remove()">
                    ✕
                </button>
            </div>
        `;
        document.body.appendChild(notification);

        // 5秒后自动移除
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }

    /**
     * 显示成功通知
     */
    showSuccessNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'fixed top-20 right-4 bg-success text-white px-4 py-2 rounded shadow-lg z-50 animate-fade-in';
        notification.innerHTML = `
            <div class="flex items-center">
                <span class="mr-2">✅</span>
                <span>${message}</span>
                <button class="ml-4 text-white hover:text-gray-200" onclick="this.parentElement.parentElement.remove()">
                    ✕
                </button>
            </div>
        `;
        document.body.appendChild(notification);

        // 3秒后自动移除
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }

    /**
     * 显示信息提示（蓝色）
     */
    showInfoToast(message) {
        const notification = document.createElement('div');
        notification.className = 'fixed top-20 right-4 bg-blue-500 text-white px-4 py-2 rounded shadow-lg z-50 animate-fade-in';
        notification.innerHTML = `
            <div class="flex items-center">
                <span class="mr-2">ℹ️</span>
                <span>${message}</span>
                <button class="ml-4 text-white hover:text-gray-200" onclick="this.parentElement.parentElement.remove()">
                    ✕
                </button>
            </div>
        `;
        document.body.appendChild(notification);

        // 2秒后自动移除（信息提示显示时间稍短）
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 2000);
    }

    /**
     * 更新连接状态
     */
    updateConnectionStatus(connected) {
        const wsStatus = document.getElementById('wsStatus');
        const wsStatusText = document.getElementById('wsStatusText');

        if (!wsStatus || !wsStatusText) return;

        if (connected) {
            wsStatusText.textContent = '✅ WebSocket已连接';
            wsStatus.className = 'mb-6 p-3 bg-green-100 text-green-700 rounded-lg';

            // 3秒后隐藏
            setTimeout(() => {
                wsStatus.classList.add('hidden');
            }, 3000);
        } else {
            wsStatusText.textContent = '❌ WebSocket连接断开，正在重连...';
            wsStatus.className = 'mb-6 p-3 bg-red-100 text-red-700 rounded-lg';
            wsStatus.classList.remove('hidden');
        }
    }

    /**
     * 显示加载状态
     */
    showLoading(show) {
        const loadingState = document.getElementById('chartLoadingState');
        if (loadingState) {
            if (show) {
                loadingState.classList.remove('hidden');
            } else {
                loadingState.classList.add('hidden');
            }
        }
    }

    /**
     * 显示错误
     */
    showError(message) {
        const errorState = document.getElementById('chartErrorState');
        const errorMessage = document.getElementById('chartErrorMessage');

        if (errorState && errorMessage) {
            errorMessage.textContent = message;
            errorState.classList.remove('hidden');

            // 5秒后隐藏
            setTimeout(() => {
                errorState.classList.add('hidden');
            }, 5000);
        }
    }

    /**
     * 切换数据标签显示
     */
    toggleDataLabels(show) {
        if (!this.charts.main) {
            console.warn('⚠️ 图表未创建，无法切换数据标签');
            return;
        }

        // 更新每个数据集的datalabels配置
        this.charts.main.data.datasets.forEach(dataset => {
            if (dataset.datalabels) {
                dataset.datalabels.display = show;
            }
        });

        this.charts.main.update();

        console.log(`📊 数据标签${show ? '已显示' : '已隐藏'}`);
    }

    /**
     * 获取分组标签
     */
    getGroupByLabel(groupBy) {
        const labels = {
            'day': '日',
            'week': '周',
            'month': '月',
            'quarter': '季度'
        };
        return labels[groupBy] || groupBy;
    }

    /**
     * 下载图表（图片或数据）
     */
    downloadChart(chartId, downloadType) {
        // 根据chartId获取图表实例和数据
        let chart, chartData, fileName;

        if (chartId === 'mainChart') {
            chart = this.charts.main;
            chartData = chart?.data;
            fileName = '计划ID统计图表';
        } else if (chartId === 'satelliteChart') {
            chart = this.charts.satellite;
            chartData = chart?.data;
            fileName = '卫星数量趋势图';
        } else if (chartId === 'customerChart') {
            chart = this.charts.customer;
            chartData = chart?.data;
            fileName = '客户数量趋势图';
        }

        if (!chart) {
            alert('图表未生成，请先生成统计结果');
            return;
        }

        if (downloadType === 'image') {
            this.downloadChartImage(chart, fileName);
        } else if (downloadType === 'csv') {
            this.downloadChartData(chartData, fileName);
        }
    }

    /**
     * 下载图表为图片
     */
    downloadChartImage(chart, fileName) {
        try {
            // 使用Chart.js的toBase64Image方法获取图片
            const imageUrl = chart.toBase64Image('image/png', 1);

            // 创建下载链接
            const link = document.createElement('a');
            link.download = `${fileName}_${new Date().toISOString().slice(0, 10)}.png`;
            link.href = imageUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            console.log('✅ 图表图片下载完成');
            this.showSuccessNotification('图表已下载');
        } catch (error) {
            console.error('❌ 下载图表失败:', error);
            alert('下载图表失败: ' + error.message);
        }
    }

    /**
     * 下载图表数据为CSV
     */
    downloadChartData(chartData, fileName) {
        if (!chartData) {
            alert('没有可下载的数据');
            return;
        }

        try {
            // 构建CSV内容
            const labels = chartData.labels || [];
            const datasets = chartData.datasets || [];

            // CSV头部：周期 + 各个数据集名称
            let csvContent = '周期,' + datasets.map(ds => ds.label).join(',') + '\n';

            // CSV数据行
            labels.forEach((label, index) => {
                const row = [label];
                datasets.forEach(dataset => {
                    const value = dataset.data[index];
                    // 如果是成功率，保留小数
                    if (dataset.label.includes('成功率')) {
                        if (value != null) {
                            const num = typeof value === 'string' ? parseFloat(value) : value;
                            row.push(num.toFixed(2));
                        } else {
                            row.push('');
                        }
                    } else {
                        row.push(value != null ? value : '');
                    }
                });
                csvContent += row.join(',') + '\n';
            });

            // 创建Blob
            const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });

            // 创建下载链接
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `${fileName}_数据_${new Date().toISOString().slice(0, 10)}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            console.log('✅ 图表数据下载完成');
            this.showSuccessNotification('数据已下载为CSV');
        } catch (error) {
            console.error('❌ 下载数据失败:', error);
            alert('下载数据失败: ' + error.message);
        }
    }
}

// 全局实例
window.satelliteApp = new SatelliteApp();
