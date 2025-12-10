/**
 * 智能期间对比分析 - 时间序列高级算法
 *
 * 包含：
 * 1. LSTM神经网络（简化JavaScript实现）
 * 2. 傅里叶变换周期分析（FFT）
 * 3. PELT拐点检测算法
 * 4. AIC/BIC准则趋势分段
 *
 * @author Claude Sonnet 4.5
 * @date 2025-12-09
 */

// ============================================
// 1. LSTM神经网络（简化实现）
// ============================================

/**
 * LSTM层（简化版）
 * 注意：这是教学级别的简化实现，生产环境建议使用TensorFlow.js
 */
class LSTMCell {
    constructor(inputSize, hiddenSize) {
        this.inputSize = inputSize;
        this.hiddenSize = hiddenSize;

        // 初始化权重（简化：使用随机小值）
        this.Wf = this._randomMatrix(hiddenSize, inputSize + hiddenSize);  // 遗忘门
        this.Wi = this._randomMatrix(hiddenSize, inputSize + hiddenSize);  // 输入门
        this.Wc = this._randomMatrix(hiddenSize, inputSize + hiddenSize);  // 候选值
        this.Wo = this._randomMatrix(hiddenSize, inputSize + hiddenSize);  // 输出门

        this.bf = new Array(hiddenSize).fill(0);
        this.bi = new Array(hiddenSize).fill(0);
        this.bc = new Array(hiddenSize).fill(0);
        this.bo = new Array(hiddenSize).fill(0);
    }

    _randomMatrix(rows, cols) {
        const matrix = [];
        for (let i = 0; i < rows; i++) {
            const row = [];
            for (let j = 0; j < cols; j++) {
                row.push((Math.random() - 0.5) * 0.1);
            }
            matrix.push(row);
        }
        return matrix;
    }

    _sigmoid(x) {
        return 1 / (1 + Math.exp(-x));
    }

    _tanh(x) {
        return Math.tanh(x);
    }

    _matVecMul(matrix, vector) {
        return matrix.map(row =>
            row.reduce((sum, val, idx) => sum + val * vector[idx], 0)
        );
    }

    forward(x, h_prev, c_prev) {
        // 拼接输入和隐藏状态
        const concat = [...x, ...h_prev];

        // 遗忘门
        const f = this._matVecMul(this.Wf, concat).map((val, idx) =>
            this._sigmoid(val + this.bf[idx])
        );

        // 输入门
        const i = this._matVecMul(this.Wi, concat).map((val, idx) =>
            this._sigmoid(val + this.bi[idx])
        );

        // 候选值
        const c_tilde = this._matVecMul(this.Wc, concat).map((val, idx) =>
            this._tanh(val + this.bc[idx])
        );

        // 更新细胞状态
        const c = c_prev.map((val, idx) =>
            f[idx] * val + i[idx] * c_tilde[idx]
        );

        // 输出门
        const o = this._matVecMul(this.Wo, concat).map((val, idx) =>
            this._sigmoid(val + this.bo[idx])
        );

        // 隐藏状态
        const h = c.map((val, idx) => o[idx] * this._tanh(val));

        return { h, c };
    }
}

/**
 * 简化的LSTM模型
 * 仅用于演示，实际应用建议使用TensorFlow.js或PyTorch
 */
class SimpleLSTM {
    constructor(options = {}) {
        this.inputSize = options.inputSize || 1;
        this.hiddenSize = options.hiddenSize || 32;
        this.outputSize = options.outputSize || 1;
        this.sequenceLength = options.sequenceLength || 10;

        this.lstm = new LSTMCell(this.inputSize, this.hiddenSize);

        // 输出层权重
        this.Wy = this._randomMatrix(this.outputSize, this.hiddenSize);
        this.by = new Array(this.outputSize).fill(0);
    }

    _randomMatrix(rows, cols) {
        const matrix = [];
        for (let i = 0; i < rows; i++) {
            const row = [];
            for (let j = 0; j < cols; j++) {
                row.push((Math.random() - 0.5) * 0.1);
            }
            matrix.push(row);
        }
        return matrix;
    }

    _matVecMul(matrix, vector) {
        return matrix.map(row =>
            row.reduce((sum, val, idx) => sum + val * vector[idx], 0)
        );
    }

    /**
     * 预测（前向传播）
     * @param {Array} sequence - 输入序列 [[x1], [x2], ...]
     * @returns {Array} 预测值
     */
    predict(sequence) {
        let h = new Array(this.hiddenSize).fill(0);
        let c = new Array(this.hiddenSize).fill(0);

        // 遍历序列
        for (const x of sequence) {
            const result = this.lstm.forward(x, h, c);
            h = result.h;
            c = result.c;
        }

        // 输出层
        const y = this._matVecMul(this.Wy, h).map((val, idx) => val + this.by[idx]);

        return y;
    }

    /**
     * 训练（简化版 - 仅做前向传播演示）
     * 实际训练需要反向传播和优化器，建议使用专业库
     */
    fit(X, y, epochs = 10) {
        console.warn('SimpleLSTM.fit(): 这是简化演示版本，未实现完整的反向传播训练');
        console.warn('生产环境请使用 TensorFlow.js 或其他专业库');
        return this;
    }
}

/**
 * 时间序列预测（使用LSTM）
 *
 * @param {Array} timeSeriesData - 时间序列数据
 * @param {number} nFuture - 预测未来多少期
 * @returns {Object} 预测结果
 */
function predictWithLSTM(timeSeriesData, nFuture = 3) {
    if (timeSeriesData.length < 30) {
        return {
            predictions: [],
            error: 'LSTM需要至少30个数据点',
            recommendation: '使用ARIMA或简单移动平均代替'
        };
    }

    // 标准化数据
    const values = timeSeriesData.map(d => d.value);
    const mean = values.reduce((a, b) => a + b) / values.length;
    const std = Math.sqrt(
        values.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / values.length
    );

    const normalized = values.map(v => (v - mean) / (std || 1));

    // 创建LSTM模型
    const lstm = new SimpleLSTM({
        inputSize: 1,
        hiddenSize: 32,
        outputSize: 1,
        sequenceLength: 10
    });

    // 使用最后10个数据点作为输入
    const sequenceLength = Math.min(10, normalized.length);
    const inputSequence = normalized.slice(-sequenceLength).map(v => [v]);

    // 预测未来值
    const predictions = [];
    let currentSequence = [...inputSequence];

    for (let i = 0; i < nFuture; i++) {
        const pred = lstm.predict(currentSequence);
        predictions.push(pred[0]);

        // 滑动窗口
        currentSequence.shift();
        currentSequence.push(pred);
    }

    // 反标准化
    const denormalized = predictions.map(v => v * (std || 1) + mean);

    return {
        predictions: denormalized.map((val, idx) => ({
            period: `未来第${idx + 1}期`,
            value: parseFloat(val.toFixed(2))
        })),
        method: 'LSTM神经网络（简化版）',
        warning: '此为演示实现，实际应用请使用TensorFlow.js'
    };
}

// ============================================
// 2. 傅里叶变换周期分析（FFT）
// ============================================

/**
 * 快速傅里叶变换（FFT）
 * Cooley-Tukey算法
 */
function fft(x) {
    const N = x.length;

    // 基本情况
    if (N <= 1) return x;

    // 确保长度是2的幂
    if (N % 2 !== 0) {
        throw new Error('FFT要求序列长度为2的幂');
    }

    // 分治
    const even = fft(x.filter((_, i) => i % 2 === 0));
    const odd = fft(x.filter((_, i) => i % 2 === 1));

    const result = new Array(N);

    for (let k = 0; k < N / 2; k++) {
        const angle = -2 * Math.PI * k / N;
        const w = { re: Math.cos(angle), im: Math.sin(angle) };

        // 复数乘法: w * odd[k]
        const t = {
            re: w.re * odd[k].re - w.im * odd[k].im,
            im: w.re * odd[k].im + w.im * odd[k].re
        };

        // 蝶形运算
        result[k] = {
            re: even[k].re + t.re,
            im: even[k].im + t.im
        };

        result[k + N / 2] = {
            re: even[k].re - t.re,
            im: even[k].im - t.im
        };
    }

    return result;
}

/**
 * 将实数序列转换为复数
 */
function realToComplex(realArray) {
    return realArray.map(val => ({ re: val, im: 0 }));
}

/**
 * 计算复数的模
 */
function complexMagnitude(c) {
    return Math.sqrt(c.re * c.re + c.im * c.im);
}

/**
 * 补齐到最近的2的幂
 */
function padToPowerOf2(array) {
    const n = array.length;
    const nextPow2 = Math.pow(2, Math.ceil(Math.log2(n)));
    const padded = [...array];

    while (padded.length < nextPow2) {
        padded.push(0);
    }

    return padded;
}

/**
 * 傅里叶变换周期性分析
 *
 * @param {Array} timeSeriesData - 时间序列数据
 * @returns {Object} 周期性分析结果
 */
function analyzePeriodicity_FFT(timeSeriesData) {
    if (timeSeriesData.length < 8) {
        return {
            hasPeriodicity: false,
            confidence: 0,
            description: '数据量不足（需要至少8个数据点）'
        };
    }

    const values = timeSeriesData.map(d => d.value);

    // 去除趋势（简单差分）
    const detrended = [];
    for (let i = 1; i < values.length; i++) {
        detrended.push(values[i] - values[i - 1]);
    }

    // 补齐到2的幂
    const padded = padToPowerOf2(detrended);

    // FFT
    const complex = realToComplex(padded);
    const fftResult = fft(complex);

    // 计算功率谱
    const powerSpectrum = fftResult.slice(1, fftResult.length / 2).map(complexMagnitude);

    // 找出峰值
    const peaks = [];
    for (let i = 1; i < powerSpectrum.length - 1; i++) {
        if (powerSpectrum[i] > powerSpectrum[i - 1] &&
            powerSpectrum[i] > powerSpectrum[i + 1]) {
            peaks.push({
                index: i,
                magnitude: powerSpectrum[i],
                period: padded.length / (i + 1)  // 周期
            });
        }
    }

    // 按幅度排序
    peaks.sort((a, b) => b.magnitude - a.magnitude);

    if (peaks.length === 0) {
        return {
            hasPeriodicity: false,
            confidence: 0,
            description: '未检测到显著周期性（FFT）'
        };
    }

    // 最强周期
    const dominantPeak = peaks[0];
    const period = Math.round(dominantPeak.period);

    // 计算置信度（基于峰值与平均功率的比值）
    const avgPower = powerSpectrum.reduce((a, b) => a + b, 0) / powerSpectrum.length;
    const confidence = Math.min(100, (dominantPeak.magnitude / avgPower - 1) * 100);

    return {
        hasPeriodicity: confidence > 30,
        confidence: parseFloat(confidence.toFixed(2)),
        period,
        periodType: getPeriodType(period),
        allPeaks: peaks.slice(0, 3).map(p => ({
            period: Math.round(p.period),
            confidence: parseFloat(Math.min(100, (p.magnitude / avgPower - 1) * 100).toFixed(2))
        })),
        method: 'FFT傅里叶变换',
        description: `检测到${getPeriodType(period)}周期性（周期=${period}，置信度${confidence.toFixed(1)}%，FFT）`
    };
}

function getPeriodType(period) {
    if (period >= 6 && period <= 8) return '周';
    if (period >= 28 && period <= 32) return '月';
    if (period >= 90 && period <= 95) return '季度';
    if (period === 1) return '日';
    return `${period}天`;
}

// ============================================
// 3. PELT拐点检测算法
// ============================================

/**
 * PELT (Pruned Exact Linear Time) 拐点检测
 * 用于精确检测时间序列的变点
 */
function detectInflectionPoints_PELT(timeSeriesData, penalty = 'BIC', minSegmentLength = 2) {
    const n = timeSeriesData.length;

    if (n < minSegmentLength * 2) {
        return [];
    }

    const values = timeSeriesData.map(d => d.value);

    // 计算成本函数（基于方差）
    function segmentCost(start, end) {
        if (end - start < 1) return Infinity;

        const segment = values.slice(start, end + 1);
        const mean = segment.reduce((a, b) => a + b) / segment.length;
        const variance = segment.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0);

        return variance;
    }

    // 确定惩罚项
    let beta;
    if (penalty === 'BIC') {
        beta = Math.log(n) * 2;  // BIC惩罚
    } else if (penalty === 'AIC') {
        beta = 4;                 // AIC惩罚
    } else {
        beta = penalty;           // 自定义惩罚
    }

    // PELT动态规划
    const F = new Array(n + 1).fill(Infinity);
    const cp = new Array(n + 1).fill(-1);
    F[0] = -beta;

    let R = [0];  // 候选变点集合（剪枝）

    for (let t = minSegmentLength; t <= n; t++) {
        const newR = [];

        for (const tau of R) {
            if (tau + minSegmentLength > t) continue;

            const cost = F[tau] + segmentCost(tau, t - 1) + beta;

            if (cost < F[t]) {
                F[t] = cost;
                cp[t] = tau;
            }

            // 剪枝：只保留有潜力的候选点
            if (cost <= F[t]) {
                newR.push(tau);
            }
        }

        newR.push(t);
        R = newR;
    }

    // 回溯找出变点
    const changepoints = [];
    let current = n;

    while (cp[current] > 0) {
        changepoints.unshift(cp[current]);
        current = cp[current];
    }

    // 转换为拐点信息
    const inflectionPoints = changepoints.map(idx => {
        if (idx >= timeSeriesData.length) return null;

        const point = timeSeriesData[idx];

        // 判断拐点类型
        let trendChange = '未知';
        if (idx > 0 && idx < timeSeriesData.length - 1) {
            const before = values.slice(Math.max(0, idx - 3), idx);
            const after = values.slice(idx, Math.min(values.length, idx + 3));

            const beforeSlope = (before[before.length - 1] - before[0]) / before.length;
            const afterSlope = (after[after.length - 1] - after[0]) / after.length;

            if (beforeSlope > 0 && afterSlope < 0) trendChange = '上升转下降';
            else if (beforeSlope < 0 && afterSlope > 0) trendChange = '下降转上升';
            else if (Math.abs(afterSlope) > Math.abs(beforeSlope)) trendChange = '趋势加速';
            else trendChange = '趋势减缓';
        }

        return {
            date: point.date,
            value: point.value,
            index: idx,
            trendChange,
            method: 'PELT',
            description: `${point.date}: ${trendChange}（PELT检测）`
        };
    }).filter(p => p !== null);

    return inflectionPoints;
}

// ============================================
// 4. AIC/BIC准则趋势分段
// ============================================

/**
 * 使用AIC/BIC准则选择最优分段数
 *
 * @param {Array} timeSeriesData - 时间序列数据
 * @param {string} criterion - 'AIC' 或 'BIC'
 * @param {number} maxSegments - 最大分段数
 * @returns {Array} 最优分段结果
 */
function segmentTrends_AIC_BIC(timeSeriesData, criterion = 'BIC', maxSegments = 10) {
    const n = timeSeriesData.length;

    if (n < 6) {
        return [{
            startIndex: 0,
            endIndex: n - 1,
            description: '数据量不足'
        }];
    }

    const values = timeSeriesData.map(d => d.value);

    // 计算分段的RSS（残差平方和）
    function calculateRSS(segment) {
        if (segment.length < 2) return Infinity;

        // 线性回归
        const n = segment.length;
        const x = Array.from({ length: n }, (_, i) => i);
        const y = segment;

        const meanX = x.reduce((a, b) => a + b) / n;
        const meanY = y.reduce((a, b) => a + b) / n;

        let numerator = 0;
        let denominator = 0;

        for (let i = 0; i < n; i++) {
            numerator += (x[i] - meanX) * (y[i] - meanY);
            denominator += Math.pow(x[i] - meanX, 2);
        }

        const slope = denominator > 0 ? numerator / denominator : 0;
        const intercept = meanY - slope * meanX;

        // 计算RSS
        let rss = 0;
        for (let i = 0; i < n; i++) {
            const predicted = slope * x[i] + intercept;
            rss += Math.pow(y[i] - predicted, 2);
        }

        return { rss, slope, intercept };
    }

    // 尝试不同的分段数
    const results = [];

    for (let k = 1; k <= Math.min(maxSegments, Math.floor(n / 3)); k++) {
        // 使用动态规划找到最优分段点
        const segments = findOptimalSegments(values, k);

        // 计算总RSS
        let totalRSS = 0;
        const segmentDetails = [];

        for (const seg of segments) {
            const segmentValues = values.slice(seg.start, seg.end + 1);
            const { rss, slope, intercept } = calculateRSS(segmentValues);
            totalRSS += rss;

            segmentDetails.push({
                startIndex: seg.start,
                endIndex: seg.end,
                startDate: timeSeriesData[seg.start].date,
                endDate: timeSeriesData[seg.end].date,
                slope,
                intercept,
                rss
            });
        }

        // 计算参数数量（每个分段有2个参数：斜率和截距）
        const numParams = k * 2;

        // 计算AIC/BIC
        let ic;
        if (criterion === 'AIC') {
            ic = n * Math.log(totalRSS / n) + 2 * numParams;
        } else {  // BIC
            ic = n * Math.log(totalRSS / n) + Math.log(n) * numParams;
        }

        results.push({
            k,
            ic,
            totalRSS,
            segments: segmentDetails
        });
    }

    // 选择IC最小的
    results.sort((a, b) => a.ic - b.ic);
    const best = results[0];

    // 完善分段信息
    return best.segments.map(seg => {
        const trend = seg.slope > 0.01 * values[seg.startIndex] ? 'up' :
                     seg.slope < -0.01 * values[seg.startIndex] ? 'down' : 'stable';

        const trendLabel = trend === 'up' ? '上升' :
                          trend === 'down' ? '下降' : '平稳';

        const changePercent = seg.slope * (seg.endIndex - seg.startIndex) / values[seg.startIndex] * 100;

        return {
            ...seg,
            trend,
            trendLabel,
            duration: seg.endIndex - seg.startIndex + 1,
            changePercent: parseFloat(changePercent.toFixed(2)),
            method: criterion,
            description: `${seg.startDate} 至 ${seg.endDate}: ${trendLabel}（${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}%，${criterion}准则）`
        };
    });
}

/**
 * 使用动态规划找到k个最优分段点
 */
function findOptimalSegments(values, k) {
    const n = values.length;

    // 预计算所有可能分段的RSS
    const rssCache = {};

    function getRSS(start, end) {
        const key = `${start}-${end}`;
        if (rssCache[key] !== undefined) return rssCache[key];

        const segment = values.slice(start, end + 1);

        if (segment.length < 2) {
            rssCache[key] = Infinity;
            return Infinity;
        }

        // 线性回归
        const m = segment.length;
        const x = Array.from({ length: m }, (_, i) => i);
        const y = segment;

        const meanX = x.reduce((a, b) => a + b) / m;
        const meanY = y.reduce((a, b) => a + b) / m;

        let numerator = 0;
        let denominator = 0;

        for (let i = 0; i < m; i++) {
            numerator += (x[i] - meanX) * (y[i] - meanY);
            denominator += Math.pow(x[i] - meanX, 2);
        }

        const slope = denominator > 0 ? numerator / denominator : 0;
        const intercept = meanY - slope * meanX;

        let rss = 0;
        for (let i = 0; i < m; i++) {
            const predicted = slope * x[i] + intercept;
            rss += Math.pow(y[i] - predicted, 2);
        }

        rssCache[key] = rss;
        return rss;
    }

    // 动态规划
    const dp = Array(n).fill(null).map(() => Array(k + 1).fill(Infinity));
    const splitPoints = Array(n).fill(null).map(() => Array(k + 1).fill(-1));

    // 初始化：1个分段
    for (let i = 0; i < n; i++) {
        dp[i][1] = getRSS(0, i);
    }

    // 填充DP表
    for (let i = 0; i < n; i++) {
        for (let j = 2; j <= k && j <= i + 1; j++) {
            for (let t = j - 2; t < i; t++) {
                const cost = dp[t][j - 1] + getRSS(t + 1, i);
                if (cost < dp[i][j]) {
                    dp[i][j] = cost;
                    splitPoints[i][j] = t;
                }
            }
        }
    }

    // 回溯找出分段点
    const segments = [];
    let end = n - 1;
    let numSegs = k;

    while (numSegs > 0 && end >= 0) {
        const start = numSegs === 1 ? 0 : splitPoints[end][numSegs] + 1;
        segments.unshift({ start, end });
        end = splitPoints[end][numSegs];
        numSegs--;
    }

    return segments;
}

// 导出API
window.MLAlgorithmsTimeSeries = {
    // LSTM
    SimpleLSTM,
    predictWithLSTM,

    // 傅里叶变换
    fft,
    analyzePeriodicity_FFT,

    // PELT
    detectInflectionPoints_PELT,

    // AIC/BIC
    segmentTrends_AIC_BIC
};

console.log('✅ 时间序列高级算法加载完成（LSTM、FFT、PELT、AIC/BIC）');
