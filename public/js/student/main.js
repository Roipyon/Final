// 学生端主入口
import { StudentState } from './state.js';
import { StudentRender } from './render.js';
import { NoticeCard } from '../common/components/NoticeCard.js';
import { openFilterDrawer, createFilterDrawer } from '../common/filterDrawer.js';

let currentSection = 'home';

// 数据加载 
async function loadBaseData() {
    const info = await API.student.getInfo();
    StudentState.currentStudent = info;
    StudentState.className = info.className;
    StudentState.classId = info.classId;
    
    const exams = await API.student.getExams();
    StudentState.examList = exams;
    
    const notices = await API.student.getNotices();
    StudentState.notices = notices;
}

async function refreshAllData(examDate = '') {
    const [scores, total, classStat] = await Promise.all([
        API.student.getGrade(examDate),
        API.student.getTotalRank(examDate),
        API.student.getClassStat(examDate)
    ]);
    StudentState.personalScores = scores;
    StudentState.personalTotal = total;
    StudentState.classStatBySubject = classStat;
    if (classStat.length && !classStat.find(s => s.subject === StudentState.currentSubjectFilter)) {
        StudentState.currentSubjectFilter = classStat[0].subject;
    }
}

function getUnreadCount() {
    return StudentState.notices.filter(n => !n.isRead).length;
}

function getFilteredSortedNotices() {
    let filtered = StudentState.notices;
    if (StudentState.noticeFilter === 'unread') {
        filtered = filtered.filter(n => !n.isRead);
    }
    filtered.sort((a, b) => {
        if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
        return new Date(b.publishTime) - new Date(a.publishTime);
    });
    return filtered;
}

// 标记已读 
async function markAsRead(noticeId) {
    const notice = StudentState.notices.find(n => n.id === noticeId);
    if (notice && !notice.isRead) {
        notice.isRead = true;
        updateUnreadBadge();
        try {
            await API.student.markNoticeRead(noticeId);
            // 成功，重新渲染当前模块
            if (currentSection === 'notice') renderNoticeModule();
            else if (currentSection === 'home') renderHomeModule();
        } catch (err) {
            // 回滚状态
            notice.isRead = false;
            updateUnreadBadge();
            alert('标记已读失败，请稍后重试');
        }
    }
}

function updateUnreadBadge() {
    const unread = getUnreadCount();
    document.querySelectorAll('.unread-badge').forEach(b => b.textContent = `${unread}条未读`);
}

// 首页 
function renderHomeModule() {
    const section = document.getElementById('homeSection');
    section.innerHTML = StudentRender.homeSkeleton();

    const unread = getUnreadCount();
    const sortedNotices = getFilteredSortedNotices();
    const topNotices = sortedNotices.slice(0, 3);
    const total = StudentState.personalTotal;
    
    const html = `
        <h3>学习概览</h3>
        <p>${escapeHtml(StudentState.currentStudent?.name)}同学，欢迎回来！</p>
        <div class="summary-flex" style="display:flex; gap:16px; margin:20px 0;">
            <div class="summary-card"><div class="summary-number">${total.total}</div><div>总分</div></div>
            <div class="summary-card"><div class="summary-number">${Number(total.totalAvg).toFixed(1)}</div><div>平均分</div></div>
            <div class="summary-card"><div class="summary-number">${total.totalRank}</div><div>班级排名</div></div>
        </div>
        <h4>近期成绩亮点</h4>
        <table class="table">
            <thead><tr><th>科目</th><th>成绩</th><th>班级均分</th><th>对比</th></tr></thead>
            <tbody>${StudentRender.scoreHighlightTable(StudentState.personalScores)}</tbody>
        </table>
        <div style="text-align:right;"><a href="#" data-nav="score" class="nav-link">查看全部成绩 →</a></div>
        
        <h4 style="margin-top:24px;">最新班级通知 <span class="badge unread-badge">${unread}条未读</span></h4>
        <div id="homeNoticeList"></div>
        <div style="text-align:right;"><a href="#" data-nav="notice" class="nav-link">查看全部通知 →</a></div>
    `;
    document.getElementById('homeSection').innerHTML = html;
    
    const homeNoticeContainer = document.getElementById('homeNoticeList');
    if (homeNoticeContainer) {
        homeNoticeContainer.innerHTML = '';
        const topNotices = getFilteredSortedNotices().slice(0, 3);
        topNotices.forEach(notice => {
            const isRead = notice.isRead === 1 || notice.isRead === true;
            const card = new NoticeCard(notice, {
                expandable: false,
                showActions: false,
                showReadStats: false,
                isUnread: !isRead
            });
            card.element.style.cursor = 'pointer';
            card.element.addEventListener('click', () => {
                markAsRead(notice.id);
                switchSection('notice');
            });
            card.mount(homeNoticeContainer);
        });
    }
}

// 成绩模块 
async function renderScoreModule() {
    const section = document.getElementById('scoreSection');
    section.innerHTML = StudentRender.scoreSkeleton();

    await refreshAllData(StudentState.currentExamDate);
    
    const stat = StudentState.classStatBySubject.find(s => s.subject === StudentState.currentSubjectFilter) || {};
    const examOptions = '<option value="">最新考试</option>' +
        StudentState.examList.map(d => `<option value="${d}" ${StudentState.currentExamDate === formatDate(d) ? 'selected' : ''}>${formatDate(d)}</option>`).join('');
    
    const subjectOptions = StudentState.classStatBySubject.map(s => 
        `<option value="${s.subject}" ${StudentState.currentSubjectFilter === s.subject ? 'selected' : ''}>${s.subject}</option>`
    ).join('');
    
    // 构建筛选栏 HTML，供移动端抽屉复用
    const filterBarHTML = `
        <select id="examSelect" class="filter-select">${examOptions}</select>
        <select id="subjectSelect" class="filter-select">${subjectOptions}</select>
    `;

    const html = `
        <div style="display:flex; justify-content:space-between;">
            <h3>我的成绩 · ${escapeHtml(StudentState.className)}</h3>
            <div class="filter-bar">
                ${filterBarHTML}
            </div>
        </div>
        <button class="mobile-filter-btn" id="mobileFilterBtn">
            <span>筛选</span>
            <i>▼</i>
        </button>
        <div class="table-wrapper">
            <table class="table">
                <thead><tr><th>科目</th><th>成绩</th><th>班级平均分</th><th>班级排名</th><th>对比均分</th></tr></thead>
                <tbody>${StudentRender.fullScoreTable(StudentState.personalScores)}</tbody>
            </table>
        </div>
        <h4 style="margin-top:24px;">班级统计数据 · ${StudentState.currentSubjectFilter}</h4>
        <div class="stats-grid">
            <div class="stat-card"><div class="stat-value">${stat.avg || '--'}</div><div>平均分</div></div>
            <div class="stat-card"><div class="stat-value">${stat.max || '--'}</div><div>最高分</div></div>
            <div class="stat-card"><div class="stat-value">${stat.min || '--'}</div><div>最低分</div></div>
            <div class="stat-card"><div class="stat-value">${stat.passCount || 0}/${stat.totalStu || 0}</div><div>及格人数</div></div>
            <div class="stat-card"><div class="stat-value">${stat.passRate || '0%'}</div><div>及格率</div></div>
        </div>
    `;
    section.innerHTML = html;
    
    document.getElementById('examSelect').addEventListener('change', async (e) => {
        StudentState.currentExamDate = formatDate(e.target.value);
        renderScoreModule();
        renderHomeModule();
    });
    document.getElementById('subjectSelect').addEventListener('change', (e) => {
        StudentState.currentSubjectFilter = e.target.value;
        renderScoreModule();
    });

    // 移动端筛选按钮
    document.getElementById('mobileFilterBtn')?.addEventListener('click', () => {
        const drawerContent = `
            <div style="display:flex; flex-direction:column; gap:16px;">
                ${filterBarHTML}
            </div>
        `;
        openFilterDrawer(drawerContent, {
            onApply: (body) => {
                const examSelect = body.querySelector('#examSelect');
                const subjectSelect = body.querySelector('#subjectSelect');
                if (examSelect) StudentState.currentExamDate = formatDate(examSelect.value);
                if (subjectSelect) StudentState.currentSubjectFilter = subjectSelect.value;
                renderScoreModule();
            },
            onReset: () => {
                StudentState.currentExamDate = '';
                StudentState.currentSubjectFilter = StudentState.classStatBySubject[0]?.subject || '';
                renderScoreModule();
            }
        });
    });
}

// 通知模块 
function renderNoticeModule() {
    const section = document.getElementById('noticeSection');
    section.innerHTML = StudentRender.noticeSkeleton();
    
    const filtered = getFilteredSortedNotices();
    const totalPages = Math.ceil(filtered.length / StudentState.noticesPerPage);
    if (StudentState.currentNoticePage > totalPages) {
        StudentState.currentNoticePage = Math.max(1, totalPages);
    }
    const start = (StudentState.currentNoticePage - 1) * StudentState.noticesPerPage;
    const pageNotices = filtered.slice(start, start + StudentState.noticesPerPage);

    const html = `
        <div style="display:flex; justify-content:space-between;">
            <h3>班级通知 <span class="badge unread-badge">${getUnreadCount()}条未读</span></h3>
            <div>
                <button class="filter-select ${StudentState.noticeFilter === 'all' ? 'active-filter' : ''}" data-filter="all">全部</button>
                <button class="filter-select ${StudentState.noticeFilter === 'unread' ? 'active-filter' : ''}" data-filter="unread">未读</button>
            </div>
        </div>
        <div id="noticeListContainer"></div>
        <div class="pagination" id="noticePagination"></div>
    `;
    document.getElementById('noticeSection').innerHTML = html;

    const container = document.getElementById('noticeListContainer');
    container.innerHTML = '';

    pageNotices.forEach(notice => {
        const isRead = notice.isRead === 1 || notice.isRead === true;
        const card = new NoticeCard(notice, {
            expandable: true,
            showActions: false,
            showReadStats: false,
            isUnread: !isRead,
            onExpand: (noticeId) => {
                if (!isRead) {
                    markAsRead(noticeId);
                    card.markAsRead();
                }
            }
        });
        card.mount(container);
    });

    // 渲染分页
    const paginationContainer = document.getElementById('noticePagination');
    if (totalPages > 1) {
        paginationContainer.innerHTML = Array.from({ length: totalPages }, (_, i) => `
            <button class="page-btn ${i + 1 === StudentState.currentNoticePage ? 'active-page' : ''}" data-page="${i + 1}">${i + 1}</button>
        `).join('');
    } else {
        paginationContainer.innerHTML = '';
    }

    // 绑定筛选按钮
    document.querySelectorAll('[data-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
            StudentState.noticeFilter = btn.dataset.filter;
            StudentState.currentNoticePage = 1;
            renderNoticeModule();
        });
    });

    // 绑定分页按钮
    document.querySelectorAll('#noticePagination .page-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            StudentState.currentNoticePage = parseInt(btn.dataset.page);
            renderNoticeModule();
        });
    });

    updateUnreadBadge();
}

// 模块切换 
async function switchSection(sectionId) {
    currentSection = sectionId;
    document.querySelectorAll('.sidebar-menu a').forEach(l => l.classList.remove('active'));
    document.querySelector(`[data-nav="${sectionId}"]`)?.classList.add('active');
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(`${sectionId}Section`)?.classList.add('active');
    
    const titles = { home: '学生首页', score: '我的成绩', notice: '班级通知' };
    document.getElementById('pageTitle').innerText = titles[sectionId] || '';
    
    switch (sectionId) {
        case 'home': renderHomeModule(); break;
        case 'score': await renderScoreModule(); break;
        case 'notice': renderNoticeModule(); break;
    }
    // 移动端关闭侧边栏
    const sidebar = document.getElementById('sidebar');
    if (sidebar && sidebar.classList.contains('show')) {
        sidebar.classList.remove('show');
    }
}

// 全局事件 
function bindGlobalEvents() {
    document.addEventListener('click', (e) => {
        if (e.target.matches('.sidebar-menu a, .nav-link')) {
            e.preventDefault();
            const nav = e.target.dataset.nav;
            if (nav) switchSection(nav);
        }
    });
}

// 初始化 
async function init() {
    await loadBaseData();
    await refreshAllData();
    
    const header = StudentRender.headerInfo();
    document.querySelector('.user-avatar').innerText = header.avatar;
    document.querySelector('.user-info span').innerText = header.name;
    
    bindGlobalEvents();
    switchSection('home');
    
    document.getElementById('logoutBtn')?.addEventListener('click', () => API.logout());
    createFilterDrawer();
}

init();