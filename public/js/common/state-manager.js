/**
 * 🗄️ 状态管理器 - 基于 IndexedDB
 * 功能：
 * 1. 跨页面保存和恢复筛选条件、图表数据
 * 2. 页面切换时保留状态
 * 3. 页面刷新或关闭时自动清空数据
 */

class StateManager {
  constructor() {
    this.dbName = 'SatelliteDataAnalysis';
    this.dbVersion = 1;
    this.db = null;

    // 存储名称
    this.stores = {
      filters: 'filters',      // 筛选条件
      chartData: 'chartData',  // 图表数据
      tableData: 'tableData',  // 表格数据
      theme: 'theme'          // 主题设置
    };

    this.init();
  }

  /**
   * 初始化状态管理器
   */
  async init() {
    console.log('🗄️ 状态管理器初始化...');

    // 打开数据库（先打开数据库）
    await this.openDatabase();

    // 检测是否在 iframe 中（SPA 模式）
    const isInIframe = window !== window.parent;

    if (isInIframe) {
      console.log('🖼️ 在 SPA iframe 中，保留所有状态');
      // 在 iframe 中不清空数据，因为是页面切换
    } else {
      // 独立打开时，检测是否为页面刷新
      const isPageRefresh = this.detectPageRefresh();

      if (isPageRefresh) {
        console.log('🔄 检测到页面刷新，清空所有状态（包括主题）');
        await this.clearAllData();
      } else {
        console.log('🔗 检测到页面导航，保留所有状态');
      }

      // 监听页面关闭事件（仅在非 iframe 模式下）
      this.setupUnloadHandler();
    }

    console.log('✅ 状态管理器初始化完成');
  }

  /**
   * 检测是否为页面刷新
   */
  detectPageRefresh() {
    // 使用 performance.navigation API
    if (performance.navigation) {
      const navigationType = performance.navigation.type;
      return navigationType === 1; // 1 = reload
    }

    // 新的 PerformanceNavigationTiming API
    const perfEntries = performance.getEntriesByType('navigation');
    if (perfEntries.length > 0) {
      const navEntry = perfEntries[0];
      return navEntry.type === 'reload';
    }

    return false;
  }

  /**
   * 打开 IndexedDB 数据库
   */
  openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('❌ IndexedDB 打开失败:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ IndexedDB 打开成功');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        console.log('📦 IndexedDB 升级中...');
        const db = event.target.result;

        // 创建对象存储
        Object.values(this.stores).forEach(storeName => {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'id' });
            console.log(`  ✅ 创建对象存储: ${storeName}`);
          }
        });
      };
    });
  }

  /**
   * 设置页面卸载处理器（关闭时清空数据）
   */
  setupUnloadHandler() {
    // 标记页面是否正在跳转到同源页面
    let isNavigatingToSameSite = false;

    // 监听链接点击，检测是否为内部导航
    document.addEventListener('click', (e) => {
      const target = e.target.closest('a');
      if (target && target.href) {
        const targetUrl = new URL(target.href, window.location.origin);
        const currentUrl = new URL(window.location.href);

        // 检查是否为同源导航
        if (targetUrl.origin === currentUrl.origin) {
          isNavigatingToSameSite = true;
          console.log('🔗 检测到内部页面导航，数据将保留');

          // 2秒后重置标志（防止用户取消导航）
          setTimeout(() => {
            isNavigatingToSameSite = false;
          }, 2000);
        }
      }
    });

    // 使用 beforeunload 事件
    window.addEventListener('beforeunload', (e) => {
      // 如果是内部导航，不清空数据
      if (isNavigatingToSameSite) {
        console.log('🔗 内部导航，保留IndexedDB数据');
        return;
      }

      // 检查是否是刷新
      const perfEntries = performance.getEntriesByType('navigation');
      if (perfEntries.length > 0) {
        const navType = perfEntries[0].type;
        if (navType === 'reload') {
          // 刷新时清空所有数据（包括主题）
          console.log('🔄 页面刷新，清空所有状态');
          this.clearAllDataSync();
        }
      }
    });

    // 使用 pagehide 事件（处理标签页关闭）
    window.addEventListener('pagehide', (e) => {
      // 如果是内部导航，不清空
      if (isNavigatingToSameSite) {
        return;
      }

      // 如果是 BFCache（前进/后退），不清空
      if (e.persisted) {
        console.log('📜 进入BFCache，保留数据');
        return;
      }

      // 标签页关闭时清空所有数据
      console.log('🔌 标签页关闭，清空所有状态');
      this.clearAllDataSync();
    });

    // 使用 visibilitychange 监听
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        // 标记最后访问时间
        sessionStorage.setItem('lastVisit', Date.now().toString());
      }
    });
  }

  /**
   * 保存数据到指定存储
   */
  async saveData(storeName, id, data) {
    if (!this.db) {
      console.warn('⚠️ 数据库未初始化');
      return false;
    }

    try {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);

      const dataToSave = {
        id: id,
        data: data,
        timestamp: Date.now()
      };

      const request = store.put(dataToSave);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          console.log(`💾 保存成功: ${storeName}/${id}`);
          resolve(true);
        };
        request.onerror = () => {
          console.error(`❌ 保存失败: ${storeName}/${id}`, request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('❌ 保存数据出错:', error);
      return false;
    }
  }

  /**
   * 从指定存储读取数据
   */
  async loadData(storeName, id) {
    if (!this.db) {
      console.warn('⚠️ 数据库未初始化');
      return null;
    }

    try {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          if (request.result) {
            console.log(`📂 加载成功: ${storeName}/${id}`);
            resolve(request.result.data);
          } else {
            console.log(`📭 无数据: ${storeName}/${id}`);
            resolve(null);
          }
        };
        request.onerror = () => {
          console.error(`❌ 加载失败: ${storeName}/${id}`, request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('❌ 加载数据出错:', error);
      return null;
    }
  }

  /**
   * 删除指定数据
   */
  async deleteData(storeName, id) {
    if (!this.db) return false;

    try {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);

      return new Promise((resolve) => {
        request.onsuccess = () => {
          console.log(`🗑️ 删除成功: ${storeName}/${id}`);
          resolve(true);
        };
        request.onerror = () => {
          console.error(`❌ 删除失败: ${storeName}/${id}`);
          resolve(false);
        };
      });
    } catch (error) {
      console.error('❌ 删除数据出错:', error);
      return false;
    }
  }

  /**
   * 清空会话数据（保留主题设置）
   */
  async clearSessionData() {
    if (!this.db) {
      console.warn('⚠️ 数据库未打开，跳过清空');
      return false;
    }

    try {
      // 只清空会话级别的数据，保留主题设置
      const sessionStores = [this.stores.filters, this.stores.chartData, this.stores.tableData];
      const transaction = this.db.transaction(sessionStores, 'readwrite');

      for (const storeName of sessionStores) {
        const store = transaction.objectStore(storeName);
        store.clear();
      }

      return new Promise((resolve) => {
        transaction.oncomplete = () => {
          console.log('🗑️ 会话数据已清空（主题已保留）');
          resolve(true);
        };
        transaction.onerror = () => {
          console.error('❌ 清空会话数据失败');
          resolve(false);
        };
      });
    } catch (error) {
      console.error('❌ 清空会话数据出错:', error);
      return false;
    }
  }

  /**
   * 清空所有数据（包括主题）
   */
  async clearAllData() {
    if (!this.db) {
      // 如果数据库未打开，直接删除整个数据库
      return new Promise((resolve) => {
        const request = indexedDB.deleteDatabase(this.dbName);
        request.onsuccess = () => {
          console.log('🗑️ 数据库已删除');
          resolve(true);
        };
        request.onerror = () => {
          console.error('❌ 数据库删除失败');
          resolve(false);
        };
      });
    }

    try {
      const storeNames = Object.values(this.stores);
      const transaction = this.db.transaction(storeNames, 'readwrite');

      for (const storeName of storeNames) {
        const store = transaction.objectStore(storeName);
        store.clear();
      }

      return new Promise((resolve) => {
        transaction.oncomplete = () => {
          console.log('🗑️ 所有数据已清空');
          resolve(true);
        };
        transaction.onerror = () => {
          console.error('❌ 清空数据失败');
          resolve(false);
        };
      });
    } catch (error) {
      console.error('❌ 清空数据出错:', error);
      return false;
    }
  }

  /**
   * 同步清空所有数据（用于页面卸载）
   */
  clearAllDataSync() {
    try {
      // 使用同步方式标记需要清空
      sessionStorage.setItem('needClearDB', 'true');

      // 立即删除数据库
      indexedDB.deleteDatabase(this.dbName);
      console.log('🗑️ 数据库删除请求已发送');
    } catch (error) {
      console.error('❌ 同步清空数据失败:', error);
    }
  }

  /**
   * 保存筛选条件
   */
  async saveFilters(pageId, filters) {
    return this.saveData(this.stores.filters, pageId, filters);
  }

  /**
   * 加载筛选条件
   */
  async loadFilters(pageId) {
    return this.loadData(this.stores.filters, pageId);
  }

  /**
   * 保存图表数据
   */
  async saveChartData(pageId, chartData) {
    return this.saveData(this.stores.chartData, pageId, chartData);
  }

  /**
   * 加载图表数据
   */
  async loadChartData(pageId) {
    return this.loadData(this.stores.chartData, pageId);
  }

  /**
   * 保存表格数据
   */
  async saveTableData(pageId, tableData) {
    return this.saveData(this.stores.tableData, pageId, tableData);
  }

  /**
   * 加载表格数据
   */
  async loadTableData(pageId) {
    return this.loadData(this.stores.tableData, pageId);
  }

  /**
   * 保存主题设置
   */
  async saveTheme(theme) {
    return this.saveData(this.stores.theme, 'current', theme);
  }

  /**
   * 加载主题设置
   */
  async loadTheme() {
    return this.loadData(this.stores.theme, 'current');
  }

  /**
   * 关闭数据库连接
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('🔒 数据库连接已关闭');
    }
  }
}

// 页面加载时自动初始化
if (typeof window !== 'undefined') {
  // 检查是否需要清空数据库
  const needClearDB = sessionStorage.getItem('needClearDB');
  if (needClearDB === 'true') {
    console.log('🗑️ 检测到清空标记，删除数据库');
    indexedDB.deleteDatabase('SatelliteDataAnalysis');
    sessionStorage.removeItem('needClearDB');
  }

  // 初始化状态管理器
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
      window.stateManager = new StateManager();
      await window.stateManager.init();
      console.log('✅ 状态管理器已加载 (DOMContentLoaded)');
    });
  } else {
    window.stateManager = new StateManager();
    window.stateManager.init().then(() => {
      console.log('✅ 状态管理器已加载 (立即)');
    });
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StateManager;
}
