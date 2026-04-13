// ================== 教师端主入口 ==================
import { TeacherState } from './state.js';
import { TeacherRender } from './render.js';

let currentSection = 'home';

// ---------- 数据加载 ----------
async function loadBaseData() {
    const info = await API.teacher.getInfo();
    TeacherState.currentTeacher = info;
    TeacherState.className = info.className;
    TeacherState.classId = info.classId;
    
    const exams = await API.teacher.getExams();
    TeacherState.examList = exams;
    
    const notices = await API.teacher.getNotices();
    TeacherState.notices = notices;
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

// ---------- 首页 ----------
async function renderHome() {
    const unreadCount = TeacherState.notices.filter(n => n.unreadCount > 0).length;
    const recentNotices = [...TeacherState.notices]
        .sort((a, b) => new Date(b.publishTime) - new Date(a.publishTime))
        .slice(0, 3);
    
    const html = `
        <h3>班级工作台 · ${escapeHtml(TeacherState.className || '未绑定班级')}</h3>
        <p>欢迎 ${escapeHtml(TeacherState.currentTeacher?.name || '')} 老师</p>
        <div class="stats-grid">
            <div class="stat-card"><div class="stat-value">${TeacherState.general.max}</div><div>最高分</div></div>
            <div class="stat-card"><div class="stat-value">${TeacherState.general.min}</div><div>最低分</div></div>
            <div class="stat-card"><div class="stat-value">${TeacherState.general.avg}</div><div>平均分</div></div>
            <div class="stat-card"><div class="stat-value">${unreadCount}</div><div>未完全阅读通知</div></div>
        </div>
        <div style="margin-top:24px;">
            <h4>最新通知</h4>
            ${recentNotices.map(n => `
                <div style="padding:12px 0; border-bottom:1px solid #ddd;">
                    <strong>${escapeHtml(n.title)}</strong>
                    <span style="float:right;">已读 ${n.readCount}/${n.totalStudents}</span>
                    <div style="font-size:12px; color:#666;">${formatDate(n.publishTime)}</div>
                </div>
            `).join('')}
            <div style="text-align:right; margin-top:12px;">
                <a href="#" data-nav="notice" class="nav-link">管理通知 →</a>
            </div>
        </div>
    `;
    document.getElementById('homeSection').innerHTML = html;
}

// ---------- 成绩管理 ----------
async function renderScoreModule() {
    await refreshAllData(TeacherState.currentExamDate);
    
    const isTotal = TeacherState.currentSubjectFilter === '总分';
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
    
    const html = `
        <div style="display:flex; justify-content:space-between;">
            <h3>成绩管理 · ${TeacherState.currentSubjectFilter}</h3>
            <div class="filter-bar">
                <select id="examSelect" class="filter-select">${examOptions}</select>
                <select id="subjectSelect" class="filter-select">${subjectOptions}</select>
            </div>
        </div>
        ${TeacherRender.statsCards(stats, isTotal)}
        ${TeacherRender.scoreTable(displayData, isTotal)}
        <div style="margin-top:16px;">
            <button id="exportScoreBtn" class="btn-sm">导出CSV</button>
        </div>
    `;
    document.getElementById('scoreSection').innerHTML = html;
    
    document.getElementById('examSelect').addEventListener('change', async (e) => {
        TeacherState.currentExamDate = formatDate(e.target.value);
        renderScoreModule();
    });
    document.getElementById('subjectSelect').addEventListener('change', (e) => {
        TeacherState.currentSubjectFilter = e.target.value;
        renderScoreModule();
    });
    document.getElementById('exportScoreBtn').addEventListener('click', exportCSV);
}

function exportCSV() {
    const isTotal = TeacherState.currentSubjectFilter === '总分';
    const data = isTotal ? TeacherState.scoresTotal : TeacherState.scoresData.filter(s => s.subject === TeacherState.currentSubjectFilter);
    if (!data.length) return alert('无数据');
    
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

// ---------- 通知管理 ----------
async function renderNoticeModule() {
    const notices = TeacherState.notices;
    const html = `
        <h3>班级通知管理</h3>
        <div class="card" style="background:#f9f9f9; padding:16px;">
            <h4>发布新通知</h4>
            <div class="form-group"><label>标题</label><input type="text" id="newTitle" placeholder="通知标题"></div>
            <div class="form-group"><label>内容</label><textarea id="newContent" rows="4"></textarea></div>
            <button id="publishNoticeBtn" class="btn-primary">发布通知</button>
        </div>
        <h4 style="margin-top:24px;">已发布通知</h4>
        <div id="noticeListContainer">${TeacherRender.noticeList(notices)}</div>
    `;
    document.getElementById('noticeSection').innerHTML = html;
    
    document.getElementById('publishNoticeBtn').addEventListener('click', async () => {
        const title = document.getElementById('newTitle').value.trim();
        const content = document.getElementById('newContent').value.trim();
        if (!title || !content) return alert('请填写完整');
        await API.teacher.publishNotice(title, content);
        TeacherState.notices = await API.teacher.getNotices();
        document.getElementById('newTitle').value = '';
        document.getElementById('newContent').value = '';
        renderNoticeModule();
    });
    
    bindNoticeEvents();
}

function bindNoticeEvents() {
    document.querySelectorAll('.edit-notice-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const notice = TeacherState.notices.find(n => n.id == id);
            if (notice) {
                TeacherState.currentEditingNoticeId = id;
                document.getElementById('editNoticeTitle').value = notice.title;
                document.getElementById('editNoticeContent').value = notice.content;
                document.getElementById('editNoticeModal').style.display = 'flex';
            }
        });
    });
    
    document.querySelectorAll('.delete-notice-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('确定删除？')) return;
            await API.teacher.deleteNotice(btn.dataset.id);
            TeacherState.notices = await API.teacher.getNotices();
            renderNoticeModule();
        });
    });
    
    document.querySelectorAll('.view-readlist-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const data = await API.teacher.getNoticeReadStatus(btn.dataset.id);
            document.getElementById('readCount').innerText = data.readCount;
            document.getElementById('unreadCount').innerText = data.unreadCount;
            document.getElementById('readList').innerHTML = data.readList.map(n => `<li>${n}</li>`).join('');
            document.getElementById('unreadList').innerHTML = data.unreadList.map(n => `<li>${n}</li>`).join('');
            document.getElementById('readStatusModal').style.display = 'flex';
        });
    });
}

// ---------- 日志 ----------
async function renderLogModule() {
    const data = await API.teacher.getLogs(TeacherState.currentLogPage, TeacherState.logsPerPage);
    TeacherState.logTotal = data.total;
    const logs = data.logs;
    const totalPages = Math.ceil(data.total / TeacherState.logsPerPage);
    
    const html = `
        <h3>班级操作日志</h3>
        <table class="table">
            <thead><tr><th>操作人</th><th>类型</th><th>内容</th><th>时间</th></tr></thead>
            <tbody>
                ${logs.map(l => `<tr><td>${escapeHtml(l.user_name)}</td><td>${escapeHtml(l.operation_type)}</td><td>${escapeHtml(l.operation_content)}</td><td>${formatDateTime(l.created_at)}</td></tr>`).join('')}
            </tbody>
        </table>
        <div class="pagination">
            ${Array.from({length: totalPages}, (_, i) => `
                <button class="page-btn ${i+1 === TeacherState.currentLogPage ? 'active-page' : ''}" data-page="${i+1}">${i+1}</button>
            `).join('')}
        </div>
    `;
    document.getElementById('logSection').innerHTML = html;
    
    document.querySelectorAll('#logSection .page-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            TeacherState.currentLogPage = parseInt(btn.dataset.page);
            renderLogModule();
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

// ---------- 全局事件 ----------
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
    document.getElementById('editNoticeConfirmBtn')?.addEventListener('click', async () => {
        const title = document.getElementById('editNoticeTitle').value.trim();
        const content = document.getElementById('editNoticeContent').value.trim();
        if (!title || !content) return;
        await API.teacher.updateNotice(TeacherState.currentEditingNoticeId, title, content);
        TeacherState.notices = await API.teacher.getNotices();
        closeModal('editNoticeModal');
        renderNoticeModule();
    });
    
    // 关闭按钮
    document.querySelectorAll('[id$="CancelBtn"]').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal-mask').style.display = 'none';
        });
    });
}

async function confirmEditScore() {
    // 编辑成绩确认
    document.getElementById('editModalConfirmBtn')?.addEventListener('click', async () => {
        const newScore = Number(document.getElementById('editScore').value).toFixed(1);
        const subject = document.getElementById('editSubject').value;
        const scoreId = TeacherState.currentEditId;

        // 总分拦截
        if (TeacherState.currentSubjectFilter === '总分') {
            alert("总分由各科成绩自动计算，不可直接编辑");
            closeModal('editScoreModal');
            return;
        }

        // 查找成绩记录
        const scoreItem = TeacherState.scoresData.find(s => 
            s.scoreId == scoreId && s.subject === subject
        );
        if (!scoreItem) {
            alert('成绩记录不存在');
            closeModal('editScoreModal');
            return;
        }

        // 获取满分并校验
        try {
            const fullRes = await API.teacher.getFullMark(subject);
            const fullMark = parseInt(fullRes.full_mark) || 100;
            if (isNaN(newScore) || newScore < 0 || newScore > fullMark) {
                alert(`请输入有效的成绩 (0-${fullMark})`);
                return;
            }
        } catch (e) {
            // 降级处理，继续提交
            console.warn('获取满分失败，跳过范围校验');
        }

        // 提交更新
        try {
            const scoreId = TeacherState.currentEditId; 
            const result = await API.teacher.updateScore(scoreId,newScore);
            if (result.success) {
                alert('成绩修改成功');
                closeModal('editScoreModal');
                await renderScoreModule();
                await renderHome();      // 同步更新首页统计
            } else {
                alert(result.message || '修改失败，请重试');
            }
        } catch (err) {
            alert('网络错误，请稍后重试');
        }
    });
}

function closeModal(id) { document.getElementById(id).style.display = 'none'; }

// ---------- 初始化 ----------
async function init() {
    await loadBaseData();
    await refreshAllData();
    
    const header = TeacherRender.headerInfo();
    document.querySelector('.user-avatar').innerText = header.avatar;
    document.querySelector('.user-info span').innerText = header.name;
    
    bindGlobalEvents();
    switchSection('home');
    
    document.getElementById('logoutBtn')?.addEventListener('click', () => API.logout());
}

init();