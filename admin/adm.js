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
    // 排序相关状态
    let currentSortField = 'className';    // 默认按班级排序（选择具体批次时）
    let currentSortOrder = 'asc';          // 班级排序通常升序（一班在前）
    // 搜索关键词
    let currentSearchKeyword = '';
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

    /**
     * 根据当前科目模式和是否选择了考试批次，返回可用的排序字段选项
     * @param {boolean} isTotal - 是否为总分模式
     * @param {boolean} hasExamDate - 是否选择了具体考试批次
     * @returns {Array<{value: string, label: string}>}
     */
    function getAvailableSortFields(isTotal, hasExamDate) {
        let fields = [];
        
        // 基础字段：分数排序（永远可用）
        fields.push({ value: isTotal ? 'totalScore' : 'subjectScore', label: isTotal ? '总分' : '单科成绩' });
        
        // 班级排序（永远可用，跨班查看时非常有意义）
        fields.push({ value: 'className', label: '班级' });
        
        // 学号排序（永远可用，便于定位学生）
        fields.push({ value: 'studentId', label: '学号' });
        
        // 姓名排序（新增，方便按姓名查找）
        fields.push({ value: 'studentName', label: '姓名' });
        
        // 仅当选择了具体批次时，才提供排名相关字段（排名数据才有效）
        if (hasExamDate) {
            if (isTotal) {
                // 总分模式下，年级排名实际上与总分降序结果一致，但保留以显示排名数值；班级排名跨班混合意义不大，但为完整性保留，用户可选
                fields.push({ value: 'totalGradeRank', label: '总分年级排名' });
                // 班级排名：跨班时按班级排名排序结果混乱，建议仅当筛选了单个班级时才有意义，但用户可自行选择，暂保留
                fields.push({ value: 'totalClassRank', label: '总分班级排名' });
            } else {
                fields.push({ value: 'subjectGradeRank', label: '单科年级排名' });
                fields.push({ value: 'subjectClassRank', label: '单科班级排名' });
            }
        }
        
        return fields;
    }

    /**
     * 对展示数据应用排序
     * @param {Array} data - 原始数据数组
     * @param {boolean} isTotal - 是否总分模式
     * @param {string} field - 排序字段标识
     * @param {string} order - 'asc' 或 'desc'
     * @returns {Array} 排序后的新数组
     */
    function applySorting(data, isTotal, field, order) {
        if (!data.length) return data;
        
        return [...data].sort((a, b) => {
            let valA, valB;
            
            // 根据字段取值
            switch (field) {
                case 'totalScore':
                case 'subjectScore':
                    valA = a.score || 0;
                    valB = b.score || 0;
                    break;
                case 'className':
                    // 班级排序：先比较班级名称，再按分数降序（作为二级排序）
                    const classNameCompare = (a.className || '').localeCompare(b.className || '', 'zh-CN');
                    if (classNameCompare !== 0) {
                        return order === 'asc' ? classNameCompare : -classNameCompare;
                    }
                    // 同班级内按分数降序（固定二级排序，不受主排序方向影响）
                    return (b.score || 0) - (a.score || 0);
                case 'studentId':
                    valA = a.studentId || '';
                    valB = b.studentId || '';
                    break;
                case 'studentName':
                    valA = a.studentName || '';
                    valB = b.studentName || '';
                    break;
                case 'totalGradeRank':
                    valA = a.classRank || 9999;
                    valB = b.classRank || 9999;
                    break;
                case 'totalClassRank':
                    valA = a.classRankInClass || 9999;
                    valB = b.classRankInClass || 9999;
                    break;
                case 'subjectGradeRank':
                    valA = a.grade_rank_subject || 9999;
                    valB = b.grade_rank_subject || 9999;
                    break;
                case 'subjectClassRank':
                    valA = a.class_rank_subject || 9999;
                    valB = b.class_rank_subject || 9999;
                    break;
                default:
                    return 0;
            }
            
            // 如果上面已经处理了班级多级排序（className 分支直接返回），则不会执行到这里
            // 对于其他字段，进行常规比较
            if (typeof valA === 'string') {
                const compareResult = valA.localeCompare(valB, 'zh-CN');
                return order === 'asc' ? compareResult : -compareResult;
            } else {
                return order === 'asc' ? valA - valB : valB - valA;
            }
        });
    }

    /**
     * 根据搜索关键词过滤数据（安全类型转换）
     * @param {Array} data - 原始数据数组
     * @param {string} keyword - 搜索关键词（不区分大小写）
     * @param {boolean} isTotal - 是否总分模式（用于判断可搜索字段）
     * @returns {Array} 过滤后的数组
     */
    function applySearchFilter(data, keyword, isTotal) {
        if (!keyword.trim()) return data;
        
        const lowerKeyword = keyword.trim().toLowerCase();
        return data.filter(item => {
            // 强制转换为字符串，避免数字类型调用 .toLowerCase() 报错
            const className = String(item.className || '').toLowerCase();
            const studentName = String(item.studentName || '').toLowerCase();
            const studentId = String(item.studentId || '').toLowerCase();
            const subject = isTotal ? '' : String(globalSubjectFilter || '').toLowerCase();
            
            return className.includes(lowerKeyword) ||
                studentName.includes(lowerKeyword) ||
                studentId.includes(lowerKeyword) ||
                (subject && subject.includes(lowerKeyword));
        });
    }

    // 全量成绩管理
    // ---------- 成绩管理（包含批次列、排序、搜索）----------
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

        // 基础状态
        let isTotal = (globalSubjectFilter === '总分');
        let hasExamDate = !!currentExamDate;  // 是否选择了具体批次，影响排名显示及批次列显示

        // ---------- 数据处理 ----------
        // 1. 班级筛选
        let displayData = [];
        if (isTotal) {
            displayData = scoresTotal.filter(s => globalClassFilter === '所有班级' || s.className === globalClassFilter);
        } else {
            displayData = allScores.filter(s => 
                s.subject === globalSubjectFilter &&
                (globalClassFilter === '所有班级' || s.className === globalClassFilter)
            );
        }

        // 2. 模糊搜索过滤
        displayData = applySearchFilter(displayData, currentSearchKeyword, isTotal);

        // 3. 计算统计数据（基于过滤后的数据）
        const stats = computeStats(displayData);

        // 4. 获取可用排序字段，并确保当前排序字段有效
        const sortOptions = getAvailableSortFields(isTotal, hasExamDate);
        if (!sortOptions.some(opt => opt.value === currentSortField)) {
            // 如果当前排序字段不可用（例如批次被清空后排名字段失效），重置为默认（班级）
            currentSortField = 'className';
            currentSortOrder = 'asc';
        }
        // 若用户未明确设置过排序，且选择了具体批次，则默认按班级排序（已在初始化时设置为 className）
        
        // 5. 应用排序
        displayData = applySorting(displayData, isTotal, currentSortField, currentSortOrder);

        // ---------- 构建UI组件 ----------
        // 统计卡片（与之前相同，略作调整以保证代码完整）
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

        // 动态表头：根据是否有批次决定是否显示“考试批次”列
        const examDateHeader = hasExamDate ? '' : '<th>考试批次</th>';
        
        const tableHeader = isTotal ? `
            <thead>
                <tr>
                    <th>姓名</th><th>学号</th>
                    ${examDateHeader}
                    <th>总分</th>
                    ${hasExamDate ? `<th>总分排名</th><th>班级排名</th>` : ''}
                    <th>操作</th>
                </tr>
            </thead>
        ` : `
            <thead>
                <tr>
                    <th>班级</th><th>姓名</th><th>学号</th>
                    ${examDateHeader}
                    <th>科目</th><th>成绩</th>
                    ${hasExamDate ? `<th>年级排名</th><th>班级排名</th>` : ''}
                    <th>操作</th>
                </tr>
            </thead>
        `;

        // 表格行生成
        const tableRows = displayData.map((s) => {
            // 格式化考试批次显示（仅当无批次筛选时展示）
            const examDateDisplay = hasExamDate ? '' : `<td>${s.exam_date ? new Date(s.exam_date).toLocaleDateString() : '—'}</td>`;
            
            return `
            <tr>
                ${isTotal ? '' : `<td>${escapeHtml(s.className || '')}</td>`}
                <td>${escapeHtml(s.studentName || '')}</td>
                <td>${escapeHtml(s.studentId || '')}</td>
                ${examDateDisplay}
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
        `}).join('');

        // 科目下拉选项
        const subjectOptions = allSubjects.map(sub =>
            `<option value="${sub}" ${globalSubjectFilter === sub ? 'selected' : ''}>${sub}</option>`
        ).join('');

        // 排序字段下拉选项 HTML
        const sortFieldOptionsHtml = sortOptions.map(opt =>
            `<option value="${opt.value}" ${currentSortField === opt.value ? 'selected' : ''}>${opt.label}</option>`
        ).join('');

        // 组装整个页面 HTML（新增搜索框和排序控件）
        const html = `
            <h3>全量成绩管理 (跨班级)</h3>
            <div class="filter-bar" style="display:flex; flex-wrap:wrap; align-items:center; gap:8px;">
                <select id="examSelect" class="filter-select"><option value="">加载中...</option></select>
                <select id="classFilterAll" class="filter-select">${getClassOptions()}</select>
                <select id="subjectFilterAll" class="filter-select">${subjectOptions}</select>
                <input type="text" id="searchInput" class="filter-select" placeholder="搜索班级/姓名/学号/科目" value="${escapeHtml(currentSearchKeyword)}" style="width:180px;">
                <button id="searchBtn" class="btn-sm" title="执行搜索">搜索</button>
                <div class="sort-controls" style="display:flex; align-items:center; gap:4px; margin-left:auto;">
                    <select id="sortFieldSelect" class="filter-select" style="width:auto;">${sortFieldOptionsHtml}</select>
                    <button id="toggleSortOrderBtn" class="btn-sm" title="切换排序方向">${currentSortOrder === 'asc' ? '↑' : '↓'}</button>
                </div>
                <button id="addScoreAllBtn" class="btn-primary btn-sm">+ 添加成绩</button>
                <button id="batchImportAllBtn" class="btn-sm">批量导入</button>
                <button id="exportAllBtn" class="btn-sm">导出CSV</button>
                <button id="downloadTemplateBtn" class="btn-sm">下载模板</button>
            </div>
            ${statsHtml}
            <table class="table">
                ${tableHeader}
                <tbody>${tableRows || '<tr><td colspan="8">暂无数据</td></tr>'}</tbody>
            </table>
        `;
        document.getElementById('scoreAllSection').innerHTML = html;

        // ---------- 事件绑定 ----------
        await loadExamList();
        
        // 设置下拉框当前值
        document.getElementById('classFilterAll').value = globalClassFilter;
        document.getElementById('examSelect').value = currentExamDate || '';
        
        // 绑定筛选事件
        document.getElementById('classFilterAll').addEventListener('change', (e) => {
            globalClassFilter = e.target.value;
            renderScoreAll();
        });
        document.getElementById('subjectFilterAll').addEventListener('change', (e) => {
            globalSubjectFilter = e.target.value;
            renderScoreAll();
        });
        document.getElementById('examSelect').addEventListener('change', async (e) => {
            currentExamDate = e.target.value;
            // 切换批次后，重置排序字段为班级（符合默认要求）
            currentSortField = 'className';
            currentSortOrder = 'asc';
            await renderScoreAll();
        });

        // 绑定搜索按钮点击事件
        const searchBtn = document.getElementById('searchBtn');
        const searchInput = document.getElementById('searchInput');
        if (searchBtn && searchInput) {
            const performSearch = () => {
                currentSearchKeyword = searchInput.value;
                renderScoreAll();
            };
            searchBtn.addEventListener('click', performSearch);
            // 回车触发搜索
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault(); // 防止可能的表单提交
                    performSearch();
                }
            });
        }
        
        // 绑定排序字段下拉
        document.getElementById('sortFieldSelect').addEventListener('change', (e) => {
            currentSortField = e.target.value;
            // 根据字段类型自动设置合理的默认排序方向
            if (currentSortField.includes('Rank') || currentSortField === 'className' || currentSortField === 'studentId' || currentSortField === 'studentName') {
                currentSortOrder = 'asc';   // 排名、班级、学号、姓名通常升序
            } else {
                currentSortOrder = 'desc';  // 分数类默认降序
            }
            renderScoreAll();
        });
        
        // 绑定排序方向切换
        document.getElementById('toggleSortOrderBtn').addEventListener('click', () => {
            currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
            renderScoreAll();
        });
        
        // 其他按钮事件
        document.getElementById('addScoreAllBtn').addEventListener('click', () => openAddScoreModal());
        document.getElementById('exportAllBtn').addEventListener('click', () => exportScoreCSV(displayData, isTotal, hasExamDate));

        document.getElementById('batchImportAllBtn').addEventListener('click', () => {
            // 创建文件选择 input
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.csv';
            fileInput.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const csv = ev.target.result;
                    importFromCSV(csv);
                };
                reader.readAsText(file, 'UTF-8');
            };
            fileInput.click();
        });

        document.getElementById('downloadTemplateBtn').addEventListener('click', () => {
            const csv = '班级,姓名,学号,科目,成绩,考试日期(可选)\n高一1班,张三,2024001,数学,85,2026-04-12';
            const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = '成绩导入模板.csv';
            a.click();
            URL.revokeObjectURL(url);
        });
                
        // 绑定编辑/删除按钮
        bindScoreActions();
    }

    async function importFromCSV(csvText) {
        const lines = csvText.trim().split('\n');
        if (lines.length < 2) {
            alert('CSV 至少需要表头和一行数据');
            return;
        }
        
        // 解析表头（简单按逗号分割）
        const headers = lines[0].split(',').map(h => h.trim());
        const classIdx = headers.indexOf('班级');
        const nameIdx = headers.indexOf('姓名');
        const idIdx = headers.indexOf('学号');
        const subjectIdx = headers.indexOf('科目');
        const scoreIdx = headers.indexOf('成绩');
        const dateIdx = headers.indexOf('考试日期'); // 可选
        
        if (classIdx === -1 || nameIdx === -1 || idIdx === -1 || subjectIdx === -1 || scoreIdx === -1) {
            alert('CSV 表头必须包含：班级,姓名,学号,科目,成绩');
            return;
        }
        
        let successCount = 0;
        let failCount = 0;
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const cols = line.split(',').map(c => c.trim());
            const className = cols[classIdx] || '';
            const studentName = cols[nameIdx] || '';
            const studentId = cols[idIdx] || '';
            const subject = cols[subjectIdx] || '';
            const score = parseFloat(cols[scoreIdx]);
            const examDate = cols[dateIdx] || currentExamDate || '';
            
            if (!className || !studentName || !studentId || !subject || isNaN(score)) {
                failCount++;
                continue;
            }
            
            // 复用现有的添加成绩逻辑（直接调用后端单条接口）
            try {
                const res = await fetch('/admin/scores', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ className, studentName, studentId, subject, score, examDate })
                });
                const data = await res.json();
                if (data.success) {
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (err) {
                failCount++;
            }
        }
        
        alert(`导入完成：成功 ${successCount} 条，失败 ${failCount} 条。`);
        // 刷新成绩列表
        await refreshScoresData();
        if (globalSubjectFilter === '总分') await refreshTotalScoresData();
        renderScoreAll();
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
        // 填充考试批次下拉（从 examList 获取）
        const examSelect = document.getElementById('addScoreExamDate');
        examSelect.innerHTML = '<option value="">默认(当天)</option>';
        examList.forEach(dateStr => {
            examSelect.innerHTML += `<option value="${dateStr}">${dateStr}</option>`;
        });
        // 如果当前有选中的考试批次，则默认选中（方便快速添加同批次成绩）
        if (currentExamDate) {
            examSelect.value = currentExamDate;
        }
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
        const examDate = document.getElementById('addScoreExamDate').value;  // 获取选中的考试批次

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
            body: JSON.stringify({ 
                className, 
                studentName, 
                studentId, 
                subject, 
                score, 
                examDate: examDate || undefined  
            })
        });
        const data = await res.json();
        if (data.success) {
            alert("添加成功");
            closeModal('addScoreModal');
            // 刷新数据
            await refreshScoresData();
            if (globalSubjectFilter === '总分') await refreshTotalScoresData();
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

    /**
     * 导出当前成绩数据为 CSV 文件
     * @param {Array} data - 已过滤、排序后的展示数据
     * @param {boolean} isTotal - 是否为总分模式
     * @param {boolean} hasExamDate - 是否选择了具体考试批次
     */
    function exportScoreCSV(data, isTotal, hasExamDate) {
        if (!data || data.length === 0) {
            alert('没有数据可导出');
            return;
        }

        // 1. 构建表头（与表格显示一致）
        const headers = [];
        if (!isTotal) {
            headers.push('班级');
        }
        headers.push('姓名', '学号');
        if (!hasExamDate) {
            headers.push('考试批次');
        }
        if (!isTotal) {
            headers.push('科目');
        }
        headers.push(isTotal ? '总分' : '成绩');
        
        if (hasExamDate) {
            if (isTotal) {
                headers.push('总分排名', '班级排名');
            } else {
                headers.push('年级排名', '班级排名');
            }
        }

        // 2. 转换数据为 CSV 行
        const rows = data.map(item => {
            const row = [];
            
            if (!isTotal) {
                row.push(item.className || '');
            }
            row.push(item.studentName || '');
            row.push(item.studentId || '');
            
            if (!hasExamDate) {
                // 格式化考试日期
                const examDate = item.exam_date ? new Date(item.exam_date).toLocaleDateString() : '';
                row.push(examDate);
            }
            
            if (!isTotal) {
                row.push(globalSubjectFilter);  // 当前科目名称
            }
            
            row.push(item.score);
            
            if (hasExamDate) {
                if (isTotal) {
                    row.push(item.classRank || '');
                    row.push(item.classRankInClass || '');
                } else {
                    row.push(item.grade_rank_subject || '');
                    row.push(item.classr_rank_subject || '');
                }
            }
            
            // 处理可能包含逗号、换行符的字段（用双引号包裹）
            return row.map(cell => {
                if (typeof cell === 'string' && (cell.includes(',') || cell.includes('\n') || cell.includes('"'))) {
                    return `"${cell.replace(/"/g, '""')}"`;
                }
                return cell;
            }).join(',');
        });

        // 3. 组合 CSV 内容
        const csvContent = [headers.join(','), ...rows].join('\n');
        
        // 4. 添加 BOM 并下载
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        // 生成文件名（包含科目、批次信息）
        const subjectPart = isTotal ? '总分' : globalSubjectFilter;
        const datePart = hasExamDate ? currentExamDate : '所有批次';
        a.download = `成绩_${subjectPart}_${datePart}.csv`;
        
        a.click();
        URL.revokeObjectURL(url);
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