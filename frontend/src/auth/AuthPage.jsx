import { useEffect, useRef, useState } from "react";

const API_URL = "http://localhost:5000/api/auth";

export default function AuthPage({ onAuthenticated }) {
    const [mode, setMode] = useState("user-login");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const googleButtonRef = useRef(null);

    const isAdmin = mode === "admin-login";
    const isRegister = mode === "register";

    useEffect(() => {
        let cancelled = false;

        function initializeGoogle() {
            if (
                cancelled ||
                !window.google?.accounts?.id ||
                !googleButtonRef.current
            ) {
                return;
            }

            const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

            if (!clientId) {
                setError(
                    "Google sign-in is not configured. Check your frontend .env file."
                );
                return;
            }

            window.google.accounts.id.initialize({
                client_id: clientId,

                callback: async (response) => {
                    if (!response.credential) {
                        setError("Google did not return a valid credential.");
                        return;
                    }

                    await submitGoogleCredential(response.credential);
                },
            });

            googleButtonRef.current.innerHTML = "";

            window.google.accounts.id.renderButton(
                googleButtonRef.current,
                {
                    theme: "outline",
                    size: "large",
                    shape: "rectangular",
                    text: "continue_with",
                    width: 300,
                }
            );
        }

        async function submitGoogleCredential(credential) {
            setLoading(true);
            setError("");

            try {
                const response = await fetch(`${API_URL}/google`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ credential }),
                });

                const result = await response.json();

                if (!response.ok || !result.success) {
                    throw new Error(
                        result.message || "Google sign-in failed."
                    );
                }

                saveSession(result);

            } catch (err) {
                setError(err.message || "Google sign-in failed.");
            } finally {
                setLoading(false);
            }
        }

        if (window.google?.accounts?.id) {
            initializeGoogle();
        } else {
            let script = document.querySelector(
                'script[data-google-identity="true"]'
            );

            if (!script) {
                script = document.createElement("script");
                script.src = "https://accounts.google.com/gsi/client";
                script.async = true;
                script.defer = true;
                script.dataset.googleIdentity = "true";
                document.head.appendChild(script);
            }

            script.addEventListener("load", initializeGoogle);

            return () => {
                cancelled = true;
                script.removeEventListener("load", initializeGoogle);
            };
        }

        return () => {
            cancelled = true;
        };
    }, [mode]);

    function saveSession(result) {
        if (!result.token || !result.user) {
            throw new Error("The server returned an incomplete login response.");
        }

        localStorage.setItem("posToken", result.token);
        localStorage.setItem("posUser", JSON.stringify(result.user));

        onAuthenticated(result.user);
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setError("");
        setLoading(true);

        try {
            let endpoint;

            if (isAdmin) {
                endpoint = "/admin/login";
            } else if (isRegister) {
                endpoint = "/register";
            } else {
                endpoint = "/login";
            }

            const body = isRegister
                ? { name, email, password }
                : { email, password };

            const response = await fetch(`${API_URL}${endpoint}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message || "Authentication failed."
                );
            }

            if (isAdmin && result.user.role !== "admin") {
                throw new Error("This account is not an administrator.");
            }

            saveSession(result);

        } catch (err) {
            setError(err.message || "Something went wrong.");
        } finally {
            setLoading(false);
        }
    }

    function changeMode(nextMode) {
        setMode(nextMode);
        setError("");
        setPassword("");
    }

    const styles = {
        page: {
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            background:
                "linear-gradient(135deg, #0f172a 0%, #172554 55%, #312e81 100%)",
            fontFamily: "Arial, sans-serif",
            boxSizing: "border-box",
        },
        card: {
            width: "100%",
            maxWidth: "430px",
            padding: "34px",
            background: "#ffffff",
            borderRadius: "20px",
            boxShadow: "0 25px 70px rgba(0,0,0,0.3)",
            boxSizing: "border-box",
        },
        logo: {
            width: "54px",
            height: "54px",
            margin: "0 auto 16px",
            borderRadius: "16px",
            background: "#2563eb",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "27px",
            fontWeight: "bold",
        },
        heading: {
            margin: "0",
            color: "#111827",
            textAlign: "center",
            fontSize: "27px",
        },
        subtitle: {
            margin: "10px 0 25px",
            color: "#6b7280",
            textAlign: "center",
            fontSize: "14px",
            lineHeight: "1.5",
        },
        tabs: {
            display: "flex",
            gap: "8px",
            padding: "5px",
            marginBottom: "24px",
            background: "#f3f4f6",
            borderRadius: "10px",
        },
        tab: {
            flex: 1,
            padding: "11px 5px",
            border: "none",
            borderRadius: "7px",
            fontSize: "13px",
            fontWeight: "600",
            cursor: "pointer",
        },
        label: {
            display: "block",
            marginBottom: "7px",
            color: "#374151",
            fontSize: "13px",
            fontWeight: "600",
        },
        input: {
            width: "100%",
            padding: "12px 13px",
            border: "1px solid #d1d5db",
            borderRadius: "9px",
            fontSize: "14px",
            outline: "none",
            boxSizing: "border-box",
        },
        field: {
            marginBottom: "17px",
        },
        submit: {
            width: "100%",
            marginTop: "5px",
            padding: "13px",
            border: "none",
            borderRadius: "9px",
            background: "#2563eb",
            color: "white",
            fontSize: "15px",
            fontWeight: "bold",
            cursor: "pointer",
        },
        divider: {
            display: "flex",
            alignItems: "center",
            gap: "12px",
            margin: "22px 0",
            color: "#9ca3af",
            fontSize: "12px",
        },
        google: {
            display: "flex",
            justifyContent: "center",
            minHeight: "42px",
        },
        footer: {
            marginTop: "23px",
            textAlign: "center",
            color: "#6b7280",
            fontSize: "13px",
        },
        link: {
            padding: 0,
            border: "none",
            background: "transparent",
            color: "#2563eb",
            fontWeight: "bold",
            cursor: "pointer",
        },
    };

    return (
        <div style={styles.page}>
            <div style={styles.card}>
                <div style={styles.logo}>P</div>

                <h1 style={styles.heading}>POS-Sync</h1>

                <p style={styles.subtitle}>
                    {isAdmin
                        ? "Administrator portal"
                        : isRegister
                          ? "Create your account to get started"
                          : "Sign in to continue"}
                </p>

                <div style={styles.tabs}>
                    <button
                        type="button"
                        onClick={() => changeMode("user-login")}
                        style={{
                            ...styles.tab,
                            background: mode === "user-login" ? "#ffffff" : "transparent",
                            color: mode === "user-login" ? "#2563eb" : "#6b7280",
                            boxShadow:
                                mode === "user-login"
                                    ? "0 1px 4px rgba(0,0,0,0.1)"
                                    : "none",
                        }}
                    >
                        User
                    </button>

                    <button
                        type="button"
                        onClick={() => changeMode("register")}
                        style={{
                            ...styles.tab,
                            background: isRegister ? "#ffffff" : "transparent",
                            color: isRegister ? "#2563eb" : "#6b7280",
                            boxShadow: isRegister
                                ? "0 1px 4px rgba(0,0,0,0.1)"
                                : "none",
                        }}
                    >
                        Register
                    </button>

                    <button
                        type="button"
                        onClick={() => changeMode("admin-login")}
                        style={{
                            ...styles.tab,
                            background: isAdmin ? "#ffffff" : "transparent",
                            color: isAdmin ? "#2563eb" : "#6b7280",
                            boxShadow: isAdmin
                                ? "0 1px 4px rgba(0,0,0,0.1)"
                                : "none",
                        }}
                    >
                        Admin
                    </button>
                </div>

                <form onSubmit={handleSubmit} autoComplete="off">
                    {isRegister && (
                        <div style={styles.field}>
                            <label style={styles.label} htmlFor="auth-name">
                                Full name
                            </label>

                            <input
                                id="auth-name"
                                type="text"
                                autoComplete="name"
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                                placeholder="Enter your name"
                                maxLength={100}
                                required
                                style={styles.input}
                            />
                        </div>
                    )}

                    <div style={styles.field}>
                        <label style={styles.label} htmlFor="auth-email">
                            Email address
                        </label>

                        <input
                            id="auth-email"
                            type="email"
                            autoComplete="off"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            placeholder="you@example.com"
                            required
                            style={styles.input}
                        />
                    </div>

                    <div style={styles.field}>
                        <label style={styles.label} htmlFor="auth-password">
                            Password
                        </label>

                        <div style={{ position: "relative" }}>
                            <input
                                id="auth-password"
                                type={showPassword ? "text" : "password"}
                                autoComplete="new-password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                placeholder={
                                    isRegister
                                        ? "At least 8 characters"
                                        : "Enter your password"
                                }
                                minLength={isRegister ? 8 : undefined}
                                maxLength={128}
                                required
                                style={{
                                    ...styles.input,
                                    paddingRight: "76px",
                                }}
                            />

                            <button
                                type="button"
                                onClick={() => setShowPassword((value) => !value)}
                                style={{
                                    position: "absolute",
                                    right: "10px",
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    border: "none",
                                    background: "transparent",
                                    color: "#2563eb",
                                    cursor: "pointer",
                                    fontSize: "12px",
                                }}
                            >
                                {showPassword ? "Hide" : "Show"}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div
                            role="alert"
                            style={{
                                marginBottom: "16px",
                                padding: "11px",
                                background: "#fef2f2",
                                border: "1px solid #fecaca",
                                borderRadius: "8px",
                                color: "#b91c1c",
                                fontSize: "13px",
                                lineHeight: "1.5",
                            }}
                        >
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            ...styles.submit,
                            opacity: loading ? 0.65 : 1,
                        }}
                    >
                        {loading
                            ? "Please wait..."
                            : isAdmin
                              ? "Sign in as Admin"
                              : isRegister
                                ? "Create Account"
                                : "Sign In"}
                    </button>
                </form>

                {!isAdmin && (
                    <>
                        <div style={styles.divider}>
                            <span style={{ flex: 1, height: "1px", background: "#e5e7eb" }} />
                            <span>OR CONTINUE WITH</span>
                            <span style={{ flex: 1, height: "1px", background: "#e5e7eb" }} />
                        </div>

                        <div
                            ref={googleButtonRef}
                            style={styles.google}
                        />

                        <p style={styles.footer}>
                            {isRegister ? (
                                <>
                                    Already have an account?{" "}
                                    <button
                                        type="button"
                                        style={styles.link}
                                        onClick={() => changeMode("user-login")}
                                    >
                                        Sign in
                                    </button>
                                </>
                            ) : (
                                <>
                                    New to POS-Sync?{" "}
                                    <button
                                        type="button"
                                        style={styles.link}
                                        onClick={() => changeMode("register")}
                                    >
                                        Create an account
                                    </button>
                                </>
                            )}
                        </p>
                    </>
                )}

                {isAdmin && (
                    <p style={styles.footer}>
                        Administrator access only.
                    </p>
                )}
            </div>
        </div>
    );
}