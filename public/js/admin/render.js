// public/js/admin/render.js
// ================== 教务端 HTML 渲染函数 ==================

import { AdminState, getAvailableSortFields } from './state.js';

export const AdminRender = {
    
    headerInfo() {
        const admin = AdminState.currentAdmin;
        return {
            avatar: admin ? admin.name.slice(0,1) : 'A',
            name: admin ? `${admin.name} (管理员)` : '加载中'
        };
    },
    
    statsCards(stats, isTotal) {
        if (isTotal) {
            return `
                <div class="stats-grid" style="margin-bottom:16px;">
                    <div class="stat-card"><div class="stat-value">${stats.avg}</div><div>平均分</div></div>
                    <div class="stat-card"><div class="stat-value">${stats.max}</div><div>最高分</div></div>
                    <div class="stat-card"><div class="stat-value">${stats.min}</div><div>最低分</div></div>
                </div>
            `;
        } else {
            return `
                <div class="stats-grid" style="margin-bottom:16px;">
                    <div class="stat-card"><div class="stat-value">${stats.avg}</div><div>平均分</div></div>
                    <div class="stat-card"><div class="stat-value">${stats.max}</div><div>最高分</div></div>
                    <div class="stat-card"><div class="stat-value">${stats.min}</div><div>最低分</div></div>
                    <div class="stat-card"><div class="stat-value">${stats.passCount}/${stats.total}</div><div>及格人数</div></div>
                    <div class="stat-card"><div class="stat-value">${stats.passRate}</div><div>及格率</div></div>
                </div>
            `;
        }
    },
    
    filterBar() {
        const classOptions = '<option value="所有班级">所有班级</option>' +
            AdminState.classes.map(c => `<option value="${c.className}" ${AdminState.globalClassFilter === c.className ? 'selected' : ''}>${escapeHtml(c.className)}</option>`).join('');
        
        const subjectOptions = AdminState.allSubjects.map(sub =>
            `<option value="${sub}" ${AdminState.globalSubjectFilter === sub ? 'selected' : ''}>${sub}</option>`
        ).join('');
        
        const examOptions = '<option value="">所有批次</option>' +
            AdminState.examList.map(d => `<option value="${d}" ${AdminState.currentExamDate === d ? 'selected' : ''}>${d}</option>`).join('');
        
        const isTotal = AdminState.globalSubjectFilter === '总分';
        const hasExamDate = !!AdminState.currentExamDate;
        const sortFields = getAvailableSortFields(isTotal, hasExamDate);
        const sortOptions = sortFields.map(f => 
            `<option value="${f.value}" ${AdminState.currentSortField === f.value ? 'selected' : ''}>${f.label}</option>`
        ).join('');
        
        return `
            <div class="filter-bar" style="display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
                <select id="examSelect" class="filter-select">${examOptions}</select>
                <select id="classFilterAll" class="filter-select">${classOptions}</select>
                <select id="subjectFilterAll" class="filter-select">${subjectOptions}</select>
                <input type="text" id="searchInput" placeholder="搜索班级/姓名/学号" value="${escapeHtml(AdminState.currentSearchKeyword)}" style="width:180px;">
                <button id="searchBtn" class="btn-sm">搜索</button>
                <div style="display:flex; gap:4px; margin-left:auto;">
                    <select id="sortFieldSelect" class="filter-select" style="width:auto;">${sortOptions}</select>
                    <button id="toggleSortOrderBtn" class="btn-sm" title="切换排序方向">${AdminState.currentSortOrder === 'asc' ? '↑' : '↓'}</button>
                </div>
                <button id="addScoreAllBtn" class="btn-primary btn-sm">+ 添加成绩</button>
                <button id="batchImportAllBtn" class="btn-sm">批量导入</button>
                <button id="exportAllBtn" class="btn-sm">导出CSV</button>
                <button id="downloadTemplateBtn" class="btn-sm">下载模板</button>
            </div>
        `;
    },
    
    scoreTable(displayData, isTotal, hasExamDate) {
        const examDateHeader = hasExamDate ? '' : '<th>考试批次</th>';
        let header = isTotal ? `
            <thead><tr>
                <th>姓名</th><th>学号</th>${examDateHeader}<th>总分</th>
                ${hasExamDate ? '<th>总分排名</th><th>班级排名</th>' : ''}
                <th>操作</th>
            </tr></thead>
        ` : `
            <thead><tr>
                <th>班级</th><th>姓名</th><th>学号</th>${examDateHeader}<th>科目</th><th>成绩</th>
                ${hasExamDate ? '<th>年级排名</th><th>班级排名</th>' : ''}
                <th>操作</th>
            </tr></thead>
        `;
        
        const rows = displayData.map(item => {
            const examCell = hasExamDate ? '' : `<td>${item.exam_date ? formatDate(item.exam_date) : '—'}</td>`;
            return `
                <tr>
                    ${isTotal ? '' : `<td>${escapeHtml(item.className)}</td>`}
                    <td>${escapeHtml(item.studentName)}</td>
                    <td>${escapeHtml(item.studentId)}</td>
                    ${examCell}
                    ${isTotal ? '' : `<td>${escapeHtml(AdminState.globalSubjectFilter)}</td>`}
                    <td>${item.score}</td>
                    ${isTotal ? `
                        ${hasExamDate ? `<td>${item.class_rank || '—'}</td><td>${item.class_rank_in_class || '—'}</td>` : ''}
                    ` : `
                        ${hasExamDate ? `<td>${item.grade_rank_subject || '—'}</td><td>${item.class_rank_subject || '—'}</td>` : ''}
                    `}
                    <td>
                        ${isTotal ? '—' : `
                            <button class="btn-sm edit-score-btn" data-id="${item.id}" data-score="${item.score}" data-name="${escapeHtml(item.studentName)}">编辑</button>
                            <button class="btn-sm btn-danger delete-score-btn" data-id="${item.id}">删除</button>
                        `}
                    </td>
                </tr>
            `;
        }).join('');
        
        return `<table class="table">${header}<tbody>${rows || '<tr><td colspan="8">暂无数据</td></tr>'}</tbody></table>`;
    },

    // 在 AdminRender 对象内部添加以下方法（放在 scoreTable 方法后面即可）

    /**
     * 渲染成绩表格骨架屏
     * @param {number} rowCount - 骨架行数
     */
    scoreTableSkeleton(rowCount = 8) {
        let rows = '';
        for (let i = 0; i < rowCount; i++) {
            rows += `
                <div class="skeleton-row">
                    <div class="skeleton skeleton-cell" style="width: 15%;"></div>
                    <div class="skeleton skeleton-cell" style="width: 12%;"></div>
                    <div class="skeleton skeleton-cell" style="width: 15%;"></div>
                    <div class="skeleton skeleton-cell" style="width: 15%;"></div>
                    <div class="skeleton skeleton-cell" style="width: 18%;"></div>
                    <div class="skeleton skeleton-cell" style="width: 25%;"></div>
                </div>
            `;
        }
        return `
            <div class="skeleton-table">
                <div class="skeleton-table-header">
                    <div class="skeleton skeleton-cell" style="width: 15%; height: 24px;"></div>
                    <div class="skeleton skeleton-cell" style="width: 12%; height: 24px;"></div>
                    <div class="skeleton skeleton-cell" style="width: 15%; height: 24px;"></div>
                    <div class="skeleton skeleton-cell" style="width: 15%; height: 24px;"></div>
                    <div class="skeleton skeleton-cell" style="width: 18%; height: 24px;"></div>
                    <div class="skeleton skeleton-cell" style="width: 25%; height: 24px;"></div>
                </div>
                ${rows}
            </div>
        `;
    },

    /**
     * 渲染统计卡片骨架屏
     */
    statsCardsSkeleton(isTotal) {
        const cardCount = isTotal ? 3 : 5;
        let cards = '';
        for (let i = 0; i < cardCount; i++) {
            cards += `<div class="skeleton stat-card"><div class="skeleton" style="height: 32px; width: 60%; margin: 0 auto 8px;"></div><div class="skeleton" style="height: 16px; width: 40%; margin: 0 auto;"></div></div>`;
        }
        return `<div class="stats-grid" style="margin-bottom:16px;">${cards}</div>`;
    },

    // 总览看板骨架屏
    dashboardSkeleton() {
        return `
            <h3>教务总览看板</h3>
            <p><span class="skeleton" style="display:inline-block; width:200px; height:20px;"></span></p>
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
                <div>
                    ${Array(3).fill(0).map(() => `
                        <div class="skeleton" style="height:60px; margin-bottom:12px; border-radius:8px;"></div>
                    `).join('')}
                </div>
            </div>
            <div style="margin-top:24px;">
                <h4>最近操作日志</h4>
                <div class="skeleton-table">
                    <div class="skeleton-table-header">
                        <div class="skeleton" style="width:15%; height:24px;"></div>
                        <div class="skeleton" style="width:15%; height:24px;"></div>
                        <div class="skeleton" style="width:40%; height:24px;"></div>
                        <div class="skeleton" style="width:30%; height:24px;"></div>
                    </div>
                    ${Array(3).fill(0).map(() => `
                        <div class="skeleton-row">
                            <div class="skeleton skeleton-cell" style="width:15%;"></div>
                            <div class="skeleton skeleton-cell" style="width:15%;"></div>
                            <div class="skeleton skeleton-cell" style="width:40%;"></div>
                            <div class="skeleton skeleton-cell" style="width:30%;"></div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    // 班级管理骨架屏
    classManageSkeleton() {
        return `
            <h3>班级管理与教师绑定</h3>
            <div class="card" style="background:#f9f9f9; padding:16px;">
                <h4>新增班级</h4>
                <div class="skeleton" style="width:120px; height:36px; border-radius:6px;"></div>
            </div>
            <h4>现有班级列表</h4>
            ${Array(2).fill(0).map(() => `
                <div class="class-card" style="border:1px solid #ddd; border-radius:12px; padding:16px; margin-bottom:20px;">
                    <div style="display:flex; justify-content:space-between;">
                        <div class="skeleton" style="width:180px; height:24px;"></div>
                        <div class="skeleton" style="width:300px; height:32px;"></div>
                    </div>
                    <div style="margin-top:16px;">
                        <h5>班级成员</h5>
                        ${Array(3).fill(0).map(() => `
                            <div style="display:flex; justify-content:space-between; padding:6px 0;">
                                <div class="skeleton" style="width:120px; height:20px;"></div>
                                <div class="skeleton" style="width:60px; height:20px;"></div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('')}
            <hr>
            <h4>教师池管理</h4>
            <div class="skeleton" style="width:100px; height:32px; margin-bottom:12px;"></div>
            <div style="display:flex; flex-wrap:wrap; gap:8px;">
                ${Array(5).fill(0).map(() => `<div class="skeleton" style="width:80px; height:32px; border-radius:20px;"></div>`).join('')}
            </div>
        `;
    },

    // 全量通知骨架屏
    noticeAllSkeleton() {
        return `
            <h3>全校班级通知</h3>
            <div class="filter-bar">
                <div class="skeleton" style="width:150px; height:36px; border-radius:30px;"></div>
            </div>
            <div>
                ${Array(4).fill(0).map(() => `
                    <div class="notice-item" style="padding:16px; margin-bottom:12px;">
                        <div style="display:flex; align-items:center; gap:12px;">
                            <div class="skeleton" style="width:60%; height:24px;"></div>
                            <div class="skeleton" style="width:80px; height:20px; border-radius:20px;"></div>
                        </div>
                        <div class="skeleton" style="width:100%; height:40px; margin-top:12px;"></div>
                        <div class="skeleton" style="width:200px; height:16px; margin-top:8px;"></div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    // 系统日志骨架屏
    systemLogSkeleton() {
        return `
            <h3>系统操作日志</h3>
            <div class="skeleton-table">
                <div class="skeleton-table-header">
                    <div class="skeleton" style="width:15%; height:24px;"></div>
                    <div class="skeleton" style="width:15%; height:24px;"></div>
                    <div class="skeleton" style="width:40%; height:24px;"></div>
                    <div class="skeleton" style="width:30%; height:24px;"></div>
                </div>
                ${Array(10).fill(0).map(() => `
                    <div class="skeleton-row">
                        <div class="skeleton skeleton-cell" style="width:15%;"></div>
                        <div class="skeleton skeleton-cell" style="width:15%;"></div>
                        <div class="skeleton skeleton-cell" style="width:40%;"></div>
                        <div class="skeleton skeleton-cell" style="width:30%;"></div>
                    </div>
                `).join('')}
            </div>
            <div style="margin-top:20px; display:flex; justify-content:flex-end; gap:8px;">
                ${Array(5).fill(0).map(() => `<div class="skeleton" style="width:36px; height:36px; border-radius:50%;"></div>`).join('')}
            </div>
        `;
    }
};