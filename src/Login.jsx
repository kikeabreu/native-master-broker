import { useState } from "react";
import { supabase } from "./supabaseClient";

export default function Login({ onAuthed }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(false);

    const signIn = async () => {
        setErr("");
        setLoading(true);
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        setLoading(false);
        if (error) return setErr(error.message);
        onAuthed?.(data.user);
    };

    return (
        /* ESTE ES EL CONTENEDOR QUE OCUPA TODA LA PANTALLA */
        <div style={{ 
            width: "100vw",          // 100% del ancho de la pantalla
            minHeight: "100vh",      // 100% del alto de la pantalla
            display: "flex",         // Activa el modo "caja flexible"
            alignItems: "center",    // Centra verticalmente
            justifyContent: "center",// Centra horizontalmente
            background: "#000",      // Fondo negro
            margin: 0,
            padding: "20px",         // Espacio de seguridad para móviles
            boxSizing: "border-box"
        }}>
            
            {/* ESTA ES LA TARJETA DEL LOGIN */}
            <div style={{ 
                width: "100%", 
                maxWidth: "380px",   // No deja que la tarjeta sea gigante en PC
                border: "1px solid #1a1a2e", 
                borderRadius: 14, 
                padding: 24, 
                background: "#0d0d1a",
                boxShadow: "0 10px 30px rgba(0,0,0,0.5)"
            }}>
                <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 20, textAlign: "center" }}>
                    LOGIN · NATIVE MASTER BROKER CRM
                </div>

                <div style={{ marginBottom: 15 }}>
                    <label style={{ fontSize: 12, color: "#9ca3af", display: "block", marginBottom: 5 }}>Email</label>
                    <input
                        style={{ 
                            width: "100%", 
                            padding: "12px", 
                            borderRadius: 10, 
                            border: "1px solid #1a1a2e", 
                            background: "#07070f", 
                            color: "#fff",
                            boxSizing: "border-box" // Importante para que no se salga de la tarjeta
                        }}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>

                <div style={{ marginBottom: 15 }}>
                    <label style={{ fontSize: 12, color: "#9ca3af", display: "block", marginBottom: 5 }}>Contraseña</label>
                    <input
                        type="password"
                        style={{ 
                            width: "100%", 
                            padding: "12px", 
                            borderRadius: 10, 
                            border: "1px solid #1a1a2e", 
                            background: "#07070f", 
                            color: "#fff",
                            boxSizing: "border-box"
                        }}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </div>

                {err && <div style={{ color: "#ef4444", fontSize: 12, marginBottom: 10, textAlign: "center" }}>{err}</div>}

                <button
                    onClick={signIn}
                    disabled={loading}
                    style={{ 
                        width: "100%", 
                        padding: "12px", 
                        borderRadius: 10, 
                        border: "none", 
                        background: "#6366f1", 
                        color: "#fff", 
                        fontWeight: 800, 
                        cursor: "pointer",
                        marginTop: 10
                    }}
                >
                    {loading ? "Entrando..." : "Entrar"}
                </button>
            </div>
        </div>
    );
}
