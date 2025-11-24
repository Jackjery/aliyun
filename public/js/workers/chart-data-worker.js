/**
 * Chart Data Worker
 * 在后台线程处理图表数据转换，避免阻塞主线程
 */

// 加载 trend-utils.js 中的工具函数
importScripts('../pages/trend/trend-utils.js');

// 监听主线程消息
self.addEventListener('message', (e) => {
    const { taskId, type, records, dimensionField, valueField, options } = e.data;

    try {
        console.log(`[Worker] 开始处理任务 ${taskId}，类型: ${type}，记录数: ${records.length}`);
        const startTime = performance.now();

        // 调用 trend-utils.js 中的数据转换函数
        const chartData = convertToChartData(records, dimensionField, valueField, options);

        // 格式化周期标签
        if (options.groupBy) {
            chartData.labels = chartData.labels.map(label =>
                formatPeriodLabel(label, options.groupBy)
            );
        }

        const endTime = performance.now();
        console.log(`[Worker] 任务 ${taskId} 处理完成，耗时: ${(endTime - startTime).toFixed(2)}ms，系列数: ${chartData.datasets.length}`);

        // 返回处理结果
        self.postMessage({
            taskId,
            type,
            success: true,
            data: chartData
        });

    } catch (error) {
        console.error(`[Worker] 任务 ${taskId} 处理失败`, error);

        // 返回错误
        self.postMessage({
            taskId,
            type,
            success: false,
            error: {
                message: error.message,
                stack: error.stack
            }
        });
    }
});

console.log('[Worker] Chart Data Worker 已启动并等待任务');
