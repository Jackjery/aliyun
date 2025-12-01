/**
 * 深度分析页面调试助手
 * 在浏览器控制台运行此脚本来诊断问题
 */

const DeepAnalysisDebugHelper = {
    /**
     * 检查所有依赖
     */
    checkDependencies() {
        console.log('🔍 检查依赖...\n');

        const dependencies = {
            'CONFIG': typeof CONFIG !== 'undefined',
            'WebSocketManager': typeof WebSocketManager !== 'undefined',
            'wsManager实例': typeof window.wsManager !== 'undefined',
            'MultiSelectDropdown': typeof MultiSelectDropdown !== 'undefined',
            'Chart': typeof Chart !== 'undefined',
            '工具函数': typeof calculateMovingAverage !== 'undefined',
            'DeepAnalysisApp': typeof DeepAnalysisApp !== 'undefined'
        };

        Object.entries(dependencies).forEach(([name, exists]) => {
            console.log(`${exists ? '✅' : '❌'} ${name}: ${exists ? '已加载' : '未加载'}`);
        });

        return dependencies;
    },

    /**
     * 检查 WebSocket 连接状态
     */
    checkWebSocket() {
        console.log('\n🔍 检查 WebSocket 连接...\n');

        if (!window.wsManager) {
            console.error('❌ WebSocket 管理器未初始化');
            return false;
        }

        const status = {
            '实例': window.wsManager ? '存在' : '不存在',
            '连接状态': window.wsManager.isConnected ? '已连接' : '未连接',
            'WebSocket对象': window.wsManager.ws ? '存在' : '不存在',
            'readyState': window.wsManager.ws?.readyState
        };

        const readyStateMap = {
            0: 'CONNECTING',
            1: 'OPEN',
            2: 'CLOSING',
            3: 'CLOSED'
        };

        Object.entries(status).forEach(([name, value]) => {
            if (name === 'readyState' && typeof value === 'number') {
                console.log(`${value === 1 ? '✅' : '⚠️'} ${name}: ${value} (${readyStateMap[value]})`);
            } else {
                console.log(`${name}: ${value}`);
            }
        });

        return window.wsManager.isConnected;
    },

    /**
     * 测试查询功能
     */
    async testQuery(queryType = 'filter_options') {
        console.log(`\n🔍 测试查询: ${queryType}...\n`);

        if (!window.wsManager || !window.wsManager.isConnected) {
            console.error('❌ WebSocket 未连接，无法测试');
            return;
        }

        try {
            console.log('📤 发送查询请求...');
            const result = await window.wsManager.queryStats(queryType, {
                dimension: 'customer'
            });

            console.log('✅ 查询成功！');
            console.log('📊 返回数据:', result);
            return result;
        } catch (error) {
            console.error('❌ 查询失败:', error.message);
            return null;
        }
    },

    /**
     * 完整诊断
     */
    async diagnose() {
        console.clear();
        console.log('🏥 开始完整诊断...\n');
        console.log('='.repeat(50) + '\n');

        // 1. 检查依赖
        console.log('第1步：检查依赖');
        const deps = this.checkDependencies();
        console.log('\n' + '='.repeat(50) + '\n');

        // 2. 检查 WebSocket
        console.log('第2步：检查 WebSocket 连接');
        const wsConnected = this.checkWebSocket();
        console.log('\n' + '='.repeat(50) + '\n');

        // 3. 测试查询
        if (wsConnected) {
            console.log('第3步：测试数据查询');
            await this.testQuery('filter_options');
            console.log('\n' + '='.repeat(50) + '\n');
        } else {
            console.warn('⚠️ 跳过第3步：WebSocket 未连接');
            console.log('\n' + '='.repeat(50) + '\n');
        }

        // 4. 生成诊断报告
        console.log('📋 诊断报告\n');

        const allDepsLoaded = Object.values(deps).every(v => v);
        console.log(`依赖加载: ${allDepsLoaded ? '✅ 全部正常' : '❌ 部分缺失'}`);
        console.log(`WebSocket: ${wsConnected ? '✅ 已连接' : '❌ 未连接'}`);

        console.log('\n' + '='.repeat(50) + '\n');

        if (!allDepsLoaded) {
            console.log('💡 建议：');
            console.log('1. 检查网络连接');
            console.log('2. 确认所有 JS 文件已正确加载');
            console.log('3. 清除浏览器缓存后重试');
        }

        if (!wsConnected) {
            console.log('💡 建议：');
            console.log('1. 检查后端服务是否运行');
            console.log('2. 访问健康检查端点: ' + (CONFIG?.API_ENDPOINTS?.health || 'N/A'));
            console.log('3. 检查控制台是否有 WebSocket 连接错误');
        }

        console.log('\n✅ 诊断完成！\n');
    },

    /**
     * 修复常见问题
     */
    async quickFix() {
        console.log('🔧 尝试快速修复...\n');

        // 1. 重新连接 WebSocket
        if (window.wsManager && !window.wsManager.isConnected) {
            console.log('📡 尝试重新连接 WebSocket...');
            try {
                await window.wsManager.connect();
                console.log('✅ WebSocket 重新连接成功');
            } catch (error) {
                console.error('❌ WebSocket 重新连接失败:', error.message);
            }
        }

        // 2. 通知页面就绪
        if (window.parent && window.parent !== window) {
            console.log('📣 发送页面就绪通知...');
            window.parent.postMessage({
                type: 'pageReady',
                page: 'deep-analysis'
            }, window.location.origin);
            console.log('✅ 页面就绪通知已发送');
        }

        console.log('\n✅ 快速修复完成！');
    },

    /**
     * 显示帮助信息
     */
    help() {
        console.log(`
🔧 深度分析页面调试助手

可用命令：
  DeepAnalysisDebugHelper.checkDependencies()  - 检查依赖加载状态
  DeepAnalysisDebugHelper.checkWebSocket()     - 检查 WebSocket 连接
  DeepAnalysisDebugHelper.testQuery()          - 测试数据查询
  DeepAnalysisDebugHelper.diagnose()           - 完整诊断（推荐）
  DeepAnalysisDebugHelper.quickFix()           - 尝试快速修复
  DeepAnalysisDebugHelper.help()               - 显示帮助信息

示例：
  // 运行完整诊断
  await DeepAnalysisDebugHelper.diagnose()

  // 尝试快速修复
  await DeepAnalysisDebugHelper.quickFix()

  // 测试特定查询
  await DeepAnalysisDebugHelper.testQuery('customer_dimension_trend')
        `);
    }
};

// 自动运行一次快速检查
if (typeof window !== 'undefined') {
    window.DeepAnalysisDebugHelper = DeepAnalysisDebugHelper;
    console.log('✅ 调试助手已加载！输入 DeepAnalysisDebugHelper.help() 查看帮助');
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DeepAnalysisDebugHelper;
}
