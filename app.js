const express = require('express');
// const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
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
    if (1)
    {
        return next();
    }
    res.redirect('/');
}
function isTeacher(req,res,next)
{
    if (1)
    {
        return next();
    }
    res.redirect('/');
}
function isAdmin(req,res,next)
{
    if (1)
    {
        return next();
    }
    res.redirect('/');
}

app.use('/',express.static('login'));
app.use(express.json());

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
    const rows = await pool.query('select account,password from users where identity=? and account=?',[identity,account]);
    
});

app.listen(PORT,()=>{
    console.log('ok');
})