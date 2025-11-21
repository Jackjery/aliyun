/**
 * WebSocket管理器 - 简化版（无IndexedDB）
 * 功能：
 * 1. WebSocket连接管理
 * 2. 统计查询（通过WebSocket）
 * 3. 数据变更通知（提示用户刷新）
 */
class WebSocketManager {
    constructor() {
        this.ws = null;
        this.wsUrl = getWebSocketUrl();
        this.reconnectInterval = 5000; // 5秒重连间隔
        this.reconnectTimer = null;
        this.isConnected = false;
        this.isReconnecting = false;
        this.heartbeatInterval = null;
        this.missedHeartbeats = 0;
        this.maxMissedHeartbeats = 3;

        // 事件回调
        this.onDataChange = null; // 数据变更回调
        this.onConnectionChange = null; // 连接状态变化回调

        // 统计查询请求映射
        this.pendingRequests = new Map(); // requestId → {resolve, reject, timeout}
    }

    // 连接WebSocket
    connect() {
        if (!this.wsUrl) {
            console.warn('⚠️ WebSocket URL未配置');
            return;
        }

        if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
            console.log('🔗 WebSocket已连接');
            return;
        }

        try {
            console.log(`🔗 连接WebSocket: ${this.wsUrl}`);
            this.ws = new WebSocket(this.wsUrl);

            this.ws.onopen = () => this.handleOpen();
            this.ws.onmessage = (event) => this.handleMessage(event);
            this.ws.onclose = (event) => this.handleClose(event);
            this.ws.onerror = (error) => this.handleError(error);

        } catch (error) {
            console.error('❌ WebSocket连接失败:', error);
            this.scheduleReconnect();
        }
    }

    // 连接成功
    handleOpen() {
        console.log('✅ WebSocket连接成功');
        this.isConnected = true;
        this.isReconnecting = false;
        this.missedHeartbeats = 0;

        if (this.onConnectionChange) {
            this.onConnectionChange(true);
        }

        this.startHeartbeat();
    }

    // 接收消息
    handleMessage(event) {
        try {
            const message = JSON.parse(event.data);
            console.log('📨 收到消息:', message.type);

            switch (message.type) {
                case 'welcome':
                    console.log('💡 WebSocket连接就绪');
                    break;

                case 'heartbeat':
                    this.missedHeartbeats = 0;
                    break;

                case 'data_change':
                case 'stats_data_changed':
                    // 数据变更通知 - 提示用户刷新
                    console.log('📢 数据已变更，建议刷新页面');
                    if (this.onDataChange) {
                        this.onDataChange(message.data);
                    }
                    break;

                case 'stats_query_response':
                    // 统计查询响应
                    this.handleStatsQueryResponse(message);
                    break;

                default:
                    console.warn('⚠️ 未知消息类型:', message.type);
            }
        } catch (error) {
            console.error('❌ 处理消息失败:', error);
        }
    }

    // 连接关闭
    handleClose(event) {
        console.log(`🔌 WebSocket关闭 (code: ${event.code})`);
        this.isConnected = false;
        this.stopHeartbeat();

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
        console.error('❌ WebSocket错误:', error);
    }

    // 安排重连
    scheduleReconnect() {
        if (this.isReconnecting) return;

        this.isReconnecting = true;
        console.log(`🔄 ${this.reconnectInterval / 1000}秒后重连...`);

        this.reconnectTimer = setTimeout(() => {
            console.log('🔄 尝试重连...');
            this.connect();
        }, this.reconnectInterval);
    }

    // 启动心跳
    startHeartbeat() {
        this.stopHeartbeat();

        this.heartbeatInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.missedHeartbeats++;

                if (this.missedHeartbeats >= this.maxMissedHeartbeats) {
                    console.warn('⚠️ 心跳超时，重连');
                    this.ws.close();
                    return;
                }

                this.send({ type: 'heartbeat', timestamp: Date.now() });
            }
        }, 30000); // 30秒
    }

    // 停止心跳
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
            console.warn('⚠️ WebSocket未连接');
        }
    }

    // 断开连接
    disconnect() {
        console.log('🔌 断开WebSocket');
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

        if (this.onConnectionChange) {
            this.onConnectionChange(false);
        }
    }

    // ==================== 统计查询功能 ====================

    /**
     * 查询统计数据
     * @param {string} queryType - 查询类型 (plan_stats, satellite_trend, customer_trend, overview)
     * @param {object} options - 查询选项 {startDate, endDate, groupBy}
     * @returns {Promise} - 统计结果
     */
    async queryStats(queryType, options) {
        if (!this.isConnected) {
            throw new Error('WebSocket未连接');
        }

        const requestId = this.generateRequestId();

        return new Promise((resolve, reject) => {
            // 设置超时（30秒）
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new Error('统计查询超时'));
            }, 30000);

            // 注册请求
            this.pendingRequests.set(requestId, { resolve, reject, timeout });

            // 发送查询消息
            const message = {
                type: 'stats_query',
                requestId,
                data: {
                    queryType,
                    options
                }
            };

            console.log('📊 发送统计查询:', queryType, options);
            this.ws.send(JSON.stringify(message));
        });
    }

    /**
     * 处理统计查询响应
     */
    handleStatsQueryResponse(message) {
        const { requestId, data } = message;
        const pending = this.pendingRequests.get(requestId);

        if (pending) {
            clearTimeout(pending.timeout);
            this.pendingRequests.delete(requestId);

            if (data.success) {
                console.log(`✅ 统计查询成功: ${data.queryType}`);
                pending.resolve(data.result);
            } else {
                console.error(`❌ 统计查询失败: ${data.error}`);
                pending.reject(new Error(data.error || '统计查询失败'));
            }
        }
    }

    /**
     * 生成请求ID
     */
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

// 全局实例
window.wsManager = new WebSocketManager();
