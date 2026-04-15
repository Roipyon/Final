const express = require('express');
const path = require('path');
const router = express.Router();
const pool = require('../utils/pool');
const addLog = require('../utils/logger');
const { isStudent } = require('../middleware/auth');

router.use(isStudent);

// 获取当前学生用户信息
router.get('/info',isStudent,async(req,res)=>{
    const account = req.session.account;
    const [rows] = await pool.query('select id,real_name from users where account = ?',[account]);
    const userId = rows[0].id;
    const realName = rows[0].real_name;
    const [_rows] = await pool.query('select class_id from class_members where student_id = ?',[userId]);
    const classId = _rows[0].class_id;
    const [__rows] = await pool.query('select class_name from classes where id = ?',[classId]);
    const className = __rows[0].class_name;
    res.json({
        id: userId,
        name: realName,
        className: className,
        classId: classId,
    });
});

// 获取当前学生可用的考试日期
router.get('/exams',isStudent,async(req,res)=>{
    const account = req.session.account;
    const [user] = await pool.query('SELECT id FROM users WHERE account = ?', [account]);
    const userId = user[0].id;
    // 获取学生班级ID
    const [classInfo] = await pool.query(`
        SELECT class_id FROM class_members WHERE student_id = ? AND status = 1 LIMIT 1
    `, [userId]);
    if (classInfo.length === 0) return res.json([]);
    const classId = classInfo[0].class_id;
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

// 获取当前学生班级和成绩信息
router.get('/grade',isStudent,async(req,res)=>{
    const examDate = req.query.exam_date;
    const account = req.session.account;
    const [rows] = await pool.query('select id from users where account = ?',[account]);
    const userId = rows[0].id;
    // 获取班级ID
    const [classInfo] = await pool.query(`
        SELECT class_id FROM class_members WHERE student_id = ? AND status = 1 LIMIT 1
    `, [userId]);
    if (classInfo.length === 0) return res.json([]);
    const classId = classInfo[0].class_id;
    // 确定使用的考试日期
    let targetDate = examDate;
    // 为空返回最新
    if (!targetDate) {
        const [dateRow] = await pool.query(`
            SELECT MAX(exam_date) AS latest FROM scores WHERE class_id = ?
        `, [classId]);
        targetDate = dateRow[0].latest;
        if (!targetDate) return res.json([]);
    }
    const [subjectRows] = await pool.query(`
        WITH class_stats AS (
            SELECT 
                s.student_id,
                s.subject,
                s.score,
                AVG(s.score) OVER (PARTITION BY s.subject) AS classAvg,
                RANK() OVER (PARTITION BY s.subject ORDER BY s.score DESC) AS classRank
            FROM scores s
            where s.class_id = ? and s.exam_date = ?
        )
        SELECT 
            subject,
            score,
            ROUND(classAvg, 1) AS classAvg,
            classRank
        FROM class_stats
        where student_id = ?
        `,[classId,targetDate,userId]);
    res.json(subjectRows);
});

// 获取总排名（基于学生个人最后一次考试日期）
router.get('/totalrank',isStudent,async(req,res)=>{
    const examDate = req.query.exam_date;
    const account = req.session.account;
    const [rows] = await pool.query('select id from users where account = ?',[account]);
    const userId = rows[0].id;
     // 获取学生班级ID
    const [classInfo] = await pool.query(`
        SELECT class_id FROM class_members WHERE student_id = ? AND status = 1 LIMIT 1
    `, [userId]);
    if (classInfo.length === 0) return res.json({ total: 0, totalAvg: 0, totalRank: '-' });
    const classId = classInfo[0].class_id;
    // 为空返回最新
    let targetDate = examDate;
    if (!targetDate) {
        const [dateRow] = await pool.query(`
            SELECT MAX(exam_date) AS latest FROM scores WHERE class_id = ?
        `, [classId]);
        targetDate = dateRow[0].latest;
        if (!targetDate) return res.json({ total: 0, totalAvg: 0, totalRank: '-' });
    }
    const [result] = await pool.query(`
        WITH class_scores AS (
            SELECT 
                student_id,
                SUM(score) AS total_score
            FROM scores s
            WHERE class_id = ? and exam_date = ?
            GROUP BY s.student_id
        ),
        ranked AS (
            SELECT 
                student_id,
                total_score,
                RANK() OVER (ORDER BY total_score DESC) AS class_rank
            FROM class_scores
        ),
        class_avg AS (
            SELECT AVG(total_score) AS class_avg_score
            FROM class_scores
        )
        SELECT 
            r.total_score AS total,
            ca.class_avg_score AS totalAvg,
            r.class_rank AS totalRank
        FROM ranked r
        CROSS JOIN class_avg ca
        WHERE r.student_id = ?
    `, [classId, targetDate, userId]);
    res.json(result[0] || { total: 0, totalAvg: 0, totalRank: '-' });
});

// 班级统计数据（基于学生个人最后一次考试日期）
router.get('/classstat',isStudent,async(req,res)=>{
    const examDate = req.query.exam_date;
    const account = req.session.account;
    const [rows] = await pool.query('select id from users where account = ?',[account]);
    const userId = rows[0].id;
    const [classInfo] = await pool.query(`
        SELECT class_id FROM class_members WHERE student_id = ? AND status = 1 LIMIT 1
    `, [userId]);
    if (classInfo.length === 0) return res.json([]);
    const classId = classInfo[0].class_id;
    let targetDate = examDate;
    if (!targetDate) {
        const [dateRow] = await pool.query(`
            SELECT MAX(exam_date) AS latest FROM scores WHERE class_id = ?
        `, [classId]);
        targetDate = dateRow[0].latest;
        if (!targetDate) return res.json([]);
    }
    const [classStat] = await pool.query(`
        SELECT
            subject,
            ROUND(AVG(score), 1) AS avg,
            MAX(score) AS max,
            MIN(score) AS min,
            COUNT(*) AS totalStu,
            COUNT(CASE WHEN score >= full_mark * 0.6 THEN 1 END) AS passCount,
            CONCAT(ROUND(COUNT(CASE WHEN score >= full_mark * 0.6 THEN 1 END) * 100.0 / COUNT(*), 2), '%') AS passRate
        FROM scores
        WHERE class_id = ? and exam_date = ?
        GROUP BY subject
    `, [classId, targetDate]);
    res.json(classStat);
});

// 获取通知
router.get('/notices',isStudent,async(req,res)=>{
    const account = req.session.account;
    const [rows] = await pool.query('select id from users where account = ?',[account]);
    const userId = rows[0].id;
    const [notices] = await pool.query(`
        with current_class_id as (
            select
                cm.class_id
            from class_members cm where student_id = ?
        )
        select
            n.id,
            n.title,
            n.content,
            n.publish_time as publishTime,
            u.real_name as teacher_name,
            (select 1 from notice_read_status where notice_id = n.id and student_id =?) as isRead
        from notices n, users u, current_class_id cci
        where n.publisher_id = u.id and n.is_deleted = 0 and n.class_id = cci.class_id
        order by n.publish_time desc;
    `,[userId,userId]);
    res.json(notices);
});

// 学生已读通知
router.post('/notices',isStudent,async(req,res)=>{
    const { notice_id, is_read } = req.body;
    if (is_read != 1) res.status(400).json({success: false,message: '状态码无效'});
    const account = req.session.account;
    const [rows] = await pool.query('select id,real_name from users where account = ?',[account]);
    const { id: userId, real_name: name} = rows[0];
    const [titleRow] = await pool.query('select title from notices where id = ?',[notice_id]);
    const title = titleRow[0].title;
    const [classIdRow] = await pool.query('select class_id from class_members where student_id = ?',[userId]);
    const classId = classIdRow[0].class_id;
    const [update] = await pool.query('insert into notice_read_status (notice_id,student_id,is_read) values (?,?,?)',[notice_id,userId,is_read]);
    if (update.affectedRows === 1) {
        await addLog(
            userId,
            name,
            'student',
            '已读通知',
            `已读通知：${title}`,
            classId
        );
        try {
            const [noticeRows] = await pool.query(
                'SELECT publisher_id FROM notices WHERE id = ?',
                [notice_id]
            );
            if (noticeRows.length > 0) {
                const teacherId = noticeRows[0].publisher_id;
                const sendToUser = req.app.locals.sendToUser;
                sendToUser(teacherId, {
                    type: 'READ_COUNT_UPDATE',
                    data: { noticeId: notice_id }
                });
            }
        } catch (pushErr) {
            console.error('WebSocket 推送失败:', pushErr);
        }
        res.json({success: true,message: '确认已读'});
    }
    else res.status(500).json({success: false,message: '已读失败'});
});

module.exports = router;