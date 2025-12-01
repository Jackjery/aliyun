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

// 导出函数供外部使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calculateMovingAverage,
        detectTrendDecline,
        analyzeCustomerContribution,
        identifyDecliningCustomers,
        formatNumber,
        generateChartColor,
        exportToCSV,
        downloadChartAsImage,
        groupDataByPeriod
    };
}
