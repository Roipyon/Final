const express = require('express');
const router = express.Router();
const pool = require('../utils/pool');
const addLog = require('../utils/logger');
const { isStudent } = require('../middleware/auth');
require('dotenv').config();

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
// 获取某科目历次考试成绩趋势
router.get('/trend',isStudent,async(req,res)=>{
    const account = req.session.account;
    const { subject } = req.query;
    if (!subject) return res.status(400).json({ success: false, message: '科目不能为空' });

    const [user] = await pool.query('SELECT id FROM users WHERE account = ?', [account]);
    const userId = user[0].id;

    // 获取学生班级 ID
    const [classInfo] = await pool.query(
        'SELECT class_id FROM class_members WHERE student_id = ? AND status = 1 LIMIT 1',
        [userId]
    );
    if (classInfo.length === 0) return res.json([]);
    const classId = classInfo[0].class_id;

    // 查询学生个人成绩 + 该考试批次该科目的班级平均分
    const [rows] = await pool.query(`
        SELECT 
            DATE_FORMAT(s.exam_date, '%Y-%m-%d') AS exam_date,
            s.score,
            s.full_mark,
            ROUND(
                (SELECT AVG(s2.score) 
                 FROM scores s2 
                 WHERE s2.class_id = ? 
                   AND s2.subject = ? 
                   AND s2.exam_date = s.exam_date), 
                1
            ) AS class_avg
        FROM scores s
        WHERE s.student_id = ? AND s.subject = ?
        ORDER BY s.exam_date ASC
    `, [classId, subject, userId, subject]);

    res.json(rows);
});
// 学业诊断接口
router.get('/diagnosis',isStudent,async(req,res)=>{
    const account = req.session.account;
    const { subject } = req.query; // 指定科目；不传则全科诊断

    // 获取学生信息
    const [user] = await pool.query('SELECT id, real_name FROM users WHERE account = ?', [account]);
    const userId = user[0].id;
    const studentName = user[0].real_name;

    // 获取班级 ID
    const [classInfo] = await pool.query(
        'SELECT class_id FROM class_members WHERE student_id = ? AND status = 1 LIMIT 1',
        [userId]
    );
    if (classInfo.length === 0) return res.json({ diagnosis: '未分配班级，无法生成诊断' });
    const classId = classInfo[0].class_id;

    // 获取历次考试成绩数据（学生各科成绩 + 班级平均分）
    let subjectCondition = '';
    const params = [classId, userId];
    if (subject) {
        subjectCondition = 'AND s.subject = ?';
        params.push(subject);
    }

    const [allScores] = await pool.query(`
        SELECT 
            s.exam_date,
            s.subject,
            s.score,
            s.full_mark,
            ROUND(
                (SELECT AVG(s2.score) 
                 FROM scores s2 
                 WHERE s2.class_id = ? 
                   AND s2.subject = s.subject 
                   AND s2.exam_date = s.exam_date), 
                1
            ) AS class_avg
        FROM scores s
        WHERE s.student_id = ? ${subjectCondition}
        ORDER BY s.exam_date ASC, s.subject
    `, params);

    if (allScores.length === 0) {
        return res.json({ diagnosis: '暂无考试成绩记录，无法生成诊断' });
    }

    // 构建 Prompt
    let prompt = `你是一位专业的学业诊断分析师。请根据以下学生的考试成绩数据，生成一份约150字的个人化学业诊断报告。内容需包括：\n`;
    prompt += `要求：1. 请勿凭空产生或者捏造不存在的或者尚未接收到的信息，例如知识点的缺陷和遗漏方面；
                2. 实事求是，根据已接收到的成绩数据进行分析，不得根据不存在的成绩信息进行字数的补全。`
    prompt += `\n1. 成绩变化趋势的整体评价；\n2. 2-3条具体可行的学习建议。\n`;
    prompt += `学生姓名：${studentName}\n`;
    
    // 按科目整理数据
    const subjectsMap = {};
    allScores.forEach(row => {
        if (!subjectsMap[row.subject]) subjectsMap[row.subject] = [];
        subjectsMap[row.subject].push({
            date: new Date(row.exam_date).toISOString().slice(0, 10),
            score: row.score,
            full: row.full_mark,
            avg: row.class_avg
        });
    });

    for (const [sub, records] of Object.entries(subjectsMap)) {
        prompt += `\n科目：${sub}（满分通常为${records[0].full}）\n`;
        records.forEach(r => {
            prompt += `- ${r.date}：个人${r.score}分，班级平均${r.avg}分\n`;
        });
    }
    prompt += `\n请直接输出诊断报告文本，不要包含任何额外解释或标记。`;
    prompt += `\n请再次审查输出的内容是否严格遵循给定的要求。`;

    // 调用大模型 API
    const apiKey = process.env.AI_API_KEY;
    const apiEndpoint = process.env.AI_API_ENDPOINT || 'https://openrouter.ai/api/v1/chat/completions';
    const model = process.env.AI_MODEL || 'inclusionai/ling-2.6-flash:free';

    try {
        const aiRes = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: 'system', content: '你是一个专业的学业分析师。' },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 500,
                temperature: 0.7
            })
        });

        if (!aiRes.ok) {
            const errText = await aiRes.text();
            console.error('AI API 调用失败:', errText);
            return res.status(502).json({ success: false, message: 'AI 服务暂时不可用' });
        }

        const aiData = await aiRes.json();
        console.log(aiData)
        const diagnosis = aiData.choices[0].message.content.trim();

        // 可选：记录日志
        const [admin] = await pool.query('SELECT id, real_name FROM users WHERE account = ?', [account]);
        await addLog(userId, studentName, 'student', 'AI诊断', `请求了学业诊断报告`, classId);

        res.json({ diagnosis });
    } catch (err) {
        console.error('AI 请求异常:', err);
        res.status(500).json({ success: false, message: '诊断生成失败' });
    }
});

module.exports = router;