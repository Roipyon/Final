const express = require('express');
// const bcrypt = require('bcrypt');
const path = require('path');
const mysql = require('mysql2/promise');
const session = require('express-session');
const { nextTick } = require('process');
const app = express();
const PORT = 5000;
const HOST = '0.0.0.0';
const judge = /\w{8,}[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]*/;
require('dotenv').config();

const poolConfig = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_POOL_LIMIT) || 10,
    queueLimit: 0, 
};
const pool = mysql.createPool(poolConfig);

// 用户检验中间件
function isStudent(req,res,next)
{
    if (req.session.identity === 'student') return next();
    res.redirect('/');
}
function isTeacher(req,res,next)
{
    if (req.session.identity === 'teacher') return next();
    res.redirect('/');
}
function isAdmin(req,res,next)
{
    if (req.session.identity === 'admin') return next();
    res.redirect('/');
}

// 新增日志函数
async function addLog(user_id, user_name, identity, operation_type, operation_content, target_class_id)
{
    const sql = `
        insert into operation_logs (user_id, user_name, identity, operation_type, operation_content, target_class_id)
        values (?,?,?,?,?,?)
    `;
    const info = [user_id, user_name, identity, operation_type, operation_content, target_class_id];
    await pool.query(sql,info);
}

app.use(express.json());
app.use(session({
    secret: 'thisisaflowofpassword',
    resave: false,
    saveUninitialized: false,
    cookie: {secure: false}
}))

app.use('/student', isStudent, express.static('student'));
app.use('/teacher', isTeacher, express.static('teacher'));
app.use('/admin', isAdmin, express.static('admin'));
app.use('/', express.static('login'));

app.post('/',async(req,res)=>{
    const { account,password } = req.body;
    if (account.length === 0)
    {
        res.status(400).json({success: false,message: '账号不能为空！'});
        return;
    }
    if (password.length < 8)
    {
        res.status(400).json({success: false,message: '密码位数应不小于8！'});
        return;
    }
    if (!judge.test(password))
    {
        res.status(400).json({success: false,message: '密码包含非法字符！'});
        return;
    }
    try {
        const [rows] = await pool.query('select account,password,identity from users where account=?',[account]);
        if (!rows || rows.length === 0) {
            res.status(400).json({success: false, message: '用户不存在！'});
            return;
        }
        if (password === rows[0].password)
        {
            req.session.identity = rows[0].identity;
            req.session.account = account;
            if (req.session.identity === 'student') res.redirect('/student');
            else if (req.session.identity === 'teacher') res.redirect('/teacher');
            else if (req.session.identity === 'admin') res.redirect('/admin');
        }
        else 
        {
            res.status(400).json({success: false,message:'密码不正确！'});
        }
    }
    catch (err)
    {
        console.error(err);
    }
});

app.get('/student',isStudent,(req,res)=>{
    res.sendFile(path.join(__dirname, 'student', 'stu.html'));
});
app.get('/teacher',isTeacher,(req,res)=>{
    res.sendFile(path.join(__dirname, 'teacher', 'tea.html'));
});
app.get('/admin',isAdmin,(req,res)=>{
    res.sendFile(path.join(__dirname, 'admin', 'adm.html'));
});

// 获取当前学生用户信息
app.get('/student/info',isStudent,async(req,res)=>{
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
app.get('/student/grade',isStudent,async(req,res)=>{
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

// 获取总排名
app.get('/student/totalrank',isStudent,async(req,res)=>{
    const account = req.session.account;
    const [rows] = await pool.query('select id from users where account = ?',[account]);
    const userId = rows[0].id;
    const [totalRank] = await pool.query(`
        with student_lastest as (
            select 
                cm.class_id,
                max(s.exam_date) as lastest_exam
            from class_members cm
            join scores s on s.student_id = cm.student_id
            where cm.student_id = ? and cm.status = 1
            group by cm.class_id
        ),
        class_scores as (
            select 
                s.student_id,
                sum(s.score) as total_score
            from scores s
            join student_lastest sl on sl.class_id = s.class_id and s.exam_date = sl.lastest_exam
            group by s.student_id
        ),
        class_total_avg as (
            select avg(total_score) as class_total_avg_score
            from class_scores
        ),
        ranked as (
            select 
                student_id,
                total_score,
                rank() over (order by total_score desc) as class_rank
            from class_scores
        )
        select 
            r.total_score as total,
            cta.class_total_avg_score as totalAvg,
            r.class_rank as totalRank
        from ranked r
        cross join class_total_avg cta
        where r.student_id = ?
        `,[userId,userId]);
    res.json(totalRank[0]);
});

// 班级统计数据
app.get('/student/classstat',isStudent,async(req,res)=>{
    const account = req.session.account;
    const [rows] = await pool.query('select id from users where account = ?',[account]);
    const userId = rows[0].id;
    const [classStat] = await pool.query(`
        with student_lastest as (
            select cm.class_id,
            max(s.exam_date) as lastest_exam
            from class_members cm
            join scores s on s.class_id = cm.class_id
            where cm.student_id = ? and cm.status = 1
            group by cm.class_id
        ),
        subject_info as (
            select
                s.subject,
                avg(s.score) as subject_avg,
                max(s.score) as subject_max,
                min(s.score) as subject_min,
                count(*) as total_count,
                count(case when s.score >= s.full_mark*0.6 then 1 end) as pass_count
            from scores s 
            join student_lastest sl on s.class_id = sl.class_id and s.exam_date = sl.lastest_exam
            group by s.subject
            )
            select 
                subject,
                round(subject_avg,1) as avg,
                subject_max as max,
                subject_min as min,
                pass_count as passCount,
                total_count as totalStu,
                concat(round(pass_count*100 / total_count, 2),'%') as passRate
            from subject_info
        `,[userId])
    res.json(classStat);
});

// 获取通知
app.get('/student/notices',isStudent,async(req,res)=>{
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
app.post('/student/notices',isStudent,async(req,res)=>{
    const response = req.body;
    const notice_id = response.notice_id;
    const is_read = response.is_read;
    if (is_read != 1) res.status(400).json({success: false,message: '状态码无效'});
    const account = req.session.account;
    const [rows] = await pool.query('select id from users where account = ?',[account]);
    const userId = rows[0].id;
    const [update] = await pool.query('insert into notice_read_status (notice_id,student_id,is_read,read_time) values (?,?,?,now())',[notice_id,userId,is_read]);
    if (update[0].affectedRows === 1) res.json({success: true,message: '确认已读'});
    else res.status(500).json({success: false,message: '已读失败'});
});

// 教师端

// 获取当前用户信息
app.get('/teacher/info',isTeacher,async(req,res)=>{
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

// 获取所有学生单科成绩
app.get('/teacher/scores',isTeacher,async(req,res)=>{
    const account = req.session.account;
    const [rows] = await pool.query('select id from users where account = ?',[account]);
    const userId = rows[0].id;
    // 获取班主任所带班级 ID
    const [classRows] = await pool.query('SELECT id FROM classes WHERE teacher_id = ?', [userId]);
    if (classRows.length === 0) return res.json([]);
    const classId = classRows[0].id;
    // 获取本班最新考试日期（所有学生最新日期的最大值，保证同一考试批次）
    const [dateRows] = await pool.query(`
        SELECT MAX(exam_date) AS latest_date FROM scores WHERE class_id = ?
    `, [classId]);
    const latestDate = dateRows[0].latest_date;
    if (!latestDate) return res.json([]);
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
    `, [classId, latestDate]);
    res.json(scores);
});

// 获取班级分数概况
app.get('/teacher/general',isTeacher,async(req,res)=>{
    const account = req.session.account;
    const [rows] = await pool.query('select id from users where account = ?',[account]);
    const userId = rows[0].id;
    const [scores] = await pool.query(`
        with get_class_id as (
            select 
                id
            from classes where teacher_id = ?
        ),
        score_total as (
            select
                u.real_name as name,
                sum(s.score) as total
            from scores s, get_class_id gci,users u
            where gci.id = s.class_id and s.student_id = u.id
            group by s.student_id
        ),
        score_avg as (
            select
                round(avg(total),1) as avg
            from score_total
        ),
        max_min as (
            select 
                max(st.total) as max,
                min(st.total) as min
            from score_total st
        )
        select 
            mm.max,
            mm.min,
            sa.avg
        from score_avg sa, max_min mm
    `,[userId]);
    res.json(scores[0]);
});

// 获取所有学生总分
app.get('/teacher/totalscores',isTeacher,async(req,res)=>{
    const account = req.session.account;
    const [rows] = await pool.query('select id from users where account = ?',[account]);
    const userId = rows[0].id;
    const [classRows] = await pool.query('SELECT id FROM classes WHERE teacher_id = ?', [userId]);
    if (classRows.length === 0) return res.json([]);
    const classId = classRows[0].id;
    // 获取本班最新考试日期
    const [dateRows] = await pool.query(`
        SELECT MAX(exam_date) AS latest_date FROM scores WHERE class_id = ?
    `, [classId]);
    const latestDate = dateRows[0].latest_date;
    if (!latestDate) return res.json([]);
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
    `,[classId, latestDate]);
    res.json(scores);
});


// 获取单科成绩概况
app.get('/teacher/subjectgeneral',isTeacher,async(req,res)=>{
    const account = req.session.account;
    const [rows] = await pool.query('select id from users where account = ?',[account]);
    const userId = rows[0].id;
    const [scores] = await pool.query(`
        with get_class_id as (
            select 
                id
            from classes where teacher_id = ?
        ),
        score_avg as (
            select
                s.subject,
                round(avg(s.score),1) as avg,
                max(s.score) as max,
                min(s.score) as min,
                count(*) as total_count,
                count(case when s.score >= s.full_mark*0.6 then 1 end) as pass_count
            from scores s,get_class_id gci
            where s.class_id = gci.id
            group by s.subject
        )
        select 
            subject,
            max,
            min,
            avg,
            pass_count as passCount,
            total_count as totalStu,
            concat(round(pass_count*100 / total_count, 2),'%') as passRate
        from score_avg
    `,[userId]);
    res.json(scores);
});

// 获取单科满分
app.post('/teacher/fullmark',isTeacher,async(req,res)=>{
    const subject = req.body.subject;
    const [rows] = await pool.query('select full_mark from scores where subject = ? limit 1',[subject]);
    res.json(rows[0]);
});

// 更新成绩
app.post('/teacher/scores',isTeacher,async(req,res)=>{
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
app.get('/teacher/notices',isTeacher,async(req,res)=>{
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
app.post('/teacher/notices',isTeacher,async(req,res)=>{
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
app.put('/teacher/notices/:id',isTeacher,async(req,res)=>{
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
app.delete('/teacher/notices/:id',isTeacher,async(req,res)=>{
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
app.get('/teacher/logs',isTeacher,async(req,res)=>{
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
app.get('/teacher/notices/:id/read-status',isTeacher,async(req,res)=>{
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

app.get('/logout',async(req,res)=>{
    req.session.destroy((err)=>{
        if (err) res.status(500).send('注销失败！');
    });
    res.clearCookie('connect.sid');
    res.redirect('/');
});

app.listen(PORT,HOST,()=>{
    console.log('system launched on http://127.0.0.1:5000');
})