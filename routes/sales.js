const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');
const router = express.Router();





router.get('/', (req, res) => {
    const userId = req.session.user ? req.session.user.id : null;

    if (!userId) {
        return res.redirect('/login');
    }

    const queryProducts = `
        SELECT name, MAX(quantity) AS quantity, MAX(selling_price) AS selling_price
        FROM products
        GROUP BY name
    `;

    const presentQuantity = `
        SELECT name, quantity
        FROM products
        WHERE user_id = ?
    `;

    const querySales = `
        SELECT sale_items.quantity, sale_items.total AS total_price, 
               sales.date, sale_items.product_name
        FROM sale_items
        JOIN sales ON sale_items.sale_id = sales.id
        WHERE sales.user_id = ?
        ORDER BY sales.date DESC
        LIMIT 5
    `;

    db.query(queryProducts, [userId], (err, products) => {
        if (err) {
            console.error('Error fetching products:', err);
            return res.render('sales', { products: [], sales: [], cart: [], sellers: [], error: 'Unable to fetch products.', user: req.session.user });
        }

        db.query(querySales, [userId], (err, sales) => {
            if (err) {
                console.error('Error fetching sales data:', err);
                return res.render('sales', { products: [], sales: [], cart: [], sellers: [], error: 'Unable to fetch sales data.', user: req.session.user });
            }

            db.query(presentQuantity, [userId], (err, selfQuantityResults) => {
                if (err) {
                    console.error('Error fetching quantity:', err);
                    return res.render('sales', { products: [], sales: [], cart: [], sellers: [], error: 'Unable to fetch quantity.', user: req.session.user });
                }

                // Convert results into a dictionary
                const selfQuantity = selfQuantityResults.reduce((dict, row) => {
                    dict[row.name] = row.quantity;
                    return dict;
                }, {});

                const cart = req.session.cart || [];
                const sellers = req.session.sellers || [];
                const error = req.session.error || null;
                if (req.session.error) {
                    delete req.session.error;
                }

                res.render('sales', {
                    products,
                    sales,
                    cart,
                    sellers,
                    selfQuantity,
                    error, 
                    user: req.session.user
                });
            });
        });
    });
});



router.post('/add-to-cart', (req, res) => {
    console.log("add to cart executed");

    const { quantity, seller_id } = req.body;
    const userId = req.session.user ? req.session.user.id : null;
    console.log(" quantity=", quantity, " sellerID=", seller_id);

    if (!userId) {
        return res.redirect('/login');
    }
    // const querySellers = `SELECT S.id as seller_id, S.username, P.quantity, P.selling_price 
    // FROM products P, users S
    // WHERE  P.name = ? AND P.user_id != ? AND P.user_id=S.id`;
    const queryProduct = `SELECT id, name, quantity, selling_price FROM products WHERE name = ? AND user_id = ?`;

    db.query(queryProduct, [product_sel, seller_id], (err, productData) => {
        if (err || !productData[0] || productData[0].quantity < quantity) {
            req.session.error = 'Insufficient stock.'
            return res.redirect('/sales');
        }

        const cart = req.session.cart || [];
        const sellers = req.session.sellers || [];
        const total_price = parseFloat(quantity * productData[0].selling_price);

        cart.push({
            seller_id: seller_id,
            product_id: productData[0].id,
            product_name: productData[0].name,
            quantity: parseInt(quantity, 10),
            selling_price: parseFloat(productData[0].selling_price),
            total_price: total_price,
        });

        req.session.cart = cart;
        res.redirect('/sales');
    });
});
let product_sel;
router.post('/search-sellers', (req, res) => {
    console.log("search seller executed");

    const { product } = req.body;
    const userId = req.session.user ? req.session.user.id : null;
    product_sel = product;
    if (!userId) {
        return res.redirect('/login');
    }
    console.log(product);

    const querySellers = `SELECT S.id as seller_id, S.username, P.quantity, P.selling_price 
                          FROM products P, users S
                          WHERE  P.name = ? AND P.user_id != ? AND P.user_id=S.id`;

    db.query(querySellers, [product, userId], (err, sellerData) => {
        console.log(sellerData, "data--");

        if (err || !sellerData.length) {
            req.session.error = 'No Sellers Found'
            return res.redirect('/sales');
        }

        sellers = req.session.sellers || [];
        // const total_price = parseFloat(quantity * sellerData[0].selling_price);
        sellers = [];
        sellerData.forEach((indv_seller) => {
            sellers.push({
                id: indv_seller.seller_id,
                seller_name: indv_seller.username,
                seller_product: product,
                quantity: parseInt(indv_seller.quantity, 10),
                selling_price: parseFloat(indv_seller.selling_price),
            });
        });
        req.session.sellers = sellers;
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
        req.session.error = 'Cart is empty.'
        return res.redirect('/sales');
    }

    if (!paymentMethod) {
        req.session.error = 'Please select a payment method.'
        return res.redirect('/sales');
    }

    const validPaymentMethods = ['Cash', 'Card', 'Other'];
    if (!validPaymentMethods.includes(paymentMethod)) {
        req.session.error = 'Invalid payment method.'
        return res.redirect('/sales');
    }

    let totalSale = 0;
    let checkStockCompleted = 0;
    const totalItems = cart.length;

    cart.forEach((item) => {
        const queryProduct = 'SELECT quantity FROM products WHERE id = ?';

        db.query(queryProduct, [item.product_id], (err, productData) => {
            if (err) {
                console.error('Error checking product stock:', err);
                req.session.error = 'Error checking stock'
                return res.redirect('/sales');
            }

            if (!productData || productData[0].quantity < item.quantity) {
                req.session.error = 'Insufficient stock.'
                console.log("Checkout insufficient stock");
                req.session.cart = [];
                return res.redirect('/sales');
            }     

            totalSale += item.total_price;
            checkStockCompleted++;

            if (checkStockCompleted === totalItems) {
                const querySale = `INSERT INTO sales (user_id, total, payment_method, seller) VALUES (?, ?, ?, ?)`;

                db.query(querySale, [userId, totalSale, paymentMethod, item.seller_id], (err, sale) => {
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

                            const updateProductSellerQuery = `UPDATE products SET quantity = quantity - ? WHERE name = ? AND user_id = ?`;
                            db.query(updateProductSellerQuery, [item.quantity, item.product_name, item.seller_id], (err) => {
                                if (err) {
                                    console.error('Error updating product quantity:', err);
                                    return res.redirect('/sales?error=Error updating product quantity');
                                }
                                console.log('Updated seller product quantity:', item.quantity, item.product_name, item.seller_id);

                            });
                            const updateProductBuyerQuery = `UPDATE products SET quantity = quantity + ? WHERE name = ? AND user_id = ?`;
                            db.query(updateProductBuyerQuery, [item.quantity, item.product_name, userId], (err) => {
                                if (err) {
                                    console.error('Error updating product quantity:', err);
                                    return res.redirect('/sales?error=Error updating product quantity');
                                }
                                console.log('Updated buyer product quantity:', item.quantity, item.product_name, userId);
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

module.exports = router;