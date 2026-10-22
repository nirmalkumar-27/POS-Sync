const express = require("express");
const Sale = require("../models/Sale");

const router = express.Router();

const {
    authenticateToken,
    requireAdmin
} = require("../middleware/authMiddleware");

// GET /api/analytics
// Provides revenue trends, best-selling products,
// payment breakdown, and summary statistics.
router.get("/", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const now = new Date();

    // Start of today, using the server's local timezone.
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    // Start of the previous 6 days, including today.
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    // Fetch sales from the last 7 days.
    const recentSales = await Sale.find({
      createdAt: { $gte: sevenDaysAgo },
      status: "Completed",
    }).sort({ createdAt: 1 });

    // Prepare revenue for each of the 7 days,
    // including days with no sales.
    const revenueByDay = {};

    for (let i = 0; i < 7; i++) {
      const date = new Date(sevenDaysAgo);
      date.setDate(date.getDate() + i);

      const key = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
      ].join("-");

      revenueByDay[key] = 0;
    }

    const bestSellingProducts = {};
    const paymentBreakdown = {
      Cash: { transactions: 0, revenue: 0 },
      UPI: { transactions: 0, revenue: 0 },
      Card: { transactions: 0, revenue: 0 },
    };

    let sevenDayRevenue = 0;
    let todaysRevenue = 0;
    let todaysTransactions = 0;
    let productsSold = 0;

    for (const sale of recentSales) {
      const date = new Date(sale.createdAt);

      const dateKey = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
      ].join("-");

      const total = Number(sale.total) || 0;

      if (revenueByDay[dateKey] !== undefined) {
        revenueByDay[dateKey] += total;
      }

      sevenDayRevenue += total;

      if (date >= today) {
        todaysRevenue += total;
        todaysTransactions++;
      }

      if (paymentBreakdown[sale.paymentMethod]) {
        paymentBreakdown[sale.paymentMethod].transactions++;
        paymentBreakdown[sale.paymentMethod].revenue += total;
      }

      for (const item of sale.items) {
        const name = item.name;
        const quantity = Number(item.quantity) || 0;

        productsSold += quantity;

        if (!bestSellingProducts[name]) {
          bestSellingProducts[name] = {
            name,
            quantitySold: 0,
            revenue: 0,
          };
        }

        bestSellingProducts[name].quantitySold += quantity;
        bestSellingProducts[name].revenue += Number(item.subtotal) || 0;
      }
    }

    const bestSellers = Object.values(bestSellingProducts)
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, 5);

    const revenueTrend = Object.entries(revenueByDay).map(
      ([date, revenue]) => ({
        date,
        revenue: Number(revenue.toFixed(2)),
      })
    );

    res.json({
      success: true,
      summary: {
        todaysRevenue: Number(todaysRevenue.toFixed(2)),
        todaysTransactions,
        sevenDayRevenue: Number(sevenDayRevenue.toFixed(2)),
        productsSold,
      },
      revenueTrend,
      bestSellers,
      paymentBreakdown,
    });
  } catch (error) {
    console.error("Analytics error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to generate analytics",
    });
  }
});

// GET /api/analytics/report?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
// Generates a report for a selected date range.
router.get("/report", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Please provide startDate and endDate",
      });
    }

    // Validate the expected date format and actual calendar dates.
    const isValidDate = (value) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
      }

      const parsed = new Date(`${value}T00:00:00.000Z`);

      return (
        !Number.isNaN(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === value
      );
    };

    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      return res.status(400).json({
        success: false,
        message: "Dates must be valid YYYY-MM-DD dates",
      });
    }

    if (startDate > endDate) {
      return res.status(400).json({
        success: false,
        message: "startDate must not be after endDate",
      });
    }

    // Use an exclusive upper bound so the entire end date is included.
    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 1);

    const sales = await Sale.find({
      createdAt: {
        $gte: start,
        $lt: end,
      },
      status: "Completed",
    }).sort({ createdAt: -1 });

    const totalRevenue = sales.reduce(
      (sum, sale) => sum + (Number(sale.total) || 0),
      0
    );

    const totalTax = sales.reduce(
      (sum, sale) => sum + (Number(sale.tax) || 0),
      0
    );

    const totalProductsSold = sales.reduce(
      (sum, sale) =>
        sum +
        sale.items.reduce(
          (itemSum, item) => itemSum + (Number(item.quantity) || 0),
          0
        ),
      0
    );

    res.json({
      success: true,
      report: {
        startDate,
        endDate,
        totalTransactions: sales.length,
        totalRevenue: Number(totalRevenue.toFixed(2)),
        totalTax: Number(totalTax.toFixed(2)),
        totalProductsSold,
      },
      sales,
    });
  } catch (error) {
    console.error("Sales report error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to generate sales report",
    });
  }
});

module.exports = router;