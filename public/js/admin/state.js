// ================== 教务端全局状态 ==================
// 使用一个单例对象存储所有可变数据

export const AdminState = {
    // 用户信息
    currentAdmin: null,
    
    // 基础数据
    classes: [],
    allTeachers: [],
    gradeList: [],
    examList: [],
    allSubjects: [],
    
    // 成绩数据
    allScores: [],
    scoresTotal: [],
    allNotices: [],
    systemLogs: [],
    
    // 筛选条件
    currentExamDate: '',
    globalSubjectFilter: '数学',
    globalClassFilter: '所有班级',
    currentSearchKeyword: '',
    
    // 排序
    currentSortField: 'className',
    currentSortOrder: 'asc',
    
    // 日志分页
    currentLogPage: 1,
    logsPerPage: 15,
    
    // 临时编辑ID
    currentEditScoreId: null,
    currentEditClassId: null,
    currentAddStudentClassId: null,
};

// 辅助函数：获取当前可用的排序字段
export function getAvailableSortFields(isTotal, hasExamDate) {
    const fields = [
        { value: isTotal ? 'totalScore' : 'subjectScore', label: isTotal ? '总分' : '单科成绩' },
        { value: 'className', label: '班级' },
        { value: 'studentId', label: '学号' },
        { value: 'studentName', label: '姓名' }
    ];
    if (hasExamDate) {
        if (isTotal) {
            fields.push({ value: 'totalGradeRank', label: '总分年级排名' });
            fields.push({ value: 'totalClassRank', label: '总分班级排名' });
        } else {
            fields.push({ value: 'subjectGradeRank', label: '单科年级排名' });
            fields.push({ value: 'subjectClassRank', label: '单科班级排名' });
        }
    }
    return fields;
}

// 数据过滤函数
export function filterScores(data, isTotal) {
    const { globalClassFilter, globalSubjectFilter, currentSearchKeyword } = AdminState;
    
    let filtered = data.filter(item => {
        if (globalClassFilter !== '所有班级' && item.className !== globalClassFilter) return false;
        if (!isTotal && item.subject !== globalSubjectFilter) return false;
        return true;
    });
    
    if (currentSearchKeyword.trim()) {
        const kw = currentSearchKeyword.trim().toLowerCase();
        filtered = filtered.filter(item => {
            return String(item.className).toLowerCase().includes(kw) ||
                   String(item.studentName).toLowerCase().includes(kw) ||
                   String(item.studentId).toLowerCase().includes(kw) ||
                   (!isTotal && String(globalSubjectFilter).toLowerCase().includes(kw));
        });
    }
    return filtered;
}

// 排序函数
export function sortScores(data, isTotal, hasExamDate) {
    const { currentSortField, currentSortOrder } = AdminState;
    if (!data.length) return data;
    
    return [...data].sort((a, b) => {
        let valA, valB;
        switch (currentSortField) {
            case 'totalScore':
            case 'subjectScore':
                valA = a.score || 0;
                valB = b.score || 0;
                break;
            case 'className':
                const cmp = (a.className || '').localeCompare(b.className || '', 'zh-CN');
                return currentSortOrder === 'asc' ? cmp : -cmp;
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
            default: return 0;
        }
        if (typeof valA === 'string') {
            const cmp = valA.localeCompare(valB, 'zh-CN');
            return currentSortOrder === 'asc' ? cmp : -cmp;
        } else {
            return currentSortOrder === 'asc' ? valA - valB : valB - valA;
        }
    });
}