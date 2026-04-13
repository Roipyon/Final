// ================== API 请求封装 ==================
const API = {
    /**
     * 生成缓存键
     */
    _generateCacheKey(url, options) {
        const method = options.method || 'GET';
        const body = options.body || '';
        return `api:${method}:${url}:${body}`;
    },

    /**
     * 后台静默刷新缓存
     */
    async _backgroundRefresh(url, options, cacheKey, ttl) {
        try {
            const res = await fetch(url, options);
            if (res.ok) {
                const data = await res.json();
                Cache.set(cacheKey, data, ttl);
            }
        } catch (e) {
            // 静默失败
        }
    },

    /**
     * 统一请求方法
     */
    async request(url, options = {}, cacheOptions = {}) {
        const { useCache = false, cacheKey, ttl = 600 } = cacheOptions;
        const finalCacheKey = cacheKey || this._generateCacheKey(url, options);

        // 尝试从缓存获取
        if (useCache) {
            const cached = Cache.get(finalCacheKey);
            if (cached) {
                // 后台静默更新
                this._backgroundRefresh(url, options, finalCacheKey, ttl);
                return cached;
            }
        }

        try {
            const res = await fetch(url, options);
            if (res.redirected) {
                window.location.href = res.url;
                return;
            }
            if (!res.ok) {
                const errJson = await res.json().catch(() => ({}));
                throw new Error(`请求失败 ${res.status}: ${errJson.message || ''}`);
            }
            const data = await res.json();

            if (useCache) {
                Cache.set(finalCacheKey, data, ttl);
            }
            return data;
        } catch (err) {
            console.error('API Error:', err);
            // 网络失败时降级返回过期缓存
            if (useCache) {
                const staleCache = Cache.get(finalCacheKey, true);
                if (staleCache) {
                    console.warn('网络请求失败，使用过期缓存');
                    window.dispatchEvent(new CustomEvent('using-stale-cache'));
                    return staleCache;
                }
            }
            throw err;
        }
    },

    logout() {
        window.location.href = '/logout';
    },

    // ========== 教务端 ==========
    admin: {
        getInfo: (cacheOptions = {}) => API.request('/admin/info', {}, cacheOptions),
        getClasses: (cacheOptions = {}) => API.request('/admin/classes', {}, cacheOptions),
        getTeachers: (cacheOptions = {}) => API.request('/admin/teachers', {}, cacheOptions),
        getGrades: (cacheOptions = {}) => API.request('/admin/grades', {}, cacheOptions),
        getExams: (cacheOptions = {}) => API.request('/admin/exams', {}, cacheOptions),
        getNotices: (cacheOptions = {}) => API.request('/admin/notices', {}, cacheOptions),
        getLogs: (cacheOptions = {}) => API.request('/admin/logs', {}, cacheOptions),
        getScores: (examDate = '', cacheOptions = {}) => {
            const url = examDate ? `/admin/scores?exam_date=${examDate}` : '/admin/scores';
            return API.request(url, {}, cacheOptions);
        },
        getTotalScores: (examDate = '', cacheOptions = {}) => {
            const url = examDate ? `/admin/totalscores?exam_date=${examDate}` : '/admin/totalscores';
            return API.request(url, {}, cacheOptions);
        },
        addClass: (className, gradeId) => API.request('/admin/classes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ className, gradeId })
        }),
        updateClass: (classId, className, gradeId) => API.request(`/admin/classes/${classId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ className, gradeId })
        }),
        deleteClass: (classId) => API.request(`/admin/classes/${classId}`, { method: 'DELETE' }),
        bindTeacher: (classId, teacherId) => API.request(`/admin/classes/${classId}/teacher`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ teacherId })
        }),
        addStudent: (classId, name, studentId) => API.request(`/admin/classes/${classId}/students`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, studentId })
        }),
        deleteStudent: (classId, studentId) => API.request(`/admin/classes/${classId}/students/${studentId}`, {
            method: 'DELETE'
        }),
        addScore: (data) => API.request('/admin/scores', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }),
        updateScore: (scoreId, newScore) => API.request(`/admin/scores/${scoreId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newScore })
        }),
        deleteScore: (scoreId) => API.request(`/admin/scores/${scoreId}`, { method: 'DELETE' }),
        addTeacher: (name) => API.request('/admin/teachers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        }),
        getFullMark: (subject) => API.request('/admin/fullmark', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subject })
        }),
    },

    // ========== 教师端 ==========
    teacher: {
        getInfo: (cacheOptions = {}) => API.request('/teacher/info', {}, cacheOptions),
        getExams: (cacheOptions = {}) => API.request('/teacher/exams', {}, cacheOptions),
        getScores: (examDate = '', cacheOptions = {}) => {
            const url = examDate ? `/teacher/scores?exam_date=${examDate}` : '/teacher/scores';
            return API.request(url, {}, cacheOptions);
        },
        getTotalScores: (examDate = '', cacheOptions = {}) => {
            const url = examDate ? `/teacher/totalscores?exam_date=${examDate}` : '/teacher/totalscores';
            return API.request(url, {}, cacheOptions);
        },
        getGeneral: (examDate = '', cacheOptions = {}) => {
            const url = examDate ? `/teacher/general?exam_date=${examDate}` : '/teacher/general';
            return API.request(url, {}, cacheOptions);
        },
        getSubjectGeneral: (examDate = '', cacheOptions = {}) => {
            const url = examDate ? `/teacher/subjectgeneral?exam_date=${examDate}` : '/teacher/subjectgeneral';
            return API.request(url, {}, cacheOptions);
        },
        getNotices: (cacheOptions = {}) => API.request('/teacher/notices', {}, cacheOptions),
        getLogs: (page = 1, pageSize = 15) => API.request(`/teacher/logs?page=${page}&pageSize=${pageSize}`),
        updateScore: (scoreId, newScore) => API.request(`/teacher/scores/${scoreId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newScore })
        }),
        publishNotice: (title, content) => API.request('/teacher/notices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content })
        }),
        updateNotice: (noticeId, title, content) => API.request(`/teacher/notices/${noticeId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content })
        }),
        deleteNotice: (noticeId) => API.request(`/teacher/notices/${noticeId}`, { method: 'DELETE' }),
        getNoticeReadStatus: (noticeId) => API.request(`/teacher/notices/${noticeId}/read-status`),
        getFullMark: (subject) => API.request('/teacher/fullmark', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subject })
        }),
    },

    // ========== 学生端 ==========
    student: {
        getInfo: (cacheOptions = {}) => API.request('/student/info', {}, cacheOptions),
        getExams: (cacheOptions = {}) => API.request('/student/exams', {}, cacheOptions),
        getGrade: (examDate = '', cacheOptions = {}) => {
            const url = examDate ? `/student/grade?exam_date=${examDate}` : '/student/grade';
            return API.request(url, {}, cacheOptions);
        },
        getTotalRank: (examDate = '', cacheOptions = {}) => {
            const url = examDate ? `/student/totalrank?exam_date=${examDate}` : '/student/totalrank';
            return API.request(url, {}, cacheOptions);
        },
        getClassStat: (examDate = '', cacheOptions = {}) => {
            const url = examDate ? `/student/classstat?exam_date=${examDate}` : '/student/classstat';
            return API.request(url, {}, cacheOptions);
        },
        getNotices: (cacheOptions = {}) => API.request('/student/notices', {}, cacheOptions),
        markNoticeRead: (noticeId) => API.request('/student/notices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notice_id: noticeId, is_read: 1 })
        }),
    }
};

window.API = API;