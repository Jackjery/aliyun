/**
 * 🔄 状态恢复辅助工具
 * 自动保存和恢复页面筛选条件、图表数据等
 */

class StateRestore {
  constructor(pageId) {
    this.pageId = pageId; // 页面标识符：'index' 或 'trend-analysis'
    this.stateManager = window.stateManager;
  }

  /**
   * 等待状态管理器初始化
   */
  async waitForStateManager() {
    return new Promise((resolve) => {
      if (window.stateManager && window.stateManager.db) {
        this.stateManager = window.stateManager;
        resolve();
      } else {
        const checkInterval = setInterval(() => {
          if (window.stateManager && window.stateManager.db) {
            this.stateManager = window.stateManager;
            clearInterval(checkInterval);
            resolve();
          }
        }, 50);

        setTimeout(() => {
          clearInterval(checkInterval);
          console.warn('⚠️ 状态管理器初始化超时');
          resolve();
        }, 3000);
      }
    });
  }

  /**
   * 恢复筛选条件
   */
  async restoreFilters() {
    if (!this.stateManager) {
      await this.waitForStateManager();
    }

    if (!this.stateManager) return null;

    try {
      const filters = await this.stateManager.loadFilters(this.pageId);

      if (filters) {
        console.log(`📂 恢复筛选条件 (${this.pageId}):`, filters);

        // 自动填充表单
        Object.keys(filters).forEach(key => {
          const element = document.getElementById(key);
          if (element) {
            if (element.type === 'checkbox') {
              element.checked = filters[key];
            } else {
              element.value = filters[key];
            }
          }
        });

        return filters;
      }
    } catch (error) {
      console.error('❌ 恢复筛选条件失败:', error);
    }

    return null;
  }

  /**
   * 保存筛选条件
   */
  async saveFilters(filters) {
    if (!this.stateManager) {
      await this.waitForStateManager();
    }

    if (!this.stateManager) return false;

    try {
      await this.stateManager.saveFilters(this.pageId, filters);
      console.log(`💾 保存筛选条件 (${this.pageId}):`, filters);
      return true;
    } catch (error) {
      console.error('❌ 保存筛选条件失败:', error);
      return false;
    }
  }

  /**
   * 从表单元素自动收集筛选条件
   */
  collectFiltersFromForm(formElementIds) {
    const filters = {};

    formElementIds.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        if (element.type === 'checkbox') {
          filters[id] = element.checked;
        } else {
          filters[id] = element.value;
        }
      }
    });

    return filters;
  }

  /**
   * 自动监听表单变化并保存
   */
  autoSaveFilters(formElementIds, debounceMs = 500) {
    let saveTimeout;

    const saveHandler = () => {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(async () => {
        const filters = this.collectFiltersFromForm(formElementIds);
        await this.saveFilters(filters);
      }, debounceMs);
    };

    formElementIds.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.addEventListener('change', saveHandler);
        if (element.type === 'text' || element.type === 'date') {
          element.addEventListener('input', saveHandler);
        }
      }
    });

    console.log(`🔄 已启用自动保存筛选条件 (${formElementIds.length} 个字段)`);
  }

  /**
   * 恢复图表数据
   */
  async restoreChartData() {
    if (!this.stateManager) {
      await this.waitForStateManager();
    }

    if (!this.stateManager) return null;

    try {
      const chartData = await this.stateManager.loadChartData(this.pageId);

      if (chartData) {
        console.log(`📂 恢复图表数据 (${this.pageId})`);
        return chartData;
      }
    } catch (error) {
      console.error('❌ 恢复图表数据失败:', error);
    }

    return null;
  }

  /**
   * 保存图表数据
   */
  async saveChartData(chartData) {
    if (!this.stateManager) {
      await this.waitForStateManager();
    }

    if (!this.stateManager) return false;

    try {
      await this.stateManager.saveChartData(this.pageId, chartData);
      console.log(`💾 保存图表数据 (${this.pageId})`);
      return true;
    } catch (error) {
      console.error('❌ 保存图表数据失败:', error);
      return false;
    }
  }

  /**
   * 恢复表格数据
   */
  async restoreTableData() {
    if (!this.stateManager) {
      await this.waitForStateManager();
    }

    if (!this.stateManager) return null;

    try {
      const tableData = await this.stateManager.loadTableData(this.pageId);

      if (tableData) {
        console.log(`📂 恢复表格数据 (${this.pageId})`);
        return tableData;
      }
    } catch (error) {
      console.error('❌ 恢复表格数据失败:', error);
    }

    return null;
  }

  /**
   * 保存表格数据
   */
  async saveTableData(tableData) {
    if (!this.stateManager) {
      await this.waitForStateManager();
    }

    if (!this.stateManager) return false;

    try {
      await this.stateManager.saveTableData(this.pageId, tableData);
      console.log(`💾 保存表格数据 (${this.pageId})`);
      return true;
    } catch (error) {
      console.error('❌ 保存表格数据失败:', error);
      return false;
    }
  }

  /**
   * 清空当前页面的所有数据
   */
  async clearPageData() {
    if (!this.stateManager) return;

    try {
      await this.stateManager.deleteData('filters', this.pageId);
      await this.stateManager.deleteData('chartData', this.pageId);
      await this.stateManager.deleteData('tableData', this.pageId);
      console.log(`🗑️ 已清空页面数据 (${this.pageId})`);
    } catch (error) {
      console.error('❌ 清空页面数据失败:', error);
    }
  }
}

// 导出
if (typeof window !== 'undefined') {
  window.StateRestore = StateRestore;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = StateRestore;
}
