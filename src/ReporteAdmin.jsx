import { useState, useEffect, useMemo, useCallback } from "react";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis,
    PolarRadiusAxis, LineChart, Line, AreaChart, Area,
} from "recharts";
import { supabase } from "./supabaseClient";

// ── CONSTANTS ───────────────────────────────────────────────────────────────
const ACT_TYPES = [
    { id: "llamada", label: "Llamada", icon: "📞", color: "#6366f1" },
    { id: "whatsapp", label: "WhatsApp", icon: "💬", color: "#10b981" },
    { id: "email", label: "Email", icon: "📧", color: "#3b82f6" },
    { id: "propuesta", label: "Propuesta enviada", icon: "📄", color: "#8b5cf6" },
    { id: "reunion", label: "Reunión", icon: "🤝", color: "#f59e0b" },
    { id: "seguimiento", label: "Seguimiento", icon: "🔄", color: "#ef4444" },
];
const LIST_TABS = ["avatar", "circulo", "referidores", "referidos", "facebook"];
const TM_LABELS = {
    avatar: "Entrevistados Avatar",
    circulo: "Círculo de Poder",
    referidores: "Referidores",
    referidos: "Referidos",
    facebook: "Facebook",
};
const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6"];
const ROLE_LBL = { admin: "Admin", team: "Asesor" };
const ROLE_CLR = { admin: "#8b5cf6", team: "#6366f1" };
const CATS = [
    { id: "actividades", label: "Actividades totales", icon: "⚡", color: "#6366f1" },
    { id: "tareas", label: "Tareas completadas", icon: "✅", color: "#10b981" },
    { id: "prospectos", label: "Nuevos prospectos", icon: "👥", color: "#3b82f6" },
    { id: "ventas", label: "Ventas cerradas", icon: "🏆", color: "#f59e0b" },
    { id: "ingresos", label: "Ingresos ($)", icon: "💰", color: "#ec4899" },
];

// Rangos rápidos predefinidos
const QUICK_RANGES = [
    { label: "Esta semana", getDates: () => { const d = new Date(); const mon = new Date(d); mon.setDate(d.getDate() - d.getDay() + 1); const sun = new Date(mon); sun.setDate(mon.getDate() + 6); return [fmtDate(mon), fmtDate(sun)]; } },
    { label: "Este mes", getDates: () => { const d = new Date(); return [`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`, fmtDate(new Date(d.getFullYear(), d.getMonth() + 1, 0))]; } },
    { label: "Mes pasado", getDates: () => { const d = new Date(); const f = new Date(d.getFullYear(), d.getMonth() - 1, 1); const l = new Date(d.getFullYear(), d.getMonth(), 0); return [fmtDate(f), fmtDate(l)]; } },
    { label: "Últimos 7 días", getDates: () => { const e = new Date(); const s = new Date(); s.setDate(e.getDate() - 6); return [fmtDate(s), fmtDate(e)]; } },
    { label: "Últimos 30 días", getDates: () => { const e = new Date(); const s = new Date(); s.setDate(e.getDate() - 29); return [fmtDate(s), fmtDate(e)]; } },
    { label: "Este año", getDates: () => { const y = new Date().getFullYear(); return [`${y}-01-01`, `${y}-12-31`]; } },
];

// ── UTILS ────────────────────────────────────────────────────────────────────
function fmtDate(d) { return d.toISOString().split("T")[0]; }
function fm(v) { return `$${Number(v || 0).toLocaleString("es-MX")}`; }
function pct(v, g) { return g > 0 ? Math.min(Math.round((v / g) * 100), 100) : 0; }
function isClosed(pr) {
    if (!pr.stages) return false;
    // "Pago" para avatar/circulo/referidos/facebook, "Hizo Ventas" para referidores
    return Object.entries(pr.stages).some(([k, v]) => v && (
        k.toLowerCase().includes("pago") || k.toLowerCase().includes("hizo ventas")
    ));
}

// Helper igual que CRM.jsx
function getVentasArr(pr) {
    const v = pr.venta;
    if (Array.isArray(v)) return v.filter(x => x && x.monto);
    if (v?.monto) return [v];
    return [];
}
function rangeLabel(s, e) {
    const fmt = d => new Date(d + "T12:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
    return `${fmt(s)} — ${fmt(e)}`;
}
function daysBetween(s, e) {
    return Math.round((new Date(e) - new Date(s)) / 86400000) + 1;
}
function exportCSV(rows, filename) {
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const lines = [headers.join(","), ...rows.map(r => headers.map(h => `"${r[h] ?? ""}"`).join(","))];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}

// ── STYLES ───────────────────────────────────────────────────────────────────
const S = {
    card: { background: "#0d0d1a", border: "1px solid #14142a", borderRadius: 12, overflow: "hidden" },
    btn: (v, c) => ({ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12, transition: "all .15s", background: v === "primary" ? (c || "#6366f1") : v === "danger" ? "#dc2626" : "#161628", color: "#fff" }),
    inp: { background: "#07070f", border: "1px solid #1a1a2e", borderRadius: 8, padding: "9px 12px", color: "#dde0f0", fontSize: 13, outline: "none", boxSizing: "border-box" },
    lbl: { fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: .5, marginBottom: 5, display: "block" },
    th: { padding: "9px 14px", textAlign: "left", fontSize: 10, color: "#374151", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", borderBottom: "1px solid #14142a", whiteSpace: "nowrap" },
    td: { padding: "10px 14px", borderBottom: "1px solid #0c0c18", verticalAlign: "middle", fontSize: 13 },
    bdg: (c = "#6366f1") => ({ display: "inline-flex", alignItems: "center", padding: "3px 9px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: c + "22", color: c, border: `1px solid ${c}33` }),
    tabBtn: (a, c = "#6366f1") => ({ padding: "9px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12, background: a ? c + "22" : "transparent", color: a ? "#fff" : "#6b7280", borderBottom: a ? `2px solid ${c}` : "2px solid transparent", transition: "all .15s" }),
    ch: { padding: "14px 18px", borderBottom: "1px solid #14142a", display: "flex", justifyContent: "space-between", alignItems: "center" },
    ct: { fontSize: 13, fontWeight: 700, color: "#fff" },
};
const TT = {
    contentStyle: { background: "#0d0d1a", border: "1px solid #1a1a2e", borderRadius: 8, color: "#dde0f0", fontSize: 12 },
    itemStyle: { color: "#dde0f0" },
    labelStyle: { color: "#6b7280", fontWeight: 700 },
};

// ── SUB-COMPONENTS ───────────────────────────────────────────────────────────
function Av({ name, color, size = 30 }) {
    return (
        <div style={{ width: size, height: size, borderRadius: "50%", background: color + "22", border: `2px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.4, fontWeight: 900, color, flexShrink: 0 }}>
            {name?.[0]?.toUpperCase() || "?"}
        </div>
    );
}

function PBar({ value, max, color, height = 6 }) {
    const p = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0;
    return (
        <div style={{ height, borderRadius: 3, background: "#1a1a2e" }}>
            <div style={{ height: "100%", width: `${p}%`, background: color, borderRadius: 3, transition: "width .5s" }} />
        </div>
    );
}

function KpiCard({ label, value, goal, color = "#6366f1", icon, sub }) {
    const p = typeof value === "number" ? pct(value, goal) : 0;
    const hasGoal = goal > 0 && typeof value === "number";
    return (
        <div style={{ ...S.card, padding: 20, borderTop: `3px solid ${color}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, lineHeight: 1.4, maxWidth: "70%" }}>{label}</div>
                <span style={{ fontSize: 22 }}>{icon}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
            {sub && <div style={{ fontSize: 11, color: "#4b5563", marginTop: 4 }}>{sub}</div>}
            {hasGoal && (
                <div style={{ marginTop: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 10, color: "#4b5563" }}>Meta: {goal}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: p >= 100 ? "#10b981" : color }}>{p}%</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 3, background: "#1a1a2e" }}>
                        <div style={{ height: "100%", width: `${p}%`, background: p >= 100 ? "#10b981" : color, borderRadius: 3, transition: "width .5s" }} />
                    </div>
                </div>
            )}
        </div>
    );
}

// ── DATE RANGE PICKER ────────────────────────────────────────────────────────
function DateRangePicker({ startDate, endDate, onChange }) {
    const [open, setOpen] = useState(false);
    return (
        <div style={{ position: "relative" }}>
            <label style={S.lbl}>Rango de fechas</label>
            <button
                onClick={() => setOpen(o => !o)}
                style={{ ...S.inp, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, width: 290, userSelect: "none" }}>
                <span style={{ fontSize: 14 }}>📅</span>
                <span style={{ fontSize: 12, color: "#dde0f0", flex: 1 }}>{rangeLabel(startDate, endDate)}</span>
                <span style={{ fontSize: 10, color: "#374151" }}>▼</span>
            </button>

            {open && (
                <>
                    <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setOpen(false)} />
                    <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, background: "#0d0d1a", border: "1px solid #1a1a2e", borderRadius: 12, zIndex: 100, padding: 18, width: 360, boxShadow: "0 20px 60px rgba(0,0,0,.8)" }}>
                        <div style={{ fontSize: 10, color: "#374151", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>Atajos rápidos</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                            {QUICK_RANGES.map(r => {
                                const [s, e] = r.getDates();
                                const active = s === startDate && e === endDate;
                                return (
                                    <button key={r.label}
                                        style={{ padding: "6px 12px", borderRadius: 6, border: active ? "1px solid #6366f133" : "1px solid transparent", cursor: "pointer", fontSize: 11, fontWeight: 700, background: active ? "#6366f122" : "#161628", color: active ? "#818cf8" : "#9ca3af", transition: "all .15s" }}
                                        onClick={() => { onChange(s, e); setOpen(false); }}>
                                        {r.label}
                                    </button>
                                );
                            })}
                        </div>
                        <div style={{ borderTop: "1px solid #14142a", paddingTop: 14 }}>
                            <div style={{ fontSize: 10, color: "#374151", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>Fechas personalizadas</div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                <div>
                                    <label style={S.lbl}>Desde</label>
                                    <input type="date" style={{ ...S.inp, width: "100%" }} value={startDate} onChange={e => onChange(e.target.value, endDate)} />
                                </div>
                                <div>
                                    <label style={S.lbl}>Hasta</label>
                                    <input type="date" style={{ ...S.inp, width: "100%" }} value={endDate} onChange={e => onChange(startDate, e.target.value)} />
                                </div>
                            </div>
                            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                                <button style={S.btn("primary")} onClick={() => setOpen(false)}>Aplicar ✓</button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

// ── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function ReporteAdmin() {
    const initStart = new Date().toISOString().slice(0, 7) + "-01";
    const initEnd = fmtDate(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0));

    const [profiles, setProfiles] = useState([]);
    const [activities, setActivities] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [prospects, setProspects] = useState([]);
    const [goals, setGoals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState(null);
    const [tab, setTab] = useState("resumen");
    const [selectedUser, setSelectedUser] = useState("all");
    const [startDate, setStartDate] = useState(initStart);
    const [endDate, setEndDate] = useState(initEnd);
    const [compareUsers, setCompareUsers] = useState([]);
    const [editGoals, setEditGoals] = useState({});
    const [search, setSearch] = useState("");

    const toast_ = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 2800); };

    const loadAll = useCallback(async () => {
        setLoading(true);
        try {
            const [pRes, aRes, tRes, prRes, gRes] = await Promise.all([
                supabase.from("profiles").select("user_id, full_name, role"),
                supabase.from("activities").select("*").gte("fecha", startDate).lte("fecha", endDate),
                supabase.from("tasks").select("*").gte("fecha", startDate).lte("fecha", endDate),
                supabase.from("prospects").select("*").gte("created_at", startDate + "T00:00:00").lte("created_at", endDate + "T23:59:59"),
                supabase.from("goals").select("*"),
            ]);
            if (pRes.error) throw pRes.error;
            if (aRes.error) throw aRes.error;
            if (tRes.error) throw tRes.error;
            if (prRes.error) throw prRes.error;
            setProfiles(pRes.data ?? []);  // Incluye admin + team
            setActivities(aRes.data ?? []);
            setTasks(tRes.data ?? []);
            setProspects(prRes.data ?? []);
            setGoals(gRes.data ?? []);
        } catch (e) {
            console.error(e);
            toast_("Error cargando datos", false);
        }
        setLoading(false);
    }, [startDate, endDate]);

    useEffect(() => { loadAll(); }, [loadAll]);

    // ── STATS PER USER ────────────────────────────────────────────────────────
    const userStats = useMemo(() => {
        return profiles.map((p, pi) => {
            const uid = p.user_id;
            const uActs = activities.filter(a => a.owner_id === uid);
            const uTasks = tasks.filter(t => t.owner_id === uid);
            const uPros = prospects.filter(pr => pr.owner_id === uid);

            const totalActs = uActs.reduce((s, a) => s + (Number(a.cantidad) || 1), 0);
            const actByType = Object.fromEntries(ACT_TYPES.map(at => [at.id, uActs.filter(a => a.tipo === at.id).reduce((s, a) => s + (Number(a.cantidad) || 1), 0)]));
            const tasksDone = uTasks.filter(t => t.estado === "completada").length;
            const tasksPend = uTasks.filter(t => t.estado === "pendiente").length;
            const newPros = uPros.length;
            const byTab = Object.fromEntries(LIST_TABS.map(t => [t, uPros.filter(pr => pr.tab === t).length]));
            const closed = uPros.filter(pr => isClosed(pr)).length;
            // Revenue: suma de todos los montos de venta registrados (array o objeto)
            const revenue = uPros.reduce((s, pr) => s + getVentasArr(pr).reduce((ss, v) => ss + Number(v.monto || 0), 0), 0);
            // Número de operaciones de venta registradas (puede diferir de closed por etapas)
            const totalVentas = uPros.reduce((s, pr) => s + getVentasArr(pr).length, 0);
            const convRate = newPros > 0 ? Math.round((closed / newPros) * 100) : 0;
            const ticketProm = totalVentas > 0 ? Math.round(revenue / totalVentas) : 0;

            const stageCounts = {};
            uPros.forEach(pr => {
                if (!pr.stages) return;
                Object.entries(pr.stages).forEach(([stage, done]) => { if (done) stageCounts[stage] = (stageCounts[stage] || 0) + 1; });
            });

            const actByDay = {};
            uActs.forEach(a => { const d = (a.fecha || "").slice(0, 10); if (d) actByDay[d] = (actByDay[d] || 0) + (Number(a.cantidad) || 1); });

            const periodo = startDate.slice(0, 7);
            const uGoals = goals.filter(g => g.user_id === uid && g.periodo === periodo);
            const getGoal = cat => Number(uGoals.find(g => g.categoria === cat)?.meta || 0);

            return {
                userId: uid, name: p.full_name || uid, role: p.role || "team",
                color: COLORS[pi % COLORS.length],
                totalActs, actByType, tasksDone, tasksPend,
                newPros, byTab, closed, totalVentas, revenue, convRate, ticketProm,
                stageCounts, actByDay,
                goals: { actividades: getGoal("actividades"), tareas: getGoal("tareas"), prospectos: getGoal("prospectos"), ventas: getGoal("ventas"), ingresos: getGoal("ingresos") },
            };
        });
    }, [profiles, activities, tasks, prospects, goals, startDate]);

    const filteredStats = useMemo(() => {
        let s = selectedUser === "all" ? userStats : userStats.filter(u => u.userId === selectedUser);
        if (search.trim()) s = s.filter(u => u.name.toLowerCase().includes(search.toLowerCase()));
        return s;
    }, [userStats, selectedUser, search]);

    const totals = useMemo(() => filteredStats.reduce((acc, u) => ({
        totalActs: acc.totalActs + u.totalActs,
        tasksDone: acc.tasksDone + u.tasksDone,
        newPros: acc.newPros + u.newPros,
        closed: acc.closed + u.closed,
        revenue: acc.revenue + u.revenue,
        goalActs: acc.goalActs + u.goals.actividades,
        goalTareas: acc.goalTareas + u.goals.tareas,
        goalPros: acc.goalPros + u.goals.prospectos,
        goalVentas: acc.goalVentas + u.goals.ventas,
    }), { totalActs: 0, tasksDone: 0, newPros: 0, closed: 0, revenue: 0, goalActs: 0, goalTareas: 0, goalPros: 0, goalVentas: 0 }),
        [filteredStats]);

    const dailyTrend = useMemo(() => {
        const map = {};
        filteredStats.forEach(u => {
            Object.entries(u.actByDay).forEach(([d, v]) => { map[d] = (map[d] || 0) + v; });
        });
        return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([fecha, total]) => ({
            fecha: new Date(fecha + "T12:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short" }),
            Actividades: total,
        }));
    }, [filteredStats]);

    const saveGoal = async (userId, categoria, meta) => {
        setSaving(true);
        try {
            const periodo = startDate.slice(0, 7);
            const { error } = await supabase.from("goals").upsert(
                { user_id: userId, periodo, categoria, meta: Number(meta) || 0, updated_at: new Date().toISOString() },
                { onConflict: "user_id,periodo,categoria" }
            );
            if (error) throw error;
            const { data } = await supabase.from("goals").select("*");
            setGoals(data ?? []);
            toast_("✅ Meta guardada");
        } catch (e) { console.error(e); toast_("Error guardando meta", false); }
        setSaving(false);
    };

    // Chart data
    const actByTypeChart = ACT_TYPES.map(at => { const row = { tipo: at.label }; filteredStats.forEach(u => { row[u.name] = u.actByType[at.id] || 0; }); return row; });
    const radarData = ACT_TYPES.map(at => { const row = { tipo: at.label.slice(0, 9) }; filteredStats.forEach(u => { row[u.name] = u.actByType[at.id] || 0; }); return row; });
    const prosByTabChart = LIST_TABS.map(t => { const row = { lista: TM_LABELS[t].slice(0, 12) }; filteredStats.forEach(u => { row[u.name] = u.byTab[t] || 0; }); return row; });
    const revenueChart = filteredStats.map(u => ({ name: u.name, Ingresos: u.revenue, Ventas: u.closed }));
    const rankingActs = [...filteredStats].sort((a, b) => b.totalActs - a.totalActs);
    const rankingRevenue = [...filteredStats].sort((a, b) => b.revenue - a.revenue);
    const rankingPros = [...filteredStats].sort((a, b) => b.newPros - a.newPros);

    const TABS = [
        { id: "resumen", label: "📊 Resumen" },
        { id: "actividades", label: "⚡ Actividades" },
        { id: "prospectos", label: "👥 Prospectos" },
        { id: "ingresos", label: "💰 Ingresos" },
        { id: "comparativo", label: "🏆 Comparativo" },
        { id: "metas", label: "🎯 Metas" },
    ];

    const dias = daysBetween(startDate, endDate);

    if (loading) return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, flexDirection: "column", gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid #6366f1", borderTopColor: "transparent", animation: "spin 1s linear infinite" }} />
            <div style={{ color: "#6b7280", fontSize: 13 }}>Cargando reporte...</div>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    );

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* ── FILTROS ── */}
            <div style={{ background: "#0d0d1a", padding: 18, borderRadius: 12, border: "1px solid #14142a", display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
                <DateRangePicker startDate={startDate} endDate={endDate} onChange={(s, e) => { setStartDate(s); setEndDate(e); }} />

                <div>
                    <label style={S.lbl}>Asesor</label>
                    <select style={{ ...S.inp, width: 210 }} value={selectedUser} onChange={e => setSelectedUser(e.target.value)}>
                        <option value="all">Todos ({profiles.length})</option>
                        {profiles.map(p => (
                            <option key={p.user_id} value={p.user_id}>{p.full_name}{p.role === "admin" ? " (Admin)" : ""}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label style={S.lbl}>Buscar nombre</label>
                    <input style={{ ...S.inp, width: 150 }} placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>

                <button style={{ ...S.btn("secondary"), marginBottom: 1 }} onClick={loadAll}>🔄 Actualizar</button>

                <div style={{ marginLeft: "auto", textAlign: "right" }}>
                    <div style={{ fontSize: 10, color: "#374151", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Período activo</div>
                    <div style={{ fontSize: 13, color: "#fff", fontWeight: 900, marginTop: 2 }}>{rangeLabel(startDate, endDate)}</div>
                    <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>{dias} días · {filteredStats.length} persona{filteredStats.length !== 1 ? "s" : ""}</div>
                </div>
            </div>

            {/* ── TABS ── */}
            <div style={{ display: "flex", gap: 2, borderBottom: "1px solid #14142a", flexWrap: "wrap" }}>
                {TABS.map(t => (
                    <button key={t.id} style={S.tabBtn(tab === t.id)} onClick={() => setTab(t.id)}>{t.label}</button>
                ))}
            </div>

            {/* ════════════ RESUMEN ════════════ */}
            {tab === "resumen" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14 }}>
                        <KpiCard label="Actividades" value={totals.totalActs} icon="⚡" color="#6366f1" goal={totals.goalActs} />
                        <KpiCard label="Tareas completadas" value={totals.tasksDone} icon="✅" color="#10b981" goal={totals.goalTareas} />
                        <KpiCard label="Nuevos prospectos" value={totals.newPros} icon="👥" color="#3b82f6" goal={totals.goalPros} />
                        <KpiCard label="Ventas cerradas" value={totals.closed} icon="🏆" color="#f59e0b" goal={totals.goalVentas} />
                        <KpiCard label="Ingresos generados" value={fm(totals.revenue)} icon="💰" color="#ec4899"
                            sub={`${totals.closed} cierres · ticket prom. ${totals.closed > 0 ? fm(Math.round(totals.revenue / totals.closed)) : "$0"}`} />
                    </div>

                    {dailyTrend.length > 1 && (
                        <div style={S.card}>
                            <div style={S.ch}>
                                <span style={S.ct}>📈 Tendencia de actividades en el período</span>
                                <span style={{ fontSize: 11, color: "#374151" }}>{dias} días</span>
                            </div>
                            <div style={{ padding: 20, height: 220 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={dailyTrend}>
                                        <defs>
                                            <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#14142a" />
                                        <XAxis dataKey="fecha" tick={{ fill: "#6b7280", fontSize: 10 }} />
                                        <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} />
                                        <Tooltip {...TT} />
                                        <Area type="monotone" dataKey="Actividades" stroke="#6366f1" fill="url(#aGrad)" strokeWidth={2} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    <div style={S.card}>
                        <div style={S.ch}>
                            <span style={S.ct}>Resumen por persona</span>
                            <button style={S.btn("secondary")} onClick={() => exportCSV(
                                filteredStats.map(u => ({ Nombre: u.name, Rol: ROLE_LBL[u.role] || u.role, Actividades: u.totalActs, "Tareas ✅": u.tasksDone, Prospectos: u.newPros, Ventas: u.closed, Ingresos: u.revenue, "Conversión %": u.convRate, "Ticket Prom.": u.ticketProm })),
                                `reporte-${startDate}-${endDate}.csv`
                            )}>⬇️ Exportar CSV</button>
                        </div>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                                <tr>{["Nombre", "Rol", "Actividades", "Tareas ✅", "Prospectos", "Ventas", "Ingresos", "Conversión", "Ticket prom."].map(h => (
                                    <th key={h} style={S.th}>{h}</th>
                                ))}</tr>
                            </thead>
                            <tbody>
                                {filteredStats.map(u => (
                                    <tr key={u.userId}>
                                        <td style={S.td}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                <Av name={u.name} color={u.color} />
                                                <span style={{ fontWeight: 700, color: "#fff" }}>{u.name}</span>
                                            </div>
                                        </td>
                                        <td style={S.td}><span style={S.bdg(ROLE_CLR[u.role] || "#6366f1")}>{ROLE_LBL[u.role] || u.role}</span></td>
                                        <td style={S.td}><span style={{ fontWeight: 700, color: "#6366f1" }}>{u.totalActs}</span>{u.goals.actividades > 0 && <span style={{ fontSize: 10, color: "#374151", marginLeft: 5 }}>/{u.goals.actividades}</span>}</td>
                                        <td style={S.td}><span style={{ color: "#10b981", fontWeight: 700 }}>{u.tasksDone}</span></td>
                                        <td style={S.td}>{u.newPros}</td>
                                        <td style={S.td}><span style={{ color: "#f59e0b", fontWeight: 700 }}>{u.closed}</span></td>
                                        <td style={S.td}><span style={{ color: "#ec4899", fontWeight: 700 }}>{fm(u.revenue)}</span></td>
                                        <td style={S.td}><span style={S.bdg(u.convRate >= 30 ? "#10b981" : u.convRate >= 15 ? "#f59e0b" : "#ef4444")}>{u.convRate}%</span></td>
                                        <td style={S.td}>{fm(u.ticketProm)}</td>
                                    </tr>
                                ))}
                                {filteredStats.length === 0 && (
                                    <tr><td colSpan={9} style={{ ...S.td, textAlign: "center", color: "#374151", padding: 32 }}>Sin datos para este período</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
                        {[
                            { title: "🏆 Top Actividades", data: rankingActs, key: "totalActs", color: "#6366f1", fmt: v => v },
                            { title: "👥 Top Prospectos", data: rankingPros, key: "newPros", color: "#3b82f6", fmt: v => v },
                            { title: "💰 Top Ingresos", data: rankingRevenue, key: "revenue", color: "#ec4899", fmt: fm },
                        ].map(({ title, data, key, color, fmt }) => (
                            <div key={title} style={S.card}>
                                <div style={S.ch}><span style={S.ct}>{title}</span></div>
                                <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                                    {data.map((u, i) => (
                                        <div key={u.userId} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                            <span style={{ fontSize: 18, width: 24, textAlign: "center" }}>{["🥇", "🥈", "🥉"][i] || `#${i + 1}`}</span>
                                            <Av name={u.name} color={u.color} />
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: 13, color: "#dde0f0" }}>{u.name}</div>
                                                <span style={S.bdg(ROLE_CLR[u.role] || "#6366f1")}>{ROLE_LBL[u.role] || u.role}</span>
                                            </div>
                                            <span style={{ fontWeight: 900, color, fontSize: 14 }}>{fmt(u[key])}</span>
                                        </div>
                                    ))}
                                    {data.length === 0 && <div style={{ color: "#374151", textAlign: "center", padding: 16 }}>Sin datos</div>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ════════════ ACTIVIDADES ════════════ */}
            {tab === "actividades" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 14 }}>
                        {filteredStats.map(u => (
                            <div key={u.userId} style={{ ...S.card, borderLeft: `4px solid ${u.color}` }}>
                                <div style={{ padding: "14px 18px", borderBottom: "1px solid #14142a", display: "flex", alignItems: "center", gap: 8 }}>
                                    <Av name={u.name} color={u.color} />
                                    <div>
                                        <div style={{ fontWeight: 800, color: "#fff", fontSize: 13 }}>{u.name}</div>
                                        <span style={S.bdg(ROLE_CLR[u.role] || "#6366f1")}>{ROLE_LBL[u.role] || u.role}</span>
                                    </div>
                                </div>
                                <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                                    {ACT_TYPES.map(at => (
                                        <div key={at.id}>
                                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                                                <span style={{ fontSize: 12, color: "#9ca3af" }}>{at.icon} {at.label}</span>
                                                <span style={{ fontWeight: 700, color: at.color }}>{u.actByType[at.id] || 0}</span>
                                            </div>
                                            <PBar value={u.actByType[at.id] || 0} max={Math.max(...filteredStats.map(x => x.actByType[at.id] || 0), 1)} color={at.color} />
                                        </div>
                                    ))}
                                    <div style={{ borderTop: "1px solid #14142a", paddingTop: 10, marginTop: 4, display: "flex", justifyContent: "space-between" }}>
                                        <span style={{ fontSize: 12, color: "#6b7280" }}>Total</span>
                                        <span style={{ fontWeight: 900, color: "#fff", fontSize: 18 }}>{u.totalActs}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div style={S.card}>
                        <div style={S.ch}><span style={S.ct}>Actividades por tipo y persona</span></div>
                        <div style={{ padding: 20, height: 300 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={actByTypeChart}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#14142a" />
                                    <XAxis dataKey="tipo" tick={{ fill: "#6b7280", fontSize: 11 }} />
                                    <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} />
                                    <Tooltip {...TT} /><Legend />
                                    {filteredStats.map(u => <Bar key={u.userId} dataKey={u.name} fill={u.color} radius={[4, 4, 0, 0]} />)}
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {filteredStats.length > 0 && (
                        <div style={S.card}>
                            <div style={S.ch}><span style={S.ct}>Radar de actividades</span></div>
                            <div style={{ padding: 20, height: 300 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart data={radarData}>
                                        <PolarGrid stroke="#14142a" />
                                        <PolarAngleAxis dataKey="tipo" tick={{ fill: "#6b7280", fontSize: 11 }} />
                                        <PolarRadiusAxis tick={{ fill: "#374151", fontSize: 9 }} />
                                        {filteredStats.map(u => <Radar key={u.userId} name={u.name} dataKey={u.name} stroke={u.color} fill={u.color} fillOpacity={0.2} />)}
                                        <Legend /><Tooltip {...TT} />
                                    </RadarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ════════════ PROSPECTOS ════════════ */}
            {tab === "prospectos" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
                        <KpiCard label="Nuevos prospectos" value={totals.newPros} icon="👥" color="#3b82f6" goal={totals.goalPros} />
                        <KpiCard label="Ventas cerradas" value={totals.closed} icon="🏆" color="#f59e0b" />
                        <KpiCard label="Tasa de cierre" value={`${totals.newPros > 0 ? Math.round(totals.closed / totals.newPros * 100) : 0}%`} icon="📈" color="#10b981" />
                        <KpiCard label="Total en pipeline" value={prospects.length} icon="🔄" color="#8b5cf6" />
                    </div>

                    <div style={S.card}>
                        <div style={S.ch}><span style={S.ct}>Nuevos prospectos por lista</span></div>
                        <div style={{ padding: 20, height: 280 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={prosByTabChart}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#14142a" />
                                    <XAxis dataKey="lista" tick={{ fill: "#6b7280", fontSize: 10 }} />
                                    <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} />
                                    <Tooltip {...TT} /><Legend />
                                    {filteredStats.map(u => <Bar key={u.userId} dataKey={u.name} fill={u.color} radius={[4, 4, 0, 0]} />)}
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 14 }}>
                        {filteredStats.map(u => {
                            const entries = Object.entries(u.stageCounts).sort((a, b) => b[1] - a[1]);
                            const maxV = Math.max(...entries.map(([, v]) => v), 1);
                            return (
                                <div key={u.userId} style={S.card}>
                                    <div style={{ padding: "14px 18px", borderBottom: "1px solid #14142a", display: "flex", alignItems: "center", gap: 8 }}>
                                        <Av name={u.name} color={u.color} />
                                        <span style={S.ct}>Embudo — {u.name}</span>
                                    </div>
                                    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                                        {entries.length === 0 && <div style={{ color: "#374151", textAlign: "center", padding: 20 }}>Sin movimientos en este período</div>}
                                        {entries.map(([stage, count]) => (
                                            <div key={stage}>
                                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                                    <span style={{ fontSize: 12, color: "#9ca3af" }}>{stage}</span>
                                                    <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{count}</span>
                                                </div>
                                                <PBar value={count} max={maxV} color={u.color} height={7} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ════════════ INGRESOS ════════════ */}
            {tab === "ingresos" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
                        <KpiCard label="Ingresos totales" value={fm(totals.revenue)} icon="💰" color="#ec4899" />
                        <KpiCard label="Ventas cerradas" value={totals.closed} icon="🏆" color="#f59e0b" goal={totals.goalVentas} />
                        <KpiCard label="Ticket promedio" value={fm(totals.closed > 0 ? Math.round(totals.revenue / totals.closed) : 0)} icon="🎫" color="#10b981" />
                        <KpiCard label="Tasa de cierre" value={`${totals.newPros > 0 ? Math.round(totals.closed / totals.newPros * 100) : 0}%`} icon="📈" color="#6366f1" />
                    </div>

                    <div style={S.card}>
                        <div style={S.ch}><span style={S.ct}>Ingresos y ventas por persona</span></div>
                        <div style={{ padding: 20, height: 280 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={revenueChart}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#14142a" />
                                    <XAxis dataKey="name" tick={{ fill: "#6b7280", fontSize: 11 }} />
                                    <YAxis yAxisId="left" tick={{ fill: "#6b7280", fontSize: 11 }} />
                                    <YAxis yAxisId="right" orientation="right" tick={{ fill: "#6b7280", fontSize: 11 }} />
                                    <Tooltip {...TT} formatter={(v, name) => [name === "Ingresos" ? fm(v) : v, name]} />
                                    <Legend />
                                    <Bar yAxisId="left" dataKey="Ingresos" fill="#ec4899" radius={[4, 4, 0, 0]} />
                                    <Bar yAxisId="right" dataKey="Ventas" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div style={S.card}>
                        <div style={S.ch}>
                            <span style={S.ct}>Detalle de ventas cerradas</span>
                            <button style={S.btn("secondary")} onClick={() => exportCSV(
                                prospects.filter(pr => pr.venta?.monto).map(pr => {
                                    const owner = profiles.find(p => p.user_id === pr.owner_id);
                                    return { Nombre: owner?.full_name || "—", Rol: owner?.role || "—", Prospecto: pr.data?.nombre || "—", Servicio: pr.venta?.servicio || "—", Monto: pr.venta?.monto, Plazo: pr.venta?.plazo, Total: Number(pr.venta?.monto || 0) * Number(pr.venta?.plazo || 1), Fecha: pr.venta?.fechaInicio || "—" };
                                }),
                                `ventas-${startDate}-${endDate}.csv`
                            )}>⬇️ Exportar CSV</button>
                        </div>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                                <tr>{["Persona", "Rol", "Prospecto", "Servicio", "Monto", "Plazo", "Total contrato", "Fecha inicio"].map(h => (
                                    <th key={h} style={S.th}>{h}</th>
                                ))}</tr>
                            </thead>
                            <tbody>
                                {prospects.filter(pr => pr.venta?.monto).map(pr => {
                                    const owner = profiles.find(p => p.user_id === pr.owner_id);
                                    const pi_ = profiles.indexOf(owner);
                                    const total = Number(pr.venta.monto) * Number(pr.venta.plazo || 1);
                                    return (
                                        <tr key={pr.id}>
                                            <td style={S.td}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                    {owner && <Av name={owner.full_name} color={COLORS[pi_ % COLORS.length]} />}
                                                    <span style={{ color: "#fff", fontWeight: 600 }}>{owner?.full_name || "—"}</span>
                                                </div>
                                            </td>
                                            <td style={S.td}><span style={S.bdg(ROLE_CLR[owner?.role] || "#6366f1")}>{ROLE_LBL[owner?.role] || "—"}</span></td>
                                            <td style={S.td}>{pr.data?.nombre || "—"}</td>
                                            <td style={S.td}><span style={{ color: "#9ca3af" }}>{pr.venta.servicio || "—"}</span></td>
                                            <td style={S.td}>{fm(pr.venta.monto)}</td>
                                            <td style={S.td}>{pr.venta.plazo || 1} meses</td>
                                            <td style={S.td}><span style={{ color: "#ec4899", fontWeight: 700 }}>{fm(total)}</span></td>
                                            <td style={S.td}><span style={{ color: "#6b7280" }}>{pr.venta.fechaInicio || "—"}</span></td>
                                        </tr>
                                    );
                                })}
                                {prospects.filter(pr => pr.venta?.monto).length === 0 && (
                                    <tr><td colSpan={8} style={{ ...S.td, textAlign: "center", color: "#374151", padding: 28 }}>Sin ventas en este período</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ════════════ COMPARATIVO ════════════ */}
            {tab === "comparativo" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                    <div style={{ ...S.card, padding: 18 }}>
                        <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700, marginBottom: 12 }}>Selecciona personas a comparar (mínimo 2)</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {profiles.map((p, i) => {
                                const active = compareUsers.includes(p.user_id);
                                return (
                                    <button key={p.user_id}
                                        style={{ ...S.btn(active ? "primary" : "secondary", active ? COLORS[i % COLORS.length] : undefined), display: "flex", alignItems: "center", gap: 6 }}
                                        onClick={() => setCompareUsers(prev => prev.includes(p.user_id) ? prev.filter(x => x !== p.user_id) : [...prev, p.user_id])}>
                                        {active ? "✓ " : ""}{p.full_name}{p.role === "admin" ? " 👑" : ""}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {compareUsers.length < 2 ? (
                        <div style={{ ...S.card, padding: 40, textAlign: "center", color: "#374151" }}>Selecciona al menos 2 personas para comparar</div>
                    ) : (() => {
                        const cUsers = userStats.filter(u => compareUsers.includes(u.userId));
                        const metrics = [
                            { key: "totalActs", label: "Actividades", color: "#6366f1", fmt: v => v },
                            { key: "tasksDone", label: "Tareas completadas", color: "#10b981", fmt: v => v },
                            { key: "newPros", label: "Nuevos prospectos", color: "#3b82f6", fmt: v => v },
                            { key: "closed", label: "Ventas cerradas", color: "#f59e0b", fmt: v => v },
                            { key: "revenue", label: "Ingresos", color: "#ec4899", fmt: fm },
                            { key: "convRate", label: "Conversión %", color: "#8b5cf6", fmt: v => `${v}%` },
                        ];
                        return (
                            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                                {metrics.map(m => {
                                    const maxV = Math.max(...cUsers.map(u => u[m.key]), 1);
                                    return (
                                        <div key={m.key} style={S.card}>
                                            <div style={S.ch}><span style={S.ct}>{m.label}</span></div>
                                            <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
                                                {cUsers.map(u => (
                                                    <div key={u.userId}>
                                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, alignItems: "center" }}>
                                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                                <Av name={u.name} color={u.color} />
                                                                <span style={{ fontSize: 13, color: "#dde0f0" }}>{u.name}</span>
                                                                <span style={S.bdg(ROLE_CLR[u.role] || "#6366f1")}>{ROLE_LBL[u.role] || u.role}</span>
                                                            </div>
                                                            <span style={{ fontWeight: 900, color: m.color, fontSize: 16 }}>{m.fmt(u[m.key])}</span>
                                                        </div>
                                                        <PBar value={u[m.key]} max={maxV} color={u.color} height={10} />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* ════════════ METAS ════════════ */}
            {tab === "metas" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                    <div style={{ background: "#07070f", borderRadius: 10, padding: "12px 16px", border: "1px solid #1a1a2e", fontSize: 12, color: "#6b7280" }}>
                        💡 Las metas se guardan por <strong style={{ color: "#dde0f0" }}>mes</strong> — se usa el mes del inicio del rango seleccionado (<strong style={{ color: "#818cf8" }}>{startDate.slice(0, 7)}</strong>)
                    </div>

                    {profiles.length === 0 && (
                        <div style={{ ...S.card, padding: 40, textAlign: "center", color: "#374151" }}>No hay usuarios registrados</div>
                    )}

                    {profiles.map((p, pi) => {
                        const uStats = userStats.find(u => u.userId === p.user_id);
                        return (
                            <div key={p.user_id} style={S.card}>
                                <div style={{ padding: "16px 20px", borderBottom: "1px solid #14142a", display: "flex", alignItems: "center", gap: 10 }}>
                                    <Av name={p.full_name} color={COLORS[pi % COLORS.length]} />
                                    <span style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>{p.full_name}</span>
                                    <span style={S.bdg(ROLE_CLR[p.role] || "#6366f1")}>{ROLE_LBL[p.role] || p.role}</span>
                                </div>
                                <div style={{ padding: 20, display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14 }}>
                                    {CATS.map(c => {
                                        const key = `${p.user_id}_${c.id}`;
                                        const currentGoal = uStats?.goals[c.id] || 0;
                                        const currentVal = c.id === "actividades" ? (uStats?.totalActs || 0) : c.id === "tareas" ? (uStats?.tasksDone || 0) : c.id === "prospectos" ? (uStats?.newPros || 0) : c.id === "ventas" ? (uStats?.closed || 0) : (uStats?.revenue || 0);
                                        const inputVal = editGoals[key] !== undefined ? editGoals[key] : currentGoal;
                                        const p_ = pct(currentVal, currentGoal);
                                        const fmtVal = c.id === "ingresos" ? fm(currentVal) : currentVal;
                                        return (
                                            <div key={c.id} style={{ background: "#07070f", borderRadius: 10, padding: 16, border: `1px solid ${c.color}22`, display: "flex", flexDirection: "column", gap: 8 }}>
                                                <div style={{ fontSize: 22 }}>{c.icon}</div>
                                                <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 700 }}>{c.label}</div>
                                                <div style={{ fontSize: 22, fontWeight: 900, color: c.color, lineHeight: 1 }}>{fmtVal}</div>
                                                <div style={{ fontSize: 9, color: "#374151" }}>actual en período</div>
                                                <label style={{ ...S.lbl, fontSize: 10, marginBottom: 2 }}>Meta del mes</label>
                                                <input type="number" min="0" style={{ ...S.inp, fontSize: 12, padding: "7px 10px" }} value={inputVal}
                                                    onChange={e => setEditGoals(prev => ({ ...prev, [key]: e.target.value }))} />
                                                {currentGoal > 0 && (
                                                    <div>
                                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                                                            <span style={{ fontSize: 9, color: "#374151" }}>Progreso</span>
                                                            <span style={{ fontSize: 9, fontWeight: 700, color: p_ >= 100 ? "#10b981" : c.color }}>{p_}%</span>
                                                        </div>
                                                        <PBar value={currentVal} max={currentGoal} color={p_ >= 100 ? "#10b981" : c.color} height={5} />
                                                    </div>
                                                )}
                                                <button style={{ ...S.btn("primary", c.color), padding: "7px 0", fontSize: 11, marginTop: 4 }} disabled={saving}
                                                    onClick={() => saveGoal(p.user_id, c.id, inputVal)}>
                                                    {saving ? "..." : "Guardar"}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {toast && (
                <div style={{ position: "fixed", bottom: 20, right: 20, background: toast.ok ? "#10b981" : "#dc2626", color: "#fff", padding: "11px 20px", borderRadius: 10, fontSize: 13, fontWeight: 700, zIndex: 300, boxShadow: "0 8px 32px rgba(0,0,0,.5)" }}>
                    {toast.msg}
                </div>
            )}
        </div>
    );
}
