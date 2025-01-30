const mysql = require('mysql2');

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'rootACC@123',
    database: 'new_inventory'
});

db.connect((err) => {
    if (err) throw err;
    console.log('Connected to database!');
});

module.exports = db;
