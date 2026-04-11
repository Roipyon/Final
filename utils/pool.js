const mysql = require('mysql2/promise');
const poolConfig = require('../config/pool.config');

const pool = mysql.createPool(poolConfig);

module.exports = pool;