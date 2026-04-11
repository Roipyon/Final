const pool = require('./pool');

// 新增日志函数
async function addLog(user_id, user_name, identity, operation_type, operation_content, target_class_id)
{
    const sql = `
        insert into operation_logs (user_id, user_name, identity, operation_type, operation_content, target_class_id)
        values (?,?,?,?,?,?)
    `;
    const info = [user_id, user_name, identity, operation_type, operation_content, target_class_id];
    await pool.query(sql,info);
}

module.exports = addLog;