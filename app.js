const express = require('express');
const session = require('express-session');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const app = express();
const PORT = 5000;
const HOST = '0.0.0.0';
const { isStudent, isTeacher, isAdmin } = require('./middleware/auth');
const student = require('./routes/student');
const teacher = require('./routes/teacher');
const admin = require('./routes/admin');
const login = require('./routes/auth');

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

// app.listen(PORT,HOST,()=>{
//     console.log('system launched on http://127.0.0.1:5000');
// })

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 存储用户 - ws服务键值对
const clients = new Map();

wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const userId = url.searchParams.get('userId');
    if (!userId) {
        ws.close();
        return;
    }
    clients.set(Number(userId), ws);
    console.log(`WebSocket 连接: userId=${userId}`);

    ws.on('close', () => {
        clients.delete(Number(userId));
        console.log(`WebSocket 断开: userId=${userId}`);
    });

    ws.on('error', (err) => {
        console.error('WebSocket 错误:', err);
    });
});

const sendToUser = (userId, data) => {
    const ws = clients.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
};

// 挂载到全体 app 方法
app.locals.sendToUser = sendToUser;

server.listen(PORT, HOST, () => {
    console.log(`系统已启动: http://127.0.0.1:${PORT}`);
});