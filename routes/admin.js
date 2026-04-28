const express = require('express');
const router = express.Router();
const pool = require('../utils/pool');
const addLog = require('../utils/logger');
const { isAdmin } = require('../middleware/auth');

router.use(isAdmin);

/**
 * 根据账号获取当前管理员信息
 * @returns {{ id: number, realName: string }}
 */
async function getAdminInfo(account) {
    const [rows] = await pool.query('SELECT id, real_name FROM users WHERE account = ?', [account]);
    return { id: rows[0].id, realName: rows[0].real_name };
}

/**
 * 以管理员身份记录操作日志
 */
async function addAdminLog(account, operationType, content, classId = null) {
    const { id, realName } = await getAdminInfo(account);
    await addLog(id, realName, 'admin', operationType, content, classId);
}

/**
 * 通过完整班级名（年级+班级）获取班级ID
 * @returns {number|null}
 */
async function getClassIdByFullName(fullClassName) {
    const [rows] = await pool.query(
        `SELECT c.id FROM classes c
        JOIN grades g ON c.grade_id = g.id
        WHERE CONCAT(g.grade_name, c.class_name) = ?`,
        [fullClassName]
    );
    return rows.length > 0 ? rows[0].id : null;
}

/**
 * 检查学生是否已在指定班级中
 */
async function isStudentInClass(userId, classId) {
    const [rows] = await pool.query(
        'SELECT 1 FROM class_members WHERE class_id = ? AND student_id = ? AND status = 1',
        [classId, userId]
    );
    return rows.length > 0;
}

// 获取当前用户信息
router.get('/info', async (req, res) => {
    const { id, realName } = await getAdminInfo(req.session.account);
    res.json({ id, name: realName });
});

// 获取全校所有考试日期（去重，倒序）
router.get('/exams', async (req, res) => {
    const [rows] = await pool.query(
        `SELECT DISTINCT DATE_FORMAT(exam_date, '%Y-%m-%d') AS exam_date
        FROM scores ORDER BY exam_date DESC`
    );
    res.json(rows.map(r => r.exam_date));
});

// 获取班级信息（分页）
router.get('/classes', async (req, res) => {
    try {
        const { page = 1, pageSize = 10 } = req.query;
        const limit = parseInt(pageSize);
        const offset = (parseInt(page) - 1) * limit;

        const [countRows] = await pool.query('SELECT COUNT(*) AS total FROM classes');
        const total = countRows[0].total;

        const [rows] = await pool.query(
        `SELECT c.id, c.class_name AS rawClassName, c.grade_id, g.grade_name,
                u.real_name AS teacher, u.id AS teacherId,
                COUNT(cm.student_id) AS studentCount
        FROM classes c
        LEFT JOIN grades g ON c.grade_id = g.id
        LEFT JOIN users u ON c.teacher_id = u.id
        LEFT JOIN class_members cm ON cm.class_id = c.id AND cm.status = 1
        GROUP BY c.id
        ORDER BY g.sort_order, c.id
        LIMIT ? OFFSET ?`,
        [limit, offset]
        );

        const classes = rows.map(row => ({
            id: row.id,
            className: `${row.grade_name}${row.rawClassName}`,
            rawClassName: row.rawClassName,
            gradeId: row.grade_id,
            gradeName: row.grade_name,
            teacher: row.teacher || '',
            teacherId: row.teacherId,
            studentCount: row.studentCount,
            students: []
        }));

        res.json({ data: classes, total, page: parseInt(page), pageSize: limit });
    } catch (err) {
        console.error(err);
        res.status(500).json([]);
    }
});

// 获取教师列表
router.get('/teachers', async (req, res) => {
    const [teachers] = await pool.query(
        "SELECT id, real_name AS name FROM users WHERE identity = 'teacher'"
    );
    res.json(teachers);
});

// 获取成绩明细（支持大量筛选、排序、导出）
router.get('/scores', async (req, res) => {
    try {
        const {
            exam_date = '', class_name = '所有班级', subject = '',
            page = 1, pageSize = 20,
            sortField = 'className', sortOrder = 'asc',
            all = 'false'
        } = req.query;

        const limit = parseInt(pageSize);
        const offset = (parseInt(page) - 1) * limit;
        const isExport = all === 'true';

        const conditions = [];
        const params = [];

        if (exam_date) {
            conditions.push('s.exam_date = ?');
            params.push(exam_date);
        }
        if (class_name && class_name !== '所有班级') {
            conditions.push('CONCAT(g.grade_name, c.class_name) = ?');
            params.push(class_name);
        }
        if (subject && subject !== '总分') {
            conditions.push('s.subject = ?');
            params.push(subject);
        }

        const whereSQL = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

        const sortMap = {
            className: 'className',
            studentId: 'u.account',
            studentName: 'u.real_name',
            subjectScore: 's.score'
        };
        const orderBy = sortMap[sortField] || 'className';
        const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';

        // 总数
        let total = 0;
        if (!isExport) {
        const [countRows] = await pool.query(
            `SELECT COUNT(*) AS total FROM scores s
            INNER JOIN users u ON s.student_id = u.id
            INNER JOIN classes c ON s.class_id = c.id
            INNER JOIN grades g ON g.id = c.grade_id
            ${whereSQL}`,
            params
        );
        total = countRows[0].total;
        }

        // 统计数据
        const [statsRows] = await pool.query(
            `SELECT ROUND(AVG(s.score), 1) AS avg, MAX(s.score) AS max, MIN(s.score) AS min,
                    COUNT(*) AS totalStu,
                    SUM(CASE WHEN s.score >= s.full_mark * 0.6 THEN 1 ELSE 0 END) AS passCount
            FROM scores s
            INNER JOIN users u ON s.student_id = u.id
            INNER JOIN classes c ON s.class_id = c.id
            INNER JOIN grades g ON g.id = c.grade_id
            ${whereSQL}`,
            params
        );
        const stats = statsRows[0] || {};
        const passRate = stats.totalStu > 0 ? ((stats.passCount / stats.totalStu) * 100).toFixed(1) + '%' : '0%';

        // 分页数据
        let dataSQL = `
            SELECT s.id,
                    CONCAT(g.grade_name, c.class_name) AS className,
                    u.real_name AS studentName,
                    u.account AS studentId,
                    s.subject, s.score, s.exam_date,
                    RANK() OVER (PARTITION BY s.class_id, s.subject ORDER BY s.score DESC) AS class_rank_subject,
                    RANK() OVER (PARTITION BY s.subject, g.id ORDER BY s.score DESC) AS grade_rank_subject
            FROM scores s
            INNER JOIN users u ON s.student_id = u.id
            INNER JOIN classes c ON s.class_id = c.id
            INNER JOIN grades g ON g.id = c.grade_id
            ${whereSQL}
            ORDER BY ${orderBy} ${direction}
        `;
        const dataParams = [...params];
        if (!isExport) {
            dataSQL += ' LIMIT ? OFFSET ?';
            dataParams.push(limit, offset);
        }
        const [scores] = await pool.query(dataSQL, dataParams);
        if (isExport) total = scores.length;

        res.json({
            data: scores,
            total,
            page: parseInt(page),
            pageSize: limit,
            stats: {
                avg: stats.avg || '0.0',
                max: stats.max || 0,
                min: stats.min || 0,
                passCount: stats.passCount || 0,
                totalStu: stats.totalStu || 0,
                passRate
            },
            hasExamDate: !!exam_date
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '查询失败' });
    }
});

// 获取所有科目
router.get('/subjects', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT DISTINCT subject FROM scores ORDER BY subject');
        const subjects = rows.map(r => r.subject);
        subjects.unshift('总分');
        res.json(subjects);
    } catch (err) {
        console.error(err);
        res.status(500).json([]);
    }
});

// 获取全量总分排名
router.get('/totalscores', async (req, res) => {
    try {
        const {
            exam_date = '', class_name = '所有班级',
            page = 1, pageSize = 20,
            sortField = 'totalScore', sortOrder = 'desc'
        } = req.query;

        const limit = parseInt(pageSize);
        const offset = (parseInt(page) - 1) * limit;

        const conditions = [];
        const params = [];
        if (exam_date) {
            conditions.push('s.exam_date = ?');
            params.push(exam_date);
        }
        const whereSQL = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

        const sortMap = {
            totalScore: 'total_score',
            studentId: 'u.account',
            studentName: 'u.real_name',
            className: 'className',
            totalGradeRank: 'total_rank',
            totalClassRank: 'class_rank_in_class'
        };
        const orderBy = sortMap[sortField] || 'total_score';
        const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';

        // 统计
        let statsSQL = `
            SELECT ROUND(AVG(total_score), 1) AS avg, MAX(total_score) AS max, MIN(total_score) AS min, COUNT(*) AS totalStu
            FROM (
                SELECT SUM(s.score) AS total_score, CONCAT(g.grade_name, c.class_name) AS className
                FROM scores s
                INNER JOIN users u ON s.student_id = u.id
                INNER JOIN classes c ON s.class_id = c.id
                INNER JOIN grades g ON g.id = c.grade_id
                ${whereSQL}
                GROUP BY u.id, c.id
            ) AS student_totals
        `;
        const statsParams = [...params];
        if (class_name && class_name !== '所有班级') {
            statsSQL += ' WHERE className = ?';
            statsParams.push(class_name);
        }
        const [statsRows] = await pool.query(statsSQL, statsParams);
        const stats = statsRows[0] || {};

        // 总数
        let countSQL = `
            SELECT COUNT(*) AS total FROM (
                SELECT u.id, CONCAT(g.grade_name, c.class_name) AS className
                FROM scores s
                INNER JOIN users u ON s.student_id = u.id
                INNER JOIN classes c ON s.class_id = c.id
                INNER JOIN grades g ON g.id = c.grade_id
                ${whereSQL}
                GROUP BY u.id, c.id
            ) AS student_list
        `;
        const countParams = [...params];
        if (class_name && class_name !== '所有班级') {
            countSQL += ' WHERE className = ?';
            countParams.push(class_name);
        }
        const [countRows] = await pool.query(countSQL, countParams);
        const total = countRows[0].total;

        // 分页数据
        let dataSQL = `
            SELECT u.id AS studentId, u.real_name AS studentName, u.account AS studentIdNum,
                    CONCAT(g.grade_name, c.class_name) AS className,
                    SUM(s.score) AS total_score,
                    RANK() OVER (ORDER BY SUM(s.score) DESC) AS total_rank,
                    RANK() OVER (PARTITION BY c.id ORDER BY SUM(s.score) DESC) AS class_rank_in_class
            FROM scores s
            INNER JOIN users u ON s.student_id = u.id
            INNER JOIN classes c ON s.class_id = c.id
            INNER JOIN grades g ON g.id = c.grade_id
            ${whereSQL}
            GROUP BY u.id, c.id
        `;
        const havingParams = [...params];
        if (class_name && class_name !== '所有班级') {
            dataSQL += ' HAVING className = ?';
            havingParams.push(class_name);
        }
        dataSQL += ` ORDER BY ${orderBy} ${direction} LIMIT ? OFFSET ?`;
        havingParams.push(limit, offset);
        const [rows] = await pool.query(dataSQL, havingParams);

        const result = rows.map(row => ({
            id: row.studentId,
            studentName: row.studentName,
            studentId: row.studentIdNum,
            className: row.className,
            total_score: row.total_score,
            score: parseFloat(row.total_score) || 0,
            class_rank: row.total_rank,
            class_rank_in_class: row.class_rank_in_class
        }));

        res.json({
            data: result,
            total,
            page: parseInt(page),
            pageSize: limit,
            stats: {
                avg: stats.avg || '0.0',
                max: stats.max || 0,
                min: stats.min || 0,
                totalStu: stats.totalStu || 0
            },
            hasExamDate: !!exam_date
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '查询失败' });
    }
});

// 获取通知（分页）
router.get('/notices', async (req, res) => {
    const { page = 1, pageSize = 10, class_name = 'all' } = req.query;
    const limit = parseInt(pageSize);
    const offset = (parseInt(page) - 1) * limit;

    try {
        let classCondition = '';
        const params = [];

        if (class_name && class_name !== 'all') {
            classCondition = 'AND CONCAT(g.grade_name, c.class_name) = ?';
            params.push(class_name);
        }

        const [countRows] = await pool.query(
            `SELECT COUNT(*) AS total FROM notices n
            INNER JOIN classes c ON n.class_id = c.id
            INNER JOIN grades g ON g.id = c.grade_id
            WHERE n.is_deleted = 0 ${classCondition}`,
            params);
        const total = countRows[0].total;

        const [notices] = await pool.query(
            `SELECT n.id,
                    CONCAT(g.grade_name, c.class_name) AS className,
                    n.title, n.content, n.publish_time AS publishTime,
                    u.real_name AS teacher_name,
                    (SELECT COUNT(*) FROM notice_read_status rs WHERE rs.notice_id = n.id AND rs.is_read = 1) AS readCount,
                    (SELECT COUNT(*) FROM class_members cm WHERE cm.class_id = n.class_id AND cm.status = 1) AS totalStu
            FROM notices n
            INNER JOIN classes c ON n.class_id = c.id
            INNER JOIN grades g ON g.id = c.grade_id
            INNER JOIN users u ON n.publisher_id = u.id
            WHERE n.is_deleted = 0 ${classCondition}
            ORDER BY n.publish_time DESC
            LIMIT ? OFFSET ?`,
        [...params, limit, offset]);

        res.json({ data: notices, total, page: parseInt(page), pageSize: limit });
    } catch (err) {
        console.error(err);
        res.status(500).json([]);
    }
});

// 获取全量操作日志（分页）
router.get('/logs', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 15;
    const offset = (page - 1) * pageSize;

    const [countRows] = await pool.query('SELECT COUNT(*) AS total FROM operation_logs');
    const total = countRows[0].total;

    const [logs] = await pool.query(
        `SELECT u.real_name AS operator, ol.operation_type AS operationType,
                ol.operation_content AS content, ol.created_at AS operateTime
        FROM operation_logs ol
        INNER JOIN users u ON ol.user_id = u.id
        ORDER BY operateTime DESC
        LIMIT ? OFFSET ?`,
        [pageSize, offset]
    );

    res.json({ logs, total, page, pageSize });
});

// 获取年级列表
router.get('/grades', async (req, res) => {
    try {
        const [grades] = await pool.query('SELECT id, grade_name FROM grades ORDER BY sort_order, id');
        res.json(grades);
    } catch (err) {
        console.error(err);
        res.status(500).json([]);
    }
});

// 获取特定班级的学生列表
router.get('/classes/:classId/students', async (req, res) => {
    const classId = parseInt(req.params.classId);
    try {
        const [students] = await pool.query(
        `SELECT u.id, u.real_name AS name, u.account AS studentId
        FROM class_members cm
        JOIN users u ON cm.student_id = u.id
        WHERE cm.class_id = ? AND cm.status = 1 AND u.identity = 'student'`,
        [classId]
        );
        res.json(students);
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '获取学生列表失败' });
    }
});

// 添加学生到班级
router.post('/classes/:classId/students', async (req, res) => {
    const classId = parseInt(req.params.classId);
    const { name, studentId } = req.body;
    if (!name || !studentId) return res.status(400).json({ success: false, message: '姓名和学号不能为空' });

    try {
        let [user] = await pool.query('SELECT id FROM users WHERE account = ?', [studentId]);
        let userId;

        if (user.length === 0) {
            const [result] = await pool.query(
                'INSERT INTO users (account, password, real_name, identity) VALUES (?, ?, ?, ?)',
                [studentId, '12345678', name, 'student']
            );
            userId = result.insertId;
        } else {
            userId = user[0].id;
            if (await isStudentInClass(userId, classId)) {
                return res.status(400).json({ success: false, message: '该学生已在本班级中' });
            }
        }

        await pool.query('INSERT INTO class_members (class_id, student_id, status) VALUES (?, ?, 1)', [classId, userId]);
        await addAdminLog(
            req.session.account,
            '学生管理',
            `向班级 ${classId} 添加学生 ${name}(${studentId})`,
            classId
        );
        res.json({ success: true, message: '添加成功' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '添加失败' });
    }
});

// 添加教师
router.post('/teachers', async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: '教师姓名不能为空' });

    try {
        const account = `tch_${Date.now()}`;
        const [result] = await pool.query(
            'INSERT INTO users (account, password, real_name, identity) VALUES (?, ?, ?, ?)',
            [account, '12345678', name, 'teacher']
        );
        if (result.affectedRows === 1) {
            await addAdminLog(req.session.account, '教师管理', `添加教师 ${name} (账号: ${account})`);
            res.json({ success: true, message: '教师添加成功', teacherId: result.insertId });
        } else {
            res.status(500).json({ success: false, message: '添加失败' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '数据库错误' });
    }
});

// 删除班级成员（软删除，status=0）
router.delete('/classes/:classId/students/:studentId', async (req, res) => {
    const classId = parseInt(req.params.classId);
    const studentId = parseInt(req.params.studentId);

    try {
        const [result] = await pool.query(
            'UPDATE class_members SET status = 0 WHERE class_id = ? AND student_id = ?',
            [classId, studentId]
        );
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: '学生不存在' });

        await addAdminLog(req.session.account, '学生管理', `从班级 ${classId} 删除学生ID ${studentId}`, classId);
        res.json({ success: true, message: '删除成功' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '删除失败' });
    }
});

// 绑定/解绑班主任（带互斥检查）
router.put('/classes/:classId/teacher', async (req, res) => {
    const classId = parseInt(req.params.classId);
    const { teacherId } = req.body; // null 表示解绑

    if (isNaN(classId)) return res.status(400).json({ success: false, message: '班级ID无效' });

    try {
        if (teacherId) {
        const [other] = await pool.query(
            'SELECT id FROM classes WHERE teacher_id = ? AND id != ?',
            [teacherId, classId]
        );
        if (other.length > 0) {
            return res.status(400).json({ success: false, message: '该教师已是其他班级的班主任，请先解绑' });
        }
        }

        await pool.query('UPDATE classes SET teacher_id = ? WHERE id = ?', [teacherId || null, classId]);

        let teacherName = '';
        if (teacherId) {
            const [t] = await pool.query('SELECT real_name FROM users WHERE id = ?', [teacherId]);
            teacherName = t[0]?.real_name || '';
        }

        await addAdminLog(
            req.session.account,
            '教师绑定',
            teacherId ? `将教师 ${teacherName} 绑定到班级 ${classId}` : `解绑班级 ${classId} 的班主任`,
            classId
        );

        res.json({ success: true, message: '操作成功' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '操作失败' });
    }
});

// 修改班级名称/年级
router.put('/classes/:classId', async (req, res) => {
    const classId = parseInt(req.params.classId);
    const { className, gradeId } = req.body;

    try {
        const [current] = await pool.query('SELECT grade_id, class_name FROM classes WHERE id = ?', [classId]);
        if (current.length === 0) return res.status(404).json({ success: false, message: '班级不存在' });

        const newClassName = className !== undefined ? className : current[0].class_name;
        const newGradeId = gradeId !== undefined ? gradeId : current[0].grade_id;

        // 检查同年级下是否存在同名班级（排除自身）
        const [existing] = await pool.query(
            'SELECT id FROM classes WHERE grade_id = ? AND class_name = ? AND id != ?',
            [newGradeId, newClassName, classId]
        );
        if (existing.length > 0) return res.status(400).json({ success: false, message: '该年级下已存在同名班级' });

        const updateFields = [];
        const values = [];
        if (className !== undefined) {
            updateFields.push('class_name = ?');
            values.push(className);
        }
        if (gradeId !== undefined) {
            updateFields.push('grade_id = ?');
            values.push(gradeId);
        }
        if (updateFields.length === 0) return res.status(400).json({ success: false, message: '没有要更新的字段' });

        values.push(classId);
        await pool.query(`UPDATE classes SET ${updateFields.join(', ')} WHERE id = ?`, values);
        res.json({ success: true, message: '修改成功' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '更新失败' });
    }
});

// 删除班级（级联删除成员关系）
router.delete('/classes/:classId', async (req, res) => {
    const classId = parseInt(req.params.classId);
    try {
        await pool.query('DELETE FROM class_members WHERE class_id = ?', [classId]);
        await pool.query('DELETE FROM classes WHERE id = ?', [classId]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
});

// 新增班级
router.post('/classes', async (req, res) => {
    const { className, gradeId } = req.body;
    if (!className || !gradeId) return res.status(400).json({ success: false, message: '班级名称和年级ID不能为空' });

    try {
        const [existing] = await pool.query(
            'SELECT id FROM classes WHERE grade_id = ? AND class_name = ?',
            [gradeId, className]
        );
        if (existing.length > 0) return res.status(400).json({ success: false, message: '该年级下已存在同名班级' });

        const [result] = await pool.query('INSERT INTO classes (class_name, grade_id) VALUES (?, ?)', [className, gradeId]);
        res.json({ success: true, classId: result.insertId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
});

// 获取科目满分
router.post('/fullmark', async (req, res) => {
    const { subject } = req.body;
    try {
        const [rows] = await pool.query('SELECT full_mark FROM scores WHERE subject = ? LIMIT 1', [subject]);
        res.json({ full_mark: rows.length ? rows[0].full_mark : 100 });
    } catch (err) {
        console.error(err);
        res.status(500).json({ full_mark: 100 });
    }
});

// 添加成绩
router.post('/scores', async (req, res) => {
    const { className, studentName, studentId, subject, score, examDate } = req.body;
    if (!className || !studentName || !studentId || !subject || score === undefined) {
        return res.status(400).json({ success: false, message: '参数不完整' });
    }
    if (subject === '总分') return res.status(400).json({ success: false, message: '总分由系统自动计算，不可手动添加或修改' });

    try {
        const classId = await getClassIdByFullName(className);
        if (!classId) return res.status(404).json({ success: false, message: '班级不存在' });

        // 科目满分
        const [fullRows] = await pool.query('SELECT full_mark FROM scores WHERE subject = ? LIMIT 1', [subject]);
        const fullMark = fullRows.length ? fullRows[0].full_mark : 100;
        if (score > fullMark) return res.status(400).json({ success: false, message: `成绩不能超过满分 ${fullMark}` });

        // 学生处理：自动创建
        let [userRows] = await pool.query('SELECT id FROM users WHERE account = ?', [studentId]);
        let userId;
        if (userRows.length === 0) {
        const [result] = await pool.query(
            'INSERT INTO users (account, password, real_name, identity) VALUES (?, ?, ?, ?)',
            [studentId, '12345678', studentName, 'student']
        );
        userId = result.insertId;
        } else {
        userId = userRows[0].id;
        }

        // 检查班级成员
        if (!(await isStudentInClass(userId, classId))) {
        return res.status(400).json({ success: false, message: '该学生不在指定班级中，请先通过班级管理添加学生' });
        }

        let finalExamDate = examDate ? examDate : new Date().toISOString().slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(finalExamDate)) {
        finalExamDate = new Date().toISOString().slice(0, 10);
        }

        await pool.query(
        'INSERT INTO scores (student_id, class_id, subject, score, exam_date, full_mark) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, classId, subject, score, finalExamDate, fullMark]
        );

        await addAdminLog(req.session.account, '成绩添加', `添加成绩：${className} ${studentName} ${subject} ${score}`, classId);
        res.json({ success: true, message: '添加成功' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '添加失败' });
    }
});

// 修改成绩
router.put('/scores/:id', async (req, res) => {
    const scoreId = parseInt(req.params.id);
    const { newScore } = req.body;
    if (newScore === undefined) return res.status(400).json({ success: false, message: '缺少新成绩' });

    try {
        const [oldRows] = await pool.query(
            'SELECT student_id, class_id, subject, score, full_mark FROM scores WHERE id = ?',
            [scoreId]
        );
        if (oldRows.length === 0) return res.status(404).json({ success: false, message: '成绩记录不存在' });
        const old = oldRows[0];
        if (old.subject === '总分') return res.status(400).json({ success: false, message: '总分由系统自动计算，不可手动修改' });
        if (newScore > old.full_mark) return res.status(400).json({ success: false, message: `成绩不能超过满分 ${old.full_mark}` });

        await pool.query('UPDATE scores SET score = ? WHERE id = ?', [newScore, scoreId]);

        const [student] = await pool.query('SELECT real_name FROM users WHERE id = ?', [old.student_id]);
        await addAdminLog(
            req.session.account,
            '成绩修改',
            `修改学生 ${student[0].real_name} 的 ${old.subject} 成绩从 ${old.score} 改为 ${newScore}`,
            old.class_id
        );
        res.json({ success: true, message: '修改成功' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '操作失败' });
    }
});

// 删除成绩
router.delete('/scores/:id', async (req, res) => {
    const scoreId = parseInt(req.params.id);
    try {
        const [rows] = await pool.query('SELECT student_id, class_id, subject FROM scores WHERE id = ?', [scoreId]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: '成绩记录不存在' });
        const { student_id, class_id, subject } = rows[0];
        if (subject === '总分') return res.status(400).json({ success: false, message: '总分不可删除' });

        await pool.query('DELETE FROM scores WHERE id = ?', [scoreId]);

        const [student] = await pool.query('SELECT real_name FROM users WHERE id = ?', [student_id]);
        await addAdminLog(req.session.account, '成绩删除', `删除学生 ${student[0].real_name} 的 ${subject} 成绩`, class_id);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
});

module.exports = router;