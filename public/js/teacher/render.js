// ================== 教师端渲染函数 ==================
import { TeacherState } from './state.js';

export const TeacherRender = {
    headerInfo() {
        const t = TeacherState.currentTeacher;
        return {
            avatar: t ? t.name.slice(0,1) : 'T',
            name: t ? `${t.name} (老师)` : '加载中'
        };
    },
    
    // 成绩页面统计卡片
    statsCards(stats, isTotal) {
        if (isTotal) {
            return `
                <div class="stats-grid">
                    <div class="stat-card"><div class="stat-value">${stats.avg}</div><div>平均分</div></div>
                    <div class="stat-card"><div class="stat-value">${stats.max}</div><div>最高分</div></div>
                    <div class="stat-card"><div class="stat-value">${stats.min}</div><div>最低分</div></div>
                </div>
            `;
        } else {
            return `
                <div class="stats-grid">
                    <div class="stat-card"><div class="stat-value">${stats.avg}</div><div>平均分</div></div>
                    <div class="stat-card"><div class="stat-value">${stats.max}</div><div>最高分</div></div>
                    <div class="stat-card"><div class="stat-value">${stats.min}</div><div>最低分</div></div>
                    <div class="stat-card"><div class="stat-value">${stats.passCount}/${stats.totalStu}</div><div>及格人数</div></div>
                    <div class="stat-card"><div class="stat-value">${stats.passRate}</div><div>及格率</div></div>
                </div>
            `;
        }
    },
    
    // 成绩表格
    scoreTable(data, isTotal) {
        if (!data.length) return '<table class="table"><tr><td colspan="5">暂无数据</td></tr></table>';
        
        let header = isTotal ? `
            <thead><tr><th>姓名</th><th>学号</th><th>总分</th><th>班级排名</th><th>操作</th></tr></thead>
        ` : `
            <thead><tr><th>姓名</th><th>学号</th><th>成绩</th><th>班级排名</th><th>操作</th></tr></thead>
        `;
        
        const rows = data.map(item => {
            if (isTotal) {
                return `
                    <tr>
                        <td>${escapeHtml(item.studentName)}</td>
                        <td>${escapeHtml(item.id)}</td>
                        <td>${item.total_score}</td>
                        <td>${item.class_rank}</td>
                        <td>—</td>
                    </tr>
                `;
            } else {
                return `
                    <tr>
                        <td>${escapeHtml(item.studentName)}</td>
                        <td>${escapeHtml(item.id)}</td>
                        <td>${item.score}</td>
                        <td>${item.class_subject_rank}</td>
                        <td>
                            <button class="btn-sm edit-score-btn" data-id="${item.scoreId}" data-subject="${item.subject}" data-score="${item.score}">编辑</button>
                        </td>
                    </tr>
                `;
            }
        }).join('');
        
        return `<table class="table">${header}<tbody>${rows}</tbody></table>`;
    },
    
    // 通知卡片列表
    noticeList(notices) {
        if (!notices.length) return '<div class="empty-tip">暂无通知</div>';
        return notices.map(n => `
            <div class="notice-item ${n.unreadCount > 0 ? 'unread' : ''}">
                <div class="notice-title">
                    <strong>${escapeHtml(n.title)}</strong>
                    <span class="badge">已读 ${n.readCount}/${n.totalStudents}</span>
                    ${n.unreadCount > 0 ? '<span class="notice-badge-sm">未读剩余</span>' : ''}
                </div>
                <div class="notice-content">${escapeHtml(n.content)}</div>
                <div class="notice-time">${formatDateTime(n.publishTime)} | 发布人：${escapeHtml(n.teacher_name)}</div>
                <div class="inline-actions" style="margin-top:12px;">
                    <button class="btn-sm edit-notice-btn" data-id="${n.id}">编辑</button>
                    <button class="btn-sm btn-danger delete-notice-btn" data-id="${n.id}">删除</button>
                    <button class="btn-sm view-readlist-btn" data-id="${n.id}">查看已读/未读名单</button>
                </div>
            </div>
        `).join('');
    }
};