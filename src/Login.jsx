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
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#07070f", color: "#fff" }}>
            <div style={{ width: 380, border: "1px solid #1a1a2e", borderRadius: 14, padding: 18, background: "#0d0d1a" }}>
                <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 10 }}>Login · Native Master Broker CRM</div>

                <label style={{ fontSize: 12, color: "#9ca3af" }}>Email</label>
                <input
                    style={{ width: "100%", marginTop: 6, marginBottom: 10, padding: "10px 12px", borderRadius: 10, border: "1px solid #1a1a2e", background: "#07070f", color: "#fff" }}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />

                <label style={{ fontSize: 12, color: "#9ca3af" }}>Password</label>
                <input
                    type="password"
                    style={{ width: "100%", marginTop: 6, marginBottom: 10, padding: "10px 12px", borderRadius: 10, border: "1px solid #1a1a2e", background: "#07070f", color: "#fff" }}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />

                {err && <div style={{ color: "#ef4444", fontSize: 12, marginBottom: 10 }}>{err}</div>}

                <button
                    onClick={signIn}
                    disabled={loading}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "none", background: "#6366f1", color: "#fff", fontWeight: 800, cursor: "pointer" }}
                >
                    {loading ? "Entrando..." : "Entrar"}
                </button>
            </div>
        </div>
    );
}
