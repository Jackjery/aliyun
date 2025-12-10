/**
 * 智能期间对比分析 - Chart.js图表集成
 *
 * 提供完整的数据可视化功能：
 * 1. 趋势折线图（含拐点标注）
 * 2. 影响力柱状图
 * 3. 客户分组饼图
 * 4. 周期性热力图
 *
 * @author Claude Sonnet 4.5
 * @date 2025-12-09
 */

// ============================================
// 1. 趋势折线图（含拐点标注）
// ============================================

/**
 * 创建趋势折线图
 *
 * @param {string} canvasId - Canvas元素ID
 * @param {Array} timeSeriesData - 时间序列数据 [{date, value}]
 * @param {Array} inflectionPoints - 拐点数据（可选）
 * @param {Array} trendSegments - 趋势分段数据（可选）
 * @returns {Chart} Chart.js实例
 */
function createTrendLineChart(canvasId, timeSeriesData, inflectionPoints = [], trendSegments = []) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        console.error(`Canvas元素未找到: ${canvasId}`);
        return null;
    }

    // 准备数据
    const labels = timeSeriesData.map(d => d.date);
    const values = timeSeriesData.map(d => d.value);

    // 拐点数据
    const inflectionData = inflectionPoints.map(p => ({
        x: p.date,
        y: p.value,
        label: p.trendChange
    }));

    // 配置
    const config = {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                // 主趋势线
                {
                    label: '圈次趋势',
                    data: values,
                    borderColor: 'rgb(var(--color-primary))',
                    backgroundColor: 'rgba(var(--color-primary), 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 2,
                    pointHoverRadius: 6
                },
                // 拐点标注
                {
                    label: '拐点',
                    data: inflectionData,
                    type: 'scatter',
                    borderColor: 'rgb(var(--color-danger))',
                    backgroundColor: 'rgb(var(--color-danger))',
                    pointRadius: 8,
                    pointStyle: 'triangle',
                    pointHoverRadius: 10,
                    showLine: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                title: {
                    display: true,
                    text: '历史趋势分析',
                    font: {
                        size: 16,
                        weight: 'bold'
                    },
                    color: 'rgb(var(--text-primary))'
                },
                legend: {
                    display: true,
                    labels: {
                        color: 'rgb(var(--text-secondary))',
                        usePointStyle: true
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(var(--bg-base), 0.95)',
                    titleColor: 'rgb(var(--text-primary))',
                    bodyColor: 'rgb(var(--text-secondary))',
                    borderColor: 'rgb(var(--border-color))',
                    borderWidth: 1,
                    callbacks: {
                        afterBody: function(context) {
                            const dataIndex = context[0].dataIndex;
                            // 检查是否是拐点
                            const inflection = inflectionPoints.find(p => p.index === dataIndex);
                            if (inflection) {
                                return [`拐点: ${inflection.trendChange}`];
                            }
                            return [];
                        }
                    }
                },
                annotation: {
                    annotations: createSegmentAnnotations(trendSegments, timeSeriesData)
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: '时间',
                        color: 'rgb(var(--text-secondary))'
                    },
                    ticks: {
                        color: 'rgb(var(--text-tertiary))',
                        maxRotation: 45,
                        minRotation: 0
                    },
                    grid: {
                        color: 'rgba(var(--border-color), 0.5)'
                    }
                },
                y: {
                    display: true,
                    title: {
                        display: true,
                        text: '圈次数',
                        color: 'rgb(var(--text-secondary))'
                    },
                    ticks: {
                        color: 'rgb(var(--text-tertiary))'
                    },
                    grid: {
                        color: 'rgba(var(--border-color), 0.5)'
                    }
                }
            }
        }
    };

    return new Chart(canvas, config);
}

/**
 * 创建趋势分段标注
 */
function createSegmentAnnotations(trendSegments, timeSeriesData) {
    const annotations = {};

    trendSegments.forEach((seg, idx) => {
        const color = seg.trend === 'up' ? 'rgba(var(--color-success), 0.1)' :
                     seg.trend === 'down' ? 'rgba(var(--color-danger), 0.1)' :
                     'rgba(var(--color-info), 0.1)';

        annotations[`segment${idx}`] = {
            type: 'box',
            xMin: seg.startDate,
            xMax: seg.endDate,
            backgroundColor: color,
            borderWidth: 0
        };
    });

    return annotations;
}

// ============================================
// 2. 影响力柱状图
// ============================================

/**
 * 创建客户影响力柱状图
 *
 * @param {string} canvasId - Canvas元素ID
 * @param {Array} customers - 客户影响力数据
 * @param {string} type - 'decline'（下滑）或 'growth'（上涨）
 * @param {number} topN - 显示前N名（默认10）
 * @returns {Chart} Chart.js实例
 */
function createImpactBarChart(canvasId, customers, type = 'decline', topN = 10) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        console.error(`Canvas元素未找到: ${canvasId}`);
        return null;
    }

    // 过滤和排序
    let filtered;
    if (type === 'decline') {
        filtered = customers.filter(c => c.changeValue < 0);
        filtered.sort((a, b) => a.changeValue - b.changeValue);  // 升序（最负的在前）
    } else {
        filtered = customers.filter(c => c.changeValue > 0);
        filtered.sort((a, b) => b.changeValue - a.changeValue);  // 降序（最大的在前）
    }

    // 取前N名
    const topCustomers = filtered.slice(0, topN);

    const labels = topCustomers.map(c => c.customerId || c.userId);
    const values = topCustomers.map(c => Math.abs(c.changeValue));
    const impacts = topCustomers.map(c => c.absoluteImpact || 0);

    const config = {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: type === 'decline' ? '下滑圈次' : '上涨圈次',
                data: values,
                backgroundColor: type === 'decline' ?
                    'rgba(var(--color-danger), 0.7)' :
                    'rgba(var(--color-success), 0.7)',
                borderColor: type === 'decline' ?
                    'rgb(var(--color-danger))' :
                    'rgb(var(--color-success))',
                borderWidth: 2,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: type === 'decline' ? '下滑贡献榜 TOP ' + topN : '上涨贡献榜 TOP ' + topN,
                    font: {
                        size: 16,
                        weight: 'bold'
                    },
                    color: 'rgb(var(--text-primary))'
                },
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(var(--bg-base), 0.95)',
                    titleColor: 'rgb(var(--text-primary))',
                    bodyColor: 'rgb(var(--text-secondary))',
                    borderColor: 'rgb(var(--border-color))',
                    borderWidth: 1,
                    callbacks: {
                        afterBody: function(context) {
                            const idx = context[0].dataIndex;
                            const customer = topCustomers[idx];
                            return [
                                `基期: ${customer.baseValue}圈`,
                                `现期: ${customer.currentValue}圈`,
                                `影响力: ${impacts[idx].toFixed(1)}%`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: 'rgb(var(--text-tertiary))',
                        maxRotation: 45,
                        minRotation: 45
                    },
                    grid: {
                        display: false
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '圈次变化量',
                        color: 'rgb(var(--text-secondary))'
                    },
                    ticks: {
                        color: 'rgb(var(--text-tertiary))'
                    },
                    grid: {
                        color: 'rgba(var(--border-color), 0.5)'
                    }
                }
            }
        }
    };

    return new Chart(canvas, config);
}

// ============================================
// 3. 客户分组饼图
// ============================================

/**
 * 创建客户分组饼图
 *
 * @param {string} canvasId - Canvas元素ID
 * @param {Object} groupingResult - 分组结果
 * @returns {Chart} Chart.js实例
 */
function createGroupPieChart(canvasId, groupingResult) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        console.error(`Canvas元素未找到: ${canvasId}`);
        return null;
    }

    const groups = groupingResult.groups || [];

    const labels = groups.map(g => g.groupType);
    const values = groups.map(g => g.customerCount);
    const colors = groups.map(g => {
        if (g.groupType.includes('下滑')) return 'rgba(var(--color-danger), 0.7)';
        if (g.groupType.includes('上涨')) return 'rgba(var(--color-success), 0.7)';
        if (g.groupType.includes('波动')) return 'rgba(var(--color-warning), 0.7)';
        return 'rgba(var(--color-info), 0.7)';
    });

    const config = {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: colors,
                borderColor: 'rgb(var(--bg-base))',
                borderWidth: 2,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'AI智能分组分布',
                    font: {
                        size: 16,
                        weight: 'bold'
                    },
                    color: 'rgb(var(--text-primary))'
                },
                legend: {
                    position: 'right',
                    labels: {
                        color: 'rgb(var(--text-secondary))',
                        padding: 15,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(var(--bg-base), 0.95)',
                    titleColor: 'rgb(var(--text-primary))',
                    bodyColor: 'rgb(var(--text-secondary))',
                    borderColor: 'rgb(var(--border-color))',
                    borderWidth: 1,
                    callbacks: {
                        afterBody: function(context) {
                            const idx = context[0].dataIndex;
                            const group = groups[idx];
                            return [
                                `平均增长率: ${group.avgGrowthRate.toFixed(1)}%`,
                                `平均波动率: ${group.avgVolatility.toFixed(2)}`
                            ];
                        }
                    }
                }
            }
        }
    };

    return new Chart(canvas, config);
}

// ============================================
// 4. 对比雷达图
// ============================================

/**
 * 创建基期vs现期对比雷达图
 *
 * @param {string} canvasId - Canvas元素ID
 * @param {Object} baseData - 基期数据
 * @param {Object} currentData - 现期数据
 * @returns {Chart} Chart.js实例
 */
function createComparisonRadarChart(canvasId, baseData, currentData) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        console.error(`Canvas元素未找到: ${canvasId}`);
        return null;
    }

    const config = {
        type: 'radar',
        data: {
            labels: ['总计划ID', '日均圈次', '最大值', '最小值', '波动度'],
            datasets: [
                {
                    label: '基期',
                    data: [
                        baseData.totalIds || 0,
                        baseData.avgDaily || 0,
                        baseData.maxValue || 0,
                        baseData.minValue || 0,
                        baseData.volatility || 0
                    ],
                    borderColor: 'rgb(var(--color-info))',
                    backgroundColor: 'rgba(var(--color-info), 0.2)',
                    borderWidth: 2
                },
                {
                    label: '现期',
                    data: [
                        currentData.totalIds || 0,
                        currentData.avgDaily || 0,
                        currentData.maxValue || 0,
                        currentData.minValue || 0,
                        currentData.volatility || 0
                    ],
                    borderColor: 'rgb(var(--color-primary))',
                    backgroundColor: 'rgba(var(--color-primary), 0.2)',
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: '基期 vs 现期 多维对比',
                    font: {
                        size: 16,
                        weight: 'bold'
                    },
                    color: 'rgb(var(--text-primary))'
                },
                legend: {
                    labels: {
                        color: 'rgb(var(--text-secondary))'
                    }
                }
            },
            scales: {
                r: {
                    beginAtZero: true,
                    ticks: {
                        color: 'rgb(var(--text-tertiary))'
                    },
                    grid: {
                        color: 'rgba(var(--border-color), 0.5)'
                    },
                    pointLabels: {
                        color: 'rgb(var(--text-secondary))',
                        font: {
                            size: 12
                        }
                    }
                }
            }
        }
    };

    return new Chart(canvas, config);
}

// ============================================
// 5. 工具函数
// ============================================

/**
 * 销毁图表实例
 */
function destroyChart(chart) {
    if (chart && typeof chart.destroy === 'function') {
        chart.destroy();
    }
}

/**
 * 更新图表数据
 */
function updateChartData(chart, newData, newLabels = null) {
    if (!chart) return;

    if (newLabels) {
        chart.data.labels = newLabels;
    }

    chart.data.datasets.forEach((dataset, idx) => {
        if (newData[idx]) {
            dataset.data = newData[idx];
        }
    });

    chart.update();
}

/**
 * 批量创建图表
 *
 * @param {Object} analysisResult - 完整的分析结果
 * @returns {Object} 图表实例对象
 */
function createAllCharts(analysisResult) {
    const charts = {};

    // 1. 趋势折线图
    if (analysisResult.timeSeriesData) {
        charts.trendLine = createTrendLineChart(
            'trendLineChart',
            analysisResult.timeSeriesData,
            analysisResult.inflectionPoints,
            analysisResult.trendSegments
        );
    }

    // 2. 下滑贡献榜
    if (analysisResult.customerImpacts) {
        charts.declineBar = createImpactBarChart(
            'declineBarChart',
            analysisResult.customerImpacts,
            'decline',
            10
        );
    }

    // 3. 上涨贡献榜
    if (analysisResult.customerImpacts) {
        charts.growthBar = createImpactBarChart(
            'growthBarChart',
            analysisResult.customerImpacts,
            'growth',
            10
        );
    }

    // 4. 客户分组饼图
    if (analysisResult.groupingResult) {
        charts.groupPie = createGroupPieChart(
            'groupPieChart',
            analysisResult.groupingResult
        );
    }

    // 5. 对比雷达图
    if (analysisResult.baseData && analysisResult.currentData) {
        charts.comparisonRadar = createComparisonRadarChart(
            'comparisonRadarChart',
            analysisResult.baseData,
            analysisResult.currentData
        );
    }

    return charts;
}

/**
 * 销毁所有图表
 */
function destroyAllCharts(charts) {
    Object.values(charts).forEach(chart => {
        destroyChart(chart);
    });
}

// 导出API
window.ChartIntegration = {
    // 创建图表
    createTrendLineChart,
    createImpactBarChart,
    createGroupPieChart,
    createComparisonRadarChart,

    // 批量操作
    createAllCharts,
    destroyAllCharts,

    // 工具函数
    destroyChart,
    updateChartData
};

console.log('✅ Chart.js图表集成完成');
