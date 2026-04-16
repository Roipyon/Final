// 教务端主入口 

import { AdminState, filterScores, sortScores, getAvailableSortFields } from './state.js';
import { AdminRender } from './render.js';
import { NoticeCard } from '../common/components/NoticeCard.js';
import { openFilterDrawer, closeFilterDrawer, createFilterDrawer } from '../common/filterDrawer.js';
import { WSClient } from '../common/websocket.js';
import { Modal } from '../common/components/Modal.js';

let currentSection = 'dashboard';

// 数据加载 
async function loadBaseData() {

    // 获取全量班级（用于下拉框筛选），一次性取足够大的 pageSize
    const classesRes = await API.admin.getClasses({ pageSize: 1000 });
    const allClasses = classesRes.data;   // 全量班级数据

    const [info, teachers, grades, exams, notices, logs, subjects] = await Promise.all([
        API.admin.getInfo(),
        API.admin.getTeachers(),
        API.admin.getGrades(),
        API.admin.getExams(),
        API.admin.getNotices({ page: 1, pageSize: 10 }),
        API.admin.getLogs(1, AdminState.logsPerPage),
        API.admin.getSubjects(),
    ]);
    AdminState.currentAdmin = info;
    AdminState.classes = allClasses;
    AdminState.allTeachers = teachers;
    AdminState.gradeList = grades;
    AdminState.examList = exams;
    AdminState.allNotices = notices.data;
    AdminState.systemLogs = logs.logs;
    AdminState.logTotal = logs.total;
    AdminState.allSubjects = subjects;
    AdminState.globalClassFilter = '所有班级';
    AdminState.noticesTotalCount = notices.total;
    if (!AdminState.allSubjects.includes(AdminState.globalSubjectFilter)) {
        AdminState.globalSubjectFilter = AdminState.allSubjects[0] || '数学';
    }
}

async function loadScoresData() {
    const isTotal = AdminState.globalSubjectFilter === '总分';
    
    const params = {
        exam_date: AdminState.currentExamDate,
        class_name: AdminState.globalClassFilter,
        page: AdminState.scoresCurrentPage,
        pageSize: AdminState.scoresPageSize,
        sortField: AdminState.currentSortField,
        sortOrder: AdminState.currentSortOrder
    };

    let res;
    if (isTotal) {
        res = await API.admin.getTotalScores(params);
        // 统一数据格式：每个 item 都有 score 字段
        AdminState.allScores = res.data.map(item => ({ 
            ...item, 
            score: parseFloat(item.total_score) || 0 
        }));
        AdminState.currentStats = {
            avg: res.stats.avg,
            max: res.stats.max,
            min: res.stats.min,
            totalStu: res.stats.totalStu,
            passCount: '-',
            passRate: '-'
        };
    } else {
        params.subject = AdminState.globalSubjectFilter;
        res = await API.admin.getScores(params);
        AdminState.allScores = res.data.map(s => ({ 
            ...s, 
            score: parseFloat(s.score) || 0 
        }));
        AdminState.currentStats = res.stats;
    }
    
    AdminState.scoresTotalCount = res.total;
    AdminState.hasExamDate = res.hasExamDate;
}

async function renderScoreAll() {
    const isTotal = AdminState.globalSubjectFilter === '总分';
    if (isTotal && !AdminState.currentExamDate) {
        const firstSubject = AdminState.allSubjects.find(s => s !== '总分') || '数学';
        AdminState.globalSubjectFilter = firstSubject;
        return renderScoreAll();
    }

    const section = document.getElementById('scoreAllSection');
    
    section.innerHTML = `
        <h3>全量成绩管理 (跨班级)</h3>
        ${AdminRender.filterBar()}
        ${AdminRender.statsCardsSkeleton(isTotal)}
        ${AdminRender.scoreTableSkeleton(8)}
    `;

    await loadScoresData();
    
    const displayData = filterScores(AdminState.allScores, isTotal);
    const stats = AdminState.currentStats;
    const hasExamDate = !!AdminState.currentExamDate;
    const sortedData = sortScores(displayData, isTotal, hasExamDate);

    const totalPages = Math.ceil(AdminState.scoresTotalCount / AdminState.scoresPageSize);
    const paginationHTML = renderSmartPagination(AdminState.scoresCurrentPage, totalPages);
    
    const statsHTML = AdminState.hasExamDate 
    ? AdminRender.statsCards(AdminState.currentStats, isTotal)
    : '<div class="empty-stats-tip">请选择具体考试批次以查看统计数据</div>';

    section.innerHTML = `
        <h3>全量成绩管理 (跨班级)</h3>
        <button class="mobile-filter-btn" id="mobileFilterBtn">
            <span>筛选条件</span>
            <i>▼</i>
        </button>
        ${AdminRender.filterBar()}
        ${statsHTML}
        <div class="table-wrapper">
            ${AdminRender.scoreTable(sortedData, isTotal, hasExamDate)}
        </div>
        ${paginationHTML}
    `;

    document.getElementById('mobileFilterBtn')?.addEventListener('click', () => {
        const filterBar = document.querySelector('.filter-bar');
        if (!filterBar) return;

        openFilterDrawer(filterBar.innerHTML, {
            onApply: (body) => {
                // 同步筛选值到 AdminState
                const examSelect = body.querySelector('#examSelect');
                if (examSelect) AdminState.currentExamDate = examSelect.value;
                const classFilter = body.querySelector('#classFilterAll');
                if (classFilter) AdminState.globalClassFilter = classFilter.value;
                const subjectFilter = body.querySelector('#subjectFilterAll');
                if (subjectFilter) AdminState.globalSubjectFilter = subjectFilter.value;
                const searchInput = body.querySelector('#searchInput');
                if (searchInput) AdminState.currentSearchKeyword = searchInput.value;
                const sortField = body.querySelector('#sortFieldSelect');
                if (sortField) AdminState.currentSortField = sortField.value;
                
                renderScoreAll();
            },
            onReset: () => {
                AdminState.currentExamDate = '';
                AdminState.globalSubjectFilter = AdminState.allSubjects[0] || '数学';
                AdminState.globalClassFilter = '所有班级';
                AdminState.currentSearchKeyword = '';
                AdminState.currentSortField = 'className';
                AdminState.currentSortOrder = 'asc';
                renderScoreAll();
            }
        });
    });

    // 重新绑定筛选栏事件
    bindFilterBarEvents();
    updateSortButtonText();
}

// 绑定筛选栏事件（因为重复渲染需要解绑/重绑）
function bindFilterBarEvents() {
    const examSelect = document.getElementById('examSelect');
    const classFilter = document.getElementById('classFilterAll');
    const subjectFilter = document.getElementById('subjectFilterAll');
    const sortField = document.getElementById('sortFieldSelect');
    const sortOrderBtn = document.getElementById('toggleSortOrderBtn');
    
    if (examSelect) examSelect.value = AdminState.currentExamDate || '';
    if (classFilter) classFilter.value = AdminState.globalClassFilter;
    if (subjectFilter) subjectFilter.value = AdminState.globalSubjectFilter;
    if (sortOrderBtn) sortOrderBtn.textContent = AdminState.currentSortOrder === 'asc' ? '↑' : '↓';
}

// 总览看板 
async function renderDashboard() {
    const section = document.getElementById('dashboardSection');
    
    // 骨架屏
    section.innerHTML = AdminRender.dashboardSkeleton();
    
    const noticeData = await API.admin.getNotices({ page: 1, pageSize: 3 }); // 最新3条
    const notices = noticeData.data;
    const logsData = await API.admin.getLogs(1, 3);
    const logs = logsData.logs;

    AdminState.allNotices = notices;
    AdminState.systemLogs = logs;

    const classes = AdminState.classes;
    
    // 真实渲染
    const totalClasses = classes.length;
    const totalStudents = classes.reduce((sum, c) => sum + (c.studentCount || 0), 0);
    const totalNotices = AdminState.noticesTotalCount;
    const latestNotices = [...notices]
        .sort((a, b) => new Date(b.publishTime) - new Date(a.publishTime))
        .slice(0, 3);
    
    const noticeContainer = document.createElement('div');
    latestNotices.forEach(notice => {
        const card = new NoticeCard(notice, {
            expandable: false,          // 首页不展开
            showActions: false,         // 无操作按钮
            badgeMode: 'admin'
        });
        card.mount(noticeContainer);
    });
    const noticeHtml = noticeContainer.innerHTML;
    
    const logRows = logs.slice(0, 3).map(l => `
        <tr><td>${escapeHtml(l.operator)}</td><td>${escapeHtml(l.operationType)}</td><td>${escapeHtml(l.content)}</td><td>${formatDateTime(l.operateTime)}</td></tr>
    `).join('');
    
    section.innerHTML = `
        <h3 style="margin-bottom:10px;">教务总览看板</h3>
        <p>欢迎 ${escapeHtml(AdminState.currentAdmin?.name || '')}，全校教学数据实时监控。</p>
        <div class="stats-grid">
            <div class="stat-card"><div class="stat-value">${totalClasses}</div><div>班级总数</div></div>
            <div class="stat-card"><div class="stat-value">${totalStudents}</div><div>在校学生</div></div>
            <div class="stat-card"><div class="stat-value">${AdminState.allTeachers.length}</div><div>在职教师</div></div>
            <div class="stat-card"><div class="stat-value">${totalNotices}</div><div>班级通知</div></div>
        </div>
        <div style="margin-top:24px;">
            <h4 style="margin-bottom:10px;">最新通知</h4>
            <div>${noticeHtml || '<div class="empty-tip">暂无通知</div>'}</div>
            <div style="text-align:right;"><a href="#" data-nav="noticeAll" class="nav-link">查看全部 →</a></div>
        </div>
        <div style="margin-top:12px;">
            <h4 style="margin-bottom:10px;">最近操作日志</h4>
            <div class="table-wrapper">
                <table class="table"><thead><tr><th>操作人</th><th>类型</th><th>内容</th><th>时间</th></tr></thead><tbody>${logRows}</tbody></table>
            </div>
                <div style="text-align:right;"><a href="#" data-nav="systemLog" class="nav-link">查看全部日志 →</a></div>
        </div>
    `;
    
    document.querySelectorAll('#dashboardSection .recent-notice-item').forEach(el => {
        el.addEventListener('click', () => switchSection('noticeAll'));
    });
}

// 班级管理 
async function renderClassManage() {
    const section = document.getElementById('classManageSection');
    section.innerHTML = AdminRender.classManageSkeleton();

    const params = {
        page: AdminState.classesCurrentPage,
        pageSize: AdminState.classesPageSize
    };
    const res = await API.admin.getClasses(params);
    AdminState.classes = res.data;
    AdminState.classesTotal = res.total;
    
    // 生成班级卡片 HTML
    let classListHtml = '';
    for (let c of AdminState.classes) {
        // 学生列表容器，初始为空，点击后加载
        const studentContainerId = `student-list-${c.id}`;
        
        let teacherOptions = '<option value="">-- 绑定教师 --</option>';
        AdminState.allTeachers.forEach(t => {
            const selected = c.teacherId === t.id ? 'selected' : '';
            teacherOptions += `<option value="${t.id}" ${selected}>${escapeHtml(t.name)}</option>`;
        });

        classListHtml += `
            <div class="class-card" style="border:1px solid #ddd; border-radius:12px; padding:16px; margin-bottom:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong>${escapeHtml(c.className)}</strong> (${c.studentCount}人) 
                        班主任: ${escapeHtml(c.teacher || '未绑定')}
                        <button class="btn-sm toggle-student-btn" data-class-id="${c.id}" data-loaded="false">
                            ▼ 展开学生
                        </button>
                    </div>
                    <div>
                        <select class="bind-teacher-select" data-classid="${c.id}">${teacherOptions}</select>
                        <button class="btn-sm btn-danger delete-class-btn" data-id="${c.id}">删除班级</button>
                        <button class="btn-sm edit-class-btn" data-id="${c.id}" data-name="${escapeHtml(c.rawClassName)}" data-grade-id="${c.gradeId}">编辑</button>
                        <button class="btn-sm btn-primary add-student-btn" data-class-id="${c.id}">+ 添加学生</button>
                    </div>
                </div>
                <div id="${studentContainerId}" class="student-list-container" style="margin-top:16px; display:none;">
                    <div class="skeleton">加载中...</div>
                </div>
            </div>
        `;
    }
    
    let teacherPoolHtml = '';
    AdminState.allTeachers.forEach(t => {
        teacherPoolHtml += `<span style="display:inline-block; background:#f0f0f0; padding:4px 12px; border-radius:20px; margin:4px;">${escapeHtml(t.name)}</span>`;
    });

    const totalPages = Math.ceil(AdminState.classesTotal / AdminState.classesPageSize);
    const paginationHTML = renderSmartPagination(AdminState.classesCurrentPage, totalPages);
    
    const html = `
        <h3>班级管理与教师绑定</h3>
        <div class="card" style="display:flex;flex-direction:column;justify-content:center;align-items:center;background:#f9f9f9;padding:16px;margin-bottom:12px;">
            <h4 style="margin:10px 0;">新增班级</h4>
            <button id="openAddClassBtn" class="btn-primary">+ 新增班级</button>
        </div>
        <h4>现有班级列表</h4>
        <div id="classListContainer" style="margin: 10px 0;">${classListHtml || '<div class="empty-tip">暂无班级</div>'}</div>
        ${paginationHTML}
        <h4 style="margin-bottom:10px;">教师池管理</h4>
        <button id="openAddTeacherBtn" class="btn-sm">+ 添加教师</button>
        <div style="margin-top:12px;">${teacherPoolHtml}</div>
    `;
    section.innerHTML = html;

    // 绑定展开/收起学生事件
    section.addEventListener('click', async (e) => {
        // 处理展开/收起学生
        const toggleBtn = e.target.closest('.toggle-student-btn');
        if (toggleBtn) {
            const classId = toggleBtn.dataset.classId;
            const container = document.getElementById(`student-list-${classId}`);
            const isLoaded = toggleBtn.dataset.loaded === 'true';

            if (container.style.display === 'none') {
                container.style.display = 'block';
                toggleBtn.textContent = '▲ 收起学生';

                if (!isLoaded) {
                    try {
                        const students = await API.request(`/admin/classes/${classId}/students`);
                        const classData = AdminState.classes.find(c => c.id == classId);
                        if (classData) classData.students = students;

                        let studentHtml = '';
                        students.forEach(s => {
                            studentHtml += `
                                <div class="student-item" style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #eee;">
                                    <span>${escapeHtml(s.name)} (${escapeHtml(s.studentId)})</span>
                                    <button class="btn-sm btn-danger delete-student-btn" data-class-id="${classId}" data-student-id="${s.id}">删除</button>
                                </div>
                            `;
                        });
                        container.innerHTML = studentHtml || '<div class="empty-tip">暂无学生</div>';
                        toggleBtn.dataset.loaded = 'true';
                    } catch (err) {
                        container.innerHTML = '<div class="empty-tip">加载失败</div>';
                    }
                }
            } else {
                container.style.display = 'none';
                toggleBtn.textContent = '▼ 展开学生';
            }
            return; // 处理完展开就结束
        }

        // 处理删除学生
        const deleteBtn = e.target.closest('.delete-student-btn');
        if (deleteBtn) {
            e.preventDefault();
            e.stopPropagation();
            const classId = deleteBtn.dataset.classId;
            const studentId = deleteBtn.dataset.studentId;

            const confirmed = await Modal.confirm('确定删除该学生吗？');
            if (!confirmed) return;

            try {
                await API.admin.deleteStudent(classId, studentId);
                
                // 重新获取该班级学生列表并刷新容器
                const container = document.getElementById(`student-list-${classId}`);
                if (container) {
                    const students = await API.request(`/admin/classes/${classId}/students`);
                    const classData = AdminState.classes.find(c => c.id == classId);
                    if (classData) classData.students = students;

                    let html = '';
                    students.forEach(s => {
                        html += `
                            <div class="student-item" style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #eee;">
                                <span>${escapeHtml(s.name)} (${escapeHtml(s.studentId)})</span>
                                <button class="btn-sm btn-danger delete-student-btn" data-class-id="${classId}" data-student-id="${s.id}">删除</button>
                            </div>
                        `;
                    });
                    container.innerHTML = html || '<div class="empty-tip">暂无学生</div>';
                }

                // 更新班级卡片上显示的学生人数
                const card = deleteBtn.closest('.class-card');
                if (card) {
                    const strongEl = card.querySelector('strong');
                    if (strongEl) {
                        const text = strongEl.nextSibling?.textContent || '';
                        const match = text.match(/\((\d+)人\)/);
                        if (match) {
                            const newCount = parseInt(match[1]) - 1;
                            strongEl.nextSibling.textContent = text.replace(/\d+/, newCount);
                        }
                    }
                }
                Modal.alert('删除成功');
            } catch (err) {
                Modal.alert(err.message || '删除失败');
            }
            return;
        }
    });
    
    // 绑定事件
    document.getElementById('openAddClassBtn')?.addEventListener('click', openAddClassModal);
    document.getElementById('openAddTeacherBtn')?.addEventListener('click', openAddTeacherModal);
    
    document.querySelectorAll('.bind-teacher-select').forEach(sel => {
        sel.addEventListener('change', async (e) => {
            const classId = sel.dataset.classid;
            const teacherId = e.target.value || null;
            try {
                await API.admin.bindTeacher(classId, teacherId);
                renderClassManage();
            } catch (err) {
                Modal.alert(err.message || '绑定失败');
}
        });
    });
    
    document.querySelectorAll('.delete-class-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const confirmed = await Modal.confirm('确定删除该班级吗？所有学生关联将被移除。')
            if (confirmed) {
                await API.admin.deleteClass(btn.dataset.id);
                renderClassManage();
                renderDashboard();
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

// 全量通知 
async function renderNoticeAll() {
    const section = document.getElementById('noticeAllSection');
    section.innerHTML = AdminRender.noticeAllSkeleton();

    const params = {
        page: AdminState.noticesCurrentPage,
        pageSize: AdminState.noticesPageSize,
        class_name: AdminState.globalClassFilter === '所有班级' ? 'all' : AdminState.globalClassFilter
    };
    
    const res = await API.admin.getNotices(params);
    AdminState.allNotices = res.data;          // 当前页的通知数据
    AdminState.noticesTotal = res.total;       // 符合条件的总通知数
        
    let filterHtml = '<select id="classFilterNotice" class="filter-select"><option value="all">所有班级</option>';
    AdminState.classes.forEach(c => {
        const selected = AdminState.globalClassFilter === c.className ? 'selected' : '';
        filterHtml += `<option value="${escapeHtml(c.className)}" ${selected}>${escapeHtml(c.className)}</option>`;
    });
    filterHtml += '</select>';
    
    const totalPages = Math.ceil(AdminState.noticesTotal / AdminState.noticesPageSize);
    const paginationHTML = renderSmartPagination(AdminState.noticesCurrentPage, totalPages);

    const html = `
        <h3 style="margin-bottom:10px;">全校班级通知</h3>
        <div class="filter-bar">${filterHtml}</div>
        <div id="noticeListContainer"></div>
        ${paginationHTML}
    `;
    section.innerHTML = html;
    
    const container = document.getElementById('noticeListContainer');
    
    // 渲染卡片函数（复用）
    const renderCards = (notices) => {
        container.innerHTML = '';
        if (!notices.length) {
            container.innerHTML = '<div class="empty-tip">暂无通知</div>';
            return;
        }
        notices.forEach(notice => {
            const card = new NoticeCard(notice, {
                expandable: true,
                showActions: false,    // 管理员无操作按钮
                badgeMode: 'admin'
            });
            card.mount(container);
        });
    };

    renderCards(AdminState.allNotices);
}

// 系统日志
async function renderSystemLog() {
    const section = document.getElementById('systemLogSection');
    section.innerHTML = AdminRender.systemLogSkeleton();

    const data = await API.admin.getLogs(AdminState.currentLogPage, AdminState.logsPerPage);
    AdminState.logTotal = data.total;
    const logs = data.logs;
    const totalPages = Math.ceil(data.total / AdminState.logsPerPage);
    
    const rows = logs.map(l => `
        <tr><td>${escapeHtml(l.operator)}</td><td>${escapeHtml(l.operationType)}</td><td>${escapeHtml(l.content)}</td><td>${formatDateTime(l.operateTime)}</td></tr>
    `).join('');
    
    const paginationHTML = renderSmartPagination(AdminState.currentLogPage, totalPages);
    
    const html = `
        <h3 style="margin-bottom:10px;">系统操作日志</h3>
        <div class="table-wrapper">
            <table class="table"><thead><tr><th>操作人</th><th>类型</th><th>内容</th><th>时间</th></tr></thead><tbody>${rows}</tbody></table>
        </div>
        ${paginationHTML}
    `;
    document.getElementById('systemLogSection').innerHTML = html;
    
    const debouncedRenderLog = debounce(()=>{
        renderSystemLog();
    }, 200)

    document.querySelectorAll('#systemLogSection .page-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            AdminState.currentLogPage = parseInt(btn.dataset.page);
            debouncedRenderLog();
        });
    });
}

// 模块切换
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

// 全局事件绑定
function bindGlobalEvents() {
    // 导航链接点击
    document.addEventListener('click', async(e) => {
        // 侧边栏和页面内导航
        if (e.target.matches('.sidebar-menu a, .nav-link')) {
            e.preventDefault();
            const nav = e.target.dataset.nav;
            if (nav) switchSection(nav);
        }

        // 成绩页面操作
        if (currentSection === 'scoreAll') {
            if (e.target.id === 'searchBtn') {
                const input = document.getElementById('searchInput');
                if (input) {
                    AdminState.currentSearchKeyword = input.value;
                    renderScoreAll();
                }
            } else if (e.target.classList.contains('edit-score-btn')) {
                const id = parseInt(e.target.dataset.id);
                AdminState.currentEditScoreId = id;
                document.getElementById('editScoreStudentName').value = e.target.dataset.name;
                document.getElementById('editScoreSubject').value = AdminState.globalSubjectFilter;
                document.getElementById('editScoreValue').value = e.target.dataset.score;
                document.getElementById('editScoreAdminModal').style.display = 'flex';
            } else if (e.target.classList.contains('delete-score-btn')) {
                const confirmed = await Modal.confirm('确定删除？');
                if (confirmed) {
                    API.admin.deleteScore(e.target.dataset.id).then(() => renderScoreAll());
                }
            } else if (e.target.id === 'exportAllBtn') {
                exportCSV();
            } else if (e.target.id === 'addScoreAllBtn') {
                openAddScoreModal();
            } else if (e.target.id === 'batchImportAllBtn') {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.csv';
                input.onchange = handleFileSelect;
                input.click();
            } else if (e.target.id === 'downloadTemplateBtn') {
                const csv = '班级,姓名,学号,科目,成绩,考试日期(可选)\n高一1班,张三,2024001,数学,85,2026-04-12';
                const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = '成绩导入模板.csv';
                a.click();
            }
        }

        const debouncedRenderNotice = debounce(()=>{
            renderNoticeAll();
        }, 200);
        const debouncedRenderScore = debounce(()=>{
            renderScoreAll();
        }, 200);

        if (e.target.classList.contains('page-btn') && currentSection === 'noticeAll') {
            const page = parseInt(e.target.dataset.page);
            if (page && page !== AdminState.noticesCurrentPage) {
                AdminState.noticesCurrentPage = page;
                debouncedRenderNotice();
            }
        }

        if (e.target.classList.contains('page-btn') && currentSection === 'scoreAll') {
            const page = parseInt(e.target.dataset.page);
            if (page && page !== AdminState.scoresCurrentPage) {
                AdminState.scoresCurrentPage = page;
                debouncedRenderScore();
            }
        }

        if (e.target.classList.contains('page-btn') && currentSection === 'classManage') {
            const page = parseInt(e.target.dataset.page);
            if (page && page !== AdminState.classesCurrentPage) {
                AdminState.classesCurrentPage = page;
                renderClassManage();
            }
        }

        // 模态框遮罩关闭
        if (e.target.classList.contains('modal-mask')) {
            e.target.style.display = 'none';
        }
    });

    const debounceSearch = debounce(()=>{
        if (currentSection === 'scoreAll') renderScoreAll();
    }, 500);

    // 搜索框回车
    document.addEventListener('keypress', (e) => {
        if (e.target.id === 'searchInput' && e.key === 'Enter') {
            AdminState.currentSearchKeyword = e.target.value;
            debounceSearch();
        }
    });

    // 下拉筛选和排序字段变更（事件委托）
    document.addEventListener('change', (e) => {
        // 全量通知的班级筛选
        if (e.target.id === 'classFilterNotice') {
            AdminState.globalClassFilter = e.target.value;
            AdminState.noticesCurrentPage = 1;
            renderNoticeAll();
            return;
        }

        if (currentSection !== 'scoreAll') return;

        const target = e.target;
        if (target.id === 'classFilterAll') {
            AdminState.globalClassFilter = target.value;
            AdminState.scoresCurrentPage = 1;
            renderScoreAll();
        } else if (target.id === 'subjectFilterAll') {
            AdminState.globalSubjectFilter = target.value;
            // 自动调整默认排序方向
            if (AdminState.globalSubjectFilter === '总分') {
                AdminState.currentSortField = 'totalScore';
                AdminState.currentSortOrder = 'desc';
            } else {
                AdminState.currentSortField = 'className';
                AdminState.currentSortOrder = 'asc';
            }
            renderScoreAll();
        } else if (target.id === 'examSelect') {
            AdminState.currentExamDate = target.value;
            AdminState.currentSortField = 'className';
            AdminState.currentSortOrder = 'asc';
            renderScoreAll();
        } else if (target.id === 'sortFieldSelect') {
            AdminState.currentSortField = target.value;
            renderScoreAll();
        }
    });

    // 排序方向切换按钮
    document.addEventListener('click', (e) => {
        if (e.target.id === 'toggleSortOrderBtn' && currentSection === 'scoreAll') {
            AdminState.currentSortOrder = AdminState.currentSortOrder === 'asc' ? 'desc' : 'asc';
            renderScoreAll();
        }
        // 通知卡片展开/收起
        if (e.target.closest('.notice-summary')) {
            const noticeItem = e.target.closest('.notice-item');
            noticeItem.classList.toggle('expanded');
        }
    });
}

function closeModal(id) { document.getElementById(id).style.display = 'none'; }

async function openAddScoreModal() {
    const classSelect = document.getElementById('addScoreClass');
    classSelect.innerHTML = '<option value="">请选择班级</option>';
    AdminState.classes.forEach(c => {
        classSelect.innerHTML += `<option value="${escapeHtml(c.className)}">${escapeHtml(c.className)}</option>`;
    });
    
    // 科目输入框预填当前筛选科目（总分除外）
    document.getElementById('addScoreSubject').value = AdminState.globalSubjectFilter === '总分' ? '' : AdminState.globalSubjectFilter;
    
    const datalist = document.getElementById('subjectOptions');
    datalist.innerHTML = '';
    AdminState.allSubjects.forEach(sub => {
        if (sub !== '总分') {
            datalist.innerHTML += `<option value="${escapeHtml(sub)}">`;
        }
    });

    // 填充考试批次下拉框
    const examSelect = document.getElementById('addScoreExamDate');
    examSelect.innerHTML = '<option value="">默认(当天)</option>';
    AdminState.examList.forEach(dateStr => {
        examSelect.innerHTML += `<option value="${dateStr}">${dateStr}</option>`;
    });
    // 如果当前有选中的考试批次，则默认选中
    if (AdminState.currentExamDate) {
        examSelect.value = AdminState.currentExamDate;
    }
    
    // 清空其他字段
    document.getElementById('addScoreStudentName').value = '';
    document.getElementById('addScoreStudentId').value = '';
    document.getElementById('addScoreValue').value = '';
    document.getElementById('addScoreModal').style.display = 'flex';
}

async function confirmAddScore() {
    const btn = document.getElementById('confirmAddScoreBtn');
    if (!btn) return;
    try {
        await withLock(btn, async()=>{
            const className = document.getElementById('addScoreClass').value;
            const studentName = document.getElementById('addScoreStudentName').value.trim();
            const studentId = document.getElementById('addScoreStudentId').value.trim();
            let subject = document.getElementById('addScoreSubject').value.trim();
            const score = parseFloat(document.getElementById('addScoreValue').value);
            const examDate = document.getElementById('addScoreExamDate').value;

            if (!className || !studentName || !studentId || !subject) {
                Modal.alert('请完整填写');
                return;
            }
            if (subject === '总分') {
                Modal.alert('总分由系统自动计算，不可手动添加');
                return;
            }
            // 满分校验
            const fullRes = await API.request('/admin/fullmark', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subject })
            });
            const fullMark = fullRes.full_mark || 100;
            if (isNaN(score) || score < 0 || score > fullMark) {
                Modal.alert(`成绩必须在 0-${fullMark} 之间`);
                return;
            }
            await API.admin.addScore({ className, studentName, studentId, subject, score, examDate });
            closeModal('addScoreModal');
            renderScoreAll();
            if (currentSection === 'dashboard') renderDashboard();
        }, { loadingText: '添加中...', successText: '添加成功' });
    } catch (err) {
        Modal.alert(err.message);
    }
}

async function confirmEditScore() {
    const btn = document.getElementById('confirmEditScoreAdminBtn');
    if (!btn) return;
    try {
        await withLock(btn, async()=>{
            const newScore = parseFloat(Number(document.getElementById('editScoreValue').value).toFixed(1));
            const id = AdminState.currentEditScoreId;
            
            const scoreItem = AdminState.allScores.find(s => s.id === id);
            if (!scoreItem) {
                Modal.alert("成绩记录不存在");
                return;
            }
            
            if (scoreItem.subject === '总分') {
                Modal.alert("总分由系统自动计算，不可手动修改");
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
                if (isNaN(newScore) || newScore < 0 || newScore > fullMark) {
                    Modal.alert(`请输入有效的成绩 (0-${fullMark})`);
                    return;
                }
            } catch (e) {
                // 降级：如果满分接口失败，仍允许提交
                console.warn('获取满分失败，跳过范围校验');
            }
            
            const result = await API.admin.updateScore(id, newScore);
            if (result.success) {
                Modal.alert("成绩已更新");
                closeModal('editScoreAdminModal');
                
                const freshScores = await API.admin.getScores(AdminState.currentExamDate);
                AdminState.allScores = freshScores.data.map(s => ({ ...s, score: parseFloat(s.score) || 0 }));
                
                const subjectSet = new Set();
                AdminState.allScores.forEach(s => subjectSet.add(s.subject));
                subjectSet.add('总分');
                AdminState.allSubjects = Array.from(subjectSet).sort();
                
                await renderScoreAll();
                
                if (currentSection === 'dashboard') {
                    renderDashboard();
                }
            } else {
                Modal.alert(result.message || "修改失败");
                return;
            }
        }, { loadingText: '修改中...', successText: '修改成功' });
    } catch (err) {
        Modal.alert(err.message);
    }
}

async function confirmAddClass() {
    const btn = document.getElementById('confirmAddClassBtn');
    if (!btn) return;
    try {
        await withLock(btn, async()=>{
            const name = document.getElementById('addClassName').value.trim();
            const gradeId = document.getElementById('addClassGradeId').value;
            if (name) {
                await API.admin.addClass(name, gradeId);
                closeModal('addClassModal');
                renderClassManage();
            } else {
                Modal.alert('班级名称不能为空');
                return;
            }
        }, { loadingText: '添加中...', successText: '添加成功' }); 
    } catch (err) {
        Modal.alert(err.message);
    }
}

async function confirmEditClass() {
    const btn = document.getElementById('confirmEditClassBtn');
    if (!btn) return;
    try {
        await withLock(btn, async()=>{
            const name = document.getElementById('editClassName').value.trim();
            const gradeId = document.getElementById('editClassGradeId').value;
            if (name) {
                await API.admin.updateClass(AdminState.currentEditClassId, name, gradeId);
                closeModal('editClassModal');
                renderClassManage();
            } else {
                Modal.alert('班级名称不能为空');
                return;
            }
        }, { loadingText: '修改中...', successText: '修改成功' });
    } catch (err) {
        Modal.alert(err.message);
    }
}

async function confirmAddStudent() {
    const btn = document.getElementById('confirmAddStudentBtn');
    if (!btn) return;
    try {
        await withLock(btn, async()=>{
            const name = document.getElementById('studentName').value.trim();
            const studentId = document.getElementById('studentId').value.trim();
            const classId = AdminState.currentAddStudentClassId;

            if (!name || !studentId) {
                Modal.alert('学生姓名和学号不能为空');
                return;
            }

            await API.admin.addStudent(classId, name, studentId);
            closeModal('addStudentModal');

            // 局部刷新：仅更新该班级的学生列表
            const container = document.getElementById(`student-list-${classId}`);
            if (container) {
                // 重新获取学生数据
                const students = await API.request(`/admin/classes/${classId}/students`);
                // 更新缓存
                const classData = AdminState.classes.find(c => c.id == classId);
                if (classData) {
                    classData.students = students;
                    classData.studentCount = students.length;
                }

                // 如果当前容器处于展开状态（display != 'none'），则刷新内容
                if (container.style.display !== 'none') {
                    let studentHtml = '';
                    students.forEach(s => {
                        studentHtml += `
                            <div class="student-item" style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #eee;">
                                <span>${escapeHtml(s.name)} (${escapeHtml(s.studentId)})</span>
                                <button class="btn-sm btn-danger delete-student-btn" data-class-id="${classId}" data-student-id="${s.id}">删除</button>
                            </div>
                        `;
                    });
                    container.innerHTML = studentHtml || '<div class="empty-tip">暂无学生</div>';
                }

                // 更新班级卡片上显示的学生人数
                const card = document.querySelector(`.class-card .toggle-student-btn[data-class-id="${classId}"]`)?.closest('.class-card');
                if (card) {
                    const strongEl = card.querySelector('strong');
                    if (strongEl && strongEl.nextSibling) {
                        strongEl.nextSibling.textContent = ` (${students.length}人) `;
                    }
                }
            }
            Modal.alert('添加成功');
        }, { loadingText: '添加中...', successText: '添加成功' });
    } catch (err) {
        Modal.alert(err.message);
    }
}

async function confirmAddTeacher() {
    const btn = document.getElementById('confirmAddTeacherBtn');
    if (!btn) return;
    try {
        await withLock(btn, async()=>{
            const name = document.getElementById('teacherName').value.trim();
            if (name) {
                await API.admin.addTeacher(name);
                AdminState.allTeachers = await API.admin.getTeachers();
                closeModal('addTeacherModal');
                renderClassManage();
            } else {
                Modal.alert('教师名称不能为空');
                return;
            }
        }, { loadingText: '添加中...', successText: '添加成功' });
    } catch (err) {
        Modal.alert(err.message);
    }
}

function updateSortButtonText() {
    const btn = document.getElementById('toggleSortOrderBtn');
    if (btn) btn.textContent = AdminState.currentSortOrder === 'asc' ? '↑' : '↓';
}

async function exportCSV() {
    const isTotal = AdminState.globalSubjectFilter === '总分';
    const params = {
        exam_date: AdminState.currentExamDate,
        class_name: AdminState.globalClassFilter,
        sortField: AdminState.currentSortField,
        sortOrder: AdminState.currentSortOrder,
        all: 'true'                 // 请求全量数据
    };
    if (!isTotal) {
        params.subject = AdminState.globalSubjectFilter;
    }

    let res;
    if (isTotal) {
        res = await API.admin.getTotalScores(params);
    } else {
        res = await API.admin.getScores(params);
    }

    const allData = res.data;
    // 应用搜索关键词过滤
    const filtered = filterScores(allData, isTotal);
    const hasExamDate = !!AdminState.currentExamDate;
    
    let csv = isTotal 
        ? '姓名,学号,' + (hasExamDate ? '' : '考试批次,') + '总分' + (hasExamDate ? ',总分排名,班级排名' : '') + '\n'
        : '班级,姓名,学号,' + (hasExamDate ? '' : '考试批次,') + '科目,成绩' + (hasExamDate ? ',年级排名,班级排名' : '') + '\n';
    
    filtered.forEach(item => {
        if (isTotal) {
            csv += `${item.studentName},${item.studentId},`;
            if (!hasExamDate) csv += `${formatDate(item.exam_date)},`;
            csv += `${item.score}`;
            if (hasExamDate) csv += `,${item.class_rank || ''},${item.class_rank_in_class || ''}`;
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

// 处理文件选择
async function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
        await importFromCSV(ev.target.result);
    };
    reader.readAsText(file, 'UTF-8');
}

// 简易 CSV 解析（处理引号内的逗号）
function parseCSVLine(line) {
    const result = [];
    let cell = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(cell.trim());
            cell = '';
        } else {
            cell += char;
        }
    }
    result.push(cell.trim());
    return result;
}

// 批量导入核心
async function importFromCSV(csvText) {
    const lines = csvText.trim().split('\n').filter(l => l.trim());
    if (lines.length < 2) {
        Modal.alert('CSV 至少需要表头和一行数据');
        return;
    }

    const headers = parseCSVLine(lines[0]);
    const idx = {
        class: headers.indexOf('班级'),
        name: headers.indexOf('姓名'),
        id: headers.indexOf('学号'),
        subject: headers.indexOf('科目'),
        score: headers.indexOf('成绩'),
        date: headers.indexOf('考试日期')
    };

    if (idx.class === -1 || idx.name === -1 || idx.id === -1 || idx.subject === -1 || idx.score === -1) {
        Modal.alert('表头必须包含：班级,姓名,学号,科目,成绩');
        return;
    }

    const validRows = [];
    const errors = [];

    // 第一遍：数据校验
    for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        if (cols.length < 5) continue;

        const className = cols[idx.class] || '';
        const studentName = cols[idx.name] || '';
        const studentId = cols[idx.id] || '';
        const subject = cols[idx.subject] || '';
        const score = parseFloat(cols[idx.score]);
        const examDate = cols[idx.date] || AdminState.currentExamDate || '';

        if (!className || !studentName || !studentId || !subject) {
            errors.push(`第${i+1}行：必填字段为空`);
        } else if (subject === '总分') {
            errors.push(`第${i+1}行：总分不可手动添加`);
        } else if (isNaN(score) || score < 0) {
            errors.push(`第${i+1}行：成绩必须为非负数字`);
        } else {
            validRows.push({ row: i+1, data: { className, studentName, studentId, subject, score, examDate } });
        }
    }

    if (validRows.length === 0) {
        Modal.alert(`无有效数据可导入\n${errors.slice(0,5).join('\n')}`);
        return;
    }

    // 第二遍：并发分批提交（每批 5 条）
    const BATCH_SIZE = 5;
    let success = 0;
    const failErrors = [];

    for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
        const batch = validRows.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
            batch.map(item => API.admin.addScore(item.data))
        );
        results.forEach((result, index) => {
            const row = batch[index].row;
            if (result.status === 'fulfilled') {
                success++;
            } else {
                failErrors.push(`第${row}行：${result.reason?.message || '添加失败'}`);
            }
        });
    }

    const totalFail = errors.length + failErrors.length;
    let message = `导入完成：成功 ${success} 条，失败 ${totalFail} 条。`;
    if (errors.length || failErrors.length) {
        message += '\n\n错误详情（前5条）：\n';
        message += [...errors, ...failErrors].slice(0, 5).join('\n');
    }
    Modal.alert(message);

    await renderScoreAll();
}

// 绑定所有模态框事件（静态按钮）
function bindModalEvents() {
    // 新增班级
    document.getElementById('cancelAddClassBtn')?.addEventListener('click', () => closeModal('addClassModal'));
    document.getElementById('confirmAddClassBtn')?.addEventListener('click', confirmAddClass);
    
    // 编辑班级
    document.getElementById('cancelEditClassBtn')?.addEventListener('click', () => closeModal('editClassModal'));
    document.getElementById('confirmEditClassBtn')?.addEventListener('click', confirmEditClass);
    
    // 添加学生
    document.getElementById('cancelAddStudentBtn')?.addEventListener('click', () => closeModal('addStudentModal'));
    document.getElementById('confirmAddStudentBtn')?.addEventListener('click', confirmAddStudent);
    
    // 添加教师
    document.getElementById('cancelAddTeacherBtn')?.addEventListener('click', () => closeModal('addTeacherModal'));
    document.getElementById('confirmAddTeacherBtn')?.addEventListener('click', confirmAddTeacher);
    
    // 添加成绩
    document.getElementById('cancelAddScoreBtn')?.addEventListener('click', () => closeModal('addScoreModal'));
    document.getElementById('confirmAddScoreBtn')?.addEventListener('click', confirmAddScore);
    
    // 编辑成绩
    document.getElementById('cancelEditScoreAdminBtn')?.addEventListener('click', () => closeModal('editScoreAdminModal'));
    document.getElementById('confirmEditScoreAdminBtn')?.addEventListener('click', confirmEditScore);
    
    // 遮罩层点击关闭
    document.querySelectorAll('.modal-mask').forEach(m => {
        m.addEventListener('click', (e) => {
            if (e.target === m) m.style.display = 'none';
        });
    });
}

// 初始化 
async function init() {
    await loadBaseData();
    const header = AdminRender.headerInfo();
    document.querySelector('.user-avatar').innerText = header.avatar;
    document.querySelector('.user-info span').innerText = header.name;
    bindGlobalEvents();
    bindModalEvents();
    switchSection('dashboard');
    
    // 退出登录
    document.getElementById('logoutBtn')?.addEventListener('click', () => API.logout());
    createFilterDrawer();

    const wsClient = new WSClient(AdminState.currentAdmin.id);
    wsClient.on('NEW_NOTICE', async () => {
        // 刷新全量通知数据
        AdminState.allNotices = await API.admin.getNotices();
        if (currentSection === 'noticeAll') renderNoticeAll();
        else if (currentSection === 'dashboard') renderDashboard();
    });
}

init();