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

app.use(express.json());
app.use(session({
    secret: 'thisisaflowofpassword',
    resave: false,
    saveUninitialized: false,
    cookie: {secure: false}
}))

app.use('/student', isStudent, express.static('student'));
app.use('/teacher', isTeacher, express.static('teacher'));
app.use('/', express.static('login'));

app.post('/',async(req,res)=>{
    const { account,password } = req.body;
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
        const [rows] = await pool.query('select account,password,identity from users where account=?',[account]);
        if (!rows || rows.length === 0) {
            res.json({success: false, message: '用户不存在！'});
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
app.get('/teacher',isTeacher,(req,res)=>{
    res.sendFile(path.join(__dirname, 'teacher', 'tea.html'));
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
    if (is_read != 1) res.json({success: false,message: '状态码无效'});
    const account = req.session.account;
    const [rows] = await pool.query('select id from users where account = ?',[account]);
    const userId = rows[0].id;
    const [update] = await pool.query('insert into notice_read_status (notice_id,student_id,is_read,read_time) values (?,?,?,now())',[notice_id,userId,is_read]);
    if (update[0].affectedRows === 1) res.json({success: true,message: '确认已读'});
    else res.json({success: false,message: '已读失败'});
});

// 教师端

// 获取当前用户信息
app.get('/teacher/info',isTeacher,async(req,res)=>{
    const account = req.session.account;
    const [rows] = await pool.query('select id,real_name from users where account = ?',[account]);
    const userId = rows[0].id;
    const realName = rows[0].real_name;
    const [class_info] = await pool.query('select id,class_name from classes where teacher_id = ?',[userId]);
    res.json({
        name: realName,
        className: class_info[0].class_name,
    });
});

// 获取所有学生单科成绩
app.get('/teacher/scores',isTeacher,async(req,res)=>{
    const account = req.session.account;
    const [rows] = await pool.query('select id,real_name from users where account = ?',[account]);
    const userId = rows[0].id;
    const [scores] = await pool.query(`
        with get_class_id as (
            select 
                id
            from classes where teacher_id = ?
        ),
        stu_scores as (
            select
            s.student_id as id,
            u.real_name as studentName,
            s.subject,
            s.score 
        from scores s, get_class_id gci, users u
        where u.id = s.student_id and gci.id = s.class_id
        )
        select 
            id,
            studentName,
            subject,
            score,
            rank() over (partition by subject order by score desc) as class_subject_rank
        from stu_scores ss
        `,[userId]);
        res.json(scores);
});

// 获取班级分数概况
app.get('/teacher/general',isTeacher,async(req,res)=>{
    const account = req.session.account;
    const [rows] = await pool.query('select id,real_name from users where account = ?',[account]);
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
    const [rows] = await pool.query('select id,real_name from users where account = ?',[account]);
    const userId = rows[0].id;
    const [scores] = await pool.query(`
        with get_class_id as (
            select 
                id
            from classes where teacher_id = ?
        ),
        stu_scores as (
            select
            s.student_id as id,
            u.real_name as studentName,
            sum(s.score) as total_score 
        from scores s, get_class_id gci, users u
        where u.id = s.student_id and gci.id = s.class_id
        group by s.student_id
        )
        select 
            id,
            studentName,
            total_score,
            rank() over (order by total_score desc) as class_rank
        from stu_scores
    `,[userId]);
    res.json(scores);
});


// 获取单科成绩概况
app.get('/teacher/subjectgeneral',isTeacher,async(req,res)=>{
    const account = req.session.account;
    const [rows] = await pool.query('select id,real_name from users where account = ?',[account]);
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