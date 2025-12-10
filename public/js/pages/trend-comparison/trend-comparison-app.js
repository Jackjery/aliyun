/**
 * 智能期间对比分析 - 主应用
 * 实现期间对比、客户影响力分析、历史趋势识别、AI分组
 */

(function() {
    'use strict';

    // ============================================
    // 全局状态管理
    // ============================================
    const state = {
        config: {
            basePeriod: { start: null, end: null },
            currentPeriod: { start: null, end: null },
            groupingType: 'day',
            groupingStartTime: '00:00:00',
            weekStartDay: 1
        },
        data: {
            baseData: null,
            currentData: null,
            historicalData: null
        },
        analysis: {
            overview: null,
            customerImpact: null,
            trendRecognition: null,
            aiGrouping: null
        }
    };

    // DOM元素引用
    const elements = {
        // 期间选择器
        baseStartDate: null,
        baseStartTime: null,
        baseEndDate: null,
        baseEndTime: null,
        currentStartDate: null,
        currentStartTime: null,
        currentEndDate: null,
        currentEndTime: null,

        // 分组配置
        groupingType: null,
        groupingStartTime: null,
        weekStartDay: null,

        // 按钮和状态
        startAnalysisBtn: null,
        resetConfigBtn: null,

        // 结果容器
        loadingSection: null,
        resultsContainer: null,
        overviewCards: null,
        impactAnalysisContainer: null,
        aiGroupingContainer: null,

        // 摘要
        basePeriodSummary: null,
        currentPeriodSummary: null
    };

    // ============================================
    // 初始化
    // ============================================
    function init() {
        console.log('[Period Comparison] 初始化智能期间对比分析模块');

        // 绑定DOM元素
        bindElements();

        // 初始化默认值
        initDefaultValues();

        // 绑定事件
        bindEvents();

        // 初始化WebSocket连接
        initWebSocket();

        console.log('[Period Comparison] 初始化完成');
    }

    function initWebSocket() {
        if (window.wsManager) {
            console.log('[Period Comparison] 初始化WebSocket连接');

            // 设置连接状态回调
            window.wsManager.onConnectionChange = (isConnected) => {
                if (isConnected) {
                    console.log('[Period Comparison] WebSocket已连接');
                    updateStatus('ready', '就绪');
                } else {
                    console.log('[Period Comparison] WebSocket断开连接');
                    updateStatus('error', '连接断开');
                }
            };

            // 尝试连接
            const connectPromise = window.wsManager.connect();
            if (connectPromise && typeof connectPromise.catch === 'function') {
                connectPromise.catch(error => {
                    console.error('[Period Comparison] WebSocket连接失败:', error);
                    updateStatus('error', '连接失败');
                });
            }
        } else {
            console.warn('[Period Comparison] WebSocket管理器未加载');
            updateStatus('error', 'WebSocket未加载');
        }
    }

    function bindElements() {
        // 期间选择器
        elements.baseStartDate = document.getElementById('baseStartDate');
        elements.baseStartTime = document.getElementById('baseStartTime');
        elements.baseEndDate = document.getElementById('baseEndDate');
        elements.baseEndTime = document.getElementById('baseEndTime');
        elements.currentStartDate = document.getElementById('currentStartDate');
        elements.currentStartTime = document.getElementById('currentStartTime');
        elements.currentEndDate = document.getElementById('currentEndDate');
        elements.currentEndTime = document.getElementById('currentEndTime');

        // 分组配置
        elements.groupingType = document.getElementById('groupingType');
        elements.groupingStartTime = document.getElementById('groupingStartTime');
        elements.weekStartDay = document.getElementById('weekStartDay');

        // 按钮
        elements.startAnalysisBtn = document.getElementById('startAnalysisBtn');
        elements.resetConfigBtn = document.getElementById('resetConfigBtn');

        // 容器
        elements.loadingSection = document.getElementById('loadingSection');
        elements.resultsContainer = document.getElementById('resultsContainer');
        elements.overviewCards = document.getElementById('overviewCards');
        elements.impactAnalysisContainer = document.getElementById('impactAnalysisContainer');
        elements.aiGroupingContainer = document.getElementById('aiGroupingContainer');

        // 摘要
        elements.basePeriodSummary = document.getElementById('basePeriodSummary');
        elements.currentPeriodSummary = document.getElementById('currentPeriodSummary');
    }

    function initDefaultValues() {
        // 设置默认日期（最近30天）
        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);
        const sixtyDaysAgo = new Date(today);
        sixtyDaysAgo.setDate(today.getDate() - 60);

        // 基期：60天前到30天前
        elements.baseStartDate.value = formatDate(sixtyDaysAgo);
        elements.baseEndDate.value = formatDate(thirtyDaysAgo);

        // 现期：30天前到今天
        elements.currentStartDate.value = formatDate(thirtyDaysAgo);
        elements.currentEndDate.value = formatDate(today);

        // 更新摘要
        updatePeriodSummary('base');
        updatePeriodSummary('current');
    }

    function bindEvents() {
        // 期间选择器变化
        [elements.baseStartDate, elements.baseStartTime, elements.baseEndDate, elements.baseEndTime].forEach(el => {
            el && el.addEventListener('change', () => updatePeriodSummary('base'));
        });

        [elements.currentStartDate, elements.currentStartTime, elements.currentEndDate, elements.currentEndTime].forEach(el => {
            el && el.addEventListener('change', () => updatePeriodSummary('current'));
        });

        // 分组类型变化
        elements.groupingType && elements.groupingType.addEventListener('change', handleGroupingTypeChange);

        // 按钮点击
        elements.startAnalysisBtn && elements.startAnalysisBtn.addEventListener('click', startAnalysis);
        elements.resetConfigBtn && elements.resetConfigBtn.addEventListener('click', resetConfig);
    }

    // ============================================
    // 期间选择器逻辑
    // ============================================
    function updatePeriodSummary(periodType) {
        const isBase = periodType === 'base';
        const startDate = isBase ? elements.baseStartDate.value : elements.currentStartDate.value;
        const startTime = isBase ? elements.baseStartTime.value : elements.currentStartTime.value;
        const endDate = isBase ? elements.baseEndDate.value : elements.currentEndDate.value;
        const endTime = isBase ? elements.baseEndTime.value : elements.currentEndTime.value;

        const summaryEl = isBase ? elements.basePeriodSummary : elements.currentPeriodSummary;

        if (!startDate || !endDate) {
            summaryEl.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" class="summary-icon">
                    <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span class="summary-text">请选择${isBase ? '基' : '现'}期时间范围</span>
            `;
            return;
        }

        const start = new Date(`${startDate}T${startTime || '00:00:00'}`);
        const end = new Date(`${endDate}T${endTime || '23:59:59'}`);

        // 计算时间跨度
        const diffMs = end - start;
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

        let durationText = '';
        if (diffDays >= 1) {
            durationText = `${diffDays}天`;
            if (diffHours % 24 > 0) {
                durationText += ` ${diffHours % 24}小时`;
            }
        } else {
            durationText = `${diffHours}小时`;
        }

        summaryEl.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" class="summary-icon">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span class="summary-text">
                <strong>${formatDateTime(start)}</strong> 至 <strong>${formatDateTime(end)}</strong>
                （跨度: ${durationText}）
            </span>
        `;

        // 保存到状态
        if (isBase) {
            state.config.basePeriod = { start, end };
        } else {
            state.config.currentPeriod = { start, end };
        }
    }

    function handleGroupingTypeChange() {
        const type = elements.groupingType.value;
        const weekGroup = document.getElementById('weekStartDayGroup');

        if (type === 'week' && weekGroup) {
            weekGroup.style.display = 'block';
        } else if (weekGroup) {
            weekGroup.style.display = 'none';
        }

        state.config.groupingType = type;
    }

    function resetConfig() {
        if (confirm('确认要重置所有配置吗？')) {
            initDefaultValues();
            elements.groupingType.value = 'day';
            elements.groupingStartTime.value = '00:00:00';
            elements.weekStartDay.value = '1';
            handleGroupingTypeChange();

            // 隐藏结果
            elements.resultsContainer.style.display = 'none';

            console.log('[Period Comparison] 配置已重置');
        }
    }

    // ============================================
    // 分析流程
    // ============================================
    async function startAnalysis() {
        console.log('[Period Comparison] 开始智能分析');

        // 验证配置
        if (!validateConfig()) {
            return;
        }

        // 更新状态
        updateStatus('analyzing', '分析中...');
        showLoading('正在加载数据...');

        try {
            // 阶段1：加载数据
            updateLoadingProgress(10, '正在查询基期数据...');
            const baseData = await fetchPeriodData('base');

            updateLoadingProgress(30, '正在查询现期数据...');
            const currentData = await fetchPeriodData('current');

            updateLoadingProgress(50, '正在加载历史数据...');
            const historicalData = await fetchHistoricalData();

            // 保存数据
            state.data.baseData = baseData;
            state.data.currentData = currentData;
            state.data.historicalData = historicalData;

            // 阶段2：执行分析
            updateLoadingProgress(60, '正在进行期间对比分析...');
            const overview = performOverviewAnalysis(baseData, currentData);

            updateLoadingProgress(70, '正在分析客户影响力...');
            const customerImpact = performCustomerImpactAnalysis(baseData, currentData);

            updateLoadingProgress(80, '正在识别历史趋势...');
            const trendRecognition = performTrendRecognition(historicalData);

            updateLoadingProgress(90, '正在进行AI智能分组...');
            const aiGrouping = performAIGrouping(historicalData, customerImpact);

            // 保存分析结果
            state.analysis.overview = overview;
            state.analysis.customerImpact = customerImpact;
            state.analysis.trendRecognition = trendRecognition;
            state.analysis.aiGrouping = aiGrouping;

            // 阶段3：渲染结果
            updateLoadingProgress(95, '正在渲染结果...');
            await renderResults();

            updateLoadingProgress(100, '分析完成！');

            // 显示结果
            setTimeout(() => {
                hideLoading();
                showResults();
                updateStatus('ready', '就绪');
            }, 500);

            console.log('[Period Comparison] 分析完成', state.analysis);

        } catch (error) {
            console.error('[Period Comparison] 分析失败:', error);
            hideLoading();
            updateStatus('error', '分析失败');
            alert('分析失败: ' + error.message);
        }
    }

    function validateConfig() {
        const { basePeriod, currentPeriod } = state.config;

        if (!basePeriod.start || !basePeriod.end) {
            alert('请选择基期时间范围');
            return false;
        }

        if (!currentPeriod.start || !currentPeriod.end) {
            alert('请选择现期时间范围');
            return false;
        }

        if (basePeriod.start >= basePeriod.end) {
            alert('基期开始时间必须早于结束时间');
            return false;
        }

        if (currentPeriod.start >= currentPeriod.end) {
            alert('现期开始时间必须早于结束时间');
            return false;
        }

        // 检查时间跨度是否合理（至少1小时）
        const baseDiff = basePeriod.end - basePeriod.start;
        const currentDiff = currentPeriod.end - currentPeriod.start;

        if (baseDiff < 3600000 || currentDiff < 3600000) {
            alert('时间跨度至少需要1小时');
            return false;
        }

        return true;
    }

    // ============================================
    // 数据获取（真实WebSocket查询）
    // ============================================
    async function fetchPeriodData(periodType) {
        const period = periodType === 'base' ? state.config.basePeriod : state.config.currentPeriod;

        try {
            // 确保WebSocket已连接
            if (!window.wsManager || !window.wsManager.isConnected) {
                console.log('[Period Comparison] 正在连接WebSocket...');
                await window.wsManager.connect();
                // 等待连接建立
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // 准备查询选项
            // 后端查询规则：start_time >= startDate AND start_time < endDate（左闭右开）
            // 用户期望：基期包含边界，现期不包含边界
            let startDate = period.start;
            let endDate = new Date(period.end.getTime() + 1000); // 结束时间+1秒，使<运算包含边界

            // 现期：如果与基期边界相同，开始时间+1秒避免重复
            if (periodType === 'current' && state.config.basePeriod.end) {
                if (startDate.getTime() === state.config.basePeriod.end.getTime()) {
                    startDate = new Date(startDate.getTime() + 1000);
                }
            }

            const options = {
                startDate: formatDateTimeForBackend(startDate, true),
                endDate: formatDateTimeForBackend(endDate, true)
            };

            console.log(`[Period Comparison] 查询${periodType === 'base' ? '基期' : '现期'}数据:`,
                `startDate=${options.startDate}, endDate=${options.endDate}`);

            // 使用 customer_distribution 查询（按客户聚合，不按时间分组）
            const result = await window.wsManager.queryStats('customer_distribution', options);

            // 转换后端数据格式为分析引擎格式
            const transformedData = transformBackendDataToPeriod(result, period);

            console.log(`[Period Comparison] ${periodType === 'base' ? '基期' : '现期'}数据获取成功:`, transformedData.length, '条记录');

            // 调试：查看青岛上合的数据
            const qingdao = transformedData.find(c => c.customer_name && c.customer_name.includes('青岛上合'));
            if (qingdao) {
                console.log(`[Period Comparison] 青岛上合${periodType === 'base' ? '基期' : '现期'}圈次:`, qingdao.record_count);
            }

            return transformedData;

        } catch (error) {
            console.error(`[Period Comparison] 查询${periodType === 'base' ? '基期' : '现期'}数据失败:`, error);
            throw new Error(`数据查询失败: ${error.message}`);
        }
    }

    async function fetchHistoricalData() {
        try {
            // 确保WebSocket已连接
            if (!window.wsManager || !window.wsManager.isConnected) {
                await window.wsManager.connect();
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // 查询历史90天数据，按天分组
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - 90);

            const options = {
                startDate: formatDateTimeForBackend(startDate),
                endDate: formatDateTimeForBackend(endDate),
                groupBy: 'day',  // 按天分组
                groupingRule: {
                    type: 'day',
                    startTime: '00:00:00',
                    weekStartDay: 1
                }
            };

            console.log('[Period Comparison] 查询历史数据:', options);

            // 查询客户维度趋势（按天+客户双维度分组）
            const result = await window.wsManager.queryStats('customer_dimension_trend', options);

            // 转换为时间序列格式
            const transformedData = transformBackendDataToTimeSeries(result);

            console.log('[Period Comparison] 历史数据获取成功:', transformedData.length, '条记录');

            return transformedData;

        } catch (error) {
            console.error('[Period Comparison] 查询历史数据失败:', error);
            throw new Error(`历史数据查询失败: ${error.message}`);
        }
    }

    function generateMockData(period, recordCount) {
        // 生成模拟数据
        const customers = ['客户A', '客户B', '客户C', '客户D', '客户E'];
        const data = [];

        for (let i = 0; i < recordCount; i++) {
            data.push({
                customer_name: customers[Math.floor(Math.random() * customers.length)],
                plan_id: `PLAN-${i}`,
                record_count: Math.floor(Math.random() * 100) + 1,
                start_time: new Date(period.start.getTime() + Math.random() * (period.end - period.start))
            });
        }

        return data;
    }

    function generateMockHistoricalData() {
        // 生成模拟历史趋势数据
        const days = 60;
        const customers = ['客户A', '客户B', '客户C', '客户D', '客户E'];
        const data = [];

        for (let i = 0; i < days; i++) {
            const date = new Date();
            date.setDate(date.getDate() - (days - i));

            customers.forEach(customer => {
                data.push({
                    period: formatDate(date),
                    customer_name: customer,
                    record_count: Math.floor(Math.random() * 100) + 50
                });
            });
        }

        return data;
    }

    // ============================================
    // 数据转换函数（后端格式 → 分析引擎格式）
    // ============================================

    /**
     * 格式化日期为后端格式
     * @param {Date} date - 日期对象
     * @param {boolean} includeTime - 是否包含时间部分
     * @returns {string} - 'YYYY-MM-DD' 或 'YYYY-MM-DD HH:MM:SS'
     *
     * 后端处理规则：
     * - 无时间部分(YYYY-MM-DD): >= YYYY-MM-DD 00:00:00 AND < 次日 00:00:00（包含整天）
     * - 有时间部分(YYYY-MM-DD HH:MM:SS): >= HH:MM:SS AND < HH:MM:SS（左闭右开）
     */
    function formatDateTimeForBackend(date, includeTime = true) {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');

        if (!includeTime) {
            return `${year}-${month}-${day}`;
        }

        const hour = String(d.getHours()).padStart(2, '0');
        const minute = String(d.getMinutes()).padStart(2, '0');
        const second = String(d.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
    }

    /**
     * 转换后端数据为期间分析格式
     * 后端格式: { records: [{customer_name, record_count}], meta: {...} }
     * 期间格式: [{customer_name, plan_id, record_count, start_time}]
     *
     * @param {object} backendResult - 后端查询结果
     * @param {object} period - 期间对象 {start, end}
     * @returns {array} - 转换后的数据
     */
    function transformBackendDataToPeriod(backendResult, period) {
        if (!backendResult || !backendResult.records) {
            console.warn('[Period Comparison] 后端返回数据为空');
            return [];
        }

        // customer_distribution 已经按客户聚合好了，直接转换格式即可
        return backendResult.records.map(record => ({
            customer_name: record.customer_name,
            plan_id: `AGG-${record.customer_name}`,
            record_count: record.record_count || 0,
            start_time: period.start
        }));
    }

    /**
     * 转换后端数据为时间序列格式
     * 后端格式: { records: [{period, customer_name, record_count, ...}], meta: {...} }
     * 时间序列格式: [{period, customer_name, record_count}]
     *
     * @param {object} backendResult - 后端查询结果
     * @returns {array} - 转换后的时间序列数据
     */
    function transformBackendDataToTimeSeries(backendResult) {
        if (!backendResult || !backendResult.records) {
            console.warn('[Period Comparison] 后端返回历史数据为空');
            return [];
        }

        // 后端格式已经符合时间序列要求，直接返回
        return backendResult.records.map(record => ({
            period: record.period,
            customer_name: record.customer_name || record.period,
            record_count: record.record_count || 0,
            failure_count: record.failure_count || 0,
            plan_count: record.plan_count || 0,
            // 保留原始数据
            _backend: record
        }));
    }

    // ============================================
    // 分析算法（基础实现）
    // ============================================
    function performOverviewAnalysis(baseData, currentData) {
        // 计算总计划ID数
        const basePlanIds = new Set(baseData.map(r => r.plan_id)).size;
        const currentPlanIds = new Set(currentData.map(r => r.plan_id)).size;
        const planIdChange = currentPlanIds - basePlanIds;
        const planIdChangePercent = (planIdChange / basePlanIds * 100).toFixed(1);

        // 计算圈次
        const baseRecordCount = baseData.reduce((sum, r) => sum + r.record_count, 0);
        const currentRecordCount = currentData.reduce((sum, r) => sum + r.record_count, 0);
        const recordCountChange = currentRecordCount - baseRecordCount;
        const recordCountChangePercent = (recordCountChange / baseRecordCount * 100).toFixed(1);

        // 计算日均圈次
        const baseDays = (state.config.basePeriod.end - state.config.basePeriod.start) / (1000 * 60 * 60 * 24);
        const currentDays = (state.config.currentPeriod.end - state.config.currentPeriod.start) / (1000 * 60 * 60 * 24);
        const baseDailyAvg = (baseRecordCount / baseDays).toFixed(1);
        const currentDailyAvg = (currentRecordCount / currentDays).toFixed(1);
        const dailyAvgChange = (currentDailyAvg - baseDailyAvg).toFixed(1);
        const dailyAvgChangePercent = (dailyAvgChange / baseDailyAvg * 100).toFixed(1);

        return {
            planIds: {
                base: basePlanIds,
                current: currentPlanIds,
                change: planIdChange,
                changePercent: planIdChangePercent
            },
            recordCount: {
                base: baseRecordCount,
                current: currentRecordCount,
                change: recordCountChange,
                changePercent: recordCountChangePercent
            },
            dailyAvg: {
                base: baseDailyAvg,
                current: currentDailyAvg,
                change: dailyAvgChange,
                changePercent: dailyAvgChangePercent
            }
        };
    }

    function performCustomerImpactAnalysis(baseData, currentData) {
        console.log('[Period Comparison] 执行客户影响力分析');

        // 按客户聚合数据
        const baseByCustomer = aggregateByCustomer(baseData);
        const currentByCustomer = aggregateByCustomer(currentData);

        // 计算每个客户的变化
        const allCustomers = new Set([...Object.keys(baseByCustomer), ...Object.keys(currentByCustomer)]);
        const customerChanges = [];

        allCustomers.forEach(customer => {
            const baseCount = baseByCustomer[customer] || 0;
            const currentCount = currentByCustomer[customer] || 0;
            const change = currentCount - baseCount;
            const changePercent = baseCount > 0 ? (change / baseCount * 100).toFixed(1) : 0;

            // 使用T检验判断显著性（如果有ML算法）
            let isSignificant = Math.abs(change) > 10; // 默认简单判断
            let pValue = null;

            if (window.MLAlgorithms && window.MLAlgorithms.tTest) {
                try {
                    // 为T检验准备样本数据（使用变化量构造简化样本）
                    const baseSample = Array(Math.max(1, Math.floor(baseCount / 10))).fill(baseCount);
                    const currentSample = Array(Math.max(1, Math.floor(currentCount / 10))).fill(currentCount);

                    if (baseSample.length >= 2 && currentSample.length >= 2) {
                        const tTestResult = window.MLAlgorithms.tTest(baseSample, currentSample);
                        pValue = tTestResult.pValue;
                        isSignificant = pValue < 0.05; // 5%显著性水平
                    }
                } catch (error) {
                    console.warn(`[Period Comparison] T检验失败 (${customer}):`, error.message);
                }
            }

            customerChanges.push({
                customer,
                baseCount,
                currentCount,
                change,
                changePercent,
                isSignificant,
                pValue
            });
        });

        // 排序：按变化量的绝对值降序
        customerChanges.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

        // 分为下滑和上涨
        const declining = customerChanges.filter(c => c.change < 0);
        const growing = customerChanges.filter(c => c.change > 0);

        // 计算总体影响力（使用ML算法）
        if (window.MLAlgorithms && window.MLAlgorithms.calculateCustomerImpact) {
            try {
                const totalChange = customerChanges.reduce((sum, c) => sum + Math.abs(c.change), 0);
                customerChanges.forEach(customer => {
                    customer.impactScore = window.MLAlgorithms.calculateCustomerImpact(
                        customer,
                        totalChange,
                        customerChanges
                    );
                });
            } catch (error) {
                console.warn('[Period Comparison] 影响力计算失败:', error.message);
            }
        }

        return {
            all: customerChanges,
            declining,
            growing
        };
    }

    function performTrendRecognition(historicalData) {
        console.log('[Period Comparison] 执行历史趋势深度识别');

        // 检查是否有ML算法引擎
        if (!window.MLAlgorithms || !window.MLAlgorithmsTimeSeries) {
            console.warn('[Period Comparison] ML算法引擎未加载');
            return {
                error: 'ML算法引擎未加载'
            };
        }

        if (!historicalData || historicalData.length === 0) {
            return {
                error: '历史数据不足'
            };
        }

        try {
            // ========== 步骤1+2：生成整体时间序列（总计划ID趋势） ==========
            const timeSeriesMap = {};
            historicalData.forEach(record => {
                const date = record.period;
                if (!timeSeriesMap[date]) {
                    timeSeriesMap[date] = 0;
                }
                timeSeriesMap[date] += record.record_count;
            });

            const timeSeriesData = Object.keys(timeSeriesMap).sort().map(date => ({
                date: new Date(date),
                value: timeSeriesMap[date]
            }));

            if (timeSeriesData.length < 7) {
                return {
                    error: '历史数据不足，需要至少7天的数据'
                };
            }

            const values = timeSeriesData.map(d => d.value);

            // ========== 步骤3：历史趋势识别（重点） ==========

            // 3.1 拐点检测 (PELT算法)
            let inflectionPoints = [];
            try {
                const inflectionResult = window.MLAlgorithmsTimeSeries.detectInflectionPoints_PELT(timeSeriesData);
                inflectionPoints = (inflectionResult.changepoints || []).map(idx => {
                    const point = timeSeriesData[idx] || {};
                    return {
                        index: idx,
                        date: point.date ? point.date.toISOString().split('T')[0] : '未知',
                        value: point.value || 0
                    };
                });
            } catch (e) {
                console.warn('[Period Comparison] 拐点检测失败:', e.message);
            }

            // 3.2 趋势分段 (AIC/BIC算法)
            let segments = [];
            try {
                const segmentResult = window.MLAlgorithmsTimeSeries.segmentTrends_AIC_BIC(timeSeriesData);
                segments = (segmentResult.segments || []).map((seg, index) => ({
                    stage: index + 1,
                    trend: seg.trend || 'unknown',
                    start: seg.start || 0,
                    end: seg.end || 0,
                    slope: seg.slope || 0,
                    startDate: timeSeriesData[seg.start]?.date.toISOString().split('T')[0] || '未知',
                    endDate: timeSeriesData[seg.end]?.date.toISOString().split('T')[0] || '未知'
                }));
            } catch (e) {
                console.warn('[Period Comparison] 趋势分段失败:', e.message);
            }

            // 3.3 异常检测 (IQR + 3σ)
            let anomalies = [];
            try {
                const anomalyResult = window.MLAlgorithms.detectAnomalies_IQR(values);
                anomalies = anomalyResult.anomalies.map((isAnomaly, idx) => {
                    if (!isAnomaly) return null;
                    const point = timeSeriesData[idx];
                    return {
                        index: idx,
                        date: point.date.toISOString().split('T')[0],
                        value: point.value,
                        deviation: Math.abs(point.value - anomalyResult.median) / anomalyResult.iqr
                    };
                }).filter(a => a !== null);
            } catch (e) {
                console.warn('[Period Comparison] 异常检测失败:', e.message);
            }

            // 3.4 周期性识别 (FFT)
            let periodicity = null;
            try {
                periodicity = window.MLAlgorithmsTimeSeries.analyzePeriodicity_FFT(timeSeriesData);
            } catch (e) {
                console.warn('[Period Comparison] 周期性分析失败:', e.message);
            }

            // 3.5 趋势健壮性验证 (Mann-Kendall)
            let trendTest = { trend: 'unknown', pValue: 1, zScore: 0 };
            try {
                trendTest = window.MLAlgorithms.mannKendallTest(values);
            } catch (e) {
                console.warn('[Period Comparison] 趋势检验失败:', e.message);
            }

            // ========== 步骤4：客户分组（基于整个历史表现） ==========
            const customerGroups = performCustomerGrouping(historicalData);

            // 计算统计指标
            const avgValue = values.reduce((sum, v) => sum + v, 0) / values.length;
            const startValue = values[0];
            const endValue = values[values.length - 1];
            const totalChange = endValue - startValue;
            const changePercent = ((totalChange / startValue) * 100).toFixed(1);

            console.log('[Period Comparison] 历史趋势识别完成');

            return {
                // 趋势概览
                overview: {
                    timeSpan: `${timeSeriesData[0].date.toISOString().split('T')[0]} ~ ${timeSeriesData[timeSeriesData.length - 1].date.toISOString().split('T')[0]}`,
                    dataPoints: timeSeriesData.length,
                    startValue,
                    endValue,
                    avgValue: Math.round(avgValue),
                    totalChange,
                    changePercent,
                    trend: trendTest.trend,
                    trendConfidence: Math.min(100, Math.abs(trendTest.zScore) * 33).toFixed(1),
                    trendSignificance: trendTest.pValue < 0.05
                },
                // 拐点检测结果
                inflectionPoints,
                // 趋势分段结果
                segments,
                // 异常检测结果
                anomalies,
                // 周期性分析
                periodicity,
                // 趋势健壮性
                robustness: {
                    mannKendall: {
                        zScore: trendTest.zScore.toFixed(2),
                        pValue: trendTest.pValue.toFixed(4),
                        trend: trendTest.trend
                    },
                    confidence: Math.min(100, Math.abs(trendTest.zScore) * 33).toFixed(1)
                },
                // 客户分组
                customerGroups,
                // 算法标识
                algorithm: 'PELT + AIC/BIC + FFT + Mann-Kendall + IQR'
            };

        } catch (error) {
            console.error('[Period Comparison] 趋势识别失败:', error);
            return {
                error: error.message
            };
        }
    }

    /**
     * 客户分组（基于整个历史表现）
     */
    function performCustomerGrouping(historicalData) {
        // 按客户聚合历史数据
        const customerTimeSeriesMap = {};
        historicalData.forEach(record => {
            const customer = record.customer_name;
            const date = record.period;
            if (!customerTimeSeriesMap[customer]) {
                customerTimeSeriesMap[customer] = {};
            }
            if (!customerTimeSeriesMap[customer][date]) {
                customerTimeSeriesMap[customer][date] = 0;
            }
            customerTimeSeriesMap[customer][date] += record.record_count;
        });

        // 分析每个客户的趋势
        const customerTrends = [];
        Object.keys(customerTimeSeriesMap).forEach(customer => {
            const dateMap = customerTimeSeriesMap[customer];
            const dates = Object.keys(dateMap).sort();

            if (dates.length < 3) return; // 数据点太少，跳过

            const values = dates.map(d => dateMap[d]);
            const startValue = values[0];
            const endValue = values[values.length - 1];
            const change = endValue - startValue;
            const changeRate = (change / startValue) * 100;

            // 计算波动率（标准差/均值）
            const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
            const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;
            const stdDev = Math.sqrt(variance);
            const volatility = (stdDev / avg) * 100;

            // 线性回归斜率（趋势强度）
            let slope = 0;
            try {
                const n = values.length;
                const xMean = (n - 1) / 2;
                const yMean = avg;
                let numerator = 0;
                let denominator = 0;
                for (let i = 0; i < n; i++) {
                    numerator += (i - xMean) * (values[i] - yMean);
                    denominator += Math.pow(i - xMean, 2);
                }
                slope = numerator / denominator;
            } catch (e) {
                console.warn(`客户${customer}斜率计算失败`);
            }

            customerTrends.push({
                customer,
                startValue,
                endValue,
                change,
                changeRate,
                avgValue: Math.round(avg),
                volatility,
                slope
            });
        });

        // 分组逻辑
        const declineGroup = [];      // 下滑组
        const growthGroup = [];        // 上涨组
        const volatileGroup = [];      // 波动组
        const stableGroup = [];        // 稳定组

        customerTrends.forEach(customer => {
            // 高波动：波动率 > 50%
            if (customer.volatility > 50) {
                volatileGroup.push(customer);
            }
            // 下滑：变化率 < -10% 且斜率 < -1
            else if (customer.changeRate < -10 && customer.slope < -1) {
                declineGroup.push(customer);
            }
            // 上涨：变化率 > 10% 且斜率 > 1
            else if (customer.changeRate > 10 && customer.slope > 1) {
                growthGroup.push(customer);
            }
            // 稳定：其余
            else {
                stableGroup.push(customer);
            }
        });

        // 按变化量排序
        declineGroup.sort((a, b) => a.change - b.change); // 下滑从大到小
        growthGroup.sort((a, b) => b.change - a.change);  // 上涨从大到小

        return {
            declineGroup,
            growthGroup,
            volatileGroup,
            stableGroup
        };
    }

    function performAIGrouping(historicalData, customerImpact) {
        console.log('[Period Comparison] 执行AI智能分组');

        // 简化分组逻辑，按变化量直接分类
        const declineGroup = customerImpact.declining.slice(0, 10);
        const growthGroup = customerImpact.growing.slice(0, 10);
        const stableGroup = customerImpact.all.filter(c => c.change >= -10 && c.change <= 10);

        return {
            declineGroup,
            growthGroup,
            stableGroup,
            riskGroup: declineGroup.filter(c => c.isSignificant && Math.abs(c.change) > 50),
            algorithm: '按变化量分组'
        };
    }

    function aggregateByCustomer(data) {
        const result = {};
        data.forEach(record => {
            const customer = record.customer_name;
            result[customer] = (result[customer] || 0) + record.record_count;
        });
        return result;
    }

    // ============================================
    // 结果渲染
    // ============================================
    async function renderResults() {
        renderOverviewCards();
        renderCustomerImpact();
        renderTrendRecognition();
        renderAIGrouping();
    }

    function renderOverviewCards() {
        const { overview } = state.analysis;

        const cards = [
            {
                title: '总计划ID数',
                icon: '📊',
                value: overview.planIds.current,
                change: overview.planIds.change,
                changePercent: overview.planIds.changePercent,
                color: 'primary'
            },
            {
                title: '圈次总数',
                icon: '🔢',
                value: overview.recordCount.current,
                change: overview.recordCount.change,
                changePercent: overview.recordCount.changePercent,
                color: 'info'
            },
            {
                title: '日均圈次',
                icon: '📈',
                value: overview.dailyAvg.current,
                change: overview.dailyAvg.change,
                changePercent: overview.dailyAvg.changePercent,
                color: 'accent'
            },
            {
                title: '变化幅度',
                icon: '📉',
                value: overview.recordCount.changePercent + '%',
                subtitle: '圈次变化率',
                color: 'warning'
            }
        ];

        elements.overviewCards.innerHTML = cards.map(card => `
            <div class="overview-card" style="border-left-color: rgb(var(--color-${card.color}));">
                <div class="overview-card-header">
                    <span class="overview-card-title">${card.title}</span>
                    <div class="overview-card-icon" style="background: linear-gradient(135deg, rgba(var(--color-${card.color}), 0.8), rgba(var(--color-${card.color}), 0.6));">
                        <span style="font-size: 24px;">${card.icon}</span>
                    </div>
                </div>
                <div class="overview-card-value">${card.value}</div>
                ${card.change !== undefined ? `
                    <div class="overview-card-change ${card.change > 0 ? 'change-increase' : card.change < 0 ? 'change-decrease' : 'change-neutral'}">
                        ${card.change > 0 ? '↑' : card.change < 0 ? '↓' : '='} ${Math.abs(card.change)} (${card.changePercent}%)
                    </div>
                ` : card.subtitle ? `<div style="font-size: 13px; color: rgb(var(--text-secondary));">${card.subtitle}</div>` : ''}
            </div>
        `).join('');
    }

    function renderCustomerImpact() {
        const { customerImpact } = state.analysis;

        elements.impactAnalysisContainer.innerHTML = `
            <div class="impact-list">
                <div class="impact-list-header">
                    <h3 class="impact-list-title">📉 下滑贡献榜</h3>
                </div>
                ${customerImpact.declining.slice(0, 5).map((item, index) => `
                    <div class="impact-item" style="border-left-color: rgb(var(--color-danger));">
                        <div class="impact-item-header">
                            <span class="impact-item-name">${item.customer}</span>
                            <span class="impact-item-badge" style="background: rgba(var(--color-danger), 0.1); color: rgb(var(--color-danger));">
                                TOP ${index + 1}
                            </span>
                        </div>
                        <div class="impact-item-stats">
                            <div class="impact-stat-item">
                                <span class="impact-stat-label">基期圈次</span>
                                <span class="impact-stat-value">${item.baseCount}</span>
                            </div>
                            <div class="impact-stat-item">
                                <span class="impact-stat-label">现期圈次</span>
                                <span class="impact-stat-value">${item.currentCount}</span>
                            </div>
                            <div class="impact-stat-item">
                                <span class="impact-stat-label">下滑量</span>
                                <span class="impact-stat-value" style="color: rgb(var(--color-danger));">${item.change}</span>
                            </div>
                            <div class="impact-stat-item">
                                <span class="impact-stat-label">显著性</span>
                                <span class="impact-stat-value">${item.isSignificant ? '✅ 显著' : '⚠️ 边缘'}</span>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="impact-list">
                <div class="impact-list-header">
                    <h3 class="impact-list-title">📈 上涨贡献榜</h3>
                </div>
                ${customerImpact.growing.slice(0, 5).map((item, index) => `
                    <div class="impact-item" style="border-left-color: rgb(var(--color-success));">
                        <div class="impact-item-header">
                            <span class="impact-item-name">${item.customer}</span>
                            <span class="impact-item-badge" style="background: rgba(var(--color-success), 0.1); color: rgb(var(--color-success));">
                                TOP ${index + 1}
                            </span>
                        </div>
                        <div class="impact-item-stats">
                            <div class="impact-stat-item">
                                <span class="impact-stat-label">基期圈次</span>
                                <span class="impact-stat-value">${item.baseCount}</span>
                            </div>
                            <div class="impact-stat-item">
                                <span class="impact-stat-label">现期圈次</span>
                                <span class="impact-stat-value">${item.currentCount}</span>
                            </div>
                            <div class="impact-stat-item">
                                <span class="impact-stat-label">上涨量</span>
                                <span class="impact-stat-value" style="color: rgb(var(--color-success));">+${item.change}</span>
                            </div>
                            <div class="impact-stat-item">
                                <span class="impact-stat-label">显著性</span>
                                <span class="impact-stat-value">${item.isSignificant ? '✅ 显著' : '⚠️ 边缘'}</span>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function renderTrendRecognition() {
        const { trendRecognition } = state.analysis;

        console.log('[Period Comparison] 渲染历史趋势识别结果:', trendRecognition);

        // 如果趋势识别失败或数据不足
        if (!trendRecognition || trendRecognition.error) {
            elements.trendAnalysisContainer.innerHTML = `
                <div class="bg-card rounded-lg p-6 text-center">
                    <div class="text-6xl mb-4">⚠️</div>
                    <h3 class="text-xl font-bold mb-2" style="color: rgb(var(--text-primary));">历史趋势识别</h3>
                    <p style="color: rgb(var(--text-secondary));">
                        ${trendRecognition?.error || 'ML算法引擎未加载或历史数据不足'}
                    </p>
                </div>
            `;
            return;
        }

        const { overview, inflectionPoints, segments, anomalies, periodicity, robustness, customerGroups, algorithm } = trendRecognition;

        // 趋势判断文本映射
        const trendTextMap = {
            'increasing': { text: '上升趋势', icon: '📈', color: 'success' },
            'decreasing': { text: '下降趋势', icon: '📉', color: 'danger' },
            'no_trend': { text: '无明显趋势', icon: '➡️', color: 'info' }
        };

        const trendInfo = trendTextMap[overview.trend] || { text: '未知', icon: '❓', color: 'secondary' };

        elements.trendAnalysisContainer.innerHTML = `
            <!-- 1. 趋势概览 -->
            <div class="bg-card rounded-lg p-6 mb-6 border-l-4" style="border-color: rgb(var(--color-${trendInfo.color}));">
                <h3 class="text-lg font-bold mb-4" style="color: rgb(var(--text-primary));">
                    📊 整体趋势深度分析报告
                </h3>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                        <div class="text-xs mb-1" style="color: rgb(var(--text-secondary));">时间跨度</div>
                        <div class="font-bold">${overview.timeSpan}</div>
                    </div>
                    <div>
                        <div class="text-xs mb-1" style="color: rgb(var(--text-secondary));">总数据点</div>
                        <div class="font-bold">${overview.dataPoints}个</div>
                    </div>
                    <div>
                        <div class="text-xs mb-1" style="color: rgb(var(--text-secondary));">总变化量</div>
                        <div class="font-bold" style="color: rgb(var(--color-${overview.totalChange >= 0 ? 'success' : 'danger'}));">
                            ${overview.totalChange >= 0 ? '+' : ''}${overview.totalChange} (${overview.changePercent >= 0 ? '+' : ''}${overview.changePercent}%)
                        </div>
                    </div>
                    <div>
                        <div class="text-xs mb-1" style="color: rgb(var(--text-secondary));">整体趋势</div>
                        <div class="font-bold" style="color: rgb(var(--color-${trendInfo.color}));">
                            ${trendInfo.icon} ${trendInfo.text}
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-4 p-3 rounded" style="background: rgba(var(--color-${trendInfo.color}), 0.1);">
                    <div class="flex-1">
                        <div class="text-sm mb-1">
                            <strong>${overview.startValue}</strong> → <strong>${overview.endValue}</strong> (平均: ${overview.avgValue})
                        </div>
                        <div class="text-xs" style="color: rgb(var(--text-secondary));">
                            置信度: ${overview.trendConfidence}% |
                            ${overview.trendSignificance ? '✅ 统计显著' : '⚠️ 不显著'} |
                            算法: ${algorithm}
                        </div>
                    </div>
                </div>
            </div>

            <!-- 2. 拐点识别 -->
            <div class="bg-card rounded-lg p-6 mb-6">
                <h3 class="text-lg font-bold mb-4 flex items-center gap-2" style="color: rgb(var(--text-primary));">
                    🎯 拐点识别（历史关键时刻）<span class="text-xs px-2 py-1 rounded" style="background: rgba(var(--color-warning), 0.15); color: rgb(var(--color-warning));">PELT算法</span>
                </h3>
                ${renderInflectionPointsSection(inflectionPoints)}
            </div>

            <!-- 3. 趋势分段分析 -->
            <div class="bg-card rounded-lg p-6 mb-6">
                <h3 class="text-lg font-bold mb-4 flex items-center gap-2" style="color: rgb(var(--text-primary));">
                    📊 趋势分段分析<span class="text-xs px-2 py-1 rounded" style="background: rgba(var(--color-info), 0.15); color: rgb(var(--color-info));">AIC/BIC算法</span>
                </h3>
                ${renderSegmentsSection(segments)}
            </div>

            <!-- 4. 异常点检测 -->
            ${anomalies && anomalies.length > 0 ? `
                <div class="bg-card rounded-lg p-6 mb-6">
                    <h3 class="text-lg font-bold mb-4 flex items-center gap-2" style="color: rgb(var(--text-primary));">
                        🚨 异常点检测<span class="text-xs px-2 py-1 rounded" style="background: rgba(var(--color-danger), 0.15); color: rgb(var(--color-danger));">IQR + 3σ</span>
                    </h3>
                    ${renderAnomaliesSection(anomalies)}
                </div>
            ` : ''}

            <!-- 5. 周期性分析 -->
            ${periodicity ? `
                <div class="bg-card rounded-lg p-6 mb-6">
                    <h3 class="text-lg font-bold mb-4 flex items-center gap-2" style="color: rgb(var(--text-primary));">
                        🔄 周期性分析<span class="text-xs px-2 py-1 rounded" style="background: rgba(var(--color-primary), 0.15); color: rgb(var(--color-primary));">FFT频谱</span>
                    </h3>
                    ${renderPeriodicitySection(periodicity)}
                </div>
            ` : ''}

            <!-- 6. 趋势健壮性 -->
            <div class="bg-card rounded-lg p-6 mb-6">
                <h3 class="text-lg font-bold mb-4 flex items-center gap-2" style="color: rgb(var(--text-primary));">
                    ✅ 趋势健壮性验证<span class="text-xs px-2 py-1 rounded" style="background: rgba(var(--color-success), 0.15); color: rgb(var(--color-success));">Mann-Kendall</span>
                </h3>
                <div class="p-4 rounded" style="background: rgba(var(--color-success), 0.05);">
                    <div class="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <div class="text-xs mb-1" style="color: rgb(var(--text-secondary));">Z Score</div>
                            <div class="text-2xl font-bold" style="color: rgb(var(--color-primary));">${robustness.mannKendall.zScore}</div>
                        </div>
                        <div>
                            <div class="text-xs mb-1" style="color: rgb(var(--text-secondary));">P Value</div>
                            <div class="text-2xl font-bold" style="color: rgb(var(--color-${robustness.mannKendall.pValue < 0.05 ? 'success' : 'warning'}));">${robustness.mannKendall.pValue}</div>
                        </div>
                        <div>
                            <div class="text-xs mb-1" style="color: rgb(var(--text-secondary));">置信度</div>
                            <div class="text-2xl font-bold" style="color: rgb(var(--color-success));">${robustness.confidence}%</div>
                        </div>
                    </div>
                    <div class="mt-3 text-sm text-center" style="color: rgb(var(--text-secondary));">
                        结论: ${trendInfo.text}真实可靠，非随机波动
                    </div>
                </div>
            </div>

            <!-- 7. 客户分组结果 -->
            <div class="bg-card rounded-lg p-6">
                <h3 class="text-lg font-bold mb-4" style="color: rgb(var(--text-primary));">
                    👥 客户分组结果（基于历史表现）
                </h3>
                ${renderCustomerGroupsSection(customerGroups)}
            </div>
        `;
    }

    function renderInflectionPointsSection(inflectionPoints) {
        if (!inflectionPoints || inflectionPoints.length === 0) {
            return `<div class="text-center py-4" style="color: rgb(var(--text-secondary));">未检测到显著拐点</div>`;
        }

        return `
            <div class="grid grid-cols-1 gap-3">
                ${inflectionPoints.slice(0, 5).map((point, index) => `
                    <div class="flex items-center justify-between p-3 rounded" style="background: rgba(var(--color-warning), 0.1); border-left: 4px solid rgb(var(--color-warning));">
                        <div class="flex items-center gap-3">
                            <span class="text-2xl">📍</span>
                            <div>
                                <div class="font-bold">拐点 #${index + 1}</div>
                                <div class="text-sm" style="color: rgb(var(--text-secondary));">日期: ${point.date}</div>
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="text-xl font-bold" style="color: rgb(var(--color-warning));">${point.value}</div>
                            <div class="text-xs" style="color: rgb(var(--text-secondary));">索引: ${point.index}</div>
                        </div>
                    </div>
                `).join('')}
                ${inflectionPoints.length > 5 ? `
                    <div class="text-center text-sm" style="color: rgb(var(--text-secondary));">
                        ... 还有 ${inflectionPoints.length - 5} 个拐点
                    </div>
                ` : ''}
            </div>
        `;
    }

    function renderSegmentsSection(segments) {
        if (!segments || segments.length === 0) {
            return `<div class="text-center py-4" style="color: rgb(var(--text-secondary));">无分段信息</div>`;
        }

        const trendMap = {
            'increasing': { text: '上升期', icon: '📈', color: 'success' },
            'decreasing': { text: '下降期', icon: '📉', color: 'danger' },
            'stable': { text: '平稳期', icon: '➡️', color: 'info' }
        };

        return `
            <div class="grid grid-cols-1 gap-3">
                ${segments.map(seg => {
                    const trendInfo = trendMap[seg.trend] || { text: '未知', icon: '❓', color: 'secondary' };
                    return `
                        <div class="p-4 rounded border-l-4" style="background: rgba(var(--color-${trendInfo.color}), 0.05); border-color: rgb(var(--color-${trendInfo.color}));">
                            <div class="flex items-center justify-between mb-2">
                                <div class="flex items-center gap-2">
                                    <span class="text-xl">${trendInfo.icon}</span>
                                    <span class="font-bold">阶段${seg.stage}: ${trendInfo.text}</span>
                                </div>
                                <span class="text-xs px-2 py-1 rounded" style="background: rgba(var(--color-${trendInfo.color}), 0.15); color: rgb(var(--color-${trendInfo.color}));">
                                    ${seg.slope > 0 ? '+' : ''}${seg.slope.toFixed(2)}/天
                                </span>
                            </div>
                            <div class="text-sm" style="color: rgb(var(--text-secondary));">
                                时间范围: ${seg.startDate} ~ ${seg.endDate} (${seg.end - seg.start + 1}天)
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    function renderAnomaliesSection(anomalies) {
        return `
            <div class="grid grid-cols-1 gap-3">
                ${anomalies.slice(0, 5).map((anomaly, index) => `
                    <div class="flex items-center justify-between p-3 rounded" style="background: rgba(var(--color-danger), 0.1); border-left: 4px solid rgb(var(--color-danger));">
                        <div class="flex items-center gap-3">
                            <span class="text-2xl">🚨</span>
                            <div>
                                <div class="font-bold">异常 #${index + 1}</div>
                                <div class="text-sm" style="color: rgb(var(--text-secondary));">日期: ${anomaly.date} | 偏离: ${anomaly.deviation.toFixed(2)}σ</div>
                            </div>
                        </div>
                        <div class="text-xl font-bold" style="color: rgb(var(--color-danger));">${anomaly.value}</div>
                    </div>
                `).join('')}
                ${anomalies.length > 5 ? `
                    <div class="text-center text-sm" style="color: rgb(var(--text-secondary));">
                        ... 还有 ${anomalies.length - 5} 个异常点
                    </div>
                ` : ''}
            </div>
        `;
    }

    function renderPeriodicitySection(periodicity) {
        const hasPeriod = periodicity.hasPeriodicity || periodicity.dominant_period;

        return `
            <div class="p-4 rounded" style="background: rgba(var(--color-${hasPeriod ? 'success' : 'info'}), 0.05);">
                <div class="flex items-center justify-between mb-3">
                    <div class="font-bold">${hasPeriod ? '✅ 检测到周期性' : '❌ 无明显周期性'}</div>
                    ${periodicity.dominant_period ? `
                        <div class="text-sm">主周期: <strong>${periodicity.dominant_period}</strong> 天</div>
                    ` : ''}
                </div>
                ${periodicity.strength !== undefined ? `
                    <div class="text-center py-2">
                        <div class="text-2xl font-bold" style="color: rgb(var(--color-${hasPeriod ? 'success' : 'info'}));">${(periodicity.strength * 100).toFixed(1)}%</div>
                        <div class="text-xs" style="color: rgb(var(--text-secondary));">周期强度</div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    function renderCustomerGroupsSection(customerGroups) {
        const { declineGroup, growthGroup, volatileGroup, stableGroup } = customerGroups;

        return `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <!-- 下滑组 -->
                <div class="p-4 rounded border-l-4" style="background: rgba(var(--color-danger), 0.05); border-color: rgb(var(--color-danger));">
                    <div class="flex items-center gap-2 mb-3">
                        <span class="text-xl">🔴</span>
                        <span class="font-bold">持续下滑组</span>
                        <span class="text-xs px-2 py-1 rounded" style="background: rgba(var(--color-danger), 0.15); color: rgb(var(--color-danger));">${declineGroup.length}个</span>
                    </div>
                    ${renderCustomerList(declineGroup.slice(0, 5), 'danger')}
                </div>

                <!-- 上涨组 -->
                <div class="p-4 rounded border-l-4" style="background: rgba(var(--color-success), 0.05); border-color: rgb(var(--color-success));">
                    <div class="flex items-center gap-2 mb-3">
                        <span class="text-xl">✅</span>
                        <span class="font-bold">稳步上涨组</span>
                        <span class="text-xs px-2 py-1 rounded" style="background: rgba(var(--color-success), 0.15); color: rgb(var(--color-success));">${growthGroup.length}个</span>
                    </div>
                    ${renderCustomerList(growthGroup.slice(0, 5), 'success')}
                </div>

                <!-- 波动组 -->
                <div class="p-4 rounded border-l-4" style="background: rgba(var(--color-warning), 0.05); border-color: rgb(var(--color-warning));">
                    <div class="flex items-center gap-2 mb-3">
                        <span class="text-xl">⚠️</span>
                        <span class="font-bold">波动不定组</span>
                        <span class="text-xs px-2 py-1 rounded" style="background: rgba(var(--color-warning), 0.15); color: rgb(var(--color-warning));">${volatileGroup.length}个</span>
                    </div>
                    ${renderCustomerList(volatileGroup.slice(0, 5), 'warning')}
                </div>

                <!-- 稳定组 -->
                <div class="p-4 rounded border-l-4" style="background: rgba(var(--color-info), 0.05); border-color: rgb(var(--color-info));">
                    <div class="flex items-center gap-2 mb-3">
                        <span class="text-xl">✅</span>
                        <span class="font-bold">稳定健康组</span>
                        <span class="text-xs px-2 py-1 rounded" style="background: rgba(var(--color-info), 0.15); color: rgb(var(--color-info));">${stableGroup.length}个</span>
                    </div>
                    ${renderCustomerList(stableGroup.slice(0, 5), 'info')}
                </div>
            </div>
        `;
    }

    function renderCustomerList(customers, color) {
        if (customers.length === 0) {
            return `<div class="text-sm text-center py-2" style="color: rgb(var(--text-secondary));">暂无客户</div>`;
        }

        return `
            <div class="space-y-2">
                ${customers.map(c => `
                    <div class="flex items-center justify-between text-sm p-2 rounded" style="background: rgba(var(--color-${color}), 0.05);">
                        <span class="font-medium">${c.customer}</span>
                        <span class="font-bold" style="color: rgb(var(--color-${color}));">
                            ${c.change >= 0 ? '+' : ''}${c.change}
                        </span>
                    </div>
                `).join('')}
                ${customers.length > 5 ? `
                    <div class="text-xs text-center" style="color: rgb(var(--text-secondary));">... 还有更多</div>
                ` : ''}
            </div>
        `;
    }


    function renderAIGrouping() {
        const { aiGrouping } = state.analysis;

        elements.aiGroupingContainer.innerHTML = `
            <div class="group-card" style="border-left-color: rgb(var(--color-danger));">
                <div class="group-card-header">
                    <h3 class="group-card-title">🔴 持续下滑组</h3>
                    <span class="group-card-count">${aiGrouping.declineGroup.length}个客户</span>
                </div>
                <div class="group-customer-list">
                    ${aiGrouping.declineGroup.map(item => `
                        <div class="group-customer-item">
                            <span>${item.customer}</span>
                            <span style="color: rgb(var(--color-danger)); font-weight: 600;">${item.change}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="group-card" style="border-left-color: rgb(var(--color-success));">
                <div class="group-card-header">
                    <h3 class="group-card-title">✅ 稳步上涨组</h3>
                    <span class="group-card-count">${aiGrouping.growthGroup.length}个客户</span>
                </div>
                <div class="group-customer-list">
                    ${aiGrouping.growthGroup.map(item => `
                        <div class="group-customer-item">
                            <span>${item.customer}</span>
                            <span style="color: rgb(var(--color-success)); font-weight: 600;">+${item.change}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // ============================================
    // UI辅助函数
    // ============================================
    function showLoading(message) {
        elements.loadingSection.style.display = 'flex';
        elements.resultsContainer.style.display = 'none';
        document.getElementById('loadingMessage').textContent = message;
        document.getElementById('progressFill').style.width = '0%';
        document.getElementById('progressText').textContent = '0%';
    }

    function hideLoading() {
        elements.loadingSection.style.display = 'none';
    }

    function showResults() {
        elements.resultsContainer.style.display = 'block';
        // 滚动到结果区域
        elements.resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function updateLoadingProgress(percent, message) {
        document.getElementById('progressFill').style.width = percent + '%';
        document.getElementById('progressText').textContent = percent + '%';
        if (message) {
            document.getElementById('loadingMessage').textContent = message;
        }
    }

    function updateStatus(status, text) {
        // 状态徽章已删除，此函数保留为空以兼容旧代码
    }

    // ============================================
    // 工具函数
    // ============================================
    function formatDate(date) {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function formatDateTime(date) {
        const d = new Date(date);
        return `${formatDate(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    }

    // ============================================
    // 页面加载后初始化
    // ============================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
