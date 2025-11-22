/**
 * 🚀 SPA 路由管理器
 * 功能：
 * 1. 控制页面显示/隐藏（不销毁 DOM）
 * 2. 浏览器历史记录管理
 * 3. 支持前进/后退
 * 4. 保留页面状态（图表、滚动位置等）
 */

class SPARouter {
  constructor() {
    this.routes = {}; // 路由配置：{ '/': 'page-index', '/trend': 'page-trend' }
    this.currentPage = null;
    this.initialized = false;
  }

  /**
   * 注册路由
   * @param {string} path - 路由路径（如 '/', '/trend'）
   * @param {string} pageId - 页面容器 ID（如 'page-index'）
   */
  register(path, pageId) {
    this.routes[path] = pageId;
    console.log(`📍 注册路由: ${path} → #${pageId}`);
  }

  /**
   * 初始化路由器
   */
  init() {
    if (this.initialized) return;

    console.log('🚀 SPA 路由器初始化...');

    // 监听浏览器前进/后退
    window.addEventListener('popstate', (e) => {
      const path = e.state?.path || window.location.pathname;
      console.log('⬅️ 浏览器后退/前进:', path);
      this.navigateTo(path, false); // false = 不推入历史记录
    });

    // 拦截所有导航链接点击
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[data-route]');
      if (link) {
        e.preventDefault();
        const path = link.getAttribute('data-route');
        this.navigateTo(path);
      }
    });

    // 初始化当前页面
    const initialPath = window.location.pathname === '/' || window.location.pathname.endsWith('.html')
      ? '/'
      : window.location.pathname;

    this.navigateTo(initialPath, false);

    this.initialized = true;
    console.log('✅ SPA 路由器初始化完成');
  }

  /**
   * 导航到指定路径
   * @param {string} path - 目标路径
   * @param {boolean} pushState - 是否推入历史记录
   */
  navigateTo(path, pushState = true) {
    const pageId = this.routes[path];

    if (!pageId) {
      console.warn(`⚠️ 未找到路由: ${path}`);
      return;
    }

    console.log(`🔀 导航: ${this.currentPage || '无'} → ${path}`);

    // 隐藏所有页面
    Object.values(this.routes).forEach(id => {
      const page = document.getElementById(id);
      if (page) {
        page.style.display = 'none';
      }
    });

    // 显示目标页面
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
      targetPage.style.display = 'block';

      // 触发自定义事件，通知页面已显示
      window.dispatchEvent(new CustomEvent('pageShow', {
        detail: { path, pageId }
      }));
    }

    // 更新导航高亮
    this.updateNavigation(path);

    // 推入历史记录
    if (pushState) {
      const title = this.getPageTitle(path);
      window.history.pushState({ path }, title, path);
      document.title = title;
    }

    this.currentPage = path;
  }

  /**
   * 更新导航栏高亮
   * @param {string} activePath - 当前激活的路径
   */
  updateNavigation(activePath) {
    document.querySelectorAll('a[data-route]').forEach(link => {
      const linkPath = link.getAttribute('data-route');
      const isActive = linkPath === activePath;

      if (isActive) {
        // 激活样式
        link.classList.add('text-primary', 'font-medium', 'border-b-2', 'border-primary');
        link.classList.remove('text-gray-600', 'hover:text-primary');
      } else {
        // 非激活样式
        link.classList.remove('text-primary', 'font-medium', 'border-b-2', 'border-primary');
        link.classList.add('text-gray-600', 'hover:text-primary');
      }
    });
  }

  /**
   * 获取页面标题
   * @param {string} path - 路径
   * @returns {string} 页面标题
   */
  getPageTitle(path) {
    const titles = {
      '/': '卫星任务数据分析平台',
      '/trend': '数据趋势分析 - 卫星任务数据分析平台',
      '/distribution': '任务分布 - 卫星任务数据分析平台'
    };
    return titles[path] || '卫星任务数据分析平台';
  }

  /**
   * 获取当前页面路径
   * @returns {string} 当前路径
   */
  getCurrentPath() {
    return this.currentPage;
  }
}

// 全局单例
window.spaRouter = new SPARouter();

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SPARouter;
}
