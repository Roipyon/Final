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
    }
};