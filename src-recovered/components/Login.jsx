import React, { useState } from "react";

function Login({ onLogin }) {
    const [username, setUsername] = useState(() => localStorage.getItem("pos_saved_username") || "");
    const [password, setPassword] = useState(() => localStorage.getItem("pos_saved_password") || "");
    const [rememberPassword, setRememberPassword] = useState(() => localStorage.getItem("pos_remember_password") === "true");
    const [error, setError] = useState("");

    const handleSubmit = (e) => {
        e.preventDefault();

        const isProduction = username === "HemmaCafe" && password === "Hemmacafe2026";
        const isDemo = username === "HemmaDemo" && password === "Demo2026";

        if (isProduction || isDemo) {
            if (rememberPassword) {
                localStorage.setItem("pos_saved_username", username);
                localStorage.setItem("pos_saved_password", password);
                localStorage.setItem("pos_remember_password", "true");
            } else {
                localStorage.removeItem("pos_saved_username");
                localStorage.removeItem("pos_saved_password");
                localStorage.setItem("pos_remember_password", "false");
            }
            onLogin(isProduction ? "production" : "demo");
        } else {
            setError("Credenciales incorrectas. Por favor, intenta de nuevo.");
        }
    };

    return (
        <div className="login-overlay">
            <div className="login-card">
                <div className="login-header">
                    <h1>HEMMA</h1>
                    <p>Café & Panadería</p>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Usuario</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Ingresa tu usuario"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Contraseña</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem", cursor: "pointer" }}>
                        <input
                            type="checkbox"
                            id="remember"
                            checked={rememberPassword}
                            onChange={(e) => setRememberPassword(e.target.checked)}
                            style={{ cursor: "pointer", width: "16px", height: "16px" }}
                        />
                        <label htmlFor="remember" style={{ fontSize: "0.9rem", color: "#666", cursor: "pointer" }}>
                            Recordar contraseña
                        </label>
                    </div>

                    {error && <p className="error-message">{error}</p>}
                    <button type="submit" className="login-button">
                        Ingresar
                    </button>
                </form>
            </div>
        </div>
    );
}

export default Login;
