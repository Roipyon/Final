const express = require('express');
const router = express.Router();
const pool = require('../utils/pool');
const addLog = require('../utils/logger');
const { isTeacher } = require('../middleware/auth');

router.use(isTeacher);

/**
 * 根据账号获取教师基本信息：用户ID、真实姓名、身份、班级ID
 * 若教师未分配班级，classId 为 null
 */
async function getTeacherInfo(account) {
    const [rows] = await pool.query(
        'SELECT id, real_name, identity FROM users WHERE account = ?',
        [account]
    );
    if (rows.length === 0) return null;
    const { id: userId, real_name: realName, identity } = rows[0];
    const [classRows] = await pool.query(
        'SELECT id FROM classes WHERE teacher_id = ?',
        [userId]
    );
    const classId = classRows.length > 0 ? classRows[0].id : null;
    return { userId, realName, identity, classId };
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

/**
 * 验证通知是否属于当前教师班级，并返回通知信息
 * @returns {Object|null} 返回 { class_id, title } 或 null（不存在或不属于）
 */
async function getNoticeForTeacher(noticeId, classId) {
    const [rows] = await pool.query(
        'SELECT class_id, title FROM notices WHERE id = ? AND is_deleted = 0',
        [noticeId]
    );
    if (rows.length === 0) return null;
    if (rows[0].class_id !== classId) return null;
    return rows[0];
}

/**
 * 推送新通知给班级学生和管理员
 */
async function pushNewNotice(noticeId, title, classId, sendToUser) {
    try {
        const [students] = await pool.query(
        'SELECT student_id FROM class_members WHERE class_id = ? AND status = 1',
        [classId]
        );
        const [admins] = await pool.query("SELECT id FROM users WHERE identity = 'admin'");
        const payload = {
        type: 'NEW_NOTICE',
        data: { noticeId, title }
        };
        students.forEach(s => sendToUser(s.student_id, payload));
        admins.forEach(a => sendToUser(a.id, payload));
    } catch (pushErr) {
        console.error('WebSocket 推送失败:', pushErr);
    }
}

// 获取当前用户信息
router.get('/info', async (req, res) => {
    const info = await getTeacherInfo(req.session.account);
    if (!info) return res.status(400).json({ message: '用户不存在' });
    const { userId, realName, classId } = info;
    if (!classId) {
        return res.json({ id: userId, name: realName, className: null, classId: null });
    }
    const [classRows] = await pool.query(
        `SELECT c.id, CONCAT(g.grade_name, c.class_name) AS class_name
        FROM classes c
        JOIN grades g ON c.grade_id = g.id
        WHERE c.id = ?`,
        [classId]
    );
    res.json({
        id: userId,
        name: realName,
        className: classRows[0].class_name,
        classId
    });
});

// 获取当前本班可用的考试日期
router.get('/exams', async (req, res) => {
    const info = await getTeacherInfo(req.session.account);
    if (!info || !info.classId) return res.json([]);
    const [rows] = await pool.query(
        `SELECT DISTINCT exam_date FROM scores WHERE class_id = ? ORDER BY exam_date DESC`,
        [info.classId]
    );
    res.json(rows.map(r => r.exam_date));
});

// 获取所有学生单科成绩
router.get('/scores', async (req, res) => {
    const info = await getTeacherInfo(req.session.account);
    if (!info || !info.classId) return res.json([]);
    const targetDate = await resolveExamDate(info.classId, req.query.exam_date);
    if (!targetDate) return res.json([]);

    const [scores] = await pool.query(
        `SELECT s.id AS scoreId,
                s.student_id AS id,
                u.real_name AS studentName,
                s.subject,
                s.score,
                s.exam_date,
                RANK() OVER (PARTITION BY s.subject ORDER BY s.score DESC) AS class_subject_rank
        FROM scores s
        JOIN users u ON s.student_id = u.id
        WHERE s.class_id = ? AND s.exam_date = ?
        ORDER BY s.subject, s.score DESC`,
        [info.classId, targetDate]
    );
    res.json(scores);
});

// 获取班级分数概况（总分 max/min/avg）
router.get('/general', async (req, res) => {
    const info = await getTeacherInfo(req.session.account);
    if (!info || !info.classId) return res.json({ max: 0, min: 0, avg: 0 });
    const targetDate = await resolveExamDate(info.classId, req.query.exam_date);
    if (!targetDate) return res.json({ max: 0, min: 0, avg: 0 });

    const [rows] = await pool.query(
        `WITH stu_total AS (
        SELECT student_id, SUM(score) AS total
        FROM scores
        WHERE class_id = ? AND exam_date = ?
        GROUP BY student_id
        )
        SELECT MAX(total) AS max, MIN(total) AS min, ROUND(AVG(total), 1) AS avg
        FROM stu_total`,
        [info.classId, targetDate]
    );
    res.json(rows[0]);
});

// 获取所有学生总分及排名
router.get('/totalscores', async (req, res) => {
    const info = await getTeacherInfo(req.session.account);
    if (!info || !info.classId) return res.json([]);
    const targetDate = await resolveExamDate(info.classId, req.query.exam_date);
    if (!targetDate) return res.json([]);

    const [scores] = await pool.query(
        `WITH stu_scores AS (
        SELECT s.student_id AS id,
                u.real_name AS studentName,
                SUM(s.score) AS total_score
        FROM scores s
        JOIN users u ON s.student_id = u.id
        WHERE s.class_id = ? AND s.exam_date = ?
        GROUP BY s.student_id
        )
        SELECT id, studentName, total_score,
                RANK() OVER (ORDER BY total_score DESC) AS class_rank
        FROM stu_scores`,
        [info.classId, targetDate]
    );
    res.json(scores);
});

// 获取单科成绩概况
router.get('/subjectgeneral', async (req, res) => {
    const info = await getTeacherInfo(req.session.account);
    if (!info || !info.classId) return res.json([]);
    const targetDate = await resolveExamDate(info.classId, req.query.exam_date);
    if (!targetDate) return res.json([]);

    const [rows] = await pool.query(
        `SELECT subject,
                MAX(score) AS max,
                MIN(score) AS min,
                ROUND(AVG(score), 1) AS avg,
                COUNT(*) AS total_count,
                COUNT(CASE WHEN score >= full_mark * 0.6 THEN 1 END) AS pass_count
        FROM scores
        WHERE class_id = ? AND exam_date = ?
        GROUP BY subject`,
        [info.classId, targetDate]
    );
    const result = rows.map(row => ({
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
router.post('/fullmark', async (req, res) => {
    const { subject } = req.body;
    const [rows] = await pool.query('SELECT full_mark FROM scores WHERE subject = ? LIMIT 1', [subject]);
    res.json(rows[0]);
});

// 根据成绩ID修改成绩
router.put('/scores/:id', async (req, res) => {
    const scoreId = parseInt(req.params.id);
    const { newScore } = req.body;
    if (newScore === undefined) return res.status(400).json({ success: false, message: '缺少新成绩' });

    const info = await getTeacherInfo(req.session.account);
    if (!info) return res.status(400).json({ success: false, message: '用户不存在' });
    const { userId, realName, classId } = info;
    if (!classId) return res.status(403).json({ success: false, message: '您不是班主任，无权修改成绩' });

    const [scoreRows] = await pool.query(
        `SELECT s.student_id, s.class_id, s.subject, s.score, s.full_mark, u.real_name AS studentName
        FROM scores s
        JOIN users u ON s.student_id = u.id
        WHERE s.id = ?`,
        [scoreId]
    );
    if (scoreRows.length === 0) return res.status(404).json({ success: false, message: '成绩记录不存在' });

    const record = scoreRows[0];
    if (record.class_id !== classId) return res.status(403).json({ success: false, message: '只能修改本班学生的成绩' });
    if (record.subject === '总分') return res.status(400).json({ success: false, message: '总分由系统自动计算，不可手动修改' });
    if (newScore < 0 || newScore > record.full_mark)
        return res.status(400).json({ success: false, message: `成绩必须在 0-${record.full_mark} 之间` });

    await pool.query('UPDATE scores SET score = ? WHERE id = ?', [newScore, scoreId]);
    await addLog(
        userId,
        realName,
        'teacher',
        '成绩修改',
        `修改学生 ${record.studentName} 的 ${record.subject} 成绩从 ${record.score} 改为 ${newScore}`,
        classId
    );
    res.json({ success: true, message: '修改成功' });
});

// 获取通知（含已读/未读统计）
router.get('/notices', async (req, res) => {
    const info = await getTeacherInfo(req.session.account);
    if (!info || info.identity !== 'teacher') return res.status(403).json({ success: false, message: '无权限获取通知' });
    if (!info.classId) return res.json([]);

    const [rows] = await pool.query(
        `SELECT n.id, n.title, n.content, n.publish_time,
                (SELECT COUNT(*) FROM notice_read_status rs WHERE rs.notice_id = n.id AND rs.is_read = 1) AS read_count,
                (SELECT COUNT(*) FROM class_members cm WHERE cm.class_id = n.class_id AND cm.status = 1) AS total_students
        FROM notices n
        WHERE n.class_id = ? AND n.is_deleted = 0
        ORDER BY n.publish_time DESC`,
        [info.classId]
    );
    const notices = rows.map(row => ({
        id: row.id,
        title: row.title,
        content: row.content,
        publishTime: row.publish_time,
        teacher_name: info.realName,
        readCount: row.read_count,
        totalStudents: row.total_students,
        unreadCount: row.total_students - row.read_count
    }));
    res.json(notices);
});

// 新增通知
router.post('/notices', async (req, res) => {
    const info = await getTeacherInfo(req.session.account);
    if (!info || info.identity !== 'teacher') return res.status(403).json({ success: false, message: '无权限发布通知' });
    if (!info.classId) return res.status(403).json({ success: false, message: '未分配班级，无法发布通知' });

    const { title, content } = req.body;
    if (!title || !content) return res.status(400).json({ success: false, message: '标题和内容不能为空' });

    const [result] = await pool.query(
        'INSERT INTO notices (class_id, publisher_id, title, content, is_deleted) VALUES (?, ?, ?, ?, 0)',
        [info.classId, info.userId, title, content]
    );
    const newNotice = {
        id: result.insertId,
        class_id: info.classId,
        publisher_id: info.userId,
        title,
        content,
        publish_time: new Date(),
        is_deleted: 0
    };
    await addLog(info.userId, info.realName, info.identity, '通知发布', `发布通知：${title}`, info.classId);
    // 推送通知（独立处理，不影响主流程）
    pushNewNotice(result.insertId, title, info.classId, req.app.locals.sendToUser);
    res.json(newNotice);
});

// 编辑通知
router.put('/notices/:id', async (req, res) => {
    const info = await getTeacherInfo(req.session.account);
    if (!info || info.identity !== 'teacher') return res.status(403).json({ success: false, message: '无权限编辑通知' });
    if (!info.classId) return res.status(403).json({ success: false, message: '未分配班级' });

    const { title, content } = req.body;
    if (!title || !content) return res.status(400).json({ success: false, message: '标题和内容不能为空' });
    if (title.length > 100) return res.status(400).json({ success: false, message: '标题不能超过100个字符' });

    const noticeId = parseInt(req.params.id);
    const notice = await getNoticeForTeacher(noticeId, info.classId);
    if (!notice) return res.status(404).json({ success: false, message: '通知不存在或不属于您的班级' });

    await pool.query('UPDATE notices SET title = ?, content = ? WHERE id = ?', [title, content, noticeId]);
    await addLog(info.userId, info.realName, info.identity, '通知编辑', `编辑通知：${title}`, info.classId);
    res.json({ success: true, message: '通知修改成功' });
});

// 删除通知（软删除）
router.delete('/notices/:id', async (req, res) => {
    const info = await getTeacherInfo(req.session.account);
    if (!info || info.identity !== 'teacher') return res.status(403).json({ success: false, message: '无权限删除通知' });
    if (!info.classId) return res.status(403).json({ success: false, message: '未分配班级' });

    const noticeId = parseInt(req.params.id);
    const notice = await getNoticeForTeacher(noticeId, info.classId);
    if (!notice) return res.status(404).json({ success: false, message: '通知不存在或不属于您的班级' });

    await pool.query('UPDATE notices SET is_deleted = 1 WHERE id = ?', [noticeId]);
    await addLog(info.userId, info.realName, info.identity, '通知删除', `删除通知：${notice.title}`, info.classId);
    res.json({ success: true, message: '通知已删除' });
});

// 获取操作日志（分页）
router.get('/logs', async (req, res) => {
    const info = await getTeacherInfo(req.session.account);
    if (!info || info.identity !== 'teacher') return res.status(403).json({ success: false, message: '无权限查看日志' });
    if (!info.classId) return res.json({ logs: [], total: 0, page: 1, pageSize: 15 });

    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 15;
    const offset = (page - 1) * pageSize;

    const [countRows] = await pool.query(
        'SELECT COUNT(*) AS total FROM operation_logs WHERE target_class_id = ?',
        [info.classId]
    );
    const total = countRows[0].total;

    const [logs] = await pool.query(
        `SELECT user_name, operation_type, operation_content, created_at
        FROM operation_logs
        WHERE target_class_id = ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?`,
        [info.classId, pageSize, offset]
    );
    res.json({ logs, total, page, pageSize });
});

// 获取某条通知的详细已读/未读名单
router.get('/notices/:id/read-status', async (req, res) => {
    const info = await getTeacherInfo(req.session.account);
    if (!info || info.identity !== 'teacher') return res.status(403).json({ success: false, message: '无权限获取通知' });
    if (!info.classId) return res.status(403).json({ success: false, message: '未分配班级' });

    const noticeId = parseInt(req.params.id);
    const notice = await getNoticeForTeacher(noticeId, info.classId);
    if (!notice) return res.status(404).json({ success: false, message: '通知不存在或不属于您的班级' });

    // 查询班级所有在读学生
    const [students] = await pool.query(
        `SELECT id, real_name FROM users
        WHERE id IN (SELECT student_id FROM class_members WHERE class_id = ? AND status = 1)
        AND identity = 'student'`,
        [info.classId]
    );
    // 已读学生集合
    const [readRecords] = await pool.query(
        'SELECT student_id FROM notice_read_status WHERE notice_id = ? AND is_read = 1',
        [noticeId]
    );
    const readSet = new Set(readRecords.map(r => r.student_id));
    const readList = students.filter(s => readSet.has(s.id)).map(s => s.real_name);
    const unreadList = students.filter(s => !readSet.has(s.id)).map(s => s.real_name);

    res.json({
        readList,
        unreadList,
        totalStudents: students.length,
        readCount: readList.length,
        unreadCount: unreadList.length
    });
});
// 生成学生个性化评语
router.post('/comment', async (req, res) => {
    const info = await getTeacherInfo(req.session.account);
    if (!info || !info.classId) {
        return res.status(403).json({ success: false, message: '未分配班级' });
    }
    const { studentId, examDate, style = 'formal' } = req.body;
    if (!studentId) {
        return res.status(400).json({ success: false, message: '缺少学生ID' });
    }

    // 解析考试日期（默认最近一次）
    const targetDate = await resolveExamDate(info.classId, examDate);
    if (!targetDate) {
        return res.json({ comment: '该班级暂无考试成绩，无法生成评语' });
    }

    // 获取学生姓名
    const [stuRows] = await pool.query(
        'SELECT real_name FROM users WHERE id = ? AND identity = ?',
        [studentId, 'student']
    );
    if (stuRows.length === 0) {
        return res.status(404).json({ success: false, message: '学生不存在' });
    }
    const studentName = stuRows[0].real_name;

    // 查询该生本次考试各科成绩及班级平均分
    const [scores] = await pool.query(`
        SELECT s.subject, s.score, s.full_mark,
               ROUND(AVG(s2.score), 1) AS class_avg,
               RANK() OVER (PARTITION BY s.subject ORDER BY s.score DESC) AS class_rank
        FROM scores s
        LEFT JOIN scores s2 ON s2.class_id = s.class_id 
            AND s2.subject = s.subject 
            AND s2.exam_date = s.exam_date
        WHERE s.student_id = ? AND s.class_id = ? AND s.exam_date = ?
        GROUP BY s.subject, s.score, s.full_mark
        ORDER BY s.subject
    `, [studentId, info.classId, targetDate]);

    // 查询总分及总分排名
    const [totalRow] = await pool.query(`
        SELECT SUM(score) AS total_score,
               RANK() OVER (ORDER BY SUM(score) DESC) AS total_rank
        FROM scores
        WHERE class_id = ? AND exam_date = ?
        GROUP BY student_id
        HAVING student_id = ?
    `, [info.classId, targetDate, studentId]);

    // 查询班级总人数
    const [countRow] = await pool.query(
        'SELECT COUNT(DISTINCT student_id) AS total FROM scores WHERE class_id = ? AND exam_date = ?',
        [info.classId, targetDate]
    );
    const totalStudents = countRow[0]?.total || 0;

    if (scores.length === 0) {
        return res.json({ comment: '该生本次考试无成绩记录' });
    }

    // 构建 Prompt
    const styleDesc = style === 'encouraging' 
        ? '请使用温暖、鼓励的语气，多以肯定为主，委婉指出不足。' 
        : '请使用正式、客观的语气，适合写入成绩单。';
    
    let prompt = `你是一位经验丰富的班主任。请根据以下学生成绩生成一段约120字的学期评语。\n`;
    prompt += `学生：${studentName}，考试日期：${targetDate}\n`;
    prompt += `班级人数：${totalStudents}，各科成绩如下：\n`;
    scores.forEach(r => {
        prompt += `${r.subject}：${r.score}/${r.full_mark}，班级平均${r.class_avg}，排名第${r.class_rank}\n`;
    });
    if (totalRow.length > 0) {
        prompt += `总分：${totalRow[0].total_score}，总分班级排名第${totalRow[0].total_rank}/${totalStudents}\n`;
    }
    prompt += `${styleDesc}\n`;
    prompt += `要求：必须基于上述成绩数据，不涉及学习态度、课堂表现等未给出的信息；\n`;
    prompt += `直接输出评语文本，不要包含任何前缀或解释。`;

    // 调用大模型
    const apiKey = process.env.AI_API_KEY;
    const apiEndpoint = process.env.AI_API_ENDPOINT;
    const model = process.env.AI_MODEL;

    if (!apiKey || !apiEndpoint || !model) {
        return res.status(500).json({ success: false, message: 'AI 服务未配置' });
    }

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
                    { role: 'system', content: '你是一名专业班主任，擅长写学生评语。' },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 300,
                temperature: 0.7
            })
        });

        if (!aiRes.ok) {
            const errText = await aiRes.text();
            console.error('AI 评语生成失败:', errText);
            return res.status(502).json({ success: false, message: 'AI 服务暂时不可用' });
        }

        const aiData = await aiRes.json();
        const comment = aiData.choices[0].message.content.trim();

        // 记录日志
        await addLog(info.userId, info.realName, 'teacher', 'AI评语', `为 ${studentName} 生成评语`, info.classId);

        res.json({ comment });
    } catch (err) {
        console.error('AI 评语异常:', err);
        res.status(500).json({ success: false, message: '评语生成失败' });
    }
});

module.exports = router;