/**
 * iframe 辅助脚本
 * 功能：
 * 1. 检测页面是否在 iframe 中，如果是则隐藏导航栏
 * 2. 禁用子页面的主题管理器，使用父窗口的主题管理器
 */

(function() {
    // 检测是否在 iframe 中
    const isInIframe = window !== window.parent;

    if (isInIframe) {
        console.log('🖼️ 检测到页面在 iframe 中');

        // 等待 DOM 加载完成
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }
    }

    function init() {
        hideNavigation();
        useParentThemeManager();
    }

    function hideNavigation() {
        // 查找并隐藏导航栏
        const header = document.querySelector('header');
        if (header) {
            header.style.display = 'none';
            console.log('✅ 导航栏已隐藏');
        }

        // 调整主内容区域的上边距
        const main = document.querySelector('main');
        if (main) {
            main.style.paddingTop = '0';
            main.style.marginTop = '0';
        }

        // 调整 sticky 筛选条件的 top 值（针对 trend-analysis.html）
        const filterSection = document.getElementById('filterSection');
        if (filterSection && filterSection.classList.contains('sticky-filter-section')) {
            filterSection.style.top = '0';
            console.log('✅ 筛选条件 top 值已调整为 0');
        }
    }

    function useParentThemeManager() {
        // 禁用当前窗口初始化主题管理器
        window.initThemeManager = function() {
            console.log('🎨 在 iframe 中，不初始化独立的主题管理器');
        };

        // 使用父窗口的主题管理器
        try {
            // 检测是否可以访问父窗口（跨域检查）
            try {
                // 尝试访问父窗口，如果跨域会抛出异常
                const canAccessParent = window.parent.location.protocol;

                // 如果使用 file:// 协议，给出警告
                if (window.location.protocol === 'file:') {
                    console.warn('⚠️ 检测到使用 file:// 协议访问页面');
                    console.warn('💡 建议：使用 HTTP 服务器运行此应用以获得完整功能');
                    console.warn('   例如：python -m http.server 8000');
                    console.warn('   然后访问：http://localhost:8000/app.html');
                }
            } catch (crossOriginError) {
                console.error('❌ 跨域错误：无法访问父窗口');
                console.error('💡 请确保：');
                console.error('   1. 使用 HTTP 服务器运行应用（不要直接打开 HTML 文件）');
                console.error('   2. 父页面和 iframe 页面在同一域名下');
                return;
            }

            // 等待父窗口主题管理器初始化
            const waitForParentThemeManager = () => {
                try {
                    if (window.parent.themeManager) {
                        window.themeManager = window.parent.themeManager;
                        console.log('✅ 使用父窗口的主题管理器');

                        // 等待当前文档完全加载后应用主题
                        if (document.readyState === 'complete') {
                            applyParentTheme();
                        } else {
                            window.addEventListener('load', applyParentTheme, { once: true });
                        }
                    } else {
                        // 父窗口主题管理器还没准备好，稍后再试
                        setTimeout(waitForParentThemeManager, 50);
                    }
                } catch (e) {
                    console.error('❌ 访问父窗口主题管理器失败:', e.message);
                }
            };

            const applyParentTheme = () => {
                try {
                    const themeManager = window.parent.themeManager;
                    if (themeManager) {
                        themeManager.applyThemeToDocument(document);
                        console.log('🎨 已从父窗口应用主题到当前 iframe');

                        // 验证主题是否成功应用
                        const html = document.documentElement;
                        console.log(`  📝 当前主题类: ${html.className}`);
                        console.log(`  📝 当前主题: ${themeManager.currentColorTheme} (${themeManager.currentMode})`);

                        // 检查 CSS 变量是否生效
                        const computedStyle = getComputedStyle(document.body);
                        const bgColor = computedStyle.backgroundColor;
                        const textColor = computedStyle.color;
                        console.log(`  📝 计算后的背景色: ${bgColor}`);
                        console.log(`  📝 计算后的文字色: ${textColor}`);

                        // 如果 CSS 变量没有生效，尝试重新应用
                        if (bgColor.includes('var(') || bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'transparent') {
                            console.warn('  ⚠️ CSS 变量未正确解析，尝试强制刷新...');
                            // 移除并重新添加 themes.css
                            const themeLink = document.querySelector('link[href*="themes.css"]');
                            if (themeLink) {
                                const newLink = themeLink.cloneNode();
                                newLink.onload = () => {
                                    themeManager.applyThemeToDocument(document);
                                    console.log('  ✅ 主题 CSS 重新加载完成');
                                };
                                themeLink.parentNode.insertBefore(newLink, themeLink);
                                themeLink.parentNode.removeChild(themeLink);
                            }
                        }
                    }
                } catch (e) {
                    console.error('❌ 应用父窗口主题失败:', e.message);
                }
            };

            waitForParentThemeManager();
        } catch (e) {
            console.error('❌ 无法访问父窗口主题管理器:', e.message);
        }
    }
})();
