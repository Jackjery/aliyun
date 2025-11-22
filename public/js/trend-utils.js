/**
 * Trend Analysis 工具函数
 */

/**
 * 图表颜色调色板（清爽透明风格）
 */
const CHART_COLORS = [
    { r: 54, g: 162, b: 235 },   // 蓝色
    { r: 255, g: 99, b: 132 },   // 红色
    { r: 75, g: 192, b: 192 },   // 青色
    { r: 255, g: 159, b: 64 },   // 橙色
    { r: 153, g: 102, b: 255 },  // 紫色
    { r: 255, g: 206, b: 86 },   // 黄色
    { r: 231, g: 233, b: 237 },  // 灰色
    { r: 75, g: 192, b: 75 },    // 绿色
    { r: 201, g: 203, b: 207 },  // 浅灰色
    { r: 255, g: 99, b: 255 }    // 粉色
];

/**
 * 获取图表颜色
 */
function getChartColor(index, alpha = 1) {
    const color = CHART_COLORS[index % CHART_COLORS.length];
    return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
}

/**
 * 下载文件
 */
function downloadFile(filename, content, mimeType = 'application/octet-stream') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 500);
}

/**
 * 将图表数据转换为CSV
 */
function chartToCSV(chart) {
    if (!chart) return '';
    const labels = chart.data.labels || [];
    const datasets = chart.data.datasets || [];

    const header = ['分组', ...datasets.map(ds => ds.label || '')];
    const rows = [header];

    for (let i = 0; i < labels.length; i++) {
        const row = [labels[i]];
        for (let j = 0; j < datasets.length; j++) {
            row.push(datasets[j].data[i] ?? '');
        }
        rows.push(row);
    }

    const csvLines = rows.map(cols => cols.map(cell => {
        if (cell === null || cell === undefined) return '';
        const str = String(cell);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    }).join(','));

    return '\uFEFF' + csvLines.join('\n');
}

/**
 * 将后端返回的扁平数据转换为Chart.js格式
 * @param {Array} records - 后端返回的记录 [{period, dimension_name, record_count}, ...]
 * @param {string} dimensionField - 维度字段名 (如 'station_name', 'task_type')
 * @param {string} valueField - 值字段名 (如 'record_count')
 * @returns {Object} - {labels: [], datasets: []}
 */
function convertToChartData(records, dimensionField, valueField = 'record_count') {
    if (!records || records.length === 0) {
        return { labels: [], datasets: [] };
    }

    // 提取所有唯一的周期
    const periodsSet = new Set();
    records.forEach(r => periodsSet.add(r.period));
    const periods = Array.from(periodsSet).sort();

    // 提取所有唯一的维度值
    const dimensionsSet = new Set();
    records.forEach(r => {
        if (r[dimensionField]) {
            dimensionsSet.add(r[dimensionField]);
        }
    });
    const dimensions = Array.from(dimensionsSet).sort();

    // 构建数据集（带清爽透明样式）
    const datasets = dimensions.map((dimension, index) => {
        const data = periods.map(period => {
            const record = records.find(r =>
                r.period === period && r[dimensionField] === dimension
            );
            // 使用 ?? 确保0值不被当作 falsy 跳过
            return record ? (record[valueField] ?? 0) : 0;
        });

        return {
            label: dimension,
            data: data,
            backgroundColor: getChartColor(index, 0.1),      // 0.1 透明度的背景色
            borderColor: getChartColor(index, 1),            // 不透明的边框色
            borderWidth: 1.5,     // 更细的线条（多条线时更清爽）
            pointBackgroundColor: getChartColor(index, 1),
            pointBorderColor: '#fff',
            pointBorderWidth: 1.5,
            pointRadius: 3,       // 更小的数据点
            pointHoverRadius: 5,  // 悬停时稍大
            fill: true,           // 填充区域
            tension: 0.4,         // 平滑曲线
            spanGaps: false       // 不跳过0值，确保显示所有数据点
        };
    });

    return {
        labels: periods,
        datasets: datasets
    };
}

/**
 * 格式化周期标签
 */
function formatPeriodLabel(period, groupBy) {
    if (!period) return period;

    // 移除时间部分（如果有）
    let cleanPeriod = period;
    if (typeof period === 'string' && (period.includes(' ') || period.includes('T'))) {
        cleanPeriod = period.split(/[T ]/)[0];
    }

    switch (groupBy) {
        case 'day':
            return cleanPeriod;
        case 'week':
            if (cleanPeriod.includes('-')) {
                const date = new Date(cleanPeriod + 'T00:00:00');
                const weekNum = getWeekNumber(date);
                return `W${weekNum}`;
            }
            return cleanPeriod;
        case 'month':
            if (cleanPeriod.includes('-')) {
                const month = cleanPeriod.split('-')[1];
                return `${parseInt(month)}月`;
            }
            return cleanPeriod;
        case 'quarter':
            if (typeof cleanPeriod === 'string' && cleanPeriod.includes('-Q')) {
                return cleanPeriod.split('-')[1];
            }
            return cleanPeriod;
        default:
            return cleanPeriod;
    }
}

/**
 * 获取周数（ISO 8601）
 */
function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return weekNo;
}
