(async function(){
    let response = null;
    // 成绩筛选条件
    let globalSubjectFilter = "数学";
    let globalClassFilter = "所有班级";
    let currentLogPage = 1;
    let currentExamDate = ''; // 当前选中的考试日期，空字符串表示所有批次
    let examList = [];     // 考试日期列表
    let gradeList = [];
    let allSubjects = [];  // 存储所有科目（去重）
    let currentEditScoreId = null;
    let currentEditClassId = null;
    let currentAddStudentClassId = null;
    const logsPerPage = 15;

    // 用户信息
    let currentAdmin = null;
    response = await fetch('/admin/info',{method: 'get'});
    currentAdmin = await response.json();
    // 班级数据 (含绑定教师)
    let classes = null;
    response = await fetch('/admin/classes',{method: 'get'});
    classes = await response.json();
    // 教师池
    let allTeachers = null;
    response = await fetch('/admin/teachers',{method: 'get'});
    allTeachers = await response.json();
    // 全量成绩数据（单科）
    let allScores = null;
    // 总分数据
    let scoresTotal = [];
    // 全量通知 (跨班级) - 使用统一通知卡片样式展示
    let allNotices = null;
    response = await fetch('/admin/notices',{method: 'get'});
    allNotices = await response.json();
    // 在组装通知数据时
    allNotices.forEach(n => {
        n.isUnreadForAdmin = isNewNotice(n.publishTime);
    });
    // 系统全量操作日志
    let systemLogs = null;
    response = await fetch('/admin/logs',{method: 'get'});
    systemLogs = await response.json();

    // 辅助函数：判断是否为24小时内发布的新通知
    function isNewNotice(publishTime) {
        const NEW_HOURS = 24;
        const now = new Date();
        const diffHours = (now - new Date(publishTime)) / (1000 * 60 * 60);
        return diffHours <= NEW_HOURS;
    }

    function escapeHtml(str) {
        if (str === undefined || str === null) return '';
        if (typeof str !== 'string') str = String(str);
        return str.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }

    function normalizeScores(scores) {
        return scores.map(s => ({ ...s, score: parseFloat(Number(s.score).toFixed(1)) || 0 }));
    }

    function refreshAllSubjects() {
        const subjectSet = new Set();
        if (allScores) allScores.forEach(s => subjectSet.add(s.subject));
        subjectSet.add('总分');
        allSubjects = Array.from(subjectSet).sort();
    }

    async function loadGradeList() {
        const response = await fetch('/admin/grades', { method: 'get' });
        gradeList = await response.json();
    }

    function getClassOptions() {
        let opts = '<option value="所有班级">所有班级</option>';
        classes.forEach(c => { opts += `<option value="${c.className}">${c.className}</option>`; });
        return opts;
    }

    // 计算统计（通用）
    function computeStats(scores) {
        if (!scores || scores.length === 0) return { avg: 0, max: 0, min: 0, passCount: 0, total: 0, passRate: "0%" };
        const arr = scores.map(s => s.score);
        const avg = (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1);
        const max = Math.max(...arr);
        const min = Math.min(...arr);
        const passCount = arr.filter(s => s >= 60).length;
        const total = arr.length;
        const passRate = ((passCount / total) * 100).toFixed(1) + "%";
        return { avg, max, min, passCount, total, passRate };
    }

    async function loadExamList() {
        const res = await fetch('/admin/exams');
        examList = await res.json();
        const select = document.getElementById('examSelect');
        if (!select) return;
        select.innerHTML = '<option value="">所有批次</option>';
        for (let fullDate of examList) {
            select.innerHTML += `<option value="${fullDate}">${fullDate}</option>`;
        }
        if (currentExamDate) select.value = currentExamDate;
    }

    // 刷新单科成绩数据
    async function refreshScoresData() {
        let url = '/admin/scores';
        if (currentExamDate) {
            url += `?exam_date=${currentExamDate}`;
        }
        const res = await fetch(url);
        allScores = await res.json();
        allScores = normalizeScores(allScores);
        refreshAllSubjects();
    }

    // 刷新总分数据
    async function refreshTotalScoresData() {
        let url = '/admin/totalscores';
        if (currentExamDate) {
            url += `?exam_date=${currentExamDate}`;
        }
        const res = await fetch(url);
        const data = await res.json();
        scoresTotal = data.map(item => ({
            className: item.className,
            studentName: item.studentName,
            studentId: item.studentId,
            score: parseFloat(Number(item.total_score).toFixed(1)) || 0,
            classRank: item.class_rank,
            classRankInClass: item.class_rank_in_class
        }));
    }

    // 渲染顶部信息
    function renderHeaderInfo()
    {
        document.querySelector('.user-info .user-avatar').innerText = `${currentAdmin.name.slice(0,1)}`;
        document.querySelector('.user-info span').innerText = `${currentAdmin.name} (管理员)`;
    }

    // ---------- 总览看板 ----------
    function renderDashboard() {
        const totalClasses = classes.length;
        const totalStudents = classes.reduce((sum, c) => sum + c.studentCount, 0);
        const totalNotices = allNotices.length;
        const latestNotices = [...allNotices]
            .sort((a, b) => new Date(b.publishTime) - new Date(a.publishTime))
            .slice(0, 3);
        const noticeListHtml = latestNotices.map(notice => {
            const isNew = isNewNotice(notice.publishTime);
            return `
                <div class="recent-notice-item" data-notice-id="${notice.id}" style="cursor:pointer; padding:12px; border-bottom:1px solid var(--border); transition:0.2s;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <strong>${escapeHtml(notice.title)}</strong>
                        ${isNew ? '<span class="notice-badge-sm" style="background:var(--warning);">新</span>' : ''}
                    </div>
                    <div style="font-size:12px; color:var(--gray); margin-top:4px;">
                        ${escapeHtml(notice.className)} · ${new Date(notice.publishTime).toLocaleString()}
                    </div>
                    <div style="font-size:13px; color:var(--gray-dark); margin-top:6px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                        ${escapeHtml(notice.content.substring(0, 60))}${notice.content.length > 60 ? '…' : ''}
                    </div>
                </div>
            `;
        }).join('');

        const html = `
            <h3>教务总览看板</h3>
            <p style="margin:8px 0 20px;">欢迎${escapeHtml(currentAdmin.name)}，全校教学数据实时监控，支持班级/教师绑定及全权限管理。</p>
            <div class="stats-grid">
                <div class="stat-card"><div class="stat-value">${totalClasses}</div><div>班级总数</div></div>
                <div class="stat-card"><div class="stat-value">${totalStudents}</div><div>在校学生</div></div>
                <div class="stat-card"><div class="stat-value">${allTeachers.length}</div><div>在职教师</div></div>
                <div class="stat-card"><div class="stat-value">${totalNotices}</div><div>班级通知</div></div>
            </div>
            <div class="card" style="margin-top: 24px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <h4>最新通知</h4>
                    <a href="javascript:void(0)" class="nav-link" data-nav="noticeAll" style="color:var(--primary); font-size:13px;">查看全部 →</a>
                </div>
                <div id="dashboardNoticeList">
                    ${latestNotices.length ? noticeListHtml : '<div class="empty-tip">暂无通知</div>'}
                </div>
            </div>
            <div style="margin-top:24px;">
                <h4>最近操作日志</h4>
                <table class="table"><thead><tr><th>操作人</th><th>操作类型</th><th>内容</th><th>时间</th></tr></thead>
                <tbody>${systemLogs.slice(0, 3).map(l => `
                    <tr><td>${escapeHtml(l.operator)}</td><td>${escapeHtml(l.operationType)}</td><td>${escapeHtml(l.content)}</td><td>${new Date(l.operateTime).toLocaleString()}</td></tr>
                `).join('')}</tbody></table>
                <div style="text-align:right;margin-top:12px;"><a href="javascript:void(0)" data-nav="systemLog" class="nav-link" style="color:var(--primary);">查看全部日志 →</a></div>
            </div>
        `;
        document.getElementById('dashboardSection').innerHTML = html;
        document.querySelectorAll('#dashboardNoticeList .recent-notice-item').forEach(el => {
            el.addEventListener('click', () => switchToSection('noticeAll'));
        });
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => switchToSection(link.getAttribute('data-nav')));
        });
    }

    // 班级管理 + 教师绑定
    async function renderClassManage() {
        // 获取班级列表
        let response = await fetch('/admin/classes', { method: 'get' });
        classes = await response.json();

        // 获取教师列表
        response = await fetch('/admin/teachers', { method: 'get' });
        let allTeachers = await response.json();

        // 为每个班级获取学生列表（用简单的 for 循环）
        for (let i = 0; i < classes.length; i++) {
            let c = classes[i];
            let stuRes = await fetch(`/admin/classes/${c.id}/students`, { method: 'get' });
            let students = await stuRes.json();
            c.students = students;      // 把学生列表挂到班级对象上
            c.studentCount = students.length; // 更新学生人数
        }
        // 生成班级卡片 HTML
        let classListHtml = '';
        // 双重循环
        for (let c of classes) {
            // 学生列表 HTML
            let studentListHtml = '';
            for (let s of c.students) {
                studentListHtml += `
                    <div class="student-item" data-student-id="${s.id}" data-class-id="${c.id}" style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid var(--gray-light);">
                        <span>${(s.name)} (${(s.studentId)})</span>
                        <button class="btn-sm btn-danger delete-student" data-class-id="${c.id}" data-student-id="${s.id}" style="padding:2px 8px;">删除</button>
                    </div>
                `;
            }
            if (studentListHtml === '') studentListHtml = '<div class="empty-tip">暂无学生</div>';

            // 教师下拉选项
            let teacherOptions = '<option value="">-- 绑定教师 --</option>';
            for (let t of allTeachers) {
                let selected = (c.teacherId === t.id) ? 'selected' : '';
                teacherOptions += `<option value="${t.id}" ${selected}>${(t.name)}</option>`;
            }

            classListHtml += `
                <div class="class-card" style="border:1px solid var(--border); border-radius:12px; margin-bottom:20px; padding:16px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                        <div><strong>${(c.className)}</strong> (${c.studentCount}人) 班主任: ${c.teacher || '未绑定'}</div>
                        <div class="class-actions">
                            <select class="bind-teacher-select" data-classid="${c.id}">
                                ${teacherOptions}
                            </select>
                            <button class="btn-sm btn-danger delete-class" data-id="${c.id}">删除班级</button>
                            <button class="btn-sm edit-class" data-id="${c.id}" data-name="${c.rawClassName}" data-grade-id="${c.gradeId}">编辑</button>
                            <button class="btn-sm btn-primary add-student" data-class-id="${c.id}">+ 添加学生</button>
                        </div>
                    </div>
                    <div style="margin-top:16px;">
                        <h5 style="margin-bottom:8px;">班级成员</h5>
                        <div class="student-list" data-class-id="${c.id}">${studentListHtml}</div>
                    </div>
                </div>
            `;
        }
        let teacherPoolHtml = '';
        for (let t of allTeachers) {
            teacherPoolHtml += `<span style="display:inline-block;background:var(--gray-light);padding:4px 12px;border-radius:30px;margin:4px;">${(t.name)}</span>`;
        }
        const html = `
            <h3>班级管理与教师绑定</h3>
            <div class="card" style="background:var(--gray-light);">
                <h4>新增班级</h4>
                <div style="display:flex; gap:12px; flex-wrap:wrap;">
                    <button id="openAddClassBtn" class="btn-primary">+ 新增班级</button>
                </div>
                <div style="margin-top:16px;"><small>提示: 通过下拉绑定班主任，支持解绑/重绑。一个教师只能担任一个班级的班主任。</small></div>
            </div>
            <h4>现有班级列表</h4>
            <div id="classListContainer">${classListHtml || '<div class="empty-tip">暂无班级</div>'}</div>
            <hr>
            <h4>教师池管理</h4>
            <div class="filter-bar"><button id="openAddTeacherBtn" class="btn-sm">+ 添加教师</button></div>
            <div>${teacherPoolHtml}</div>
        `;
        document.getElementById('classManageSection').innerHTML = html;
        // 打开新增班级模态框
        document.getElementById('openAddClassBtn')?.addEventListener('click', async () => {
            // 加载年级列表（如果还没加载过）
            if (gradeList.length === 0) {
                await loadGradeList();
            }
            // 填充年级下拉框
            const gradeSelect = document.getElementById('addClassGradeId');
            gradeSelect.innerHTML = '';
            for (let g of gradeList) {
                gradeSelect.innerHTML += `<option value="${g.id}">${g.grade_name}</option>`;
            }
            document.getElementById('addClassName').value = '';
            document.getElementById('addClassModal').style.display = 'flex';
        });

        // 教师绑定/解绑
        document.querySelectorAll('.bind-teacher-select').forEach(select => {
            select.addEventListener('change', async (e) => {
                const classId = parseInt(select.dataset.classid);
                const teacherId = e.target.value ? parseInt(e.target.value) : null;
                const res = await fetch(`/admin/classes/${classId}/teacher`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ teacherId })
                });
                const data = await res.json();
                if (data.success) {
                    alert(data.message);
                    renderClassManage();  // 刷新
                    renderDashboard();
                } else {
                    alert(data.message);
                    // 恢复原下拉值（从当前 classes 变量中找）
                    let originalClass = null;
                    for (let c of classes) if (c.id === classId) originalClass = c;
                    if (originalClass) select.value = originalClass.teacherId || "";
                }
            });
        });

        // 删除班级
        document.querySelectorAll('.delete-class').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = parseInt(btn.dataset.id);
                if (confirm("删除班级会移除所有学生关系，是否继续？")) {
                    const res = await fetch(`/admin/classes/${id}`, { method: 'DELETE' });
                    const data = await res.json();
                    if (data.success) {
                        renderClassManage();
                        renderDashboard();
                    } else {
                        alert("删除失败");
                    }
                }
            });
        });

        // 编辑班级名称（打开模态框）
        document.querySelectorAll('.edit-class').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = parseInt(btn.dataset.id);
                const oldName = btn.dataset.name;        // 原始班级名
                const oldGradeId = parseInt(btn.dataset.gradeId);
                // 确保年级列表已加载
                if (gradeList.length === 0) await loadGradeList();
                const gradeSelect = document.getElementById('editClassGradeId');
                gradeSelect.innerHTML = '';
                for (let g of gradeList) {
                    const selected = (g.id === oldGradeId) ? 'selected' : '';
                    gradeSelect.innerHTML += `<option value="${g.id}" ${selected}>${(g.grade_name)}</option>`;
                }
                document.getElementById('editClassName').value = oldName;
                document.getElementById('editClassModal').style.display = 'flex';
                currentEditClassId = id;
            });
        });

        // 添加学生（打开模态框）
        document.querySelectorAll('.add-student').forEach(btn => {
            btn.addEventListener('click', () => {
                const classId = parseInt(btn.dataset.classId);
                currentAddStudentClassId = classId;
                document.getElementById('studentName').value = '';
                document.getElementById('studentId').value = '';
                document.getElementById('addStudentModal').style.display = 'flex';
            });
        });

        // 删除学生
        document.querySelectorAll('.delete-student').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const classId = parseInt(btn.dataset.classId);
                const studentId = parseInt(btn.dataset.studentId);
                if (confirm("确认删除该学生吗？")) {
                    const res = await fetch(`/admin/classes/${classId}/students/${studentId}`, { method: 'DELETE' });
                    const data = await res.json();
                    if (data.success) {
                        renderClassManage();
                        renderDashboard();
                    } else {
                        alert("删除失败");
                    }
                }
            });
        });

        // 打开添加教师模态框
        document.getElementById('openAddTeacherBtn')?.addEventListener('click', () => {
            document.getElementById('teacherName').value = '';
            document.getElementById('addTeacherModal').style.display = 'flex';
        });
    }

    // 通用关闭模态框
    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.style.display = 'none';
    }

    // 确认新增班级
    async function confirmAddClass() {
        const gradeId = document.getElementById('addClassGradeId').value;
        const className = document.getElementById('addClassName').value.trim();
        if (!className) {
            alert("请输入班级名称");
            return;
        }
        const res = await fetch('/admin/classes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ className, gradeId })
        });
        const data = await res.json();
        if (data.success) {
            alert(`班级 ${className} 已创建`);
            closeModal('addClassModal');
            renderClassManage();
            renderDashboard();
        } else {
            alert("创建失败");
        }
    }

    // 确认编辑班级
    async function confirmEditClass() {
        const newName = document.getElementById('editClassName').value.trim();
        const newGradeId = document.getElementById('editClassGradeId').value;
        if (!newName) {
            alert("班级名称不能为空");
            return;
        }
        const res = await fetch(`/admin/classes/${currentEditClassId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ className: newName, gradeId: newGradeId })
        });
        const data = await res.json();
        if (data.success) {
            closeModal('editClassModal');
            renderClassManage();
            renderDashboard();
        } else {
            alert("修改失败");
        }
    }

    // 确认添加学生
    async function confirmAddStudent() {
        const name = document.getElementById('studentName').value.trim();
        const studentId = document.getElementById('studentId').value.trim();
        if (!name || !studentId) {
            alert("请填写完整信息");
            return;
        }
        const res = await fetch(`/admin/classes/${currentAddStudentClassId}/students`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, studentId })
        });
        const data = await res.json();
        if (data.success) {
            alert("添加成功");
            closeModal('addStudentModal');
            renderClassManage();
            renderDashboard();
        } else {
            alert(data.message || "添加失败");
        }
    }

    // 确认添加教师
    async function confirmAddTeacher() {
        const name = document.getElementById('teacherName').value.trim();
        if (!name) {
            alert("请输入教师姓名");
            return;
        }
        // 需要后端提供 POST /admin/teachers 接口，若没有则提示
        const res = await fetch('/admin/teachers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        const data = await res.json();
        if (data.success) {
            alert(`教师 ${name} 已添加`);
            closeModal('addTeacherModal');
            renderClassManage();
            renderDashboard();
        } else {
            alert("添加失败，请检查后端接口");
        }
    }

    // 全量成绩管理
    async function renderScoreAll() {
        // 总分必须在具体批次下查看，若当前为总分且未选批次，自动切回默认科目
        if (globalSubjectFilter === '总分' && !currentExamDate) {
            const firstSubject = allSubjects.find(s => s !== '总分') || '数学';
            globalSubjectFilter = firstSubject;
            return renderScoreAll();
        }

        // 根据当前科目加载数据
        if (globalSubjectFilter === '总分') {
            await refreshTotalScoresData();
        } else {
            await refreshScoresData();
        }

        // 准备展示数据
        let displayData = [];
        let isTotal = (globalSubjectFilter === '总分');
        let hasExamDate = !!currentExamDate;  // 是否选择了具体批次，用于控制排名列显示

        if (isTotal) {
            let filteredTotal = scoresTotal;
            if (globalClassFilter !== '所有班级') {
                filteredTotal = scoresTotal.filter(s => s.className === globalClassFilter);
            }
            displayData = filteredTotal;
        } else {
            let filtered = allScores.filter(s => s.subject === globalSubjectFilter);
            if (globalClassFilter !== '所有班级') {
                filtered = filtered.filter(s => s.className === globalClassFilter);
            }
            displayData = filtered;
        }

        // 计算统计值
        const stats = computeStats(displayData);

        // 根据是否为总分生成不同的统计卡片
        const statsHtml = isTotal ? `
            <div class="stats-grid" style="margin-bottom:16px;">
                <div class="stat-card"><div class="stat-value">${stats.avg}</div><div>平均分</div></div>
                <div class="stat-card"><div class="stat-value">${stats.max}</div><div>最高分</div></div>
                <div class="stat-card"><div class="stat-value">${stats.min}</div><div>最低分</div></div>
            </div>
        ` : `
            <div class="stats-grid" style="margin-bottom:16px;">
                <div class="stat-card"><div class="stat-value">${stats.avg}</div><div>平均分</div></div>
                <div class="stat-card"><div class="stat-value">${stats.max}</div><div>最高分</div></div>
                <div class="stat-card"><div class="stat-value">${stats.min}</div><div>最低分</div></div>
                <div class="stat-card"><div class="stat-value">${stats.passCount}/${stats.total}</div><div>及格人数</div></div>
                <div class="stat-card"><div class="stat-value">${stats.passRate}</div><div>及格率</div></div>
            </div>
        `;

        // 动态生成表头（排名列仅在选择了具体批次时显示）
        const tableHeader = isTotal ? `
            <thead>
                <tr>
                    <th>姓名</th><th>学号</th>
                    <th>总分</th>
                    ${hasExamDate ? `<th>总分排名</th><th>班级排名</th>` : ''}
                    <th>操作</th>
                </tr>
            </thead>
        ` : `
            <thead>
                <tr>
                    <th>班级</th><th>姓名</th><th>学号</th>
                    <th>科目</th><th>成绩</th>
                    ${hasExamDate ? `<th>年级排名</th><th>班级排名</th>` : ''}
                    <th>操作</th>
                </tr>
            </thead>
        `;

        // 动态生成表格行
        const tableRows = displayData.map((s) => `
            <tr>
                ${isTotal ? '' : `<td>${escapeHtml(s.className || '')}</td>`}
                <td>${escapeHtml(s.studentName || '')}</td>
                <td>${escapeHtml(s.studentId || '')}</td>
                ${isTotal ? '' : `<td>${escapeHtml(globalSubjectFilter)}</td>`}
                <td>${s.score}</td>
                ${isTotal ? `
                    ${hasExamDate ? `
                        <td>${s.classRank || '—'}</td>
                        <td>${s.classRankInClass || '—'}</td>
                    ` : ''}
                ` : `
                    ${hasExamDate ? `
                        <td>${s.grade_rank_subject || '—'}</td>
                        <td>${s.class_rank_subject || '—'}</td>
                    ` : ''}
                `}
                <td>
                    ${isTotal ? '—' : `
                        <button class="btn-sm edit-score-all" data-id="${s.id}" data-score="${s.score}" data-name="${escapeHtml(s.studentName)}" data-subject="${globalSubjectFilter}">编辑</button>
                        <button class="btn-sm btn-danger del-score-all" data-id="${s.id}">删除</button>
                    `}
                </td>
            </tr>
        `).join('');

        // 科目下拉选项
        const subjectOptions = allSubjects.map(sub =>
            `<option value="${sub}" ${globalSubjectFilter === sub ? 'selected' : ''}>${sub}</option>`
        ).join('');

        // 组装页面
        const html = `
            <h3>全量成绩管理 (跨班级)</h3>
            <div class="filter-bar">
                <select id="examSelect" class="filter-select"><option value="">加载中...</option></select>
                <select id="classFilterAll" class="filter-select">${getClassOptions()}</select>
                <select id="subjectFilterAll" class="filter-select">${subjectOptions}</select>
                <button id="addScoreAllBtn" class="btn-primary btn-sm">+ 添加成绩</button>
                <button id="batchImportAllBtn" class="btn-sm">批量导入(模拟)</button>
                <button id="exportAllBtn" class="btn-sm">导出CSV</button>
            </div>
            ${statsHtml}
            <table class="table">
                ${tableHeader}
                <tbody>${tableRows || '<tr><td colspan="6">暂无数据</td></tr>'}</tbody>
            </table>
        `;
        document.getElementById('scoreAllSection').innerHTML = html;

        // 加载考试日期下拉框（并设置默认值）
        await loadExamList();
        // 确保筛选器显示当前值
        const classFilterSelect = document.getElementById('classFilterAll');
        if (classFilterSelect) classFilterSelect.value = globalClassFilter;
        const examSelect = document.getElementById('examSelect');
        if (examSelect) examSelect.value = currentExamDate || '';

        // 绑定筛选事件
        document.getElementById('classFilterAll')?.addEventListener('change', (e) => {
            globalClassFilter = e.target.value;
            renderScoreAll();
        });
        document.getElementById('subjectFilterAll')?.addEventListener('change', (e) => {
            globalSubjectFilter = e.target.value;
            renderScoreAll();
        });
        document.getElementById('examSelect')?.addEventListener('change', async (e) => {
            currentExamDate = e.target.value;
            await renderScoreAll();
        });

        // 绑定按钮事件
        document.getElementById('addScoreAllBtn')?.addEventListener('click', () => openAddScoreModal());
        document.getElementById('batchImportAllBtn')?.addEventListener('click', () => alert("模拟批量导入成绩功能"));
        document.getElementById('exportAllBtn')?.addEventListener('click', () => exportScoreCSV());

        // 绑定编辑和删除按钮
        bindScoreActions();
    }

    function bindScoreActions() {
        document.querySelectorAll('.edit-score-all').forEach(btn => {
            btn.removeEventListener('click', editScoreHandler);
            btn.addEventListener('click', editScoreHandler);
        });
        document.querySelectorAll('.del-score-all').forEach(btn => {
            btn.removeEventListener('click', deleteScoreHandler);
            btn.addEventListener('click', deleteScoreHandler);
        });
    }

    function editScoreHandler(e) {
        const id = parseInt(e.currentTarget.dataset.id);
        const score = e.currentTarget.dataset.score;
        const name = e.currentTarget.dataset.name;
        const subject = e.currentTarget.dataset.subject;
        document.getElementById('editScoreStudentName').value = name;
        document.getElementById('editScoreSubject').value = subject;
        document.getElementById('editScoreValue').value = score;
        document.getElementById('editScoreAdminModal').style.display = 'flex';
        currentEditScoreId = id;
    }

    function deleteScoreHandler(e) {
        const id = parseInt(e.currentTarget.dataset.id);
        if (confirm("删除该成绩")) {
            fetch(`/admin/scores/${id}`, { method: 'DELETE' })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        renderScoreAll();
                        renderDashboard();
                    } else {
                        alert(data.message || "删除失败");
                    }
                });
        }
    }

    // 打开添加成绩模态框（原有逻辑，此处简写）
    function openAddScoreModal() {
        const classSelect = document.getElementById('addScoreClass');
        classSelect.innerHTML = '<option value="">请选择班级</option>';
        classes.forEach(c => {
            classSelect.innerHTML += `<option value="${escapeHtml(c.className)}">${escapeHtml(c.className)}</option>`;
        });
        const datalist = document.getElementById('subjectOptions');
        datalist.innerHTML = '';
        allSubjects.forEach(sub => {
            if (sub !== '总分') datalist.innerHTML += `<option value="${escapeHtml(sub)}">`;
        });
        document.getElementById('addScoreSubject').value = '';
        document.getElementById('addScoreStudentName').value = '';
        document.getElementById('addScoreStudentId').value = '';
        document.getElementById('addScoreValue').value = '';
        document.getElementById('addScoreModal').style.display = 'flex';
    }

    // 添加成绩
    async function confirmAddScore() {
        const className = document.getElementById('addScoreClass').value;
        const studentName = document.getElementById('addScoreStudentName').value.trim();
        const studentId = document.getElementById('addScoreStudentId').value.trim();
        let subject = document.getElementById('addScoreSubject').value.trim();
        const score = parseFloat(Number(document.getElementById('addScoreValue').value).toFixed(1));

        if (!className || !studentName || !studentId || !subject) {
            alert("请填写完整信息（班级、姓名、学号、科目）");
            return;
        }
        if (subject === '总分') {
            alert("总分由系统自动计算，不可手动添加");
            return;
        }
        // 获取该科目满分
        const fullRes = await fetch('/admin/fullmark', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subject })
        });
        const fullData = await fullRes.json();
        const fullMark = fullData.full_mark;
        if (isNaN(score) || score < 0 || score > fullMark) {
            alert(`请输入有效的成绩 (0-${fullMark})`);
            return;
        }
        const res = await fetch('/admin/scores', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ className, studentName, studentId, subject, score })
        });
        const data = await res.json();
        if (data.success) {
            alert("添加成功");
            closeModal('addScoreModal');
            // 重新加载成绩数据
            const response = await fetch('/admin/scores');
            allScores = await response.json();
            allScores = normalizeScores(allScores); 
            refreshAllSubjects();
            renderScoreAll();
            renderDashboard();
        } else {
            alert(data.message || "添加失败");
        }
    }

    // 编辑成绩
    async function confirmEditScoreAdmin() {
        const newScore = parseFloat(Number(document.getElementById('editScoreValue').value).toFixed(1));
        const scoreItem = allScores.find(s => s.id === currentEditScoreId);
        if (!scoreItem) {
            alert("成绩记录不存在");
            return;
        }
        if (scoreItem.subject === '总分') {
            alert("总分由系统自动计算，不可手动修改");
            closeModal('editScoreAdminModal');
            return;
        }
        // 获取该科目满分（可从原记录中获取，但为保险重新请求）
        const fullRes = await fetch('/admin/fullmark', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subject: scoreItem.subject })
        });
        const fullData = await fullRes.json();
        const fullMark = fullData.full_mark;
        if (isNaN(newScore) || newScore < 0 || newScore > fullMark) {
            alert(`请输入有效的成绩 (0-${fullMark})`);
            return;
        }
        const res = await fetch(`/admin/scores/${currentEditScoreId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newScore })
        });
        const data = await res.json();
        if (data.success) {
            alert("成绩已更新");
            closeModal('editScoreAdminModal');
            // 刷新数据
            const response = await fetch('/admin/scores');
            allScores = await response.json();
            allScores = normalizeScores(allScores); 
            refreshAllSubjects();
            renderScoreAll();
            renderDashboard();
        } else {
            alert(data.message || "修改失败");
        }
    }

    function exportScoreCSV() {
        // 根据当前科目导出CSV，可参考教师端实现
        alert("导出功能暂未实现，可后续添加");
    }

    // ---------- 全量通知 ----------
    function renderNoticeAll() {
        const sortedNotices = [...allNotices].sort((a, b) => new Date(b.publishTime) - new Date(a.publishTime));
        const noticeCards = sortedNotices.map(notice => `
            <div class="notice-item ${notice.isUnreadForAdmin ? 'unread' : ''}">
                <div class="notice-title">
                    <strong>${escapeHtml(notice.title)}</strong>
                    <span class="badge badge-info">${escapeHtml(notice.className)}</span>
                    ${notice.isUnreadForAdmin ? '<span class="notice-badge-sm">新通知</span>' : ''}
                </div>
                <div class="notice-content">${escapeHtml(notice.content)}</div>
                <div class="notice-time">${new Date(notice.publishTime).toLocaleString()} | 发布人：${escapeHtml(notice.teacher_name)} | 已读 ${notice.readCount}/${notice.totalStu}</div>
            </div>
        `).join('');
        const html = `
            <h3>全校班级通知 (教务主任全量查阅)</h3>
            <div class="filter-bar">
                <select id="classFilterNotice" class="filter-select">
                    <option value="all">所有班级</option>
                    ${classes.map(c => `<option value="${c.className}">${escapeHtml(c.className)}</option>`).join('')}
                </select>
            </div>
            <div id="noticeListContainer">${noticeCards || '<div class="empty-tip">暂无通知</div>'}</div>
        `;
        document.getElementById('noticeAllSection').innerHTML = html;
        const classFilter = document.getElementById('classFilterNotice');
        if (classFilter) {
            classFilter.addEventListener('change', (e) => {
                const filterVal = e.target.value;
                let filtered = [...allNotices];
                if (filterVal !== 'all') filtered = filtered.filter(n => n.className === filterVal);
                const filteredCards = filtered.map(notice => `
                    <div class="notice-item ${notice.isUnreadForAdmin ? 'unread' : ''}">
                        <div class="notice-title"><strong>${escapeHtml(notice.title)}</strong><span class="badge badge-info">${escapeHtml(notice.className)}</span>${notice.isUnreadForAdmin ? '<span class="notice-badge-sm">新通知</span>' : ''}</div>
                        <div class="notice-content">${escapeHtml(notice.content)}</div>
                        <div class="notice-time">${new Date(notice.publishTime).toLocaleString()} | 发布人：${escapeHtml(notice.teacher_name)} | 已读 ${notice.readCount}/${notice.totalStu}</div>
                    </div>
                `).join('');
                document.getElementById('noticeListContainer').innerHTML = filteredCards || '<div class="empty-tip">暂无通知</div>';
            });
        }
    }

    // ---------- 系统日志 ----------
    function renderSystemLog() {
        const totalPages = Math.ceil(systemLogs.length / logsPerPage);
        const start = (currentLogPage - 1) * logsPerPage;
        const pageLogs = systemLogs.slice(start, start + logsPerPage);
        const html = `
            <h3>系统操作日志 (全权限)</h3>
            <table class="table"><thead><tr><th>操作人</th><th>操作类型</th><th>操作内容</th><th>操作时间</th></tr></thead>
            <tbody>${pageLogs.map(l => `
                <tr><td>${escapeHtml(l.operator)}</td><td>${escapeHtml(l.operationType)}</td><td>${escapeHtml(l.content)}</td><td>${new Date(l.operateTime).toLocaleString()}</td></tr>
            `).join('')}</tbody></table>
            <div class="pagination" id="sysLogPagination">${Array.from({ length: totalPages }, (_, i) => `<button class="page-btn ${i + 1 === currentLogPage ? 'active-page' : ''}" data-page="${i + 1}">${i + 1}</button>`).join('')}</div>
        `;
        document.getElementById('systemLogSection').innerHTML = html;
        document.querySelectorAll('#sysLogPagination .page-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                currentLogPage = parseInt(btn.dataset.page);
                renderSystemLog();
            });
        });
    }

    // ---------- 导航切换 ----------
    function switchToSection(sectionId) {
        document.querySelectorAll('.sidebar-menu a').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('data-nav') === sectionId) link.classList.add('active');
        });
        document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
        const target = document.getElementById(`${sectionId}Section`);
        if (target) target.classList.add('active');
        let title = "";
        if (sectionId === 'dashboard') { renderDashboard(); title = "总览看板"; }
        else if (sectionId === 'classManage') { renderClassManage(); title = "班级管理"; }
        else if (sectionId === 'scoreAll') { renderScoreAll(); title = "全量成绩"; }
        else if (sectionId === 'noticeAll') { renderNoticeAll(); title = "全量通知"; }
        else if (sectionId === 'systemLog') { renderSystemLog(); title = "系统日志"; }
        document.getElementById('pageTitle').innerText = title;
        const sidebar = document.getElementById('sidebar');
        if (sidebar.classList.contains('show')) sidebar.classList.remove('show');
    }
    
    // ---------- 绑定模态框事件 ----------
    function bindAdminModalEvents() {
        document.getElementById('cancelAddClassBtn')?.addEventListener('click', () => closeModal('addClassModal'));
        document.getElementById('confirmAddClassBtn')?.addEventListener('click', confirmAddClass);
        document.getElementById('cancelEditClassBtn')?.addEventListener('click', () => closeModal('editClassModal'));
        document.getElementById('confirmEditClassBtn')?.addEventListener('click', confirmEditClass);
        document.getElementById('cancelAddStudentBtn')?.addEventListener('click', () => closeModal('addStudentModal'));
        document.getElementById('confirmAddStudentBtn')?.addEventListener('click', confirmAddStudent);
        document.getElementById('cancelAddTeacherBtn')?.addEventListener('click', () => closeModal('addTeacherModal'));
        document.getElementById('confirmAddTeacherBtn')?.addEventListener('click', confirmAddTeacher);
        document.getElementById('cancelAddScoreBtn')?.addEventListener('click', () => closeModal('addScoreModal'));
        document.getElementById('confirmAddScoreBtn')?.addEventListener('click', confirmAddScore);
        document.getElementById('cancelEditScoreAdminBtn')?.addEventListener('click', () => closeModal('editScoreAdminModal'));
        document.getElementById('confirmEditScoreAdminBtn')?.addEventListener('click', confirmEditScoreAdmin);
        document.querySelectorAll('.modal-mask').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.style.display = 'none';
            });
        });
    }

    async function init() {
        await loadGradeList();
        renderHeaderInfo();
        document.querySelectorAll('.sidebar-menu a').forEach(link => {
            link.addEventListener('click', (e) => { switchToSection(link.getAttribute('data-nav')); });
        });
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                window.location.href = '/logout';
            });
        }
        bindAdminModalEvents();
        switchToSection('dashboard');
    }
    init();
})();