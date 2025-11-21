/**
 * 应用初始化 - 简化版
 * 功能：连接WebSocket，初始化SatelliteApp
 */

/**
 * 系统说明折叠/展开功能
 */
function initInstructionsToggle() {
    const toggle = document.getElementById('instructionsToggle');
    const content = document.getElementById('instructionsContent');
    const icon = document.getElementById('instructionsIcon');

    if (!toggle || !content || !icon) return;

    let isExpanded = true;

    // 切换函数
    const toggleInstructions = () => {
        isExpanded = !isExpanded;

        if (isExpanded) {
            // 展开
            content.style.maxHeight = content.scrollHeight + 'px';
            content.style.opacity = '1';
            content.style.marginTop = '0';
            icon.style.transform = 'rotate(0deg)';
            console.log('📖 系统说明已展开');
        } else {
            // 折叠
            content.style.maxHeight = '0';
            content.style.opacity = '0';
            content.style.marginTop = '-16px';
            icon.style.transform = 'rotate(180deg)';
            console.log('📕 系统说明已折叠');
        }
    };

    // 点击标题切换
    toggle.addEventListener('click', toggleInstructions);

    // 页面加载1秒后自动折叠
    setTimeout(() => {
        console.log('⏱️ 1秒后自动折叠系统说明...');
        toggleInstructions();
    }, 1000);
}

// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 开始初始化应用...');

    try {
        // 1. 初始化系统说明折叠功能
        initInstructionsToggle();

        // 2. 连接WebSocket
        console.log('🔗 连接WebSocket服务器...');
        window.wsManager.connect();

        // 3. 初始化SatelliteApp
        console.log('📊 初始化卫星数据应用...');
        await window.satelliteApp.init();

        // 4. 隐藏骨架屏
        const skeleton = document.getElementById('skeleton-screen');
        if (skeleton) {
            skeleton.classList.add('hidden');
        }

        console.log('✅ 应用初始化完成！');
        console.log('💡 提示：点击"生成统计结果"按钮开始查询数据');

    } catch (error) {
        console.error('❌ 应用初始化失败:', error);

        // 显示错误信息
        const errorDiv = document.createElement('div');
        errorDiv.className = 'fixed top-20 right-4 bg-red-500 text-white px-4 py-2 rounded shadow-lg z-50';
        errorDiv.innerHTML = `
            <div class="flex items-center">
                <span class="mr-2">❌</span>
                <span>应用初始化失败: ${error.message}</span>
                <button class="ml-4 text-white hover:text-gray-200" onclick="location.reload()">
                    刷新页面
                </button>
            </div>
        `;
        document.body.appendChild(errorDiv);
    }
});
