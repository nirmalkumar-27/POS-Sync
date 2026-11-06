const express = require("express");
const mongoose = require("mongoose");
const Product = require("../models/Product");
const Sale = require("../models/Sale");

const {
  authenticateToken,
  requireAdmin,
} = require("../middleware/authMiddleware");

const router = express.Router();
const TAX_RATE = 0.05;

// Support common JWT payload property names used by auth middleware.
function authenticatedUserId(req) {
  return req.user?.id || req.user?.userId || req.user?._id || req.user?.sub || null;
}

// Complete a sale and associate it with the authenticated account.
router.post("/checkout", authenticateToken, async (req, res) => {
  const { items, paymentMethod } = req.body;
  const userId = authenticatedUserId(req);

  if (!userId || !mongoose.isValidObjectId(String(userId))) {
    return res.status(401).json({
      success: false,
      message: "Your session could not be verified. Please sign in again.",
    });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: "Your cart is empty" });
  }

  if (!["Cash", "UPI", "Card"].includes(paymentMethod)) {
    return res.status(400).json({ success: false, message: "Select a valid payment method" });
  }

  const quantities = new Map();
  for (const item of items) {
    const productId = String(item.productId || "");
    const quantity = Number(item.quantity);

    if (!mongoose.isValidObjectId(productId) || !Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({
        success: false,
        message: "The cart contains an invalid product or quantity",
      });
    }

    quantities.set(productId, (quantities.get(productId) || 0) + quantity);
  }

  const session = await mongoose.startSession();

  try {
    let completedSale;

    await session.withTransaction(async () => {
      const saleItems = [];
      let subtotalInPaise = 0;

      for (const [productId, quantity] of quantities) {
        const product = await Product.findOneAndUpdate(
          { _id: productId, stock: { $gte: quantity } },
          { $inc: { stock: -quantity } },
          { new: true, session }
        );

        if (!product) {
          throw new Error(`Product ${productId} was not found or does not have enough stock`);
        }

        const unitPriceInPaise = Math.round(product.price * 100);
        const lineTotalInPaise = unitPriceInPaise * quantity;
        subtotalInPaise += lineTotalInPaise;

        saleItems.push({
          product: product._id,
          barcode: product.barcode,
          name: product.name,
          price: unitPriceInPaise / 100,
          quantity,
          subtotal: lineTotalInPaise / 100,
        });
      }

      const taxInPaise = Math.round(subtotalInPaise * TAX_RATE);
      const totalInPaise = subtotalInPaise + taxInPaise;

      const [sale] = await Sale.create(
        [{
          user: userId,
          items: saleItems,
          subtotal: subtotalInPaise / 100,
          tax: taxInPaise / 100,
          total: totalInPaise / 100,
          paymentMethod,
        }],
        { session }
      );

      completedSale = sale;
    });

    return res.status(201).json({
      success: true,
      message: "Sale completed successfully",
      sale: completedSale,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || "Checkout failed",
    });
  } finally {
    await session.endSession();
  }
});

// A regular user can see only sales associated with their own account.
router.get("/mine", authenticateToken, async (req, res) => {
  const userId = authenticatedUserId(req);

  if (!userId || !mongoose.isValidObjectId(String(userId))) {
    return res.status(401).json({
      success: false,
      message: "Your session could not be verified. Please sign in again.",
    });
  }

  try {
    const sales = await Sale.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(100);

    return res.json({ success: true, count: sales.length, sales });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch your payment history" });
  }
});

// Administrators can view all sales.
router.get("/", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const sales = await Sale.find()
      .sort({ createdAt: -1 })
      .limit(100);

    return res.json({ success: true, count: sales.length, sales });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch sales" });
  }
});

module.exports = router;
