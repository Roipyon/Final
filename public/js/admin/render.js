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
                        ${hasExamDate ? `<td>${item.classRank || '—'}</td><td>${item.classRankInClass || '—'}</td>` : ''}
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
    }
};