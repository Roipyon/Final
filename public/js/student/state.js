// 学生端全局状态 
export const StudentState = {
    currentStudent: null,
    className: '',
    classId: null,
    
    examList: [],
    currentExamDate: '',
    
    personalScores: [],
    personalTotal: { total: 0, totalAvg: 0, totalRank: '-' },
    classStatBySubject: [],
    
    currentSubjectFilter: '数学',
    
    notices: [],
    currentNoticePage: 1,
    noticeFilter: 'all',
    noticesPerPage: 5,
};