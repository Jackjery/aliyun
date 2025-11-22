/**
 * Trend Analysis 页面初始化脚本
 * 包含：Chart.js 插件注册、筛选条件固定效果等
 */

// ==================== Chart.js 插件注册 ====================
// 确保datalabels插件正确注册
if (typeof Chart !== 'undefined' && typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels);
    console.log('✅ Chart.js datalabels插件已注册');
} else {
    console.error('❌ Chart.js或datalabels插件未正确加载');
}

// ==================== 筛选条件固定效果 ====================
// 检测筛选条件区域是否固定
window.addEventListener('load', () => {
    const filterSection = document.getElementById('filterSection');
    if (!filterSection) return;

    const observer = new IntersectionObserver(
        ([entry]) => {
            // 当元素顶部离开视口时，添加is-stuck类
            if (entry.boundingClientRect.top <= 70) {
                filterSection.classList.add('is-stuck');
            } else {
                filterSection.classList.remove('is-stuck');
            }
        },
        {
            threshold: [1],
            rootMargin: '-70px 0px 0px 0px'
        }
    );

    observer.observe(filterSection);
});
