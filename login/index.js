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

async function postInfo(ele1,ele2,identity)
{
    const account = ele1.value.trim();
    const password = ele2.value.trim();
    const response = await fetch('/',{
        method: 'post',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            account: account,
            password: password,
            identity: identity
        })
    });
    console.dir(response)
    if (response.redirected) 
    {
        window.location.href = response.url;
        return;
    }
    const resJson = await response.json();
    if (!resJson.success) 
    {
        alert(resJson.message)
        return;
    }
}

loginBtn.addEventListener('click',()=>{
    if (chosen.id === 'stu')
    {
        const stuAccount = document.querySelector('#stuAccount');
        const stuPassWord = document.querySelector('#stuPassWord');
        postInfo(stuAccount,stuPassWord,'student');
    }
    else if (chosen.id === 'tea')
    {
        const teaAccount = document.querySelector('#teaAccount');
        const teaPassWord = document.querySelector('#teaPassWord');
        postInfo(teaAccount,teaPassWord,'teacher');
    }
    else if (chosen.id === 'adm')
    {
        const admAccount = document.querySelector('#admAccount');
        const admPassWord = document.querySelector('#admPassWord');
        postInfo(admAccount,admPassWord,'admin');
    }
});
