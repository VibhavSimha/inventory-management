const express = require('express');
const db = require('../db');
const router = express.Router();


console.log("welcome");

router.get('/', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login'); 
    }

    db.query('SELECT * FROM categories WHERE user_id = ?', [req.session.user.id], (err, result) => {
        if (err) {
            console.log('Error fetching categories:', err);
            return res.status(500).send('Error fetching categories');
        }

        res.render('categories', { categories: result,user: req.session.user });
    });
});



router.post('/add-category', (req, res) => {
    const { name } = req.body;

    if (!req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    db.query('SELECT * FROM categories WHERE name = ? AND user_id = ?', [name, req.session.user.id], (err, existingCategory) => {
        if (err) {
            console.log('Error checking category:', err);
            return res.status(500).json({ error: 'Error checking category' });
        }

        if (existingCategory.length > 0) {
            return res.status(400).json({ error: 'Category already exists.' });
        }

        db.query('INSERT INTO categories (name, user_id) VALUES (?, ?)', [name, req.session.user.id], (err) => {
            if (err) {
                console.log('Error adding category:', err);
                return res.status(500).json({ error: 'Error adding category' });
            }

            res.status(201).json({ message: 'Category added successfully!' });
        });
    });
});


router.delete('/delete-category/:id', (req, res) => {
    const categoryId = req.params.id;

    if (!req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    db.query('DELETE FROM categories WHERE id = ? AND user_id = ?', [categoryId, req.session.user.id], (err) => {
        if (err) {
            console.log('Error deleting category:', err);
            return res.status(500).json({ error: 'Error deleting category' });
        }

        res.status(200).json({ message: 'Category deleted successfully!' });
    });
});

module.exports=router;