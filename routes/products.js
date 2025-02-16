const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');
const router = express.Router();






router.get('/', (req, res) => {
    const user = req.session.user;
    const error = req.session.error;
    req.session.error = null;

    if (!user) {
        return res.redirect('/login');
    }


    db.query('SELECT id, name FROM categories WHERE user_id = ?', [user.id], (err, categories) => {
        if (err) {
            console.log('Error fetching categories:', err);
            return res.render('products', { error: 'Error fetching categories', user });
        }


        console.log('Categories:', categories); 

        db.query(
            `SELECT p.id, p.name, p.quantity, p.cost_price, p.selling_price, c.id AS category_id, c.name AS category_name
             FROM products p
             INNER JOIN categories c ON p.category_id = c.id
             WHERE p.user_id = ?`,
            [user.id],
            (err, products) => {
                if (err) {
                    console.log('Error fetching products:', err);
                    return res.render('products', { error: 'Error fetching products', user, categories });
                }

                const productsByCategory = categories.map(category => ({
                    id: category.id,
                    name: category.name,
                    products: products.filter(product => product.category_id === category.id)
                }));
                console.log('Products by Category:', productsByCategory);
                res.render('products', { user, productsByCategory, categories, error: error || null });
            }
        );
    });
});

router.post('/add-product', (req, res) => {
    const { name, category, quantity, cost_price, selling_price, date } = req.body; 
    console.log(date);
    const user = req.session.user;

    if (!user) {
        return res.redirect('/login');
    }

    db.query('SELECT id FROM categories WHERE id = ? AND user_id = ?', [category, user.id], (err, result) => {
        if (err) {
            console.log('Error fetching category:', err);
            return res.render('products', { error: 'Error fetching category', user });
        }

        if (result.length === 0) {
            return res.render('products', { error: 'Category does not exist for this user', user });
        }
        const category_id = result[0].id;


        const productDate = (date && date.trim() !== '') ? date : null;

        db.query('SELECT * FROM products WHERE user_id = ? AND name = ? AND category_id = ?', [user.id, name, category], (err, result) => {
            if (err) {
                console.log('Error checking product:', err);
                return res.render('products', { error: 'Error checking product', user });
            }

            if (result.length > 0) {
                req.session.error = 'Product already exists in this category';
                return res.redirect('/products');
            }

            db.query('INSERT INTO products (name, category_id, quantity, cost_price, selling_price, user_id, expiry_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [name, category, quantity, cost_price, selling_price, user.id, productDate], (err) => {
                    if (err) {
                        console.log('Error adding product:', err);
                        return res.render('products', { error: 'Error adding product', user });
                    }
                    res.redirect('/products');
                });
        });
    });
});



router.post('/update-quantity', (req, res) => {
    console.log("increment try");
    const { productId, action } = req.body; 
    const user = req.session.user;

    if (!user) {
        return res.status(401).json({ error: 'User not logged in' });
    }

    const quantityChange = action === 'increment' ? 1 : -1;

    db.query(
        'UPDATE products SET quantity = quantity + ? WHERE id = ? AND user_id = ?',
        [quantityChange, productId, user.id],
        (err, result) => {
            if (err) {
                console.log('Error updating quantity:', err);
                return res.status(500).json({ error: 'Error updating quantity' });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Product not found or not owned by user' });
            }

            res.status(200).json({ success: 'Quantity updated successfully!' });
        }
    );
});

router.delete('/delete-product/:productId', (req, res) => {
    const productId = req.params.productId; 
    const user = req.session.user;
    console.log("delete try");

    if (!user) {
        return res.status(401).json({ error: 'User not logged in' });
    }

    db.query(
        'DELETE FROM products WHERE id = ? AND user_id = ?',
        [productId, user.id],
        (err, result) => {
            if (err) {
                console.log('Error deleting product:', err);
                return res.status(500).json({ error: 'Error deleting product' });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Product not found or not owned by user' });
            }

            res.status(200).json({ success: 'Product deleted successfully!' });
        }
    );
});

module.exports=router;