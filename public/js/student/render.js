// 学生端渲染函数 
import { StudentState } from './state.js';

export const StudentRender = {
    headerInfo() {
        const s = StudentState.currentStudent;
        return {
            avatar: s ? s.name.slice(0,1) : 'S',
            name: s ? s.name : '加载中'
        };
    },
    
    // 首页成绩亮点表格
    scoreHighlightTable(scores) {
        if (!scores.length) return '<tr><td colspan="4">暂无数据</td></tr>';
        return scores.slice(0, 4).map(s => {
            const diff = (s.score - s.classAvg).toFixed(1);
            const diffClass = diff >= 0 ? 'compare-text' : 'compare-text down';
            const symbol = diff >= 0 ? `▲ +${diff}` : `▼ ${diff}`;
            return `<tr><td>${s.subject}</td><td>${s.score}</td><td>${s.classAvg}</td><td class="${diffClass}">${symbol}</td></tr>`;
        }).join('');
    },
    
    // 成绩模块表格
    fullScoreTable(scores) {
        return scores.map(s => {
            const diff = (s.score - s.classAvg).toFixed(1);
            const diffClass = diff >= 0 ? 'compare-text' : 'compare-text down';
            const symbol = diff >= 0 ? `+${diff}` : `${diff}`;
            return `
                <tr>
                    <td><strong>${s.subject}</strong></td>
                    <td>${s.score}</td>
                    <td>${s.classAvg}</td>
                    <td>${s.classRank}</td>
                    <td class="${diffClass}">${symbol}</td>
                </tr>
            `;
        }).join('');
    },
    
    // 通知列表
    noticeList(notices) {
        if (!notices.length) return '<div class="empty-tip">暂无通知</div>';
        return notices.map(n => `
            <div class="notice-item ${n.isRead ? '' : 'unread'}" data-id="${n.id}">
                <div class="notice-title">
                    ${escapeHtml(n.title)}
                    ${!n.isRead ? '<span class="notice-badge-sm">未读</span>' : '<span style="color:#999;">已读</span>'}
                </div>
                <div class="notice-content">${escapeHtml(n.content)}</div>
                <div class="notice-time">${formatDateTime(n.publishTime)} | 班主任：${escapeHtml(n.teacher_name)}</div>
            </div>
        `).join('');
    },

    // 首页骨架屏
    homeSkeleton() {
        return `
            <h3>学习概览</h3>
            <p><span class="skeleton" style="display:inline-block; width:180px; height:20px;"></span></p>
            <div class="summary-flex" style="display:flex; gap:16px; margin:20px 0;">
                ${Array(3).fill(0).map(() => `
                    <div class="summary-card" style="flex:1;">
                        <div class="skeleton" style="height:32px; width:60%; margin:0 auto 8px;"></div>
                        <div class="skeleton" style="height:16px; width:40%; margin:0 auto;"></div>
                    </div>
                `).join('')}
            </div>
            <h4>近期成绩亮点</h4>
            <div class="skeleton-table">
                <div class="skeleton-table-header">
                    <div class="skeleton" style="width:25%; height:24px;"></div>
                    <div class="skeleton" style="width:25%; height:24px;"></div>
                    <div class="skeleton" style="width:25%; height:24px;"></div>
                    <div class="skeleton" style="width:25%; height:24px;"></div>
                </div>
                ${Array(4).fill(0).map(() => `
                    <div class="skeleton-row">
                        <div class="skeleton skeleton-cell" style="width:25%;"></div>
                        <div class="skeleton skeleton-cell" style="width:25%;"></div>
                        <div class="skeleton skeleton-cell" style="width:25%;"></div>
                        <div class="skeleton skeleton-cell" style="width:25%;"></div>
                    </div>
                `).join('')}
            </div>
            <h4 style="margin-top:24px;">最新班级通知</h4>
            ${Array(3).fill(0).map(() => `
                <div class="skeleton" style="height:60px; margin-bottom:12px; border-radius:8px;"></div>
            `).join('')}
        `;
    },

    // 成绩页面骨架屏
    scoreSkeleton() {
        return `
            <div style="display:flex; justify-content:space-between;">
                <h3>我的成绩 · <span class="skeleton" style="display:inline-block; width:80px; height:24px;"></span></h3>
                <div class="filter-bar">
                    <div class="skeleton" style="width:120px; height:36px; border-radius:30px;"></div>
                    <div class="skeleton" style="width:100px; height:36px; border-radius:30px;"></div>
                </div>
            </div>
            <div class="skeleton-table">
                <div class="skeleton-table-header">
                    <div class="skeleton" style="width:20%; height:24px;"></div>
                    <div class="skeleton" style="width:20%; height:24px;"></div>
                    <div class="skeleton" style="width:20%; height:24px;"></div>
                    <div class="skeleton" style="width:20%; height:24px;"></div>
                    <div class="skeleton" style="width:20%; height:24px;"></div>
                </div>
                ${Array(5).fill(0).map(() => `
                    <div class="skeleton-row">
                        <div class="skeleton skeleton-cell" style="width:20%;"></div>
                        <div class="skeleton skeleton-cell" style="width:20%;"></div>
                        <div class="skeleton skeleton-cell" style="width:20%;"></div>
                        <div class="skeleton skeleton-cell" style="width:20%;"></div>
                        <div class="skeleton skeleton-cell" style="width:20%;"></div>
                    </div>
                `).join('')}
            </div>
            <h4 style="margin-top:24px;">班级统计数据 · <span class="skeleton" style="display:inline-block; width:60px; height:20px;"></span></h4>
            <div class="stats-grid">
                ${Array(5).fill(0).map(() => `
                    <div class="stat-card">
                        <div class="skeleton" style="height:32px; width:60%; margin:0 auto 8px;"></div>
                        <div class="skeleton" style="height:16px; width:40%; margin:0 auto;"></div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    // 通知页面骨架屏
    noticeSkeleton() {
        return `
            <div style="display:flex; justify-content:space-between;">
                <h3>班级通知</h3>
                <div>
                    <div class="skeleton" style="display:inline-block; width:60px; height:32px; border-radius:16px; margin-right:8px;"></div>
                    <div class="skeleton" style="display:inline-block; width:60px; height:32px; border-radius:16px;"></div>
                </div>
            </div>
            ${Array(4).fill(0).map(() => `
                <div class="notice-item" style="padding:16px; margin-bottom:12px;">
                    <div class="skeleton" style="width:70%; height:24px;"></div>
                    <div class="skeleton" style="width:100%; height:40px; margin-top:12px;"></div>
                    <div class="skeleton" style="width:200px; height:16px; margin-top:8px;"></div>
                </div>
            `).join('')}
            <div style="display:flex; justify-content:center; gap:8px; margin-top:20px;">
                ${Array(3).fill(0).map(() => `<div class="skeleton" style="width:36px; height:36px; border-radius:50%;"></div>`).join('')}
            </div>
        `;
    },
    
    trendChart(container, data) {
        container.innerHTML = '';
        if (!data || !data.length) {
            container.innerHTML = '<div class="empty-tip" style="text-align:center;padding:20px;">暂无趋势数据</div>';
            return;
        }

        const canvas = document.createElement('canvas');
        canvas.style.display = 'block';
        canvas.style.width = '100%';
        canvas.style.height = '200px';
        container.appendChild(canvas);

        const dpr = window.devicePixelRatio || 1;
        const rect = container.getBoundingClientRect();
        const width = rect.width;
        const height = 200;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);

        const maxFullMark = Math.max(...data.map(d => d.full_mark), 100);
        // 右侧留出更多空间（30→40）以容纳日期标签
        const padding = { top: 20, right: 40, bottom: 50, left: 40 };
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

        // X 轴日期标签（带边界约束）
        const stepX = data.length > 1 ? chartW / (data.length - 1) : chartW / 2;
        const labelInterval = Math.ceil(data.length / 6);
        // 允许的最大 X 坐标（防止文字超出）
        const maxLabelX = width - padding.right - 10;

        data.forEach((d, i) => {
            if (i % labelInterval !== 0 && i !== data.length - 1) return;
            let x = padding.left + (data.length > 1 ? stepX * i : chartW / 2);
            x = Math.min(x, maxLabelX);       // 不让标签越界

            const dateStr = d.exam_date;
            ctx.save();
            ctx.translate(x, height - padding.bottom + 10);
            ctx.fillStyle = '#666';
            if (width < 500) {
                ctx.rotate(-Math.PI / 4);
                ctx.font = '9px sans-serif';
                ctx.textAlign = 'right';       // 倾斜时用右对齐更安全
                ctx.fillText(dateStr, 0, 0);
            } else {
                ctx.font = '10px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(dateStr, 0, 0);
            }
            ctx.restore();
        });

        // 绘制班级平均分
        const avgPoints = data.filter(d => d.class_avg != null);
        if (avgPoints.length > 0) {
            // 绘制红色虚线
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

            // 为每个平均分数据点绘制圆点（半径4，红色）和分数标注（下方16px处）
            avgPoints.forEach(d => {
                const idx = data.indexOf(d);
                const x = padding.left + (data.length > 1 ? stepX * idx : chartW / 2);
                const y = height - padding.bottom - (d.class_avg / maxFullMark) * chartH;

                // 圆节点
                ctx.fillStyle = '#e63946';
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, 2 * Math.PI);
                ctx.fill();

                // 分数标注（下方）
                ctx.fillStyle = '#e63946';
                ctx.font = '11px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(d.class_avg, x, y + 16);
            });

            // 保留最后一个点的“平均”标签（位置稍下移避免与分数重叠）
            const last = avgPoints[avgPoints.length - 1];
            const lastIdx = data.indexOf(last);
            const lx = padding.left + (data.length > 1 ? stepX * lastIdx : chartW / 2);
            const ly = height - padding.bottom - (last.class_avg / maxFullMark) * chartH;
            ctx.fillStyle = '#e63946';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText('平均', lx + 6, ly + 28); // 再下移一点
        }

        // 折线与描点（无变化）
        if (data.length === 1) {
            const x = padding.left + chartW / 2;
            const y = height - padding.bottom - (data[0].score / maxFullMark) * chartH;
            ctx.fillStyle = '#4096ff';
            ctx.beginPath(); ctx.arc(x, y, 5, 0, 2 * Math.PI); ctx.fill();
            ctx.fillStyle = '#333'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText(data[0].score, x, y - 12);
        } else {
            ctx.beginPath();
            ctx.strokeStyle = '#4096ff'; ctx.lineWidth = 2;
            data.forEach((d, i) => {
                const x = padding.left + stepX * i;
                const y = height - padding.bottom - (d.score / maxFullMark) * chartH;
                i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            });
            ctx.stroke();

            data.forEach((d, i) => {
                const x = padding.left + stepX * i;
                const y = height - padding.bottom - (d.score / maxFullMark) * chartH;
                ctx.fillStyle = '#4096ff';
                ctx.beginPath(); ctx.arc(x, y, 4, 0, 2 * Math.PI); ctx.fill();
                ctx.fillStyle = '#333'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
                ctx.fillText(d.score, x, y - 12);
            });
        }

        ctx.fillStyle = '#888'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('个人分数趋势（满分:' + maxFullMark + '）', width / 2, height - 10);
    },
};