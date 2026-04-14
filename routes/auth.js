const express = require('express');
// const bcrypt = require('bcrypt');
const router = express.Router();
const pool = require('../utils/pool');
const judge = /\w{8,}[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]*/;


router.post('/',async(req,res)=>{
    const { account,password,identity } = req.body;
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
            res.status(400).json({ success: false, message: '用户不存在！' });
            return;
        }
        if (identity != rows[0].identity) {
            res.json({ success: false, message: '当前账号与登录身份不匹配，请重新登录。'});
            return;
        };
        // 哈希验证
        // if (bcrypt.compare(password, rows[0].password))
        // {
        //     req.session.identity = rows[0].identity;
        //     req.session.account = account;
        //     if (req.session.identity === 'student') res.redirect('/student');
        //     else if (req.session.identity === 'teacher') res.redirect('/teacher');
        //     else if (req.session.identity === 'admin') res.redirect('/admin');
        // }
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
            return;
        }
    }
    catch (err)
    {
        console.error(err);
    }
});

router.get('/logout',async(req,res)=>{
    req.session.destroy((err)=>{
        if (err) res.status(500).send('注销失败！');
    });
    res.clearCookie('connect.sid');
    res.redirect('/');
});

module.exports = router;