const express = require('express');
const bcrypt = require('bcrypt');
const session = require('express-session');
const bodyParser = require('body-parser');

const app = express();
const db = require('./db');


const path = require('path');
const authRoutes = require('./routes/authorization'); // Import the auth routes
const dashboardRoutes=require('./routes/dashboard');
const categoriesRoutes=require('./routes/categories');
const productsRoutes=require('./routes/products');
const salesRoutes=require('./routes/sales');


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

app.use('/', authRoutes); 
app.use('/dashboard', dashboardRoutes);
app.use('/categories',categoriesRoutes);
app.use('/products',productsRoutes);
app.use('/sales',salesRoutes)

app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});


app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});