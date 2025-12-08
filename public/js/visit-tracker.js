/**
 * 访问统计追踪器
 * 自动记录页面访问日志到服务器
 */
(function() {
    'use strict';

    // WebSocket服务器地址
    const API_BASE_URL = 'https://ws.nxjyx.com.cn';

    /**
     * 发送访问日志到服务器
     */
    function sendVisitLog() {
        try {
            // 收集访问信息
            const visitData = {
                page_url: window.location.href,
                page_title: document.title,
                referer: document.referrer || ''
            };

            const apiUrl = `${API_BASE_URL}/api/visit-log`;

            // 使用 fetch 发送请求（更好的错误处理和跨域支持）
            fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(visitData),
                mode: 'cors', // 显式启用CORS
                credentials: 'omit' // 不发送凭证
            })
            .then(response => {
                if (response.ok) {
                    console.log('✅ 访问日志已发送:', visitData);
                    return response.json();
                } else {
                    console.warn('⚠️ 访问日志发送失败，状态码:', response.status);
                    return response.text().then(text => {
                        console.warn('   服务器响应:', text);
                    });
                }
            })
            .then(data => {
                if (data) {
                    console.log('   服务器返回:', data);
                }
            })
            .catch(err => {
                console.warn('❌ 访问日志发送失败:', err.message);
                console.warn('   API地址:', apiUrl);
            });

        } catch (error) {
            console.warn('❌ 访问日志记录失败:', error);
        }
    }

    /**
     * 初始化访问统计
     */
    function initVisitTracker() {
        // 页面加载完成后发送访问日志
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', sendVisitLog);
        } else {
            // DOM已加载完成，立即发送
            sendVisitLog();
        }

        // 页面可见性变化时（从隐藏到可见）也记录一次
        let wasHidden = document.hidden;
        document.addEventListener('visibilitychange', function() {
            if (wasHidden && !document.hidden) {
                sendVisitLog();
            }
            wasHidden = document.hidden;
        });
    }

    // 启动访问统计
    initVisitTracker();

    // 暴露全局方法供手动调用
    window.VisitTracker = {
        send: sendVisitLog
    };

})();
