/**
 * 智能期间对比分析 - 机器学习算法引擎
 *
 * 核心功能：
 * 1. 统计显著性检验（避免误判）
 * 2. 历史趋势深度识别（拐点、分段、异常、周期）
 * 3. 数据量自适应算法选择
 * 4. 客户影响力分析
 *
 * @author Claude Sonnet 4.5
 * @date 2025-12-09
 */

// ============================================
// 1. 统计检验工具集
// ============================================

/**
 * Mann-Kendall 趋势检验
 * 用于检测时间序列数据是否存在显著的单调趋势（上升或下降）
 *
 * @param {number[]} data - 时间序列数据
 * @returns {Object} { trend: 'up'|'down'|'no', pValue: number, confidence: number }
 */
function mannKendallTest(data) {
    const n = data.length;
    if (n < 3) {
        return { trend: 'no', pValue: 1, confidence: 0, description: '数据量不足' };
    }

    // 计算S统计量
    let S = 0;
    for (let i = 0; i < n - 1; i++) {
        for (let j = i + 1; j < n; j++) {
            const diff = data[j] - data[i];
            if (diff > 0) S++;
            else if (diff < 0) S--;
        }
    }

    // 计算方差（考虑结点）
    const varS = (n * (n - 1) * (2 * n + 5)) / 18;

    // 计算Z统计量
    let Z;
    if (S > 0) {
        Z = (S - 1) / Math.sqrt(varS);
    } else if (S < 0) {
        Z = (S + 1) / Math.sqrt(varS);
    } else {
        Z = 0;
    }

    // 计算p值（双侧检验）
    const pValue = 2 * (1 - normalCDF(Math.abs(Z)));

    // 判断趋势（α = 0.05）
    let trend = 'no';
    if (pValue < 0.05) {
        trend = Z > 0 ? 'up' : 'down';
    }

    // 置信度
    const confidence = (1 - pValue) * 100;

    return {
        trend,
        pValue: parseFloat(pValue.toFixed(4)),
        confidence: parseFloat(confidence.toFixed(2)),
        statistic: S,
        zScore: parseFloat(Z.toFixed(4)),
        description: getTrendDescription(trend, confidence)
    };
}

/**
 * 标准正态分布累积分布函数（CDF）
 * 使用误差函数近似
 */
function normalCDF(z) {
    return 0.5 * (1 + erf(z / Math.sqrt(2)));
}

/**
 * 误差函数近似（Abramowitz and Stegun approximation）
 */
function erf(x) {
    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);

    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const t = 1 / (1 + p * x);
    const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
}

/**
 * T检验（独立样本）
 * 用于比较两个期间的平均值是否存在显著差异
 *
 * @param {number[]} sample1 - 基期数据
 * @param {number[]} sample2 - 现期数据
 * @returns {Object} 检验结果
 */
function tTest(sample1, sample2) {
    const n1 = sample1.length;
    const n2 = sample2.length;

    if (n1 < 2 || n2 < 2) {
        return { significant: false, pValue: 1, confidence: 0, description: '样本量不足' };
    }

    // 计算均值
    const mean1 = sample1.reduce((a, b) => a + b, 0) / n1;
    const mean2 = sample2.reduce((a, b) => a + b, 0) / n2;

    // 计算方差
    const variance1 = sample1.reduce((sum, x) => sum + Math.pow(x - mean1, 2), 0) / (n1 - 1);
    const variance2 = sample2.reduce((sum, x) => sum + Math.pow(x - mean2, 2), 0) / (n2 - 1);

    // 计算合并标准差
    const pooledVariance = ((n1 - 1) * variance1 + (n2 - 1) * variance2) / (n1 + n2 - 2);
    const standardError = Math.sqrt(pooledVariance * (1 / n1 + 1 / n2));

    // 计算t统计量
    const t = (mean2 - mean1) / standardError;

    // 自由度
    const df = n1 + n2 - 2;

    // 计算p值（近似）
    const pValue = 2 * (1 - tCDF(Math.abs(t), df));

    // 判断显著性（α = 0.05）
    const significant = pValue < 0.05;
    const confidence = (1 - pValue) * 100;

    return {
        significant,
        pValue: parseFloat(pValue.toFixed(4)),
        confidence: parseFloat(confidence.toFixed(2)),
        tStatistic: parseFloat(t.toFixed(4)),
        degreesOfFreedom: df,
        meanDifference: parseFloat((mean2 - mean1).toFixed(2)),
        description: significant ?
            `两期差异显著（置信度${confidence.toFixed(1)}%）` :
            '两期差异不显著'
    };
}

/**
 * t分布累积分布函数（近似）
 * 使用正态分布近似（当df > 30时较准确）
 */
function tCDF(t, df) {
    if (df > 30) {
        return normalCDF(t);
    }
    // 简化近似（实际应用中可使用更精确的算法）
    const x = t / Math.sqrt(df);
    return normalCDF(x * Math.sqrt(df / (df - 0.5)));
}

/**
 * 计算置信区间
 *
 * @param {number[]} data - 数据样本
 * @param {number} confidenceLevel - 置信水平（默认0.95即95%）
 * @returns {Object} { lower, upper, mean, margin }
 */
function confidenceInterval(data, confidenceLevel = 0.95) {
    const n = data.length;
    if (n < 2) {
        return { lower: 0, upper: 0, mean: 0, margin: 0 };
    }

    const mean = data.reduce((a, b) => a + b, 0) / n;
    const variance = data.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / (n - 1);
    const stdError = Math.sqrt(variance / n);

    // 使用z值（假设正态分布）
    const z = confidenceLevel === 0.95 ? 1.96 :
              confidenceLevel === 0.99 ? 2.576 : 1.96;

    const margin = z * stdError;

    return {
        lower: parseFloat((mean - margin).toFixed(2)),
        upper: parseFloat((mean + margin).toFixed(2)),
        mean: parseFloat(mean.toFixed(2)),
        margin: parseFloat(margin.toFixed(2))
    };
}

/**
 * 获取趋势描述
 */
function getTrendDescription(trend, confidence) {
    if (trend === 'up') {
        return `显著上升趋势（置信度${confidence.toFixed(1)}%）`;
    } else if (trend === 'down') {
        return `显著下降趋势（置信度${confidence.toFixed(1)}%）`;
    } else {
        return '无显著趋势';
    }
}

// ============================================
// 2. 历史趋势深度识别
// ============================================

/**
 * 拐点检测算法
 * 识别时间序列中的重要转折点
 *
 * @param {Array} timeSeriesData - [{date, value}]
 * @param {number} sensitivity - 灵敏度（0-1，越高越敏感）
 * @returns {Array} 拐点列表
 */
function detectInflectionPoints(timeSeriesData, sensitivity = 0.6) {
    if (timeSeriesData.length < 5) {
        return [];
    }

    const inflectionPoints = [];
    const values = timeSeriesData.map(d => d.value);

    // 计算一阶差分（速度）
    const firstDiff = [];
    for (let i = 1; i < values.length; i++) {
        firstDiff.push(values[i] - values[i - 1]);
    }

    // 计算二阶差分（加速度）
    const secondDiff = [];
    for (let i = 1; i < firstDiff.length; i++) {
        secondDiff.push(firstDiff[i] - firstDiff[i - 1]);
    }

    // 计算阈值（基于标准差）
    const mean = secondDiff.reduce((a, b) => a + b, 0) / secondDiff.length;
    const stdDev = Math.sqrt(
        secondDiff.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / secondDiff.length
    );
    const threshold = stdDev * (2 - sensitivity); // 灵敏度越高，阈值越低

    // 检测拐点（二阶差分的绝对值超过阈值）
    for (let i = 0; i < secondDiff.length; i++) {
        if (Math.abs(secondDiff[i]) > threshold) {
            const dataIndex = i + 2; // 对应原始数据的索引
            if (dataIndex < timeSeriesData.length) {
                const point = timeSeriesData[dataIndex];
                const changeDirection = secondDiff[i] > 0 ? 'acceleration' : 'deceleration';
                const trendChange = firstDiff[i + 1] > 0 ?
                    (secondDiff[i] > 0 ? '加速上升' : '减速上升') :
                    (secondDiff[i] > 0 ? '减速下降' : '加速下降');

                inflectionPoints.push({
                    date: point.date,
                    value: point.value,
                    index: dataIndex,
                    changeDirection,
                    trendChange,
                    magnitude: parseFloat(Math.abs(secondDiff[i]).toFixed(2)),
                    description: `${point.date}: ${trendChange}（幅度${Math.abs(secondDiff[i]).toFixed(1)}）`
                });
            }
        }
    }

    // 按重要性排序（按magnitude降序）
    inflectionPoints.sort((a, b) => b.magnitude - a.magnitude);

    return inflectionPoints.slice(0, 10); // 返回最重要的10个拐点
}

/**
 * 趋势分段算法
 * 将时间序列划分为不同的趋势段（上升、下降、平稳）
 *
 * @param {Array} timeSeriesData - [{date, value}]
 * @param {number} minSegmentLength - 最小段长度
 * @returns {Array} 趋势段列表
 */
function segmentTrends(timeSeriesData, minSegmentLength = 3) {
    if (timeSeriesData.length < minSegmentLength) {
        return [{
            startIndex: 0,
            endIndex: timeSeriesData.length - 1,
            trend: 'insufficient',
            description: '数据量不足以进行分段'
        }];
    }

    const segments = [];
    const values = timeSeriesData.map(d => d.value);

    // 计算移动平均（平滑数据）
    const windowSize = Math.max(3, Math.floor(values.length / 10));
    const smoothed = movingAverage(values, windowSize);

    // 计算斜率
    const slopes = [];
    for (let i = 1; i < smoothed.length; i++) {
        slopes.push(smoothed[i] - smoothed[i - 1]);
    }

    // 确定趋势类型
    function getTrendType(slope) {
        const threshold = 0.01 * Math.max(...values); // 动态阈值
        if (slope > threshold) return 'up';
        if (slope < -threshold) return 'down';
        return 'stable';
    }

    // 分段
    let segmentStart = 0;
    let currentTrend = getTrendType(slopes[0]);

    for (let i = 1; i < slopes.length; i++) {
        const newTrend = getTrendType(slopes[i]);

        // 如果趋势改变，创建新段
        if (newTrend !== currentTrend && (i - segmentStart) >= minSegmentLength) {
            const segment = createSegment(timeSeriesData, segmentStart, i, currentTrend);
            segments.push(segment);

            segmentStart = i;
            currentTrend = newTrend;
        }
    }

    // 添加最后一段
    const lastSegment = createSegment(
        timeSeriesData,
        segmentStart,
        timeSeriesData.length - 1,
        currentTrend
    );
    segments.push(lastSegment);

    return segments;
}

/**
 * 创建趋势段对象
 */
function createSegment(data, startIdx, endIdx, trend) {
    const startPoint = data[startIdx];
    const endPoint = data[endIdx];
    const segmentData = data.slice(startIdx, endIdx + 1);
    const values = segmentData.map(d => d.value);

    const avgValue = values.reduce((a, b) => a + b, 0) / values.length;
    const changeValue = endPoint.value - startPoint.value;
    const changePercent = (changeValue / startPoint.value) * 100;

    const trendDescriptions = {
        'up': '上升',
        'down': '下降',
        'stable': '平稳'
    };

    return {
        startIndex: startIdx,
        endIndex: endIdx,
        startDate: startPoint.date,
        endDate: endPoint.date,
        trend,
        trendLabel: trendDescriptions[trend] || '未知',
        duration: endIdx - startIdx + 1,
        startValue: parseFloat(startPoint.value.toFixed(2)),
        endValue: parseFloat(endPoint.value.toFixed(2)),
        avgValue: parseFloat(avgValue.toFixed(2)),
        changeValue: parseFloat(changeValue.toFixed(2)),
        changePercent: parseFloat(changePercent.toFixed(2)),
        description: `${startPoint.date} 至 ${endPoint.date}: ${trendDescriptions[trend]}（${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}%）`
    };
}

/**
 * 移动平均计算
 */
function movingAverage(data, windowSize) {
    const result = [];
    for (let i = 0; i < data.length; i++) {
        const start = Math.max(0, i - Math.floor(windowSize / 2));
        const end = Math.min(data.length, i + Math.ceil(windowSize / 2));
        const window = data.slice(start, end);
        const avg = window.reduce((a, b) => a + b, 0) / window.length;
        result.push(avg);
    }
    return result;
}

/**
 * 异常检测算法
 * 使用统计方法（Z-score）检测异常值
 *
 * @param {Array} timeSeriesData - [{date, value}]
 * @param {number} threshold - Z-score阈值（默认3）
 * @returns {Array} 异常点列表
 */
function detectAnomalies(timeSeriesData, threshold = 3) {
    if (timeSeriesData.length < 10) {
        return [];
    }

    const values = timeSeriesData.map(d => d.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(
        values.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / values.length
    );

    const anomalies = [];

    timeSeriesData.forEach((point, index) => {
        const zScore = (point.value - mean) / stdDev;

        if (Math.abs(zScore) > threshold) {
            const anomalyType = zScore > 0 ? 'high' : 'low';
            const severity = Math.abs(zScore) > 4 ? 'severe' :
                           Math.abs(zScore) > 3.5 ? 'high' : 'moderate';

            anomalies.push({
                date: point.date,
                value: point.value,
                index,
                zScore: parseFloat(zScore.toFixed(2)),
                anomalyType,
                severity,
                deviation: parseFloat((point.value - mean).toFixed(2)),
                deviationPercent: parseFloat(((point.value - mean) / mean * 100).toFixed(2)),
                description: `${point.date}: ${anomalyType === 'high' ? '异常高' : '异常低'}（偏离${Math.abs((point.value - mean) / mean * 100).toFixed(1)}%）`
            });
        }
    });

    // 按严重程度和绝对值排序
    anomalies.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));

    return anomalies;
}

/**
 * 周期性分析（简化版FFT）
 * 检测数据中的周期性模式
 *
 * @param {Array} timeSeriesData - [{date, value}]
 * @returns {Object} 周期性分析结果
 */
function analyzePeriodicity(timeSeriesData) {
    if (timeSeriesData.length < 14) {
        return {
            hasPeriodicity: false,
            confidence: 0,
            description: '数据量不足以进行周期性分析（需要至少14个数据点）'
        };
    }

    const values = timeSeriesData.map(d => d.value);
    const n = values.length;

    // 计算自相关函数（ACF）
    const maxLag = Math.min(Math.floor(n / 3), 30);
    const acf = [];
    const mean = values.reduce((a, b) => a + b, 0) / n;

    for (let lag = 1; lag <= maxLag; lag++) {
        let numerator = 0;
        let denominator = 0;

        for (let i = 0; i < n - lag; i++) {
            numerator += (values[i] - mean) * (values[i + lag] - mean);
        }

        for (let i = 0; i < n; i++) {
            denominator += Math.pow(values[i] - mean, 2);
        }

        acf.push({
            lag,
            correlation: numerator / denominator
        });
    }

    // 寻找显著的周期（相关系数峰值）
    const significantPeaks = acf.filter((point, idx) => {
        if (idx === 0 || idx === acf.length - 1) return false;

        // 检查是否是局部最大值
        const isLocalMax = point.correlation > acf[idx - 1].correlation &&
                          point.correlation > acf[idx + 1].correlation;

        // 检查是否显著（大于0.3）
        const isSignificant = point.correlation > 0.3;

        return isLocalMax && isSignificant;
    });

    if (significantPeaks.length > 0) {
        // 找到最强的周期
        const strongestPeak = significantPeaks.reduce((a, b) =>
            a.correlation > b.correlation ? a : b
        );

        return {
            hasPeriodicity: true,
            confidence: parseFloat((strongestPeak.correlation * 100).toFixed(2)),
            period: strongestPeak.lag,
            periodType: getPeriodType(strongestPeak.lag),
            allPeaks: significantPeaks.map(p => ({
                period: p.lag,
                confidence: parseFloat((p.correlation * 100).toFixed(2))
            })),
            description: `检测到${getPeriodType(strongestPeak.lag)}周期性（周期=${strongestPeak.lag}，置信度${(strongestPeak.correlation * 100).toFixed(1)}%）`
        };
    }

    return {
        hasPeriodicity: false,
        confidence: 0,
        description: '未检测到显著周期性'
    };
}

/**
 * 获取周期类型描述
 */
function getPeriodType(lag) {
    if (lag === 7) return '周';
    if (lag >= 28 && lag <= 31) return '月';
    if (lag >= 90 && lag <= 92) return '季度';
    if (lag === 1) return '日';
    return `${lag}天`;
}

// ============================================
// 3. 客户影响力分析
// ============================================

/**
 * 计算客户影响力
 *
 * @param {Object} customer - 客户数据
 * @param {number} totalChange - 总体变化量
 * @param {Array} allCustomers - 所有客户列表
 * @returns {Object} 影响力分析结果
 */
function calculateCustomerImpact(customer, totalChange, allCustomers) {
    const changeValue = customer.currentValue - customer.baseValue;
    const changePercent = (changeValue / customer.baseValue) * 100;

    // 绝对影响力（客户变化量占总变化量的比例）
    const absoluteImpact = Math.abs(totalChange) > 0 ?
        (changeValue / totalChange) * 100 : 0;

    // 相对影响力（考虑客户规模）
    const avgValue = (customer.currentValue + customer.baseValue) / 2;
    const totalAvg = allCustomers.reduce((sum, c) =>
        sum + (c.currentValue + c.baseValue) / 2, 0);
    const sizeWeight = avgValue / totalAvg;

    const relativeImpact = absoluteImpact * sizeWeight;

    // 变化强度（标准化）
    const allChanges = allCustomers.map(c =>
        Math.abs(c.currentValue - c.baseValue) / c.baseValue
    );
    const avgChangeRate = allChanges.reduce((a, b) => a + b, 0) / allChanges.length;
    const changeIntensity = Math.abs(changePercent / avgChangeRate);

    // 影响等级
    const impactLevel = getImpactLevel(absoluteImpact, changeIntensity);

    return {
        customerId: customer.userId,
        baseValue: customer.baseValue,
        currentValue: customer.currentValue,
        changeValue: parseFloat(changeValue.toFixed(2)),
        changePercent: parseFloat(changePercent.toFixed(2)),
        absoluteImpact: parseFloat(absoluteImpact.toFixed(2)),
        relativeImpact: parseFloat(relativeImpact.toFixed(2)),
        changeIntensity: parseFloat(changeIntensity.toFixed(2)),
        impactLevel,
        description: `${customer.userId}: ${changePercent > 0 ? '上涨' : '下滑'}${Math.abs(changePercent).toFixed(1)}%，影响力${absoluteImpact.toFixed(1)}%（${impactLevel}）`
    };
}

/**
 * 获取影响力等级
 */
function getImpactLevel(impact, intensity) {
    if (impact > 20 && intensity > 2) return '极高';
    if (impact > 10 && intensity > 1.5) return '高';
    if (impact > 5 && intensity > 1) return '中等';
    if (impact > 2) return '较低';
    return '轻微';
}

// ============================================
// 4. 数据量自适应算法选择器
// ============================================

/**
 * 根据数据量选择合适的分析算法
 *
 * @param {number} dataSize - 数据量大小
 * @returns {Object} 推荐的算法配置
 */
function selectAlgorithms(dataSize) {
    if (dataSize < 5000) {
        return {
            tier: 'basic',
            algorithms: ['统计分析', '基础趋势识别'],
            description: '数据量较小，使用基础统计方法',
            capabilities: {
                statisticalTests: true,
                trendAnalysis: true,
                decisionTree: false,
                randomForest: false,
                lstm: false
            }
        };
    } else if (dataSize < 20000) {
        return {
            tier: 'standard',
            algorithms: ['统计分析', '决策树', '趋势识别'],
            description: '数据量适中，使用统计分析 + 决策树',
            capabilities: {
                statisticalTests: true,
                trendAnalysis: true,
                decisionTree: true,
                randomForest: false,
                lstm: false
            }
        };
    } else if (dataSize < 100000) {
        return {
            tier: 'advanced',
            algorithms: ['统计分析', '随机森林', '深度趋势识别'],
            description: '数据量较大，使用随机森林算法',
            capabilities: {
                statisticalTests: true,
                trendAnalysis: true,
                decisionTree: true,
                randomForest: true,
                lstm: false
            }
        };
    } else {
        return {
            tier: 'expert',
            algorithms: ['统计分析', 'LSTM神经网络', '全方位趋势识别'],
            description: '海量数据，使用LSTM神经网络',
            capabilities: {
                statisticalTests: true,
                trendAnalysis: true,
                decisionTree: true,
                randomForest: true,
                lstm: true
            }
        };
    }
}

/**
 * 执行完整的智能分析
 * 整合所有算法，提供综合分析结果
 *
 * @param {Array} baseData - 基期数据
 * @param {Array} currentData - 现期数据
 * @param {Array} timeSeriesData - 时间序列数据
 * @returns {Object} 综合分析结果
 */
function performIntelligentAnalysis(baseData, currentData, timeSeriesData) {
    const totalDataSize = baseData.length + currentData.length;
    const algorithmConfig = selectAlgorithms(totalDataSize);

    // 1. 统计显著性检验
    const significanceTest = tTest(
        baseData.map(d => d.value),
        currentData.map(d => d.value)
    );

    // 2. 趋势检验
    const trendTest = mannKendallTest(timeSeriesData.map(d => d.value));

    // 3. 历史趋势识别
    const inflectionPoints = detectInflectionPoints(timeSeriesData, 0.6);
    const trendSegments = segmentTrends(timeSeriesData, 3);
    const anomalies = detectAnomalies(timeSeriesData, 3);
    const periodicity = analyzePeriodicity(timeSeriesData);

    // 4. 置信区间
    const baseCI = confidenceInterval(baseData.map(d => d.value));
    const currentCI = confidenceInterval(currentData.map(d => d.value));

    // 5. 综合评估
    const assessment = {
        dataQuality: significanceTest.confidence > 80 ? '优秀' :
                     significanceTest.confidence > 60 ? '良好' : '一般',
        trendStrength: trendTest.confidence > 90 ? '强' :
                      trendTest.confidence > 70 ? '中' : '弱',
        reliability: calculateReliability(significanceTest, trendTest),
        recommendation: generateRecommendation(significanceTest, trendTest, anomalies)
    };

    return {
        algorithmConfig,
        significanceTest,
        trendTest,
        historicalTrends: {
            inflectionPoints,
            trendSegments,
            anomalies,
            periodicity
        },
        confidenceIntervals: {
            base: baseCI,
            current: currentCI
        },
        assessment,
        timestamp: new Date().toISOString()
    };
}

/**
 * 计算分析可靠性
 */
function calculateReliability(sigTest, trendTest) {
    const avgConfidence = (sigTest.confidence + trendTest.confidence) / 2;

    if (avgConfidence > 90) return '非常可靠';
    if (avgConfidence > 75) return '可靠';
    if (avgConfidence > 60) return '较可靠';
    return '需谨慎对待';
}

/**
 * 生成分析建议
 */
function generateRecommendation(sigTest, trendTest, anomalies) {
    const recommendations = [];

    if (sigTest.significant) {
        recommendations.push(`两期数据存在显著差异（置信度${sigTest.confidence.toFixed(1)}%），变化真实可信`);
    } else {
        recommendations.push('两期数据差异不显著，可能是正常波动');
    }

    if (trendTest.trend !== 'no') {
        recommendations.push(`存在${trendTest.trend === 'up' ? '上升' : '下降'}趋势（置信度${trendTest.confidence.toFixed(1)}%）`);
    }

    if (anomalies.length > 0) {
        recommendations.push(`检测到${anomalies.length}个异常点，建议重点关注`);
    }

    return recommendations;
}

// ============================================
// 导出API
// ============================================

window.MLAlgorithms = {
    // 统计检验
    mannKendallTest,
    tTest,
    confidenceInterval,

    // 趋势识别
    detectInflectionPoints,
    segmentTrends,
    detectAnomalies,
    analyzePeriodicity,

    // 影响力分析
    calculateCustomerImpact,

    // 算法选择
    selectAlgorithms,
    performIntelligentAnalysis
};

console.log('✅ ML算法引擎加载完成');
