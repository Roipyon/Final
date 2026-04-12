// ================== 教师端全局状态 ==================
export const TeacherState = {
    currentTeacher: null,
    className: '',
    classId: null,
    
    examList: [],
    currentExamDate: '',
    
    scoresData: [],
    scoresTotal: [],
    general: { max: 0, min: 0, avg: 0 },
    subjectGeneral: [],
    
    currentSubjectFilter: '总分',
    notices: [],
    
    currentLogPage: 1,
    logsPerPage: 15,
    logTotal: 0,
    
    currentEditId: null,
    currentEditingNoticeId: null,
};