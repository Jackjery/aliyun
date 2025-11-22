/**
 * 🎨 主题管理器 - 支持深色/浅色模式切换 + 多彩主题切换 + 跨页面同步
 * 功能：
 * 1. 深色/浅色模式切换
 * 2. 9种彩色主题切换
 * 3. 跨页面实时同步主题设置
 * 4. 页面跳转保留主题，刷新/关闭清空设置
 */

class ThemeManager {
  constructor() {
    // 主题配置
    this.themes = {
      // 颜色主题
      colors: [
        { id: 'blue', name: '科技蓝', class: '', color: '#165DFF' },
        { id: 'orange', name: '落日橙', class: 'theme-orange', color: '#FF7D00' },
        { id: 'green', name: '森林绿', class: 'theme-green', color: '#00B42A' },
        { id: 'cyan', name: '海洋青', class: 'theme-cyan', color: '#36CFC9' },
        { id: 'purple', name: '极光紫', class: 'theme-purple', color: '#722ED1' },
        { id: 'pink', name: '樱花粉', class: 'theme-pink', color: '#EC4899' },
        { id: 'red', name: '热情红', class: 'theme-red', color: '#EF4444' },
        { id: 'brown', name: '咖啡棕', class: 'theme-brown', color: '#A55449' },
        { id: 'amber', name: '黄昏金', class: 'theme-amber', color: '#F59E0B' },
        { id: 'rainbow', name: '彩虹', class: 'theme-rainbow', color: 'linear-gradient(90deg, #EF4444, #F97316, #F59E0B, #22C55E, #0EA5E9, #6366F1, #A855F7)' }
      ],
      // 模式
      modes: [
        { id: 'light', name: '浅色', class: '' },
        { id: 'dark', name: '深色', class: 'theme-dark' }
      ]
    };

    // 默认主题
    this.currentColorTheme = 'blue';
    this.currentMode = 'light';

    // 初始化
    this.init();
  }

  /**
   * 初始化主题管理器
   */
  async init() {
    console.log('🎨 主题管理器初始化...');

    // 应用默认主题
    this.applyTheme(false);

    // 创建主题切换UI
    this.createThemeSwitcher();

    console.log(`✅ 当前主题: ${this.currentColorTheme} (${this.currentMode}模式)`);
  }


  /**
   * 检测是否为页面刷新
   * @returns {boolean} 是否为刷新
   */
  detectPageRefresh() {
    // 使用 performance.navigation API 检测导航类型
    if (performance.navigation) {
      // type: 0=正常导航, 1=刷新, 2=前进/后退
      const navigationType = performance.navigation.type;
      return navigationType === 1; // 1 表示刷新
    }

    // 新的 PerformanceNavigationTiming API
    const perfEntries = performance.getEntriesByType('navigation');
    if (perfEntries.length > 0) {
      const navEntry = perfEntries[0];
      return navEntry.type === 'reload'; // 'reload' 表示刷新
    }

    return false;
  }



  /**
   * 应用主题到页面
   * @param {boolean} broadcast - 是否广播主题变化
   */
  applyTheme(broadcast = true) {
    console.log(`🎨 应用主题: ${this.currentColorTheme} (${this.currentMode}模式)`);

    // 应用到当前页面
    this.applyThemeToDocument(document);

    // 如果是主框架，应用到所有 iframe
    if (window === window.top) {
      this.applyThemeToIframes();
    }

    // 更新UI状态
    if (this.updateUI) {
      this.updateUI();
    }

    // 触发自定义事件，通知当前页面组件主题已更改
    window.dispatchEvent(new CustomEvent('themeChanged', {
      detail: {
        color: this.currentColorTheme,
        mode: this.currentMode
      }
    }));
  }

  /**
   * 应用主题到指定 document
   * @param {Document} doc - 目标文档对象
   */
  applyThemeToDocument(doc) {
    if (!doc || !doc.documentElement) {
      console.warn('⚠️ 无效的文档对象，跳过主题应用');
      return;
    }

    const html = doc.documentElement;

    // 移除所有主题class
    this.themes.colors.forEach(theme => {
      if (theme.class) html.classList.remove(theme.class);
    });
    this.themes.modes.forEach(mode => {
      if (mode.class) html.classList.remove(mode.class);
    });

    // 添加当前主题class
    const colorTheme = this.themes.colors.find(t => t.id === this.currentColorTheme);
    const modeTheme = this.themes.modes.find(m => m.id === this.currentMode);

    if (colorTheme && colorTheme.class) {
      html.classList.add(colorTheme.class);
    }

    if (modeTheme && modeTheme.class) {
      html.classList.add(modeTheme.class);
    }

    // 触发重新渲染以确保主题生效
    if (doc.body) {
      // 触发强制重绘
      doc.body.offsetHeight;
    }

    console.log(`  🎨 主题已应用: ${this.currentColorTheme} (${this.currentMode})`);
  }

  /**
   * 应用主题到所有 iframe（仅主框架调用）
   */
  applyThemeToIframes() {
    const iframes = document.querySelectorAll('iframe.page-frame');
    iframes.forEach(iframe => {
      try {
        if (iframe.contentDocument) {
          this.applyThemeToDocument(iframe.contentDocument);
          console.log(`  ✅ 应用主题到 iframe: ${iframe.id}`);
        }
      } catch (e) {
        // 跨域 iframe 无法访问，忽略
        console.warn(`  ⚠️ 无法访问 iframe: ${iframe.id}`, e);
      }
    });
  }

  /**
   * 切换颜色主题
   */
  setColorTheme(themeId) {
    if (this.themes.colors.find(t => t.id === themeId)) {
      this.currentColorTheme = themeId;
      this.applyTheme();
      console.log(`🎨 切换颜色主题: ${themeId}`);
    }
  }

  /**
   * 切换深色/浅色模式
   */
  setMode(modeId) {
    if (this.themes.modes.find(m => m.id === modeId)) {
      this.currentMode = modeId;
      this.applyTheme();
      console.log(`🌓 切换模式: ${modeId}`);
    }
  }

  /**
   * 切换深色/浅色模式（toggle）
   */
  toggleMode() {
    this.currentMode = this.currentMode === 'light' ? 'dark' : 'light';
    this.applyTheme();
  }

  /**
   * 创建主题切换UI
   */
  createThemeSwitcher() {
    // 检查是否已存在
    if (document.getElementById('theme-switcher')) return;

    const switcher = document.createElement('div');
    switcher.id = 'theme-switcher';
    switcher.className = 'fixed bottom-6 right-6 z-50';
    switcher.style.cssText = 'position: fixed; bottom: 24px; right: 24px; z-index: 9999;';
    switcher.innerHTML = `
      <!-- 主题切换按钮 -->
      <button id="theme-toggle-btn"
              class="bg-white dark:bg-gray-800 p-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110"
              style="background: rgb(var(--bg-base)); padding: 12px; border-radius: 50%; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); transition: all 0.3s; border: none; cursor: pointer;"
              title="主题设置"
              onmouseover="this.style.transform='scale(1.1)'"
              onmouseout="this.style.transform='scale(1)'">
        <svg style="width: 24px; height: 24px; color: rgb(var(--text-primary));" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
      </button>

      <!-- 主题选择面板 -->
      <div id="theme-panel" class="hidden absolute bottom-16 right-0 bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-4 w-80 animate-fade-in"
           style="display: none; position: absolute; bottom: 64px; right: 0; background: rgb(var(--bg-base)); border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); padding: 16px; width: 320px; color: rgb(var(--text-primary));">

        <div class="mb-4">
          <h3 class="text-sm font-semibold mb-3 flex items-center">
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
            模式选择
          </h3>
          <div class="flex gap-2">
            <button data-mode="light" class="mode-btn flex-1 px-3 py-2 rounded-lg border-2 transition-all">
              <svg class="w-5 h-5 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <span class="text-xs">浅色</span>
            </button>
            <button data-mode="dark" class="mode-btn flex-1 px-3 py-2 rounded-lg border-2 transition-all">
              <svg class="w-5 h-5 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
              <span class="text-xs">深色</span>
            </button>
          </div>
        </div>

        <div>
          <h3 class="text-sm font-semibold mb-3 flex items-center">
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
            主题颜色
          </h3>
          <div class="grid grid-cols-5 gap-2">
            ${this.themes.colors.map(theme => `
              <button data-theme="${theme.id}"
                      class="theme-color-btn w-10 h-10 rounded-lg transition-all hover:scale-110"
                      style="background: ${theme.color};"
                      title="${theme.name}">
                <svg class="w-5 h-5 mx-auto text-white hidden" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(switcher);

    // 绑定事件
    this.bindEvents();
  }

  /**
   * 绑定事件
   */
  bindEvents() {
    // 切换面板显示
    const toggleBtn = document.getElementById('theme-toggle-btn');
    const panel = document.getElementById('theme-panel');

    toggleBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = panel.style.display === 'none' || panel.classList.contains('hidden');
      panel.style.display = isHidden ? 'block' : 'none';
      panel.classList.toggle('hidden');
      console.log('🎨 主题面板', isHidden ? '打开' : '关闭');
    });

    // 点击外部关闭面板
    document.addEventListener('click', (e) => {
      if (!panel?.contains(e.target) && e.target !== toggleBtn) {
        panel.style.display = 'none';
        panel?.classList.add('hidden');
      }
    });

    // 模式切换按钮
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = e.currentTarget.dataset.mode;
        this.setMode(mode);
        this.updateUI();
      });
    });

    // 颜色主题切换按钮
    document.querySelectorAll('.theme-color-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const theme = e.currentTarget.dataset.theme;
        this.setColorTheme(theme);
        this.updateUI();
      });
    });

    // 初始UI状态
    this.updateUI();
  }

  /**
   * 更新UI状态（高亮当前选中的主题）
   */
  updateUI() {
    // 更新模式按钮
    document.querySelectorAll('.mode-btn').forEach(btn => {
      const isActive = btn.dataset.mode === this.currentMode;
      if (isActive) {
        btn.style.borderColor = `rgb(var(--color-primary))`;
        btn.style.backgroundColor = `rgba(var(--color-primary), 0.1)`;
      } else {
        btn.style.borderColor = `rgb(var(--border-color))`;
        btn.style.backgroundColor = 'transparent';
      }
    });

    // 更新颜色主题按钮
    document.querySelectorAll('.theme-color-btn').forEach(btn => {
      const isActive = btn.dataset.theme === this.currentColorTheme;
      const svg = btn.querySelector('svg');
      if (svg) {
        svg.style.display = isActive ? 'block' : 'none';
      }
      if (isActive) {
        btn.style.transform = 'scale(1.1)';
        btn.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.2)';
      } else {
        btn.style.transform = 'scale(1)';
        btn.style.boxShadow = 'none';
      }
    });
  }

  /**
   * 获取当前主题信息
   */
  getCurrentTheme() {
    return {
      color: this.currentColorTheme,
      mode: this.currentMode,
      colorName: this.themes.colors.find(t => t.id === this.currentColorTheme)?.name,
      modeName: this.themes.modes.find(m => m.id === this.currentMode)?.name
    };
  }
}

// 页面加载完成后自动初始化
if (typeof window !== 'undefined') {
  // 检测是否在 iframe 中
  const isInIframe = window !== window.parent;

  if (!isInIframe) {
    // 只在主框架中初始化
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        window.themeManager = new ThemeManager();
        console.log('✅ 主题管理器已加载 (主框架)');
      });
    } else {
      // DOM已经加载完成，立即初始化
      window.themeManager = new ThemeManager();
      console.log('✅ 主题管理器已加载 (主框架 - 立即)');
    }
  } else {
    console.log('🖼️ 在 iframe 中，等待使用父窗口的主题管理器');
  }

  // 提供手动初始化方法（会被 iframe-helper.js 覆盖）
  window.initThemeManager = function() {
    if (!window.themeManager) {
      window.themeManager = new ThemeManager();
    }
  };
}

// 导出（如果使用模块化）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ThemeManager;
}
