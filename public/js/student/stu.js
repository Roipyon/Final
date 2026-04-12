(async ()=>{
    // 登录用户信息
    let currentStudent = null;
    let _response = await fetch('/student/info',{method: 'get'});
    currentStudent = await _response.json();

    // 个人成绩
    let personalScores = null;
    _response = await fetch('/student/grade',{method: 'get'});
    personalScores = await _response.json();

    // 总分、平均分班级排名
    let personalTotal = null;
    _response = await fetch('/student/totalrank',{method: 'get'});
    personalTotal = await _response.json();
    
    // 班级统计数据（按科目维度）
    let classStatBySubject = null;
    _response = await fetch('/student/classstat',{method: 'get'});
    classStatBySubject = await _response.json();

    // 班级通知数据（含已读未读）
    let notices = null;
    _response = await fetch('/student/notices',{method: 'get'});
    notices = Array.from(await _response.json());

    // 通知分页与筛选状态
    let currentNoticePage = 1;
    let noticeFilter = "all";   // 'all' 或 'unread'
    const NOTICES_PER_PAGE = 5; // 每一页通知的通知数

    // 成绩科目筛选
    let currentSubjectFilter = "数学";
    let currentExamDate = ''; // 当前选中的考试日期，空表示最新
    let examList = []; // 考试日期列表

    // 加载考试日期列表
    async function loadExamList() {
        const response = await fetch('/student/exams');
        examList = await response.json();
        console.log(examList)
        const select = document.getElementById('examSelect');
        console.log(select)
        if (!select) return;
        select.innerHTML = '<option value="">最新考试</option>';
        for (let date of examList) {
            select.innerHTML += `<option value="${date}">${new Date(date).toLocaleDateString()}</option>`;
        }
        if (currentExamDate) select.value = currentExamDate;
    }

    // 刷新数据
    async function refreshAllData(examDate) {
        // 将 ISO 日期转换为 YYYY-MM-DD 格式
        let formattedDate = '';
        if (examDate) {
            // examDate 可能是 "2026-04-10T16:00:00.000Z" 或空字符串
            formattedDate = new Date(examDate).toLocaleDateString().replaceAll('/','-'); // 2026-04-11
        }
        // 构建带参数的 URL
        let gradeUrl = '/student/grade';
        let totalRankUrl = '/student/totalrank';
        let classStatUrl = '/student/classstat';
        if (examDate) {
            gradeUrl += `?exam_date=${formattedDate}`;
            totalRankUrl += `?exam_date=${formattedDate}`;
            classStatUrl += `?exam_date=${formattedDate}`;
        }
        // 获取个人成绩
        let response = await fetch(gradeUrl);
        personalScores = await response.json();
        // 获取总分排名
        response = await fetch(totalRankUrl);
        personalTotal = await response.json();
        // 获取班级统计
        response = await fetch(classStatUrl);
        classStatBySubject = await response.json();
    }

    function getUnreadCount() {
        return notices.filter(n => !n.isRead).length;
    }

    // 获取过滤并排序后的通知（未读优先 + 时间倒序）
    function getFilteredSortedNotices() {
        let filtered = [...notices];
        if (noticeFilter === "unread") {
            filtered = filtered.filter(n => !n.isRead);
        }
        // 排序：未读优先，同状态下时间倒序
        filtered.sort((a, b) => {
            if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
            return new Date(b.publishTime) - new Date(a.publishTime);
        });
        return filtered;
    }

    // 标记通知为已读
    async function markNoticeAsRead(noticeId) {
        const notice = notices.find(n => n.id === noticeId);
        if (notice && !notice.isRead) {
            notice.isRead = true;
            // 状态更新至后端
            const response = await fetch('/student/notices',{
                method: 'post',
                headers: {'Content-Type':'application/json'},
                body: JSON.stringify({
                    notice_id: noticeId,
                    is_read: 1
                })
            });
            // 重新渲染当前活动模块
            const activeNav = document.querySelector('.sidebar-menu a.active')?.getAttribute('data-nav');
            if (activeNav === 'notice') {
                renderNoticeModule();
            } else if (activeNav === 'home') {
                renderHomeModule();
            }
            // 同时更新所有未读角标
            updateUnreadBadges();
        }
    }

    function updateUnreadBadges() {
        const unread = getUnreadCount();
        const badges = document.querySelectorAll('.unread-badge');
        badges.forEach(b => b.textContent = `${unread}条未读`);
    }

    // 渲染顶部信息
    function renderHeaderInfo()
    {
        document.querySelector('.user-info .user-avatar').innerText = `${currentStudent.name.slice(0,1)}`;
        document.querySelector('.user-info span').innerText = `${currentStudent.name}`;
    }
    // ---------- 渲染首页模块 ----------
    function renderHomeModule() {
        const unreadCount = getUnreadCount();
        // 取前3条通知（已排序，未读优先）
        const sortedNotices = getFilteredSortedNotices();
        const topNotices = sortedNotices.slice(0, 3);
        // 成绩亮点取前4科
        const topSubjects = personalScores.slice(0, 4);

        const homeHtml = `
            <div style="margin-bottom: 20px;">
                <h3>学习概览</h3>
                <p style="color:var(--gray); margin-top: 8px;">${currentStudent.name}同学，欢迎回来！班级整体学风良好，继续加油。</p>
            </div>
            <div class="summary-flex">
                <div class="summary-card"><div class="summary-number">${personalTotal.total}</div><div>总分</div></div>
                <div class="summary-card"><div class="summary-number">${Number(personalTotal.totalAvg).toFixed(1)}</div><div>平均分</div></div>
                <div class="summary-card"><div class="summary-number">${personalTotal.totalRank}</div><div>班级排名</div></div>
            </div>
            <div style="margin-top: 24px;">
                <h4>近期成绩亮点</h4>
                <table class="table score-table">
                    <thead><tr><th>科目</th><th>成绩</th><th>班级均分</th><th>对比</th></tr></thead>
                    <tbody>
                        ${topSubjects.map(s => {
                            const diff = (s.score - s.classAvg).toFixed(1);
                            const diffClass = diff >= 0 ? 'compare-text' : 'compare-text down';
                            const diffSymbol = diff >= 0 ? `▲ +${diff}` : `▼ ${diff}`;
                            return `<tr><td>${s.subject}</td><td>${s.score}</td><td>${s.classAvg}</td><td class="${diffClass}">${diffSymbol}</td></tr>`;
                        }).join('')}
                    </tbody>
                </table>
                <div style="text-align:right; margin-top: 12px;"><a href="javascript:void(0)" data-nav="score" class="nav-link" style="color:var(--primary);">查看全部成绩 →</a></div>
            </div>
            <div style="margin-top: 28px;">
                <h4>最新班级通知 <span class="badge unread-badge" style="background:var(--warning);">${unreadCount}条未读</span></h4>
                <div id="homeNoticeList">
                    ${topNotices.length ? topNotices.map(notice => `
                        <div class="recent-notice-item ${notice.isRead ? '' : 'unread'}" data-id="${notice.id}" style="cursor:pointer;">
                            <div style="font-weight:600;">${notice.title} ${!notice.isRead ? '<span class="notice-badge-sm">未读</span>' : ''}</div>
                            <div style="font-size:12px; color:var(--gray); margin-top:4px;">${new Date(notice.publishTime).toLocaleString()}</div>
                        </div>
                    `).join('') : '<div class="empty-tip" style="padding:20px;text-align:center;">暂无通知</div>'}
                </div>
                <div style="text-align:right; margin-top: 12px;"><a href="javascript:void(0)" data-nav="notice" class="nav-link" style="color:var(--primary);">查看全部通知 →</a></div>
            </div>
        `;
        document.getElementById('homeSection').innerHTML = homeHtml;
        // 绑定首页通知点击标记已读
        document.querySelectorAll('#homeNoticeList .recent-notice-item').forEach(el => {
            const id = parseInt(el.getAttribute('data-id'));
            if (id) {
                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    markNoticeAsRead(id);
                });
            }
        });
        // 绑定内部导航链接
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                const nav = link.getAttribute('data-nav');
                if (nav) switchToSection(nav);
            });
        });
    }

    // 成绩模块渲染（个人成绩 + 班级统计 + 科目筛选）
    async function renderScoreModule() {
        // 根据当前选中的日期刷新数据
        await refreshAllData(currentExamDate);
        renderHomeModule();   // 更新首页的统计数字和成绩亮点

        let stat = null;
        if (classStatBySubject.length === 1) {
            stat = classStatBySubject[0];
            currentSubjectFilter = classStatBySubject[0].subject;
        }
        else {
            classStatBySubject.forEach(e=>{
            if (e.subject === currentSubjectFilter)
                {stat = e;return;}
            });
        }
        if (!stat) {
            stat = { avg: '--', max: '--', min: '--', passCount: 0, totalStu: 0, passRate: '0%' };
        }
        
        // 生成个人成绩表格行（使用 personalScores）
        const tableRows = personalScores.map(s => {
            const diff = (s.score - s.classAvg).toFixed(1);
            const diffClass = diff >= 0 ? 'compare-text' : 'compare-text down';
            const diffSymbol = diff >= 0 ? `+${diff}` : `${diff}`;
            return `
                <tr>
                    <td><strong>${s.subject}</strong></td>
                    <td>${s.score}</td>
                    <td>${s.classAvg}</td>
                    <td>${s.classRank}</td>
                    <td class="${diffClass}">${diffSymbol}</td>
                </tr>
            `;
        }).join('');

        const html = `
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; margin-bottom:16px;">
                <h3>我的成绩 · ${currentStudent.className}</h3>
                <div class="filter-bar">
                    <select id="examSelect" class="filter-select">
                        <option value="">加载中...</option></select>
                    <select id="subjectFilterSelect" class="filter-select">
                        ${classStatBySubject.map(sub => `<option value="${sub.subject}" ${sub.subject === currentSubjectFilter ? 'selected' : ''}>${sub.subject}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="table-wrapper">
                <table class="table score-table">
                    <thead>
                        <tr><th>科目</th><th>成绩</th><th>班级平均分</th><th>班级排名</th><th>对比均分</th></tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            </div>
            <div style="margin-top: 28px;">
                <h4>班级统计数据 · ${currentSubjectFilter}</h4>
                <div class="stats-grid">
                    <div class="stat-card"><div class="stat-value">${stat.avg}</div><div class="stat-label">平均分</div></div>
                    <div class="stat-card"><div class="stat-value">${stat.max}</div><div class="stat-label">最高分</div></div>
                    <div class="stat-card"><div class="stat-value">${stat.min}</div><div class="stat-label">最低分</div></div>
                    <div class="stat-card"><div class="stat-value">${stat.passCount}/${stat.totalStu}</div><div class="stat-label">及格人数</div></div>
                    <div class="stat-card"><div class="stat-value">${stat.passRate}</div><div class="stat-label">及格率</div></div>
                </div>
            </div>
        `;
        document.getElementById('scoreSection').innerHTML = html;

        // 确保考试日期下拉框已加载
        await loadExamList();

        // 绑定科目筛选事件
        const selector = document.getElementById('subjectFilterSelect');
        if (selector) {
            selector.addEventListener('change', (e) => {
                currentSubjectFilter = e.target.value;
                renderScoreModule();
            });
        }
        // 绑定考试日期切换事件
        const examSelector = document.getElementById('examSelect');
        if (examSelector) {
            examSelector.addEventListener('change', async (e) => {
                currentExamDate = e.target.value;
                await renderScoreModule();  // 重新加载数据并渲染
            });
        }
    }

    // 通知模块渲染（分页 + 筛选 + 标记已读）
    function renderNoticeModule() {
        const filteredSorted = getFilteredSortedNotices();
        const totalPages = Math.ceil(filteredSorted.length / NOTICES_PER_PAGE);
        if (currentNoticePage > totalPages) currentNoticePage = Math.max(1, totalPages);
        const start = (currentNoticePage - 1) * NOTICES_PER_PAGE;
        const pageNotices = filteredSorted.slice(start, start + NOTICES_PER_PAGE);
        const unreadCount = getUnreadCount();

        const noticeHtml = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap:wrap; gap:12px;">
                <h3>班级通知 <span class="badge unread-badge" style="background:var(--warning);">${unreadCount}条未读</span></h3>
                <div class="filter-btn-group">
                    <button class="filter-select ${noticeFilter === 'all' ? 'active-filter' : ''}" data-filter="all">全部</button>
                    <button class="filter-select ${noticeFilter === 'unread' ? 'active-filter' : ''}" data-filter="unread">未读</button>
                </div>
            </div>
            <div id="noticeListContainer">
                ${pageNotices.length ? pageNotices.map(notice => `
                    <div class="notice-item ${notice.isRead ? '' : 'unread'}" data-id="${notice.id}" style="cursor:pointer; margin-bottom:12px;">
                        <div class="notice-title">
                            ${notice.title}
                            ${!notice.isRead ? '<span class="notice-badge-sm">未读</span>' : '<span style="font-size:11px; color:var(--gray);">已读</span>'}
                        </div>
                        <div class="notice-content">${notice.content}</div>
                        <div class="notice-time">${new Date(notice.publishTime).toLocaleString()} | 班主任：${notice.teacher_name}</div>
                    </div>
                `).join('') : '<div class="empty-tip" style="padding:30px;text-align:center;">暂无通知</div>'}
            </div>
            <div class="pagination" id="noticePagination">
                ${Array.from({ length: totalPages }, (_, i) => i+1).map(p => 
                    `<button class="page-btn ${p === currentNoticePage ? 'active-page' : ''}" data-page="${p}">${p}</button>`
                ).join('')}
            </div>
        `;
        document.getElementById('noticeSection').innerHTML = noticeHtml;
        // 绑定通知项点击标记已读
        document.querySelectorAll('#noticeListContainer .notice-item').forEach(item => {
            const id = parseInt(item.getAttribute('data-id'));
            if (id) {
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    markNoticeAsRead(id);
                });
            }
        });
        // 绑定筛选按钮
        const filterBtns = document.querySelectorAll('.filter-btn-group .filter-select');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filterVal = btn.getAttribute('data-filter');
                if (filterVal === 'all' || filterVal === 'unread') {
                    noticeFilter = filterVal;
                    currentNoticePage = 1;
                    renderNoticeModule();
                }
            });
        });
        // 绑定分页事件
        const pageBtns = document.querySelectorAll('#noticePagination .page-btn');
        pageBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const page = parseInt(btn.getAttribute('data-page'));
                if (!isNaN(page) && page !== currentNoticePage) {
                    currentNoticePage = page;
                    renderNoticeModule();
                }
            });
        });
        updateUnreadBadges();
    }

    // 统一切换模块
    function switchToSection(sectionType) {
        // 更新菜单高亮
        document.querySelectorAll('.sidebar-menu a').forEach(link => {
            const nav = link.getAttribute('data-nav');
            if (nav === sectionType) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
        // 隐藏所有section，显示当前
        document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
        let targetSection = null;
        let title = '';
        if (sectionType === 'home') {
            targetSection = document.getElementById('homeSection');
            title = '学生首页';
            renderHomeModule();
        } else if (sectionType === 'score') {
            targetSection = document.getElementById('scoreSection');
            title = '我的成绩';
            renderScoreModule();
        } else if (sectionType === 'notice') {
            targetSection = document.getElementById('noticeSection');
            title = '班级通知';
            renderNoticeModule();
        }
        if (targetSection) targetSection.classList.add('active');
        document.getElementById('pageTitle').textContent = title;
        // 移动端关闭侧边栏
        const sidebar = document.getElementById('sidebar');
        if (sidebar.classList.contains('show')) sidebar.classList.remove('show');
    }

    // 初始化导航事件与默认页
    async function initNavigation() {
        renderHeaderInfo();
        await refreshAllData('');  // 加载默认最新批次数据
        const navLinks = document.querySelectorAll('.sidebar-menu a');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const nav = link.getAttribute('data-nav');
                if (nav) switchToSection(nav);
            });
        });
        // 退出按钮演示
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                window.location.href = '/logout';
            });
        }
        // 默认加载首页
        switchToSection('home');
    }

    // 页面启动
    initNavigation();
})();