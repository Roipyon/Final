// ================== API 请求封装 ==================
const API = {
    async request(url, options = {}) {
        try {
            const res = await fetch(url, options);
            if (res.redirected) {
                window.location.href = res.url;
                return;
            }
            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`请求失败 ${res.status}: ${errText}`);
            }
            return await res.json();
        } catch (err) {
            console.error('API Error:', err);
            alert('操作失败，请稍后重试');
            throw err;
        }
    },

    logout() {
        window.location.href = '/logout';
    },

    // ========== 教务端 ==========
    admin: {
        getInfo: () => API.request('/admin/info'),
        getClasses: () => API.request('/admin/classes'),
        getTeachers: () => API.request('/admin/teachers'),
        getGrades: () => API.request('/admin/grades'),
        getExams: () => API.request('/admin/exams'),
        getNotices: () => API.request('/admin/notices'),
        getLogs: () => API.request('/admin/logs'),
        getScores: (examDate = '') => {
            const url = examDate ? `/admin/scores?exam_date=${examDate}` : '/admin/scores';
            return API.request(url);
        },
        getTotalScores: (examDate = '') => {
            const url = examDate ? `/admin/totalscores?exam_date=${examDate}` : '/admin/totalscores';
            return API.request(url);
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
    },

    // ========== 教师端 ==========
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
        updateScore: (studentId, subject, newScore) => API.request('/teacher/scores', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId, subject, newScore })
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
        getInfo: () => API.request('/student/info'),
        getExams: () => API.request('/student/exams'),
        getGrade: (examDate = '') => {
            const url = examDate ? `/student/grade?exam_date=${examDate}` : '/student/grade';
            return API.request(url);
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
    }
};

window.API = API;