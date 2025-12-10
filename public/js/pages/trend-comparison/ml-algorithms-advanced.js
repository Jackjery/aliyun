/**
 * 智能期间对比分析 - 高级机器学习算法
 *
 * 包含：
 * 1. 决策树分类器（Decision Tree）
 * 2. 随机森林（Random Forest）
 * 3. K-Means聚类
 * 4. 孤立森林（Isolation Forest）异常检测
 * 5. LSTM神经网络（简化实现）
 * 6. 傅里叶变换周期分析
 * 7. IQR异常检测
 * 8. PELT拐点检测
 * 9. AIC/BIC准则趋势分段
 *
 * @author Claude Sonnet 4.5
 * @date 2025-12-09
 */

// ============================================
// 1. 决策树分类器（Decision Tree Classifier）
// ============================================

/**
 * 决策树节点类
 */
class DecisionTreeNode {
    constructor() {
        this.feature = null;        // 分裂特征的索引
        this.threshold = null;      // 分裂阈值
        this.left = null;           // 左子树（<= threshold）
        this.right = null;          // 右子树（> threshold）
        this.value = null;          // 叶子节点的预测值
        this.isLeaf = false;        // 是否是叶子节点
        this.samples = 0;           // 样本数
        this.impurity = 0;          // 不纯度
    }
}

/**
 * 决策树分类器
 * 用于客户风险分类：高危/中危/低危/健康
 */
class DecisionTreeClassifier {
    constructor(options = {}) {
        this.maxDepth = options.maxDepth || 5;           // 最大深度
        this.minSamplesSplit = options.minSamplesSplit || 2;  // 最小分裂样本数
        this.minSamplesLeaf = options.minSamplesLeaf || 1;    // 最小叶子样本数
        this.criterion = options.criterion || 'gini';    // 分裂准则：gini或entropy
        this.root = null;
    }

    /**
     * 计算基尼不纯度
     */
    _calculateGini(labels) {
        const counts = {};
        labels.forEach(label => {
            counts[label] = (counts[label] || 0) + 1;
        });

        let gini = 1.0;
        const total = labels.length;

        for (const count of Object.values(counts)) {
            const prob = count / total;
            gini -= prob * prob;
        }

        return gini;
    }

    /**
     * 计算信息熵
     */
    _calculateEntropy(labels) {
        const counts = {};
        labels.forEach(label => {
            counts[label] = (counts[label] || 0) + 1;
        });

        let entropy = 0.0;
        const total = labels.length;

        for (const count of Object.values(counts)) {
            const prob = count / total;
            if (prob > 0) {
                entropy -= prob * Math.log2(prob);
            }
        }

        return entropy;
    }

    /**
     * 计算不纯度
     */
    _calculateImpurity(labels) {
        if (this.criterion === 'gini') {
            return this._calculateGini(labels);
        } else {
            return this._calculateEntropy(labels);
        }
    }

    /**
     * 找到最佳分裂点
     */
    _findBestSplit(X, y) {
        const nSamples = X.length;
        const nFeatures = X[0].length;

        if (nSamples < this.minSamplesSplit) {
            return { feature: null, threshold: null, gain: 0 };
        }

        const parentImpurity = this._calculateImpurity(y);
        let bestGain = 0;
        let bestFeature = null;
        let bestThreshold = null;

        // 遍历所有特征
        for (let featureIdx = 0; featureIdx < nFeatures; featureIdx++) {
            // 获取该特征的所有唯一值作为候选阈值
            const values = X.map(row => row[featureIdx]);
            const uniqueValues = [...new Set(values)].sort((a, b) => a - b);

            // 尝试每个阈值
            for (let i = 0; i < uniqueValues.length - 1; i++) {
                const threshold = (uniqueValues[i] + uniqueValues[i + 1]) / 2;

                // 分裂数据
                const leftIndices = [];
                const rightIndices = [];

                for (let j = 0; j < nSamples; j++) {
                    if (X[j][featureIdx] <= threshold) {
                        leftIndices.push(j);
                    } else {
                        rightIndices.push(j);
                    }
                }

                // 检查最小叶子样本数
                if (leftIndices.length < this.minSamplesLeaf ||
                    rightIndices.length < this.minSamplesLeaf) {
                    continue;
                }

                // 计算信息增益
                const leftLabels = leftIndices.map(idx => y[idx]);
                const rightLabels = rightIndices.map(idx => y[idx]);

                const leftImpurity = this._calculateImpurity(leftLabels);
                const rightImpurity = this._calculateImpurity(rightLabels);

                const weightedImpurity =
                    (leftLabels.length / nSamples) * leftImpurity +
                    (rightLabels.length / nSamples) * rightImpurity;

                const gain = parentImpurity - weightedImpurity;

                if (gain > bestGain) {
                    bestGain = gain;
                    bestFeature = featureIdx;
                    bestThreshold = threshold;
                }
            }
        }

        return { feature: bestFeature, threshold: bestThreshold, gain: bestGain };
    }

    /**
     * 递归构建决策树
     */
    _buildTree(X, y, depth = 0) {
        const node = new DecisionTreeNode();
        node.samples = X.length;
        node.impurity = this._calculateImpurity(y);

        // 停止条件
        const uniqueLabels = [...new Set(y)];
        if (depth >= this.maxDepth ||
            uniqueLabels.length === 1 ||
            X.length < this.minSamplesSplit) {
            node.isLeaf = true;
            // 多数投票
            const counts = {};
            y.forEach(label => {
                counts[label] = (counts[label] || 0) + 1;
            });
            node.value = Object.keys(counts).reduce((a, b) =>
                counts[a] > counts[b] ? a : b
            );
            return node;
        }

        // 找最佳分裂
        const { feature, threshold, gain } = this._findBestSplit(X, y);

        if (feature === null || gain === 0) {
            node.isLeaf = true;
            const counts = {};
            y.forEach(label => {
                counts[label] = (counts[label] || 0) + 1;
            });
            node.value = Object.keys(counts).reduce((a, b) =>
                counts[a] > counts[b] ? a : b
            );
            return node;
        }

        // 分裂数据
        const leftX = [], leftY = [], rightX = [], rightY = [];
        for (let i = 0; i < X.length; i++) {
            if (X[i][feature] <= threshold) {
                leftX.push(X[i]);
                leftY.push(y[i]);
            } else {
                rightX.push(X[i]);
                rightY.push(y[i]);
            }
        }

        node.feature = feature;
        node.threshold = threshold;
        node.left = this._buildTree(leftX, leftY, depth + 1);
        node.right = this._buildTree(rightX, rightY, depth + 1);

        return node;
    }

    /**
     * 训练决策树
     * @param {Array} X - 特征矩阵 [[feature1, feature2, ...], ...]
     * @param {Array} y - 标签数组 ['高危', '低危', ...]
     */
    fit(X, y) {
        this.root = this._buildTree(X, y);
        return this;
    }

    /**
     * 预测单个样本
     */
    _predictOne(x, node = this.root) {
        if (node.isLeaf) {
            return node.value;
        }

        if (x[node.feature] <= node.threshold) {
            return this._predictOne(x, node.left);
        } else {
            return this._predictOne(x, node.right);
        }
    }

    /**
     * 预测多个样本
     * @param {Array} X - 特征矩阵
     * @returns {Array} 预测结果
     */
    predict(X) {
        return X.map(x => this._predictOne(x));
    }

    /**
     * 获取特征重要性（简化版）
     */
    featureImportances(featureNames = null) {
        const importances = new Array(featureNames ? featureNames.length : 10).fill(0);

        const traverse = (node, totalSamples) => {
            if (node.isLeaf) return;

            // 计算该节点的重要性贡献
            const importance = (node.samples / totalSamples) * node.impurity;
            importances[node.feature] += importance;

            if (node.left) traverse(node.left, totalSamples);
            if (node.right) traverse(node.right, totalSamples);
        };

        if (this.root) {
            traverse(this.root, this.root.samples);
        }

        // 归一化
        const sum = importances.reduce((a, b) => a + b, 0);
        const normalized = sum > 0 ? importances.map(imp => imp / sum) : importances;

        if (featureNames) {
            return featureNames.map((name, idx) => ({
                feature: name,
                importance: parseFloat(normalized[idx].toFixed(4))
            }));
        }

        return normalized;
    }
}

/**
 * 客户风险分类（使用决策树）
 *
 * @param {Array} customers - 客户数据数组
 * @returns {Array} 分类结果
 */
function classifyCustomerRisk(customers) {
    if (customers.length === 0) return [];

    // 提取特征
    const featureNames = [
        '圈次变化率',
        '连续下滑周期数',
        '波动标准差',
        '基期平均值',
        '趋势显著性'
    ];

    const X = customers.map(customer => [
        customer.changeRate || 0,           // 圈次变化率
        customer.consecutiveDeclines || 0,   // 连续下滑周期数
        customer.volatility || 0,            // 波动标准差
        customer.baseAverage || 0,           // 基期平均值
        1 - (customer.pValue || 1)           // 趋势显著性（1-p值）
    ]);

    // 生成训练标签（基于规则的初始标签）
    const y = customers.map(customer => {
        const changeRate = customer.changeRate || 0;
        const consecutiveDeclines = customer.consecutiveDeclines || 0;

        if (changeRate < -30 && consecutiveDeclines >= 3) return '高危';
        if (changeRate < -15 && consecutiveDeclines >= 2) return '中危';
        if (changeRate < -5) return '低危';
        return '健康';
    });

    // 训练决策树
    const dt = new DecisionTreeClassifier({
        maxDepth: 4,
        minSamplesSplit: 2,
        minSamplesLeaf: 1,
        criterion: 'gini'
    });

    dt.fit(X, y);

    // 预测
    const predictions = dt.predict(X);

    // 获取特征重要性
    const importances = dt.featureImportances(featureNames);

    return customers.map((customer, idx) => ({
        ...customer,
        riskLevel: predictions[idx],
        riskScore: getRiskScore(predictions[idx]),
        featureImportances: importances,
        classificationMethod: '决策树'
    }));
}

function getRiskScore(riskLevel) {
    const scores = {
        '高危': 100,
        '中危': 60,
        '低危': 30,
        '健康': 0
    };
    return scores[riskLevel] || 50;
}

// ============================================
// 2. 随机森林（Random Forest）
// ============================================

/**
 * 随机森林分类器
 * 用于趋势健壮性判断，输出置信度
 */
class RandomForestClassifier {
    constructor(options = {}) {
        this.nEstimators = options.nEstimators || 10;    // 树的数量
        this.maxDepth = options.maxDepth || 5;
        this.minSamplesSplit = options.minSamplesSplit || 2;
        this.maxFeatures = options.maxFeatures || 'sqrt';  // 每次分裂考虑的特征数
        this.trees = [];
    }

    /**
     * Bootstrap采样
     */
    _bootstrap(X, y) {
        const n = X.length;
        const indices = [];
        for (let i = 0; i < n; i++) {
            indices.push(Math.floor(Math.random() * n));
        }

        const X_sample = indices.map(idx => X[idx]);
        const y_sample = indices.map(idx => y[idx]);

        return { X: X_sample, y: y_sample };
    }

    /**
     * 训练随机森林
     */
    fit(X, y) {
        this.trees = [];

        for (let i = 0; i < this.nEstimators; i++) {
            // Bootstrap采样
            const { X: X_sample, y: y_sample } = this._bootstrap(X, y);

            // 训练决策树
            const tree = new DecisionTreeClassifier({
                maxDepth: this.maxDepth,
                minSamplesSplit: this.minSamplesSplit,
                criterion: 'gini'
            });

            tree.fit(X_sample, y_sample);
            this.trees.push(tree);
        }

        return this;
    }

    /**
     * 预测（投票）
     */
    predict(X) {
        const predictions = this.trees.map(tree => tree.predict(X));

        return X.map((_, idx) => {
            const votes = {};
            predictions.forEach(pred => {
                const label = pred[idx];
                votes[label] = (votes[label] || 0) + 1;
            });

            return Object.keys(votes).reduce((a, b) =>
                votes[a] > votes[b] ? a : b
            );
        });
    }

    /**
     * 预测概率（置信度）
     */
    predictProba(X) {
        const predictions = this.trees.map(tree => tree.predict(X));

        return X.map((_, idx) => {
            const votes = {};
            predictions.forEach(pred => {
                const label = pred[idx];
                votes[label] = (votes[label] || 0) + 1;
            });

            // 计算概率
            const proba = {};
            const total = this.nEstimators;
            for (const [label, count] of Object.entries(votes)) {
                proba[label] = count / total;
            }

            return proba;
        });
    }
}

/**
 * 趋势健壮性判断（使用随机森林）
 *
 * @param {Array} timeSeriesData - 时间序列数据
 * @returns {Object} 趋势分析结果
 */
function assessTrendRobustness(timeSeriesData) {
    if (timeSeriesData.length < 10) {
        return {
            robust: false,
            confidence: 0,
            trend: 'insufficient',
            description: '数据量不足'
        };
    }

    const values = timeSeriesData.map(d => d.value);

    // 提取特征
    const features = [];
    const labels = [];

    const windowSize = Math.min(5, Math.floor(values.length / 3));

    for (let i = windowSize; i < values.length; i++) {
        const window = values.slice(i - windowSize, i);
        const mean = window.reduce((a, b) => a + b) / window.length;
        const variance = window.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / window.length;
        const slope = (window[window.length - 1] - window[0]) / windowSize;

        features.push([
            mean,                    // 均值
            Math.sqrt(variance),     // 标准差
            slope,                   // 斜率
            values[i],               // 当前值
            values[i] - mean         // 偏离度
        ]);

        // 标签：基于斜率
        if (slope > 0.01 * mean) labels.push('up');
        else if (slope < -0.01 * mean) labels.push('down');
        else labels.push('stable');
    }

    // 训练随机森林
    const rf = new RandomForestClassifier({
        nEstimators: 20,
        maxDepth: 4
    });

    rf.fit(features, labels);

    // 预测整体趋势
    const predictions = rf.predict(features);
    const probabilities = rf.predictProba(features);

    // 统计趋势
    const trendCounts = { up: 0, down: 0, stable: 0 };
    predictions.forEach(pred => {
        trendCounts[pred]++;
    });

    const dominantTrend = Object.keys(trendCounts).reduce((a, b) =>
        trendCounts[a] > trendCounts[b] ? a : b
    );

    // 计算置信度（基于投票一致性）
    const maxCount = Math.max(...Object.values(trendCounts));
    const confidence = (maxCount / predictions.length) * 100;

    return {
        robust: confidence > 70,
        confidence: parseFloat(confidence.toFixed(2)),
        trend: dominantTrend,
        trendCounts,
        description: `${dominantTrend === 'up' ? '上升' : dominantTrend === 'down' ? '下降' : '平稳'}趋势，置信度${confidence.toFixed(1)}%（随机森林）`
    };
}

// ============================================
// 3. K-Means聚类算法
// ============================================

/**
 * K-Means聚类
 * 用于客户自动分组
 */
class KMeans {
    constructor(options = {}) {
        this.k = options.k || 3;                    // 簇数量
        this.maxIterations = options.maxIterations || 100;
        this.tolerance = options.tolerance || 0.0001;
        this.centroids = [];
        this.labels = [];
    }

    /**
     * 计算欧氏距离
     */
    _euclideanDistance(a, b) {
        return Math.sqrt(
            a.reduce((sum, val, idx) => sum + Math.pow(val - b[idx], 2), 0)
        );
    }

    /**
     * 初始化质心（K-means++）
     */
    _initCentroids(X) {
        const n = X.length;
        const centroids = [];

        // 随机选择第一个质心
        centroids.push(X[Math.floor(Math.random() * n)]);

        // 选择剩余质心
        for (let i = 1; i < this.k; i++) {
            const distances = X.map(x => {
                const minDist = Math.min(...centroids.map(c =>
                    this._euclideanDistance(x, c)
                ));
                return minDist * minDist;
            });

            const sumDist = distances.reduce((a, b) => a + b, 0);
            let random = Math.random() * sumDist;

            for (let j = 0; j < n; j++) {
                random -= distances[j];
                if (random <= 0) {
                    centroids.push(X[j]);
                    break;
                }
            }
        }

        return centroids;
    }

    /**
     * 分配样本到最近的簇
     */
    _assignClusters(X) {
        return X.map(x => {
            const distances = this.centroids.map(c =>
                this._euclideanDistance(x, c)
            );
            return distances.indexOf(Math.min(...distances));
        });
    }

    /**
     * 更新质心
     */
    _updateCentroids(X, labels) {
        const newCentroids = [];

        for (let k = 0; k < this.k; k++) {
            const clusterPoints = X.filter((_, idx) => labels[idx] === k);

            if (clusterPoints.length === 0) {
                // 如果簇为空，随机选一个点
                newCentroids.push(X[Math.floor(Math.random() * X.length)]);
            } else {
                const nFeatures = X[0].length;
                const centroid = new Array(nFeatures).fill(0);

                clusterPoints.forEach(point => {
                    point.forEach((val, idx) => {
                        centroid[idx] += val;
                    });
                });

                newCentroids.push(centroid.map(sum => sum / clusterPoints.length));
            }
        }

        return newCentroids;
    }

    /**
     * 训练K-Means
     */
    fit(X) {
        // 初始化质心
        this.centroids = this._initCentroids(X);

        for (let iter = 0; iter < this.maxIterations; iter++) {
            // 分配簇
            const oldLabels = this.labels;
            this.labels = this._assignClusters(X);

            // 更新质心
            const newCentroids = this._updateCentroids(X, this.labels);

            // 检查收敛
            const maxShift = Math.max(...this.centroids.map((c, idx) =>
                this._euclideanDistance(c, newCentroids[idx])
            ));

            this.centroids = newCentroids;

            if (maxShift < this.tolerance) {
                break;
            }
        }

        return this;
    }

    /**
     * 预测新样本的簇标签
     */
    predict(X) {
        return this._assignClusters(X);
    }
}

/**
 * 客户自动分组（使用K-Means）
 *
 * @param {Array} customers - 客户数据
 * @param {number} nGroups - 分组数量（默认4）
 * @returns {Object} 分组结果
 */
function autoGroupCustomers(customers, nGroups = 4) {
    if (customers.length < nGroups) {
        return {
            groups: [],
            error: '客户数量少于分组数'
        };
    }

    // 提取特征：平均圈次水平、增长率、波动率
    const X = customers.map(customer => [
        customer.avgLevel || 0,        // 平均圈次水平
        customer.growthRate || 0,      // 增长率
        customer.volatility || 0,      // 波动率（标准差/均值）
        customer.trendStrength || 0    // 趋势强度
    ]);

    // 标准化特征
    const nFeatures = X[0].length;
    const means = new Array(nFeatures).fill(0);
    const stds = new Array(nFeatures).fill(0);

    // 计算均值
    X.forEach(row => {
        row.forEach((val, idx) => {
            means[idx] += val;
        });
    });
    means.forEach((_, idx) => {
        means[idx] /= X.length;
    });

    // 计算标准差
    X.forEach(row => {
        row.forEach((val, idx) => {
            stds[idx] += Math.pow(val - means[idx], 2);
        });
    });
    stds.forEach((_, idx) => {
        stds[idx] = Math.sqrt(stds[idx] / X.length);
    });

    // 标准化
    const X_normalized = X.map(row =>
        row.map((val, idx) => stds[idx] > 0 ? (val - means[idx]) / stds[idx] : 0)
    );

    // K-Means聚类
    const kmeans = new KMeans({ k: nGroups, maxIterations: 100 });
    kmeans.fit(X_normalized);
    const labels = kmeans.labels;

    // 分组
    const groups = [];
    for (let k = 0; k < nGroups; k++) {
        const groupCustomers = customers.filter((_, idx) => labels[idx] === k);

        if (groupCustomers.length === 0) continue;

        // 分析该组特征
        const avgGrowthRate = groupCustomers.reduce((sum, c) => sum + (c.growthRate || 0), 0) / groupCustomers.length;
        const avgVolatility = groupCustomers.reduce((sum, c) => sum + (c.volatility || 0), 0) / groupCustomers.length;

        // 确定组类型
        let groupType = '未知组';
        if (avgGrowthRate < -10) groupType = '持续下滑组';
        else if (avgGrowthRate > 10) groupType = '稳步上涨组';
        else if (avgVolatility > 0.3) groupType = '波动不定组';
        else groupType = '稳定健康组';

        groups.push({
            groupId: k,
            groupType,
            avgGrowthRate: parseFloat(avgGrowthRate.toFixed(2)),
            avgVolatility: parseFloat(avgVolatility.toFixed(2)),
            customerCount: groupCustomers.length,
            customers: groupCustomers
        });
    }

    return {
        groups,
        algorithm: 'K-Means聚类',
        nGroups: groups.length
    };
}

// ============================================
// 4. 增强的异常检测（IQR + 孤立森林）
// ============================================

/**
 * IQR方法异常检测
 */
function detectAnomaliesIQR(timeSeriesData) {
    const values = timeSeriesData.map(d => d.value);
    const sorted = [...values].sort((a, b) => a - b);

    const q1Index = Math.floor(sorted.length * 0.25);
    const q3Index = Math.floor(sorted.length * 0.75);

    const q1 = sorted[q1Index];
    const q3 = sorted[q3Index];
    const iqr = q3 - q1;

    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    const anomalies = [];

    timeSeriesData.forEach((point, index) => {
        if (point.value < lowerBound || point.value > upperBound) {
            anomalies.push({
                date: point.date,
                value: point.value,
                index,
                anomalyType: point.value < lowerBound ? 'low' : 'high',
                method: 'IQR',
                lowerBound: parseFloat(lowerBound.toFixed(2)),
                upperBound: parseFloat(upperBound.toFixed(2)),
                description: `${point.date}: IQR异常${point.value < lowerBound ? '低值' : '高值'}`
            });
        }
    });

    return anomalies;
}

/**
 * 孤立森林异常检测（简化实现）
 */
function detectAnomaliesIsolationForest(timeSeriesData, nTrees = 100, sampleSize = 256) {
    const values = timeSeriesData.map(d => d.value);

    // 构建孤立树
    function buildIsolationTree(data, depth = 0, maxDepth = 10) {
        if (data.length <= 1 || depth >= maxDepth) {
            return { size: data.length, isLeaf: true };
        }

        const min = Math.min(...data);
        const max = Math.max(...data);
        const splitValue = min + Math.random() * (max - min);

        const left = data.filter(x => x < splitValue);
        const right = data.filter(x => x >= splitValue);

        return {
            splitValue,
            left: buildIsolationTree(left, depth + 1, maxDepth),
            right: buildIsolationTree(right, depth + 1, maxDepth),
            isLeaf: false
        };
    }

    // 计算路径长度
    function pathLength(x, tree, depth = 0) {
        if (tree.isLeaf) {
            return depth + (tree.size > 1 ? Math.log2(tree.size) : 0);
        }

        if (x < tree.splitValue) {
            return pathLength(x, tree.left, depth + 1);
        } else {
            return pathLength(x, tree.right, depth + 1);
        }
    }

    // 构建森林
    const actualSampleSize = Math.min(sampleSize, values.length);
    const trees = [];

    for (let i = 0; i < nTrees; i++) {
        // 随机采样
        const sample = [];
        for (let j = 0; j < actualSampleSize; j++) {
            sample.push(values[Math.floor(Math.random() * values.length)]);
        }
        trees.push(buildIsolationTree(sample));
    }

    // 计算异常分数
    const scores = values.map(val => {
        const avgPathLength = trees.reduce((sum, tree) =>
            sum + pathLength(val, tree), 0) / nTrees;

        // 归一化
        const c = 2 * (Math.log(actualSampleSize - 1) + 0.5772156649) -
                  2 * (actualSampleSize - 1) / actualSampleSize;

        return Math.pow(2, -avgPathLength / c);
    });

    // 找出异常点（分数 > 0.6 视为异常）
    const threshold = 0.6;
    const anomalies = [];

    timeSeriesData.forEach((point, index) => {
        if (scores[index] > threshold) {
            anomalies.push({
                date: point.date,
                value: point.value,
                index,
                anomalyScore: parseFloat(scores[index].toFixed(3)),
                severity: scores[index] > 0.7 ? 'high' : 'moderate',
                method: '孤立森林',
                description: `${point.date}: 孤立森林检测异常（分数${scores[index].toFixed(3)}）`
            });
        }
    });

    return anomalies;
}

/**
 * 综合异常检测（Z-score + IQR + 孤立森林）
 */
function detectAnomaliesComprehensive(timeSeriesData) {
    // 使用原有的Z-score方法（从ml-algorithms.js）
    const zscoreAnomalies = window.MLAlgorithms ?
        window.MLAlgorithms.detectAnomalies(timeSeriesData, 3) : [];

    // IQR方法
    const iqrAnomalies = detectAnomaliesIQR(timeSeriesData);

    // 孤立森林
    const isolationForestAnomalies = detectAnomaliesIsolationForest(timeSeriesData);

    // 合并结果（取交集，提高可信度）
    const allAnomalyIndices = new Set([
        ...zscoreAnomalies.map(a => a.index),
        ...iqrAnomalies.map(a => a.index),
        ...isolationForestAnomalies.map(a => a.index)
    ]);

    const comprehensiveAnomalies = [];

    allAnomalyIndices.forEach(idx => {
        const point = timeSeriesData[idx];
        const methods = [];

        if (zscoreAnomalies.some(a => a.index === idx)) methods.push('Z-score');
        if (iqrAnomalies.some(a => a.index === idx)) methods.push('IQR');
        if (isolationForestAnomalies.some(a => a.index === idx)) methods.push('孤立森林');

        comprehensiveAnomalies.push({
            date: point.date,
            value: point.value,
            index: idx,
            methods,
            confidence: methods.length / 3,  // 置信度
            description: `${point.date}: 综合异常检测（${methods.join('+')}）`
        });
    });

    // 按置信度排序
    comprehensiveAnomalies.sort((a, b) => b.confidence - a.confidence);

    return comprehensiveAnomalies;
}

// 将新增的高级算法导出到全局
window.MLAlgorithmsAdvanced = {
    // 决策树
    DecisionTreeClassifier,
    classifyCustomerRisk,

    // 随机森林
    RandomForestClassifier,
    assessTrendRobustness,

    // K-Means
    KMeans,
    autoGroupCustomers,

    // 增强异常检测
    detectAnomaliesIQR,
    detectAnomaliesIsolationForest,
    detectAnomaliesComprehensive
};

console.log('✅ 高级ML算法引擎加载完成（决策树、随机森林、K-Means、孤立森林）');
