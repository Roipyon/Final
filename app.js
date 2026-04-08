const express = require('express');
// const bcrypt = require('bcrypt');
const path = require('path');
const mysql = require('mysql2/promise');
const session = require('express-session');
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

function isStudent(req,res,next)
{
    if (req.session.identity === 'student')
    {
        return next();
    }
    res.redirect('/');
}
function isTeacher(req,res,next)
{
    if (req.session.identity === 'teacher')
    {
        return next();
    }
    res.redirect('/');
}
function isAdmin(req,res,next)
{
    if (req.session.identity === 'admin')
    {
        return next();
    }
    res.redirect('/');
}

app.use(express.json());
app.use(session({
    secret: 'thisisaflowofpassword',
    resave: false,
    saveUninitialized: false,
    cookie: {secure: false}
}))

app.use('/student', isStudent, express.static('student'));
app.use('/', express.static('login'));

app.post('/',async(req,res)=>{
    const { account,password,identity } = req.body;
    if (account.length === 0)
    {
        res.json({success: false,message: '账号不能为空！'});
        return;
    }
    if (password.length < 8)
    {
        res.json({success: false,message: '密码位数应不小于8！'});
        return;
    }
    if (!judge.test(password))
    {
        res.json({success: false,message: '密码包含非法字符！'});
        return;
    }
    try {
        const [rows] = await pool.query('select account,password from users where identity=? and account=?',[identity,account]);
        if (!rows || rows.length === 0) {
            res.json({success: false, message: '用户不存在！'});
            return;
        }
        if (password === rows[0].password)
        {
            req.session.identity = identity;
            req.session.account = account;
            if (identity === 'student') res.redirect('/student');
            else if (identity === 'teacher') res.redirect('/teacher');
            else if (identity === 'admin') res.redirect('/admin');
        }
        else 
        {
            res.json({success: false,message:'密码不正确！'});
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

// 获取当前学生用户信息
app.get('/student/info',isStudent,async(req,res)=>{
    const account = req.session.account;
    const [rows] = await pool.query('select id,account,identity,real_name from users where account = ?',[account]);
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
    const [rows] = await pool.query('select id,account,identity,real_name from users where account = ?',[account]);
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
    const [rows] = await pool.query('select id,account,identity,real_name from users where account = ?',[account]);
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
                sum(s.score) as total_score,
                avg(s.score) as avg_score
            from scores s
            join student_lastest sl on sl.class_id = s.class_id and s.exam_date = sl.lastest_exam
            group by s.student_id
        ),
        ranked as (
            select 
                student_id,
                total_score,
                avg_score,
                rank() over (order by total_score desc) as class_rank
            from class_scores
        )
        select 
            total_score as total,
            avg_score as totalAvg,
            class_rank as totalRank
        from ranked
        where student_id = ?
        `,[userId,userId]);
    res.json(totalRank[0]);
});

// 班级统计数据
app.get('/student/classstat',isStudent,async(req,res)=>{
    const account = req.session.account;
    const [rows] = await pool.query('select id,account,identity,real_name from users where account = ?',[account]);
    const userId = rows[0].id;
    const [classStat] = await pool.query(`
        with student_lastest as (
            select cm.class_id,
            max(s.exam_date) as lastest_exam
            from class_members cm
            join scores s on s.class.id = cm.class_id and s.exam_date = sl.lastest_exam
            where cm.student_id = ? and cm.status = 1
            group by cm.class_id
        ),
        subject_info as (
            select
                s.subject,
                avg(s.score) over (partition by s.subject) as subject_avg,
                max(s.score) over (partition by s.subject) as subject_max,
                min(s.score) over (partition by s.subject) as subject_min,
            from scores s 
            join student_lastest sl on s.class_id = sl.class_id and s.exam_date = sl.lastest_exam
            group by s.subject
        )
            select 
        `)
    res.json();
});

app.get('/logout',async(req,res)=>{
    req.session.destroy((err)=>{
        if (err) res.status.send('注销失败！');
    });
    res.clearCookie('connect.sid');
    res.redirect('/');
});

app.listen(PORT,()=>{
    console.log('system launched on http://127.0.0.1:5000');
})