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

app.get('/student/info',isStudent,async(req,res)=>{
    const account = req.session.account;
    console.log(account)
    const [rows] = await pool.query('select id,account,identity,real_name from users where account = ?',[account]);
    const userId = rows[0].id;
    console.log(userId)
    const realName = rows[0].real_name;
    console.log(realName)
    const [_rows] = await pool.query('select class_id from class_members where student_id = ?',[userId]);
    const classId = _rows[0].class_id;
    console.log(classId)
    const [__rows] = await pool.query('select class_name from classes where id = ?',[classId]);
    const className = __rows[0].class_name;
    console.log(className)
    res.json({
        id: userId,
        name: realName,
        'className': className,
        classId: classId,
    });
});

app.post('/student',isStudent,(req,res)=>{
    
});

app.get('/logout',async(req,res)=>{
    req.session.destroy((err)=>{
        if (err) res.status.send('注销失败！');
    });
    res.clearCookie('connect.sid');
    res.redirect('/');
});

app.listen(PORT,()=>{
    console.log('ok');
})