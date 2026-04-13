// ================== 学生端渲染函数 ==================
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
    }
};