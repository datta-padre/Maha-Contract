const mysql = require('mysql2')
const util = require('util');

// const connection = mysql.createConnection({
//     host: 'localhost',
//     user: 'root',   
//     password: 'root',
//     database: 'buld'
// });

const connection = mysql.createConnection({
    host: 'b697uso1rbxp394d9cwt-mysql.services.clever-cloud.com',
    user: 'uge2ng8cqbgihba8',   
    password: 'shuhauaOwMvEBzgyy4mHroot',
    database: 'b697uso1rbxp394d9cwt'
});

 const exe = util.promisify(connection.query).bind(connection);

module.exports = exe ;