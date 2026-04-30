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