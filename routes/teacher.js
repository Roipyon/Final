const express = require('express');
const path = require('path');
const router = express.Router();
const pool = require('../utils/pool');
const addLog = require('../utils/logger');
const { isTeacher } = require('../middleware/auth');

router.use(isTeacher);

router.get('/',isTeacher,(req,res)=>{
    res.sendFile(path.join(__dirname, '../public', 'tea.html'));
});

// 教师端

// 获取当前用户信息
router.get('/info',isTeacher,async(req,res)=>{
    const account = req.session.account;
    const [rows] = await pool.query('select id,real_name from users where account = ?',[account]);
    const userId = rows[0].id;
    const realName = rows[0].real_name;
    const [class_info] = await pool.query(`
        SELECT c.id, CONCAT(g.grade_name, c.class_name) AS class_name
        FROM classes c
        JOIN grades g ON c.grade_id = g.id
        WHERE c.teacher_id = ?
    `,[userId]);
    if (class_info.length === 0) {
        return res.json({ 
            name: realName, 
            className: null, 
            classId: null 
        });
    }
    res.json({
        name: realName,
        className: class_info[0].class_name,
        classId: class_info[0].id
    });
});

// 获取当前本班可用的考试日期
router.get('/exams',isTeacher,async(req,res)=>{
    const account = req.session.account;
    const [user] = await pool.query('SELECT id FROM users WHERE account = ?', [account]);
    const userId = user[0].id;
    // 获取学生班级ID
    const [classRows] = await pool.query('SELECT id FROM classes WHERE teacher_id = ?', [userId]);
    if (classRows.length === 0) return res.json([]);
    const classId = classRows[0].id;
    // 查询该班级所有不重复的考试日期，按时间倒序
    const [rows] = await pool.query(`
        SELECT DISTINCT exam_date 
        FROM scores 
        WHERE class_id = ? 
        ORDER BY exam_date DESC
    `, [classId]);
    // 略去字段
    res.json(rows.map(r => r.exam_date));
});

// 获取所有学生单科成绩
router.get('/scores',isTeacher,async(req,res)=>{
    const examDate = req.query.exam_date;
    const account = req.session.account;
    const [rows] = await pool.query('select id from users where account = ?',[account]);
    const userId = rows[0].id;
    // 获取班主任所带班级 ID
    const [classRows] = await pool.query('SELECT id FROM classes WHERE teacher_id = ?', [userId]);
    if (classRows.length === 0) return res.json([]);
    const classId = classRows[0].id;
    let targetDate = examDate;
    if (!targetDate) {
        const [dateRow] = await pool.query(`SELECT MAX(exam_date) AS latest FROM scores WHERE class_id = ?`, [classId]);
        targetDate = dateRow[0].latest;
        if (!targetDate) return res.json([]);
    }
    const [scores] = await pool.query(`
        SELECT 
            s.student_id AS id,
            u.real_name AS studentName,
            s.subject,
            s.score,
            s.exam_date,
            RANK() OVER (PARTITION BY s.subject ORDER BY s.score DESC) AS class_subject_rank
        FROM scores s
        JOIN users u ON s.student_id = u.id
        WHERE s.class_id = ? AND s.exam_date = ?
        ORDER BY s.subject, s.score DESC
    `, [classId, targetDate]);
    res.json(scores);
});

// 获取班级分数概况
router.get('/general',isTeacher,async(req,res)=>{
    const examDate = req.query.exam_date;
    const account = req.session.account;
    const [rows] = await pool.query('select id from users where account = ?',[account]);
    const userId = rows[0].id;
    // 获取班级ID
    const [classRows] = await pool.query('SELECT id FROM classes WHERE teacher_id = ?', [userId]);
    if (classRows.length === 0) return res.json({ max: 0, min: 0, avg: 0 });
    const classId = classRows[0].id;
    let targetDate = examDate;
    if (!targetDate) {
        const [dateRow] = await pool.query(`SELECT MAX(exam_date) AS latest FROM scores WHERE class_id = ?`, [classId]);
        targetDate = dateRow[0].latest;
        if (!targetDate) return res.json({ max: 0, min: 0, avg: 0 });
    }
    // 在该批次下计算总分概况
    const [scores] = await pool.query(`
        WITH stu_total AS (
            SELECT student_id, SUM(score) AS total
            FROM scores
            WHERE class_id = ? AND exam_date = ?
            GROUP BY student_id
        )
        SELECT 
            MAX(total) AS max,
            MIN(total) AS min,
            ROUND(AVG(total), 1) AS avg
        FROM stu_total
    `, [classId, targetDate]);
    res.json(scores[0]);
});

// 获取所有学生总分
router.get('/totalscores',isTeacher,async(req,res)=>{
    const examDate = req.query.exam_date;
    const account = req.session.account;
    const [rows] = await pool.query('select id from users where account = ?',[account]);
    const userId = rows[0].id;
    const [classRows] = await pool.query('SELECT id FROM classes WHERE teacher_id = ?', [userId]);
    if (classRows.length === 0) return res.json([]);
    const classId = classRows[0].id;
    let targetDate = examDate;
    if (!targetDate) {
        const [dateRow] = await pool.query(`SELECT MAX(exam_date) AS latest FROM scores WHERE class_id = ?`, [classId]);
        targetDate = dateRow[0].latest;
        if (!targetDate) return res.json([]);
    }
    const [scores] = await pool.query(`
        with stu_scores as (
            select
            s.student_id as id,
            u.real_name as studentName,
            sum(s.score) as total_score 
            from scores s
            join users u on s.student_id = u.id
            where s.class_id = ? and s.exam_date = ?
            group by s.student_id
        )
        select 
            id,
            studentName,
            total_score,
            rank() over (order by total_score desc) as class_rank
        from stu_scores
    `,[classId, targetDate]);
    res.json(scores);
});


// 获取单科成绩概况
router.get('/subjectgeneral',isTeacher,async(req,res)=>{
    const examDate = req.query.exam_date;
    const account = req.session.account;
    const [rows] = await pool.query('select id from users where account = ?',[account]);
    const userId = rows[0].id;
    // 获取班级ID
    const [classRows] = await pool.query('SELECT id FROM classes WHERE teacher_id = ?', [userId]);
    if (classRows.length === 0) return res.json([]);
    const classId = classRows[0].id;
    let targetDate = examDate;
    if (!targetDate) {
        const [dateRow] = await pool.query(`SELECT MAX(exam_date) AS latest FROM scores WHERE class_id = ?`, [classId]);
        targetDate = dateRow[0].latest;
        if (!targetDate) return res.json([]);
    }
    // 在该批次下计算单科概况
    const [scores] = await pool.query(`
        SELECT 
            subject,
            MAX(score) AS max,
            MIN(score) AS min,
            ROUND(AVG(score), 1) AS avg,
            COUNT(*) AS total_count,
            COUNT(CASE WHEN score >= full_mark * 0.6 THEN 1 END) AS pass_count
        FROM scores
        WHERE class_id = ? AND exam_date = ?
        GROUP BY subject
    `, [classId, targetDate]);
    // 计算及格率
    const result = scores.map(row => ({
        subject: row.subject,
        max: row.max,
        min: row.min,
        avg: row.avg,
        passCount: row.pass_count,
        totalStu: row.total_count,
        passRate: row.total_count === 0 ? '0%' : ((row.pass_count / row.total_count) * 100).toFixed(2) + '%'
    }));
    res.json(result);
});

// 获取单科满分
router.post('/fullmark',isTeacher,async(req,res)=>{
    const subject = req.body.subject;
    const [rows] = await pool.query('select full_mark from scores where subject = ? limit 1',[subject]);
    res.json(rows[0]);
});

// 更新成绩
router.post('/scores',isTeacher,async(req,res)=>{
    const { studentId, subject, newScore } = req.body;
    // 拿学生名
    const [stu_name] = await pool.query('select real_name from users where id = ?',[studentId]);
    const studentName = stu_name[0].real_name;
    // 默认
    const account = req.session.account;
    const [rows] = await pool.query('select id,real_name,identity from users where account = ?',[account]);
    // 教师信息
    const {id: userId, real_name: user_name, identity} = rows[0];
    const [cid] = await pool.query('SELECT id FROM classes WHERE teacher_id = ?', [userId]);
    const classId = cid[0].id;
    if (!classId) return res.status(403).json({ success: false,message: '无权限' });
    const [stu] = await pool.query('SELECT 1 FROM class_members WHERE student_id = ? AND class_id = ?', [studentId, classId]);
    const student = stu[0];
    if (!student) return res.status(403).json({ success: false,message: '不能修改非本班学生成绩' });
    const [response] = await pool.query('UPDATE scores SET score = ? WHERE student_id = ? AND subject = ?', [newScore, studentId, subject]);
    if (response.affectedRows === 1) 
    {
        await addLog(
            userId,
            user_name,
            identity,
            "成绩修改",
            `修改学生${studentName}的${subject}成绩为${newScore}`,
            classId
        );
        res.json({ success: true,message: '修改成功'});
    }
    else res.status(500).json({ success: false,message: '修改失败'});
});

// 获取通知
router.get('/notices',isTeacher,async(req,res)=>{
    const account = req.session.account;
    const [rows] = await pool.query('select id,identity,real_name from users where account = ?',[account]);
    const { id:userId, identity, real_name:teacher_name } = rows[0];
    const [cid] = await pool.query('SELECT id FROM classes WHERE teacher_id = ?', [userId]);
    const classId = cid[0].id;
    if (identity !== 'teacher') {
        return res.status(403).json({ success: false,message: '无权限获取通知' });
    }
    const sql = `
        SELECT 
            n.id,
            n.title,
            n.content,
            n.publish_time,
            (
                SELECT COUNT(*)
                FROM notice_read_status rs
                WHERE rs.notice_id = n.id AND rs.is_read = 1
            ) AS read_count,
            (
                SELECT COUNT(*)
                FROM class_members cm
                WHERE cm.class_id = n.class_id AND cm.status = 1
            ) AS total_students
        FROM notices n
        WHERE n.class_id = ? AND n.is_deleted = 0
        ORDER BY n.publish_time DESC
    `;
    try {
        const [rows] = await pool.query(sql, [classId]);
        // 计算未读人数 = 总人数 - 已读人数
        const notices = rows.map(row => ({
            id: row.id,
            title: row.title,
            content: row.content,
            publishTime: row.publish_time,
            teacher_name: teacher_name,
            readCount: row.read_count,
            totalStudents: row.total_students,
            unreadCount: row.total_students - row.read_count
        }));
        res.json(notices);
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false,message: '数据库错误' });
    }
});

// 新增通知
router.post('/notices',isTeacher,async(req,res)=>{
    const account = req.session.account;
    const [rows] = await pool.query('select id,real_name,identity from users where account = ?',[account]);
    // 教师信息
    const {id: userId, real_name: user_name, identity} = rows[0];
    const [cid] = await pool.query('SELECT id FROM classes WHERE teacher_id = ?', [userId]);
    const classId = cid[0].id;
    if (identity !== 'teacher') {
        return res.status(403).json({ success: false,message: '无权限发布通知' });
    }
    const { title, content } = req.body;
    if (!title || !content) {
        return res.status(400).json({ success: false,message: '标题和内容不能为空' });
    }
    const publishTime = new Date();
    const sql = `
        INSERT INTO notices (class_id, publisher_id, title, content, is_deleted)
        VALUES (?, ?, ?, ?, 0)
    `;
    const params = [classId, userId, title, content];
    try {
        const [result] = await pool.query(sql, params);
        const newNotice = {
            id: result.insertId,
            class_id: classId,
            publisher_id: userId,
            title,
            content,
            publish_time: publishTime,
            is_deleted: 0
        };
        await addLog(
            userId,
            user_name,
            identity,
            "通知发布",
            `发布通知：${title}`,
            classId
        );
        res.json(newNotice);
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false,message: '数据库错误' });
    }
});

// 编辑通知
router.put('/notices/:id',isTeacher,async(req,res)=>{
    // 拿 id, 真名, 所属班级
    const account = req.session.account;
    const [rows] = await pool.query('select id,real_name,identity from users where account = ?',[account]);
    // 教师信息
    const {id: userId, real_name: user_name, identity} = rows[0];
    const [cid] = await pool.query('SELECT id FROM classes WHERE teacher_id = ?', [userId]);
    const classId = cid[0].id;
    if (identity !== 'teacher') {
        return res.status(403).json({ success: false,message: '无权限编辑通知' });
    }
    const { title, content } = req.body;
    if (!title || !content) {
        return res.status(400).json({ success: false,message: '标题和内容不能为空' });
    }
    // 拿通知id
    const noticeId = parseInt(req.params.id);
    // 检查当前班级里是否存在该通知
    const [_rows] = await pool.query('select class_id from notices where id = ? and is_deleted = 0',[noticeId]);
    if (_rows.length === 0) {
        return res.status(404).json({ success: false, message: '通知不存在或已被删除' });
    }
    if (_rows[0].class_id !== classId) {
        return res.status(403).json({ success: false, message: '您只能修改自己班级的通知' });
    }
    // 更新
    await pool.query('update notices set title = ?, content = ? where id = ?',[title,content,noticeId]);
    await addLog(
        userId,
        user_name,
        identity,
        "通知编辑",
        `编辑通知：${title}`,
        classId
    );
    res.json({ success: true, message: '通知修改成功' });
});

// 删除通知
router.delete('/notices/:id',isTeacher,async(req,res)=>{
    // 拿 id, 真名, 所属班级
    const account = req.session.account;
    const [rows] = await pool.query('select id,real_name,identity from users where account = ?',[account]);
    const {id: userId, real_name: user_name, identity} = rows[0];
    const [cid] = await pool.query('SELECT id FROM classes WHERE teacher_id = ?', [userId]);
    const classId = cid[0].id;
    if (identity !== 'teacher') {
        return res.status(403).json({ success: false,message: '无权限编辑通知' });
    }
    // 拿通知id
    const noticeId = parseInt(req.params.id);
    // 检查当前班级里是否存在该通知
    const [_rows] = await pool.query('select class_id,title from notices where id = ? and is_deleted = 0',[noticeId]);
    if (_rows.length === 0) {
        return res.status(404).json({ success: false, message: '通知不存在或已被删除' });
    }
    if (_rows[0].class_id !== classId) {
        return res.status(403).json({ success: false, message: '您只能删除自己班级的通知' });
    }
    // 拿标题
    const deletedTitle = _rows[0].title;
    // 软删除
    await pool.query('update notices set is_deleted = 1 where id = ?',[noticeId]);
    await addLog(
        userId,
        user_name,
        identity,
        "通知删除",
        `删除通知：${deletedTitle}`,
        classId
    );
    res.json({ success: true, message: '通知已删除' });
});

// 获取日志 (采用分页传参分别处理)
router.get('/logs',isTeacher,async(req,res)=>{
    const account = req.session.account;
    const [rows] = await pool.query('select id,identity from users where account = ?',[account]);
    const {id: userId, real_name: user_name, identity} = rows[0];
    const [cid] = await pool.query('SELECT id FROM classes WHERE teacher_id = ?', [userId]);
    const classId = cid[0].id;
    if (identity !== 'teacher') {
        return res.status(403).json({ success: false,message: '无权限编辑通知' });
    }
    // 当前页数
    let page = parseInt(req.query.page) || 1;
    // 每页 5 条
    let pageSize = parseInt(req.query.pageSize) || 5;
    // 跳过多少条（分页渲染）
    const offset = (page - 1)*pageSize;
    // 查总数
    const [countRows] = await pool.query(`
        select count(*) as total from operation_logs where target_class_id = ?
    `,[classId]);
    const total = countRows[0].total;
    // 查本页
    const [logs] = await pool.query(`
        select user_name, operation_type, operation_content, created_at
        from operation_logs 
        where target_class_id = ?
        order by created_at desc
        limit ? offset ?
    `,[classId, pageSize, offset]);
    res.json({
        logs: logs,
        total: total,
        page: page,
        pageSize: pageSize
    });
});

// 获取当前日志的学生状态
router.get('/notices/:id/read-status',isTeacher,async(req,res)=>{
    const account = req.session.account;
    const [rows] = await pool.query('select id,identity from users where account = ?',[account]);
    const {id: userId, real_name: user_name, identity} = rows[0];
    const [cid] = await pool.query('SELECT id FROM classes WHERE teacher_id = ?', [userId]);
    const classId = cid[0].id;
    if (identity !== 'teacher') {
        return res.status(403).json({ success: false,message: '无权限获取通知' });
    }
    // 拿通知id
    const noticeId = parseInt(req.params.id);
    // 检查当前班级里是否存在该通知
    const [_rows] = await pool.query('select class_id,title from notices where id = ? and is_deleted = 0',[noticeId]);
    if (_rows.length === 0) {
        return res.status(404).json({ success: false, message: '通知不存在或已被删除' });
    }
    if (_rows[0].class_id !== classId) {
        return res.status(403).json({ success: false, message: '您只能获取自己班级的通知' });
    }

    // 查询班级所有在读学生
    const [students] = await pool.query(`
        select id,real_name from users
        where id in (select student_id from class_members where class_id = ?
        and status = 1)
        and identity = 'student'
    `,[classId]);

    // 获取当前通知已读学生信息
    const [readRecords] = await pool.query(`
        select student_id 
        from notice_read_status 
        where notice_id = ? and is_read = 1
    `,[noticeId]);
    // 集合，搜索速度快
    // 返回一个只含 id 的数组
    const readSet = new Set(readRecords.map(r => r.student_id));
    // 分为两组
    // 以 id 分割，但只保留姓名
    const readList = students.filter(s => readSet.has(s.id)).map(s => s.real_name);
    const unreadList = students.filter(s => !readSet.has(s.id)).map(s => s.real_name);
    res.json({
        readList: readList,
        unreadList: unreadList,
        totalStudents: students.length,
        readCount: readList.length,
        unreadCount: unreadList.length
    });
});

module.exports = router;