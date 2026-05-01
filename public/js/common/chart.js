/**
 * 绘制成绩趋势折线图（公共组件）
 * @param {HTMLElement} container - 容器元素
 * @param {Array} data - [{ exam_date, score, full_mark, class_avg }]
 * @param {Object} [options] - 可选配置 { width, height, padding }
 */
export function drawTrendChart(container, data, options = {}) {
    container.innerHTML = '';
    if (!data || !data.length) {
        container.innerHTML = '<div class="empty-tip" style="text-align:center;padding:20px;">暂无趋势数据</div>';
        return;
    }

    const canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    const chartHeight = options.height || 200;
    canvas.style.height = chartHeight + 'px';
    container.appendChild(canvas);

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const width = rect.width;
    const height = chartHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const maxFullMark = Math.max(...data.map(d => d.full_mark), 100);
    const padding = options.padding || { top: 20, right: 40, bottom: 50, left: 40 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    // 坐标轴
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, height - padding.bottom);
    ctx.lineTo(width - padding.right, height - padding.bottom);
    ctx.stroke();

    // X轴日期标签
    const stepX = data.length > 1 ? chartW / (data.length - 1) : chartW / 2;
    const labelInterval = Math.ceil(data.length / 6);
    const maxLabelX = width - padding.right - 10;

    data.forEach((d, i) => {
        if (i % labelInterval !== 0 && i !== data.length - 1) return;
        let x = padding.left + (data.length > 1 ? stepX * i : chartW / 2);
        x = Math.min(x, maxLabelX);
        const dateStr = d.exam_date;
        ctx.save();
        ctx.translate(x, height - padding.bottom + 10);
        ctx.fillStyle = '#666';
        if (width < 500) {
            ctx.rotate(-Math.PI / 4);
            ctx.font = '9px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(dateStr, 0, 0);
        } else {
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(dateStr, 0, 0);
        }
        ctx.restore();
    });

    // 班级平均分虚线
    const avgPoints = data.filter(d => d.class_avg != null);
    if (avgPoints.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = '#e63946';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        avgPoints.forEach((d, i) => {
            const idx = data.indexOf(d);
            const x = padding.left + (data.length > 1 ? stepX * idx : chartW / 2);
            const y = height - padding.bottom - (d.class_avg / maxFullMark) * chartH;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.setLineDash([]);

        avgPoints.forEach(d => {
            const idx = data.indexOf(d);
            const x = padding.left + (data.length > 1 ? stepX * idx : chartW / 2);
            const y = height - padding.bottom - (d.class_avg / maxFullMark) * chartH;
            ctx.fillStyle = '#e63946';
            ctx.beginPath(); ctx.arc(x, y, 3, 0, 2 * Math.PI); ctx.fill();
            ctx.fillStyle = '#e63946'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText(d.class_avg, x, y + 14);
        });
    }

    // 个人成绩折线
    ctx.beginPath();
    ctx.strokeStyle = '#4096ff';
    ctx.lineWidth = 2;
    data.forEach((d, i) => {
        const x = padding.left + (data.length > 1 ? stepX * i : chartW / 2);
        const y = height - padding.bottom - ((d.score || 0) / maxFullMark) * chartH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    data.forEach((d, i) => {
        const x = padding.left + (data.length > 1 ? stepX * i : chartW / 2);
        const y = height - padding.bottom - ((d.score || 0) / maxFullMark) * chartH;
        ctx.fillStyle = '#4096ff';
        ctx.beginPath(); ctx.arc(x, y, 3, 0, 2 * Math.PI); ctx.fill();
        ctx.fillStyle = '#333'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(d.score || 0, x, y - 10);
    });

    // 底部提示
    ctx.fillStyle = '#888'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('蓝折线：个人成绩　红虚线：班级平均分　（满分:' + maxFullMark + '）', width / 2, height - 5);
}

/**
 * 绘制成绩分布直方图 + 正态分布拟合曲线（公共组件）
 * @param {HTMLElement} container - 容器元素
 * @param {number[]} scores - 分数数组，如 [85, 92, 78, ...]
 * @param {Object} [options] - 可选配置
 * @param {number} [options.height=220] - 图表高度
 * @param {number} [options.binSize=5] - 直方图分组步长
 * @param {number} [options.maxScore=100] - 满分
 * @param {string} [options.title=''] - 图表标题
 */
export function drawNormalDistributionChart(container, scores, options = {}) {
    container.innerHTML = '';
    if (!scores || scores.length < 3) {
        container.innerHTML = '<div class="empty-tip" style="text-align:center;padding:20px;">数据不足（至少3个成绩）</div>';
        return;
    }

    // 统计量
    const n = scores.length;
    const mean = scores.reduce((a, b) => a + b, 0) / n;
    const variance = scores.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
    const stdDev = Math.sqrt(variance);

    // 根据实际数据确定区间范围（从最低分到最高分）
    const rawMin = Math.min(...scores);
    const rawMax = Math.max(...scores);
    const binSize = options.binSize || 10;
    const maxScore = options.maxScore || Math.ceil(rawMax / binSize) * binSize;
    const rangeMin = Math.floor(rawMin / binSize) * binSize;
    const rangeMax = Math.max(Math.ceil(rawMax / binSize) * binSize, rangeMin + binSize);
    const chartHeight = options.height || 280;
    const padding = { top: 50, right: 30, bottom: 50, left: 44 };

    // 构建直方图分桶
    const binCount = Math.ceil((rangeMax - rangeMin) / binSize);
    const bins = new Array(binCount).fill(0);
    scores.forEach(s => {
        const idx = Math.min(Math.floor((s - rangeMin) / binSize), binCount - 1);
        bins[idx]++;
    });

    // 坐标映射
    const canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = chartHeight + 'px';
    container.appendChild(canvas);

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const width = rect.width || 600;
    const height = chartHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;
    const maxFreq = Math.max(...bins, 1);

    // 坐标轴
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, height - padding.bottom);
    ctx.lineTo(width - padding.right, height - padding.bottom);
    ctx.stroke();

    // X轴刻度（所有区间标签）
    ctx.fillStyle = '#000000';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    bins.forEach((_, i) => {
        if (binCount > 6 && i % 2 !== 0 && i !== binCount - 1) return;
        const x = padding.left + (i / binCount) * chartW;
        ctx.fillText(rangeMin + i * binSize, x, height - padding.bottom + 14);
    });
    // 最右端补区间上限标签
    const rightX = padding.left + chartW;
    ctx.fillText(rangeMax, rightX, height - padding.bottom + 14);

    // Y轴刻度（频数）
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const ySteps = Math.min(4, maxFreq);
    for (let i = 0; i <= ySteps; i++) {
        const val = Math.round((maxFreq / ySteps) * i);
        const y = height - padding.bottom - (val / maxFreq) * chartH;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();
        ctx.font = '12px sans-serif';
        ctx.fillStyle = '#000000';
        ctx.fillText(val, padding.left - 6, y);
    }
    ctx.textBaseline = 'alphabetic';
    // Y轴标签
    ctx.save();
    ctx.translate(12, padding.top + chartH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#000000';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('人数（人）', 0, 0);
    ctx.restore();

    // 绘制直方图柱子
    const barWidth = chartW / binCount * 0.85;
    bins.forEach((freq, i) => {
        const x = padding.left + (i / binCount) * chartW + (chartW / binCount - barWidth) / 2;
        const barH = (freq / maxFreq) * chartH;
        const y = height - padding.bottom - barH;
        // 低/高区间着色
        const binMid = rangeMin + i * binSize + binSize / 2;
        if (stdDev > 0.1 && binMid < mean - stdDev) {
            ctx.fillStyle = 'rgba(230, 57, 70, 0.25)';     // 低分区红色
        } else if (stdDev > 0.1 && binMid > mean + stdDev) {
            ctx.fillStyle = 'rgba(64, 150, 255, 0.45)';    // 高分区加深蓝
        } else {
            ctx.fillStyle = 'rgba(64, 150, 255, 0.25)';    // 普通区
        }
        ctx.fillRect(x, y, barWidth, barH);
        ctx.strokeStyle = 'rgba(64, 150, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, barWidth, barH);
        // 柱顶标频数（黑色粗体）
        if (freq > 0) {
            ctx.fillStyle = '#222';
            ctx.font = 'bold 13px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(freq, x + barWidth / 2, y - 4);
        }
    });

    // 标题
    if (options.title) {
        ctx.fillStyle = '#333';
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(options.title, width / 2, 20);
    }

    // 统计信息
    const infoY = height - 4;
    ctx.fillStyle = '#000000';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    const infoText = `人数：${n}  均值：${mean.toFixed(1)}  标准差：${stdDev.toFixed(1)}  中位数：${[...scores].sort((a,b)=>a-b)[Math.floor(n/2)]}`;
    ctx.fillText(infoText, width / 2, infoY);
}
