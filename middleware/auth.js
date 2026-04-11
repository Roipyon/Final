// 用户检验中间件
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

module.exports = { isStudent, isTeacher, isAdmin };