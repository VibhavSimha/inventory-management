const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');
const router = express.Router();





router.get('/', (req, res) => {
    const userId = req.session.user ? req.session.user.id : null;

    if (!userId) {
        return res.redirect('/login'); 
    }

    const queryProducts = `SELECT id, name, quantity, selling_price FROM products WHERE user_id = ?`;

    const querySales = `
        SELECT sale_items.quantity, sale_items.total AS total_price, 
               sales.date, sale_items.product_name
        FROM sale_items
        JOIN sales ON sale_items.sale_id = sales.id
        WHERE sales.user_id = ?
        ORDER BY sales.date DESC
        LIMIT 5`; 

    db.query(queryProducts, [userId], (err, products) => {
        if (err) {
            console.error('Error fetching products:', err);
            return res.render('sales', { products: [], sales: [], cart: [], error: 'Unable to fetch products.', user: req.session.user });
        }

        db.query(querySales, [userId], (err, sales) => {
            if (err) {
                console.error('Error fetching sales data:', err);
                return res.render('sales', { products: [], sales: [], cart: [], error: 'Unable to fetch sales data.', user: req.session.user });
            }

            const cart = req.session.cart || [];
            res.render('sales', { products, sales, cart, error: null, user: req.session.user });
        });
    });
});


router.post('/add-to-cart', (req, res) => {
    const { product, quantity } = req.body;
    const userId = req.session.user ? req.session.user.id : null;

    if (!userId) {
        return res.redirect('/login'); 
    }

    const queryProduct = `SELECT id, name, quantity, selling_price FROM products WHERE id = ? AND user_id = ?`;

    db.query(queryProduct, [product, userId], (err, productData) => {
        if (err || !productData[0] || productData[0].quantity < quantity) {
            res.session.error='Insufficient stock.'
            return res.redirect('/sales');
        }

        const cart = req.session.cart || [];
        const total_price = parseFloat(quantity * productData[0].selling_price);

        cart.push({
            product_id: product,
            product_name: productData[0].name,
            quantity: parseInt(quantity, 10),
            selling_price: parseFloat(productData[0].selling_price),
            total_price: total_price,
        });

        req.session.cart = cart;
        res.redirect('/sales');
    });
});

router.post('/checkout', (req, res) => {
    const cart = req.session.cart || [];
    const paymentMethod = req.body.payment_method;
    const userId = req.session.user ? req.session.user.id : null;

    if (!userId) {
        return res.redirect('/login'); // Redirect to login if not logged in
    }

    if (cart.length === 0) {
        res.session.error='Cart is empty.'
        return res.redirect('/sales');
    }

    if (!paymentMethod) {
        res.session.error='Please select a payment method.'
        return res.redirect('/sales');
    }

    const validPaymentMethods = ['Cash', 'Card', 'Other'];
    if (!validPaymentMethods.includes(paymentMethod)) {
        res.session.error='Invalid payment method.'
        return res.redirect('/sales');
    }

    let totalSale = 0;
    let checkStockCompleted = 0;
    const totalItems = cart.length;

    cart.forEach((item) => {
        const queryProduct = 'SELECT quantity FROM products WHERE id = ? AND user_id = ?';

        db.query(queryProduct, [item.product_id, userId], (err, productData) => {
            if (err) {
                console.error('Error checking product stock:', err);
                res.session.error='Error checking stock'
                return res.redirect('/sales');
            }

            if (!productData || productData[0].quantity < item.quantity) {
                res.session.error='Insufficient stock for some items.'
                return res.redirect('/sales');
            }

            totalSale += item.total_price;
            checkStockCompleted++;

            if (checkStockCompleted === totalItems) {
                const querySale = `INSERT INTO sales (user_id, total, payment_method) VALUES (?, ?, ?)`;

                db.query(querySale, [userId, totalSale, paymentMethod], (err, sale) => {
                    if (err) {
                        console.error('Error during sale insertion:', err);
                        return res.redirect('/sales?error=Error processing sale: ' + err.message);
                    }

                    let saleItemsProcessed = 0;
                    cart.forEach((item) => {
                        const querySaleItem = `INSERT INTO sale_items (sale_id, product_name, quantity, sale_price, total)
                                               VALUES (?, ?, ?, ?, ?)`;

                        db.query(querySaleItem, [sale.insertId, item.product_name, item.quantity, item.selling_price, item.total_price], (err) => {
                            if (err) {
                                console.error('Error inserting sale item:', err);
                                return res.redirect('/sales?error=Error processing sale items');
                            }

                            const updateProductQuery = `UPDATE products SET quantity = quantity - ? WHERE id = ? AND user_id = ?`;
                            db.query(updateProductQuery, [item.quantity, item.product_id, userId], (err) => {
                                if (err) {
                                    console.error('Error updating product quantity:', err);
                                    return res.redirect('/sales?error=Error updating product quantity');
                                }

                                saleItemsProcessed++;

                                if (saleItemsProcessed === totalItems) {
                                    req.session.cart = []; // Clear the cart after checkout
                                    res.redirect('/sales');
                                }
                            });
                        });
                    });
                });
            }
        });
    });
});

module.exports=router;