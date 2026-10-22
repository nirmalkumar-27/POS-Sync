const express = require("express");
const Product = require("../models/Product");

const {
    authenticateToken,
    requireAdmin
} = require("../middleware/authMiddleware");

const router = express.Router();

// GET all products
router.get("/", authenticateToken, async (req, res) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 });

        res.json({
            success: true,
            count: products.length,
            products
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch products",
            error: error.message
        });
    }
});

// GET a product by barcode
router.get("/barcode/:barcode", authenticateToken, async (req, res) => {
    try {
        const barcode = req.params.barcode.trim();

        const product = await Product.findOne({ barcode });

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found for this barcode"
            });
        }

        res.json({
            success: true,
            product
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Barcode lookup failed",
            error: error.message
        });
    }
});

// ADD a product
router.post("/", authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { barcode, name, category, price, stock } = req.body;

        if (!barcode || !name || !category) {
            return res.status(400).json({
                success: false,
                message: "Barcode, name and category are required"
            });
        }

        const numericPrice = Number(price);
        const numericStock = Number(stock);

        if (
            price === undefined ||
            !Number.isFinite(numericPrice) ||
            numericPrice < 0 ||
            stock === undefined ||
            !Number.isInteger(numericStock) ||
            numericStock < 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid non-negative price and whole-number stock"
            });
        }

        const product = await Product.create({
            barcode: barcode.trim(),
            name: name.trim(),
            category: category.trim(),
            price: numericPrice,
            stock: numericStock
        });

        res.status(201).json({
            success: true,
            message: "Product added successfully",
            product
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "A product with this barcode already exists"
            });
        }

        if (error.name === "ValidationError") {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        res.status(500).json({
            success: false,
            message: "Failed to add product",
            error: error.message
        });
    }
});

// UPDATE a product
router.put("/:id", authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { barcode, name, category, price, stock } = req.body;

        const updates = {};

        if (barcode !== undefined) updates.barcode = String(barcode).trim();
        if (name !== undefined) updates.name = String(name).trim();
        if (category !== undefined) updates.category = String(category).trim();

        if (price !== undefined) {
            const numericPrice = Number(price);

            if (!Number.isFinite(numericPrice) || numericPrice < 0) {
                return res.status(400).json({
                    success: false,
                    message: "Price must be a non-negative number"
                });
            }

            updates.price = numericPrice;
        }

        if (stock !== undefined) {
            const numericStock = Number(stock);

            if (!Number.isInteger(numericStock) || numericStock < 0) {
                return res.status(400).json({
                    success: false,
                    message: "Stock must be a non-negative whole number"
                });
            }

            updates.stock = numericStock;
        }

        const product = await Product.findByIdAndUpdate(
            req.params.id,
            updates,
            {
                new: true,
                runValidators: true
            }
        );

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        res.json({
            success: true,
            message: "Product updated successfully",
            product
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "That barcode is already assigned to another product"
            });
        }

        res.status(500).json({
            success: false,
            message: "Failed to update product",
            error: error.message
        });
    }
});

// DELETE a product
router.delete("/:id", authenticateToken, requireAdmin, async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        res.json({
            success: true,
            message: "Product deleted successfully"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to delete product",
            error: error.message
        });
    }
});

module.exports = router;