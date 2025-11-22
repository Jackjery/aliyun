// 配置文件 - API端点配置
// 支持不同环境的API地址切换

const CONFIG = {
    // 自有服务器 API 配置
    API_BASE_URL: 'https://ws.nxjyx.com.cn',  // 使用自己的WebSocket服务器

    // API 端点配置
    API_ENDPOINTS: {
        // 统计查询通过WebSocket实现（见websocket-manager.js）
        websocket: 'wss://ws.nxjyx.com.cn/ws',  // WebSocket连接
        health: 'https://ws.nxjyx.com.cn/health'  // 健康检查
    },
    
    // 请求配置
    REQUEST_TIMEOUT: 30000, // 30秒超时

    // 环境检测
    isDevelopment: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
};

// 根据环境自动配置（本地开发时使用）
if (CONFIG.isDevelopment) {
    CONFIG.API_BASE_URL = 'http://localhost:3000';
    CONFIG.API_ENDPOINTS.websocket = 'ws://localhost:3000/ws';
    CONFIG.API_ENDPOINTS.health = 'http://localhost:3000/health';
}

// 获取 WebSocket URL
function getWebSocketUrl() {
    return CONFIG.API_ENDPOINTS.websocket;
}

// 导出配置
window.CONFIG = CONFIG;
window.getWebSocketUrl = getWebSocketUrl;