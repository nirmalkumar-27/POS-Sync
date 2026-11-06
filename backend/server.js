const dns = require("node:dns");

dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const saleRoutes = require("./routes/saleRoutes");
const productRoutes = require("./routes/productRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const authRoutes = require("./routes/authRoutes");

const app = express();

// CORS configuration
const allowedOrigins = [
    "http://localhost:5173",
    ...(process.env.CLIENT_URLS || "")
        .split(",")
        .map((url) => url.trim())
        .filter(Boolean)
];

app.use(
    cors({
        origin: (origin, callback) => {
            // Allow requests without an origin, such as health checks.
            if (!origin || allowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            return callback(new Error("Not allowed by CORS"));
        }
    })
);

app.use(express.json());

// Root test route
app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "POS-Sync MERN backend is running!"
    });
});

// API routes
app.use("/api/products", productRoutes);
app.use("/api/sales", saleRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/auth", authRoutes);

// Start backend
async function startServer() {
    try {
        if (!process.env.MONGODB_URI) {
            throw new Error("MONGODB_URI is missing");
        }

        await mongoose.connect(process.env.MONGODB_URI);

        console.log("MongoDB connected successfully!");

        const PORT = process.env.PORT || 5000;

        app.listen(PORT, "0.0.0.0", () => {
            console.log(`POS-Sync backend running on port ${PORT}`);
        });

    } catch (error) {
        console.error("Backend startup failed:", error.message);
        process.exit(1);
    }
}

startServer();