(async ()=>{
    // 登录用户信息
    let currentTeacher = null;
    let response = await fetch('/teacher/info',{method: 'get'});
    currentTeacher = await response.json();
    // 成绩数据 (本班)
    let scoresData = null;
    response = await fetch('/teacher/scores',{method: 'get'});
    scoresData = await response.json();
    // 本班每人总分
    let scoresTotal = null;
    response = await fetch('/teacher/totalscores',{method: 'get'});
    scoresTotal = await response.json();
    // 总分概况
    let general = null;
    response = await fetch('/teacher/general',{method: 'get'});
    general = await response.json();
    // 单科概况
    let subjectGeneral = null;
    response = await fetch('/teacher/subjectgeneral',{method: 'get'});
    subjectGeneral = await response.json();
    // 班级通知列表 (含已读统计)
    let notices = [];
    let currentSubjectFilter = "总分";
    let currentPageLog = 1;
    let currentEditId = null;
    let currentEditingNoticeId = null;  // 全局变量，记录正在编辑的通知ID
    const logsPerPage = 5;

    function getFilteredScores() {
        return scoresData.filter(s => s.subject === currentSubjectFilter);
    }

    // 渲染顶部信息
    function renderHeaderInfo()
    {
        document.querySelector('.user-info .user-avatar').innerText = `${currentTeacher.name.slice(0,1)}`;
        document.querySelector('.user-info span').innerText = `${currentTeacher.name} (老师)`;
    }

    // 首页
    async function renderHome() {
        const unreadNoticesCount = notices.filter(n => n.unreadCount > 0).length;
        const recentNotices = [...notices].sort((a,b)=>new Date(b.publishTime)-new Date(a.publishTime)).slice(0,3);
        const html = `
            <h3>班级工作台 · ${currentTeacher.className}</h3>
            <p style="margin:8px 0 20px;">欢迎${currentTeacher.name}老师，本周班级整体表现良好，请及时处理未读通知反馈。</p>
            <div class="stats-grid">
                <div class="stat-card"><div class="stat-value">${general.max}</div><div>最高分</div></div>
                <div class="stat-card"><div class="stat-value">${general.min}</div><div>最低分</div></div>
                <div class="stat-card"><div class="stat-value">${general.avg}</div><div>平均分</div></div>
                <div class="stat-card"><div class="stat-value">${unreadNoticesCount}</div><div>未完全阅读通知</div></div>
            </div>
            <div style="margin-top:24px;"><h4>最新通知</h4>
            ${recentNotices.map(n => `<div style="padding:12px 0; border-bottom:1px solid var(--border);"><strong>${n.title}</strong><span style="float:right;font-size:12px;">已读 ${n.isReadByStudents}/${n.totalStu}</span><div style="font-size:12px; color:var(--gray);">${n.publishTime.slice(0,10)}</div></div>`).join('')}
            <div style="text-align:right;margin-top:12px;"><a href="javascript:void(0)" data-nav="notice" class="nav-link" style="color:var(--primary);">管理通知 →</a></div>
            </div>
        `;
        document.getElementById('homeSection').innerHTML = html;
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => { switchToSection(link.getAttribute('data-nav')); });
        });
    }

    async function refreshAllData() {
        // 单科概况
        const response1 = await fetch('/teacher/subjectgeneral',{method: 'get'});
        subjectGeneral = await response1.json();
        // 总分概况
        const response2 = await fetch('/teacher/general',{method: 'get'});
        general = await response2.json();
        // 成绩数据 (本班)
        const response3 = await fetch('/teacher/scores',{method: 'get'});
        scoresData = await response3.json();
        // 本班每人总分
        const response4 = await fetch('/teacher/totalscores',{method: 'get'});
        scoresTotal = await response4.json();
    }

    async function renderScoreModule() {
        let tableRows = null;
        let stats = null;
        await refreshAllData();
        if (currentSubjectFilter === '总分') {
            stats = {
                avg: general.avg,
                max: general.max,
                min: general.min
            };
            tableRows = scoresTotal.map(s => `
                <tr>
                    <td>${s.studentName}</td><td>${s.id}</td><td>${s.total_score}</td><td>${s.class_rank}</td>
                    <td></td>
                </tr>
            `).join('');
        }
        else {
            const filtered = getFilteredScores(); // 拿到当前学科的所有成绩
            subjectGeneral.forEach(e=>{
                if (e.subject === currentSubjectFilter)
                {stats = e;return;}
            });
            tableRows = filtered.map(s => `
                <tr>
                    <td>${s.studentName}</td><td>${s.id}</td><td>${s.score}</td><td>${s.class_subject_rank}</td>
                    <td><button class="btn-sm edit-score" data-id="${s.id}" data-subject="${s.subject}" data-score="${s.score}" data-stuid="${s.id}">编辑</button>
                </tr>
            `).join('');
        }
        const html = `
            <div style="display:flex; justify-content:space-between; align-items:center;"><h3>成绩管理 · ${currentSubjectFilter}</h3>
            <div class="filter-bar">
                <select id="subjectSelect" class="filter-select">
                    <option value="总分" ${currentSubjectFilter==='总分'?'selected':''}>总分</option>
                    ${subjectGeneral.map(e => `<option value="${e.subject}" ${currentSubjectFilter===e.subject?'selected':''}>${e.subject}</option>`).join('')}
                </select>
            </div></div>
            <div class="stats-grid" style="margin-bottom:20px;">
                <div class="stat-card"><div class="stat-value">${stats.avg}</div><div>平均分</div></div>
                <div class="stat-card"><div class="stat-value">${stats.max}</div><div>最高分</div></div>
                <div class="stat-card"><div class="stat-value">${stats.min}</div><div>最低分</div></div>
                ${currentSubjectFilter === '总分'?'':`<div class="stat-card"><div class="stat-value">${stats.passCount}/${stats.totalStu}</div><div>及格人数</div></div>
                <div class="stat-card"><div class="stat-value">${stats.passRate}</div><div>及格率</div></div>`}
            </div>
            <table class="table">
                <thead>
                    <tr>
                        <th>姓名</th><th>学号</th><th>成绩</th><th>班级排名</th><th>操作</th>
                    </tr>
                </thead>
                    <tbody>${tableRows || '<tr><td colspan="5">暂无数据</td></tr>'}</tbody>
            </table>
            <div class="filter-bar" style="margin-top:16px;"><button id="exportScoreBtn" class="btn-sm">导出当前科目成绩(CSV)</button></div>
        `;
        document.getElementById('scoreSection').innerHTML = html;
        document.getElementById('subjectSelect')?.addEventListener('change', (e) => { currentSubjectFilter = e.target.value; renderScoreModule(); });
        document.getElementById('exportScoreBtn')?.addEventListener('click', () => exportScoresToCSV());
        // 编辑成绩事件
        document.querySelectorAll('.edit-score').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(btn.dataset.id);
                const scoreItem = scoresData.find(s => (s.id === id && s.subject === currentSubjectFilter));
                if (scoreItem) {
                    currentEditId = id;
                    document.getElementById('editStudentName').value = scoreItem.studentName;
                    document.getElementById('editSubject').value = scoreItem.subject;
                    document.getElementById('editScore').value = scoreItem.score;
                    document.getElementById('editScoreModal').style.display = 'flex';
                }
            });
        });
    }

    // 编辑模态框
    function closeEditModal() {
        document.getElementById('editScoreModal').style.display = 'none';
        currentEditId = null;
    }

    // 确定修改
    async function confirmEditScore() {
        const newScore = parseFloat(document.getElementById('editScore').value).toFixed(1);
        const scoreItem = scoresData.find(s => (s.id === currentEditId && s.subject === currentSubjectFilter));
        if (currentSubjectFilter === '总分') {
            alert("总分由各科成绩自动计算，不可直接编辑");
            closeEditModal();
            return;
        }
        if (!scoreItem) {
            alert('成绩记录不存在');
            closeEditModal();
            return;
        }
        const subject = scoreItem.subject; 
        let response = null;
        response = await fetch('/teacher/fullmark',{
            method: 'post',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                subject: subject
            })
        });
        const fullMark = parseInt((await response.json()).full_mark);
        if (isNaN(newScore) || newScore < 0 || newScore > fullMark) {
            alert('请输入有效的成绩!');
            return;
        }
        response = await fetch('/teacher/scores', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                studentId: currentEditId,
                subject: subject,
                newScore: newScore
            })
        });
        const result = await response.json();
        if (result.success) {
            alert('成绩修改成功');
            // 刷新当前成绩模块（会重新渲染表格和统计）
            await renderScoreModule();
            // 刷新首页（使用更新后的 general）
            await renderHome();
            closeEditModal();
        } else {
            alert(result.message || '修改失败，请重试');
        }
    }

    function bindEditModalEvents() {
        const modal = document.getElementById('editScoreModal');
        if (!modal) return;
        document.getElementById('editModalCancelBtn')?.addEventListener('click', closeEditModal);
        document.getElementById('editModalConfirmBtn')?.addEventListener('click', confirmEditScore);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeEditModal();
        });
    }

    function exportScoresToCSV() {
        const filtered = getFilteredScores();
        let csv = "姓名,学号,成绩,班级排名\n" + filtered.map(s => `${s.studentName},${s.id},${s.score},${s.class_subject_rank}`).join("\n");
        const blob = new Blob(["\uFEFF" + csv], {type: "text/csv;charset=utf-8;"});
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob); link.download = `${currentTeacher.className}_${currentSubjectFilter}_成绩.csv`; link.click();
    }

    // 获取通知列表
    async function refreshNoticeList() {
        try {
            const response = await fetch('/teacher/notices');
            if (response.ok) {
                const data = await response.json();
                notices = data.map(n => ({
                    ...n,
                    isReadByStudents: n.readCount,
                    totalStu: n.totalStudents,
                    unreadCount: n.unreadCount
                })); // 统一字段
                if (document.querySelector('#noticeSection.active')) {
                    renderNoticeModule();
                }
            } else {
                console.error('获取通知失败');
            }
        } catch (err) {
            console.error('网络错误', err);
        }
    }

    // 通知模块 - 采用学生版卡片样式
    function renderNoticeModule() {
        const noticeHtml = notices.map(notice => `
            <div class="notice-item ${notice.unreadCount > 0 ? 'unread' : ''}" data-id="${notice.id}">
                <div class="notice-title">
                    <strong>${notice.title}</strong>
                    <span class="badge" style="background:var(--gray);">已读 ${notice.isReadByStudents}/${notice.totalStu}</span>
                    ${notice.unreadCount > 0 ? '<span class="notice-badge-sm">未读剩余</span>' : ''}
                </div>
                <div class="notice-content">${notice.content}</div>
                <div class="notice-time">${new Date(notice.publishTime).toLocaleString()} | 班主任：${notice.teacher_name}</div>
                <div class="inline-actions">
                    <button class="btn-sm edit-notice" data-id="${notice.id}">编辑</button>
                    <button class="btn-sm btn-danger del-notice" data-id="${notice.id}">删除</button>
                    <button class="btn-sm view-readlist" data-id="${notice.id}">查看已读/未读名单</button>
                </div>
            </div>
        `).join('');
        const html = `
            <h3>班级通知管理 <span style="font-size:14px;">(可发布/编辑/删除通知)</span></h3>
            <div class="card" style="background:var(--gray-light);">
                <h4>发布新通知</h4>
                <div class="form-group"><label>标题</label><input type="text" id="newTitle" placeholder="通知标题"></div>
                <div class="form-group">
                    <label>内容</label>
                    <div id="newContent" class="contenteditable-box" contenteditable="true">
                    </div>
                </div>
                <button id="publishNoticeBtn" class="btn-primary">发布通知</button>
            </div>
            <div style="margin-top:20px;"><h4>已发布通知列表</h4>${noticeHtml || '<div class="empty-tip">暂无通知</div>'}</div>
        `;
        document.getElementById('noticeSection').innerHTML = html;
        document.getElementById('publishNoticeBtn')?.addEventListener('click', () => {
            const title = document.getElementById('newTitle').value.trim();
            const content = document.getElementById('newContent').innerText.trim();
            if(title && content) {
                publishNotice(title, content);
            } else alert("请填写完整");
        });
        document.querySelectorAll('.edit-notice').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                const notice = notices.find(n => n.id === id);
                if(notice){
                    currentEditingNoticeId = id;
                    // 填充模态框现有数据
                    document.getElementById('editNoticeTitle').value = notice.title;
                    document.getElementById('editNoticeContent').value = notice.content;
                    // 显示模态框
                    document.getElementById('editNoticeModal').style.display = 'flex';
                }
            });
        });
        document.querySelectorAll('.del-notice').forEach(btn => {
            btn.addEventListener('click', async(e) => { 
                e.stopPropagation(); 
                if(confirm("删除通知不可恢复"))
                { 
                    const id = parseInt(btn.dataset.id);
                    const res = await fetch(`/teacher/notices/${id}`, { method: 'DELETE' });
                    if (res.ok) {
                        if (currentEditingNoticeId === id) currentEditingNoticeId = null;
                        await refreshNoticeList();  // 重新拉取并刷新
                    } else {
                        alert("删除失败");
                    }
                } 
            });
        });
        document.querySelectorAll('.view-readlist').forEach(btn => {
            btn.addEventListener('click', (e) => { e.stopPropagation(); alert("已读名单(演示): 已读28人: 李明,王芳等；未读14人"); });
        });
    }

    // 发布通知
    async function publishNotice(title, content) {
        const res = await fetch('/teacher/notices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content })
        });
        if (res.ok) {
            await refreshNoticeList();   // 重新获取最新列表
        } else {
            alert('发布失败');
        }
    }

    // 编辑通知
    async function editNotice(id, title, content) {
        const res = await fetch(`/teacher/notices/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content })
        });
        if (res.ok) {
            await refreshNoticeList();
        } else {
            alert("更新失败");
        }
    }

    function bindEditNoticeModalEvents() {
        const modal = document.getElementById('editNoticeModal');
        const cancelBtn = document.getElementById('editNoticeCancelBtn');
        const confirmBtn = document.getElementById('editNoticeConfirmBtn');

        // 取消：关闭模态框，清空当前编辑ID
        cancelBtn?.addEventListener('click', () => {
            modal.style.display = 'none';
            currentEditingNoticeId = null;
        });

        // 确认：执行更新
        confirmBtn?.addEventListener('click', async () => {
            const newTitle = document.getElementById('editNoticeTitle').value.trim();
            const newContent = document.getElementById('editNoticeContent').value.trim();
            if (!newTitle || !newContent) {
                alert("标题和内容不能为空");
                return;
            }
            await editNotice(currentEditingNoticeId,newTitle,newContent);
            // 关闭模态框并清空ID
            document.getElementById('editNoticeModal').style.display = 'none';
            currentEditingNoticeId = null;
        });

        // 点击遮罩层关闭
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                currentEditingNoticeId = null;
            }
        });
    }
    
    async function renderLogModule() {
        const page = currentPageLog;
        const response = await fetch(`/teacher/logs?page=${page}&pageSize=${logsPerPage}`);
        const data = await response.json();
        const logs = data.logs;
        const totalPages = Math.ceil(data.total / logsPerPage);
        const html = `
            <h3>班级操作日志 (班主任可见)</h3>
            <table class="table"><thead><tr><th>操作人</th><th>操作类型</th><th>操作内容</th><th>操作时间</th></tr></thead><tbody>
            ${logs.map(log => `<tr><td>${log.user_name}</td><td>${log.operation_type}</td><td>${log.operation_content}</td><td>${new Date(log.created_at).toLocaleString()}</td></tr>`).join('')}
            </tbody></table>
            <div class="pagination" id="logPagination">${Array.from({length: totalPages}, (_,i)=>`<button class="page-btn ${i+1===currentPageLog?'active-page':''}" data-page="${i+1}">${i+1}</button>`).join('')}</div>
        `;
        document.getElementById('logSection').innerHTML = html;
        document.querySelectorAll('#logPagination .page-btn').forEach(btn => {
            btn.addEventListener('click', () => { 
                currentPageLog = parseInt(btn.dataset.page); 
                renderLogModule(); 
            });
        });
    }

    function switchToSection(section) {
        document.querySelectorAll('.sidebar-menu a').forEach(link => { link.classList.remove('active'); if(link.getAttribute('data-nav')===section) link.classList.add('active'); });
        document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
        let target = document.getElementById(`${section}Section`);
        if(target) target.classList.add('active');
        let title = "";
        if(section === 'home') { renderHome(); title = "教学首页"; }
        else if(section === 'score') { renderScoreModule(); title = "成绩管理"; }
        else if(section === 'notice') { renderNoticeModule(); title = "班级通知"; }
        else if(section === 'log') { renderLogModule(); title = "班级日志"; }
        document.getElementById('pageTitle').innerText = title;
        const sidebar = document.getElementById('sidebar');
        if(sidebar.classList.contains('show')) sidebar.classList.remove('show');
    }
    async function init() {
        renderHeaderInfo();
        await refreshNoticeList();
        document.querySelectorAll('.sidebar-menu a').forEach(link => {
            link.addEventListener('click', (e) => { switchToSection(link.getAttribute('data-nav')); });
        });
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                window.location.href = '/logout';
            });
        }
        switchToSection('home');
        bindEditModalEvents();
        bindEditNoticeModalEvents();
    }
    init();
})();