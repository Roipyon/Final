const express = require('express');
const router = express.Router();
const pool = require('../utils/pool');
const addLog = require('../utils/logger');
const { isStudent } = require('../middleware/auth');
require('dotenv').config();

router.use(isStudent);

/**
 * 根据账号获取学生基本信息：用户ID、真实姓名、班级ID
 * 若学生未分配班级，classId 为 null
 */
async function getStudentInfo(account) {
    const [rows] = await pool.query(
        'SELECT id, real_name FROM users WHERE account = ?',
        [account]
    );
    if (rows.length === 0) return null;
    const userId = rows[0].id;
    const realName = rows[0].real_name;
    const [classInfo] = await pool.query(
        'SELECT class_id FROM class_members WHERE student_id = ? AND status = 1 LIMIT 1',
        [userId]
    );
    const classId = classInfo.length > 0 ? classInfo[0].class_id : null;
    return { userId, realName, classId };
}

/**
 * 解析考试日期：如明确提供则直接使用；否则返回该班级最近一次考试日期
 * 若班级无考试记录，返回 null
 */
async function resolveExamDate(classId, examDate) {
    if (examDate) return examDate;
    if (!classId) return null;
    const [dateRow] = await pool.query(
        'SELECT MAX(exam_date) AS latest FROM scores WHERE class_id = ?',
        [classId]
    );
    return dateRow[0].latest || null;
}

// 获取当前学生用户信息
router.get('/info', async (req, res) => {
    const info = await getStudentInfo(req.session.account);
    if (!info) return res.status(400).json({ message: '用户不存在' });
    const { userId, realName, classId } = info;
    if (!classId) {
        return res.json({ id: userId, name: realName, className: null, classId: null });
    }
    const [classRows] = await pool.query(
        'SELECT class_name FROM classes WHERE id = ?',
        [classId]
    );
    const className = classRows[0].class_name;
    res.json({ id: userId, name: realName, className, classId });
});

// 获取当前学生可用的考试日期
router.get('/exams', async (req, res) => {
    const info = await getStudentInfo(req.session.account);
    if (!info || !info.classId) return res.json([]);
    const [rows] = await pool.query(
        `SELECT DISTINCT exam_date 
        FROM scores 
        WHERE class_id = ? 
        ORDER BY exam_date DESC`,
        [info.classId]
    );
    res.json(rows.map(r => r.exam_date));
});

// 获取当前学生班级和成绩信息
router.get('/grade', async (req, res) => {
    const info = await getStudentInfo(req.session.account);
    if (!info || !info.classId) return res.json([]);
    const targetDate = await resolveExamDate(info.classId, req.query.exam_date);
    if (!targetDate) return res.json([]);

    const [subjectRows] = await pool.query(
        `WITH class_stats AS (
        SELECT 
            s.student_id,
            s.subject,
            s.score,
            AVG(s.score) OVER (PARTITION BY s.subject) AS classAvg,
            RANK() OVER (PARTITION BY s.subject ORDER BY s.score DESC) AS classRank
        FROM scores s
        WHERE s.class_id = ? AND s.exam_date = ?
        )
        SELECT subject, score, ROUND(classAvg, 1) AS classAvg, classRank
        FROM class_stats
        WHERE student_id = ?`,
        [info.classId, targetDate, info.userId]
    );
    res.json(subjectRows);
});

// 获取总排名
router.get('/totalrank', async (req, res) => {
    const info = await getStudentInfo(req.session.account);
    if (!info || !info.classId) return res.json({ total: 0, totalAvg: 0, totalRank: '-' });
    const targetDate = await resolveExamDate(info.classId, req.query.exam_date);
    if (!targetDate) return res.json({ total: 0, totalAvg: 0, totalRank: '-' });

    const [result] = await pool.query(
        `WITH class_scores AS (
        SELECT student_id, SUM(score) AS total_score
        FROM scores s
        WHERE class_id = ? AND exam_date = ?
        GROUP BY s.student_id
        ),
        ranked AS (
        SELECT student_id, total_score,
                RANK() OVER (ORDER BY total_score DESC) AS class_rank
        FROM class_scores
        ),
        class_avg AS (
        SELECT AVG(total_score) AS class_avg_score FROM class_scores
        )
        SELECT r.total_score AS total, ca.class_avg_score AS totalAvg, r.class_rank AS totalRank
        FROM ranked r
        CROSS JOIN class_avg ca
        WHERE r.student_id = ?`,
        [info.classId, targetDate, info.userId]
    );
    res.json(result[0] || { total: 0, totalAvg: 0, totalRank: '-' });
});

// 班级统计数据
router.get('/classstat', async (req, res) => {
    const info = await getStudentInfo(req.session.account);
    if (!info || !info.classId) return res.json([]);
    const targetDate = await resolveExamDate(info.classId, req.query.exam_date);
    if (!targetDate) return res.json([]);

    const [classStat] = await pool.query(
        `SELECT subject,
                ROUND(AVG(score), 1) AS avg,
                MAX(score) AS max,
                MIN(score) AS min,
                COUNT(*) AS totalStu,
                COUNT(CASE WHEN score >= full_mark * 0.6 THEN 1 END) AS passCount,
                CONCAT(ROUND(COUNT(CASE WHEN score >= full_mark * 0.6 THEN 1 END) * 100.0 / COUNT(*), 2), '%') AS passRate
        FROM scores
        WHERE class_id = ? AND exam_date = ?
        GROUP BY subject`,
        [info.classId, targetDate]
    );
    res.json(classStat);
});

// 获取通知
router.get('/notices', async (req, res) => {
    const info = await getStudentInfo(req.session.account);
    if (!info || !info.classId) return res.json([]);
    const [notices] = await pool.query(
        `WITH current_class_id AS (
        SELECT cm.class_id FROM class_members cm WHERE student_id = ?
        )
        SELECT n.id, n.title, n.content, n.publish_time AS publishTime,
                u.real_name AS teacher_name,
                (SELECT 1 FROM notice_read_status WHERE notice_id = n.id AND student_id = ?) AS isRead
        FROM notices n, users u, current_class_id cci
        WHERE n.publisher_id = u.id AND n.is_deleted = 0 AND n.class_id = cci.class_id
        ORDER BY n.publish_time DESC`,
        [info.userId, info.userId]
    );
    res.json(notices);
});

// 学生已读通知
router.post('/notices', async (req, res) => {
    const { notice_id, is_read } = req.body;
    if (is_read != 1) return res.status(400).json({ success: false, message: '状态码无效' });
    const info = await getStudentInfo(req.session.account);
    if (!info || !info.classId) return res.status(400).json({ success: false, message: '未分配班级' });
    const { userId, realName: name, classId } = info;

    const [titleRow] = await pool.query('SELECT title FROM notices WHERE id = ?', [notice_id]);
    const title = titleRow[0].title;

    const [update] = await pool.query(
        'INSERT INTO notice_read_status (notice_id, student_id, is_read) VALUES (?, ?, ?)',
        [notice_id, userId, is_read]
    );

    if (update.affectedRows === 1) {
        await addLog(userId, name, 'student', '已读通知', `已读通知：${title}`, classId);
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
        res.json({ success: true, message: '确认已读' });
    } else {
        res.status(500).json({ success: false, message: '已读失败' });
    }
});

// 获取某科目历次考试成绩趋势
router.get('/trend', async (req, res) => {
    const { subject } = req.query;
    if (!subject) return res.status(400).json({ success: false, message: '科目不能为空' });
    const info = await getStudentInfo(req.session.account);
    if (!info || !info.classId) return res.json([]);

    const [rows] = await pool.query(
        `SELECT DATE_FORMAT(s.exam_date, '%Y-%m-%d') AS exam_date,
                s.score,
                s.full_mark,
                ROUND(
                (SELECT AVG(s2.score) 
                FROM scores s2 
                WHERE s2.class_id = ? AND s2.subject = ? AND s2.exam_date = s.exam_date), 
                1
                ) AS class_avg
        FROM scores s
        WHERE s.student_id = ? AND s.subject = ?
        ORDER BY s.exam_date ASC`,
        [info.classId, subject, info.userId, subject]
    );
    res.json(rows);
});

// 学业诊断接口
router.get('/diagnosis', async (req, res) => {
    const { subject } = req.query;
    const info = await getStudentInfo(req.session.account);
    if (!info || !info.classId) return res.json({ diagnosis: '未分配班级，无法生成诊断' });
    const { userId, realName: studentName, classId } = info;

    let subjectCondition = '';
    const params = [classId, userId];
    if (subject) {
        subjectCondition = 'AND s.subject = ?';
        params.push(subject);
    }

    const [allScores] = await pool.query(
        `SELECT s.exam_date, s.subject, s.score, s.full_mark,
                ROUND(
                (SELECT AVG(s2.score) 
                FROM scores s2 
                WHERE s2.class_id = ? AND s2.subject = s.subject AND s2.exam_date = s.exam_date), 
                1
                ) AS class_avg
        FROM scores s
        WHERE s.student_id = ? ${subjectCondition}
        ORDER BY s.exam_date ASC, s.subject`,
        params
    );

    if (allScores.length === 0) {
        return res.json({ diagnosis: '暂无考试成绩记录，无法生成诊断' });
    }

    // 构建 Prompt
    let prompt = `你是一位专业的学业诊断分析师。请根据以下学生的考试成绩数据，生成一份约150字的个人化学业诊断报告。内容需包括：\n`;
    prompt += `要求：1. 请勿凭空产生或者捏造不存在的或者尚未接收到的信息，例如知识点的缺陷和遗漏方面；2. 实事求是，根据已接收到的成绩数据进行分析，不得根据不存在的成绩信息进行字数的补全。` 
    prompt += `\n1. 成绩变化趋势的整体评价；\n2. 2-3条具体可行的学习建议。\n`;
    prompt += `学生姓名：${studentName}\n`;
    
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
    prompt += `\n请直接输出诊断报告文本，不要包含任何额外解释或标记。\n请再次审查输出的内容是否严格遵循给定的要求。`;

    //   const apiKey = process.env.AI_API_KEY;
    //   const apiEndpoint = process.env.AI_API_ENDPOINT || 'https://openrouter.ai/api/v1/chat/completions';
    //   const model = process.env.AI_MODEL || 'inclusionai/ling-2.6-flash:free';
    const apiKey = '';
    const apiEndpoint = '';
    const model = '';

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
        const diagnosis = aiData.choices[0].message.content.trim();

        await addLog(userId, studentName, 'student', 'AI诊断', '请求了学业诊断报告', classId);
        res.json({ diagnosis });
    } catch (err) {
        console.error('AI 请求异常:', err);
        res.status(500).json({ success: false, message: '诊断生成失败' });
    }
});

module.exports = router;