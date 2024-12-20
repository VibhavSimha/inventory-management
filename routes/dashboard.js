const express = require('express');
const db = require('../db');
const router = express.Router();

console.log('hi');

router.get('/', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/');
    }

    const statistics = {
        totalSales: 0,
        numberOfSales: 0,
        totalProductsSold: 0,
        totalRevenue: 0,
    };

    const expiryProducts = []; // To store products nearing expiry

    db.execute('SELECT SUM(total) AS total_sales FROM sales WHERE user_id = ?', [req.session.user.id], (err, totalSalesResult) => {
        if (err) {
            console.error(err);
            return res.render('dashboard', { user: req.session.user, error: 'Unable to fetch statistics at the moment.' });
        }

        statistics.totalSales = totalSalesResult[0]?.total_sales || 0;

        db.execute('SELECT COUNT(*) AS num_sales FROM sales WHERE user_id = ?', [req.session.user.id], (err, numberOfSalesResult) => {
            if (err) {
                console.error(err);
                return res.render('dashboard', { user: req.session.user, error: 'Unable to fetch statistics at the moment.' });
            }

            statistics.numberOfSales = numberOfSalesResult[0]?.num_sales || 0;

            db.execute('SELECT SUM(si.quantity) AS total_products_sold FROM sale_items si JOIN sales s ON si.sale_id = s.id WHERE s.user_id = ?', [req.session.user.id], (err, totalProductsSoldResult) => {
                if (err) {
                    console.error(err);
                    return res.render('dashboard', { user: req.session.user, error: 'Unable to fetch statistics at the moment.' });
                }

                statistics.totalProductsSold = totalProductsSoldResult[0]?.total_products_sold || 0;

                db.execute('SELECT SUM(total) as total FROM sales WHERE user_id = ?', [req.session.user.id], (err, totalRevenueResult) => {
                    if (err) {
                        console.error(err);
                        return res.render('dashboard', { user: req.session.user, error: 'Unable to fetch statistics at the moment.' });
                    }

                    statistics.totalRevenue = totalRevenueResult[0]?.total || 0;

                    // Fetch expiry products with dynamic expiry calculation
                    db.execute(
                        `SELECT name, expiry_date, quantity, 
                         DATEDIFF(expiry_date, CURRENT_DATE) AS days_to_expiry 
                         FROM products 
                         WHERE user_id = ? AND expiry_date <= DATE_ADD(CURRENT_DATE, INTERVAL 7 DAY) 
                         ORDER BY expiry_date ASC`,
                        [req.session.user.id],
                        (err, expiryProductsResult) => {
                            if (err) {
                                console.error(err);
                                return res.render('dashboard', { user: req.session.user, error: 'Unable to fetch expiry products.' });
                            }

                            expiryProducts.push(
                                ...expiryProductsResult.map(product => ({
                                    name: product.name,
                                    expiryDate: product.expiry_date,
                                    quantity: product.quantity,
                                    daysToExpiry: product.days_to_expiry, // Calculate remaining days dynamically
                                }))
                            );

                            res.render('dashboard', {
                                user: req.session.user,
                                totalSales: statistics.totalSales,
                                numberOfSales: statistics.numberOfSales,
                                totalProductsSold: statistics.totalProductsSold,
                                totalRevenue: statistics.totalRevenue,
                                expiryProducts: expiryProducts, // Send expiry products with dynamic expiry
                            });
                        }
                    );
                });
            });
        });
    });
});
module.exports = router;