// API 请求封装
const API = {
    async request(url, options = {}) {
        try {
            const res = await fetch(url, options);
            if (res.redirected) {
                window.location.href = res.url;
                return;
            }
            if (!res.ok) {
                // 尝试解析错误响应
                let errorMessage = `请求失败 (${res.status})`;
                try {
                    const errData = await res.json();
                    errorMessage = errData.message || errorMessage;
                } catch (e) {
                    // 非 JSON 响应，使用状态文本
                    errorMessage = `服务器错误: ${res.status} ${res.statusText}`;
                }
                throw new Error(errorMessage);
            }
            
            const data = await res.json();
            
            // 业务层面的失败（有些接口返回 200 但 success: false）
            if (data && data.success === false) {
                throw new Error(data.message || '操作失败');
            }
            
            return data;
        } catch (err) {
            console.error('API Error:', err);
            throw err;
        }
    },

    logout() {
        window.location.href = '/logout';
    },

    // 教务端
    admin: {
        getInfo: () => API.request('/admin/info'),
        getClasses: (params = {}) => {
            const query = new URLSearchParams(params).toString();
            return API.request(`/admin/classes?${query}`);
        },        
        getTeachers: () => API.request('/admin/teachers'),
        getGrades: () => API.request('/admin/grades'),
        getExams: () => API.request('/admin/exams'),
        getNotices: (params = {}) => {
            const query = new URLSearchParams(params).toString();
            return API.request(`/admin/notices?${query}`);
        },
        getLogs: (page = 1, pageSize = 15) => API.request(`/admin/logs?page=${page}&pageSize=${pageSize}`),
        getScores: (params = {}) => {
            const query = new URLSearchParams(params).toString();
            return API.request(`/admin/scores?${query}`);
        },
        getSubjects: () => API.request(`/admin/subjects`),
        getTotalScores: (params = {}) => {
            const query = new URLSearchParams(params).toString();
            return API.request(`/admin/totalscores?${query}`);
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

    // 教师端
    teacher: {
        getInfo: () => API.request('/teacher/info'),
        getExams: () => API.request('/teacher/exams'),
        getScores: (examDate = '') => {
            const url = examDate ? `/teacher/scores?exam_date=${examDate}` : '/teacher/scores';
            return API.request(url);
        },
        getTotalScores: (examDate = '') => {
            const url = examDate ? `/teacher/totalscores?exam_date=${examDate}` : '/teacher/totalscores';
            return API.request(url);
        },
        getGeneral: (examDate = '') => {
            const url = examDate ? `/teacher/general?exam_date=${examDate}` : '/teacher/general';
            return API.request(url);
        },
        getSubjectGeneral: (examDate = '') => {
            const url = examDate ? `/teacher/subjectgeneral?exam_date=${examDate}` : '/teacher/subjectgeneral';
            return API.request(url);
        },
        getNotices: () => API.request('/teacher/notices'),
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
        getComment: (studentId, examDate = '', style = 'formal', subject = '') => API.request('/teacher/comment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId, examDate, style, subject })
        }),
        draftNotice: (keywords, style = 'formal') => API.request('/teacher/notices/draft', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keywords, style })
        }),
        getTrend: (studentId, subject = '') => {
            const params = new URLSearchParams({ studentId });
            if (subject) params.append('subject', subject);
            return API.request(`/teacher/trend?${params}`);
        }
    },

    // 学生端
    student: {
        getInfo: () => API.request('/student/info'),
        getExams: () => API.request('/student/exams'),
        getGrade: (examDate = '') => {
            const url = examDate ? `/student/grade?exam_date=${examDate}` : '/student/grade';
            return API.request(url);
        },
        getTrend: (subject) => {
            const query = new URLSearchParams({ subject }).toString();
            return API.request(`/student/trend?${query}`);
        },
        getTotalRank: (examDate = '') => {
            const url = examDate ? `/student/totalrank?exam_date=${examDate}` : '/student/totalrank';
            return API.request(url);
        },
        getClassStat: (examDate = '') => {
            const url = examDate ? `/student/classstat?exam_date=${examDate}` : '/student/classstat';
            return API.request(url);
        },
        getNotices: () => API.request('/student/notices'),
        markNoticeRead: (noticeId) => API.request('/student/notices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notice_id: noticeId, is_read: 1 })
        }),
        getDiagnosis: (subject = '') => {
            const query = subject ? `?subject=${encodeURIComponent(subject)}` : '';
            return API.request(`/student/diagnosis${query}`);
        }
    }
};

window.API = API;