const express = require('express');
const bcrypt = require('bcrypt');
const session = require('express-session');
const bodyParser = require('body-parser');

const app = express();
const db = require('./db');


const path = require('path');
const authRoutes = require('./routes/authorization'); // Import the auth routes
const dashboardRoutes=require('./routes/dashboard');


const port = 8080;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.set('view engine', 'ejs');
app.use(session({
    secret: 'your_secret_key', 
    resave: false,
    saveUninitialized: true
}));


app.use(express.static(path.join(__dirname, 'public')));

app.use('/', authRoutes); // Routes in auth.js will be accessed via "/login" or "/register"
app.use('/dashboard', dashboardRoutes);
