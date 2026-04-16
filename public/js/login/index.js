import { Modal } from "../common/components/Modal.js";

const chooseBtn = document.querySelectorAll('.chooseBtn');
const idShow = document.querySelector('#idShow');
const loginBtn = document.querySelector('#loginBtn');
const judge = /\w{8,}[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]*/;

let chosen = chooseBtn[0];
chooseBtn.forEach((e)=>{
    e.addEventListener('click',()=>{
        if (chosen != null)
        {
            chosen.classList.remove('active');
        }
        e.classList.add('active');
        chosen = e;
        if (e.id === 'stu')
        {
            idShow.innerHTML = `
                <div id="stuShow">
                    <p>学号</p>
                    <input type="text" class="input" id="stuAccount">
                    <p>密码</p>
                    <input type="password" class="input" id="stuPassWord">
                </div>
            `;
        }
        else if (e.id === 'tea')
        {
            idShow.innerHTML = `
                <div id="teaShow">
                    <p>教职工号</p>
                    <input type="text" class="input" id="teaAccount">
                    <p>密码</p>
                    <input type="password" class="input" id="teaPassWord">
                </div>
            `;
        }
        else if (e.id === 'adm')
        {
            idShow.innerHTML = `
                <div id="admShow">
                    <p>管理员账号</p>
                    <input type="text" class="input" id="admAccount">
                    <p>密码</p>
                    <input type="password" class="input" id="admPassWord">
                </div> 
            `;
        }
    });
});

// 提升体验
document.addEventListener('keydown',(e)=>{
    if (e.key === 'Enter') {
        loginBtn.click();
    }
});

async function postInfo(ele1,ele2,identity)
{
    const account = ele1.value.trim();
    const password = ele2.value.trim();

    // 前端校验
    if (!account) {
        Modal.alert('账号不能为空');
        return;
    }
    if (!password) {
        Modal.alert('密码不能为空');
        return;
    }
    if (password.length < 8) {
        Modal.alert('密码长度至少8位');
        return;
    }
    if (!judge.test(password)) {
        Modal.alert('密码必须包含数字');
        return;
    }
    try {
        const response = await fetch('/',{
            method: 'post',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                account: account,
                password: password,
                identity: identity
            })
        });
        if (response.redirected) 
        {
            window.location.href = response.url;
            return;
        }
        const resJson = await response.json();
        if (!resJson.success) 
        {
            Modal.alert(resJson.message || '登录失败，请检查账号和密码')
            return;
        }
    } catch (err) {
        console.error('登录请求失败：',err);
        Modal.alert('网络错误，无法连接到服务器，请稍后再试')
    }
}

loginBtn.addEventListener('click',(e)=>{
    const btn = e.currentTarget;
    if (chosen.id === 'stu')
    {
        const stuAccount = document.querySelector('#stuAccount');
        const stuPassWord = document.querySelector('#stuPassWord');
        withLock(btn, () => postInfo(stuAccount,stuPassWord,'student'), {
            loadingText: '登录中...'
        });
        
    }
    else if (chosen.id === 'tea')
    {
        const teaAccount = document.querySelector('#teaAccount');
        const teaPassWord = document.querySelector('#teaPassWord');
        withLock(btn, () => postInfo(teaAccount,teaPassWord,'teacher'), {
            loadingText: '登录中...'
        });
    }
    else if (chosen.id === 'adm')
    {
        const admAccount = document.querySelector('#admAccount');
        const admPassWord = document.querySelector('#admPassWord');
        withLock(btn, () => postInfo(admAccount,admPassWord,'admin'), {
            loadingText: '登录中...'
        });
    }
});
