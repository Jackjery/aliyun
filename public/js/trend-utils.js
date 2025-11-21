/**
 * Trend Analysis 工具函数
 */

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

    // 构建数据集
    const datasets = dimensions.map(dimension => {
        const data = periods.map(period => {
            const record = records.find(r =>
                r.period === period && r[dimensionField] === dimension
            );
            return record ? (record[valueField] || 0) : 0;
        });

        return {
            label: dimension,
            data: data
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
