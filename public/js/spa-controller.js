/**
 * SPA 页面切换控制器
 * 用于 index.html 的 iframe 混合模式
 * 功能：页面切换、骨架屏管理、主题应用、历史记录管理
 */

// 确保主题管理器在 index.html 正确初始化
document.addEventListener('DOMContentLoaded', () => {
    // 如果主题管理器还没初始化，手动初始化
    if (!window.themeManager) {
        console.log('🎨 手动初始化主题管理器（index.html）');
        window.themeManager = new ThemeManager();
    }

    // 监听 iframe 加载完成，应用主题
    document.querySelectorAll('iframe.page-frame').forEach(iframe => {
        iframe.addEventListener('load', () => {
            if (window.themeManager) {
                setTimeout(() => {
                    window.themeManager.applyThemeToIframes();
                    console.log(`🎨 已应用主题到 iframe: ${iframe.id}`);
                }, 100);
            }
        });
    });
});

/**
 * SPA 页面切换控制器（iframe 版本）
 */
class SPAController {
    constructor() {
        this.currentPage = 'dashboard';
        this.loadedFrames = new Set(['dashboard']); // 首页已加载
        this.skeleton = document.getElementById('iframe-skeleton');
        this.init();
    }

    init() {
        console.log('🚀 SPA 控制器初始化...');

        // 绑定导航点击事件
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = link.getAttribute('data-page');
                this.navigateTo(page);
            });
        });

        // 监听浏览器前进/后退
        window.addEventListener('popstate', (e) => {
            const page = e.state?.page || 'dashboard';
            this.navigateTo(page, false);
        });

        // 监听来自 iframe 的消息
        window.addEventListener('message', (event) => {
            // 安全检查：确保消息来自同源
            if (event.origin !== window.location.origin) return;

            // 处理页面就绪消息
            if (event.data && event.data.type === 'pageReady') {
                const page = event.data.page;
                console.log(`✅ 收到页面就绪消息: ${page}`);

                // 如果是当前页面，隐藏骨架屏
                if (page === this.currentPage) {
                    this.hideSkeleton();
                }
            }
        });

        // 检查 URL hash，决定初始显示哪个页面
        const hash = window.location.hash.slice(1); // 去掉 # 号
        const initialPage = hash || 'dashboard';

        if (initialPage !== 'dashboard') {
            // 如果不是首页，需要先导航过去
            this.navigateTo(initialPage, false);
        } else {
            // 如果是首页 dashboard，显示骨架屏并等待就绪消息
            // admin页面不显示骨架屏
            if (initialPage !== 'admin') {
                this.showSkeleton();
            }
            // 等待 dashboard iframe 加载完成后询问
            const dashboardFrame = document.getElementById('frame-dashboard');
            if (dashboardFrame) {
                if (dashboardFrame.contentWindow && dashboardFrame.contentDocument && dashboardFrame.contentDocument.readyState === 'complete') {
                    // iframe 已经加载完成，直接询问
                    setTimeout(() => {
                        dashboardFrame.contentWindow.postMessage({
                            type: 'requestPageReady',
                            page: 'dashboard'
                        }, window.location.origin);
                    }, 100);
                } else {
                    // iframe 还在加载，监听 load 事件
                    dashboardFrame.addEventListener('load', () => {
                        setTimeout(() => {
                            dashboardFrame.contentWindow.postMessage({
                                type: 'requestPageReady',
                                page: 'dashboard'
                            }, window.location.origin);
                        }, 100);
                    }, { once: true });
                }
            }
        }

        // 初始化浏览器历史记录
        window.history.replaceState({ page: initialPage }, '', `#${initialPage}`);

        console.log('✅ SPA 控制器初始化完成，初始页面:', initialPage);
    }

    /**
     * 显示骨架屏
     */
    showSkeleton() {
        if (this.skeleton) {
            this.skeleton.classList.remove('hide');
            this.skeleton.classList.add('show');
            console.log('🎭 显示骨架屏');
        }
    }

    /**
     * 隐藏骨架屏
     */
    hideSkeleton() {
        if (this.skeleton) {
            this.skeleton.classList.remove('show');
            this.skeleton.classList.add('hide');
            // 等待动画完成后完全隐藏
            setTimeout(() => {
                this.skeleton.classList.remove('hide');
            }, 300);
            console.log('🎭 隐藏骨架屏');
        }
    }

    /**
     * 导航到指定页面
     * @param {string} page - 页面名称 (dashboard/trend/admin)
     * @param {boolean} pushState - 是否推入历史记录
     */
    navigateTo(page, pushState = true) {
        if (page === this.currentPage) return;

        console.log(`🔀 [SPA] 准备切换页面: ${this.currentPage} → ${page}`);

        // 🔐 导航守卫：访问admin页面需要验证token
        if (page === 'admin') {
            // 检查是否是从登录页面跳转过来的
            const urlParams = new URLSearchParams(window.location.search);
            const fromLogin = urlParams.get('from') === 'login';

            if (fromLogin) {
                console.log('✅ [SPA] 检测到从登录页面跳转，跳过token检查');
                // 清除URL参数，避免刷新时还是跳过检查
                const cleanUrl = window.location.origin + window.location.pathname + window.location.hash;
                window.history.replaceState(null, '', cleanUrl);
            } else {
                const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
                console.log('🔍 [SPA] 检查admin访问权限, token:', token ? '存在' : '不存在');

                if (!token) {
                    console.warn('⚠️ [SPA] 未找到token，重定向到登录页');
                    window.location.href = 'pages/login.html';
                    return; // 立即返回，不继续执行
                }
                console.log('✅ [SPA] token验证通过，允许访问admin页面');
            }
        }

        console.log(`🔀 [SPA] 开始切换页面: ${this.currentPage} → ${page}`);

        // admin页面不显示骨架屏（有自己的加载状态）
        if (page !== 'admin') {
            // 显示骨架屏
            this.showSkeleton();
        }

        // 隐藏当前页面
        const currentFrame = document.getElementById(`frame-${this.currentPage}`);
        if (currentFrame) {
            currentFrame.classList.remove('active');
        }

        // 懒加载 iframe
        const targetFrame = document.getElementById(`frame-${page}`);
        if (targetFrame && !this.loadedFrames.has(page)) {
            const src = targetFrame.getAttribute('data-src');
            if (src) {
                console.log(`📄 加载页面: ${src}`);
                targetFrame.src = src;
                this.loadedFrames.add(page);

                // 监听 iframe 加载完成
                targetFrame.addEventListener('load', () => {
                    console.log(`✅ iframe HTML 加载完成: ${page}，等待页面初始化...`);

                    // 应用主题到新加载的 iframe
                    if (window.themeManager) {
                        setTimeout(() => {
                            window.themeManager.applyThemeToIframes();
                            console.log(`🎨 已应用主题到新加载的 iframe: ${page}`);
                        }, 100);
                    }
                    // 注意：不在这里隐藏骨架屏，等待 iframe 发送 pageReady 消息
                }, { once: true });
            }
        } else if (targetFrame) {
            // 页面已加载过，主动询问是否就绪
            console.log(`📤 询问已加载页面是否就绪: ${page}`);
            setTimeout(() => {
                try {
                    targetFrame.contentWindow.postMessage({
                        type: 'requestPageReady',
                        page: page
                    }, window.location.origin);
                } catch (e) {
                    console.error('❌ 发送消息失败:', e);
                    // 如果发送失败，3秒后自动隐藏骨架屏
                    setTimeout(() => this.hideSkeleton(), 3000);
                }
            }, 100);
        }

        // 显示目标页面
        if (targetFrame) {
            targetFrame.classList.add('active');
        }

        // 更新导航栏高亮
        document.querySelectorAll('.nav-link').forEach(link => {
            if (link.getAttribute('data-page') === page) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        // 更新浏览器历史记录
        if (pushState) {
            window.history.pushState({ page }, '', `#${page}`);
        }

        // 更新页面标题
        const titles = {
            'dashboard': '卫星任务数据分析平台',
            'trend': '数据趋势分析 - 卫星任务数据分析平台',
            'distribution': '数据分布统计 - 卫星任务数据分析平台',
            'warning': '圈次数据预警 - 卫星任务数据分析平台',
            'admin': '数据管理 - 卫星任务数据分析平台'
        };
        document.title = titles[page] || '卫星任务数据分析平台';

        // admin页面：启用全屏模式（隐藏主导航）
        if (page === 'admin') {
            document.body.classList.add('admin-mode');
            console.log('✅ 启用admin全屏模式');
        } else {
            document.body.classList.remove('admin-mode');
            console.log('✅ 恢复正常导航模式');
        }

        this.currentPage = page;
    }

    /**
     * 获取当前页面
     */
    getCurrentPage() {
        return this.currentPage;
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    window.spaController = new SPAController();
    console.log('✅ SPA 控制器已初始化');
    console.log('💡 提示：主题由各 iframe 的 iframe-helper.js 自动应用');
});

// 全局快捷键支持（可选）
document.addEventListener('keydown', (e) => {
    // Alt + 1/2/3/4/5 快速切换页面
    if (e.altKey && !e.ctrlKey && !e.shiftKey) {
        const pageMap = {
            '1': 'dashboard',
            '2': 'trend',
            '3': 'distribution',
            '4': 'warning',
            '5': 'admin'
        };
        const page = pageMap[e.key];
        if (page && window.spaController) {
            e.preventDefault();
            window.spaController.navigateTo(page);
        }
    }
});
