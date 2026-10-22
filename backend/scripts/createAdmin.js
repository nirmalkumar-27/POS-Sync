const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const readline = require("readline");
require("dotenv").config();

const User = require("../models/User");

const rl = readline.createInterface({
input: process.stdin,
output: process.stdout
});

function ask(question) {
return new Promise((resolve) => {
rl.question(question, resolve);
});
}

async function createAdmin() {
try {
if (!process.env.MONGODB_URI) {
throw new Error("MONGODB_URI is missing from .env");
}

    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET is missing from .env");
    }

    const name = (await ask("Enter admin name: ")).trim();

    const email = (await ask("Enter admin email: "))
        .trim()
        .toLowerCase();

    const password = await ask(
        "Create admin password (minimum 8 characters): "
    );

    if (!name || name.length > 100) {
        throw new Error("Please enter a valid name.");
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("Please enter a valid email address.");
    }

    if (password.length < 8 || password.length > 128) {
        throw new Error(
            "Password must contain between 8 and 128 characters."
        );
    }

    await mongoose.connect(process.env.MONGODB_URI);

    console.log("\nConnected to MongoDB.");

    const existingUser = await User.findOne({ email });

    if (existingUser) {
        throw new Error(
            "An account with this email already exists. Choose another email."
        );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const admin = await User.create({
        name,
        email,
        password: hashedPassword,
        role: "admin"
    });

    console.log("\nAdmin account created successfully!");
    console.log("Admin email:", admin.email);
    console.log("Role:", admin.role);
    console.log("You can now use the admin login endpoint.");

} catch (error) {
    console.error("\nAdmin creation failed:", error.message);
    process.exitCode = 1;

} finally {
    rl.close();

    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect().catch(() => {});
    }
}

}

createAdmin();