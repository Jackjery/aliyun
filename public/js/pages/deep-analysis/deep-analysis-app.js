/**
 * Deep Analysis Application
 * 深度分析页面主应用逻辑
 * 使用移动平均算法识别导致总计划ID数下滑的客户
 */

class DeepAnalysisApp {
    constructor() {
        // WebSocket 管理器
        this.wsManager = null;

        // 多选下拉框实例（已删除）
        this.filters = {};

        // 图表实例
        this.charts = {
            customerDetail: null,
            overviewDetail: null
        };

        // 当前筛选条件
        this.currentFilters = {
            startDate: '',
            endDate: '',
            groupBy: 'day',
            movingAvgWindow: 5,
            customers: []
        };

        // 周期规则配置
        this.groupingRules = {
            day: {
                startTime: '00:00'
            },
            week: {
                startDay: 1, // 0=周日, 1=周一
                startTime: '00:00'
            },
            month: {
                startDate: 1, // 月起始日期
                startTime: '00:00'
            },
            quarter: {
                startMonth: 1, // 季度起始月份 (1, 4, 7, 10)
                startTime: '00:00'
            }
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
            total: false
        };
    }

    /**
     * 初始化应用
     */
    async init() {
        console.log('🚀 DeepAnalysisApp 初始化开始');

        // 初始化日期
        this.initializeDates();

        // 加载周期规则配置
        this.loadGroupingConfig();

        // 初始化 WebSocket
        await this.initWebSocket();

        // 更新连接状态显示
        this.updateConnectionStatus();

        // 初始化事件监听
        this.initEventListeners();

        // 初始化客户详情模态框
        this.initCustomerDetailModal();

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


        // 导出表格
        document.getElementById('exportTableBtn')?.addEventListener('click', () => {
            this.exportContributionTable();
        });

        // 切换指标说明面板
        document.getElementById('toggleMetricsInfo')?.addEventListener('click', () => {
            this.toggleInfoPanel('metricsInfoPanel', 'toggleMetricsInfo');
        });

        // 切换综合评估说明面板
        document.getElementById('toggleComprehensiveInfo')?.addEventListener('click', () => {
            this.toggleInfoPanel('comprehensiveInfoPanel', 'toggleComprehensiveInfo');
        });

        // 切换高级分析说明面板
        document.getElementById('toggleAdvancedInfo')?.addEventListener('click', () => {
            this.toggleInfoPanel('advancedInfoPanel', 'toggleAdvancedInfo');
        });

        // 切换预测说明面板
        document.getElementById('toggleForecastInfo')?.addEventListener('click', () => {
            this.toggleInfoPanel('forecastInfoPanel', 'toggleForecastInfo');
        });

        // 切换关联分析说明面板
        document.getElementById('toggleCorrelationInfo')?.addEventListener('click', () => {
            this.toggleInfoPanel('correlationInfoPanel', 'toggleCorrelationInfo');
        });

        // 周期规则配置按钮
        document.getElementById('configGroupingBtn')?.addEventListener('click', () => {
            this.openConfigModal();
        });

        // 关闭配置模态框
        document.getElementById('closeConfigModal')?.addEventListener('click', () => {
            this.closeConfigModal();
        });

        // 点击模态框背景关闭
        document.getElementById('configModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'configModal') {
                this.closeConfigModal();
            }
        });

        // 保存配置
        document.getElementById('saveConfigBtn')?.addEventListener('click', () => {
            this.saveGroupingConfig();
        });

        // 重置配置
        document.getElementById('resetConfigBtn')?.addEventListener('click', () => {
            this.resetGroupingConfig();
        });

        // 按日起始时间变化时更新显示
        document.getElementById('dayStart')?.addEventListener('change', (e) => {
            this.updateDayRangeDisplay(e.target.value);
        });
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
            this.currentFilters.customers = []; // 分析所有客户

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
        const groupingRule = this.groupingRules[this.currentFilters.groupBy];
        console.log('📊 当前周期规则配置:', {
            groupBy: this.currentFilters.groupBy,
            groupingRule: groupingRule,
            allRules: this.groupingRules
        });

        const result = await this.wsManager.queryStats('customer_dimension_trend', {
            startDate: this.currentFilters.startDate,
            endDate: this.currentFilters.endDate,
            groupBy: this.currentFilters.groupBy,
            groupingRule: groupingRule, // 传递当前选中周期的规则配置
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
        console.log('🔄 开始数据处理和分析...');

        // ==== 总体趋势分析 ====
        // 1. 线性回归分析
        this.analysisData.linearRegression = linearRegression(this.analysisData.totalTrend);

        // 2. 指数移动平均
        this.analysisData.movingAverage = calculateMovingAverage(this.analysisData.totalTrend, this.currentFilters.movingAvgWindow);
        this.analysisData.ema = calculateEMA(this.analysisData.totalTrend, this.currentFilters.movingAvgWindow);

        // 3. 异常值检测
        this.analysisData.outliers = detectOutliers(this.analysisData.totalTrend);

        // 4. 连续下滑检测
        this.analysisData.consecutiveDeclines = detectConsecutiveDecline(this.analysisData.totalTrend, 3);

        // 5. 趋势显著性检验
        this.analysisData.significance = trendSignificanceTest(this.analysisData.totalTrend);

        // 6. 趋势预测
        this.analysisData.forecast = forecastTrend(this.analysisData.totalTrend, 3);

        // 7. 季节性检测（根据统计周期调整检测周期）
        const seasonalityPeriod = this.currentFilters.groupBy === 'day' ? 7 :
                                   this.currentFilters.groupBy === 'week' ? 4 : 12;
        this.analysisData.seasonality = detectSeasonality(this.analysisData.totalTrend, seasonalityPeriod);

        // 8. 客户相关性分析
        this.analysisData.customerCorrelation = analyzeCustomerCorrelation(this.analysisData.customerData);

        // 9. 综合趋势评估
        this.analysisData.comprehensiveAnalysis = comprehensiveTrendAnalysis(this.analysisData.totalTrend);

        // ==== 客户级别分析（核心新增）====
        console.log('🔍 开始为每个客户执行独立分析...');
        this.analysisData.customerAnalysis = {};

        Object.entries(this.analysisData.customerData).forEach(([customer, values]) => {
            console.log(`  📊 分析客户: ${customer}`);

            this.analysisData.customerAnalysis[customer] = {
                // 原始数据
                values: values,

                // 1. 线性回归
                linearRegression: linearRegression(values),

                // 2. 移动平均
                movingAverage: calculateMovingAverage(values, this.currentFilters.movingAvgWindow),
                ema: calculateEMA(values, this.currentFilters.movingAvgWindow),

                // 3. 异常值检测
                outliers: detectOutliers(values),

                // 4. 连续下滑检测
                consecutiveDeclines: detectConsecutiveDecline(values, 3),

                // 5. 趋势显著性检验
                significance: trendSignificanceTest(values),

                // 6. 趋势预测
                forecast: forecastTrend(values, 3),

                // 7. 季节性检测
                seasonality: detectSeasonality(values, seasonalityPeriod),

                // 8. 综合趋势评估
                comprehensiveAnalysis: comprehensiveTrendAnalysis(values),

                // 9. 基础统计指标
                statistics: {
                    total: values.reduce((sum, val) => sum + val, 0),
                    avg: values.reduce((sum, val) => sum + val, 0) / values.length,
                    max: Math.max(...values),
                    min: Math.min(...values),
                    stdDev: (() => {
                        const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
                        const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
                        return Math.sqrt(variance);
                    })()
                }
            };
        });

        console.log(`✅ 客户级别分析完成，共分析 ${Object.keys(this.analysisData.customerAnalysis).length} 个客户`);
        console.log('✅ 全部数据处理完成:', this.analysisData);
    }

    /**
     * 渲染分析结果
     */
    renderResults() {
        // 渲染总体概览
        this.renderOverallSummary();

        // 渲染智能分析结论（新增）
        this.renderAnalysisConclusion();

        // 渲染季节性与客户关联分析
        this.renderSeasonalityAndCorrelation();

        // 渲染趋势贡献分解分析（新增）
        this.renderTrendContributionDecomposition();

        // 初始化客户选择器
        this.initializeCustomerSelector();
    }

    /**
     * 初始化客户详情模态框
     */
    initCustomerDetailModal() {
        // 关闭客户详情模态框事件
        document.getElementById('closeCustomerDetailModal')?.addEventListener('click', () => {
            this.closeCustomerDetail();
        });

        // 点击背景关闭客户详情
        document.getElementById('customerDetailModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'customerDetailModal') {
                this.closeCustomerDetail();
            }
        });

        // 关闭总体详情模态框事件
        document.getElementById('closeOverviewDetailModal')?.addEventListener('click', () => {
            this.closeOverviewDetail();
        });

        // 点击背景关闭总体详情
        document.getElementById('overviewDetailModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'overviewDetailModal') {
                this.closeOverviewDetail();
            }
        });
    }

    /**
     * 打开客户详情模态框
     */
    openCustomerDetail(customerName) {
        console.log(`📂 正在打开客户详情: ${customerName}`);
        console.log('📊 可用的客户分析数据:', Object.keys(this.analysisData.customerAnalysis || {}));

        const analysis = this.analysisData.customerAnalysis[customerName];
        if (!analysis) {
            console.error('❌ 客户数据不存在:', customerName);
            alert(`未找到客户"${customerName}"的分析数据！`);
            return;
        }

        console.log('✅ 找到客户数据，准备渲染模态框...');

        // 设置标题
        document.getElementById('customerDetailTitle').textContent = `${customerName} - 详细分析`;

        // 渲染图表
        this.renderCustomerDetailChart(customerName, analysis);

        // 绑定工具栏事件
        this.bindCustomerDetailToolbar(customerName, analysis);

        // 显示模态框
        const modal = document.getElementById('customerDetailModal');
        const modalContent = document.getElementById('customerDetailModalContent');

        if (!modal || !modalContent) {
            console.error('❌ 模态框元素未找到！modal:', modal, 'modalContent:', modalContent);
            alert('模态框元素未找到，请刷新页面重试！');
            return;
        }

        console.log('✅ 显示模态框...');
        modal.classList.remove('hidden');

        // 触发动画
        setTimeout(() => {
            modalContent.style.transform = 'scale(1)';
            modalContent.style.opacity = '1';
            console.log('✅ 模态框动画已触发');
        }, 10);
    }

    /**
     * 关闭客户详情模态框
     */
    closeCustomerDetail() {
        const modal = document.getElementById('customerDetailModal');
        const modalContent = document.getElementById('customerDetailModalContent');

        // 关闭动画
        modalContent.style.transform = 'scale(0.95)';
        modalContent.style.opacity = '0';

        setTimeout(() => {
            modal.classList.add('hidden');

            // 销毁图表
            if (this.charts.customerDetail) {
                this.charts.customerDetail.destroy();
                this.charts.customerDetail = null;
            }
        }, 200);
    }

    /**
     * 打开总体详情模态框
     */
    openOverviewDetail(type) {
        console.log(`📂 打开总体详情: ${type}`);

        const modal = document.getElementById('overviewDetailModal');
        const modalContent = document.getElementById('overviewDetailModalContent');
        const titleElement = document.getElementById('overviewDetailTitle');
        const contentElement = document.getElementById('overviewDetailContent');

        console.log('🔍 模态框元素检查:', {
            modal: !!modal,
            modalContent: !!modalContent,
            titleElement: !!titleElement,
            contentElement: !!contentElement
        });

        if (!modal || !modalContent || !titleElement || !contentElement) {
            console.error('❌ 总体详情模态框元素未找到！');
            return;
        }

        // 根据类型设置标题和内容
        try {
            switch (type) {
                case 'customers':
                    titleElement.textContent = '客户总数详情';
                    this.renderCustomersDetail(contentElement);
                    break;
                case 'total':
                    titleElement.textContent = '总计划ID数趋势';
                    this.renderTotalTrendDetail(contentElement);
                    break;
                case 'health':
                    console.log('🏥 开始渲染健康度详情...');
                    titleElement.textContent = '综合健康度详情';
                    this.renderHealthDetail(contentElement);
                    console.log('✅ 健康度详情渲染完成');
                    break;
                case 'trend':
                    titleElement.textContent = '总体趋势分析与预测';
                    this.renderTrendDetail(contentElement);
                    break;
            }

            // 显示模态框
            console.log('🎭 显示模态框...');
            modal.classList.remove('hidden');
            // 添加淡入动画
            modalContent.style.transform = 'scale(0.95)';
            modalContent.style.opacity = '0';
            modalContent.style.transition = 'all 0.2s ease-out';
            setTimeout(() => {
                modalContent.style.transform = 'scale(1)';
                modalContent.style.opacity = '1';
            }, 10);
        } catch (error) {
            console.error('❌ 渲染详情时出错:', error);
            alert('渲染详情失败: ' + error.message);
        }
    }

    /**
     * 关闭总体详情模态框
     */
    closeOverviewDetail() {
        const modal = document.getElementById('overviewDetailModal');
        const modalContent = document.getElementById('overviewDetailModalContent');

        modalContent.style.transform = 'scale(0.95)';
        modalContent.style.opacity = '0';

        setTimeout(() => {
            modal.classList.add('hidden');
            if (this.charts.overviewDetail) {
                this.charts.overviewDetail.destroy();
                this.charts.overviewDetail = null;
            }
        }, 200);
    }

    /**
     * 渲染客户总数详情
     */
    renderCustomersDetail(container) {
        const customerAnalysis = this.analysisData.customerAnalysis || {};
        const customers = Object.entries(customerAnalysis);

        // 按健康评分分类
        const critical = customers.filter(([_, a]) => a.comprehensiveAnalysis.score < 40);
        const warning = customers.filter(([_, a]) => a.comprehensiveAnalysis.score >= 40 && a.comprehensiveAnalysis.score < 60);
        const stable = customers.filter(([_, a]) => a.comprehensiveAnalysis.score >= 60 && a.comprehensiveAnalysis.score < 80);
        const healthy = customers.filter(([_, a]) => a.comprehensiveAnalysis.score >= 80);

        // 按趋势分类
        const declining = customers.filter(([_, a]) => a.linearRegression?.trend === 'decline');
        const rising = customers.filter(([_, a]) => a.linearRegression?.trend === 'rise');
        const stableByTrend = customers.filter(([_, a]) => a.linearRegression?.trend === 'stable');

        container.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <!-- 健康度分布 -->
                <div class="bg-gray-50 rounded-lg p-4">
                    <h4 class="font-semibold text-gray-800 mb-3">客户健康度分布</h4>
                    <div class="space-y-2">
                        <div class="flex justify-between items-center">
                            <span class="text-sm">危急 (&lt;40分)</span>
                            <span class="font-bold text-red-600">${critical.length}</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-sm">预警 (40-59分)</span>
                            <span class="font-bold text-orange-600">${warning.length}</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-sm">平稳 (60-79分)</span>
                            <span class="font-bold text-yellow-600">${stable.length}</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-sm">健康 (≥80分)</span>
                            <span class="font-bold text-green-600">${healthy.length}</span>
                        </div>
                    </div>
                </div>

                <!-- 趋势分布 -->
                <div class="bg-gray-50 rounded-lg p-4">
                    <h4 class="font-semibold text-gray-800 mb-3">客户趋势分布</h4>
                    <div class="space-y-2">
                        <div class="flex justify-between items-center">
                            <span class="text-sm">📉 下降趋势</span>
                            <span class="font-bold text-red-600">${declining.length}</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-sm">📈 上升趋势</span>
                            <span class="font-bold text-green-600">${rising.length}</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-sm">➡️ 平稳趋势</span>
                            <span class="font-bold text-gray-600">${stableByTrend.length}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 客户详细列表 -->
            <div class="bg-gray-50 rounded-lg p-4">
                <h4 class="font-semibold text-gray-800 mb-3">客户详细列表（按健康度排序）</h4>
                <div class="max-h-96 overflow-y-auto">
                    <table class="w-full text-sm">
                        <thead class="sticky top-0 bg-gray-100">
                            <tr>
                                <th class="text-left p-2 border-b">客户名称</th>
                                <th class="text-center p-2 border-b">健康评分</th>
                                <th class="text-center p-2 border-b">趋势</th>
                                <th class="text-right p-2 border-b">平均计划ID数</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${customers.sort((a, b) => a[1].comprehensiveAnalysis.score - b[1].comprehensiveAnalysis.score).map(([name, analysis]) => {
                                const score = analysis.comprehensiveAnalysis.score;
                                const scoreColor = score < 40 ? 'text-red-600' : score < 60 ? 'text-orange-600' : score < 80 ? 'text-yellow-600' : 'text-green-600';
                                const trend = analysis.linearRegression?.trend || 'stable';
                                const trendEmoji = trend === 'decline' ? '📉' : trend === 'rise' ? '📈' : '➡️';
                                return `
                                    <tr class="hover:bg-gray-100 cursor-pointer" data-customer="${name}">
                                        <td class="p-2 border-b">${name}</td>
                                        <td class="p-2 border-b text-center ${scoreColor} font-bold">${score.toFixed(1)}</td>
                                        <td class="p-2 border-b text-center">${trendEmoji}</td>
                                        <td class="p-2 border-b text-right">${analysis.statistics.avg.toFixed(1)}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        // 绑定客户行点击事件
        setTimeout(() => {
            container.querySelectorAll('tr[data-customer]').forEach(row => {
                row.addEventListener('click', () => {
                    const customerName = row.getAttribute('data-customer');
                    this.closeOverviewDetail();
                    setTimeout(() => {
                        this.openCustomerDetail(customerName);
                    }, 250);
                });
            });
        }, 100);
    }

    /**
     * 渲染总计划ID数趋势详情
     */
    renderTotalTrendDetail(container) {
        container.innerHTML = `
            <div class="flex items-center justify-between mb-4">
                <label class="flex items-center space-x-2">
                    <input type="checkbox" id="showTotalDetailLabels" class="rounded">
                    <span class="text-sm">显示数据标签</span>
                </label>
                <div class="space-x-2">
                    <button id="downloadTotalChart" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm">
                        📊 下载图表
                    </button>
                    <button id="downloadTotalData" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm">
                        📥 下载数据
                    </button>
                </div>
            </div>
            <canvas id="totalTrendDetailChart" style="max-height: 500px;"></canvas>
        `;

        // 渲染图表
        setTimeout(() => {
            this.renderTotalTrendDetailChart();
            this.bindTotalTrendDetailToolbar();
        }, 100);
    }

    /**
     * 渲染总趋势详情图表
     */
    renderTotalTrendDetailChart() {
        const canvas = document.getElementById('totalTrendDetailChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        // 销毁旧图表
        if (this.charts.overviewDetail) {
            this.charts.overviewDetail.destroy();
        }

        const datasets = [
            {
                label: '总计划ID数',
                data: this.analysisData.totalTrend,
                borderColor: 'rgb(59, 130, 246)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6,
                datalabels: {
                    display: false,
                    align: 'top',
                    color: 'rgb(59, 130, 246)',
                    font: { weight: 'bold', size: 11 }
                }
            },
            {
                label: `EMA平滑线(${this.currentFilters.movingAvgWindow}期)`,
                data: this.analysisData.ema,
                borderColor: 'rgb(239, 68, 68)',
                backgroundColor: 'transparent',
                borderWidth: 2,
                borderDash: [5, 5],
                fill: false,
                tension: 0.4,
                pointRadius: 3,
                pointHoverRadius: 5,
                datalabels: {
                    display: false,
                    align: 'bottom',
                    color: 'rgb(239, 68, 68)',
                    font: { weight: 'bold', size: 10 }
                }
            }
        ];

        this.charts.overviewDetail = new Chart(ctx, {
            type: 'line',
            data: {
                labels: this.analysisData.periods,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const label = context.dataset.label || '';
                                const value = context.parsed.y;
                                return `${label}: ${value.toFixed(2)}`;
                            }
                        }
                    },
                    datalabels: {
                        display: false
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
                            text: '统计周期'
                        }
                    }
                }
            },
            plugins: [ChartDataLabels]
        });
    }

    /**
     * 绑定总趋势详情工具栏事件
     */
    bindTotalTrendDetailToolbar() {
        // 数据标签切换
        const checkbox = document.getElementById('showTotalDetailLabels');
        if (checkbox) {
            const newCheckbox = checkbox.cloneNode(true);
            checkbox.parentNode.replaceChild(newCheckbox, checkbox);

            newCheckbox.addEventListener('change', (e) => {
                if (this.charts.overviewDetail) {
                    // 遍历所有数据集，包括EMA平滑线
                    this.charts.overviewDetail.data.datasets.forEach(dataset => {
                        if (dataset.datalabels) {
                            dataset.datalabels.display = e.target.checked;
                        }
                    });
                    this.charts.overviewDetail.update();
                }
            });
        }

        // 下载图表
        const downloadChartBtn = document.getElementById('downloadTotalChart');
        if (downloadChartBtn) {
            const newBtn = downloadChartBtn.cloneNode(true);
            downloadChartBtn.parentNode.replaceChild(newBtn, downloadChartBtn);

            newBtn.addEventListener('click', () => {
                if (this.charts.overviewDetail) {
                    const link = document.createElement('a');
                    link.download = `总计划ID数趋势_${new Date().toLocaleDateString()}.png`;
                    link.href = this.charts.overviewDetail.toBase64Image();
                    link.click();
                }
            });
        }

        // 下载数据
        const downloadDataBtn = document.getElementById('downloadTotalData');
        if (downloadDataBtn) {
            const newBtn = downloadDataBtn.cloneNode(true);
            downloadDataBtn.parentNode.replaceChild(newBtn, downloadDataBtn);

            newBtn.addEventListener('click', () => {
                const periods = this.analysisData.periods;
                const values = this.analysisData.totalTrend;
                const ema = this.analysisData.ema;

                let csv = 'Period,Total Plan IDs,EMA\n';
                periods.forEach((period, index) => {
                    csv += `${period},${values[index]},${ema[index] || ''}\n`;
                });

                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.download = `总计划ID数趋势_${new Date().toLocaleDateString()}.csv`;
                link.href = URL.createObjectURL(blob);
                link.click();
            });
        }
    }

    /**
     * 渲染综合健康度详情（高度集成版）
     */
    renderHealthDetail(container) {
        const comprehensiveAnalysis = this.analysisData.comprehensiveAnalysis || {};
        const customers = Object.entries(this.analysisData.customerAnalysis || {});
        const regression = this.analysisData.linearRegression || {};
        const forecast = this.analysisData.forecast || {};
        const significance = this.analysisData.significance || {};
        const consecutiveDeclines = this.analysisData.consecutiveDeclines || [];
        const outliers = this.analysisData.outliers || {};
        const ema = this.analysisData.ema || [];
        const totalTrend = this.analysisData.totalTrend || [];

        // 计算平均健康分
        const avgHealthScore = customers.length > 0
            ? customers.reduce((sum, [_, a]) => sum + a.comprehensiveAnalysis.score, 0) / customers.length
            : 0;

        // 评估等级 - 根据总体评分判断
        const score = comprehensiveAnalysis.score || 0;
        let level = 'stable';
        if (score >= 70) level = 'healthy';
        else if (score >= 50) level = 'stable';
        else if (score >= 30) level = 'warning';
        else level = 'critical';

        const levelColors = {
            critical: { bg: 'bg-red-100', text: 'text-red-800', label: '危急', icon: '🚨' },
            warning: { bg: 'bg-orange-100', text: 'text-orange-800', label: '预警', icon: '⚠️' },
            stable: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: '平稳', icon: '➡️' },
            healthy: { bg: 'bg-green-100', text: 'text-green-800', label: '健康', icon: '✅' }
        };
        const levelInfo = levelColors[level];

        container.innerHTML = `
            <div class="space-y-4">
                <!-- 总体健康评分 -->
                <div class="${levelInfo.bg} rounded-lg p-4 text-center border-2 ${levelInfo.text.replace('text-', 'border-')}">
                    <div class="text-3xl mb-1">${levelInfo.icon}</div>
                    <div class="text-2xl font-bold ${levelInfo.text} mb-1">${levelInfo.label}</div>
                    <div class="text-lg ${levelInfo.text}">
                        总体: ${score}分 | 客户平均: ${avgHealthScore.toFixed(1)}分
                    </div>
                </div>

                <!-- 算法说明 -->
                <details class="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
                    <summary class="font-semibold text-purple-900 p-3 cursor-pointer hover:bg-purple-100 rounded-lg transition-colors">
                        🔬 企业级算法说明（点击展开查看详细公式）
                    </summary>
                    <div class="p-3 pt-2 space-y-3 text-xs">
                        <div class="bg-white rounded p-3 border border-purple-100">
                            <div class="font-semibold text-blue-900 mb-2 flex items-center">
                                <span class="mr-2">📈</span>
                                线性回归分析
                            </div>
                            <div class="text-gray-700 space-y-1">
                                <p><strong>算法：</strong>最小二乘法（Ordinary Least Squares）</p>
                                <p><strong>公式：</strong><code class="bg-gray-100 px-1 py-0.5 rounded">y = ax + b</code></p>
                                <p><strong>说明：</strong>通过最小化残差平方和拟合趋势线，a为斜率，b为截距</p>
                                <p><strong>R²值：</strong>拟合优度，越接近1表示拟合越好</p>
                            </div>
                        </div>
                        <div class="bg-white rounded p-3 border border-purple-100">
                            <div class="font-semibold text-purple-900 mb-2 flex items-center">
                                <span class="mr-2">⚡</span>
                                指数移动平均（EMA）
                            </div>
                            <div class="text-gray-700 space-y-1">
                                <p><strong>算法：</strong>Exponential Moving Average</p>
                                <p><strong>公式：</strong><code class="bg-gray-100 px-1 py-0.5 rounded">EMA<sub>t</sub> = α × Value<sub>t</sub> + (1-α) × EMA<sub>t-1</sub></code></p>
                                <p><strong>权重系数：</strong><code class="bg-gray-100 px-1 py-0.5 rounded">α = 2/(N+1)</code>，其中N为周期窗口</p>
                                <p><strong>特点：</strong>对近期数据赋予更高权重，反应更灵敏，比SMA更能捕捉趋势变化</p>
                            </div>
                        </div>
                        <div class="bg-white rounded p-3 border border-purple-100">
                            <div class="font-semibold text-orange-900 mb-2 flex items-center">
                                <span class="mr-2">🔍</span>
                                异常值检测
                            </div>
                            <div class="text-gray-700 space-y-1">
                                <p><strong>方法1 - 3σ原则：</strong><code class="bg-gray-100 px-1 py-0.5 rounded">|x - μ| > 3σ</code></p>
                                <p><strong>方法2 - IQR方法：</strong><code class="bg-gray-100 px-1 py-0.5 rounded">x < Q1-1.5×IQR 或 x > Q3+1.5×IQR</code></p>
                                <p><strong>说明：</strong>结合两种方法识别离群点，其中μ为均值，σ为标准差，IQR为四分位距</p>
                            </div>
                        </div>
                    </div>
                </details>

                <!-- 高级趋势分析 -->
                <div class="bg-white rounded-lg border p-3">
                    <h4 class="font-semibold text-gray-800 mb-3 text-sm">📊 高级趋势分析</h4>
                    <div class="grid grid-cols-3 gap-3">
                        <!-- 线性回归 -->
                        <div class="bg-blue-50 rounded p-3 border border-blue-200">
                            <div class="text-xs font-semibold text-blue-800 mb-2">📈 线性回归</div>
                            <div class="space-y-1 text-xs">
                                <div class="flex justify-between">
                                    <span>趋势:</span>
                                    <span class="font-bold ${regression.trend === 'rise' ? 'text-green-600' : regression.trend === 'decline' ? 'text-red-600' : 'text-gray-600'}">
                                        ${regression.trend === 'rise' ? '↗' : regression.trend === 'decline' ? '↘' : '→'}
                                    </span>
                                </div>
                                <div class="flex justify-between">
                                    <span>斜率:</span>
                                    <span class="font-mono">${(regression.slope || 0).toFixed(3)}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span>R²:</span>
                                    <span class="font-mono font-semibold">${(regression.r2 || 0).toFixed(3)}</span>
                                </div>
                            </div>
                        </div>

                        <!-- EMA分析 -->
                        <div class="bg-purple-50 rounded p-3 border border-purple-200">
                            <div class="text-xs font-semibold text-purple-800 mb-2">⚡ EMA平滑</div>
                            <div class="space-y-1 text-xs">
                                <div class="flex justify-between">
                                    <span>EMA:</span>
                                    <span class="font-mono">${(ema[ema.length - 1] || 0).toFixed(1)}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span>实际:</span>
                                    <span class="font-mono">${(totalTrend[totalTrend.length - 1] || 0).toFixed(1)}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span>偏离:</span>
                                    <span class="font-mono ${ema.length > 0 && Math.abs(totalTrend[totalTrend.length - 1] - ema[ema.length - 1]) / ema[ema.length - 1] > 0.2 ? 'text-red-600 font-bold' : 'text-green-600'}">
                                        ${ema.length > 0 ? ((Math.abs(totalTrend[totalTrend.length - 1] - ema[ema.length - 1]) / ema[ema.length - 1]) * 100).toFixed(1) : '0'}%
                                    </span>
                                </div>
                            </div>
                        </div>

                        <!-- 异常检测 -->
                        <div class="bg-orange-50 rounded p-3 border border-orange-200">
                            <div class="text-xs font-semibold text-orange-800 mb-2">🔍 异常检测</div>
                            <div class="space-y-1 text-xs">
                                <div class="flex justify-between">
                                    <span>异常数:</span>
                                    <span class="font-bold ${(outliers.indices?.length || 0) > 0 ? 'text-orange-600' : 'text-green-600'}">
                                        ${outliers.indices?.length || 0}
                                    </span>
                                </div>
                                <div class="flex justify-between">
                                    <span>比例:</span>
                                    <span class="font-mono">${(outliers.percentage || 0).toFixed(1)}%</span>
                                </div>
                                <div class="flex justify-between">
                                    <span>稳定性:</span>
                                    <span class="font-bold ${(outliers.percentage || 0) < 5 ? 'text-green-600' : 'text-orange-600'}">
                                        ${(outliers.percentage || 0) < 5 ? '优' : '中'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                    ${consecutiveDeclines.length > 0 ? `
                        <div class="mt-3 bg-red-50 border-l-4 border-red-500 p-2 rounded text-xs">
                            <span class="font-bold text-red-800">⚠️ 连续下滑预警: </span>
                            <span class="text-red-700">检测到 ${consecutiveDeclines.length} 个区间</span>
                        </div>
                    ` : ''}
                </div>

                <!-- 趋势预测 -->
                <div class="bg-white rounded-lg border p-3">
                    <h4 class="font-semibold text-gray-800 mb-2 text-sm">🔮 趋势预测</h4>
                    <div class="grid grid-cols-2 gap-3 text-xs">
                        <div class="bg-gray-50 rounded p-2">
                            <div class="space-y-1">
                                <div class="flex justify-between">
                                    <span>周期数:</span>
                                    <span class="font-bold">${forecast.predictions?.length || 0}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span>置信度:</span>
                                    <span class="font-bold ${forecast.confidence > 0.7 ? 'text-green-600' : forecast.confidence > 0.4 ? 'text-yellow-600' : 'text-red-600'}">
                                        ${((forecast.confidence || 0) * 100).toFixed(0)}%
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div class="bg-gray-50 rounded p-2">
                            <div class="font-semibold mb-1">预测值</div>
                            ${forecast.predictions && forecast.predictions.length > 0 ?
                                forecast.predictions.map((pred, i) => {
                                    const value = typeof pred === 'number' ? pred : (pred.value || pred);
                                    return `<div class="flex justify-between"><span>期${i + 1}:</span><span class="font-mono font-bold">${value.toFixed(1)}</span></div>`;
                                }).join('')
                            : '<div class="text-gray-500">无</div>'}
                        </div>
                    </div>
                    <div class="mt-2 text-xs text-gray-600 bg-blue-50 p-2 rounded">
                        💡 置信度: R²&gt;0.7(高) | 0.4-0.7(中) | &lt;0.4(低)
                    </div>
                </div>

                <!-- Mann-Kendall检验 + 客户分布 -->
                <div class="grid grid-cols-2 gap-3">
                    <div class="bg-white rounded-lg border p-3">
                        <h4 class="font-semibold text-gray-800 mb-2 text-sm">📐 Mann-Kendall检验</h4>
                        <div class="grid grid-cols-3 gap-2 text-center text-xs">
                            <div class="bg-gray-50 rounded p-2">
                                <div class="text-gray-600 mb-1">Z值</div>
                                <div class="font-mono font-bold">${(significance.z || 0).toFixed(2)}</div>
                            </div>
                            <div class="bg-gray-50 rounded p-2">
                                <div class="text-gray-600 mb-1">P值</div>
                                <div class="font-mono font-bold">${(significance.p || 0).toFixed(3)}</div>
                            </div>
                            <div class="bg-gray-50 rounded p-2">
                                <div class="text-gray-600 mb-1">显著</div>
                                <div class="font-bold ${significance.isSignificant ? 'text-red-600' : 'text-green-600'}">
                                    ${significance.isSignificant ? '是' : '否'}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="bg-white rounded-lg border p-3">
                        <h4 class="font-semibold text-gray-800 mb-2 text-sm">👥 客户健康分布</h4>
                        <canvas id="healthDistributionChart" style="height: 120px;"></canvas>
                    </div>
                </div>
            </div>
        `;

        // 渲染健康分布图
        setTimeout(() => {
            this.renderHealthDistributionChart(customers);
        }, 100);
    }

    /**
     * 渲染健康分布图
     */
    renderHealthDistributionChart(customers) {
        const canvas = document.getElementById('healthDistributionChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        // 销毁旧图表
        if (this.charts.overviewDetail) {
            this.charts.overviewDetail.destroy();
        }

        // 统计各分数段的客户数
        const bins = [0, 20, 40, 60, 80, 100];
        const binCounts = Array(bins.length - 1).fill(0);
        const binLabels = bins.slice(0, -1).map((bin, i) => `${bin}-${bins[i + 1]}`);

        customers.forEach(([_, analysis]) => {
            const score = analysis.comprehensiveAnalysis.score;
            for (let i = 0; i < bins.length - 1; i++) {
                if (score >= bins[i] && score < bins[i + 1]) {
                    binCounts[i]++;
                    break;
                }
            }
        });

        this.charts.overviewDetail = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: binLabels,
                datasets: [{
                    label: '客户数量',
                    data: binCounts,
                    backgroundColor: [
                        'rgba(239, 68, 68, 0.7)',   // 0-20
                        'rgba(249, 115, 22, 0.7)',  // 20-40
                        'rgba(234, 179, 8, 0.7)',   // 40-60
                        'rgba(34, 197, 94, 0.7)',   // 60-80
                        'rgba(22, 163, 74, 0.7)'    // 80-100
                    ],
                    borderColor: [
                        'rgb(239, 68, 68)',
                        'rgb(249, 115, 22)',
                        'rgb(234, 179, 8)',
                        'rgb(34, 197, 94)',
                        'rgb(22, 163, 74)'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => `客户数: ${context.parsed.y}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 },
                        title: {
                            display: true,
                            text: '客户数量'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: '健康评分区间'
                        }
                    }
                }
            }
        });
    }

    /**
     * 渲染总体趋势分析与预测详情
     */
    renderTrendDetail(container) {
        const regression = this.analysisData.linearRegression || {};
        const forecast = this.analysisData.forecast || {};
        const significance = this.analysisData.significance || {};
        const consecutiveDeclines = this.analysisData.consecutiveDeclines || [];

        // 趋势评估
        const trend = regression.trend || 'stable';
        const trendLabels = {
            rise: { emoji: '📈', text: '上升趋势', color: 'text-green-600', bg: 'bg-green-100' },
            decline: { emoji: '📉', text: '下降趋势', color: 'text-red-600', bg: 'bg-red-100' },
            stable: { emoji: '➡️', text: '平稳趋势', color: 'text-gray-600', bg: 'bg-gray-100' }
        };
        const trendInfo = trendLabels[trend] || trendLabels.stable;

        container.innerHTML = `
            <div class="space-y-6">
                <!-- 趋势概览 -->
                <div class="${trendInfo.bg} rounded-lg p-6 text-center">
                    <div class="text-5xl mb-3">${trendInfo.emoji}</div>
                    <div class="text-2xl font-bold ${trendInfo.color} mb-2">${trendInfo.text}</div>
                    <div class="text-sm ${trendInfo.color}">斜率: ${(regression.slope || 0).toFixed(4)}</div>
                </div>

                <!-- 趋势分析指标 -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="bg-gray-50 rounded-lg p-4">
                        <h4 class="font-semibold text-gray-800 mb-3">统计显著性</h4>
                        <div class="space-y-2">
                            <div class="flex justify-between">
                                <span class="text-sm">Mann-Kendall Z值:</span>
                                <span class="font-bold">${(significance.z || 0).toFixed(3)}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-sm">P值:</span>
                                <span class="font-bold">${(significance.p || 0).toFixed(4)}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-sm">趋势显著:</span>
                                <span class="font-bold ${significance.isSignificant ? 'text-red-600' : 'text-green-600'}">
                                    ${significance.isSignificant ? '是' : '否'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div class="bg-gray-50 rounded-lg p-4">
                        <h4 class="font-semibold text-gray-800 mb-3">预测能力</h4>
                        <div class="space-y-2">
                            <div class="flex justify-between">
                                <span class="text-sm">预测周期数:</span>
                                <span class="font-bold">${forecast.predictions?.length || 0}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-sm">置信度:</span>
                                <span class="font-bold">${((forecast.confidence || 0) * 100).toFixed(1)}%</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-sm">连续下滑次数:</span>
                                <span class="font-bold ${consecutiveDeclines.length > 0 ? 'text-red-600' : 'text-green-600'}">
                                    ${consecutiveDeclines.length}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- EMA平滑趋势图 -->
                <div class="bg-gray-50 rounded-lg p-4">
                    <div class="flex items-center justify-between mb-4">
                        <h4 class="font-semibold text-gray-800">EMA平滑趋势与预测</h4>
                        <label class="flex items-center space-x-2">
                            <input type="checkbox" id="showTrendDetailLabels" class="rounded">
                            <span class="text-sm">显示数据标签</span>
                        </label>
                    </div>
                    <canvas id="trendDetailChart" style="max-height: 400px;"></canvas>
                </div>

                <!-- 下载按钮 -->
                <div class="flex justify-end space-x-2">
                    <button id="downloadTrendChart" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm">
                        📊 下载图表
                    </button>
                    <button id="downloadTrendData" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm">
                        📥 下载数据
                    </button>
                </div>
            </div>
        `;

        // 渲染图表
        setTimeout(() => {
            this.renderTrendDetailChart();
            this.bindTrendDetailToolbar();
        }, 100);
    }

    /**
     * 渲染趋势详情图表
     */
    renderTrendDetailChart() {
        const canvas = document.getElementById('trendDetailChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        // 销毁旧图表
        if (this.charts.overviewDetail) {
            this.charts.overviewDetail.destroy();
        }

        const totalTrend = this.analysisData.totalTrend;
        const ema = this.analysisData.ema;
        const forecast = this.analysisData.forecast || {};
        const periods = this.analysisData.periods;

        // 构建预测周期标签
        const forecastLabels = (forecast.predictions || []).map((_, i) => `预测${i + 1}`);
        const allLabels = [...periods, ...forecastLabels];

        // 构建数据集
        const datasets = [
            {
                label: '实际值',
                data: [...totalTrend, ...Array(forecast.predictions?.length || 0).fill(null)],
                borderColor: 'rgb(59, 130, 246)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                datalabels: {
                    display: false,
                    align: 'top',
                    color: 'rgb(59, 130, 246)',
                    font: { weight: 'bold', size: 10 }
                }
            },
            {
                label: `EMA(${this.currentFilters.movingAvgWindow}期)`,
                data: [...ema, ...Array(forecast.predictions?.length || 0).fill(null)],
                borderColor: 'rgb(239, 68, 68)',
                backgroundColor: 'transparent',
                borderWidth: 2,
                borderDash: [5, 5],
                fill: false,
                tension: 0.4,
                pointRadius: 3,
                datalabels: {
                    display: false,
                    align: 'bottom',
                    color: 'rgb(239, 68, 68)',
                    font: { weight: 'bold', size: 10 }
                }
            }
        ];

        // 添加预测线
        if (forecast.predictions && forecast.predictions.length > 0) {
            datasets.push({
                label: '预测值',
                data: [...Array(totalTrend.length).fill(null), ...forecast.predictions],
                borderColor: 'rgb(168, 85, 247)',
                backgroundColor: 'rgba(168, 85, 247, 0.1)',
                borderWidth: 2,
                borderDash: [10, 5],
                fill: false,
                tension: 0.4,
                pointRadius: 5,
                pointStyle: 'triangle',
                datalabels: {
                    display: false,
                    align: 'top',
                    color: 'rgb(168, 85, 247)',
                    font: { weight: 'bold', size: 10 }
                }
            });
        }

        this.charts.overviewDetail = new Chart(ctx, {
            type: 'line',
            data: {
                labels: allLabels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const label = context.dataset.label || '';
                                const value = context.parsed.y;
                                return value !== null ? `${label}: ${value.toFixed(2)}` : null;
                            }
                        }
                    },
                    datalabels: {
                        display: false
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
                            text: '统计周期'
                        }
                    }
                }
            },
            plugins: [ChartDataLabels]
        });
    }

    /**
     * 绑定趋势详情工具栏事件
     */
    bindTrendDetailToolbar() {
        // 数据标签切换
        const checkbox = document.getElementById('showTrendDetailLabels');
        if (checkbox) {
            const newCheckbox = checkbox.cloneNode(true);
            checkbox.parentNode.replaceChild(newCheckbox, checkbox);

            newCheckbox.addEventListener('change', (e) => {
                if (this.charts.overviewDetail) {
                    this.charts.overviewDetail.data.datasets.forEach(dataset => {
                        if (dataset.datalabels) {
                            dataset.datalabels.display = e.target.checked;
                        }
                    });
                    this.charts.overviewDetail.update();
                }
            });
        }

        // 下载图表
        const downloadChartBtn = document.getElementById('downloadTrendChart');
        if (downloadChartBtn) {
            const newBtn = downloadChartBtn.cloneNode(true);
            downloadChartBtn.parentNode.replaceChild(newBtn, downloadChartBtn);

            newBtn.addEventListener('click', () => {
                if (this.charts.overviewDetail) {
                    const link = document.createElement('a');
                    link.download = `趋势分析与预测_${new Date().toLocaleDateString()}.png`;
                    link.href = this.charts.overviewDetail.toBase64Image();
                    link.click();
                }
            });
        }

        // 下载数据
        const downloadDataBtn = document.getElementById('downloadTrendData');
        if (downloadDataBtn) {
            const newBtn = downloadDataBtn.cloneNode(true);
            downloadDataBtn.parentNode.replaceChild(newBtn, downloadDataBtn);

            newBtn.addEventListener('click', () => {
                const periods = this.analysisData.periods;
                const values = this.analysisData.totalTrend;
                const ema = this.analysisData.ema;
                const forecast = this.analysisData.forecast || {};

                let csv = 'Period,Value,EMA,Forecast\n';

                // 历史数据
                periods.forEach((period, index) => {
                    csv += `${period},${values[index]},${ema[index] || ''},\n`;
                });

                // 预测数据
                if (forecast.predictions) {
                    forecast.predictions.forEach((pred, index) => {
                        csv += `预测${index + 1},,,${pred.toFixed(2)}\n`;
                    });
                }

                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.download = `趋势分析与预测_${new Date().toLocaleDateString()}.csv`;
                link.href = URL.createObjectURL(blob);
                link.click();
            });
        }
    }

    /**
     * 渲染客户详情图表
     */
    renderCustomerDetailChart(customerName, analysis) {
        const canvas = document.getElementById('customerDetailChart');
        const ctx = canvas.getContext('2d');

        // 销毁旧图表
        if (this.charts.customerDetail) {
            this.charts.customerDetail.destroy();
        }

        // 构建数据集
        const datasets = [
            // 客户实际值
            {
                label: `实际计划ID数`,
                data: analysis.values,
                borderColor: 'rgb(59, 130, 246)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6,
                order: 1,
                datalabels: {
                    display: false,
                    align: 'top',
                    color: 'rgb(59, 130, 246)',
                    font: { size: 10, weight: 'bold' }
                }
            },
            // 客户EMA
            {
                label: `EMA平滑线(${this.currentFilters.movingAvgWindow}期)`,
                data: analysis.ema,
                borderColor: 'rgb(239, 68, 68)',
                backgroundColor: 'rgba(239, 68, 68, 0)',
                borderWidth: 2,
                borderDash: [5, 5],
                fill: false,
                tension: 0.4,
                pointRadius: 0,
                order: 2,
                datalabels: {
                    display: false,
                    align: 'bottom',
                    color: 'rgb(239, 68, 68)',
                    font: { size: 9, weight: 'bold' }
                }
            }
        ];

        this.charts.customerDetail = new Chart(ctx, {
            type: 'line',
            data: {
                labels: this.analysisData.periods,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += Math.round(context.parsed.y * 100) / 100;
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: '计划ID数'
                        },
                        ticks: {
                            callback: function(value) {
                                return Math.round(value);
                            }
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: '时间周期'
                        }
                    }
                }
            },
            plugins: [ChartDataLabels]
        });
    }

    /**
     * 绑定客户详情工具栏事件
     */
    bindCustomerDetailToolbar(customerName, analysis) {
        // 显示数据标签复选框
        const labelCheckbox = document.getElementById('showCustomerDetailLabels');
        if (labelCheckbox) {
            // 移除旧事件监听器
            const newCheckbox = labelCheckbox.cloneNode(true);
            labelCheckbox.parentNode.replaceChild(newCheckbox, labelCheckbox);

            newCheckbox.addEventListener('change', (e) => {
                if (this.charts.customerDetail) {
                    // 遍历所有数据集，包括EMA平滑线
                    this.charts.customerDetail.data.datasets.forEach(dataset => {
                        if (dataset.datalabels) {
                            dataset.datalabels.display = e.target.checked;
                        }
                    });
                    this.charts.customerDetail.update();
                }
            });
        }

        // 下载图表按钮
        const downloadChartBtn = document.getElementById('downloadCustomerChart');
        if (downloadChartBtn) {
            const newBtn = downloadChartBtn.cloneNode(true);
            downloadChartBtn.parentNode.replaceChild(newBtn, downloadChartBtn);

            newBtn.addEventListener('click', () => {
                if (this.charts.customerDetail) {
                    const timestamp = new Date().toISOString().split('T')[0];
                    downloadChartAsImage(this.charts.customerDetail, `${customerName}_趋势图_${timestamp}.png`);
                }
            });
        }

        // 下载数据按钮
        const downloadDataBtn = document.getElementById('downloadCustomerData');
        if (downloadDataBtn) {
            const newBtn = downloadDataBtn.cloneNode(true);
            downloadDataBtn.parentNode.replaceChild(newBtn, downloadDataBtn);

            newBtn.addEventListener('click', () => {
                const periods = this.analysisData.periods;
                const values = analysis.values;
                const ema = analysis.ema;

                const data = periods.map((period, index) => ({
                    周期: period,
                    实际计划ID数: values[index],
                    EMA: formatNumber(ema[index], 2)
                }));

                const timestamp = new Date().toISOString().split('T')[0];
                exportToCSV(data, `${customerName}_数据_${timestamp}.csv`);
            });
        }
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
     * 切换说明面板（通用）
     */
    toggleInfoPanel(panelId, buttonId) {
        const panel = document.getElementById(panelId);
        const button = document.getElementById(buttonId);

        if (!panel || !button) return;

        const isHidden = panel.classList.contains('hidden');
        const buttonText = button.querySelector('span');

        if (isHidden) {
            panel.classList.remove('hidden');
            // 添加平滑展开动画
            panel.style.opacity = '0';
            panel.style.transform = 'translateY(-10px)';
            setTimeout(() => {
                panel.style.transition = 'all 0.3s ease-out';
                panel.style.opacity = '1';
                panel.style.transform = 'translateY(0)';
            }, 10);

            // 更新按钮文字
            if (buttonText) buttonText.textContent = '隐藏说明';
        } else {
            panel.style.transition = 'all 0.2s ease-in';
            panel.style.opacity = '0';
            panel.style.transform = 'translateY(-10px)';
            setTimeout(() => {
                panel.classList.add('hidden');
                panel.style.transition = '';
            }, 200);

            // 更新按钮文字（根据不同按钮恢复原文字）
            if (buttonText) {
                const defaultTexts = {
                    'toggleMetricsInfo': '指标说明',
                    'toggleComprehensiveInfo': '评分说明',
                    'toggleAdvancedInfo': '算法说明',
                    'toggleForecastInfo': '预测说明',
                    'toggleCorrelationInfo': '分析说明'
                };
                buttonText.textContent = defaultTexts[buttonId] || '说明';
            }
        }
    }

    /**
     * ========================================
     * 新增渲染函数
     * ========================================
     */

    /**
     * 渲染季节性与客户关联分析
     */
    renderSeasonalityAndCorrelation() {
        // 1. 渲染季节性分析
        const seasonalityContainer = document.getElementById('seasonalityResult');
        if (seasonalityContainer) {
            const seasonality = this.analysisData.seasonality;
            if (seasonality) {
                const strengthConfig = {
                    'strong': { color: 'green', icon: '✓✓✓', label: '强周期性' },
                    'moderate': { color: 'yellow', icon: '✓✓', label: '中等周期性' },
                    'weak': { color: 'blue', icon: '✓', label: '弱周期性' },
                    'none': { color: 'gray', icon: '✗', label: '无周期性' }
                };

                const config = strengthConfig[seasonality.strength] || strengthConfig['none'];

                seasonalityContainer.innerHTML = `
                    <div class="font-semibold text-cyan-800 mb-3 flex items-center">
                        <span class="text-2xl mr-2">📅</span>
                        <span>季节性检测</span>
                    </div>
                    <div class="space-y-3 text-sm">
                        <div class="flex justify-between items-center">
                            <span class="text-gray-700">周期性:</span>
                            <span class="px-3 py-1 rounded-full bg-${config.color}-100 text-${config.color}-700 font-semibold text-xs">
                                ${config.icon} ${config.label}
                            </span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-700">检测周期:</span>
                            <span class="font-mono">${seasonality.period}期</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-700">自相关系数:</span>
                            <span class="font-mono">${formatNumber(seasonality.autocorrelation, 3)}</span>
                        </div>
                        <div class="mt-3 pt-3 border-t border-cyan-300">
                            <div class="text-xs text-gray-600">
                                ${seasonality.message}
                            </div>
                        </div>
                    </div>
                `;
            }
        }

        // 2. 渲染客户相关性分析
        const correlationContainer = document.getElementById('customerCorrelationResult');
        if (correlationContainer) {
            const correlations = this.analysisData.customerCorrelation;

            if (!correlations || correlations.length === 0) {
                correlationContainer.innerHTML = `
                    <div class="font-semibold text-pink-800 mb-3 flex items-center">
                        <span class="text-2xl mr-2">🤝</span>
                        <span>客户相关性分析</span>
                    </div>
                    <div class="text-sm text-gray-600 text-center py-4">
                        未发现显著相关的客户对（|r|>0.6）
                    </div>
                `;
                return;
            }

            correlationContainer.innerHTML = `
                <div class="font-semibold text-pink-800 mb-3 flex items-center">
                    <span class="text-2xl mr-2">🤝</span>
                    <span>客户相关性分析</span>
                </div>
                <div class="text-xs text-gray-600 mb-2">发现 ${correlations.length} 对强相关客户:</div>
                <div class="space-y-2 max-h-48 overflow-y-auto">
                    ${correlations.slice(0, 5).map(corr => `
                        <div class="bg-white rounded p-2 border ${corr.type === 'positive' ? 'border-blue-200' : 'border-red-200'}">
                            <div class="flex justify-between items-start mb-1">
                                <div class="flex-1 text-xs">
                                    <div class="font-semibold text-gray-800">${corr.customer1}</div>
                                    <div class="text-gray-600">${corr.customer2}</div>
                                </div>
                                <div class="text-right">
                                    <div class="font-mono text-xs font-semibold ${corr.type === 'positive' ? 'text-blue-600' : 'text-red-600'}">
                                        r=${formatNumber(corr.correlation, 3)}
                                    </div>
                                    <div class="text-xs ${corr.type === 'positive' ? 'text-blue-600' : 'text-red-600'}">
                                        ${corr.type === 'positive' ? '↗️ 正相关' : '↘️ 负相关'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                    ${correlations.length > 5 ? `<div class="text-xs text-center text-gray-500 py-1">还有 ${correlations.length - 5} 对...</div>` : ''}
                </div>
            `;
        }
    }

    /**
     * 渲染趋势贡献分解分析
     */
    renderTrendContributionDecomposition() {
        const container = document.getElementById('trendContributionDecomposition');
        if (!container) return;

        // 获取总体趋势变化量
        const totalSlope = this.analysisData.linearRegression?.slope || 0;
        const totalPeriods = this.analysisData.totalTrend.length - 1;
        const totalChange = totalSlope * totalPeriods; // 总变化量

        // 计算每个客户的趋势贡献
        const customerContributions = [];

        Object.entries(this.analysisData.customerAnalysis).forEach(([customer, analysis]) => {
            const trendSlope = analysis.linearRegression?.slope || 0;
            const customerPeriods = analysis.values.length - 1;
            const customerChange = trendSlope * customerPeriods;

            // 贡献百分比
            const contributionPercent = totalChange !== 0 ? (customerChange / totalChange) * 100 : 0;

            customerContributions.push({
                name: customer,
                change: customerChange,
                contributionPercent: contributionPercent,
                slope: trendSlope,
                trend: analysis.linearRegression?.trend || 'stable',
                avgValue: analysis.statistics.avg
            });
        });

        // 按贡献量排序（下降贡献排前面）
        customerContributions.sort((a, b) => a.change - b.change);

        // 验证：所有客户变化量之和
        const sumCustomerChanges = customerContributions.reduce((sum, c) => sum + c.change, 0);

        // 分类客户
        const decliningCustomers = customerContributions.filter(c => c.change < 0);
        const risingCustomers = customerContributions.filter(c => c.change > 0);
        const stableCustomers = customerContributions.filter(c => c.change === 0);

        // 计算总下降量和总上升量
        const totalDecline = decliningCustomers.reduce((sum, c) => sum + Math.abs(c.change), 0);
        const totalRise = risingCustomers.reduce((sum, c) => sum + c.change, 0);

        container.innerHTML = `
            <!-- 算法说明 -->
            <details class="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg mb-4">
                <summary class="cursor-pointer px-4 py-3 font-semibold text-blue-900 hover:bg-blue-100 rounded-lg transition-colors flex items-center justify-between">
                    <span class="flex items-center">
                        <span class="text-lg mr-2">🔬</span>
                        <span>趋势贡献分解算法说明（点击展开）</span>
                    </span>
                    <svg class="w-5 h-5 transform transition-transform details-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                    </svg>
                </summary>
                <div class="px-4 pb-4 pt-2 space-y-3 text-sm">
                    <div class="bg-white rounded-lg p-3 border border-blue-200">
                        <div class="font-semibold text-blue-900 mb-2">💡 核心思想</div>
                        <div class="text-xs text-gray-700 space-y-1">
                            <p>通过线性回归分析，将总体趋势变化<strong>精确分解</strong>到每个客户，使得：</p>
                            <div class="font-mono bg-blue-100 text-blue-800 px-3 py-2 rounded border border-blue-300 mt-2">
                                所有客户的变化量之和 = 总体趋势变化量
                            </div>
                        </div>
                    </div>

                    <div class="bg-white rounded-lg p-3 border border-blue-200">
                        <div class="font-semibold text-blue-900 mb-2">📐 线性回归斜率说明</div>
                        <div class="space-y-2 text-xs">
                            <div class="text-gray-700">
                                <p class="mb-2">斜率（slope）通过<strong>最小二乘法线性回归</strong>计算得出，表示每个时间周期的平均变化率：</p>
                                <div class="font-mono bg-blue-100 text-blue-800 px-3 py-2 rounded border border-blue-300">
                                    y = a + bx  （其中 b 就是斜率）
                                </div>
                                <div class="mt-2 space-y-1 text-gray-600">
                                    <div>• <strong>斜率 > 0：</strong>趋势上升，每周期平均增长 |斜率| 个单位</div>
                                    <div>• <strong>斜率 &lt; 0：</strong>趋势下降，每周期平均减少 |斜率| 个单位</div>
                                    <div>• <strong>斜率 = 0：</strong>趋势平稳，无明显变化</div>
                                </div>
                                <div class="mt-2 bg-gradient-to-r from-yellow-50 to-orange-50 rounded p-2 border border-yellow-300">
                                    <div class="flex items-start">
                                        <span class="mr-1">💡</span>
                                        <span><strong>示例：</strong>如果客户斜率为-2.5，时间跨度20周期，则该客户在整个周期内下降了 -2.5 × 20 = -50 个单位</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="bg-white rounded-lg p-3 border border-blue-200">
                        <div class="font-semibold text-blue-900 mb-2">🔢 计算公式</div>
                        <div class="space-y-2 text-xs">
                            <div>
                                <strong>1. 线性回归斜率计算（最小二乘法）：</strong>
                                <div class="font-mono bg-blue-100 text-blue-800 px-3 py-2 rounded border border-blue-300 mt-1 text-center">
                                    斜率 = Σ[(xᵢ - x̄)(yᵢ - ȳ)] / Σ[(xᵢ - x̄)²]
                                </div>
                                <div class="text-gray-600 mt-1 pl-2">
                                    其中 x 是时间序列（0, 1, 2, ...），y 是对应的数值
                                </div>
                            </div>
                            <div>
                                <strong>2. 总体变化量：</strong>
                                <div class="font-mono bg-blue-100 text-blue-800 px-3 py-2 rounded border border-blue-300 mt-1">
                                    总变化量 = 总体斜率 × 时间跨度
                                </div>
                            </div>
                            <div>
                                <strong>3. 客户变化量：</strong>
                                <div class="font-mono bg-blue-100 text-blue-800 px-3 py-2 rounded border border-blue-300 mt-1">
                                    客户变化量 = 客户斜率 × 时间跨度
                                </div>
                            </div>
                            <div>
                                <strong>4. 贡献百分比：</strong>
                                <div class="font-mono bg-blue-100 text-blue-800 px-3 py-2 rounded border border-blue-300 mt-1">
                                    贡献% = (客户变化量 / 总变化量) × 100
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="bg-white rounded-lg p-3 border border-blue-200">
                        <div class="font-semibold text-blue-900 mb-2">🎯 算法优势</div>
                        <div class="text-xs text-gray-700 space-y-1">
                            <div class="flex items-start">
                                <span class="text-green-600 mr-2">✓</span>
                                <span><strong>精确分解：</strong>所有客户贡献加总后精确等于总体变化量，无遗漏无重复</span>
                            </div>
                            <div class="flex items-start">
                                <span class="text-green-600 mr-2">✓</span>
                                <span><strong>趋势量化：</strong>用具体数值（如-50、+30）直观显示每个客户对总趋势的影响</span>
                            </div>
                            <div class="flex items-start">
                                <span class="text-green-600 mr-2">✓</span>
                                <span><strong>优先级明确：</strong>快速识别对下滑贡献最大的客户，指导资源分配</span>
                            </div>
                        </div>
                    </div>
                </div>
            </details>

            <!-- 总体统计 -->
            <div class="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-lg p-4 mb-4">
                <div class="text-lg font-bold text-purple-900 mb-3 flex items-center">
                    <span class="text-2xl mr-2">📊</span>
                    <span>总体趋势变化统计</span>
                </div>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div class="bg-white rounded-lg p-3 border border-purple-200 text-center">
                        <div class="text-xs text-gray-600 mb-1">总变化量</div>
                        <div class="text-xl font-bold ${totalChange < 0 ? 'text-red-600' : totalChange > 0 ? 'text-green-600' : 'text-gray-600'}">
                            ${formatNumber(totalChange, 1)}
                        </div>
                        <div class="text-xs text-gray-500 mt-1">${totalChange < 0 ? '📉 下降' : totalChange > 0 ? '📈 上升' : '➡️ 平稳'}</div>
                    </div>
                    <div class="bg-white rounded-lg p-3 border border-red-200 text-center">
                        <div class="text-xs text-gray-600 mb-1">总下降贡献</div>
                        <div class="text-xl font-bold text-red-600">
                            ${formatNumber(totalDecline, 1)}
                        </div>
                        <div class="text-xs text-gray-500 mt-1">${decliningCustomers.length} 个客户</div>
                    </div>
                    <div class="bg-white rounded-lg p-3 border border-green-200 text-center">
                        <div class="text-xs text-gray-600 mb-1">总上升贡献</div>
                        <div class="text-xl font-bold text-green-600">
                            ${formatNumber(totalRise, 1)}
                        </div>
                        <div class="text-xs text-gray-500 mt-1">${risingCustomers.length} 个客户</div>
                    </div>
                    <div class="bg-white rounded-lg p-3 border border-blue-200 text-center">
                        <div class="text-xs text-gray-600 mb-1">验证和</div>
                        <div class="text-xl font-bold text-blue-600">
                            ${formatNumber(sumCustomerChanges, 1)}
                        </div>
                        <div class="text-xs ${Math.abs(sumCustomerChanges - totalChange) < 0.1 ? 'text-green-600' : 'text-red-600'} mt-1">
                            ${Math.abs(sumCustomerChanges - totalChange) < 0.1 ? '✓ 精确匹配' : '✗ 误差'}
                        </div>
                    </div>
                </div>
            </div>

            <!-- 下降贡献TOP榜 -->
            ${decliningCustomers.length > 0 ? `
            <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <h4 class="font-bold text-red-900 mb-3 flex items-center">
                    <span class="text-xl mr-2">📉</span>
                    <span>下降贡献 TOP ${Math.min(10, decliningCustomers.length)}</span>
                    <span class="ml-2 text-sm font-normal text-gray-600">（这些客户拖累了总体趋势）</span>
                </h4>
                <div class="space-y-2">
                    ${decliningCustomers.slice(0, 10).map((c, i) => `
                        <div class="bg-white rounded-lg p-3 border border-red-200 cursor-pointer hover:shadow-lg hover:border-red-300 transition-all customer-detail-card" data-customer="${c.name}">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center flex-1">
                                    <span class="flex items-center justify-center w-6 h-6 rounded-full ${i < 3 ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700'} text-xs font-bold mr-3">
                                        ${i + 1}
                                    </span>
                                    <div class="flex-1">
                                        <div class="font-semibold text-gray-800">${c.name}</div>
                                        <div class="text-xs text-gray-600">平均值: ${formatNumber(c.avgValue, 1)} | 趋势斜率: ${formatNumber(c.slope, 3)}</div>
                                    </div>
                                </div>
                                <div class="text-right ml-3">
                                    <div class="text-lg font-bold text-red-600">${formatNumber(c.change, 1)}</div>
                                    <div class="text-xs text-gray-600">贡献 ${formatNumber(c.contributionPercent, 1)}%</div>
                                </div>
                            </div>
                            <div class="mt-2 pt-2 border-t border-red-100">
                                <div class="flex items-center justify-between text-xs">
                                    <span class="text-gray-500">📊 该客户在整个分析周期内下降了 ${formatNumber(Math.abs(c.change), 1)} 个单位</span>
                                    <span class="text-blue-500">👆 点击查看详情</span>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}

            <!-- 上升贡献TOP榜 -->
            ${risingCustomers.length > 0 ? `
            <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 class="font-bold text-green-900 mb-3 flex items-center">
                    <span class="text-xl mr-2">📈</span>
                    <span>上升贡献 TOP ${Math.min(10, risingCustomers.length)}</span>
                    <span class="ml-2 text-sm font-normal text-gray-600">（这些客户提升了总体趋势）</span>
                </h4>
                <div class="space-y-2">
                    ${risingCustomers.slice(0, 10).map((c, i) => `
                        <div class="bg-white rounded-lg p-3 border border-green-200 cursor-pointer hover:shadow-lg hover:border-green-300 transition-all customer-detail-card" data-customer="${c.name}">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center flex-1">
                                    <span class="flex items-center justify-center w-6 h-6 rounded-full ${i < 3 ? 'bg-green-600 text-white' : 'bg-green-100 text-green-700'} text-xs font-bold mr-3">
                                        ${i + 1}
                                    </span>
                                    <div class="flex-1">
                                        <div class="font-semibold text-gray-800">${c.name}</div>
                                        <div class="text-xs text-gray-600">平均值: ${formatNumber(c.avgValue, 1)} | 趋势斜率: ${formatNumber(c.slope, 3)}</div>
                                    </div>
                                </div>
                                <div class="text-right ml-3">
                                    <div class="text-lg font-bold text-green-600">+${formatNumber(c.change, 1)}</div>
                                    <div class="text-xs text-gray-600">贡献 ${formatNumber(c.contributionPercent, 1)}%</div>
                                </div>
                            </div>
                            <div class="mt-2 pt-2 border-t border-green-100">
                                <div class="flex items-center justify-between text-xs">
                                    <span class="text-gray-500">📊 该客户在整个分析周期内上升了 ${formatNumber(c.change, 1)} 个单位</span>
                                    <span class="text-blue-500">👆 点击查看详情</span>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}
        `;

        // 绑定点击事件
        setTimeout(() => {
            container.querySelectorAll('.customer-detail-card').forEach(card => {
                card.addEventListener('click', () => {
                    const customerName = card.getAttribute('data-customer');
                    if (customerName) {
                        this.openCustomerDetail(customerName);
                    }
                });
            });
        }, 50);
    }

    /**
     * ========================================
     * 新增：客户级别分析渲染函数
     * ========================================
     */

    /**
     * 渲染总体概览
     */
    renderOverallSummary() {
        const container = document.getElementById('overallSummary');
        if (!container) return;

        const analysis = this.analysisData.comprehensiveAnalysis;
        const regression = this.analysisData.linearRegression;
        const totalCustomers = Object.keys(this.analysisData.customerData).length;
        const totalValue = this.analysisData.totalTrend[this.analysisData.totalTrend.length - 1];

        container.innerHTML = `
            <div class="bg-white rounded-lg p-4 text-center">
                <div class="text-3xl font-bold text-indigo-700">${totalCustomers}</div>
                <div class="text-xs text-gray-600 mt-1">客户总数</div>
            </div>
            <div class="bg-white rounded-lg p-4 text-center cursor-pointer hover:shadow-lg hover:border-2 hover:border-purple-300 transition-all overview-card" data-type="total">
                <div class="text-3xl font-bold text-purple-700">${formatNumber(totalValue, 0)}</div>
                <div class="text-xs text-gray-600 mt-1">最新总计划ID数</div>
                <div class="text-xs text-gray-400 mt-1">👆 点击查看趋势</div>
            </div>
            <div class="bg-white rounded-lg p-4 text-center cursor-pointer hover:shadow-lg hover:border-2 hover:border-green-300 transition-all overview-card" data-type="health">
                <div class="text-3xl font-bold ${analysis.score >= 70 ? 'text-green-600' : analysis.score >= 50 ? 'text-blue-600' : analysis.score >= 30 ? 'text-yellow-600' : 'text-red-600'}">
                    ${analysis.score}分
                </div>
                <div class="text-xs text-gray-600 mt-1">综合健康度</div>
                <div class="text-xs text-gray-400 mt-1">👆 点击查看详情</div>
            </div>
            <div class="bg-white rounded-lg p-4 text-center cursor-pointer hover:shadow-lg hover:border-2 hover:border-red-300 transition-all overview-card" data-type="trend">
                <div class="text-2xl font-bold ${regression && regression.trend === 'increasing' ? 'text-green-600' : regression && regression.trend === 'decreasing' ? 'text-red-600' : 'text-gray-600'}">
                    ${regression ? (regression.trend === 'increasing' ? '📈 上升' : regression.trend === 'decreasing' ? '📉 下降' : '➡️ 平稳') : '--'}
                </div>
                <div class="text-xs text-gray-600 mt-1">总体趋势</div>
                <div class="text-xs text-gray-400 mt-1">👆 点击查看预测</div>
            </div>
        `;

        // 绑定点击事件（排除客户总数卡片）
        setTimeout(() => {
            document.querySelectorAll('.overview-card').forEach(card => {
                card.addEventListener('click', () => {
                    const type = card.getAttribute('data-type');
                    if (type !== 'customers') {
                        this.openOverviewDetail(type);
                    }
                });
            });
        }, 100);
    }

    /**
     * 渲染智能分析结论（新增）
     */
    renderAnalysisConclusion() {
        const container = document.getElementById('analysisConclusion');
        if (!container) return;

        // 分类客户
        const criticalCustomers = []; // 危急客户（0-29分）
        const warningCustomers = [];  // 预警客户（30-49分）
        const stableCustomers = [];   // 平稳客户（50-69分）
        const healthyCustomers = [];  // 健康客户（70-100分）

        Object.entries(this.analysisData.customerAnalysis).forEach(([customer, analysis]) => {
            const score = analysis.comprehensiveAnalysis.score;
            const avgContribution = analysis.statistics.avg;
            const trend = analysis.linearRegression?.trend || 'stable';
            const trendSlope = analysis.linearRegression?.slope || 0;

            const customerInfo = {
                name: customer,
                score: score,
                avgContribution: avgContribution,
                trend: trend,
                trendSlope: trendSlope,
                values: analysis.values,
                impact: avgContribution * (score < 50 ? (50 - score) / 50 : 0) // 影响量 = 贡献度 × 风险程度
            };

            if (score < 30) {
                criticalCustomers.push(customerInfo);
            } else if (score < 50) {
                warningCustomers.push(customerInfo);
            } else if (score < 70) {
                stableCustomers.push(customerInfo);
            } else {
                healthyCustomers.push(customerInfo);
            }
        });

        // 按影响量排序（影响大的排前面）
        criticalCustomers.sort((a, b) => b.impact - a.impact);
        warningCustomers.sort((a, b) => b.impact - a.impact);

        // 计算总影响量
        const totalImpact = [...criticalCustomers, ...warningCustomers].reduce((sum, c) => sum + c.impact, 0);
        const totalCustomers = Object.keys(this.analysisData.customerAnalysis).length;

        // 生成结论文本
        let conclusionText = '';
        let statusColor = 'green';
        let statusIcon = '✅';

        if (criticalCustomers.length > 0) {
            statusColor = 'red';
            statusIcon = '🚨';
            conclusionText = `发现 <strong>${criticalCustomers.length}</strong> 个危急客户，需要<strong>立即采取行动</strong>！`;
        } else if (warningCustomers.length > 0) {
            statusColor = 'yellow';
            statusIcon = '⚠️';
            conclusionText = `发现 <strong>${warningCustomers.length}</strong> 个预警客户，建议<strong>重点关注</strong>。`;
        } else if (stableCustomers.length > totalCustomers * 0.5) {
            statusColor = 'blue';
            statusIcon = '➡️';
            conclusionText = `大部分客户趋势平稳，持续监控即可。`;
        } else {
            statusColor = 'green';
            statusIcon = '✅';
            conclusionText = `所有客户健康状况良好，继续保持！`;
        }

        let html = `
            <!-- 总体结论 -->
            <div class="bg-${statusColor}-50 border-2 border-${statusColor}-200 rounded-lg p-4 mb-4">
                <div class="flex items-center justify-between mb-3">
                    <div class="flex items-center">
                        <span class="text-3xl mr-3">${statusIcon}</span>
                        <div>
                            <div class="text-lg font-bold text-${statusColor}-900">${conclusionText}</div>
                            <div class="text-sm text-${statusColor}-700 mt-1">
                                共分析 ${totalCustomers} 个客户，健康度分布：
                                <span class="text-red-600 font-semibold">${criticalCustomers.length} 危急</span> |
                                <span class="text-yellow-600 font-semibold">${warningCustomers.length} 预警</span> |
                                <span class="text-blue-600 font-semibold">${stableCustomers.length} 平稳</span> |
                                <span class="text-green-600 font-semibold">${healthyCustomers.length} 健康</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 影响量算法说明 -->
            <details class="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg mb-4">
                <summary class="cursor-pointer px-4 py-3 font-semibold text-indigo-900 hover:bg-indigo-100 rounded-lg transition-colors flex items-center justify-between">
                    <span class="flex items-center">
                        <span class="text-lg mr-2">📊</span>
                        <span>影响量计算算法说明（点击展开）</span>
                    </span>
                    <svg class="w-5 h-5 transform transition-transform details-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                    </svg>
                </summary>
                <div class="px-4 pb-4 pt-2 space-y-3 text-sm">
                    <div class="bg-white rounded-lg p-3 border border-indigo-200">
                        <div class="font-semibold text-indigo-900 mb-2">💡 核心公式</div>
                        <div class="font-mono bg-indigo-100 text-indigo-800 px-3 py-2 rounded border border-indigo-300">
                            影响量 = 平均贡献度 × 风险程度
                        </div>
                    </div>

                    <div class="bg-white rounded-lg p-3 border border-indigo-200">
                        <div class="font-semibold text-indigo-900 mb-2">📐 风险程度计算</div>
                        <div class="space-y-2">
                            <div class="font-mono bg-indigo-100 text-indigo-800 px-3 py-2 rounded border border-indigo-300">
                                风险程度 = (50 - 健康评分) / 50
                            </div>
                            <div class="text-xs text-gray-600 pl-2">
                                • 当健康评分 &lt; 50 分时，风险程度为正值（0-1之间）<br>
                                • 当健康评分 ≥ 50 分时，风险程度为 0（无风险）<br>
                                • 评分越低，风险程度越高
                            </div>
                        </div>
                    </div>

                    <div class="bg-white rounded-lg p-3 border border-indigo-200">
                        <div class="font-semibold text-indigo-900 mb-2">🎯 算法优势</div>
                        <div class="text-xs text-gray-700 space-y-1">
                            <div class="flex items-start">
                                <span class="text-green-600 mr-2">✓</span>
                                <span><strong>优先级排序：</strong>同时考虑客户的贡献度和健康状况，确保高贡献度且健康状况差的客户获得优先关注</span>
                            </div>
                            <div class="flex items-start">
                                <span class="text-green-600 mr-2">✓</span>
                                <span><strong>资源优化：</strong>帮助团队将有限的资源投入到最需要关注的客户上，提高运营效率</span>
                            </div>
                            <div class="flex items-start">
                                <span class="text-green-600 mr-2">✓</span>
                                <span><strong>风险量化：</strong>通过数值化的影响量指标，直观反映每个客户的风险等级和业务影响程度</span>
                            </div>
                        </div>
                    </div>

                    <div class="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg p-3 border border-yellow-300">
                        <div class="flex items-start">
                            <span class="text-xl mr-2">💡</span>
                            <div class="text-xs text-gray-700">
                                <strong class="text-yellow-900">示例：</strong>客户A贡献度100，健康评分30分，影响量 = 100 × (50-30)/50 = 40；
                                客户B贡献度80，健康评分10分，影响量 = 80 × (50-10)/50 = 64。
                                因此客户B虽然贡献度较低，但因健康状况更差，影响量更大，应优先处理。
                            </div>
                        </div>
                    </div>
                </div>
            </details>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        `;

        // 渲染危急客户列表
        if (criticalCustomers.length > 0) {
            html += `
                <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h4 class="font-bold text-red-900 mb-3 flex items-center justify-between">
                        <div class="flex items-center">
                            <span class="text-xl mr-2">🚨</span>
                            <span>危急客户 (<span id="criticalCustomerCount">${criticalCustomers.length}</span>个)</span>
                        </div>
                    </h4>

                    <!-- 搜索框 -->
                    <div class="mb-3">
                        <div class="filter-select" style="padding: 6px 10px;">
                            <div class="filter-input-area">
                                <svg class="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                                </svg>
                                <input type="text" placeholder="搜索危急客户..." id="searchCriticalCustomer" style="flex: 1; border: none; outline: none; background: transparent; font-size: 0.875rem;">
                            </div>
                        </div>
                    </div>

                    <div class="space-y-3" id="criticalCustomerList">
                        ${criticalCustomers.slice(0, 5).map((c, i) => `
                            <div class="bg-white rounded-lg p-3 border border-red-200 cursor-pointer hover:shadow-lg hover:border-red-300 transition-all customer-detail-card" data-customer="${c.name}">
                                <div class="flex items-center justify-between mb-2">
                                    <div>
                                        <span class="font-semibold text-gray-800">#${i + 1} ${c.name}</span>
                                        <span class="ml-2 text-xs bg-red-100 text-red-700 px-2 py-1 rounded">${c.score}分</span>
                                    </div>
                                    <div class="text-right">
                                        <div class="text-xs text-gray-600">平均贡献</div>
                                        <div class="font-bold text-red-700">${formatNumber(c.avgContribution, 1)}</div>
                                    </div>
                                </div>
                                <div class="flex items-center justify-between text-xs">
                                    <span class="text-gray-600">趋势：${c.trend === 'decreasing' ? '📉 下降' : c.trend === 'increasing' ? '📈 上升' : '➡️ 平稳'}</span>
                                    <span class="text-red-600 font-semibold">影响量：${formatNumber(c.impact, 1)}</span>
                                </div>
                                ${this.renderMiniSparkline(c.values, 'red')}
                                <div class="mt-2 text-center text-xs text-gray-500">👆 点击查看详情</div>
                            </div>
                        `).join('')}
                    </div>
                    ${criticalCustomers.length > 5 ? `
                        <button id="toggleCriticalCustomers" class="w-full mt-3 px-3 py-2 text-sm bg-white border border-red-300 text-red-700 rounded hover:bg-red-50 transition flex items-center justify-center">
                            <span id="toggleCriticalText">查看全部 ${criticalCustomers.length} 个客户</span>
                            <svg class="w-4 h-4 ml-1" id="toggleCriticalIcon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                            </svg>
                        </button>
                    ` : ''}
                </div>
            `;
        }

        // 渲染预警客户列表
        if (warningCustomers.length > 0) {
            html += `
                <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h4 class="font-bold text-yellow-900 mb-3 flex items-center justify-between">
                        <div class="flex items-center">
                            <span class="text-xl mr-2">⚠️</span>
                            <span>预警客户 (<span id="warningCustomerCount">${warningCustomers.length}</span>个)</span>
                        </div>
                    </h4>

                    <!-- 搜索框 -->
                    <div class="mb-3">
                        <div class="filter-select" style="padding: 6px 10px;">
                            <div class="filter-input-area">
                                <svg class="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                                </svg>
                                <input type="text" placeholder="搜索预警客户..." id="searchWarningCustomer" style="flex: 1; border: none; outline: none; background: transparent; font-size: 0.875rem;">
                            </div>
                        </div>
                    </div>

                    <div class="space-y-3" id="warningCustomerList">
                        ${warningCustomers.slice(0, 5).map((c, i) => `
                            <div class="bg-white rounded-lg p-3 border border-yellow-200 cursor-pointer hover:shadow-lg hover:border-yellow-300 transition-all customer-detail-card" data-customer="${c.name}">
                                <div class="flex items-center justify-between mb-2">
                                    <div>
                                        <span class="font-semibold text-gray-800">#${i + 1} ${c.name}</span>
                                        <span class="ml-2 text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">${c.score}分</span>
                                    </div>
                                    <div class="text-right">
                                        <div class="text-xs text-gray-600">平均贡献</div>
                                        <div class="font-bold text-yellow-700">${formatNumber(c.avgContribution, 1)}</div>
                                    </div>
                                </div>
                                <div class="flex items-center justify-between text-xs">
                                    <span class="text-gray-600">趋势：${c.trend === 'decreasing' ? '📉 下降' : c.trend === 'increasing' ? '📈 上升' : '➡️ 平稳'}</span>
                                    <span class="text-yellow-600 font-semibold">影响量：${formatNumber(c.impact, 1)}</span>
                                </div>
                                ${this.renderMiniSparkline(c.values, 'yellow')}
                                <div class="mt-2 text-center text-xs text-gray-500">👆 点击查看详情</div>
                            </div>
                        `).join('')}
                    </div>
                    ${warningCustomers.length > 5 ? `
                        <button id="toggleWarningCustomers" class="w-full mt-3 px-3 py-2 text-sm bg-white border border-yellow-300 text-yellow-700 rounded hover:bg-yellow-50 transition flex items-center justify-center">
                            <span id="toggleWarningText">查看全部 ${warningCustomers.length} 个客户</span>
                            <svg class="w-4 h-4 ml-1" id="toggleWarningIcon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                            </svg>
                        </button>
                    ` : ''}
                </div>
            `;
        }

        // 如果没有风险客户，显示健康状态总结
        if (criticalCustomers.length === 0 && warningCustomers.length === 0) {
            html += `
                <div class="bg-green-50 border border-green-200 rounded-lg p-4 col-span-2">
                    <h4 class="font-bold text-green-900 mb-3 flex items-center">
                        <span class="text-xl mr-2">✅</span>
                        客户健康状况总结
                    </h4>
                    <div class="grid grid-cols-2 gap-3">
                        <div class="bg-white rounded p-3 text-center">
                            <div class="text-3xl font-bold text-green-600">${healthyCustomers.length}</div>
                            <div class="text-xs text-gray-600 mt-1">健康客户 (≥70分)</div>
                        </div>
                        <div class="bg-white rounded p-3 text-center">
                            <div class="text-3xl font-bold text-blue-600">${stableCustomers.length}</div>
                            <div class="text-xs text-gray-600 mt-1">平稳客户 (50-69分)</div>
                        </div>
                    </div>
                    <p class="text-sm text-green-700 mt-3 text-center">所有客户趋势良好，无需特别关注 👍</p>
                </div>
            `;
        }

        html += `</div>`;

        container.innerHTML = html;

        // 添加点击事件监听器
        setTimeout(() => {
            const cards = document.querySelectorAll('.customer-detail-card');
            console.log(`🎯 找到 ${cards.length} 个客户卡片，准备绑定点击事件`);

            cards.forEach((card, index) => {
                const customerName = card.getAttribute('data-customer');
                console.log(`  📌 卡片 ${index + 1}: ${customerName}`);

                card.addEventListener('click', () => {
                    console.log(`🖱️ 点击了客户卡片: ${customerName}`);
                    if (customerName) {
                        this.openCustomerDetail(customerName);
                    }
                });
            });

            // 绑定搜索和展开功能
            this.bindCustomerSearchAndToggle(criticalCustomers, warningCustomers);
        }, 100);
    }

    /**
     * 绑定客户搜索和展开/收起功能
     */
    bindCustomerSearchAndToggle(criticalCustomers, warningCustomers) {
        // 危急客户搜索
        const searchCritical = document.getElementById('searchCriticalCustomer');
        if (searchCritical) {
            searchCritical.addEventListener('input', (e) => {
                const keyword = e.target.value.toLowerCase().trim();
                this.filterCustomerCards('critical', criticalCustomers, keyword);
            });

            // 支持删除键清空
            searchCritical.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    e.target.value = '';
                    this.filterCustomerCards('critical', criticalCustomers, '');
                }
            });
        }

        // 预警客户搜索
        const searchWarning = document.getElementById('searchWarningCustomer');
        if (searchWarning) {
            searchWarning.addEventListener('input', (e) => {
                const keyword = e.target.value.toLowerCase().trim();
                this.filterCustomerCards('warning', warningCustomers, keyword);
            });

            // 支持删除键清空
            searchWarning.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    e.target.value = '';
                    this.filterCustomerCards('warning', warningCustomers, '');
                }
            });
        }

        // 危急客户展开/收起
        const toggleCritical = document.getElementById('toggleCriticalCustomers');
        if (toggleCritical) {
            toggleCritical.addEventListener('click', () => {
                this.toggleCustomerList('critical', criticalCustomers);
            });
        }

        // 预警客户展开/收起
        const toggleWarning = document.getElementById('toggleWarningCustomers');
        if (toggleWarning) {
            toggleWarning.addEventListener('click', () => {
                this.toggleCustomerList('warning', warningCustomers);
            });
        }
    }

    /**
     * 过滤客户卡片
     */
    filterCustomerCards(type, customers, keyword) {
        const listId = type === 'critical' ? 'criticalCustomerList' : 'warningCustomerList';
        const countId = type === 'critical' ? 'criticalCustomerCount' : 'warningCustomerCount';
        const container = document.getElementById(listId);
        const countSpan = document.getElementById(countId);

        if (!container) return;

        // 过滤客户
        const filtered = keyword
            ? customers.filter(c => c.name.toLowerCase().includes(keyword))
            : customers;

        // 更新计数
        if (countSpan) {
            countSpan.textContent = filtered.length;
        }

        // 重新渲染列表
        const color = type === 'critical' ? 'red' : 'yellow';
        const expanded = this[`${type}Expanded`] || false;
        const displayCount = expanded ? filtered.length : Math.min(5, filtered.length);

        container.innerHTML = filtered.slice(0, displayCount).map((c, i) => `
            <div class="bg-white rounded-lg p-3 border border-${color}-200 cursor-pointer hover:shadow-lg hover:border-${color}-300 transition-all customer-detail-card" data-customer="${c.name}">
                <div class="flex items-center justify-between mb-2">
                    <div>
                        <span class="font-semibold text-gray-800">#${i + 1} ${c.name}</span>
                        <span class="ml-2 text-xs bg-${color}-100 text-${color}-700 px-2 py-1 rounded">${c.score}分</span>
                    </div>
                    <div class="text-right">
                        <div class="text-xs text-gray-600">平均贡献</div>
                        <div class="font-bold text-${color}-700">${formatNumber(c.avgContribution, 1)}</div>
                    </div>
                </div>
                <div class="flex items-center justify-between text-xs">
                    <span class="text-gray-600">趋势：${c.trend === 'decreasing' ? '📉 下降' : c.trend === 'increasing' ? '📈 上升' : '➡️ 平稳'}</span>
                    <span class="text-${color}-600 font-semibold">影响量：${formatNumber(c.impact, 1)}</span>
                </div>
                ${this.renderMiniSparkline(c.values, color)}
                <div class="mt-2 text-center text-xs text-gray-500">👆 点击查看详情</div>
            </div>
        `).join('');

        // 重新绑定点击事件
        setTimeout(() => {
            container.querySelectorAll('.customer-detail-card').forEach(card => {
                card.addEventListener('click', () => {
                    const customerName = card.getAttribute('data-customer');
                    if (customerName) {
                        this.openCustomerDetail(customerName);
                    }
                });
            });
        }, 50);
    }

    /**
     * 展开/收起客户列表
     */
    toggleCustomerList(type, customers) {
        const listId = type === 'critical' ? 'criticalCustomerList' : 'warningCustomerList';
        const toggleTextId = type === 'critical' ? 'toggleCriticalText' : 'toggleWarningText';
        const toggleIconId = type === 'critical' ? 'toggleCriticalIcon' : 'toggleWarningIcon';
        const searchId = type === 'critical' ? 'searchCriticalCustomer' : 'searchWarningCustomer';

        const container = document.getElementById(listId);
        const toggleText = document.getElementById(toggleTextId);
        const toggleIcon = document.getElementById(toggleIconId);
        const searchInput = document.getElementById(searchId);

        if (!container) return;

        // 切换状态
        const expanded = this[`${type}Expanded`] || false;
        this[`${type}Expanded`] = !expanded;

        // 获取当前搜索关键词
        const keyword = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const filtered = keyword
            ? customers.filter(c => c.name.toLowerCase().includes(keyword))
            : customers;

        const color = type === 'critical' ? 'red' : 'yellow';
        const displayCount = this[`${type}Expanded`] ? filtered.length : 5;

        // 更新列表
        container.innerHTML = filtered.slice(0, displayCount).map((c, i) => `
            <div class="bg-white rounded-lg p-3 border border-${color}-200 cursor-pointer hover:shadow-lg hover:border-${color}-300 transition-all customer-detail-card" data-customer="${c.name}">
                <div class="flex items-center justify-between mb-2">
                    <div>
                        <span class="font-semibold text-gray-800">#${i + 1} ${c.name}</span>
                        <span class="ml-2 text-xs bg-${color}-100 text-${color}-700 px-2 py-1 rounded">${c.score}分</span>
                    </div>
                    <div class="text-right">
                        <div class="text-xs text-gray-600">平均贡献</div>
                        <div class="font-bold text-${color}-700">${formatNumber(c.avgContribution, 1)}</div>
                    </div>
                </div>
                <div class="flex items-center justify-between text-xs">
                    <span class="text-gray-600">趋势：${c.trend === 'decreasing' ? '📉 下降' : c.trend === 'increasing' ? '📈 上升' : '➡️ 平稳'}</span>
                    <span class="text-${color}-600 font-semibold">影响量：${formatNumber(c.impact, 1)}</span>
                </div>
                ${this.renderMiniSparkline(c.values, color)}
                <div class="mt-2 text-center text-xs text-gray-500">👆 点击查看详情</div>
            </div>
        `).join('');

        // 更新按钮文字和图标
        if (toggleText) {
            toggleText.textContent = this[`${type}Expanded`]
                ? '收起'
                : `查看全部 ${customers.length} 个客户`;
        }
        if (toggleIcon) {
            toggleIcon.style.transform = this[`${type}Expanded`] ? 'rotate(180deg)' : 'rotate(0deg)';
        }

        // 重新绑定点击事件
        setTimeout(() => {
            container.querySelectorAll('.customer-detail-card').forEach(card => {
                card.addEventListener('click', () => {
                    const customerName = card.getAttribute('data-customer');
                    if (customerName) {
                        this.openCustomerDetail(customerName);
                    }
                });
            });
        }, 50);
    }

    /**
     * 渲染迷你趋势线（sparkline）
     */
    renderMiniSparkline(values, color = 'blue') {
        if (!values || values.length === 0) return '';

        const max = Math.max(...values);
        const min = Math.min(...values);
        const range = max - min || 1;

        // 颜色映射
        const colorMap = {
            'red': '#dc2626',
            'yellow': '#ca8a04',
            'blue': '#2563eb',
            'green': '#16a34a',
            'gray': '#6b7280'
        };
        const strokeColor = colorMap[color] || colorMap['blue'];

        // 生成SVG路径
        const width = 100;
        const height = 20;
        const points = values.map((val, i) => {
            const x = (i / (values.length - 1)) * width;
            const y = height - ((val - min) / range) * height;
            return `${x},${y}`;
        }).join(' ');

        return `
            <div class="mt-2 flex items-center justify-center">
                <svg width="${width}" height="${height}" class="sparkline">
                    <polyline
                        points="${points}"
                        fill="none"
                        stroke="${strokeColor}"
                        stroke-width="1.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    />
                </svg>
            </div>
        `;
    }

    /**
     * 初始化客户选择器
     */
    initializeCustomerSelector() {
        const selector = document.getElementById('customerAnalysisSelector');
        if (!selector) return;

        // 清空并添加默认选项
        selector.innerHTML = '<option value="">-- 请选择客户 --</option>';

        // 获取所有客户，按健康度排序
        const customers = Object.keys(this.analysisData.customerAnalysis).map(customer => {
            const analysis = this.analysisData.customerAnalysis[customer];
            return {
                name: customer,
                score: analysis.comprehensiveAnalysis.score
            };
        }).sort((a, b) => a.score - b.score); // 分数低的排前面（有问题的排前面）

        // 添加客户选项
        customers.forEach(customer => {
            const option = document.createElement('option');
            option.value = customer.name;
            const statusIcon = customer.score >= 70 ? '✅' : customer.score >= 50 ? '➡️' : customer.score >= 30 ? '⚠️' : '🚨';
            option.textContent = `${statusIcon} ${customer.name} (${customer.score}分)`;
            selector.appendChild(option);
        });

        // 添加事件监听
        selector.addEventListener('change', (e) => {
            const selectedCustomer = e.target.value;
            if (selectedCustomer) {
                this.renderCustomerAnalysis(selectedCustomer);
            }
        });

        console.log(`✅ 客户选择器已初始化，共 ${customers.length} 个客户`);
    }

    /**
     * 渲染单个客户的完整分析
     */
    renderCustomerAnalysis(customerName) {
        const container = document.getElementById('customerAnalysisContainer');
        if (!container) return;

        const analysis = this.analysisData.customerAnalysis[customerName];
        if (!analysis) {
            container.innerHTML = '<p class="text-gray-500">客户数据不存在</p>';
            return;
        }

        const periods = this.analysisData.periods;
        const comprehensiveAnalysis = analysis.comprehensiveAnalysis;
        const regression = analysis.linearRegression;
        const forecast = analysis.forecast;
        const outliers = analysis.outliers;
        const consecutiveDeclines = analysis.consecutiveDeclines;
        const seasonality = analysis.seasonality;
        const stats = analysis.statistics;

        // 状态配置
        const statusConfig = {
            'healthy': { color: 'green', icon: '✅', label: '健康' },
            'stable': { color: 'blue', icon: '➡️', label: '平稳' },
            'warning': { color: 'yellow', icon: '⚠️', label: '预警' },
            'critical': { color: 'red', icon: '🚨', label: '危急' }
        };
        const config = statusConfig[comprehensiveAnalysis.status] || statusConfig['stable'];

        let html = `
            <div class="space-y-6">
                <!-- 客户标题卡片 -->
                <div class="bg-gradient-to-r from-${config.color}-50 to-${config.color}-100 rounded-lg p-6 border-2 border-${config.color}-300">
                    <div class="flex items-center justify-between mb-4">
                        <div>
                            <h4 class="text-2xl font-bold text-${config.color}-900 mb-2">
                                ${config.icon} ${customerName}
                            </h4>
                            <div class="text-${config.color}-700 font-semibold">
                                健康度：${config.label} (${comprehensiveAnalysis.score}分)
                            </div>
                        </div>
                        <div class="relative w-32 h-32">
                            <svg class="transform -rotate-90 w-32 h-32">
                                <circle cx="64" cy="64" r="56" stroke="#e5e7eb" stroke-width="10" fill="none" />
                                <circle cx="64" cy="64" r="56"
                                        stroke="currentColor"
                                        class="text-${config.color}-600"
                                        stroke-width="10"
                                        fill="none"
                                        stroke-dasharray="${2 * Math.PI * 56}"
                                        stroke-dashoffset="${2 * Math.PI * 56 * (1 - comprehensiveAnalysis.score / 100)}"
                                        stroke-linecap="round" />
                            </svg>
                            <div class="absolute inset-0 flex items-center justify-center">
                                <span class="text-2xl font-bold text-${config.color}-700">${comprehensiveAnalysis.score}</span>
                            </div>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div class="bg-white rounded p-3">
                            <div class="text-gray-600 text-xs mb-1">平均值</div>
                            <div class="font-bold text-lg">${formatNumber(stats.avg, 1)}</div>
                        </div>
                        <div class="bg-white rounded p-3">
                            <div class="text-gray-600 text-xs mb-1">总计</div>
                            <div class="font-bold text-lg">${formatNumber(stats.total, 0)}</div>
                        </div>
                        <div class="bg-white rounded p-3">
                            <div class="text-gray-600 text-xs mb-1">最大值</div>
                            <div class="font-bold text-lg text-green-600">${formatNumber(stats.max, 0)}</div>
                        </div>
                        <div class="bg-white rounded p-3">
                            <div class="text-gray-600 text-xs mb-1">最小值</div>
                            <div class="font-bold text-lg text-red-600">${formatNumber(stats.min, 0)}</div>
                        </div>
                    </div>
                </div>

                <!-- 线性回归与趋势 -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="bg-blue-50 rounded-lg p-4 border border-blue-200">
                        <h5 class="font-semibold text-blue-900 mb-3 flex items-center">
                            <span class="text-xl mr-2">📈</span>
                            线性回归分析
                        </h5>
                        ${regression ? `
                            <div class="space-y-2 text-sm">
                                <div class="flex justify-between">
                                    <span>趋势方向:</span>
                                    <span class="font-semibold">${regression.trend === 'increasing' ? '📈 上升' : regression.trend === 'decreasing' ? '📉 下降' : '➡️ 平稳'}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span>斜率:</span>
                                    <span class="font-mono">${formatNumber(regression.slope, 3)}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span>R²拟合优度:</span>
                                    <span class="font-mono font-semibold">${formatNumber(regression.rSquared, 3)}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span>拟合质量:</span>
                                    <span class="${regression.fitQuality === 'good' ? 'text-green-600' : regression.fitQuality === 'moderate' ? 'text-yellow-600' : 'text-red-600'} font-semibold">
                                        ${regression.fitQuality === 'good' ? '✓ 优秀' : regression.fitQuality === 'moderate' ? '○ 中等' : '✗ 较差'}
                                    </span>
                                </div>
                            </div>
                        ` : '<p class="text-gray-500 text-sm">数据不足</p>'}
                    </div>

                    <div class="bg-green-50 rounded-lg p-4 border border-green-200">
                        <h5 class="font-semibold text-green-900 mb-3 flex items-center">
                            <span class="text-xl mr-2">🔮</span>
                            趋势预测
                        </h5>
                        ${forecast && forecast.predictions.length > 0 ? `
                            <div class="space-y-2 text-sm">
                                ${forecast.predictions.slice(0, 3).map((pred, i) => `
                                    <div class="flex justify-between items-center bg-white rounded p-2">
                                        <span class="text-gray-700">未来第${i + 1}期:</span>
                                        <span class="font-bold text-lg text-green-700">${formatNumber(pred.value, 0)}</span>
                                    </div>
                                `).join('')}
                                <div class="text-xs text-gray-600 mt-2">
                                    置信度: ${forecast.confidence === 'good' ? '高 ✓' : forecast.confidence === 'moderate' ? '中 ○' : '低 ✗'}
                                </div>
                            </div>
                        ` : '<p class="text-gray-500 text-sm">数据不足</p>'}
                    </div>
                </div>

                <!-- 异常检测与连续下滑 -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="bg-orange-50 rounded-lg p-4 border border-orange-200">
                        <h5 class="font-semibold text-orange-900 mb-3 flex items-center">
                            <span class="text-xl mr-2">🔍</span>
                            异常值检测
                        </h5>
                        <div class="text-sm">
                            <div class="flex justify-between mb-2">
                                <span>异常点数:</span>
                                <span class="font-semibold ${outliers.outlierIndices.length > 0 ? 'text-orange-600' : 'text-green-600'}">
                                    ${outliers.outlierIndices.length === 0 ? '✓ 无异常' : `⚠️ ${outliers.outlierIndices.length}个`}
                                </span>
                            </div>
                            ${outliers.outlierIndices.length > 0 ? `
                                <div class="mt-2 space-y-1 max-h-32 overflow-y-auto">
                                    ${outliers.outlierValues.map(o => `
                                        <div class="flex justify-between text-xs bg-white rounded px-2 py-1">
                                            <span>${periods[o.index]}</span>
                                            <span class="font-mono">${formatNumber(o.value, 0)}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : ''}
                        </div>
                    </div>

                    <div class="bg-${consecutiveDeclines.length > 0 ? 'red' : 'green'}-50 rounded-lg p-4 border border-${consecutiveDeclines.length > 0 ? 'red' : 'green'}-200">
                        <h5 class="font-semibold text-${consecutiveDeclines.length > 0 ? 'red' : 'green'}-900 mb-3 flex items-center">
                            <span class="text-xl mr-2">${consecutiveDeclines.length > 0 ? '🚨' : '✓'}</span>
                            连续下滑检测
                        </h5>
                        ${consecutiveDeclines.length > 0 ? `
                            <div class="space-y-2 text-sm">
                                ${consecutiveDeclines.map((decline, i) => `
                                    <div class="bg-white rounded p-2">
                                        <div class="font-semibold text-red-700 mb-1">预警 #${i + 1}</div>
                                        <div class="text-xs text-gray-700">
                                            <div>时间: ${periods[decline.startIndex]} ~ ${periods[decline.endIndex]}</div>
                                            <div>连续${decline.count}期下降 ${formatNumber(decline.dropPercent, 1)}%</div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        ` : '<div class="text-sm text-green-700">✓ 未检测到连续下滑，趋势良好</div>'}
                    </div>
                </div>

                <!-- 季节性分析 -->
                <div class="bg-cyan-50 rounded-lg p-4 border border-cyan-200">
                    <h5 class="font-semibold text-cyan-900 mb-3 flex items-center">
                        <span class="text-xl mr-2">📅</span>
                        季节性分析
                    </h5>
                    <div class="grid grid-cols-3 gap-4 text-sm">
                        <div>
                            <div class="text-gray-600 mb-1">周期性:</div>
                            <div class="font-semibold">${seasonality.strength === 'strong' ? '✓✓✓ 强' : seasonality.strength === 'moderate' ? '✓✓ 中' : seasonality.strength === 'weak' ? '✓ 弱' : '✗ 无'}</div>
                        </div>
                        <div>
                            <div class="text-gray-600 mb-1">检测周期:</div>
                            <div class="font-mono">${seasonality.period}期</div>
                        </div>
                        <div>
                            <div class="text-gray-600 mb-1">自相关系数:</div>
                            <div class="font-mono">${formatNumber(seasonality.autocorrelation, 3)}</div>
                        </div>
                    </div>
                    <div class="mt-2 text-xs text-gray-600">${seasonality.message}</div>
                </div>
            </div>
        `;

        container.innerHTML = html;
        console.log(`✅ 已渲染客户分析: ${customerName}`);
    }

    /**
     * ========================================
     * 周期规则配置相关方法
     * ========================================
     */

    /**
     * 打开配置模态框
     */
    openConfigModal() {
        const modal = document.getElementById('configModal');
        const modalContent = document.getElementById('modalContent');
        if (!modal || !modalContent) return;

        // 加载当前配置到表单
        document.getElementById('dayStart').value = this.groupingRules.day.startTime;
        document.getElementById('weekStartDay').value = this.groupingRules.week.startDay;
        document.getElementById('weekStartTime').value = this.groupingRules.week.startTime;
        document.getElementById('monthStartDate').value = this.groupingRules.month.startDate;
        document.getElementById('monthStartTime').value = this.groupingRules.month.startTime;
        document.getElementById('quarterStartMonth').value = this.groupingRules.quarter.startMonth;
        document.getElementById('quarterStartTime').value = this.groupingRules.quarter.startTime;

        // 更新显示
        this.updateDayRangeDisplay(this.groupingRules.day.startTime);

        // 显示模态框
        modal.classList.remove('hidden');

        // 触发动画
        setTimeout(() => {
            modalContent.style.transform = 'scale(1)';
            modalContent.style.opacity = '1';
        }, 10);
    }

    /**
     * 关闭配置模态框
     */
    closeConfigModal() {
        const modal = document.getElementById('configModal');
        const modalContent = document.getElementById('modalContent');
        if (!modal || !modalContent) return;

        // 关闭动画
        modalContent.style.transform = 'scale(0.95)';
        modalContent.style.opacity = '0';

        setTimeout(() => {
            modal.classList.add('hidden');
        }, 200);
    }

    /**
     * 保存配置
     */
    saveGroupingConfig() {
        // 读取表单数据
        this.groupingRules.day.startTime = document.getElementById('dayStart').value;
        this.groupingRules.week.startDay = parseInt(document.getElementById('weekStartDay').value);
        this.groupingRules.week.startTime = document.getElementById('weekStartTime').value;
        this.groupingRules.month.startDate = parseInt(document.getElementById('monthStartDate').value);
        this.groupingRules.month.startTime = document.getElementById('monthStartTime').value;
        this.groupingRules.quarter.startMonth = parseInt(document.getElementById('quarterStartMonth').value);
        this.groupingRules.quarter.startTime = document.getElementById('quarterStartTime').value;

        // 保存到localStorage（使用与trend页面相同的键名）
        try {
            localStorage.setItem('cycle_rules', JSON.stringify(this.groupingRules));
            console.log('✅ 周期规则配置已保存:', this.groupingRules);
        } catch (error) {
            console.error('❌ 保存配置失败:', error);
        }

        // 关闭模态框
        this.closeConfigModal();

        // 提示用户
        alert('周期规则配置已保存！请重新执行分析以应用新规则。');
    }

    /**
     * 重置配置为默认值
     */
    resetGroupingConfig() {
        if (!confirm('确定要重置为默认配置吗？')) {
            return;
        }

        // 重置为默认值
        this.groupingRules = {
            day: { startTime: '00:00' },
            week: { startDay: 1, startTime: '00:00' },
            month: { startDate: 1, startTime: '00:00' },
            quarter: { startMonth: 1, startTime: '00:00' }
        };

        // 更新表单
        document.getElementById('dayStart').value = '00:00';
        document.getElementById('weekStartDay').value = '1';
        document.getElementById('weekStartTime').value = '00:00';
        document.getElementById('monthStartDate').value = '1';
        document.getElementById('monthStartTime').value = '00:00';
        document.getElementById('quarterStartMonth').value = '1';
        document.getElementById('quarterStartTime').value = '00:00';

        // 更新显示
        this.updateDayRangeDisplay('00:00');

        // 保存到localStorage（使用与trend页面相同的键名）
        try {
            localStorage.setItem('cycle_rules', JSON.stringify(this.groupingRules));
            console.log('✅ 周期规则配置已重置');
        } catch (error) {
            console.error('❌ 保存配置失败:', error);
        }
    }

    /**
     * 从localStorage加载配置
     */
    loadGroupingConfig() {
        try {
            const saved = localStorage.getItem('cycle_rules');
            if (saved) {
                const rules = JSON.parse(saved);

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

                this.groupingRules = rules;
                console.log('✅ 已加载保存的周期规则配置:', this.groupingRules);
            }
        } catch (error) {
            console.error('❌ 加载配置失败:', error);
        }
    }

    /**
     * 更新按日周期范围显示
     */
    updateDayRangeDisplay(startTime) {
        const startDisplay = document.getElementById('dayStartDisplay');
        const endDisplay = document.getElementById('dayEndDisplay');

        if (startDisplay) startDisplay.textContent = startTime;
        if (endDisplay) endDisplay.textContent = startTime;
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
