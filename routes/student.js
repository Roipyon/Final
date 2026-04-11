const express = require('express');
const path = require('path');
const router = express.Router();
const pool = require('../utils/pool');
const addLog = require('../utils/logger');
const { isStudent } = require('../middleware/auth');

router.use(isStudent);

router.get('/',isStudent,(req,res)=>{
    res.sendFile(path.join(__dirname, '../student', 'stu.html'));
});

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

// 获取当前学生班级和成绩信息
router.get('/grade',isStudent,async(req,res)=>{
    const account = req.session.account;
    const [rows] = await pool.query('select id from users where account = ?',[account]);
    const userId = rows[0].id;
    const [subjectRows] = await pool.query(`
        WITH student_info AS (
            SELECT 
                cm.class_id,
                (SELECT MAX(exam_date) FROM scores WHERE student_id = ?) AS latest_exam
            FROM class_members cm
            WHERE cm.student_id = ? AND cm.status = 1
            LIMIT 1
            ),
        class_stats AS (
            SELECT 
                s.student_id,
                s.subject,
                s.score,
                AVG(s.score) OVER (PARTITION BY s.subject) AS classAvg,
                RANK() OVER (PARTITION BY s.subject ORDER BY s.score DESC) AS classRank
            FROM scores s
            JOIN student_info si
                ON s.class_id = si.class_id
                AND s.exam_date = si.latest_exam
        )
        SELECT 
            subject,
            score,
            ROUND(classAvg, 1) AS classAvg,
            classRank
        FROM class_stats
        WHERE student_id = ?;`,[userId,userId,userId]);
    res.json(subjectRows);
});

// 获取总排名（基于学生个人最后一次考试日期）
router.get('/totalrank',isStudent,async(req,res)=>{
    const account = req.session.account;
    const [rows] = await pool.query('select id from users where account = ?',[account]);
    const userId = rows[0].id;
    const [result] = await pool.query(`
        WITH student_lastest AS (
            SELECT MAX(exam_date) AS lastest_exam
            FROM scores
            WHERE student_id = ?
        ),
        class_members_info AS (
            SELECT class_id
            FROM class_members
            WHERE student_id = ? AND status = 1
        ),
        class_scores AS (
            SELECT 
                s.student_id,
                SUM(s.score) AS total_score
            FROM scores s
            JOIN class_members_info cmi ON s.class_id = cmi.class_id
            CROSS JOIN student_lastest sl
            WHERE s.exam_date = sl.lastest_exam
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
    `, [userId, userId, userId]);
    res.json(result[0] || { total: 0, totalAvg: 0, totalRank: 0 });
});

// 班级统计数据（基于学生个人最后一次考试日期）
router.get('/classstat',isStudent,async(req,res)=>{
    const account = req.session.account;
    const [rows] = await pool.query('select id from users where account = ?',[account]);
    const userId = rows[0].id;
    const [classStat] = await pool.query(`
        with student_lastest as (
            SELECT MAX(exam_date) AS lastest_exam
            FROM scores
            WHERE student_id = ?
        ),
        class_members_info AS (
            SELECT class_id
            FROM class_members
            WHERE student_id = ? AND status = 1
        )
        SELECT
            s.subject,
            ROUND(AVG(s.score), 1) AS avg,
            MAX(s.score) AS max,
            MIN(s.score) AS min,
            COUNT(*) AS total_count,
            COUNT(CASE WHEN s.score >= s.full_mark * 0.6 THEN 1 END) AS pass_count
        FROM scores s
        JOIN class_members_info cmi ON s.class_id = cmi.class_id
        CROSS JOIN student_lastest sl
        WHERE s.exam_date = sl.lastest_exam
        GROUP BY s.subject
    `, [userId, userId]);
    const result = classStat.map(row => ({
        subject: row.subject,
        avg: row.avg,
        max: row.max,
        min: row.min,
        passCount: row.pass_count,
        totalStu: row.total_count,
        passRate: row.total_count === 0 ? '0%' : ((row.pass_count / row.total_count) * 100).toFixed(2) + '%'
    }));
    res.json(result);
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
        res.json({success: true,message: '确认已读'});
        await addLog(
            userId,
            name,
            'student',
            '已读通知',
            `已读通知：${title}`,
            classId
        );
    }
    else res.status(500).json({success: false,message: '已读失败'});
});

module.exports = router;