// 教师端渲染函数 
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
                        <td>
                            <button class="btn-sm comment-btn" data-student-id="${item.id}" data-student-name="${escapeHtml(item.studentName)}">评语</button>
                        </td>
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
                            <button class="btn-sm comment-btn" data-student-id="${item.id}" data-student-name="${escapeHtml(item.studentName)}">评语</button>
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
    },

    // 首页骨架屏
    homeSkeleton() {
        return `
            <h3>班级工作台 · <span class="skeleton" style="display:inline-block; width:100px; height:24px;"></span></h3>
            <p><span class="skeleton" style="display:inline-block; width:180px; height:20px;"></span></p>
            <div class="stats-grid">
                ${Array(4).fill(0).map(() => `
                    <div class="stat-card">
                        <div class="skeleton" style="height:32px; width:60%; margin:0 auto 8px;"></div>
                        <div class="skeleton" style="height:16px; width:40%; margin:0 auto;"></div>
                    </div>
                `).join('')}
            </div>
            <div style="margin-top:24px;">
                <h4>最新通知</h4>
                ${Array(3).fill(0).map(() => `
                    <div class="skeleton" style="height:60px; margin-bottom:12px; border-radius:8px;"></div>
                `).join('')}
            </div>
        `;
    },

    // 成绩页面骨架屏
    scoreSkeleton(isTotal) {
        const cardCount = isTotal ? 3 : 5;
        return `
            <div style="display:flex; justify-content:space-between;">
                <h3>成绩管理 · <span class="skeleton" style="display:inline-block; width:80px; height:24px;"></span></h3>
                <div class="filter-bar">
                    <div class="skeleton" style="width:120px; height:36px; border-radius:30px;"></div>
                    <div class="skeleton" style="width:100px; height:36px; border-radius:30px;"></div>
                </div>
            </div>
            <div class="stats-grid">
                ${Array(cardCount).fill(0).map(() => `
                    <div class="stat-card">
                        <div class="skeleton" style="height:32px; width:60%; margin:0 auto 8px;"></div>
                        <div class="skeleton" style="height:16px; width:40%; margin:0 auto;"></div>
                    </div>
                `).join('')}
            </div>
            <div class="skeleton-table">
                <div class="skeleton-table-header">
                    <div class="skeleton" style="width:15%; height:24px;"></div>
                    <div class="skeleton" style="width:15%; height:24px;"></div>
                    <div class="skeleton" style="width:15%; height:24px;"></div>
                    <div class="skeleton" style="width:15%; height:24px;"></div>
                    <div class="skeleton" style="width:20%; height:24px;"></div>
                    <div class="skeleton" style="width:20%; height:24px;"></div>
                </div>
                ${Array(6).fill(0).map(() => `
                    <div class="skeleton-row">
                        <div class="skeleton skeleton-cell" style="width:15%;"></div>
                        <div class="skeleton skeleton-cell" style="width:15%;"></div>
                        <div class="skeleton skeleton-cell" style="width:15%;"></div>
                        <div class="skeleton skeleton-cell" style="width:15%;"></div>
                        <div class="skeleton skeleton-cell" style="width:20%;"></div>
                        <div class="skeleton skeleton-cell" style="width:20%;"></div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    // 通知管理骨架屏
    noticeSkeleton() {
        return `
            <h3>班级通知管理</h3>
            <div class="card" style="background:#f9f9f9; padding:16px;">
                <h4>发布新通知</h4>
                <div class="skeleton" style="height:36px; margin-bottom:16px;"></div>
                <div class="skeleton" style="height:100px; margin-bottom:16px;"></div>
                <div class="skeleton" style="width:100px; height:36px;"></div>
            </div>
            <h4 style="margin-top:24px;">已发布通知</h4>
            ${Array(3).fill(0).map(() => `
                <div class="notice-item" style="padding:16px; margin-bottom:12px;">
                    <div style="display:flex; gap:12px;">
                        <div class="skeleton" style="width:60%; height:24px;"></div>
                        <div class="skeleton" style="width:80px; height:20px; border-radius:20px;"></div>
                    </div>
                    <div class="skeleton" style="width:100%; height:40px; margin-top:12px;"></div>
                    <div class="skeleton" style="width:200px; height:16px; margin-top:8px;"></div>
                </div>
            `).join('')}
        `;
    },

    // 日志骨架屏
    logSkeleton() {
        return `
            <h3>班级操作日志</h3>
            <div class="skeleton-table">
                <div class="skeleton-table-header">
                    <div class="skeleton" style="width:15%; height:24px;"></div>
                    <div class="skeleton" style="width:15%; height:24px;"></div>
                    <div class="skeleton" style="width:40%; height:24px;"></div>
                    <div class="skeleton" style="width:30%; height:24px;"></div>
                </div>
                ${Array(8).fill(0).map(() => `
                    <div class="skeleton-row">
                        <div class="skeleton skeleton-cell" style="width:15%;"></div>
                        <div class="skeleton skeleton-cell" style="width:15%;"></div>
                        <div class="skeleton skeleton-cell" style="width:40%;"></div>
                        <div class="skeleton skeleton-cell" style="width:30%;"></div>
                    </div>
                `).join('')}
            </div>
            <div style="margin-top:20px; display:flex; justify-content:flex-end; gap:8px;">
                ${Array(3).fill(0).map(() => `<div class="skeleton" style="width:36px; height:36px; border-radius:50%;"></div>`).join('')}
            </div>
        `;
    }
};