const express = require('express');
// const bcrypt = require('bcrypt');
const session = require('express-session');
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

app.use('/student', express.static('student'));
app.use('/teacher', express.static('teacher'));
app.use('/admin', express.static('admin'));
app.use('/', express.static('login'));

app.use('/', login);
app.use('/student', student);
app.use('/teacher', teacher);
app.use('/admin', admin);


app.listen(PORT,HOST,()=>{
    console.log('system launched on http://127.0.0.1:5000');
})