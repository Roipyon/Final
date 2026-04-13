const express = require('express');
// const bcrypt = require('bcrypt');
const session = require('express-session');
const path = require('path');
const app = express();
const PORT = 5000;
const HOST = '0.0.0.0';
const { isStudent, isTeacher, isAdmin } = require('./middleware/auth');
const student = require('./routes/student');
const teacher = require('./routes/teacher');
const admin = require('./routes/admin');
const login = require('./routes/auth');
require('dotenv').config();

app.use(express.json());
app.use(session({
    secret: 'thisisaflowofpassword',
    resave: false,
    saveUninitialized: false,
    cookie: {secure: false}
}))

app.use(express.static(path.join(__dirname, 'public')));

app.use('/', login);
app.use('/student', isStudent, student);
app.use('/teacher', isTeacher, teacher);
app.use('/admin',isAdmin, admin);

app.get('/admin',(req,res)=>{
    res.sendFile(path.join(__dirname, '/public', 'adm.html'));
});
app.get('/teacher',(req,res)=>{
    res.sendFile(path.join(__dirname, '/public', 'tea.html'));
});
app.get('/student',(req,res)=>{
    res.sendFile(path.join(__dirname, '/public', 'stu.html'));
});

app.listen(PORT,HOST,()=>{
    console.log('system launched on http://127.0.0.1:5000');
})