const mysql = require('mysql2')
const util = require('util');

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',   
    password: 'root',
    database: 'buld'
});


 const exe = util.promisify(connection.query).bind(connection);

module.exports = exe ;