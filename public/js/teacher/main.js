// 教师端主入口 
import { TeacherState } from './state.js';
import { TeacherRender } from './render.js';
import { NoticeCard } from '../common/components/NoticeCard.js';
import { openFilterDrawer, createFilterDrawer } from '../common/filterDrawer.js';
import { WSClient } from '../common/websocket.js';
import { Modal } from '../common/components/Modal.js';

let currentSection = 'home';

//  数据加载 
async function loadBaseData() {
    const info = await API.teacher.getInfo();
    TeacherState.currentTeacher = info;
    TeacherState.className = info.className;
    TeacherState.classId = info.classId;
    
    const exams = await API.teacher.getExams();
    TeacherState.examList = exams;
    
    // 未绑定班级时不请求通知，直接赋空数组
    if (TeacherState.classId === null) {
        TeacherState.notices = [];
    } else {
        const notices = await API.teacher.getNotices();
        TeacherState.notices = notices;
    }
}

async function refreshAllData(examDate = '') {
    const [scores, totalScores, general, subjectGeneral] = await Promise.all([
        API.teacher.getScores(examDate),
        API.teacher.getTotalScores(examDate),
        API.teacher.getGeneral(examDate),
        API.teacher.getSubjectGeneral(examDate)
    ]);
    TeacherState.scoresData = scores;
    TeacherState.scoresTotal = totalScores;
    TeacherState.general = general;
    TeacherState.subjectGeneral = subjectGeneral;
}

//  首页 
async function renderHome() {
    const section = document.getElementById('homeSection');
    section.innerHTML = TeacherRender.homeSkeleton();

    // 未绑定班级时，直接显示提示页，不加载后续数据
    if (TeacherState.classId === null) {
        console.log('ok')
        section.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <h3 style="margin-bottom: 16px;">尚未分配班级</h3>
                <p style="color: var(--gray); margin-bottom: 24px;">
                    您当前没有负责的班级，请联系教务主任将您绑定到具体班级。
                </p>
                <p style="color: var(--gray); font-size: 14px;">
                    绑定后即可查看成绩、发布通知等操作。
                </p>
            </div>
        `;
        // 隐藏侧边栏除首页外的其他菜单项
        document.querySelectorAll('.sidebar-menu li:not(:first-child)').forEach(el => el.style.display = 'none');
        return;
    }

    const unreadCount = TeacherState.notices.filter(n => n.unreadCount > 0).length;
    
    // 构建真实内容
    const html = `
        <h3 style="margin-bottom:10px;">班级工作台 · ${escapeHtml(TeacherState.className || '未绑定班级')}</h3>
        <p>欢迎 ${escapeHtml(TeacherState.currentTeacher?.name || '')} 老师，助您更高效地管理本班。</p>
        <div class="stats-grid">
            <div class="stat-card"><div class="stat-value">${TeacherState.general.max}</div><div>最高分</div></div>
            <div class="stat-card"><div class="stat-value">${TeacherState.general.min}</div><div>最低分</div></div>
            <div class="stat-card"><div class="stat-value">${TeacherState.general.avg}</div><div>平均分</div></div>
            <div class="stat-card"><div class="stat-value">${unreadCount}</div><div>未完全阅读通知</div></div>
        </div>
        <div style="margin-top:24px;">
            <h4>最新通知</h4>
            <div id="homeNoticeList" style="margin-top: 10px"></div>
            <div style="text-align:right; margin-top:12px;">
                <a href="#" data-nav="notice" class="nav-link">管理通知 →</a>
            </div>
        </div>
    `;
    section.innerHTML = html;

    const container = document.getElementById('homeNoticeList');
    if (container) {
        // 取最新 3 条通知，按发布时间倒序
        const recentNotices = [...TeacherState.notices]
            .sort((a, b) => new Date(b.publishTime) - new Date(a.publishTime))
            .slice(0, 3);
        
        if (recentNotices.length === 0) {
            container.innerHTML = '<div class="empty-tip">暂无通知</div>';
            return;
        }

        recentNotices.forEach(notice => {
            // 判断是否有未读学生（未读人数 > 0 即为未完全阅读）
            const hasUnread = (notice.unreadCount > 0) || (notice.readCount < notice.totalStudents);
            
            const card = new NoticeCard(notice, {
                expandable: false,           // 首页不展开详情，节省空间
                showActions: false,          // 无编辑/删除按钮
                showReadStats: true,         // 显示已读人数
                badgeMode: 'teacher'
            });
            
            // 点击卡片跳转到通知管理页
            card.element.style.cursor = 'pointer';
            card.element.addEventListener('click', (e) => {
                // 如果点击的是内部按钮（理论上没有），不跳转
                if (e.target.tagName === 'BUTTON') return;
                switchSection('notice');
            });
            
            card.mount(container);
        });
    }
}

//  成绩管理 
async function renderScoreModule() {
    const section = document.getElementById('scoreSection');
    const isTotal = TeacherState.currentSubjectFilter === '总分';
    section.innerHTML = TeacherRender.scoreSkeleton(isTotal);

    await refreshAllData(TeacherState.currentExamDate);
    
    let displayData, stats;
    
    if (isTotal) {
        displayData = TeacherState.scoresTotal;
        stats = TeacherState.general;
    } else {
        displayData = TeacherState.scoresData.filter(s => s.subject === TeacherState.currentSubjectFilter);
        const stat = TeacherState.subjectGeneral.find(s => s.subject === TeacherState.currentSubjectFilter) || {};
        stats = {
            avg: stat.avg || 0,
            max: stat.max || 0,
            min: stat.min || 0,
            passCount: stat.passCount || 0,
            totalStu: stat.totalStu || 0,
            passRate: stat.passRate || '0%'
        };
    }
    
    const examOptions = '<option value="">最新考试</option>' +
        TeacherState.examList.map(d => `<option value="${d}" ${TeacherState.currentExamDate === formatDate(d) ? 'selected' : ''}>${formatDate(d)}</option>`).join('');
    
    const subjectOptions = '<option value="总分" ' + (isTotal ? 'selected' : '') + '>总分</option>' +
        TeacherState.subjectGeneral.map(s => `<option value="${s.subject}" ${TeacherState.currentSubjectFilter === s.subject ? 'selected' : ''}>${s.subject}</option>`).join('');
    
    // 构建筛选栏 HTML，供移动端抽屉复用
    const filterBarHTML = `
        <select id="examSelect" class="filter-select">${examOptions}</select>
        <select id="subjectSelect" class="filter-select">${subjectOptions}</select>
    `;

    const html = `
        <div style="display:flex; justify-content:space-between;">
            <h3>成绩管理 · ${TeacherState.currentSubjectFilter}</h3>
            <div class="filter-bar desktop-filter-bar">
                ${filterBarHTML}
            </div>
        </div>
        <button class="mobile-filter-btn" id="mobileFilterBtn">
            <span>筛选</span>
            <i>▼</i>
        </button>
        ${TeacherRender.statsCards(stats, isTotal)}
        <div class="table-wrapper">
            ${TeacherRender.scoreTable(displayData, isTotal)}
        </div>
        <div style="margin-top:16px;">
            <button id="exportScoreBtn" class="btn-sm">导出CSV</button>
        </div>
    `;
    section.innerHTML = html;
    
    document.getElementById('examSelect').addEventListener('change', async (e) => {
        TeacherState.currentExamDate = formatDate(e.target.value);
        renderScoreModule();
    });
    document.getElementById('subjectSelect').addEventListener('change', (e) => {
        TeacherState.currentSubjectFilter = e.target.value;
        renderScoreModule();
    });
    document.getElementById('exportScoreBtn').addEventListener('click', exportCSV);

    // 绑定移动端筛选按钮
    document.getElementById('mobileFilterBtn')?.addEventListener('click', () => {
        // 抽屉内容：复用筛选栏 HTML，保持结构一致
        const drawerContent = `
            <div class="filter-bar" style="display:flex; flex-direction:column; gap:16px;">
                ${filterBarHTML}
            </div>
        `;
        
        openFilterDrawer(drawerContent, {
            onApply: (body) => {
                const examSelect = body.querySelector('#examSelect');
                const subjectSelect = body.querySelector('#subjectSelect');
                if (examSelect) TeacherState.currentExamDate = formatDate(examSelect.value);
                if (subjectSelect) TeacherState.currentSubjectFilter = subjectSelect.value;
                renderScoreModule();
            },
            onReset: () => {
                TeacherState.currentExamDate = '';
                TeacherState.currentSubjectFilter = '总分';
                renderScoreModule();
            }
        });
    });
}

function exportCSV() {
    const isTotal = TeacherState.currentSubjectFilter === '总分';
    const data = isTotal ? TeacherState.scoresTotal : TeacherState.scoresData.filter(s => s.subject === TeacherState.currentSubjectFilter);
    if (!data.length) return Modal.alert('无数据');
    
    let csv = isTotal ? "姓名,学号,总分,班级排名\n" : "姓名,学号,成绩,班级排名\n";
    data.forEach(s => {
        if (isTotal) {
            csv += `${s.studentName},${s.id},${s.total_score},${s.class_rank}\n`;
        } else {
            csv += `${s.studentName},${s.id},${s.score},${s.class_subject_rank}\n`;
        }
    });
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${TeacherState.className}_${TeacherState.currentSubjectFilter}.csv`;
    a.click();
}

function getFilteredSortedNotices() {
    let filtered = TeacherState.notices;
    if (TeacherState.noticeFilter === 'unread') {
        filtered = filtered.filter(n => n.unreadCount > 0);
    }
    return [...filtered].sort((a, b) => new Date(b.publishTime) - new Date(a.publishTime));
}

//  通知管理 
async function renderNoticeModule() {
    const section = document.getElementById('noticeSection');
    section.innerHTML = TeacherRender.noticeSkeleton();

    const filtered = getFilteredSortedNotices();
    const totalPages = Math.ceil(filtered.length / TeacherState.noticesPerPage);
    if (TeacherState.currentNoticePage > totalPages) {
        TeacherState.currentNoticePage = Math.max(1, totalPages);
    }
    const start = (TeacherState.currentNoticePage - 1) * TeacherState.noticesPerPage;
    const pageNotices = filtered.slice(start, start + TeacherState.noticesPerPage);

    const paginationHTML = renderSmartPagination(TeacherState.currentNoticePage, totalPages);

    const html = `
        <h3>班级通知管理</h3>
        <div class="card" style="background:#f9f9f9; padding:16px;">
            <h4>发布新通知</h4>
            <div class="form-group"><label>标题</label><input type="text" id="newTitle" placeholder="通知标题" style="outline:none;"></div>
            <div class="form-group"><label>内容</label><textarea id="newContent" rows="4" style="outline:none;resize:none;" placeholder="通知内容"></textarea></div>
            <button id="publishNoticeBtn" class="btn-primary">发布通知</button>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
            <h4>已发布通知</h4>
            <div style="margin:10px 0">
                <button class="filter-select ${TeacherState.noticeFilter === 'all' ? 'active-filter' : ''}" data-filter="all">全部</button>
                <button class="filter-select ${TeacherState.noticeFilter === 'unread' ? 'active-filter' : ''}" data-filter="unread">未读</button>
            </div>
        </div>
        <div id="noticeListContainer"></div>
        ${paginationHTML}
    `;
    section.innerHTML = html;
    
    // 获取容器
    const container = document.getElementById('noticeListContainer');
    container.innerHTML = ''; // 清空
    
    // 用 NoticeCard 组件渲染每条通知
    pageNotices.forEach(notice => {
        const card = new NoticeCard(notice, {
            expandable: true,
            showActions: true,   // 显示编辑/删除按钮
            badgeMode: 'teacher',
            onEdit: (n) => {
                // 打开编辑模态框
                openEditNoticeModal(n);
            },
            onDelete: async (n) => {
                const confirmed = await Modal.confirm('确定删除这条通知吗？');
                if (!confirmed) return;
                await API.teacher.deleteNotice(n.id);
                TeacherState.notices = await API.teacher.getNotices();
                renderNoticeModule(); // 刷新列表
            },
            onViewRead: async (n) => {
                const data = await API.teacher.getNoticeReadStatus(n.id);
                showReadStatusModal(data);
            }
        });
        card.mount(container);
    });

    const debouncedRenderNotice = debounce(()=>{
        renderNoticeModule();
    }, 200);

    // 绑定分页按钮
    document.querySelectorAll('#noticeSection .page-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = parseInt(btn.dataset.page);
            if (page && page !== TeacherState.currentNoticePage) {
                TeacherState.currentNoticePage = page;
                debouncedRenderNotice();
            }
        });
    });

    // 绑定筛选按钮
    document.querySelectorAll('[data-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
            TeacherState.noticeFilter = btn.dataset.filter;
            TeacherState.currentNoticePage = 1;
            renderNoticeModule();
        });
    });

    document.getElementById('publishNoticeBtn').addEventListener('click', async(e) => {
        const btn = e.currentTarget;
        try {
            await withLock(btn, async()=>{
                const title = document.getElementById('newTitle').value.trim();
                const content = document.getElementById('newContent').value.trim();
                if (!title || !content) return Modal.alert('请填写完整');
                await API.teacher.publishNotice(title, content);
                TeacherState.notices = await API.teacher.getNotices();
                document.getElementById('newTitle').value = '';
                document.getElementById('newContent').value = '';
                renderNoticeModule();
            }, { loadingText: '发布中...', successText: '发布成功' });
            Modal.alert('发布成功');
        } catch (err) {
            Modal.alert(err.message || '操作失败');
        }
    });
    
}

/**
 * 显示已读/未读名单模态框
 * @param {Object} data - 后端返回的阅读状态数据
 */
function showReadStatusModal(data) {
    // 填充统计数据
    document.getElementById('readCount').textContent = data.readCount || 0;
    document.getElementById('unreadCount').textContent = data.unreadCount || 0;
    
    // 填充已读列表
    const readListEl = document.getElementById('readList');
    readListEl.innerHTML = '';
    (data.readList || []).forEach(name => {
        const li = document.createElement('li');
        li.textContent = name;
        readListEl.appendChild(li);
    });
    
    // 填充未读列表
    const unreadListEl = document.getElementById('unreadList');
    unreadListEl.innerHTML = '';
    (data.unreadList || []).forEach(name => {
        const li = document.createElement('li');
        li.textContent = name;
        unreadListEl.appendChild(li);
    });
    
    // 显示模态框
    document.getElementById('readStatusModal').style.display = 'flex';
}

//  日志 
async function renderLogModule() {
    const section = document.getElementById('logSection');
    section.innerHTML = TeacherRender.logSkeleton();
    
    const data = await API.teacher.getLogs(TeacherState.currentLogPage, TeacherState.logsPerPage);
    TeacherState.logTotal = data.total;
    const logs = data.logs;
    const totalPages = Math.ceil(data.total / TeacherState.logsPerPage);
    
    const paginationHTML = renderSmartPagination(TeacherState.currentLogPage, totalPages);

    const html = `
        <h3>班级操作日志</h3>
        <div class="table-wrapper">
            <table class="table">
                <thead><tr><th>操作人</th><th>类型</th><th>内容</th><th>时间</th></tr></thead>
                <tbody>
                    ${logs.map(l => `<tr><td>${escapeHtml(l.user_name)}</td><td>${escapeHtml(l.operation_type)}</td><td>${escapeHtml(l.operation_content)}</td><td>${formatDateTime(l.created_at)}</td></tr>`).join('')}
                </tbody>
            </table>
        </div>
        ${paginationHTML}
    `;
    document.getElementById('logSection').innerHTML = html;
    
    document.querySelectorAll('#logSection .page-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            TeacherState.currentLogPage = parseInt(btn.dataset.page);
            renderLogModule();
        });
    });
}

//  模块切换 
async function switchSection(sectionId) {
    // 未绑定班级时，只允许访问首页
    if (TeacherState.classId === null && sectionId !== 'home') {
        Modal.alert('您尚未分配班级，请联系教务主任绑定后再使用此功能');
        return;
    }

    currentSection = sectionId;
    document.querySelectorAll('.sidebar-menu a').forEach(l => l.classList.remove('active'));
    document.querySelector(`[data-nav="${sectionId}"]`)?.classList.add('active');
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(`${sectionId}Section`)?.classList.add('active');
    
    const titles = { home: '教学首页', score: '成绩管理', notice: '班级通知', log: '班级日志' };
    document.getElementById('pageTitle').innerText = titles[sectionId] || '';
    
    switch (sectionId) {
        case 'home': await renderHome(); break;
        case 'score': await renderScoreModule(); break;
        case 'notice': await renderNoticeModule(); break;
        case 'log': await renderLogModule(); break;
    }
    // 移动端关闭侧边栏
    const sidebar = document.getElementById('sidebar');
    if (sidebar && sidebar.classList.contains('show')) {
        sidebar.classList.remove('show');
    }
}

//  全局事件 
function bindGlobalEvents() {
    document.addEventListener('click', async (e) => {
        if (e.target.matches('.sidebar-menu a, .nav-link')) {
            e.preventDefault();
            const nav = e.target.dataset.nav;
            if (nav) switchSection(nav);
        }
        if (e.target.classList.contains('modal-mask')) {
            e.target.style.display = 'none';
        }
        // 成绩编辑
        if (e.target.classList.contains('edit-score-btn')) {
            const scoreId = e.target.dataset.id;
            const subject = e.target.dataset.subject;
            const score = e.target.dataset.score;
            const scoreItem = TeacherState.scoresData.find(s => s.scoreId == scoreId && s.subject === subject);
            document.getElementById('editStudentName').value = scoreItem?.studentName || '';
            TeacherState.currentEditId = scoreId;
            document.getElementById('editSubject').value = subject;
            document.getElementById('editScore').value = score;
            document.getElementById('editScoreModal').style.display = 'flex';
        }
    });

    // 关闭已读名单模态框
    document.getElementById('closeReadStatusModal')?.addEventListener('click', () => {
        document.getElementById('readStatusModal').style.display = 'none';
    });

    // 点击遮罩层关闭
    document.getElementById('readStatusModal')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-mask')) {
            e.target.style.display = 'none';
        }
    });
    
    // 编辑成绩确认
    document.getElementById('editModalConfirmBtn')?.addEventListener('click', confirmEditScore);
    
    // 编辑通知确认
    document.getElementById('editNoticeConfirmBtn')?.addEventListener('click', async(e)=>{
        const btn = e.currentTarget;
        try {
            await withLock(btn, async()=>{
                const title = document.getElementById('editNoticeTitle').value.trim();
                const content = document.getElementById('editNoticeContent').value.trim();
                if (!title || !content) return;
                await API.teacher.updateNotice(TeacherState.currentEditingNoticeId, title, content);
                TeacherState.notices = await API.teacher.getNotices();
                closeModal('editNoticeModal');
                renderNoticeModule();
            }, { loadingText: '保存中...', successText: '保存成功' });
        } catch (err) {
            Modal.alert(err.message);
        }
    });
    
    // 关闭按钮
    document.querySelectorAll('[id$="CancelBtn"]').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal-mask').style.display = 'none';
        });
    });
}

async function confirmEditScore() {
    const btn = document.getElementById('editModalConfirmBtn');
    if (!btn) return;
    try {
        await withLock(btn, async()=>{
            // 编辑成绩确认
            const newScore = parseFloat(Number(document.getElementById('editScore').value).toFixed(1));
            if (isNaN(newScore)) {
                Modal.alert('请输入有效的数字');
                return;
            }
            const subject = document.getElementById('editSubject').value;
            const scoreId = TeacherState.currentEditId;
            // 总分拦截
            if (subject === '总分') {
                Modal.alert("总分由各科成绩自动计算，不可直接编辑");
                closeModal('editScoreModal');
                return;
            }
            // 查找成绩记录
            const scoreItem = TeacherState.scoresData.find(s => 
                s.scoreId == scoreId && s.subject === subject
            );
            if (!scoreItem) {
                Modal.alert('成绩记录不存在');
                closeModal('editScoreModal');
                return;
            }
            // 获取满分并校验
            try {
                const fullRes = await API.teacher.getFullMark(subject);
                const fullMark = Number(fullRes.full_mark) || 100;
                if (newScore < 0 || newScore > fullMark) {
                    Modal.alert(`请输入有效的成绩 (0-${fullMark})`);
                    return;
                }
            } catch (e) {
                // 如果满分接口失败，询问用户是否继续
                const confirmed = await Modal.confirm('无法获取科目满分，是否仍要提交？')
                if (!confirmed) {
                    return;
                }
            }

            // 提交更新
            try {
                const result = await API.teacher.updateScore(scoreId,newScore);
                    Modal.alert('成绩修改成功');
                    closeModal('editScoreModal');
                    await renderScoreModule();
                    await renderHome();      // 同步更新首页统计
            } catch (err) {
                // api端处理
            }
        }, { loadingText: '保存中...', successText: '保存成功' });
    } catch (err) {
        Modal.alert(err.message);
    }
}

function openEditNoticeModal(notice) {
    TeacherState.currentEditingNoticeId = notice.id;
    document.getElementById('editNoticeTitle').value = notice.title || '';
    document.getElementById('editNoticeContent').value = notice.content || '';
    document.getElementById('editNoticeModal').style.display = 'flex';
}

function closeModal(id) { document.getElementById(id).style.display = 'none'; }

//  初始化 
async function init() {
    await loadBaseData();
    
    const header = TeacherRender.headerInfo();
    document.querySelector('.user-avatar').innerText = header.avatar;
    document.querySelector('.user-info span').innerText = header.name;

    // 未绑定班级时，直接显示首页提示，不加载成绩等依赖班级的数据
    if (TeacherState.classId === null) {
        bindGlobalEvents();
        switchSection('home'); // renderHome 会显示未绑定提示并隐藏其他菜单
        document.getElementById('logoutBtn')?.addEventListener('click', () => API.logout());
        createFilterDrawer();
        // 不初始化 WebSocket，因为没有班级订阅意义
        return;
    }
    
    await refreshAllData();

    bindGlobalEvents();
    switchSection('home');
    
    document.getElementById('logoutBtn')?.addEventListener('click', () => API.logout());
    createFilterDrawer();

    // 初始化 WebSocket
    const wsClient = new WSClient(TeacherState.currentTeacher.id);

    wsClient.on('READ_COUNT_UPDATE', async (data) => {
        // 刷新通知数据
        TeacherState.notices = await API.teacher.getNotices();
        if (currentSection === 'notice') {
            renderNoticeModule();
        }
    });
}

init();