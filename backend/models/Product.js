const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
    {
        barcode: {
            type: String,
            required: [true, "Barcode is required"],
            unique: true,
            trim: true
        },

        name: {
            type: String,
            required: [true, "Product name is required"],
            trim: true
        },

        category: {
            type: String,
            required: [true, "Category is required"],
            trim: true
        },

        price: {
            type: Number,
            required: true,
            min: 0
        },

        stock: {
            type: Number,
            required: true,
            min: 0,
            default: 0
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Product", productSchema);