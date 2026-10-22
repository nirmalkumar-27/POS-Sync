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

// Complete a sale
router.post("/checkout", authenticateToken, async (req, res) => {
  const { items, paymentMethod } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Your cart is empty",
    });
  }

  if (!["Cash", "UPI", "Card"].includes(paymentMethod)) {
    return res.status(400).json({
      success: false,
      message: "Select a valid payment method",
    });
  }

  // Combine duplicate product IDs before processing.
  const quantities = new Map();

  for (const item of items) {
    const productId = String(item.productId || "");
    const quantity = Number(item.quantity);

    if (
      !mongoose.isValidObjectId(productId) ||
      !Number.isInteger(quantity) ||
      quantity < 1
    ) {
      return res.status(400).json({
        success: false,
        message: "The cart contains an invalid product or quantity",
      });
    }

    quantities.set(
      productId,
      (quantities.get(productId) || 0) + quantity
    );
  }

  const session = await mongoose.startSession();

  try {
    let completedSale;

    await session.withTransaction(async () => {
      const saleItems = [];
      let subtotalInPaise = 0;

      for (const [productId, quantity] of quantities) {
        const product = await Product.findOneAndUpdate(
          {
            _id: productId,
            stock: { $gte: quantity },
          },
          {
            $inc: { stock: -quantity },
          },
          {
            new: true,
            session,
          }
        );

        if (!product) {
          throw new Error(
            `Product ${productId} was not found or does not have enough stock`
          );
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
        [
          {
            items: saleItems,
            subtotal: subtotalInPaise / 100,
            tax: taxInPaise / 100,
            total: totalInPaise / 100,
            paymentMethod,
          },
        ],
        { session }
      );

      completedSale = sale;
    });

    res.status(201).json({
      success: true,
      message: "Sale completed successfully",
      sale: completedSale,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || "Checkout failed",
    });
  } finally {
    await session.endSession();
  }
});

// View sales history
router.get("/", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const sales = await Sale.find()
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({
      success: true,
      count: sales.length,
      sales,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch sales",
    });
  }
});

module.exports = router;