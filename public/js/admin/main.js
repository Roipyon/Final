// public/js/admin/main.js
// ================== 教务端主入口 ==================

import { AdminState, filterScores, sortScores, getAvailableSortFields } from './state.js';
import { AdminRender } from './render.js';

let currentSection = 'dashboard';

// ---------- 数据加载 ----------
async function loadBaseData() {
    const [info, classes, teachers, grades, exams, notices, logs] = await Promise.all([
        API.admin.getInfo(),
        API.admin.getClasses(),
        API.admin.getTeachers(),
        API.admin.getGrades(),
        API.admin.getExams(),
        API.admin.getNotices(),
        API.admin.getLogs()
    ]);
    AdminState.currentAdmin = info;
    AdminState.classes = classes;
    AdminState.allTeachers = teachers;
    AdminState.gradeList = grades;
    AdminState.examList = exams;
    AdminState.allNotices = notices;
    AdminState.systemLogs = logs;
    updateSubjects();
}

function updateSubjects() {
    const subjectSet = new Set();
    AdminState.allScores.forEach(s => subjectSet.add(s.subject));
    subjectSet.add('总分');
    AdminState.allSubjects = Array.from(subjectSet).sort();
    if (!AdminState.allSubjects.includes(AdminState.globalSubjectFilter)) {
        AdminState.globalSubjectFilter = AdminState.allSubjects[0] || '数学';
    }
}

async function loadScoresData() {
    if (AdminState.globalSubjectFilter === '总分') {
        const data = await API.admin.getTotalScores(AdminState.currentExamDate);
        AdminState.scoresTotal = data.map(item => ({ ...item, score: parseFloat(item.total_score) || 0 }));
    } else {
        const data = await API.admin.getScores(AdminState.currentExamDate);
        AdminState.allScores = data.map(s => ({ ...s, score: parseFloat(s.score) || 0 }));
    }
    updateSubjects();
}

// ---------- 成绩页面 ----------
async function renderScoreAll() {
    const isTotal = AdminState.globalSubjectFilter === '总分';
    if (isTotal && !AdminState.currentExamDate) {
        const firstSubject = AdminState.allSubjects.find(s => s !== '总分') || '数学';
        AdminState.globalSubjectFilter = firstSubject;
        return renderScoreAll();
    }
    await loadScoresData();
    let rawData = isTotal ? AdminState.scoresTotal : AdminState.allScores;
    let displayData = filterScores(rawData, isTotal);
    const stats = computeStats(displayData);
    const hasExamDate = !!AdminState.currentExamDate;
    displayData = sortScores(displayData, isTotal, hasExamDate);
    
    const section = document.getElementById('scoreAllSection');
    section.innerHTML = `
        <h3>全量成绩管理 (跨班级)</h3>
        ${AdminRender.filterBar()}
        ${AdminRender.statsCards(stats, isTotal)}
        ${AdminRender.scoreTable(displayData, isTotal, hasExamDate)}
    `;
    updateSortButtonText();
    document.getElementById('examSelect').addEventListener('change', (e) => {
        AdminState.currentExamDate = e.target.value;
        AdminState.currentSortField = 'className';
        AdminState.currentSortOrder = 'asc';
        renderScoreAll();
    });
    document.getElementById('subjectFilterAll').addEventListener('change', (e) => {
        AdminState.globalSubjectFilter = e.target.value;
        // 根据科目类型自动调整排序方向
        if (AdminState.globalSubjectFilter === '总分') {
            AdminState.currentSortField = 'totalScore';
            AdminState.currentSortOrder = 'desc';
        } else {
            AdminState.currentSortField = 'className';
            AdminState.currentSortOrder = 'asc';
        }
        renderScoreAll();
    });
}

// ---------- 总览看板 ----------
function renderDashboard() {
    const totalClasses = AdminState.classes.length;
    const totalStudents = AdminState.classes.reduce((sum, c) => sum + (c.studentCount || 0), 0);
    const totalNotices = AdminState.allNotices.length;
    const latestNotices = [...AdminState.allNotices]
        .sort((a, b) => new Date(b.publishTime) - new Date(a.publishTime))
        .slice(0, 3);
    
    const noticeHtml = latestNotices.map(notice => {
        const isNew = isNewNotice(notice.publishTime);
        return `
            <div class="recent-notice-item" style="cursor:pointer; padding:12px; border-bottom:1px solid #ddd;" data-notice-id="${notice.id}">
                <div style="display:flex; justify-content:space-between;">
                    <strong>${escapeHtml(notice.title)}</strong>
                    ${isNew ? '<span style="background:#ffc107; padding:2px 6px; border-radius:4px;">新</span>' : ''}
                </div>
                <div style="font-size:12px; color:#666;">${escapeHtml(notice.className)} · ${formatDateTime(notice.publishTime)}</div>
                <div style="font-size:13px; margin-top:4px;">${escapeHtml(notice.content.substring(0, 50))}…</div>
            </div>
        `;
    }).join('');
    
    const logRows = AdminState.systemLogs.slice(0, 3).map(l => `
        <tr><td>${escapeHtml(l.operator)}</td><td>${escapeHtml(l.operationType)}</td><td>${escapeHtml(l.content)}</td><td>${formatDateTime(l.operateTime)}</td></tr>
    `).join('');
    
    const html = `
        <h3>教务总览看板</h3>
        <p>欢迎 ${escapeHtml(AdminState.currentAdmin?.name || '')}，全校教学数据实时监控。</p>
        <div class="stats-grid">
            <div class="stat-card"><div class="stat-value">${totalClasses}</div><div>班级总数</div></div>
            <div class="stat-card"><div class="stat-value">${totalStudents}</div><div>在校学生</div></div>
            <div class="stat-card"><div class="stat-value">${AdminState.allTeachers.length}</div><div>在职教师</div></div>
            <div class="stat-card"><div class="stat-value">${totalNotices}</div><div>班级通知</div></div>
        </div>
        <div style="margin-top:24px;">
            <h4>最新通知</h4>
            <div>${noticeHtml || '<div class="empty-tip">暂无通知</div>'}</div>
            <div style="text-align:right;"><a href="#" data-nav="noticeAll" class="nav-link">查看全部 →</a></div>
        </div>
        <div style="margin-top:24px;">
            <h4>最近操作日志</h4>
            <table class="table"><thead><tr><th>操作人</th><th>类型</th><th>内容</th><th>时间</th></tr></thead><tbody>${logRows}</tbody></table>
            <div style="text-align:right;"><a href="#" data-nav="systemLog" class="nav-link">查看全部日志 →</a></div>
        </div>
    `;
    document.getElementById('dashboardSection').innerHTML = html;
    
    document.querySelectorAll('#dashboardSection .recent-notice-item').forEach(el => {
        el.addEventListener('click', () => switchSection('noticeAll'));
    });
}

// ---------- 班级管理 ----------
async function renderClassManage() {
    // 刷新班级数据
    const classes = await API.admin.getClasses();
    AdminState.classes = classes;
    
    // 获取每个班级的学生
    for (let c of AdminState.classes) {
        const students = await API.request(`/admin/classes/${c.id}/students`);
        c.students = students;
        c.studentCount = students.length;
    }
    
    let classListHtml = '';
    for (let c of AdminState.classes) {
        let studentListHtml = '';
        for (let s of c.students) {
            studentListHtml += `
                <div class="student-item" style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #eee;">
                    <span>${escapeHtml(s.name)} (${escapeHtml(s.studentId)})</span>
                    <button class="btn-sm btn-danger delete-student-btn" data-class-id="${c.id}" data-student-id="${s.id}">删除</button>
                </div>
            `;
        }
        if (!studentListHtml) studentListHtml = '<div class="empty-tip">暂无学生</div>';
        
        let teacherOptions = '<option value="">-- 绑定教师 --</option>';
        AdminState.allTeachers.forEach(t => {
            const selected = c.teacherId === t.id ? 'selected' : '';
            teacherOptions += `<option value="${t.id}" ${selected}>${escapeHtml(t.name)}</option>`;
        });
        
        classListHtml += `
            <div class="class-card" style="border:1px solid #ddd; border-radius:12px; padding:16px; margin-bottom:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div><strong>${escapeHtml(c.className)}</strong> (${c.studentCount}人) 班主任: ${escapeHtml(c.teacher || '未绑定')}</div>
                    <div>
                        <select class="bind-teacher-select" data-classid="${c.id}">${teacherOptions}</select>
                        <button class="btn-sm btn-danger delete-class-btn" data-id="${c.id}">删除班级</button>
                        <button class="btn-sm edit-class-btn" data-id="${c.id}" data-name="${escapeHtml(c.rawClassName)}" data-grade-id="${c.gradeId}">编辑</button>
                        <button class="btn-sm btn-primary add-student-btn" data-class-id="${c.id}">+ 添加学生</button>
                    </div>
                </div>
                <div style="margin-top:16px;">
                    <h5>班级成员</h5>
                    <div class="student-list">${studentListHtml}</div>
                </div>
            </div>
        `;
    }
    
    let teacherPoolHtml = '';
    AdminState.allTeachers.forEach(t => {
        teacherPoolHtml += `<span style="display:inline-block; background:#f0f0f0; padding:4px 12px; border-radius:20px; margin:4px;">${escapeHtml(t.name)}</span>`;
    });
    
    const html = `
        <h3>班级管理与教师绑定</h3>
        <div class="card" style="background:#f9f9f9; padding:16px;">
            <h4>新增班级</h4>
            <button id="openAddClassBtn" class="btn-primary">+ 新增班级</button>
        </div>
        <h4>现有班级列表</h4>
        <div id="classListContainer">${classListHtml || '<div class="empty-tip">暂无班级</div>'}</div>
        <hr>
        <h4>教师池管理</h4>
        <button id="openAddTeacherBtn" class="btn-sm">+ 添加教师</button>
        <div style="margin-top:12px;">${teacherPoolHtml}</div>
    `;
    document.getElementById('classManageSection').innerHTML = html;
    
    // 绑定事件
    document.getElementById('openAddClassBtn')?.addEventListener('click', openAddClassModal);
    document.getElementById('openAddTeacherBtn')?.addEventListener('click', openAddTeacherModal);
    
    document.querySelectorAll('.bind-teacher-select').forEach(sel => {
        sel.addEventListener('change', async (e) => {
            const classId = sel.dataset.classid;
            const teacherId = e.target.value || null;
            await API.admin.bindTeacher(classId, teacherId);
            renderClassManage();
        });
    });
    
    document.querySelectorAll('.delete-class-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (confirm('确定删除该班级吗？所有学生关联将被移除。')) {
                await API.admin.deleteClass(btn.dataset.id);
                renderClassManage();
            }
        });
    });
    
    document.querySelectorAll('.edit-class-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            AdminState.currentEditClassId = btn.dataset.id;
            document.getElementById('editClassName').value = btn.dataset.name;
            // 填充年级下拉
            const gradeSelect = document.getElementById('editClassGradeId');
            gradeSelect.innerHTML = AdminState.gradeList.map(g => 
                `<option value="${g.id}" ${g.id == btn.dataset.gradeId ? 'selected' : ''}>${g.grade_name}</option>`
            ).join('');
            document.getElementById('editClassModal').style.display = 'flex';
        });
    });
    
    document.querySelectorAll('.add-student-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            AdminState.currentAddStudentClassId = btn.dataset.classId;
            document.getElementById('studentName').value = '';
            document.getElementById('studentId').value = '';
            document.getElementById('addStudentModal').style.display = 'flex';
        });
    });
    
    document.querySelectorAll('.delete-student-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (confirm('确定删除该学生吗？')) {
                await API.admin.deleteStudent(btn.dataset.classId, btn.dataset.studentId);
                renderClassManage();
            }
        });
    });
}

async function openAddClassModal() {
    const gradeSelect = document.getElementById('addClassGradeId');
    gradeSelect.innerHTML = AdminState.gradeList.map(g => `<option value="${g.id}">${g.grade_name}</option>`).join('');
    document.getElementById('addClassName').value = '';
    document.getElementById('addClassModal').style.display = 'flex';
}

function openAddTeacherModal() {
    document.getElementById('teacherName').value = '';
    document.getElementById('addTeacherModal').style.display = 'flex';
}

// ---------- 全量通知 ----------
function renderNoticeAll() {
    const sorted = [...AdminState.allNotices].sort((a, b) => new Date(b.publishTime) - new Date(a.publishTime));
    const cards = sorted.map(notice => {
        const isNew = isNewNotice(notice.publishTime);
        return `
            <div class="notice-item ${isNew ? 'unread' : ''}">
                <div class="notice-title">
                    <strong>${escapeHtml(notice.title)}</strong>
                    <span class="badge">${escapeHtml(notice.className)}</span>
                    ${isNew ? '<span class="notice-badge-sm">新</span>' : ''}
                </div>
                <div class="notice-content">${escapeHtml(notice.content)}</div>
                <div class="notice-time">${formatDateTime(notice.publishTime)} | 发布人：${escapeHtml(notice.teacher_name)} | 已读 ${notice.readCount}/${notice.totalStu}</div>
            </div>
        `;
    }).join('');
    
    let filterHtml = '<select id="classFilterNotice" class="filter-select"><option value="all">所有班级</option>';
    AdminState.classes.forEach(c => { filterHtml += `<option value="${c.className}">${escapeHtml(c.className)}</option>`; });
    filterHtml += '</select>';
    
    const html = `
        <h3>全校班级通知</h3>
        <div class="filter-bar">${filterHtml}</div>
        <div id="noticeListContainer">${cards || '<div class="empty-tip">暂无通知</div>'}</div>
    `;
    document.getElementById('noticeAllSection').innerHTML = html;
    
    document.getElementById('classFilterNotice')?.addEventListener('change', (e) => {
        const val = e.target.value;
        const filtered = val === 'all' ? sorted : sorted.filter(n => n.className === val);
        const filteredHtml = filtered.map(notice => {
            const isNew = isNewNotice(notice.publishTime);
            return `
                <div class="notice-item ${isNew ? 'unread' : ''}">
                    <div class="notice-title"><strong>${escapeHtml(notice.title)}</strong><span class="badge">${escapeHtml(notice.className)}</span>${isNew ? '<span class="notice-badge-sm">新</span>' : ''}</div>
                    <div class="notice-content">${escapeHtml(notice.content)}</div>
                    <div class="notice-time">${formatDateTime(notice.publishTime)} | 发布人：${escapeHtml(notice.teacher_name)} | 已读 ${notice.readCount}/${notice.totalStu}</div>
                </div>
            `;
        }).join('');
        document.getElementById('noticeListContainer').innerHTML = filteredHtml || '<div class="empty-tip">暂无通知</div>';
    });
}

// ---------- 系统日志 ----------
function renderSystemLog() {
    const logs = AdminState.systemLogs;
    const totalPages = Math.ceil(logs.length / AdminState.logsPerPage);
    const start = (AdminState.currentLogPage - 1) * AdminState.logsPerPage;
    const pageLogs = logs.slice(start, start + AdminState.logsPerPage);
    
    const rows = pageLogs.map(l => `
        <tr><td>${escapeHtml(l.operator)}</td><td>${escapeHtml(l.operationType)}</td><td>${escapeHtml(l.content)}</td><td>${formatDateTime(l.operateTime)}</td></tr>
    `).join('');
    
    const pagination = Array.from({ length: totalPages }, (_, i) => `
        <button class="page-btn ${i+1 === AdminState.currentLogPage ? 'active-page' : ''}" data-page="${i+1}">${i+1}</button>
    `).join('');
    
    const html = `
        <h3>系统操作日志</h3>
        <table class="table"><thead><tr><th>操作人</th><th>类型</th><th>内容</th><th>时间</th></tr></thead><tbody>${rows}</tbody></table>
        <div class="pagination">${pagination}</div>
    `;
    document.getElementById('systemLogSection').innerHTML = html;
    
    document.querySelectorAll('#systemLogSection .page-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            AdminState.currentLogPage = parseInt(btn.dataset.page);
            renderSystemLog();
        });
    });
}

// ---------- 模块切换 ----------
async function switchSection(sectionId) {
    currentSection = sectionId;
    document.querySelectorAll('.sidebar-menu a').forEach(l => l.classList.remove('active'));
    document.querySelector(`[data-nav="${sectionId}"]`)?.classList.add('active');
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(`${sectionId}Section`)?.classList.add('active');
    
    const titles = { dashboard: '总览看板', classManage: '班级管理', scoreAll: '全量成绩', noticeAll: '全量通知', systemLog: '系统日志' };
    document.getElementById('pageTitle').innerText = titles[sectionId] || '';
    
    switch (sectionId) {
        case 'dashboard': renderDashboard(); break;
        case 'classManage': await renderClassManage(); break;
        case 'scoreAll': await renderScoreAll(); break;
        case 'noticeAll': renderNoticeAll(); break;
        case 'systemLog': renderSystemLog(); break;
    }
    
    const sidebar = document.getElementById('sidebar');
    if (sidebar?.classList.contains('show')) sidebar.classList.remove('show');
}

// ---------- 全局事件绑定 ----------
function bindGlobalEvents() {
    // 导航
    document.addEventListener('click', async (e) => {
        if (e.target.matches('.sidebar-menu a, .nav-link')) {
            e.preventDefault();
            const nav = e.target.dataset.nav;
            if (nav) switchSection(nav);
        }
        // 成绩操作
        if (currentSection === 'scoreAll') {
            if (e.target.id === 'searchBtn') {
                AdminState.currentSearchKeyword = document.getElementById('searchInput').value;
                renderScoreAll();
            } else if (e.target.classList.contains('edit-score-btn')) {
                const id = e.target.dataset.id;
                AdminState.currentEditScoreId = id;
                document.getElementById('editScoreStudentName').value = e.target.dataset.name;
                document.getElementById('editScoreSubject').value = AdminState.globalSubjectFilter;
                document.getElementById('editScoreValue').value = e.target.dataset.score;
                document.getElementById('editScoreAdminModal').style.display = 'flex';
            } else if (e.target.classList.contains('delete-score-btn')) {
                if (confirm('确定删除？')) {
                    await API.admin.deleteScore(e.target.dataset.id);
                    renderScoreAll();
                }
            } else if (e.target.id === 'exportAllBtn') {
                exportCSV();
            } else if (e.target.id === 'addScoreAllBtn') {
                openAddScoreModal();
            }
        }
        // 模态框关闭（遮罩点击）
        if (e.target.classList.contains('modal-mask')) {
            e.target.style.display = 'none';
        }
        // 搜索框回车
        document.getElementById('searchInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                AdminState.currentSearchKeyword = e.target.value;
                if (currentSection === 'scoreAll') renderScoreAll();
            }
        });

        // 下载模板
        document.getElementById('downloadTemplateBtn')?.addEventListener('click', () => {
            const csv = '班级,姓名,学号,科目,成绩,考试日期(可选)\n高一1班,张三,2024001,数学,85,2026-04-12';
            const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = '成绩导入模板.csv';
            a.click();
        });

        // 批量导入（增强版，带预览和错误统计）
        document.getElementById('batchImportAllBtn')?.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.csv';
            input.onchange = handleBatchImport;
            input.click();
        });
    });
    
    // 批量导入按钮
    document.getElementById('batchImportAllBtn')?.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv';
        input.onchange = handleFileSelect;
        input.click();
    });

    document.addEventListener('change', async (e) => {
        if (currentSection === 'scoreAll') {
            if (e.target.id === 'classFilterAll') {
                AdminState.globalClassFilter = e.target.value;
                renderScoreAll();
            } else if (e.target.id === 'subjectFilterAll') {
                AdminState.globalSubjectFilter = e.target.value;
                renderScoreAll();
            } else if (e.target.id === 'examSelect') {
                AdminState.currentExamDate = e.target.value;
                AdminState.currentSortField = 'className';
                renderScoreAll();
            } else if (e.target.id === 'sortFieldSelect') {
                AdminState.currentSortField = e.target.value;
                renderScoreAll();
            }
        }
    });
    
    document.getElementById('toggleSortOrderBtn')?.addEventListener('click', () => {
        AdminState.currentSortOrder = AdminState.currentSortOrder === 'asc' ? 'desc' : 'asc';
        if (currentSection === 'scoreAll') renderScoreAll();
    });
    
    // 模态框按钮
    document.getElementById('confirmAddClassBtn')?.addEventListener('click', async () => {
        const name = document.getElementById('addClassName').value.trim();
        const gradeId = document.getElementById('addClassGradeId').value;
        if (name) {
            await API.admin.addClass(name, gradeId);
            closeModal('addClassModal');
            renderClassManage();
        }
    });
    
    document.getElementById('confirmEditClassBtn')?.addEventListener('click', async () => {
        const name = document.getElementById('editClassName').value.trim();
        const gradeId = document.getElementById('editClassGradeId').value;
        if (name) {
            await API.admin.updateClass(AdminState.currentEditClassId, name, gradeId);
            closeModal('editClassModal');
            renderClassManage();
        }
    });
    
    document.getElementById('confirmAddStudentBtn')?.addEventListener('click', async () => {
        const name = document.getElementById('studentName').value.trim();
        const studentId = document.getElementById('studentId').value.trim();
        if (name && studentId) {
            await API.admin.addStudent(AdminState.currentAddStudentClassId, name, studentId);
            closeModal('addStudentModal');
            renderClassManage();
        }
    });
    
    document.getElementById('confirmAddTeacherBtn')?.addEventListener('click', async () => {
        const name = document.getElementById('teacherName').value.trim();
        if (name) {
            await API.admin.addTeacher(name);
            AdminState.allTeachers = await API.admin.getTeachers();
            closeModal('addTeacherModal');
            renderClassManage();
        }
    });
    
    document.getElementById('confirmAddScoreBtn')?.addEventListener('click', confirmAddScore);
    document.getElementById('confirmEditScoreAdminBtn')?.addEventListener('click', confirmEditScore);
    
    document.querySelectorAll('.modal-mask').forEach(m => {
        m.addEventListener('click', (e) => { if (e.target === m) m.style.display = 'none'; });
    });
}

function closeModal(id) { document.getElementById(id).style.display = 'none'; }

async function openAddScoreModal() {
    const classSelect = document.getElementById('addScoreClass');
    classSelect.innerHTML = '<option value="">请选择班级</option>';
    AdminState.classes.forEach(c => { classSelect.innerHTML += `<option value="${escapeHtml(c.className)}">${escapeHtml(c.className)}</option>`; });
    document.getElementById('addScoreSubject').value = AdminState.globalSubjectFilter === '总分' ? '' : AdminState.globalSubjectFilter;
    document.getElementById('addScoreModal').style.display = 'flex';
}

async function confirmAddScore() {
    const className = document.getElementById('addScoreClass').value;
    const studentName = document.getElementById('addScoreStudentName').value.trim();
    const studentId = document.getElementById('addScoreStudentId').value.trim();
    let subject = document.getElementById('addScoreSubject').value.trim();
    const score = parseFloat(document.getElementById('addScoreValue').value);
    const examDate = document.getElementById('addScoreExamDate').value;

    if (!className || !studentName || !studentId || !subject) {
        alert('请完整填写');
        return;
    }
    if (subject === '总分') {
        alert('总分由系统自动计算，不可手动添加');
        return;
    }
    // 满分校验
    try {
        const fullRes = await API.request('/admin/fullmark', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subject })
        });
        const fullMark = fullRes.full_mark || 100;
        if (isNaN(score) || score < 0 || score > fullMark) {
            alert(`成绩必须在 0-${fullMark} 之间`);
            return;
        }
    } catch (e) { /* 降级处理 */ }
    
    await API.admin.addScore({ className, studentName, studentId, subject, score, examDate });
    closeModal('addScoreModal');
    renderScoreAll();
}

async function confirmEditScore() {
    const newScore = parseFloat(document.getElementById('editScoreValue').value);
    const id = AdminState.currentEditScoreId;
    const scoreItem = AdminState.allScores.find(s => s.id === id);
    if (!scoreItem) return;
    if (scoreItem.subject === '总分') {
        alert('总分不可编辑');
        closeModal('editScoreAdminModal');
        return;
    }
    try {
        const fullRes = await API.request('/admin/fullmark', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subject: scoreItem.subject })
        });
        const fullMark = fullRes.full_mark || 100;
        if (newScore < 0 || newScore > fullMark) {
            alert(`成绩必须在 0-${fullMark} 之间`);
            return;
        }
    } catch (e) {}
    await API.admin.updateScore(id, newScore);
    closeModal('editScoreAdminModal');
    renderScoreAll();
}

function updateSortButtonText() {
    const btn = document.getElementById('toggleSortOrderBtn');
    if (btn) btn.textContent = AdminState.currentSortOrder === 'asc' ? '↑' : '↓';
}

function exportCSV() {
    const isTotal = AdminState.globalSubjectFilter === '总分';
    const data = isTotal ? AdminState.scoresTotal : AdminState.allScores;
    const filtered = filterScores(data, isTotal);
    const hasExamDate = !!AdminState.currentExamDate;
    
    let csv = isTotal 
        ? '姓名,学号,' + (hasExamDate ? '' : '考试批次,') + '总分' + (hasExamDate ? ',总分排名,班级排名' : '') + '\n'
        : '班级,姓名,学号,' + (hasExamDate ? '' : '考试批次,') + '科目,成绩' + (hasExamDate ? ',年级排名,班级排名' : '') + '\n';
    
    filtered.forEach(item => {
        if (isTotal) {
            csv += `${item.studentName},${item.studentId},`;
            if (!hasExamDate) csv += `${formatDate(item.exam_date)},`;
            csv += `${item.score}`;
            if (hasExamDate) csv += `,${item.classRank || ''},${item.classRankInClass || ''}`;
            csv += '\n';
        } else {
            csv += `${item.className},${item.studentName},${item.studentId},`;
            if (!hasExamDate) csv += `${formatDate(item.exam_date)},`;
            csv += `${AdminState.globalSubjectFilter},${item.score}`;
            if (hasExamDate) csv += `,${item.grade_rank_subject || ''},${item.class_rank_subject || ''}`;
            csv += '\n';
        }
    });
    
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `成绩_${AdminState.globalSubjectFilter}_${AdminState.currentExamDate || '所有批次'}.csv`;
    a.click();
}

// 新增批量导入处理函数（放在文件末尾）
async function handleBatchImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
        const csv = ev.target.result;
        const lines = csv.trim().split('\n');
        if (lines.length < 2) { alert('至少需要表头和一行数据'); return; }
        const headers = lines[0].split(',').map(h => h.trim());
        const idx = {
            class: headers.indexOf('班级'),
            name: headers.indexOf('姓名'),
            id: headers.indexOf('学号'),
            subject: headers.indexOf('科目'),
            score: headers.indexOf('成绩'),
            date: headers.indexOf('考试日期')
        };
        if (idx.class === -1 || idx.name === -1 || idx.id === -1 || idx.subject === -1 || idx.score === -1) {
            alert('表头必须包含：班级,姓名,学号,科目,成绩');
            return;
        }
        let success = 0, fail = 0;
        const errors = [];
        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map(c => c.trim());
            if (cols.length < 5) continue;
            const className = cols[idx.class];
            const studentName = cols[idx.name];
            const studentId = cols[idx.id];
            const subject = cols[idx.subject];
            const score = parseFloat(cols[idx.score]);
            const examDate = cols[idx.date] || AdminState.currentExamDate || '';
            if (!className || !studentName || !studentId || !subject || isNaN(score)) {
                fail++;
                errors.push(`第${i+1}行：数据不完整`);
                continue;
            }
            try {
                await API.admin.addScore({ className, studentName, studentId, subject, score, examDate });
                success++;
            } catch (err) {
                fail++;
                errors.push(`第${i+1}行：${err.message || '添加失败'}`);
            }
        }
        alert(`导入完成：成功 ${success} 条，失败 ${fail} 条。${errors.length ? '\n错误详情：\n' + errors.slice(0,5).join('\n') : ''}`);
        renderScoreAll();
    };
    reader.readAsText(file, 'UTF-8');
}

// ---------- 初始化 ----------
async function init() {
    await loadBaseData();
    const header = AdminRender.headerInfo();
    document.querySelector('.user-avatar').innerText = header.avatar;
    document.querySelector('.user-info span').innerText = header.name;
    bindGlobalEvents();
    switchSection('dashboard');
    
    // 退出登录
    document.getElementById('logoutBtn')?.addEventListener('click', () => API.logout());
}

init();