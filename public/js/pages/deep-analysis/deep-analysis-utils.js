/**
 * 深度分析工具函数库
 * 包含移动平均、趋势分析、下滑检测等算法
 */

/**
 * 计算移动平均
 * @param {number[]} data - 数据数组
 * @param {number} window - 窗口大小
 * @returns {number[]} 移动平均数组
 */
function calculateMovingAverage(data, window) {
    if (!data || data.length === 0) return [];
    if (window <= 0 || window > data.length) return data;

    const result = [];

    for (let i = 0; i < data.length; i++) {
        if (i < window - 1) {
            // 前面不足窗口大小的点，使用已有数据的平均
            const subset = data.slice(0, i + 1);
            const avg = subset.reduce((sum, val) => sum + val, 0) / subset.length;
            result.push(avg);
        } else {
            // 正常窗口计算
            const subset = data.slice(i - window + 1, i + 1);
            const avg = subset.reduce((sum, val) => sum + val, 0) / window;
            result.push(avg);
        }
    }

    return result;
}

/**
 * 检测趋势下滑
 * @param {number[]} movingAvg - 移动平均数组
 * @param {number} threshold - 下滑阈值百分比 (默认5%)
 * @returns {Object} 下滑分析结果
 */
function detectTrendDecline(movingAvg, threshold = 5) {
    if (!movingAvg || movingAvg.length < 2) {
        return {
            isDecline: false,
            status: 'insufficient_data',
            message: '数据不足，无法进行趋势分析'
        };
    }

    // 计算整体趋势
    const firstHalf = movingAvg.slice(0, Math.floor(movingAvg.length / 2));
    const secondHalf = movingAvg.slice(Math.floor(movingAvg.length / 2));

    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;

    const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;

    // 计算最近趋势 (最后1/3)
    const recentPeriod = movingAvg.slice(-Math.ceil(movingAvg.length / 3));
    const recentStart = recentPeriod[0];
    const recentEnd = recentPeriod[recentPeriod.length - 1];
    const recentChange = ((recentEnd - recentStart) / recentStart) * 100;

    // 判断趋势状态
    let status, message;
    if (changePercent < -threshold) {
        status = 'declining';
        message = `总体下降 ${Math.abs(changePercent).toFixed(2)}%，需要关注`;
    } else if (changePercent > threshold) {
        status = 'growing';
        message = `总体增长 ${changePercent.toFixed(2)}%，趋势良好`;
    } else {
        status = 'stable';
        message = `总体变化 ${changePercent.toFixed(2)}%，趋势平稳`;
    }

    return {
        isDecline: changePercent < -threshold,
        status,
        message,
        overallChange: changePercent,
        recentChange: recentChange,
        firstHalfAvg: firstAvg,
        secondHalfAvg: secondAvg,
        peak: Math.max(...movingAvg),
        valley: Math.min(...movingAvg)
    };
}

/**
 * 分析客户贡献度变化
 * @param {Object} customerData - 客户数据对象 {customer: [values...]}
 * @param {string[]} periods - 时间周期数组
 * @returns {Array} 客户贡献分析结果
 */
function analyzeCustomerContribution(customerData, periods) {
    if (!customerData || Object.keys(customerData).length === 0) {
        return [];
    }

    const results = [];

    Object.entries(customerData).forEach(([customer, values]) => {
        if (!values || values.length === 0) return;

        // 计算统计指标
        const total = values.reduce((sum, val) => sum + val, 0);
        const avg = total / values.length;
        const max = Math.max(...values);
        const min = Math.min(...values);

        // 计算标准差和波动系数
        const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);
        const coefficientOfVariation = (stdDev / avg) * 100;

        // 计算趋势变化（前半期 vs 后半期）
        const midpoint = Math.floor(values.length / 2);
        const firstHalf = values.slice(0, midpoint);
        const secondHalf = values.slice(midpoint);

        const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
        const trendChange = ((secondAvg - firstAvg) / firstAvg) * 100;

        // 判断趋势方向
        let trendDirection;
        if (trendChange > 5) {
            trendDirection = 'up';
        } else if (trendChange < -5) {
            trendDirection = 'down';
        } else {
            trendDirection = 'flat';
        }

        results.push({
            customer,
            values,
            avg,
            max,
            min,
            total,
            stdDev,
            coefficientOfVariation,
            trendChange,
            trendDirection,
            firstHalfAvg: firstAvg,
            secondHalfAvg: secondAvg
        });
    });

    // 按平均贡献度排序
    results.sort((a, b) => b.avg - a.avg);

    return results;
}

/**
 * 识别导致下滑的主要客户
 * @param {Array} contributionAnalysis - 客户贡献分析结果
 * @param {number} topN - 返回前N个客户
 * @returns {Array} 下滑贡献最大的客户列表
 */
function identifyDecliningCustomers(contributionAnalysis, topN = 5) {
    if (!contributionAnalysis || contributionAnalysis.length === 0) {
        return [];
    }

    // 筛选出趋势下降的客户
    const decliningCustomers = contributionAnalysis
        .filter(c => c.trendChange < 0)
        .map(c => ({
            ...c,
            declineImpact: Math.abs(c.trendChange) * c.avg // 下降影响 = 下降百分比 * 平均贡献度
        }))
        .sort((a, b) => b.declineImpact - a.declineImpact)
        .slice(0, topN);

    return decliningCustomers;
}

/**
 * 格式化数字（保留小数位）
 * @param {number} num - 数字
 * @param {number} decimals - 小数位数
 * @returns {string} 格式化后的字符串
 */
function formatNumber(num, decimals = 2) {
    if (num === null || num === undefined || isNaN(num)) return '--';
    return num.toFixed(decimals);
}

/**
 * 生成图表颜色
 * @param {number} index - 索引
 * @param {number} total - 总数
 * @returns {string} RGB颜色字符串
 */
function generateChartColor(index, total) {
    const colorPalette = [
        '59, 130, 246',   // 蓝色
        '239, 68, 68',    // 红色
        '34, 197, 94',    // 绿色
        '251, 146, 60',   // 橙色
        '168, 85, 247',   // 紫色
        '236, 72, 153',   // 粉色
        '14, 165, 233',   // 天蓝
        '234, 179, 8',    // 黄色
        '20, 184, 166',   // 青色
        '244, 63, 94',    // 玫瑰色
    ];

    return colorPalette[index % colorPalette.length];
}

/**
 * 导出表格数据为CSV
 * @param {Array} data - 数据数组
 * @param {string} filename - 文件名
 */
function exportToCSV(data, filename) {
    if (!data || data.length === 0) {
        console.warn('没有数据可导出');
        return;
    }

    // 获取表头
    const headers = Object.keys(data[0]);

    // 构建CSV内容
    let csvContent = '\ufeff'; // UTF-8 BOM for Excel
    csvContent += headers.join(',') + '\n';

    data.forEach(row => {
        const values = headers.map(header => {
            let value = row[header];
            if (value === null || value === undefined) value = '';
            // 如果包含逗号或引号，需要用引号包裹
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                value = '"' + value.replace(/"/g, '""') + '"';
            }
            return value;
        });
        csvContent += values.join(',') + '\n';
    });

    // 创建下载链接
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * 下载图表为图片
 * @param {Object} chart - Chart.js 实例
 * @param {string} filename - 文件名
 */
function downloadChartAsImage(chart, filename) {
    if (!chart) {
        console.warn('图表实例不存在');
        return;
    }

    const url = chart.toBase64Image();
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
}

/**
 * 按周期分组数据
 * @param {Array} rawData - 原始数据
 * @param {string} groupBy - 分组方式 (day/week/month)
 * @param {string} dateField - 日期字段名
 * @returns {Object} 分组后的数据
 */
function groupDataByPeriod(rawData, groupBy, dateField = 'file_time') {
    const grouped = {};

    rawData.forEach(record => {
        const date = new Date(record[dateField]);
        let periodKey;

        switch (groupBy) {
            case 'day':
                periodKey = date.toISOString().split('T')[0];
                break;
            case 'week':
                const weekStart = new Date(date);
                weekStart.setDate(date.getDate() - date.getDay() + 1); // 周一为起始
                periodKey = weekStart.toISOString().split('T')[0];
                break;
            case 'month':
                periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                break;
            default:
                periodKey = date.toISOString().split('T')[0];
        }

        if (!grouped[periodKey]) {
            grouped[periodKey] = [];
        }
        grouped[periodKey].push(record);
    });

    return grouped;
}

/**
 * ========================================
 * 高级统计分析算法
 * ========================================
 */

/**
 * 线性回归分析
 * 用于计算趋势线的斜率和拟合优度(R²)
 * @param {number[]} data - 数据数组
 * @returns {Object} 回归分析结果 { slope, intercept, rSquared, trend, prediction }
 */
function linearRegression(data) {
    if (!data || data.length < 2) {
        return null;
    }

    const n = data.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

    // 计算各项和
    for (let i = 0; i < n; i++) {
        const x = i;
        const y = data[i];
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumXX += x * x;
    }

    // 计算斜率和截距
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // 计算R²（拟合优度）
    const meanY = sumY / n;
    let ssTotal = 0;  // 总平方和
    let ssResidual = 0;  // 残差平方和

    for (let i = 0; i < n; i++) {
        const predicted = slope * i + intercept;
        ssTotal += Math.pow(data[i] - meanY, 2);
        ssResidual += Math.pow(data[i] - predicted, 2);
    }

    const rSquared = 1 - (ssResidual / ssTotal);

    // 判断趋势方向
    let trend = 'stable';
    if (Math.abs(slope) > 0.5) {  // 斜率阈值
        trend = slope > 0 ? 'increasing' : 'decreasing';
    }

    // 预测下一个值
    const nextValue = slope * n + intercept;

    return {
        slope: slope,
        intercept: intercept,
        rSquared: rSquared,
        trend: trend,
        nextPrediction: Math.max(0, nextValue),  // 确保不为负
        trendStrength: Math.abs(slope),
        fitQuality: rSquared > 0.7 ? 'good' : rSquared > 0.4 ? 'moderate' : 'poor'
    };
}

/**
 * 指数移动平均 (EMA)
 * 相比SMA，对近期数据赋予更高权重，反应更灵敏
 * @param {number[]} data - 数据数组
 * @param {number} period - 周期（默认5）
 * @returns {number[]} EMA数组
 */
function calculateEMA(data, period = 5) {
    if (!data || data.length === 0) return [];
    if (period <= 0 || period > data.length) return data;

    const k = 2 / (period + 1);  // 平滑系数
    const ema = [];

    // 第一个值使用SMA
    let sum = 0;
    for (let i = 0; i < Math.min(period, data.length); i++) {
        sum += data[i];
    }
    ema[0] = sum / Math.min(period, data.length);

    // 后续值使用EMA公式: EMA(t) = 价格(t) × k + EMA(t-1) × (1-k)
    for (let i = 1; i < data.length; i++) {
        ema[i] = data[i] * k + ema[i - 1] * (1 - k);
    }

    return ema;
}

/**
 * 异常值检测（3σ原则 + IQR方法）
 * @param {number[]} data - 数据数组
 * @returns {Object} 异常值检测结果
 */
function detectOutliers(data) {
    if (!data || data.length < 4) {
        return { outlierIndices: [], cleanData: data, method: 'insufficient_data' };
    }

    const n = data.length;
    const mean = data.reduce((sum, val) => sum + val, 0) / n;

    // 计算标准差
    const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);

    // 方法1: 3σ原则
    const threshold3Sigma = 3 * stdDev;
    const outliers3Sigma = [];

    data.forEach((val, idx) => {
        if (Math.abs(val - mean) > threshold3Sigma) {
            outliers3Sigma.push(idx);
        }
    });

    // 方法2: IQR方法（四分位距）
    const sorted = [...data].sort((a, b) => a - b);
    const q1Index = Math.floor(n * 0.25);
    const q3Index = Math.floor(n * 0.75);
    const q1 = sorted[q1Index];
    const q3 = sorted[q3Index];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    const outliersIQR = [];
    data.forEach((val, idx) => {
        if (val < lowerBound || val > upperBound) {
            outliersIQR.push(idx);
        }
    });

    // 合并两种方法的结果
    const allOutliers = [...new Set([...outliers3Sigma, ...outliersIQR])];

    return {
        outlierIndices: allOutliers,
        outlierValues: allOutliers.map(idx => ({ index: idx, value: data[idx] })),
        mean: mean,
        stdDev: stdDev,
        lowerBound: lowerBound,
        upperBound: upperBound,
        method: 'combined'
    };
}

/**
 * 连续下滑检测
 * 识别连续N期下降的情况，这是强烈的警告信号
 * @param {number[]} data - 数据数组
 * @param {number} consecutiveCount - 连续下降的期数阈值（默认3）
 * @returns {Array} 连续下滑的区间
 */
function detectConsecutiveDecline(data, consecutiveCount = 3) {
    if (!data || data.length < consecutiveCount) {
        return [];
    }

    const declines = [];
    let currentDecline = null;

    for (let i = 1; i < data.length; i++) {
        if (data[i] < data[i - 1]) {
            // 发现下降
            if (!currentDecline) {
                currentDecline = {
                    startIndex: i - 1,
                    endIndex: i,
                    count: 1,
                    startValue: data[i - 1],
                    endValue: data[i]
                };
            } else {
                currentDecline.endIndex = i;
                currentDecline.endValue = data[i];
                currentDecline.count++;
            }
        } else {
            // 下降中断
            if (currentDecline && currentDecline.count >= consecutiveCount) {
                currentDecline.dropPercent = ((currentDecline.endValue - currentDecline.startValue) / currentDecline.startValue) * 100;
                declines.push(currentDecline);
            }
            currentDecline = null;
        }
    }

    // 检查最后一个下降区间
    if (currentDecline && currentDecline.count >= consecutiveCount) {
        currentDecline.dropPercent = ((currentDecline.endValue - currentDecline.startValue) / currentDecline.startValue) * 100;
        declines.push(currentDecline);
    }

    return declines;
}

/**
 * 趋势显著性检验（简化版Mann-Kendall检验）
 * 用于判断趋势是否具有统计显著性
 * @param {number[]} data - 数据数组
 * @returns {Object} 显著性检验结果
 */
function trendSignificanceTest(data) {
    if (!data || data.length < 4) {
        return { isSignificant: false, confidence: 'insufficient_data' };
    }

    const n = data.length;
    let s = 0;

    // 计算Mann-Kendall统计量S
    for (let i = 0; i < n - 1; i++) {
        for (let j = i + 1; j < n; j++) {
            if (data[j] > data[i]) s++;
            else if (data[j] < data[i]) s--;
        }
    }

    // 计算方差
    const varS = (n * (n - 1) * (2 * n + 5)) / 18;
    const stdS = Math.sqrt(varS);

    // 计算Z统计量
    let z;
    if (s > 0) {
        z = (s - 1) / stdS;
    } else if (s < 0) {
        z = (s + 1) / stdS;
    } else {
        z = 0;
    }

    // 判断显著性水平
    const absZ = Math.abs(z);
    let confidence, isSignificant;

    if (absZ > 2.576) {
        confidence = 'very_high';  // 99%置信度
        isSignificant = true;
    } else if (absZ > 1.96) {
        confidence = 'high';  // 95%置信度
        isSignificant = true;
    } else if (absZ > 1.645) {
        confidence = 'moderate';  // 90%置信度
        isSignificant = true;
    } else {
        confidence = 'low';  // 不显著
        isSignificant = false;
    }

    return {
        isSignificant: isSignificant,
        confidence: confidence,
        zScore: z,
        sValue: s,
        trend: s > 0 ? 'increasing' : s < 0 ? 'decreasing' : 'no_trend'
    };
}

/**
 * 时间序列预测（基于线性回归 + 移动平均）
 * @param {number[]} data - 历史数据
 * @param {number} periodsAhead - 预测未来N期（默认3）
 * @returns {Object} 预测结果
 */
function forecastTrend(data, periodsAhead = 3) {
    if (!data || data.length < 3) {
        return { predictions: [], confidence: 'low', method: 'insufficient_data' };
    }

    const regression = linearRegression(data);
    if (!regression) {
        return { predictions: [], confidence: 'low', method: 'failed' };
    }

    const predictions = [];
    const lastIndex = data.length - 1;

    for (let i = 1; i <= periodsAhead; i++) {
        const predictedValue = regression.slope * (lastIndex + i) + regression.intercept;
        predictions.push({
            period: i,
            value: Math.max(0, Math.round(predictedValue)),  // 确保非负并取整
            confidence: regression.fitQuality
        });
    }

    return {
        predictions: predictions,
        confidence: regression.fitQuality,
        method: 'linear_regression',
        rSquared: regression.rSquared,
        trend: regression.trend
    };
}

/**
 * 季节性检测（简化版）
 * 检测数据是否存在周期性波动
 * @param {number[]} data - 数据数组
 * @param {number} period - 周期长度（默认7，检测周循环）
 * @returns {Object} 季节性分析结果
 */
function detectSeasonality(data, period = 7) {
    if (!data || data.length < period * 2) {
        return { hasSeasonality: false, strength: 0, message: '数据不足' };
    }

    // 计算自相关系数（lag = period）
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < data.length - period; i++) {
        numerator += (data[i] - mean) * (data[i + period] - mean);
    }

    for (let i = 0; i < data.length; i++) {
        denominator += Math.pow(data[i] - mean, 2);
    }

    const autocorrelation = numerator / denominator;

    // 判断季节性强度
    const hasSeasonality = autocorrelation > 0.3;  // 阈值可调整
    let strength;

    if (autocorrelation > 0.7) {
        strength = 'strong';
    } else if (autocorrelation > 0.5) {
        strength = 'moderate';
    } else if (autocorrelation > 0.3) {
        strength = 'weak';
    } else {
        strength = 'none';
    }

    return {
        hasSeasonality: hasSeasonality,
        autocorrelation: autocorrelation,
        strength: strength,
        period: period,
        message: hasSeasonality ? `检测到${period}期周期性波动` : '未检测到明显周期性'
    };
}

/**
 * 客户相关性分析
 * 分析不同客户之间的趋势相关性
 * @param {Object} customerData - 客户数据对象 {customer: [values...]}
 * @returns {Array} 高相关性的客户对
 */
function analyzeCustomerCorrelation(customerData) {
    if (!customerData || Object.keys(customerData).length < 2) {
        return [];
    }

    const customers = Object.keys(customerData);
    const correlations = [];

    // 计算皮尔逊相关系数
    for (let i = 0; i < customers.length - 1; i++) {
        for (let j = i + 1; j < customers.length; j++) {
            const customer1 = customers[i];
            const customer2 = customers[j];
            const data1 = customerData[customer1];
            const data2 = customerData[customer2];

            // 确保数据长度相同
            const minLength = Math.min(data1.length, data2.length);
            if (minLength < 3) continue;

            const correlation = calculatePearsonCorrelation(
                data1.slice(0, minLength),
                data2.slice(0, minLength)
            );

            // 只保留相关性较强的（|r| > 0.6）
            if (Math.abs(correlation) > 0.6) {
                correlations.push({
                    customer1: customer1,
                    customer2: customer2,
                    correlation: correlation,
                    type: correlation > 0 ? 'positive' : 'negative',
                    strength: Math.abs(correlation) > 0.8 ? 'strong' : 'moderate'
                });
            }
        }
    }

    // 按相关性强度排序
    correlations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));

    return correlations;
}

/**
 * 计算皮尔逊相关系数
 * @param {number[]} x - 数据数组1
 * @param {number[]} y - 数据数组2
 * @returns {number} 相关系数 (-1 到 1)
 */
function calculatePearsonCorrelation(x, y) {
    if (!x || !y || x.length !== y.length || x.length < 2) {
        return 0;
    }

    const n = x.length;
    const meanX = x.reduce((sum, val) => sum + val, 0) / n;
    const meanY = y.reduce((sum, val) => sum + val, 0) / n;

    let numerator = 0;
    let sumXSquare = 0;
    let sumYSquare = 0;

    for (let i = 0; i < n; i++) {
        const diffX = x[i] - meanX;
        const diffY = y[i] - meanY;
        numerator += diffX * diffY;
        sumXSquare += diffX * diffX;
        sumYSquare += diffY * diffY;
    }

    const denominator = Math.sqrt(sumXSquare * sumYSquare);

    if (denominator === 0) return 0;

    return numerator / denominator;
}

/**
 * 综合趋势评估
 * 结合多种算法给出综合评估结果
 * @param {number[]} data - 数据数组
 * @returns {Object} 综合评估结果
 */
function comprehensiveTrendAnalysis(data) {
    if (!data || data.length < 3) {
        return { status: 'insufficient_data', score: 0 };
    }

    // 执行各项分析
    const regression = linearRegression(data);
    const significance = trendSignificanceTest(data);
    const consecutiveDeclines = detectConsecutiveDecline(data, 3);
    const outliers = detectOutliers(data);
    const forecast = forecastTrend(data, 3);

    // 计算综合评分（0-100）
    let score = 50;  // 基础分

    // 趋势方向影响 (-20 to +20)
    if (regression) {
        if (regression.trend === 'decreasing') {
            score -= 20;
        } else if (regression.trend === 'increasing') {
            score += 20;
        }

        // R²影响 (-10 to +10)
        if (regression.rSquared > 0.7) {
            score += regression.trend === 'increasing' ? 10 : -10;
        }
    }

    // 统计显著性影响
    if (significance.isSignificant) {
        if (significance.trend === 'decreasing') {
            score -= 15;
        } else if (significance.trend === 'increasing') {
            score += 15;
        }
    }

    // 连续下滑影响
    if (consecutiveDeclines.length > 0) {
        score -= consecutiveDeclines.length * 10;
    }

    // 确保分数在0-100之间
    score = Math.max(0, Math.min(100, score));

    // 确定状态
    let status, level;
    if (score >= 70) {
        status = 'healthy';
        level = 'good';
    } else if (score >= 50) {
        status = 'stable';
        level = 'moderate';
    } else if (score >= 30) {
        status = 'warning';
        level = 'attention_needed';
    } else {
        status = 'critical';
        level = 'urgent';
    }

    return {
        status: status,
        level: level,
        score: Math.round(score),
        regression: regression,
        significance: significance,
        consecutiveDeclines: consecutiveDeclines,
        outliers: outliers,
        forecast: forecast
    };
}

// 导出函数供外部使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        // 原有函数
        calculateMovingAverage,
        detectTrendDecline,
        analyzeCustomerContribution,
        identifyDecliningCustomers,
        formatNumber,
        generateChartColor,
        exportToCSV,
        downloadChartAsImage,
        groupDataByPeriod,
        // 新增高级算法
        linearRegression,
        calculateEMA,
        detectOutliers,
        detectConsecutiveDecline,
        trendSignificanceTest,
        forecastTrend,
        detectSeasonality,
        analyzeCustomerCorrelation,
        calculatePearsonCorrelation,
        comprehensiveTrendAnalysis
    };
}
