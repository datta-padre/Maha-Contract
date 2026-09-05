const mysql = require('mysql2')
const util = require('util');

// const connection = mysql.createConnection({
//     host: 'localhost',
//     user: 'root',   
//     password: 'root',
//     database: 'buld'
// });

const connection = mysql.createConnection({
    host: 'bwzi6kjhi8hpm41cev1n-mysql.services.clever-cloud.com',
    user: 'u3kp9onuf5jsz3un',   
    password: 'nGN7RHz6VLyB60gAttqr',
    database: 'bwzi6kjhi8hpm41cev1n'
});


 const exe = util.promisify(connection.query).bind(connection);

module.exports = exe ;