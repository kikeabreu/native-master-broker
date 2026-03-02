import { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabaseClient";

// ── UTILS ────────────────────────────────────────────────────────────────────
function timeAgo(ts) {
    const s = Math.floor((Date.now() - new Date(ts)) / 1000);
    if (s < 60) return "Hace un momento";
    if (s < 3600) return `Hace ${Math.floor(s / 60)} min`;
    if (s < 86400) return `Hace ${Math.floor(s / 3600)}h`;
    return `Hace ${Math.floor(s / 86400)} días`;
}

function todayStr() { return new Date().toISOString().split("T")[0]; }
function monthStart() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; }
function monthEnd() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split("T")[0]; }

// ── AUTO NOTIFICATIONS (computed from CRM data, no DB) ────────────────────────
async function generateAutoNotifications(user_id) {
    const today = todayStr();
    const msgs = [];

    try {
        // Datos de hoy
        const [{ data: actsHoy }, { data: smartProfile }, { data: goals }, { data: prosMonth }] = await Promise.all([
            supabase.from("activities").select("tipo, cantidad").eq("owner_id", user_id).eq("fecha", today),
            supabase.from("smart_sales_profiles").select("config").eq("user_id", user_id).single(),
            supabase.from("goals").select("*").eq("user_id", user_id).eq("periodo", today.slice(0, 7)),
            supabase.from("prospects").select("id").eq("owner_id", user_id).gte("created_at", monthStart() + "T00:00:00").lte("created_at", monthEnd() + "T23:59:59"),
        ]);

        const cfg = smartProfile?.config || {};
        const metaDia = Number(cfg.llamadasDia) || 0;
        const metaMes = Number(cfg.metaMes) || 0;
        const nombreA = cfg.nombreA || "Proyecto A";
        const nombreB = cfg.nombreB || "Proyecto B";
        const trackVentasA = Number(cfg.trackVentasA) || 0;
        const trackVentasB = Number(cfg.trackVentasB) || 0;

        // Actividades de hoy
        const llamadasHoy = (actsHoy || [])
            .filter(a => a.tipo === "llamada" || a.tipo === "seguimiento")
            .reduce((s, a) => s + (Number(a.cantidad) || 1), 0);

        const totalActsHoy = (actsHoy || []).reduce((s, a) => s + (Number(a.cantidad) || 1), 0);

        const hora = new Date().getHours();

        // 1. Llamadas del día
        if (metaDia > 0) {
            const pct = Math.min(Math.round((llamadasHoy / metaDia) * 100), 100);
            if (llamadasHoy === 0 && hora >= 9) {
                msgs.push({ id: "auto_calls_0", tipo: "urgente", icono: "🚨", titulo: "¡Arranca el día!", texto: `Aún no has registrado ninguna llamada hoy. Tu meta diaria es ${metaDia}. ¡El que empieza gana!`, ts: new Date().toISOString() });
            } else if (pct < 50 && hora >= 14) {
                msgs.push({ id: "auto_calls_low", tipo: "alerta", icono: "⚠️", titulo: "Mitad del día, mitad de meta", texto: `Llevas ${llamadasHoy} de ${metaDia} llamadas hoy (${pct}%). Son las ${hora}:00 — aún puedes alcanzarla. ¡Dale turbo!`, ts: new Date().toISOString() });
            } else if (pct >= 100) {
                msgs.push({ id: "auto_calls_done", tipo: "logro", icono: "🔥", titulo: "¡Meta de llamadas cumplida!", texto: `Completaste tus ${metaDia} llamadas del día. ¡Eso es consistencia! Cada llamada extra es una oportunidad más.`, ts: new Date().toISOString() });
            } else if (pct >= 50) {
                msgs.push({ id: "auto_calls_mid", tipo: "info", icono: "⚡", titulo: `${100 - pct}% para tu meta de hoy`, texto: `Llevas ${llamadasHoy} de ${metaDia} llamadas. ¡Vas bien! Faltan ${metaDia - llamadasHoy} para terminar el día fuerte.`, ts: new Date().toISOString() });
            }
        }

        // 2. Prospectos del mes
        const totalPros = (prosMonth || []).length;
        const metaPros = Number(goals?.find(g => g.categoria === "prospectos")?.meta) || 0;
        if (metaPros > 0) {
            const pctPros = Math.round((totalPros / metaPros) * 100);
            if (pctPros < 25) {
                msgs.push({ id: "auto_pros", tipo: "alerta", icono: "👥", titulo: "Prospectos — ¡activa el embudo!", texto: `Llevas ${totalPros} de ${metaPros} prospectos este mes (${pctPros}%). Registrar prospectos hoy = comisiones mañana.`, ts: new Date().toISOString() });
            } else if (pctPros >= 100) {
                msgs.push({ id: "auto_pros_ok", tipo: "logro", icono: "🏆", titulo: "¡Meta de prospectos superada!", texto: `Ya tienes ${totalPros} prospectos este mes — superaste tu meta de ${metaPros}. ¡Ahora cierra!`, ts: new Date().toISOString() });
            } else {
                msgs.push({ id: "auto_pros_mid", tipo: "info", icono: "👥", titulo: `${totalPros}/${metaPros} prospectos`, texto: `Vas al ${pctPros}% de tu meta de prospectos del mes. Faltan ${metaPros - totalPros}. ¡A prospectar!`, ts: new Date().toISOString() });
            }
        }

        // 3. Comisiones del mes (Smart Sales)
        if (metaMes > 0 && cfg.precioA) {
            // Calcular comisiones
            const getPct = (ventas, precio, tipo, e1, e2, e3, u2, u3, fija) => {
                if (tipo === "fija") return { pct: fija, cpv: precio * fija / 100, total: ventas * precio * fija / 100 };
                const p = ventas >= u3 ? e3 : ventas >= u2 ? e2 : e1;
                return { pct: p, cpv: precio * p / 100, total: ventas * precio * p / 100 };
            };
            const resA = getPct(trackVentasA, cfg.precioA, cfg.tipoComA, cfg.comAE1, cfg.comAE2, cfg.comAE3, cfg.comAUmbral2, cfg.comAUmbral3, cfg.comisionA);
            const resB = getPct(trackVentasB, cfg.precioB, cfg.tipoComB, cfg.comB1, cfg.comB2, cfg.comB3, cfg.comBUmbral2, cfg.comBUmbral3, cfg.comisionB);
            const totalCom = resA.total + resB.total;
            const pctMeta = metaMes > 0 ? Math.round((totalCom / metaMes) * 100) : 0;
            const fmt = n => "$" + Math.round(n).toLocaleString("es-MX");

            if (pctMeta >= 100) {
                msgs.push({ id: "auto_meta_ok", tipo: "logro", icono: "🎯", titulo: "¡META MENSUAL ALCANZADA! 🎉", texto: `Llevas ${fmt(totalCom)} en comisiones este mes — superaste tu meta de ${fmt(metaMes)}. Cada venta extra es ganancia pura.`, ts: new Date().toISOString() });
            } else if (pctMeta >= 70) {
                msgs.push({ id: "auto_meta_close", tipo: "info", icono: "🔥", titulo: "¡Muy cerca de tu meta!", texto: `Llevas ${fmt(totalCom)} (${pctMeta}% de tu meta de ${fmt(metaMes)}). Faltan ${fmt(metaMes - totalCom)}. ¡Un par de cierres más!`, ts: new Date().toISOString() });
            } else if (pctMeta >= 30) {
                msgs.push({ id: "auto_meta_mid", tipo: "alerta", icono: "📊", titulo: `${pctMeta}% de tu meta mensual`, texto: `Llevas ${fmt(totalCom)} en comisiones. Tu meta es ${fmt(metaMes)}. Revisa tu embudo — necesitas acelerar presentaciones.`, ts: new Date().toISOString() });
            } else if (trackVentasA === 0 && trackVentasB === 0) {
                msgs.push({ id: "auto_meta_zero", tipo: "urgente", icono: "🚀", titulo: "¡Hora de activar el motor!", texto: `Aún no registras ventas este mes en tu Smart Sales. Actualiza tu tracker y enfócate en ${nombreB} — tiene la mayor efectividad de cierre.`, ts: new Date().toISOString() });
            }

            // Alerta escalón B
            const u3B = Number(cfg.comBUmbral3) || 9;
            const u2B = Number(cfg.comBUmbral2) || 4;
            if (cfg.tipoComB === "escalon" && trackVentasB >= u2B && trackVentasB < u3B) {
                const faltanB = u3B - trackVentasB;
                msgs.push({ id: "auto_nivel_b", tipo: "oportunidad", icono: "⚡", titulo: `¡Estás a ${faltanB} venta${faltanB !== 1 ? "s" : ""} del nivel máximo de ${nombreB}!`, texto: `Si llegas a ${u3B} ventas, tu comisión se vuelve retroactiva al ${cfg.comB3 || 8}% en TODAS las ventas. ¡Ese brinco vale la pena!`, ts: new Date().toISOString() });
            }
        }

        // 4. Mensaje motivacional de inicio de día (si es antes del mediodía)
        if (hora < 12 && totalActsHoy === 0) {
            const frases = [
                "La consistencia diaria es lo que separa a los top sellers del resto. ¡Empieza fuerte!",
                "Cada prospecto que registres hoy es una comisión que se está cocinando. ¡A darle!",
                "Los asesores que ganan más no tienen suerte — tienen disciplina diaria. ¡Este es tu día!",
                "Una llamada más, un prospecto más, una presentación más. Así se construyen los meses épicos.",
                "Tu meta mensual se logra día a día. Hoy es otro día para avanzar. ¡Tú puedes!",
            ];
            const frase = frases[new Date().getDate() % frases.length];
            msgs.push({ id: "auto_morning", tipo: "motivacion", icono: "🌟", titulo: "¡Buenos días! A comenzar el día", texto: frase, ts: new Date().toISOString() });
        }

    } catch (e) { console.error("Error generando auto-notificaciones:", e); }

    return msgs;
}

// ── ESTILOS ───────────────────────────────────────────────────────────────────
const S2 = "#0d0d1a"; const S3 = "#141b24"; const BD = "1px solid #14142a";
const TX = "#e8ecf4"; const TX2 = "#8892a4"; const TX3 = "#4a5468";

const TIPO_CONFIG = {
    urgente: { color: "#f05060", bg: "rgba(240,80,96,0.10)", icoBg: "rgba(240,80,96,0.15)", label: "URGENTE" },
    alerta: { color: "#f0c060", bg: "rgba(240,192,96,0.08)", icoBg: "rgba(240,192,96,0.15)", label: "ALERTA" },
    info: { color: "#5090f0", bg: "rgba(80,144,240,0.08)", icoBg: "rgba(80,144,240,0.15)", label: "INFO" },
    logro: { color: "#3dd9c0", bg: "rgba(61,217,192,0.08)", icoBg: "rgba(61,217,192,0.15)", label: "LOGRO" },
    oportunidad: { color: "#a78bfa", bg: "rgba(167,139,250,0.08)", icoBg: "rgba(167,139,250,0.15)", label: "OPORTUNIDAD" },
    motivacion: { color: "#f59e0b", bg: "rgba(245,158,11,0.08)", icoBg: "rgba(245,158,11,0.15)", label: "HOY" },
    manual: { color: "#6366f1", bg: "rgba(99,102,241,0.08)", icoBg: "rgba(99,102,241,0.15)", label: "MENSAJE" },
};

function NotifCard({ notif, onRead }) {
    const tc = TIPO_CONFIG[notif.tipo] || TIPO_CONFIG.info;
    return (
        <div style={{ background: notif.leida ? S2 : tc.bg, border: `1px solid ${notif.leida ? "#14142a" : tc.color + "33"}`, borderRadius: 12, padding: 16, display: "flex", gap: 12, transition: "all 0.2s", cursor: "default", position: "relative" }}>
            {!notif.leida && <div style={{ position: "absolute", top: 12, right: 12, width: 8, height: 8, borderRadius: "50%", background: tc.color, boxShadow: `0 0 8px ${tc.color}` }} />}
            <div style={{ width: 40, height: 40, borderRadius: 10, background: tc.icoBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{notif.icono || "📬"}</div>
            <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: tc.color + "22", color: tc.color, letterSpacing: 1 }}>{tc.label}</span>
                    <span style={{ fontSize: 11, color: TX3 }}>{notif.ts ? timeAgo(notif.ts) : ""}</span>
                    {notif.fromName && <span style={{ fontSize: 11, color: TX3 }}>· de {notif.fromName}</span>}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: TX, marginBottom: 4 }}>{notif.titulo}</div>
                <div style={{ fontSize: 13, color: TX2, lineHeight: 1.6 }}>{notif.texto}</div>
                {!notif.leida && notif.id && typeof notif.id === "string" && !notif.id.startsWith("auto_") && (
                    <button onClick={() => onRead(notif.id)} style={{ marginTop: 8, fontSize: 11, color: TX3, background: "transparent", border: "none", cursor: "pointer", padding: "4px 0", textDecoration: "underline" }}>
                        Marcar como leída
                    </button>
                )}
            </div>
        </div>
    );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function NotificationsPanel({ user_id, role, profiles = [] }) {
    const [autoNotifs, setAutoNotifs] = useState([]);
    const [manualNotifs, setManualNotifs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("all");  // all | unread | logros
    const [showCompose, setShowCompose] = useState(false);
    const [composeDest, setComposeDest] = useState("all");
    const [composeTipo, setComposeTipo] = useState("manual");
    const [composeTitulo, setComposeTitulo] = useState("");
    const [composeTexto, setComposeTexto] = useState("");
    const [composeSaving, setComposeSaving] = useState(false);
    const [toast, setToast] = useState(null);

    const toast_ = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 2500); };

    // Cargar notificaciones manuales del usuario + generar auto
    const loadAll = async () => {
        setLoading(true);
        try {
            const [{ data: manuales }, autoGens] = await Promise.all([
                supabase.from("notifications").select("*").eq("user_id", user_id).order("created_at", { ascending: false }).limit(50),
                generateAutoNotifications(user_id),
            ]);

            // Enriquecer manuales con nombre del remitente
            const enriched = (manuales || []).map(m => {
                const sender = profiles.find(p => p.user_id === m.from_id);
                return { ...m, fromName: sender?.full_name || (m.from_id ? "Admin" : null), icono: "📩", tipo: "manual" };
            });

            setManualNotifs(enriched);
            setAutoNotifs(autoGens);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => { if (user_id) loadAll(); }, [user_id]);

    // Marcar como leída
    const markRead = async (id) => {
        await supabase.from("notifications").update({ leida: true }).eq("id", id);
        setManualNotifs(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n));
    };

    // Marcar todas como leídas
    const markAllRead = async () => {
        const unreadIds = manualNotifs.filter(n => !n.leida).map(n => n.id);
        if (!unreadIds.length) return;
        await supabase.from("notifications").update({ leida: true }).in("id", unreadIds);
        setManualNotifs(prev => prev.map(n => ({ ...n, leida: true })));
    };

    // Enviar notificación manual (admin)
    const sendNotification = async () => {
        if (!composeTitulo.trim() || !composeTexto.trim()) { toast_("Completa título y mensaje", false); return; }
        setComposeSaving(true);
        try {
            const targets = composeDest === "all"
                ? profiles.map(p => p.user_id)
                : [composeDest];

            const rows = targets.map(uid => ({
                user_id: uid,
                from_id: user_id,
                tipo: "manual",
                mensaje: JSON.stringify({ titulo: composeTitulo, texto: composeTexto, icono: "📩", tipo: composeTipo }),
                leida: false,
                created_at: new Date().toISOString(),
            }));

            const { error } = await supabase.from("notifications").insert(rows);
            if (error) throw error;
            toast_(`✅ Notificación enviada a ${composeDest === "all" ? profiles.length + " personas" : "1 persona"}`);
            setComposeTitulo(""); setComposeTexto(""); setShowCompose(false);
            loadAll();
        } catch (e) { console.error(e); toast_("❌ Error enviando", false); }
        setComposeSaving(false);
    };

    // Combinar y filtrar notificaciones
    const allNotifs = useMemo(() => {
        // Parsear manuales (mensaje es JSON string)
        const manualesParsed = manualNotifs.map(n => {
            try {
                const d = JSON.parse(n.mensaje);
                return { ...n, titulo: d.titulo, texto: d.texto, icono: d.icono || "📩", tipo: d.tipo || "manual", ts: n.created_at };
            } catch { return { ...n, titulo: "Mensaje", texto: n.mensaje, icono: "📩", tipo: "manual", ts: n.created_at }; }
        });
        const combined = [...autoNotifs, ...manualesParsed];
        if (filter === "unread") return combined.filter(n => !n.leida && !n.id?.toString().startsWith("auto_") || autoNotifs.includes(n));
        if (filter === "logros") return combined.filter(n => n.tipo === "logro" || n.tipo === "motivacion");
        return combined;
    }, [autoNotifs, manualNotifs, filter]);

    const unreadCount = manualNotifs.filter(n => !n.leida).length;
    const hasAuto = autoNotifs.length > 0;

    return (
        <div>
            {/* ── HEADER ── */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <h2 style={{ fontSize: 20, fontWeight: 800, color: TX, margin: 0 }}>🔔 Centro de Notificaciones</h2>
                        {unreadCount > 0 && (
                            <span style={{ background: "#ef4444", color: "#fff", fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 20 }}>
                                {unreadCount} nueva{unreadCount !== 1 ? "s" : ""}
                            </span>
                        )}
                    </div>
                    <div style={{ fontSize: 12, color: TX3, marginTop: 4 }}>Mensajes automáticos del sistema y mensajes de tu equipo</div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {unreadCount > 0 && (
                        <button onClick={markAllRead} style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid #14142a`, background: "transparent", color: TX3, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                            ✓ Marcar todas como leídas
                        </button>
                    )}
                    <button onClick={loadAll} style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid #14142a`, background: "transparent", color: TX3, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                        🔄 Actualizar
                    </button>
                    {role === "admin" && (
                        <button onClick={() => setShowCompose(s => !s)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #6366f133", background: "#6366f118", color: "#818cf8", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                            ✉️ Enviar mensaje
                        </button>
                    )}
                </div>
            </div>

            {/* ── COMPOSE (admin) ── */}
            {role === "admin" && showCompose && (
                <div style={{ background: "#0a0a1a", border: "1px solid #6366f133", borderRadius: 12, padding: 20, marginBottom: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#818cf8", marginBottom: 16 }}>✉️ Enviar notificación motivacional</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
                        <div>
                            <label style={{ display: "block", fontSize: 11, color: TX3, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.8px" }}>Destinatario</label>
                            <select value={composeDest} onChange={e => setComposeDest(e.target.value)} style={{ width: "100%", background: S3, border: BD, borderRadius: 8, padding: "10px 12px", color: TX, fontSize: 13, outline: "none", fontFamily: "inherit" }}>
                                <option value="all">Todo el equipo ({profiles.length})</option>
                                {profiles.map(p => <option key={p.user_id} value={p.user_id}>{p.full_name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: "block", fontSize: 11, color: TX3, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.8px" }}>Tipo</label>
                            <select value={composeTipo} onChange={e => setComposeTipo(e.target.value)} style={{ width: "100%", background: S3, border: BD, borderRadius: 8, padding: "10px 12px", color: TX, fontSize: 13, outline: "none", fontFamily: "inherit" }}>
                                <option value="motivacion">🌟 Motivacional</option>
                                <option value="logro">🏆 Reconocimiento</option>
                                <option value="alerta">⚠️ Recordatorio</option>
                                <option value="info">ℹ️ Informativo</option>
                                <option value="manual">📩 General</option>
                            </select>
                        </div>
                        <div>
                            <label style={{ display: "block", fontSize: 11, color: TX3, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.8px" }}>Título</label>
                            <input value={composeTitulo} onChange={e => setComposeTitulo(e.target.value)} placeholder="Ej: ¡Vamos equipo!" style={{ width: "100%", background: S3, border: BD, borderRadius: 8, padding: "10px 12px", color: TX, fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                        </div>
                    </div>
                    <div style={{ marginBottom: 12 }}>
                        <label style={{ display: "block", fontSize: 11, color: TX3, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.8px" }}>Mensaje</label>
                        <textarea value={composeTexto} onChange={e => setComposeTexto(e.target.value)} placeholder="Escribe aquí tu mensaje motivacional para el equipo..." rows={3} style={{ width: "100%", background: S3, border: BD, borderRadius: 8, padding: "10px 12px", color: TX, fontSize: 13, outline: "none", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} />
                    </div>
                    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                        <button onClick={() => setShowCompose(false)} style={{ padding: "9px 16px", borderRadius: 8, border: BD, background: "transparent", color: TX3, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
                        <button onClick={sendNotification} disabled={composeSaving} style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid #6366f133", background: "#6366f1", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                            {composeSaving ? "Enviando..." : "📤 Enviar"}
                        </button>
                    </div>
                </div>
            )}

            {/* ── FILTROS ── */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                {[
                    { id: "all", label: "Todos" },
                    { id: "unread", label: `No leídos${unreadCount > 0 ? ` (${unreadCount})` : ""}` },
                    { id: "logros", label: "Logros y motivación" },
                ].map(f => (
                    <button key={f.id} onClick={() => setFilter(f.id)}
                        style={{ padding: "7px 14px", borderRadius: 8, border: filter === f.id ? "1px solid #6366f133" : BD, background: filter === f.id ? "#6366f118" : "transparent", color: filter === f.id ? "#818cf8" : TX3, fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.15s" }}>
                        {f.label}
                    </button>
                ))}
            </div>

            {/* ── LISTA ── */}
            {loading ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: TX3, fontSize: 13, gap: 12 }}>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", border: "3px solid #6366f1", borderTopColor: "transparent", animation: "spin 1s linear infinite" }} />
                    Cargando notificaciones...
                    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                </div>
            ) : allNotifs.length === 0 ? (
                <div style={{ background: S2, border: "1px solid #14142a", borderRadius: 12, padding: 40, textAlign: "center", color: TX3 }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>🎉</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: TX }}>Todo al día</div>
                    <div style={{ fontSize: 13, marginTop: 6 }}>No hay notificaciones en esta vista.</div>
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {/* Sección auto (sistema) */}
                    {filter !== "unread" && autoNotifs.length > 0 && (
                        <>
                            <div style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "2px", textTransform: "uppercase", color: TX3, padding: "0 2px", marginTop: 4 }}>
                                💡 Generado automáticamente para ti hoy
                            </div>
                            {autoNotifs.map(n => (
                                <NotifCard key={n.id} notif={{ ...n, leida: false }} onRead={() => { }} />
                            ))}
                        </>
                    )}

                    {/* Sección manuales */}
                    {manualNotifs.length > 0 && (
                        <>
                            <div style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "2px", textTransform: "uppercase", color: TX3, padding: "0 2px", marginTop: 12 }}>
                                ✉️ Mensajes del equipo
                            </div>
                            {manualNotifs.filter(n => {
                                if (filter === "unread") return !n.leida;
                                if (filter === "logros") { try { const d = JSON.parse(n.mensaje); return d.tipo === "logro" || d.tipo === "motivacion"; } catch { return false; } }
                                return true;
                            }).map(n => {
                                let parsed = n;
                                try { const d = JSON.parse(n.mensaje); parsed = { ...n, titulo: d.titulo, texto: d.texto, icono: d.icono || "📩", tipo: d.tipo || "manual", ts: n.created_at }; } catch { }
                                return <NotifCard key={n.id} notif={parsed} onRead={markRead} />;
                            })}
                        </>
                    )}
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div style={{ position: "fixed", bottom: 20, right: 20, background: toast.ok ? "#10b981" : "#dc2626", color: "#fff", padding: "11px 20px", borderRadius: 10, fontSize: 13, fontWeight: 700, zIndex: 999, boxShadow: "0 8px 32px rgba(0,0,0,.5)" }}>
                    {toast.msg}
                </div>
            )}
        </div>
    );
}
