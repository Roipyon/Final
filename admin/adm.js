(async function(){
    // ---------- 教务主任全局模拟数据 (全权限) ----------
    const adminInfo = { name: "张宏", role: "教务主任" };
    // 班级数据 (含绑定教师)
    let classes = [
        { id: 1, className: "高一(1)班", teacher: "李芳", teacherId: 101, studentCount: 45 },
        { id: 2, className: "高一(2)班", teacher: "陈明", teacherId: 102, studentCount: 44 },
        { id: 3, className: "高二(3)班", teacher: "王敏", teacherId: 103, studentCount: 42 }
    ];
    // 教师池
    let allTeachers = [
        { id: 101, name: "李芳" }, { id: 102, name: "陈明" }, { id: 103, name: "王敏" },
        { id: 104, name: "赵颖" }, { id: 105, name: "孙立" }
    ];
    // 全量成绩数据
    let allScores = [
        { id: 1, className: "高一(1)班", studentName: "赵磊", studentId: "G10101", subject: "数学", score: 88 },
        { id: 2, className: "高一(1)班", studentName: "孙丽", studentId: "G10102", subject: "数学", score: 94 },
        { id: 3, className: "高一(2)班", studentName: "周华", studentId: "G10201", subject: "数学", score: 76 },
        { id: 4, className: "高二(3)班", studentName: "李明", studentId: "2023001", subject: "数学", score: 92 },
        { id: 5, className: "高二(3)班", studentName: "王芳", studentId: "2023002", subject: "英语", score: 91 },
        { id: 6, className: "高一(1)班", studentName: "赵磊", studentId: "G10101", subject: "英语", score: 85 },
    ];
    // 全量通知 (跨班级) - 使用统一通知卡片样式展示
    let allNotices = [
        { id: 201, className: "高一(1)班", title: "家长会通知", content: "本周五下午3点召开家长会，请各位同学通知家长准时参加。", publishTime: "2025-04-06 14:00", teacher_name: "李芳", readCount: 30, totalStu: 45, isUnreadForAdmin: false },
        { id: 202, className: "高二(3)班", title: "期中考试动员", content: "下周三下午召开期中动员大会，请同学们准时参加。", publishTime: "2025-04-05 10:00", teacher_name: "王敏", readCount: 28, totalStu: 42, isUnreadForAdmin: false },
        { id: 203, className: "高一(2)班", title: "数学竞赛选拔", content: "有意参加数学竞赛的同学请到办公室报名，截止本周五。", publishTime: "2025-04-07 09:00", teacher_name: "陈明", readCount: 20, totalStu: 44, isUnreadForAdmin: true }
    ];
    // 系统全量操作日志
    let systemLogs = [
        { operator: "张宏", actionType: "班级管理", content: "新增班级 高一(3)班", operateTime: "2025-04-08 08:30" },
        { operator: "王敏", actionType: "成绩修改", content: "修改李明数学成绩为92", operateTime: "2025-04-07 15:20" },
        { operator: "李芳", actionType: "通知发布", content: "发布家长会通知", operateTime: "2025-04-06 14:05" },
        { operator: "张宏", actionType: "教师绑定", content: "将赵颖老师绑定至高一(3)班", operateTime: "2025-04-05 11:12" },
        { operator: "陈明", actionType: "成绩录入", content: "批量导入数学成绩", operateTime: "2025-04-04 09:45" }
    ];
    
    // 成绩筛选条件
    let globalSubjectFilter = "数学";
    let globalClassFilter = "所有班级";
    let currentLogPage = 1;
    const logsPerPage = 5;

    function getClassOptions() {
        let opts = '<option value="所有班级">所有班级</option>';
        classes.forEach(c => { opts += `<option value="${c.className}">${c.className}</option>`; });
        return opts;
    }

    function getFilteredScores() {
        let filtered = allScores.filter(s => s.subject === globalSubjectFilter);
        if(globalClassFilter !== "所有班级") {
            filtered = filtered.filter(s => s.className === globalClassFilter);
        }
        return filtered;
    }

    function computeStats() {
        const filtered = getFilteredScores();
        if(filtered.length === 0) return { avg:0, max:0, min:0, passCount:0, total:0, passRate:"0%" };
        const scoresArr = filtered.map(s => s.score);
        const avg = (scoresArr.reduce((a,b)=>a+b,0)/scoresArr.length).toFixed(1);
        const max = Math.max(...scoresArr);
        const min = Math.min(...scoresArr);
        const passCount = scoresArr.filter(s => s >= 60).length;
        const total = scoresArr.length;
        const passRate = ((passCount/total)*100).toFixed(1)+"%";
        return { avg, max, min, passCount, total, passRate };
    }

    // 渲染总览看板
    function renderDashboard() {
        const totalClasses = classes.length;
        const totalStudents = classes.reduce((sum,c)=>sum+c.studentCount,0);
        const totalNotices = allNotices.length;
        const html = `
            <h3>教务总览看板</h3>
            <p style="margin:8px 0 20px;">欢迎张主任，全校教学数据实时监控，支持班级/教师绑定及全权限管理。</p>
            <div class="stats-grid">
                <div class="stat-card"><div class="stat-value">${totalClasses}</div><div>班级总数</div></div>
                <div class="stat-card"><div class="stat-value">${totalStudents}</div><div>在校学生</div></div>
                <div class="stat-card"><div class="stat-value">${allTeachers.length}</div><div>在职教师</div></div>
                <div class="stat-card"><div class="stat-value">${totalNotices}</div><div>班级通知</div></div>
            </div>
            <div style="margin-top:24px;"><h4>最近操作日志</h4>
            <table class="table"><thead><tr><th>操作人</th><th>操作类型</th><th>内容</th><th>时间</th></tr></thead>
            <tbody>${systemLogs.slice(0,3).map(l => `<tr><td>${l.operator}</td><td>${l.actionType}</td><td>${l.content}</td><td>${l.operateTime}</td></tr>`).join('')}</tbody></table>
            <div style="text-align:right;margin-top:12px;"><a href="javascript:void(0)" data-nav="systemLog" class="nav-link" style="color:var(--primary);">查看全部日志 →</a></div>
            </div>
        `;
        document.getElementById('dashboardSection').innerHTML = html;
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => { switchToSection(link.getAttribute('data-nav')); });
        });
    }

    // 班级管理 + 教师绑定
    function renderClassManage() {
        const classListHtml = classes.map(c => `
            <div class="class-item">
                <div><strong>${c.className}</strong> (${c.studentCount}人) 班主任: ${c.teacher || '未绑定'}</div>
                <div class="class-actions">
                    <select class="bind-teacher-select" data-classid="${c.id}">
                        <option value="">-- 绑定教师 --</option>
                        ${allTeachers.map(t => `<option value="${t.id}" ${c.teacherId === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}
                    </select>
                    <button class="btn-sm btn-danger delete-class" data-id="${c.id}">删除班级</button>
                    <button class="btn-sm edit-class" data-id="${c.id}" data-name="${c.className}">编辑</button>
                </div>
            </div>
        `).join('');
        const html = `
            <h3>班级管理与教师绑定</h3>
            <div class="card" style="background:var(--gray-light);">
                <h4>新增班级</h4>
                <div style="display:flex; gap:12px; flex-wrap:wrap;">
                    <input type="text" id="newClassName" placeholder="班级名称" style="flex:1; padding:8px; border-radius:8px; border:1px solid var(--border);">
                    <button id="addClassBtn" class="btn-primary">添加班级</button>
                </div>
                <div style="margin-top:16px;"><small>提示: 通过下拉绑定班主任，支持解绑/重绑。</small></div>
            </div>
            <h4>现有班级列表</h4>
            <div id="classListContainer">${classListHtml || '<div class="empty-tip">暂无班级</div>'}</div>
            <hr>
            <h4>教师池管理</h4>
            <div class="filter-bar"><button id="addTeacherBtn" class="btn-sm">+ 添加教师</button></div>
            <div>${allTeachers.map(t => `<span style="display:inline-block;background:var(--gray-light);padding:4px 12px;border-radius:30px;margin:4px;">${t.name}</span>`).join('')}</div>
        `;
        document.getElementById('classManageSection').innerHTML = html;
        document.getElementById('addClassBtn')?.addEventListener('click', () => {
            const name = document.getElementById('newClassName').value.trim();
            if(name) {
                const newId = Date.now();
                classes.push({ id: newId, className: name, teacher: "", teacherId: null, studentCount: 0 });
                renderClassManage(); renderDashboard();
                alert(`班级 ${name} 已创建`);
                systemLogs.unshift({ operator: "张宏", actionType: "班级管理", content: `新增班级 ${name}`, operateTime: new Date().toLocaleString() });
            } else alert("请输入班级名称");
        });
        document.querySelectorAll('.bind-teacher-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const classId = parseInt(select.dataset.classid);
                const teacherId = parseInt(e.target.value);
                const teacher = allTeachers.find(t => t.id === teacherId);
                const classItem = classes.find(c => c.id === classId);
                if(classItem && teacher) {
                    classItem.teacher = teacher.name;
                    classItem.teacherId = teacher.id;
                    alert(`已将 ${classItem.className} 绑定至 ${teacher.name}`);
                    renderClassManage();
                    systemLogs.unshift({ operator: "张宏", actionType: "教师绑定", content: `${teacher.name} 绑定至 ${classItem.className}`, operateTime: new Date().toLocaleString() });
                } else if(!teacherId && classItem) {
                    classItem.teacher = ""; classItem.teacherId = null;
                    alert("已解绑班主任");
                    renderClassManage();
                }
            });
        });
        document.querySelectorAll('.delete-class').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.id);
                if(confirm("删除班级会移除所有关联数据(演示仅移除班级)")) {
                    classes = classes.filter(c => c.id !== id);
                    renderClassManage(); renderDashboard();
                }
            });
        });
        document.querySelectorAll('.edit-class').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.id);
                const oldName = btn.dataset.name;
                const newName = prompt("编辑班级名称", oldName);
                if(newName) {
                    const cls = classes.find(c => c.id === id);
                    if(cls) cls.className = newName;
                    renderClassManage(); renderDashboard();
                }
            });
        });
        document.getElementById('addTeacherBtn')?.addEventListener('click', () => {
            const tname = prompt("教师姓名");
            if(tname) {
                const newId = Date.now();
                allTeachers.push({ id: newId, name: tname });
                renderClassManage();
                alert(`教师 ${tname} 已添加`);
            }
        });
    }

    // 全量成绩管理
    function renderScoreAll() {
        const filtered = getFilteredScores();
        const stats = computeStats();
        const classOpts = getClassOptions();
        const tableRows = filtered.map(s => `
            <tr>
                <td>${s.className}</td><td>${s.studentName}</td><td>${s.studentId}</td><td>${s.subject}</td><td>${s.score}</td>
                <td><button class="btn-sm edit-score-all" data-id="${s.id}" data-score="${s.score}">编辑</button>
                <button class="btn-sm btn-danger del-score-all" data-id="${s.id}">删除</button></td>
            </tr>
        `).join('');
        const html = `
            <h3>全量成绩管理 (跨班级)</h3>
            <div class="filter-bar">
                <select id="classFilterAll" class="filter-select">${classOpts}</select>
                <select id="subjectFilterAll" class="filter-select"><option value="数学" ${globalSubjectFilter==='数学'?'selected':''}>数学</option><option value="英语" ${globalSubjectFilter==='英语'?'selected':''}>英语</option></select>
                <button id="addScoreAllBtn" class="btn-primary btn-sm">+ 添加成绩</button>
                <button id="batchImportAllBtn" class="btn-sm">批量导入(模拟)</button>
                <button id="exportAllBtn" class="btn-sm">导出CSV</button>
            </div>
            <div class="stats-grid" style="margin-bottom:16px;">
                <div class="stat-card"><div class="stat-value">${stats.avg}</div><div>平均分</div></div>
                <div class="stat-card"><div class="stat-value">${stats.max}</div><div>最高分</div></div>
                <div class="stat-card"><div class="stat-value">${stats.min}</div><div>最低分</div></div>
                <div class="stat-card"><div class="stat-value">${stats.passCount}/${stats.total}</div><div>及格人数</div></div>
                <div class="stat-card"><div class="stat-value">${stats.passRate}</div><div>及格率</div></div>
            </div>
            <table class="table"><thead><tr><th>班级</th><th>姓名</th><th>学号</th><th>科目</th><th>成绩</th><th>操作</th></tr></thead><tbody>${tableRows || '<tr><td colspan="6" class="empty-tip">暂无数据</td></tr>'}</tbody></table>
        `;
        document.getElementById('scoreAllSection').innerHTML = html;
        document.getElementById('classFilterAll')?.addEventListener('change', (e) => { globalClassFilter = e.target.value; renderScoreAll(); });
        document.getElementById('subjectFilterAll')?.addEventListener('change', (e) => { globalSubjectFilter = e.target.value; renderScoreAll(); });
        document.getElementById('addScoreAllBtn')?.addEventListener('click', () => {
            const className = prompt("班级名称(如 高一(1)班)");
            const studentName = prompt("学生姓名");
            const subject = globalSubjectFilter;
            const score = prompt("成绩");
            if(className && studentName && score && !isNaN(score)) {
                const newId = Date.now();
                allScores.push({ id: newId, className, studentName, studentId: "auto", subject, score: parseInt(score) });
                renderScoreAll(); renderDashboard();
                systemLogs.unshift({ operator: "张宏", actionType: "成绩添加", content: `添加${className} ${studentName} ${subject}成绩`, operateTime: new Date().toLocaleString() });
                alert("添加成功");
            }
        });
        document.getElementById('batchImportAllBtn')?.addEventListener('click', () => alert("模拟批量导入成绩功能"));
        document.getElementById('exportAllBtn')?.addEventListener('click', () => {
            let csv = "班级,姓名,学号,科目,成绩\n" + getFilteredScores().map(s => `${s.className},${s.studentName},${s.studentId},${s.subject},${s.score}`).join("\n");
            const blob = new Blob(["\uFEFF" + csv], {type: "text/csv"});
            const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "成绩导出.csv"; link.click();
        });
        document.querySelectorAll('.edit-score-all').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(btn.dataset.id);
                const newScore = prompt("新成绩", btn.dataset.score);
                if(newScore && !isNaN(newScore)) {
                    const scoreItem = allScores.find(s => s.id === id);
                    if(scoreItem) { scoreItem.score = parseInt(newScore); renderScoreAll(); renderDashboard(); alert("已更新"); }
                }
            });
        });
        document.querySelectorAll('.del-score-all').forEach(btn => {
            btn.addEventListener('click', () => { if(confirm("删除该成绩")){ const id = parseInt(btn.dataset.id); allScores = allScores.filter(s => s.id !== id); renderScoreAll(); renderDashboard(); } });
        });
    }

    // 全量通知查看 - 使用统一通知卡片样式，支持已读未读视觉区分（模拟未读通知高亮）
    function renderNoticeAll() {
        const sortedNotices = [...allNotices].sort((a,b)=>new Date(b.publishTime)-new Date(a.publishTime));
        const noticeCards = sortedNotices.map(notice => `
            <div class="notice-item ${notice.isUnreadForAdmin ? 'unread' : ''}">
                <div class="notice-title">
                    <strong>${notice.title}</strong>
                    <span class="badge badge-info">${notice.className}</span>
                    ${notice.isUnreadForAdmin ? '<span class="notice-badge-sm">未读提醒</span>' : ''}
                </div>
                <div class="notice-content">${notice.content}</div>
                <div class="notice-time">${notice.publishTime} | 发布人：${notice.teacher_name} | 已读 ${notice.readCount}/${notice.totalStu}</div>
            </div>
        `).join('');
        const html = `
            <h3>全校班级通知 (教务主任全量查阅)</h3>
            <div class="filter-bar">
                <select id="classFilterNotice" class="filter-select">
                    <option value="all">所有班级</option>
                    ${classes.map(c => `<option value="${c.className}">${c.className}</option>`).join('')}
                </select>
            </div>
            <div id="noticeListContainer">${noticeCards || '<div class="empty-tip">暂无通知</div>'}</div>
        `;
        document.getElementById('noticeAllSection').innerHTML = html;
        const classFilter = document.getElementById('classFilterNotice');
        if(classFilter) {
            classFilter.addEventListener('change', (e) => {
                const filterVal = e.target.value;
                let filtered = [...allNotices];
                if(filterVal !== 'all') filtered = filtered.filter(n => n.className === filterVal);
                const filteredCards = filtered.map(notice => `
                    <div class="notice-item ${notice.isUnreadForAdmin ? 'unread' : ''}">
                        <div class="notice-title"><strong>${notice.title}</strong><span class="badge badge-info">${notice.className}</span>${notice.isUnreadForAdmin ? '<span class="notice-badge-sm">未读提醒</span>' : ''}</div>
                        <div class="notice-content">${notice.content}</div>
                        <div class="notice-time">${notice.publishTime} | 发布人：${notice.teacher_name} | 已读 ${notice.readCount}/${notice.totalStu}</div>
                    </div>
                `).join('');
                document.getElementById('noticeListContainer').innerHTML = filteredCards || '<div class="empty-tip">暂无通知</div>';
            });
        }
    }

    // 系统日志分页
    function renderSystemLog() {
        const totalPages = Math.ceil(systemLogs.length / logsPerPage);
        const start = (currentLogPage-1)*logsPerPage;
        const pageLogs = systemLogs.slice(start, start+logsPerPage);
        const html = `
            <h3>系统操作日志 (全权限)</h3>
            <table class="table"><thead><tr><th>操作人</th><th>操作类型</th><th>操作内容</th><th>操作时间</th></tr></thead>
            <tbody>${pageLogs.map(l => `<tr><td>${l.operator}</td><td>${l.actionType}</td><td>${l.content}</td><td>${l.operateTime}</td></tr>`).join('')}</tbody></table>
            <div class="pagination" id="sysLogPagination">${Array.from({length: totalPages}, (_,i)=>`<button class="page-btn ${i+1===currentLogPage?'active-page':''}" data-page="${i+1}">${i+1}</button>`).join('')}</div>
        `;
        document.getElementById('systemLogSection').innerHTML = html;
        document.querySelectorAll('#sysLogPagination .page-btn').forEach(btn => {
            btn.addEventListener('click', () => { currentLogPage = parseInt(btn.dataset.page); renderSystemLog(); });
        });
    }

    // 导航切换
    function switchToSection(sectionId) {
        document.querySelectorAll('.sidebar-menu a').forEach(link => { link.classList.remove('active'); if(link.getAttribute('data-nav')===sectionId) link.classList.add('active'); });
        document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
        let target = document.getElementById(`${sectionId}Section`);
        if(target) target.classList.add('active');
        let title = "";
        if(sectionId === 'dashboard') { renderDashboard(); title = "总览看板"; }
        else if(sectionId === 'classManage') { renderClassManage(); title = "班级管理"; }
        else if(sectionId === 'scoreAll') { renderScoreAll(); title = "全量成绩"; }
        else if(sectionId === 'noticeAll') { renderNoticeAll(); title = "全量通知"; }
        else if(sectionId === 'systemLog') { renderSystemLog(); title = "系统日志"; }
        document.getElementById('pageTitle').innerText = title;
        const sidebar = document.getElementById('sidebar');
        if(sidebar.classList.contains('show')) sidebar.classList.remove('show');
    }

    function init() {
        document.querySelectorAll('.sidebar-menu a').forEach(link => {
            link.addEventListener('click', (e) => { switchToSection(link.getAttribute('data-nav')); });
        });
        document.getElementById('logoutBtn')?.addEventListener('click', ()=> alert("退出登录(演示)"));
        switchToSection('dashboard');
    }
    init();
})();