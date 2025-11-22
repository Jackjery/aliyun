// Chart.js datalabels插件注册
(function() {
    // 确保datalabels插件正确注册
    if (typeof Chart !== 'undefined' && typeof ChartDataLabels !== 'undefined') {
        Chart.register(ChartDataLabels);
        console.log('✅ Chart.js datalabels插件已注册');
    } else {
        console.error('❌ Chart.js或datalabels插件未正确加载');
    }
})();
