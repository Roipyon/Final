const express = require('express');
const router = express.Router();
const pool = require('../utils/pool');
const addLog = require('../utils/logger');
const { isAdmin } = require('../middleware/auth');

router.use(isAdmin);

// 管理员

// 获取当前用户信息
router.get('/info',isAdmin,async(req,res)=>{
    const account = req.session.account;
    const [rows] = await pool.query('select id,real_name from users where account = ?',[account]);
    const { id: userId, real_name: name } = rows[0];
    res.json({
        id: userId,
        name: name
    });
});

// 获取全校所有考试日期（去重，倒序）
router.get('/exams',isAdmin,async(req,res)=>{
    const [rows] = await pool.query(`
        SELECT DISTINCT DATE_FORMAT(exam_date, '%Y-%m-%d') as exam_date
        FROM scores 
        ORDER BY exam_date DESC
    `);
    res.json(rows.map(r => r.exam_date));
});

// 获取班级信息
router.get('/classes',isAdmin,async(req,res)=>{
    try {
        const { page = 1, pageSize = 10 } = req.query;
        const limit = parseInt(pageSize);
        const offset = (parseInt(page) - 1) * limit;

        // 查询总数
        const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM classes`);
        const total = countRows[0].total;

        // 分页查询班级信息
        const [rows] = await pool.query(`
            SELECT 
                c.id,
                c.class_name AS rawClassName,
                c.grade_id,
                g.grade_name,
                u.real_name AS teacher,
                u.id AS teacherId,
                COUNT(cm.student_id) AS studentCount
            FROM classes c
            LEFT JOIN grades g ON c.grade_id = g.id
            LEFT JOIN users u ON c.teacher_id = u.id
            LEFT JOIN class_members cm ON cm.class_id = c.id AND cm.status = 1
            GROUP BY c.id
            ORDER BY g.sort_order, c.id
            LIMIT ? OFFSET ?
        `, [limit, offset]);

        const classes = rows.map(row => ({
            id: row.id,
            className: `${row.grade_name}${row.rawClassName}`,
            rawClassName: row.rawClassName,
            gradeId: row.grade_id,
            gradeName: row.grade_name,
            teacher: row.teacher || '',
            teacherId: row.teacherId,
            studentCount: row.studentCount,
            students: []           // 初始不加载学生
        }));

        res.json({ 
            data: classes, 
            total, 
            page: parseInt(page), 
            pageSize: limit 
        });
    } catch (err) {
        console.error(err);
        res.status(500).json([]);
    }
});

// 获取教师信息
router.get('/teachers',isAdmin,async(req,res)=>{
    const [teachers] = await pool.query(`
        select
            id,
            real_name as name
        from users where identity = 'teacher'
    `);
    res.json(teachers);
});

router.get('/scores',isAdmin,async(req,res)=>{
    try {
        const {
            exam_date = '',
            class_name = '所有班级',
            subject = '',
            page = 1,
            pageSize = 20,
            sortField = 'className',
            sortOrder = 'asc',
            all = 'false'
        } = req.query;

        const limit = parseInt(pageSize);
        const offset = (parseInt(page) - 1) * limit;
        const isExport = all === 'true';

        // 构建 WHERE 条件
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

        // 排序字段映射
        const sortMap = {
            className: 'className',
            studentId: 'u.account',
            studentName: 'u.real_name',
            subjectScore: 's.score'
        };
        const orderBy = sortMap[sortField] || 'className';
        const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';

        // 查询总数
        const countSQL = `
            SELECT COUNT(*) AS total
            FROM scores s
            INNER JOIN users u ON s.student_id = u.id
            INNER JOIN classes c ON s.class_id = c.id
            INNER JOIN grades g ON g.id = c.grade_id
            ${whereSQL}
        `;

        let total;
        if (!isExport) {
            const [countRows] = await pool.query(countSQL, params);
            total = countRows[0].total;
        }
        
        const statsSQL = `
            SELECT
                ROUND(AVG(s.score), 1) AS avg,
                MAX(s.score) AS max,
                MIN(s.score) AS min,
                COUNT(*) AS totalStu,
                SUM(CASE WHEN s.score >= s.full_mark * 0.6 THEN 1 ELSE 0 END) AS passCount
            FROM scores s
            INNER JOIN users u ON s.student_id = u.id
            INNER JOIN classes c ON s.class_id = c.id
            INNER JOIN grades g ON g.id = c.grade_id
            ${whereSQL}
        `;
        const [statsRows] = await pool.query(statsSQL, params);
        const stats = statsRows[0] || {};
        const passRate = stats.totalStu > 0 
            ? ((stats.passCount / stats.totalStu) * 100).toFixed(1) + '%' 
            : '0%';

        // 查询分页数据
        let dataSQL = `
            SELECT
                s.id,
                CONCAT(g.grade_name, c.class_name) AS className,
                u.real_name AS studentName,
                u.account AS studentId,
                s.subject,
                s.score,
                s.exam_date,
                RANK() OVER (PARTITION BY s.class_id, s.subject ORDER BY s.score DESC) AS class_rank_subject,
                RANK() OVER (PARTITION BY s.subject, g.id ORDER BY s.score DESC) AS grade_rank_subject
            FROM scores s
            INNER JOIN users u ON s.student_id = u.id
            INNER JOIN classes c ON s.class_id = c.id
            INNER JOIN grades g ON g.id = c.grade_id
            ${whereSQL}
            ORDER BY ${orderBy} ${direction}
        `;
        const dataParams = [...params, limit, offset];
        if (!isExport) {
            dataSQL += ` LIMIT ? OFFSET ? `;
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
router.get('/subjects', isAdmin, async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT DISTINCT subject
            FROM scores
            ORDER BY subject
        `);
        const subjects = rows.map(r => r.subject);
        // 总分始终作为一个选项
        subjects.unshift('总分');
        res.json(subjects);
    } catch (err) {
        console.error(err);
        res.status(500).json([]);
    }
});

// 获取全量总分（跨班级）
router.get('/totalscores',isAdmin,async(req,res)=>{
    try {
        const {
            exam_date = '',
            class_name = '所有班级',
            page = 1,
            pageSize = 20,
            sortField = 'totalScore',
            sortOrder = 'desc'
        } = req.query;

        const limit = parseInt(pageSize);
        const offset = (parseInt(page) - 1) * limit;

        // 构建 WHERE 条件
        const conditions = [];
        const params = [];

        if (exam_date) {
            conditions.push('s.exam_date = ?');
            params.push(exam_date);
        }

        const whereSQL = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

        // 排序映射
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

        // 全量统计数据
        const statsSQL = `
            SELECT
                ROUND(AVG(total_score), 1) AS avg,
                MAX(total_score) AS max,
                MIN(total_score) AS min,
                COUNT(*) AS totalStu
            FROM (
                SELECT SUM(s.score) AS total_score
                FROM scores s
                INNER JOIN users u ON s.student_id = u.id
                INNER JOIN classes c ON s.class_id = c.id
                INNER JOIN grades g ON g.id = c.grade_id
                ${whereSQL}
                GROUP BY u.id
            ) AS student_totals
        `;
        const [statsRows] = await pool.query(statsSQL, params);
        const stats = statsRows[0] || {};

        // 总数查询
        const countSQL = `
            SELECT COUNT(*) AS total FROM (
                SELECT u.id
                FROM scores s
                INNER JOIN users u ON s.student_id = u.id
                INNER JOIN classes c ON s.class_id = c.id
                INNER JOIN grades g ON g.id = c.grade_id
                ${whereSQL}
                GROUP BY u.id
            ) AS student_list
        `;
        const [countRows] = await pool.query(countSQL, params);
        const total = countRows[0].total;

        // 分页数据查询（含班级筛选）
        let dataSQL = `
            SELECT
                u.id AS studentId,
                u.real_name AS studentName,
                u.account AS studentIdNum,
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
            dataSQL += ` HAVING className = ?`;
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
            score: parseFloat(row.total_score) || 0,        // 兼容前端统一字段
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

router.get('/notices',isAdmin,async(req,res)=>{
    const { page = 1, pageSize = 10, class_name = 'all' } = req.query;
    const limit = parseInt(pageSize);
    const offset = (parseInt(page) - 1) * limit;

    try {
        // 构建班级筛选条件
        let classCondition = '';
        const params = [];

        if (class_name && class_name !== 'all')
        {
            classCondition = `and concat(g.grade_name, c.class_name) = ?`;
            params.push(class_name);
        }

        const [countRows] = await pool.query(`
            SELECT COUNT(*) AS total 
            FROM notices n
            INNER JOIN classes c ON n.class_id = c.id
            INNER JOIN grades g ON g.id = c.grade_id
            WHERE n.is_deleted = 0 ${classCondition}
        `, params);
        const total = countRows[0].total;

        const [notices] = await pool.query(`
            SELECT
                n.id,
                CONCAT(g.grade_name, c.class_name) AS className,
                n.title,
                n.content,
                n.publish_time AS publishTime,
                u.real_name AS teacher_name,
                (SELECT COUNT(*) FROM notice_read_status rs WHERE rs.notice_id = n.id AND rs.is_read = 1) AS readCount,
                (SELECT COUNT(*) FROM class_members cm WHERE cm.class_id = n.class_id AND cm.status = 1) AS totalStu
            FROM notices n
            INNER JOIN classes c ON n.class_id = c.id
            INNER JOIN grades g ON g.id = c.grade_id
            INNER JOIN users u ON n.publisher_id = u.id
            WHERE n.is_deleted = 0 ${classCondition}
            ORDER BY n.publish_time DESC
            LIMIT ? OFFSET ?
        `, [...params, limit, offset]);

        res.json({ 
            data: notices, 
            total, 
            page: parseInt(page), 
            pageSize: limit 
        });
    } catch (err) {
        console.error(err);
        res.status(500).json([]);
    }
});

// 获取全量日志
router.get('/logs',isAdmin,async(req,res)=>{
    // 当前页数
    let page = parseInt(req.query.page) || 1;
    // 每页 15 条
    let pageSize = parseInt(req.query.pageSize) || 15;
    // 跳过多少条（分页渲染）
    const offset = (page - 1)*pageSize;
    // 查总数
    const [countRows] = await pool.query(`
        select count(*) as total from operation_logs
    `);
    const total = countRows[0].total;
    const [logs] = await pool.query(`
        select
            u.real_name as operator,
            ol.operation_type as operationType,
            ol.operation_content as content,
            ol.created_at as operateTime
        from operation_logs ol
        inner join users u on ol.user_id = u.id
        order by operateTime desc
        limit ? offset ?
    `,[pageSize, offset]);
    res.json({
        logs: logs,
        total: total,
        page: page,
        pageSize: pageSize
    });
});

// 获取年级信息
router.get('/grades',isAdmin,async(req,res)=>{
    try {
        const [grades] = await pool.query(`
            select
                id,
                grade_name
            from grades order by sort_order, id
        `);
        res.json(grades);
    } catch (err) {
        console.error(err);
        res.status(500).json([]);
    }
});

// 获取特定班级的所有学生信息
router.get('/classes/:classId/students',isAdmin,async(req,res)=>{
    const classId = parseInt(req.params.classId);
    try {
        const [students] = await pool.query(`
            SELECT u.id, u.real_name AS name, u.account AS studentId
            FROM class_members cm
            JOIN users u ON cm.student_id = u.id
            WHERE cm.class_id = ? AND cm.status = 1 AND u.identity = 'student'
        `, [classId]);
        res.json(students);
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '获取学生列表失败' });
    }
});

// 添加学生到班级（补录）
router.post('/classes/:classId/students',isAdmin,async(req,res)=>{
    const classId = parseInt(req.params.classId);
    const { name, studentId } = req.body;
    if (!name || !studentId) {
        return res.status(400).json({ success: false, message: '姓名和学号不能为空' });
    }
    try {
        // 检查学号是否已存在
        let [user] = await pool.query('SELECT id FROM users WHERE account = ?', [studentId]);
        let userId;
        if (user.length === 0) {
            // 创建新学生（默认密码 12345678）
            const [result] = await pool.query(
                'INSERT INTO users (account, password, real_name, identity) VALUES (?, ?, ?, ?)',
                [studentId, '12345678', name, 'student']
            );
            userId = result.insertId;
        } else {
            userId = user[0].id;
            // 检查是否已经是本班成员
            const [member] = await pool.query(
                'SELECT 1 FROM class_members WHERE class_id = ? AND student_id = ? AND status = 1',
                [classId, userId]
            );
            if (member.length > 0) {
                return res.status(400).json({ success: false, message: '该学生已在本班级中' });
            }
        }
        // 添加班级成员关系
        await pool.query(
            'INSERT INTO class_members (class_id, student_id, status) VALUES (?, ?, 1)',
            [classId, userId]
        );
        // 记录日志
        const account = req.session.account;
        const [admin] = await pool.query('SELECT id, real_name FROM users WHERE account = ?', [account]);
        await addLog(
            admin[0].id, 
            admin[0].real_name, 
            'admin', 
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

// 添加教师（教务主任权限）
router.post('/teachers',isAdmin,async(req,res)=>{
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ success: false, message: '教师姓名不能为空' });
    }
    try {
        // 生成账号：教师姓名拼音或固定规则，这里简单用 tch_ + 时间戳
        const account = `tch_${Date.now()}`;
        const defaultPassword = '12345678';  // 默认密码，后续可让教师自行修改
        const [result] = await pool.query(
            'INSERT INTO users (account, password, real_name, identity) VALUES (?, ?, ?, ?)',
            [account, defaultPassword, name, 'teacher']
        );
        if (result.affectedRows === 1) {
            // 可选：记录日志
            const adminAccount = req.session.account;
            const [admin] = await pool.query('SELECT id, real_name FROM users WHERE account = ?', [adminAccount]);
            await addLog(admin[0].id, admin[0].real_name, 'admin', '教师管理', `添加教师 ${name} (账号: ${account})`, null);
            res.json({ success: true, message: '教师添加成功', teacherId: result.insertId });
        } else {
            res.status(500).json({ success: false, message: '添加失败' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '数据库错误' });
    }
});

// 删除班级成员
router.delete('/classes/:classId/students/:studentId',isAdmin,async(req,res)=>{
    const classId = parseInt(req.params.classId);
    const studentId = parseInt(req.params.studentId);
    try {
        const [result] = await pool.query(
            'UPDATE class_members SET status = 0 WHERE class_id = ? AND student_id = ?',
            [classId, studentId]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: '学生不存在' });
        }
        // 记录日志
        const account = req.session.account;
        const [admin] = await pool.query('SELECT id, real_name FROM users WHERE account = ?', [account]);
        await addLog(
            admin[0].id, 
            admin[0].real_name, 
            'admin', 
            '学生管理', 
            `从班级 ${classId} 删除学生ID ${studentId}`, 
            classId
        );
        res.json({ success: true, message: '删除成功' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '删除失败' });
    }
});

// 绑定/解绑班主任（带互斥检查，一个教师只能担任一个班级）
router.put('/classes/:classId/teacher',isAdmin,async(req,res)=>{
    const classId = parseInt(req.params.classId);
    const { teacherId } = req.body; // 传 null 表示解绑
    if (classId === undefined || isNaN(classId)) {
        return res.status(400).json({ success: false, message: '班级ID无效' });
    }
    try {
        if (teacherId) {
            // 检查该教师是否已经是其他班级的班主任
            const [other] = await pool.query(
                'SELECT id FROM classes WHERE teacher_id = ? AND id != ?',
                [teacherId, classId]
            );
            if (other.length > 0) {
                return res.status(400).json({ success: false, message: '该教师已是其他班级的班主任，请先解绑' });
            }
        }
        await pool.query('UPDATE classes SET teacher_id = ? WHERE id = ?', [teacherId || null, classId]);
        // 记录日志
        const account = req.session.account;
        const [admin] = await pool.query('SELECT id, real_name FROM users WHERE account = ?', [account]);
        let teacherName = '';
        if (teacherId) {
            const [t] = await pool.query('SELECT real_name FROM users WHERE id = ?', [teacherId]);
            teacherName = t[0]?.real_name || '';
        }
        await addLog(
            admin[0].id, 
            admin[0].real_name, 
            'admin', 
            '教师绑定',
            teacherId ? `将教师 ${teacherName} 绑定到班级 ${classId}` : `解绑班级 ${classId} 的班主任`, classId
        );
        res.json({ success: true, message: '操作成功' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '操作失败' });
    }
});

// 修改班级名称
router.put('/classes/:classId',isAdmin,async(req,res)=>{
    const classId = parseInt(req.params.classId);
    const { className, gradeId } = req.body;
    let updateFields = [];
    let values = [];
    if (className !== undefined) {
        updateFields.push('class_name = ?');
        values.push(className);
    }
    if (gradeId !== undefined) {
        updateFields.push('grade_id = ?');
        values.push(gradeId);
    }
    if (updateFields.length === 0) {
        return res.status(400).json({ success: false, message: '没有要更新的字段' });
    }
    values.push(classId);
    try {
        await pool.query(`UPDATE classes SET ${updateFields.join(', ')} WHERE id = ?`, values);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
});

// 删除班级（会删除班级成员关系）
router.delete('/classes/:classId',isAdmin,async(req,res)=>{
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
router.post('/classes',isAdmin,async(req,res)=>{
    const { className, gradeId } = req.body;
    if (!className || !gradeId) {
        return res.status(400).json({ success: false, message: '班级名称和年级ID不能为空' });
    }
    try {
        const [result] = await pool.query(
            'INSERT INTO classes (class_name, grade_id) VALUES (?, ?)',
            [className, gradeId]
        );
        res.json({ success: true, classId: result.insertId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
});

// 获取科目满分（管理员）
router.post('/fullmark',isAdmin,async(req,res)=>{
    const { subject } = req.body;
    try {
        const [rows] = await pool.query('SELECT full_mark FROM scores WHERE subject = ? LIMIT 1', [subject]);
        if (rows.length === 0) {
            // 默认满分 100
            return res.json({ full_mark: 100 });
        }
        res.json({ full_mark: rows[0].full_mark });
    } catch (err) {
        console.error(err);
        res.status(500).json({ full_mark: 100 });
    }
});

// 添加成绩
router.post('/scores',isAdmin,async(req,res)=>{
    const { className, studentName, studentId, subject, score, examDate } = req.body;
    if (!className || !studentName || !studentId || !subject || score === undefined) {
        return res.status(400).json({ success: false, message: '参数不完整' });
    }
    // 禁止操作总分
    if (subject === '总分') {
        return res.status(400).json({ success: false, message: '总分由系统自动计算，不可手动添加或修改' });
    }
    try {
        // 获取班级ID
        const [classRows] = await pool.query(
            `SELECT c.id 
            FROM classes c 
            JOIN grades g ON c.grade_id = g.id 
            WHERE CONCAT(g.grade_name, c.class_name) = ?`,
            [className]
        );
        if (classRows.length === 0) return res.status(404).json({ success: false, message: '班级不存在' });
        const classId = classRows[0].id;

        // 获取该科目的满分
        const [fullRows] = await pool.query('SELECT full_mark FROM scores WHERE subject = ? LIMIT 1', [subject]);
        const fullMark = fullRows.length ? fullRows[0].full_mark : 100;
        if (score > fullMark) {
            return res.status(400).json({ success: false, message: `成绩不能超过满分 ${fullMark}` });
        }

        // 学生处理... 自动创建学生
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
        const [memberRows] = await pool.query(
            'SELECT 1 FROM class_members WHERE class_id = ? AND student_id = ? AND status = 1',
            [classId, userId]
        );
        if (memberRows.length === 0) {
            return res.status(400).json({ success: false, message: '该学生不在指定班级中，请先通过班级管理添加学生' });
        }

        // 确定考试日期：优先使用传入的 examDate，否则使用当天
        let finalExamDate = examDate ? examDate : new Date().toISOString().slice(0, 10);
        // 简单校验格式 YYYY-MM-DD
        if (!/^\d{4}-\d{2}-\d{2}$/.test(finalExamDate)) {
            finalExamDate = new Date().toISOString().slice(0, 10);
        }

        await pool.query(
            `INSERT INTO scores (student_id, class_id, subject, score, exam_date, full_mark)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, classId, subject, score, examDate, fullMark]
        );
        // 日志
        const account = req.session.account;
        const [admin] = await pool.query('SELECT id, real_name FROM users WHERE account = ?', [account]);
        await addLog(
            admin[0].id, 
            admin[0].real_name, 
            'admin', 
            '成绩添加', 
            `添加成绩：${className} ${studentName} ${subject} ${score}`, 
            classId
        );
        res.json({ success: true, message: '添加成功' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '添加失败' });
    }
});

// 修改成绩
router.put('/scores/:id',isAdmin,async(req,res)=>{
    const scoreId = parseInt(req.params.id);
    const { newScore } = req.body;
    if (newScore === undefined) return res.status(400).json({ success: false, message: '缺少新成绩' });
    try {
        const [oldRows] = await pool.query('SELECT student_id, class_id, subject, score, full_mark FROM scores WHERE id = ?', [scoreId]);
        if (oldRows.length === 0) return res.status(404).json({ success: false, message: '成绩记录不存在' });
        const old = oldRows[0];
        if (old.subject === '总分') {
            return res.status(400).json({ success: false, message: '总分由系统自动计算，不可手动修改' });
        }
        if (newScore > old.full_mark) {
            return res.status(400).json({ success: false, message: `成绩不能超过满分 ${old.full_mark}` });
        }
        await pool.query('UPDATE scores SET score = ? WHERE id = ?', [newScore, scoreId]);
        // 日志
        const account = req.session.account;
        const [admin] = await pool.query('SELECT id, real_name FROM users WHERE account = ?', [account]);
        const [student] = await pool.query('SELECT real_name FROM users WHERE id = ?', [old.student_id]);
        await addLog(
            admin[0].id, 
            admin[0].real_name, 
            'admin', 
            '成绩修改',
            `修改学生 ${student[0].real_name} 的 ${old.subject} 成绩从 ${old.score} 改为 ${newScore}`, 
            old.class_id
        );
        res.json({ success: true, message: '修改成功'});
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '操作失败'});
    }
});

// 删除分数
router.delete('/scores/:id',isAdmin,async(req,res)=>{
    const scoreId = parseInt(req.params.id);
    try {
        const [rows] = await pool.query('SELECT student_id, class_id, subject FROM scores WHERE id = ?', [scoreId]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: '成绩记录不存在' });
        const { student_id, class_id, subject } = rows[0];
        if (subject === '总分') {
            return res.status(400).json({ success: false, message: '总分不可删除' });
        }
        await pool.query('DELETE FROM scores WHERE id = ?', [scoreId]);
        // 日志
        const account = req.session.account;
        const [admin] = await pool.query('SELECT id, real_name FROM users WHERE account = ?', [account]);
        const [student] = await pool.query('SELECT real_name FROM users WHERE id = ?', [student_id]);
        await addLog(
            admin[0].id, 
            admin[0].real_name, 
            'admin', 
            '成绩删除',
            `删除学生 ${student[0].real_name} 的 ${subject} 成绩`, 
            class_id
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
});

module.exports = router;