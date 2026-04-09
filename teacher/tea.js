(async ()=>{
    // 登录用户信息
    let currentTeacher = null;
    let response = await fetch('/teacher/info',{method: 'get'});
    currentTeacher = await response.json();
    // 成绩数据 (本班)
    let _scoresData = null;
    response = await fetch('/teacher/scores',{method: 'get'});
    _scoresData = await response.json();
    // 总分概况
    let general = null;
    response = await fetch('/teacher/general',{method: 'get'});
    general = await response.json();

    let scoresData = [
        { id: 1, studentName: "李明", studentId: "2023001", subject: "数学", score: 92, classAvg: 85.2, classRank: 5 },
        { id: 2, studentName: "王芳", studentId: "2023002", subject: "数学", score: 88, classAvg: 85.2, classRank: 10 },
        { id: 3, studentName: "张强", studentId: "2023003", subject: "数学", score: 76, classAvg: 85.2, classRank: 22 },
        { id: 4, studentName: "李明", studentId: "2023001", subject: "英语", score: 85, classAvg: 82.5, classRank: 8 },
        { id: 5, studentName: "王芳", studentId: "2023002", subject: "英语", score: 91, classAvg: 82.5, classRank: 3 },
        { id: 6, studentName: "张强", studentId: "2023003", subject: "英语", score: 74, classAvg: 82.5, classRank: 25 }
    ];
    // 班级通知列表 (含已读统计)
    let notices = [
        { id: 101, title: "期中考试动员会", content: "下周三下午召开期中动员大会，请同学们准时参加。", publishTime: "2025-04-05 10:00", teacher_name: "王敏", isReadByStudents: 28, totalStu: 42, unreadCount: 14 },
        { id: 102, title: "数学周测安排", content: "周五早自习进行数学周测，范围:三角函数。", publishTime: "2025-04-07 09:30", teacher_name: "王敏", isReadByStudents: 35, totalStu: 42, unreadCount: 7 },
        { id: 103, title: "清明假期安全提醒", content: "假期注意交通安全，防溺水。", publishTime: "2025-04-02 16:20", teacher_name: "王敏", isReadByStudents: 42, totalStu: 42, unreadCount: 0 }
    ];
    // 班级操作日志模拟
    let classLogs = [
        { operator: "王敏", actionType: "成绩修改", content: "修改李明数学成绩为92", operateTime: "2025-04-08 09:12" },
        { operator: "王敏", actionType: "通知发布", content: "发布通知:期中考试动员会", operateTime: "2025-04-05 10:02" },
        { operator: "王敏", actionType: "成绩录入", content: "批量导入英语成绩", operateTime: "2025-04-01 14:30" }
    ];
    let currentSubjectFilter = "数学";
    let currentPageLog = 1;
    const logsPerPage = 5;

    function getFilteredScores() {
        return scoresData.filter(s => s.subject === currentSubjectFilter);
    }
    function getSubjectStats(subject) {
        const subScores = scoresData.filter(s => s.subject === subject);
        if(subScores.length === 0) return { avg:0, max:0, min:0, passCount:0, total:0, passRate:"0%" };
        const scores = subScores.map(s => s.score);
        const avg = (scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1);
        const max = Math.max(...scores);
        const min = Math.min(...scores);
        const passCount = scores.filter(s => s >= 60).length;
        const total = scores.length;
        const passRate = ((passCount/total)*100).toFixed(1)+"%";
        return { avg, max, min, passCount, total, passRate };
    }

    // 渲染顶部信息
    function renderHeaderInfo()
    {
        document.querySelector('.user-info .user-avatar').innerText = `${currentTeacher.name.slice(0,1)}`;
        document.querySelector('.user-info span').innerText = `${currentTeacher.name} (老师)`;
    }

    // 首页
    function renderHome() {
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

    function renderScoreModule() {
        const filtered = getFilteredScores();
        const stats = getSubjectStats(currentSubjectFilter);
        const tableRows = filtered.map(s => `
            <tr>
                <td>${s.studentName}</td><td>${s.studentId}</td><td>${s.score}</td><td>${s.classRank}</td>
                <td><button class="btn-sm edit-score" data-id="${s.id}" data-subject="${s.subject}" data-score="${s.score}" data-stuid="${s.studentId}">编辑</button>
                <button class="btn-sm btn-danger del-score" data-id="${s.id}" style="margin-left:6px;">删除</button></td>
            </tr>
        `).join('');
        const html = `
            <div style="display:flex; justify-content:space-between; align-items:center;"><h3>成绩管理 · ${currentSubjectFilter}</h3>
            <div class="filter-bar"><select id="subjectSelect" class="filter-select"><option value="数学" ${currentSubjectFilter==='数学'?'selected':''}>数学</option><option value="英语" ${currentSubjectFilter==='英语'?'selected':''}>英语</option></select>
            <button id="addScoreBtn" class="btn-primary btn-sm">+ 单条添加</button>
            <button id="batchImportBtn" class="btn-sm">批量导入(模拟)</button>
            </div></div>
            <div class="stats-grid" style="margin-bottom:20px;">
                <div class="stat-card"><div class="stat-value">${stats.avg}</div><div>平均分</div></div>
                <div class="stat-card"><div class="stat-value">${stats.max}</div><div>最高分</div></div>
                <div class="stat-card"><div class="stat-value">${stats.min}</div><div>最低分</div></div>
                <div class="stat-card"><div class="stat-value">${stats.passCount}/${stats.total}</div><div>及格人数</div></div>
                <div class="stat-card"><div class="stat-value">${stats.passRate}</div><div>及格率</div></div>
            </div>
            <table class="table"><thead><tr><th>姓名</th><th>学号</th><th>成绩</th><th>班级排名</th><th>操作</th></tr></thead><tbody>${tableRows || '<tr><td colspan="5">暂无数据</td></tr>'}</tbody></table>
            <div class="filter-bar" style="margin-top:16px;"><button id="exportScoreBtn" class="btn-sm">导出当前科目成绩(CSV)</button></div>
        `;
        document.getElementById('scoreSection').innerHTML = html;
        document.getElementById('subjectSelect')?.addEventListener('change', (e) => { currentSubjectFilter = e.target.value; renderScoreModule(); });
        document.getElementById('addScoreBtn')?.addEventListener('click', () => showAddScoreModal());
        document.getElementById('batchImportBtn')?.addEventListener('click', () => alert("演示模式：批量导入成绩功能"));
        document.getElementById('exportScoreBtn')?.addEventListener('click', () => exportScoresToCSV());
        document.querySelectorAll('.edit-score').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(btn.dataset.id);
                const oldScore = btn.dataset.score;
                const newScore = prompt("请输入新成绩", oldScore);
                if(newScore && !isNaN(newScore)) {
                    const idx = scoresData.findIndex(s => s.id === id);
                    if(idx !== -1) { scoresData[idx].score = parseInt(newScore); alert("成绩已更新"); renderScoreModule(); renderHome(); }
                }
            });
        });
        document.querySelectorAll('.del-score').forEach(btn => {
            btn.addEventListener('click', () => { if(confirm("删除该条成绩？")){ const id = parseInt(btn.dataset.id); scoresData = scoresData.filter(s => s.id !== id); renderScoreModule(); renderHome(); alert("已删除"); } });
        });
    }
    function showAddScoreModal() {
        const name = prompt("学生姓名");
        const subject = currentSubjectFilter;
        const score = prompt("成绩分数");
        if(name && score && !isNaN(score)) {
            const newId = Date.now();
            scoresData.push({ id: newId, studentName: name, studentId: "new"+newId, subject: subject, score: parseInt(score), classRank: Math.floor(Math.random()*30+1) });
            renderScoreModule(); renderHome();
            alert("添加成功");
        }
    }
    function exportScoresToCSV() {
        const filtered = getFilteredScores();
        let csv = "姓名,学号,成绩,班级排名\n" + filtered.map(s => `${s.studentName},${s.studentId},${s.score},${s.classRank}`).join("\n");
        const blob = new Blob(["\uFEFF" + csv], {type: "text/csv;charset=utf-8;"});
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob); link.download = `${currentTeacher.className}_${currentSubjectFilter}_成绩.csv`; link.click();
    }

    // 通知模块 - 采用学生版卡片样式
    function renderNoticeModule() {
        const sortedNotices = [...notices].sort((a,b)=>new Date(b.publishTime)-new Date(a.publishTime));
        const noticeHtml = sortedNotices.map(notice => `
            <div class="notice-item ${notice.unreadCount > 0 ? 'unread' : ''}" data-id="${notice.id}">
                <div class="notice-title">
                    <strong>${notice.title}</strong>
                    <span class="badge" style="background:var(--gray);">已读 ${notice.isReadByStudents}/${notice.totalStu}</span>
                    ${notice.unreadCount > 0 ? '<span class="notice-badge-sm">未读剩余</span>' : ''}
                </div>
                <div class="notice-content">${notice.content}</div>
                <div class="notice-time">${notice.publishTime} | 班主任：${notice.teacher_name}</div>
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
                const newNotice = { id: Date.now(), title, content, publishTime: new Date().toLocaleString(), teacher_name: "王敏", isReadByStudents: 0, totalStu: 42, unreadCount: 42 };
                notices.unshift(newNotice);
                renderNoticeModule(); renderHome();
                alert("通知已发布");
            } else alert("请填写完整");
        });
        document.querySelectorAll('.edit-notice').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                const notice = notices.find(n => n.id === id);
                if(notice){
                    const newTitle = prompt("编辑标题", notice.title);
                    const newContent = prompt("编辑内容", notice.content);
                    if(newTitle && newContent) { notice.title = newTitle; notice.content = newContent; renderNoticeModule(); renderHome(); alert("已更新");}
                }
            });
        });
        document.querySelectorAll('.del-notice').forEach(btn => {
            btn.addEventListener('click', (e) => { e.stopPropagation(); if(confirm("删除通知不可恢复")){ const id = parseInt(btn.dataset.id); notices = notices.filter(n => n.id !== id); renderNoticeModule(); renderHome(); } });
        });
        document.querySelectorAll('.view-readlist').forEach(btn => {
            btn.addEventListener('click', (e) => { e.stopPropagation(); alert("已读名单(演示): 已读28人: 李明,王芳等；未读14人"); });
        });
    }

    function renderLogModule() {
        const totalPages = Math.ceil(classLogs.length / logsPerPage);
        const start = (currentPageLog-1)*logsPerPage;
        const pageLogs = classLogs.slice(start, start+logsPerPage);
        const html = `
            <h3>班级操作日志 (班主任可见)</h3>
            <table class="table"><thead><tr><th>操作人</th><th>操作类型</th><th>操作内容</th><th>操作时间</th></tr></thead><tbody>
            ${pageLogs.map(log => `<tr><td>${log.operator}</td><td>${log.actionType}</td><td>${log.content}</td><td>${log.operateTime}</td></tr>`).join('')}
            </tbody></table>
            <div class="pagination" id="logPagination">${Array.from({length: totalPages}, (_,i)=>`<button class="page-btn ${i+1===currentPageLog?'active-page':''}" data-page="${i+1}">${i+1}</button>`).join('')}</div>
        `;
        document.getElementById('logSection').innerHTML = html;
        document.querySelectorAll('#logPagination .page-btn').forEach(btn => {
            btn.addEventListener('click', () => { currentPageLog = parseInt(btn.dataset.page); renderLogModule(); });
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
    function init() {
        renderHeaderInfo();
        document.querySelectorAll('.sidebar-menu a').forEach(link => {
            link.addEventListener('click', (e) => { switchToSection(link.getAttribute('data-nav')); });
        });
        document.getElementById('logoutBtn')?.addEventListener('click', ()=> alert("退出登录(演示)"));
        switchToSection('home');
    }
    init();
})();