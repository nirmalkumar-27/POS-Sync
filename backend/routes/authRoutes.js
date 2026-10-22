const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");

const router = express.Router();

const googleClient = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID
);

// Generate a JWT for an authenticated user
function generateToken(user) {
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET is missing from .env");
    }

    return jwt.sign(
        {
            id: user._id.toString(),
            email: user.email,
            role: user.role
        },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
    );
}

// Return safe user information without the password
function formatUser(user) {
    return {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
    };
}


// ==========================================
// 1. CUSTOMER REGISTRATION
// POST /api/auth/register
// ==========================================

router.post("/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (
            typeof name !== "string" ||
            typeof email !== "string" ||
            typeof password !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message: "Name, email, and password are required."
            });
        }

        const cleanName = name.trim();
        const cleanEmail = email.trim().toLowerCase();

        if (!cleanName || cleanName.length > 100) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid name."
            });
        }

        if (
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
        ) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address."
            });
        }

        if (password.length < 8 || password.length > 128) {
            return res.status(400).json({
                success: false,
                message: "Password must contain between 8 and 128 characters."
            });
        }

        const existingUser = await User.findOne({
            email: cleanEmail
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "An account with this email already exists."
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        // Public registration always creates a regular user.
        // Never accept the role from the client.
        const user = await User.create({
            name: cleanName,
            email: cleanEmail,
            password: hashedPassword,
            role: "user"
        });

        const token = generateToken(user);

        return res.status(201).json({
            success: true,
            message: "Account created successfully.",
            token,
            user: formatUser(user)
        });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "An account with this email already exists."
            });
        }

        console.error("Registration error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to create your account."
        });
    }
});


// ==========================================
// 2. CUSTOMER LOGIN
// POST /api/auth/login
// ==========================================

router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (
            typeof email !== "string" ||
            typeof password !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required."
            });
        }

        const cleanEmail = email.trim().toLowerCase();

        const user = await User.findOne({
            email: cleanEmail
        });

        if (!user || !user.password) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const passwordMatches = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatches) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const token = generateToken(user);

        return res.status(200).json({
            success: true,
            message: "Login successful.",
            token,
            user: formatUser(user)
        });

    } catch (error) {
        console.error("Login error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to log in."
        });
    }
});


// ==========================================
// 3. ADMIN LOGIN
// POST /api/auth/admin/login
// ==========================================

router.post("/admin/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (
            typeof email !== "string" ||
            typeof password !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required."
            });
        }

        const cleanEmail = email.trim().toLowerCase();

        const admin = await User.findOne({
            email: cleanEmail,
            role: "admin"
        });

        if (!admin || !admin.password) {
            return res.status(401).json({
                success: false,
                message: "Invalid administrator credentials."
            });
        }

        const passwordMatches = await bcrypt.compare(
            password,
            admin.password
        );

        if (!passwordMatches) {
            return res.status(401).json({
                success: false,
                message: "Invalid administrator credentials."
            });
        }

        const token = generateToken(admin);

        return res.status(200).json({
            success: true,
            message: "Administrator login successful.",
            token,
            user: formatUser(admin)
        });

    } catch (error) {
        console.error("Admin login error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to log in as administrator."
        });
    }
});


// ==========================================
// 4. GOOGLE SIGN-IN
// POST /api/auth/google
// ==========================================

router.post("/google", async (req, res) => {
    try {
        const { credential } = req.body;

        if (
            typeof credential !== "string" ||
            !credential
        ) {
            return res.status(400).json({
                success: false,
                message: "Google credential is required."
            });
        }

        if (!process.env.GOOGLE_CLIENT_ID) {
            return res.status(503).json({
                success: false,
                message: "Google sign-in has not been configured yet."
            });
        }

        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();

        if (
            !payload ||
            !payload.sub ||
            !payload.email ||
            !payload.email_verified
        ) {
            return res.status(401).json({
                success: false,
                message: "Unable to verify your Google account."
            });
        }

        const email = payload.email.toLowerCase();
        const googleId = payload.sub;
        const name = payload.name || email.split("@")[0];

        let user = await User.findOne({
            email
        });

        if (user) {
            // Do not automatically link an existing password account
            // to Google solely because the email addresses match.
            if (user.googleId && user.googleId !== googleId) {
                return res.status(409).json({
                    success: false,
                    message: "This account is linked to a different Google account."
                });
            }

            if (!user.googleId && user.password) {
                return res.status(409).json({
                    success: false,
                    message: "This email already has a password account. Please log in with your password."
                });
            }

            if (!user.googleId) {
                user.googleId = googleId;
                await user.save();
            }
        } else {
            user = await User.create({
                name,
                email,
                googleId,
                role: "user"
            });
        }

        const token = generateToken(user);

        return res.status(200).json({
            success: true,
            message: "Google sign-in successful.",
            token,
            user: formatUser(user)
        });

    } catch (error) {
        console.error("Google sign-in error:", error.message);

        return res.status(401).json({
            success: false,
            message: "Google sign-in failed. Please try again."
        });
    }
});


// ==========================================
// 5. GET CURRENT LOGGED-IN USER
// GET /api/auth/me
// ==========================================

const { authenticateToken } = require("../middleware/authMiddleware");

router.get("/me", authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User account not found."
            });
        }

        return res.status(200).json({
            success: true,
            user: formatUser(user)
        });

    } catch (error) {
        console.error("Current user error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve account information."
        });
    }
});

module.exports = router;