const express = require("express");
const router = express.Router();

const Sale = require("../models/Sale");
const Product = require("../models/Product");

const {
    authenticateToken,
    requireAdmin
} = require("../middleware/authMiddleware");

// GET /api/dashboard
router.get("/", authenticateToken, requireAdmin, async (req, res) => {
    try {
        // Start of today in the server's local timezone
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        // End of today
        const startOfTomorrow = new Date(startOfDay);
        startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

        // Today's completed sales
        const todaysSales = await Sale.find({
            status: "Completed",
            createdAt: {
                $gte: startOfDay,
                $lt: startOfTomorrow
            }
        }).sort({ createdAt: -1 });

        // Calculate revenue
        const todaysRevenue = todaysSales.reduce(
            (sum, sale) => sum + sale.total,
            0
        );

        // Calculate number of individual items sold
        const productsSold = todaysSales.reduce(
            (sum, sale) =>
                sum +
                sale.items.reduce(
                    (itemSum, item) => itemSum + item.quantity,
                    0
                ),
            0
        );

        // Find products with low stock
        const lowStockProducts = await Product.find({
            stock: { $lte: 5 }
        }).sort({ stock: 1 });

        // Fetch recent transactions
        const recentSales = await Sale.find()
            .sort({ createdAt: -1 })
            .limit(10);

        res.json({
            success: true,
            stats: {
                todaysRevenue: Number(todaysRevenue.toFixed(2)),
                totalTransactions: todaysSales.length,
                productsSold,
                lowStockCount: lowStockProducts.length
            },
            lowStockProducts,
            recentSales
        });

    } catch (error) {
        console.error("Dashboard error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to load dashboard data"
        });
    }
});

module.exports = router;