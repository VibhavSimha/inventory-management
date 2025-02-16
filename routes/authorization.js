const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');
const router = express.Router();

router.get('/', (req, res) => {
    res.render('login', { error: null });
});

router.post('/login', (req, res) => {
    const { username, password } = req.body;

    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();
    db.query('SELECT * FROM users WHERE username = ?', [trimmedUsername], (err, result) => {
        if (err) {
            console.log('Error logging in:', err);
            return res.render('login', { error: 'Error logging in. Please try again.' });
        }

        if (result.length === 0) {
            return res.render('login', { error: 'Invalid credentials' });
        }

        const user = result[0];

        bcrypt.compare(trimmedPassword, user.password, (err, isMatch) => {
            if (err) {
                console.log('Error comparing password:', err);
                return res.render('login', { error: 'Error logging in. Please try again.' });
            }

            if (isMatch) {
                req.session.user = {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    gender: user.gender
                };
      
                res.redirect('/dashboard');
            } else {
                res.render('login', { error: 'Invalid credentials' });
            }
        });
    });
});





router.get('/register', (req, res) => {
    res.render('register', { error: null });
});


router.post('/register', (req, res) => {
    const { username, password, gender, email } = req.body;

    db.query('SELECT * FROM users WHERE username = ? OR email = ?', [username, email], (err, result) => {
        if (err) {
            console.log('Error checking username or email:', err);
            return res.render('register', { error: 'Error checking username or email' });
        }

        if (result.length > 0) {
            return res.render('register', { error: 'Username or Email already taken' });
        }

        bcrypt.hash(password, 10, (err, hashedPassword) => {
            if (err) {
                console.log('Error hashing password:', err);
                return res.render('register', { error: 'Error registering user' });
            }

            db.query('INSERT INTO users (username, password, gender, email) VALUES (?, ?, ?, ?)', 
                [username, hashedPassword, gender, email], (err, result) => {
                if (err) {
                    console.log('Error inserting user:', err);
                    return res.render('register', { error: 'Error registering user' });
                }
                console.log('User registered successfully!');
                return res.redirect('/');  
            });
        });
    });
});

router.get('/logout', (req, res) => {

    req.session.destroy((err) => {
        if (err) {
            console.log('Error destroying session:', err);
            return res.redirect('/dashboard'); 
        }

        res.redirect('/');
    });
});

module.exports = router;