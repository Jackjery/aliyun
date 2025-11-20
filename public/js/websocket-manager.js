class WebSocketSyncManager {
    constructor() {
        this.ws = null;
        this.wsUrl = this.getWebSocketUrl();
        this.reconnectInterval = 5000; // 5秒重连间隔
        this.reconnectTimer = null;
        this.isConnected = false;
        this.isReconnecting = false;
        this.heartbeatInterval = null;
        this.missedHeartbeats = 0;
        this.maxMissedHeartbeats = 3;

        // 事件回调
        this.onSyncUpdate = null; // 收到数据更新时的回调
        this.onConnectionChange = null; // 连接状态变化回调
        this.onStatsDataChanged = null; // 🆕 统计数据变更回调（精确推送）

        // 🆕 统计查询请求-响应映射
        this.pendingStatsRequests = new Map(); // requestId → {resolve, reject, timeout}

        // 🆕 初始化页面可见性监听
        this.initVisibilityListener();
    }

    // 初始化页面可见性监听（纯后端模式：无需补同步逻辑）
    initVisibilityListener() {
        // 监听页面可见性变化
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                console.log('👋 页面隐藏');
            } else {
                console.log('👀 页面重新可见');
            }
        });
    }

    // 获取 WebSocket URL（根据环境自动配置）
    getWebSocketUrl() {
        // 本地开发环境
        if (CONFIG.isDevelopment) {
            return 'ws://localhost:3000/ws';
        }

        // 使用 config.js 中的 getWebSocketUrl 函数
        // 该函数会根据页面协议自动处理 ws/wss 转换
        if (typeof window.getWebSocketUrl === 'function') {
            return window.getWebSocketUrl();
        }

        // GitHub Pages 环境 - 使用配置的 WebSocket 地址
        if (CONFIG.isGitHubPages && CONFIG.API_ENDPOINTS.websocket) {
            return CONFIG.API_ENDPOINTS.websocket;
        }

        // 默认值（禁用 WebSocket）
        return null;
    }

    // 启动 WebSocket 连接
    connect() {
        if (!this.wsUrl) {
            console.warn('⚠️ WebSocket URL 未配置，跳过实时同步');
            return;
        }

        if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
            console.log('🔗 WebSocket 已连接，无需重复连接');
            return;
        }

        try {
            console.log(`🔗 正在连接 WebSocket: ${this.wsUrl}`);
            this.ws = new WebSocket(this.wsUrl);

            this.ws.onopen = () => this.handleOpen();
            this.ws.onmessage = (event) => this.handleMessage(event);
            this.ws.onclose = (event) => this.handleClose(event);
            this.ws.onerror = (error) => this.handleError(error);

        } catch (error) {
            console.error('❌ WebSocket 连接失败:', error);
            this.scheduleReconnect();
        }
    }

    // 连接成功处理
    async handleOpen() {
        console.log('✅ WebSocket 连接成功');
        this.isConnected = true;
        this.isReconnecting = false;
        this.missedHeartbeats = 0;

        // 通知连接状态变化
        if (this.onConnectionChange) {
            this.onConnectionChange(true);
        }

        // 启动心跳检测
        this.startHeartbeat();
    }

    // 接收消息处理
    async handleMessage(event) {
        try {
            const message = JSON.parse(event.data);
            console.log('📨 收到 WebSocket 消息:', message);

            switch (message.type) {
                case 'welcome':
                    // WebSocket连接欢迎消息
                    console.log('💡 WebSocket 连接成功，后续数据更新将通过实时推送获取');
                    break;

                case 'heartbeat':
                    // 心跳响应
                    this.missedHeartbeats = 0;
                    break;

                case 'data_change':
                    // 数据变更通知
                    await this.handleDataChange(message.data);
                    break;

                case 'batch_update':
                    // 批量更新通知
                    await this.handleBatchUpdate(message.data);
                    break;

                case 'stats_query_response':
                    // 🆕 统计查询响应
                    this.handleStatsQueryResponse(message);
                    break;

                case 'register_stats_config_response':
                    // 🆕 统计订阅配置注册响应
                    console.log('📝 统计订阅配置注册响应:', message.data.success ? '成功' : '失败');
                    break;

                case 'stats_data_changed':
                    // 🆕 统计数据变更通知（精确推送）
                    this.handleStatsDataChanged(message.data);
                    break;

                default:
                    console.warn('⚠️ 未知消息类型:', message.type);
            }
        } catch (error) {
            console.error('❌ 处理 WebSocket 消息失败:', error);
        }
    }

    // 处理数据变更
    async handleDataChange(changeData) {
        const { operation, record } = changeData;

        try {
            // 统一转换为小写，支持大小写不敏感
            const op = operation.toLowerCase();

            // 纯后端模式：只记录日志和触发回调，不更新本地缓存
            console.log(`🔔 数据变更通知：${op} 记录 ID: ${record?.id || '未知'}`);

            // 触发更新回调
            if (this.onSyncUpdate) {
                this.onSyncUpdate({ operation: op, record });
            }

        } catch (error) {
            console.error('❌ 处理数据变更失败:', error);
        }
    }

    // 处理批量更新通知
    async handleBatchUpdate(batchData) {
        const { records } = batchData;

        try {
            const count = records?.length || 0;

            // 纯后端模式：只记录通知，不更新本地缓存
            console.log(`🔔 批量数据变更通知：${count} 条记录`);

            // 触发更新回调
            if (this.onSyncUpdate) {
                this.onSyncUpdate({ operation: 'batch_update', count });
            }

        } catch (error) {
            console.error('❌ 处理批量更新通知失败:', error);
        }
    }

    // 连接关闭处理
    handleClose(event) {
        console.log(`🔌 WebSocket 连接关闭 (code: ${event.code}, reason: ${event.reason})`);
        this.isConnected = false;
        this.stopHeartbeat();

        // 通知连接状态变化
        if (this.onConnectionChange) {
            this.onConnectionChange(false);
        }

        // 非正常关闭时自动重连
        if (!event.wasClean && !this.isReconnecting) {
            this.scheduleReconnect();
        }
    }

    // 错误处理
    handleError(error) {
        console.error('❌ WebSocket 错误:', error);
    }

    // 安排重连
    scheduleReconnect() {
        if (this.isReconnecting) return;

        this.isReconnecting = true;
        console.log(`🔄 将在 ${this.reconnectInterval / 1000} 秒后重连...`);

        this.reconnectTimer = setTimeout(() => {
            console.log('🔄 尝试重新连接 WebSocket...');
            this.connect();
        }, this.reconnectInterval);
    }

    // 启动心跳检测
    startHeartbeat() {
        this.stopHeartbeat();

        this.heartbeatInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.missedHeartbeats++;

                if (this.missedHeartbeats >= this.maxMissedHeartbeats) {
                    console.warn('⚠️ 心跳超时，关闭连接并重连');
                    this.ws.close();
                    return;
                }

                // 发送心跳
                this.send({ type: 'heartbeat', timestamp: Date.now() });
            }
        }, 30000); // 每30秒发送心跳
    }

    // 停止心跳检测
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    // 发送消息
    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        } else {
            console.warn('⚠️ WebSocket 未连接，无法发送消息');
        }
    }

    // 断开连接
    disconnect() {
        console.log('🔌 主动断开 WebSocket 连接');
        this.isReconnecting = false;

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        this.stopHeartbeat();

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        this.isConnected = false;

        // 通知连接状态变化
        if (this.onConnectionChange) {
            this.onConnectionChange(false);
        }
    }

    // ==================== 🆕 统计查询功能 ====================

    /**
     * 发送统计查询请求
     * @param {string} queryType - 查询类型 (plan_stats, satellite_trend, customer_trend, overview)
     * @param {object} options - 查询选项 {startDate, endDate, groupBy, satelliteName, customerName}
     * @returns {Promise} - 查询结果
     */
    async queryStats(queryType, options) {
        if (!this.isConnected) {
            throw new Error('WebSocket未连接，请等待连接建立');
        }

        const requestId = this.generateRequestId();

        return new Promise((resolve, reject) => {
            // 设置超时（10秒）
            const timeout = setTimeout(() => {
                this.pendingStatsRequests.delete(requestId);
                reject(new Error('统计查询超时'));
            }, 10000);

            // 注册请求
            this.pendingStatsRequests.set(requestId, { resolve, reject, timeout });

            // 发送查询消息
            const message = {
                type: 'stats_query',
                requestId,
                data: {
                    queryType,
                    options
                }
            };

            console.log('📊 发送统计查询请求:', message);
            this.ws.send(JSON.stringify(message));
        });
    }

    /**
     * 处理统计查询响应
     */
    handleStatsQueryResponse(message) {
        const { requestId, data } = message;
        const pending = this.pendingStatsRequests.get(requestId);

        if (pending) {
            clearTimeout(pending.timeout);
            this.pendingStatsRequests.delete(requestId);

            if (data.success) {
                console.log(`✅ 统计查询成功: ${data.queryType}, 结果数: ${data.result.records?.length || 0}`);
                pending.resolve(data.result);
            } else {
                console.error(`❌ 统计查询失败: ${data.error}`);
                pending.reject(new Error(data.error || '统计查询失败'));
            }
        }
    }

    /**
     * 注册统计订阅配置（用于精确推送）
     * @param {object} config - 配置对象 {startDate, endDate, dimensions: {satellite, customer, station}}
     */
    registerStatsConfig(config) {
        if (!this.isConnected) {
            console.warn('⚠️ WebSocket未连接，无法注册统计订阅配置');
            return;
        }

        const message = {
            type: 'register_stats_config',
            data: config
        };

        console.log('📝 注册统计订阅配置:', config);
        this.ws.send(JSON.stringify(message));
    }

    /**
     * 处理统计数据变更通知（精确推送）
     */
    handleStatsDataChanged(data) {
        console.log('📢 收到统计数据变更通知（精确推送）:', data);

        // 触发回调
        if (this.onStatsDataChanged) {
            this.onStatsDataChanged(data);
        }
    }

    /**
     * 生成请求ID
     */
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

// 全局实例（纯后端模式，不使用本地缓存）
const wsSyncManager = new WebSocketSyncManager();

// ==================== API 函数（纯后端模式）====================

// 注意：fetchDataFromAPI 已废弃，纯后端模式下应直接调用后端API
// 如果代码中仍在使用此函数，请改为调用 fetchStatsFromAPI 或直接使用后端 API

async function fetchStatsFromAPI(params = {}) {
    try {
        const qs = new URLSearchParams(params).toString();
        const url = getApiUrl('stats');
        const response = await fetch(`${url}?${qs}`, {
            method: 'GET',
            mode: 'cors',
            credentials: 'omit',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || '获取统计数据失败');
        }

        return result.data;
    } catch (error) {
        console.error('获取统计数据失败:', error);
        showError('获取统计数据失败: ' + error.message);
        return null;
    }
}

