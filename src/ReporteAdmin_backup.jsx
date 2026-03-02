import { useState, useEffect, useMemo } from "react";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis,
    PolarRadiusAxis, LineChart, Line
} from "recharts";
import { supabase } from "./supabaseClient";

// ── CONSTANTS ──────────────────────────────────────────────────────────────
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
const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6", "#ec4899"];
const CATS = [
    { id: "actividades", label: "Actividades totales", icon: "⚡", color: "#6366f1", fmt: v => v },
    { id: "tareas", label: "Tareas completadas", icon: "✅", color: "#10b981", fmt: v => v },
    { id: "prospectos", label: "Nuevos prospectos", icon: "👥", color: "#3b82f6", fmt: v => v },
    { id: "ventas", label: "Ventas cerradas", icon: "🏆", color: "#f59e0b", fmt: v => v },
    { id: "ingresos", label: "Ingresos ($)", icon: "💰", color: "#ec4899", fmt: fm },
];

// ── UTILS ──────────────────────────────────────────────────────────────────
function fm(v) { return v ? `$${Number(v).toLocaleString("es-MX")}` : "$0"; }
function pct(v, goal) { return goal > 0 ? Math.min(Math.round((v / goal) * 100), 100) : 0; }
function monthLabel(periodo) {
    return new Date(periodo + "-15").toLocaleDateString("es-MX", { month: "long", year: "numeric" });
}
function getDaysInMonth(periodo) {
    const [y, m] = periodo.split("-").map(Number);
    return new Date(y, m, 0).getDate();
}
function endOfMonth(periodo) {
    const [y, m] = periodo.split("-").map(Number);
    return new Date(y, m, 0).toISOString().split("T")[0];
}
function isClosed(pr) {
    if (!pr.stages) return false;
    return Object.entries(pr.stages).some(([k, v]) => k.toLowerCase().includes("pago") && v);
}

// ── STYLES ─────────────────────────────────────────────────────────────────
const S = {
    card: { background: "#0d0d1a", border: "1px solid #14142a", borderRadius: 12, overflow: "hidden" },
    btn: (v, c) => ({
        padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
        fontWeight: 700, fontSize: 12, transition: "opacity .15s",
        background: v === "primary" ? (c || "#6366f1") : v === "danger" ? "#dc2626" : "#161628",
        color: "#fff",
    }),
    inp: {
        background: "#07070f", border: "1px solid #1a1a2e", borderRadius: 8,
        padding: "9px 12px", color: "#dde0f0", fontSize: 13, outline: "none", boxSizing: "border-box",
    },
    lbl: { fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: .5, marginBottom: 5, display: "block" },
    th: { padding: "9px 14px", textAlign: "left", fontSize: 10, color: "#374151", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", borderBottom: "1px solid #14142a", whiteSpace: "nowrap" },
    td: { padding: "10px 14px", borderBottom: "1px solid #0c0c18", verticalAlign: "middle", fontSize: 13 },
    bdg: (c = "#6366f1") => ({ display: "inline-flex", alignItems: "center", padding: "3px 9px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: c + "22", color: c, border: `1px solid ${c}33` }),
    tabBtn: (a, c = "#6366f1") => ({
        padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700,
        fontSize: 12, background: a ? c + "22" : "transparent", color: a ? "#fff" : "#6b7280",
        borderBottom: a ? `2px solid ${c}` : "2px solid transparent", transition: "all .15s",
    }),
    ch: { padding: "14px 18px", borderBottom: "1px solid #14142a", display: "flex", justifyContent: "space-between", alignItems: "center" },
    ct: { fontSize: 13, fontWeight: 700, color: "#fff" },
};

const TOOLTIP_STYLE = {
    contentStyle: { background: "#0d0d1a", border: "1px solid #1a1a2e", borderRadius: 8, color: "#dde0f0", fontSize: 12 },
    itemStyle: { color: "#dde0f0" },
    labelStyle: { color: "#6b7280", fontWeight: 700 },
};

// ── SUB-COMPONENTS ──────────────────────────────────────────────────────────
function Avatar({ name, color }) {
    return (
        <div style={{
            width: 30, height: 30, borderRadius: "50%",
            background: color + "22", border: `2px solid ${color}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 900, color, flexShrink: 0,
        }}>
            {name?.[0]?.toUpperCase() || "?"}
        </div>
    );
}

function KpiCard({ label, value, goal, color = "#6366f1", icon, sub }) {
    const p = typeof value === "number" ? pct(value, goal) : 0;
    const hasGoal = goal > 0 && typeof value === "number";
    return (
        <div style={{ ...S.card, padding: 20, borderTop: `3px solid ${color}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, lineHeight: 1.4 }}>{label}</div>
                <span style={{ fontSize: 22 }}>{icon}</span>
            </div>
            <div style={{ fontSize: 30, fontWeight: 900, color, lineHeight: 1 }}>{typeof value === "number" ? value : value}</div>
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

function PBar({ value, max, color, height = 6 }) {
    const p = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0;
    return (
        <div style={{ height, borderRadius: 3, background: "#1a1a2e" }}>
            <div style={{ height: "100%", width: `${p}%`, background: color, borderRadius: 3, transition: "width .5s" }} />
        </div>
    );
}

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────
export default function ReporteAdmin() {
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
    const [periodo, setPeriodo] = useState(new Date().toISOString().slice(0, 7));
    const [compareUsers, setCompareUsers] = useState([]);
    const [editGoals, setEditGoals] = useState({});

    const startDate = periodo + "-01";
    const endDate = endOfMonth(periodo);

    const toast_ = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 2800); };

    // ── LOAD ───────────────────────────────────────────────────────────────────
    const loadAll = async () => {
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
            // goals error is non-blocking (table might be empty)

            setProfiles((pRes.data ?? []).filter(p => p.role !== "admin"));
            setActivities(aRes.data ?? []);
            setTasks(tRes.data ?? []);
            setProspects(prRes.data ?? []);
            setGoals(gRes.data ?? []);
        } catch (e) {
            console.error(e);
            toast_("Error cargando datos del reporte", false);
        }
        setLoading(false);
    };

    useEffect(() => { loadAll(); }, [periodo]);

    // ── STATS PER USER ─────────────────────────────────────────────────────────
    const userStats = useMemo(() => {
        return profiles.map((p, pi) => {
            const uid = p.user_id;

            const uActs = activities.filter(a => a.owner_id === uid);
            const uTasks = tasks.filter(t => t.owner_id === uid);
            const uProspects = prospects.filter(pr => pr.owner_id === uid);

            const totalActs = uActs.reduce((s, a) => s + (Number(a.cantidad) || 1), 0);
            const actByType = Object.fromEntries(
                ACT_TYPES.map(at => [at.id, uActs.filter(a => a.tipo === at.id).reduce((s, a) => s + (Number(a.cantidad) || 1), 0)])
            );
            const tasksDone = uTasks.filter(t => t.estado === "completada").length;
            const tasksPending = uTasks.filter(t => t.estado === "pendiente").length;
            const newProspects = uProspects.length;
            const byTab = Object.fromEntries(LIST_TABS.map(t => [t, uProspects.filter(pr => pr.tab === t).length]));
            const closed = uProspects.filter(pr => isClosed(pr)).length;
            const revenue = uProspects
                .filter(pr => pr.venta?.monto)
                .reduce((s, pr) => s + Number(pr.venta.monto) * Number(pr.venta.plazo || 1), 0);
            const convRate = newProspects > 0 ? Math.round((closed / newProspects) * 100) : 0;
            const ticketProm = closed > 0 ? Math.round(revenue / closed) : 0;

            // Stages funnel
            const stageCounts = {};
            uProspects.forEach(pr => {
                if (!pr.stages) return;
                Object.entries(pr.stages).forEach(([stage, done]) => {
                    if (done) stageCounts[stage] = (stageCounts[stage] || 0) + 1;
                });
            });

            // Goals
            const uGoals = goals.filter(g => g.user_id === uid && g.periodo === periodo);
            const getGoal = cat => Number(uGoals.find(g => g.categoria === cat)?.meta || 0);

            return {
                userId: uid,
                name: p.full_name || uid,
                color: COLORS[pi % COLORS.length],
                totalActs, actByType,
                tasksDone, tasksPending,
                newProspects, byTab,
                closed, revenue,
                convRate, ticketProm,
                stageCounts,
                goals: {
                    actividades: getGoal("actividades"),
                    tareas: getGoal("tareas"),
                    prospectos: getGoal("prospectos"),
                    ventas: getGoal("ventas"),
                    ingresos: getGoal("ingresos"),
                },
            };
        });
    }, [profiles, activities, tasks, prospects, goals, periodo]);

    const filteredStats = useMemo(() =>
        selectedUser === "all" ? userStats : userStats.filter(u => u.userId === selectedUser),
        [userStats, selectedUser]
    );

    const totals = useMemo(() => filteredStats.reduce((acc, u) => ({
        totalActs: acc.totalActs + u.totalActs,
        tasksDone: acc.tasksDone + u.tasksDone,
        newProspects: acc.newProspects + u.newProspects,
        closed: acc.closed + u.closed,
        revenue: acc.revenue + u.revenue,
        goalActs: acc.goalActs + u.goals.actividades,
        goalTareas: acc.goalTareas + u.goals.tareas,
        goalProspects: acc.goalProspects + u.goals.prospectos,
        goalVentas: acc.goalVentas + u.goals.ventas,
    }), { totalActs: 0, tasksDone: 0, newProspects: 0, closed: 0, revenue: 0, goalActs: 0, goalTareas: 0, goalProspects: 0, goalVentas: 0 }),
        [filteredStats]);

    // ── SAVE GOAL ───────────────────────────────────────────────────────────────
    const saveGoal = async (userId, categoria, meta) => {
        setSaving(true);
        try {
            const { error } = await supabase.from("goals").upsert(
                { user_id: userId, periodo, categoria, meta: Number(meta) || 0, updated_at: new Date().toISOString() },
                { onConflict: "user_id,periodo,categoria" }
            );
            if (error) throw error;
            const { data } = await supabase.from("goals").select("*");
            setGoals(data ?? []);
            toast_("✅ Meta guardada");
        } catch (e) {
            console.error(e);
            toast_("Error guardando meta", false);
        }
        setSaving(false);
    };

    // ── CHART DATA ──────────────────────────────────────────────────────────────
    const actByTypeChartData = ACT_TYPES.map(at => {
        const row = { tipo: at.label };
        userStats.forEach(u => { row[u.name] = u.actByType[at.id] || 0; });
        return row;
    });
    const radarData = ACT_TYPES.map(at => {
        const row = { tipo: at.label.slice(0, 9) };
        userStats.forEach(u => { row[u.name] = u.actByType[at.id] || 0; });
        return row;
    });
    const prospectsByTabData = LIST_TABS.map(t => {
        const row = { lista: TM_LABELS[t].slice(0, 10) };
        userStats.forEach(u => { row[u.name] = u.byTab[t] || 0; });
        return row;
    });
    const revenueChartData = userStats.map(u => ({
        name: u.name, Ingresos: u.revenue, Ventas: u.closed,
    }));
    const rankingActs = [...userStats].sort((a, b) => b.totalActs - a.totalActs);
    const rankingRevenue = [...userStats].sort((a, b) => b.revenue - a.revenue);
    const rankingProspects = [...userStats].sort((a, b) => b.newProspects - a.newProspects);

    const TABS = [
        { id: "resumen", label: "📊 Resumen" },
        { id: "actividades", label: "⚡ Actividades" },
        { id: "prospectos", label: "👥 Prospectos" },
        { id: "ingresos", label: "💰 Ingresos" },
        { id: "comparativo", label: "🏆 Comparativo" },
        { id: "metas", label: "🎯 Metas" },
    ];

    if (loading) return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: "#6366f1", fontSize: 16, fontWeight: 700 }}>
            Cargando reporte...
        </div>
    );

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* ── FILTERS ── */}
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", background: "#0d0d1a", padding: 16, borderRadius: 12, border: "1px solid #14142a" }}>
                <div>
                    <label style={S.lbl}>Período</label>
                    <input type="month" style={{ ...S.inp, width: 160 }} value={periodo}
                        onChange={e => { setPeriodo(e.target.value); setCompareUsers([]); }} />
                </div>
                <div>
                    <label style={S.lbl}>Asesor</label>
                    <select style={{ ...S.inp, width: 190 }} value={selectedUser} onChange={e => setSelectedUser(e.target.value)}>
                        <option value="all">Todos los asesores</option>
                        {profiles.map(p => <option key={p.user_id} value={p.user_id}>{p.full_name}</option>)}
                    </select>
                </div>
                <button style={{ ...S.btn("secondary"), marginBottom: 1 }} onClick={loadAll}>🔄 Actualizar</button>
                <div style={{ marginLeft: "auto", textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: "#374151", fontWeight: 700 }}>PERÍODO ACTIVO</div>
                    <div style={{ fontSize: 15, color: "#fff", fontWeight: 900 }}>{monthLabel(periodo)}</div>
                </div>
            </div>

            {/* ── TABS ── */}
            <div style={{ display: "flex", gap: 2, borderBottom: "1px solid #14142a", flexWrap: "wrap" }}>
                {TABS.map(t => (
                    <button key={t.id} style={S.tabBtn(tab === t.id)} onClick={() => setTab(t.id)}>{t.label}</button>
                ))}
            </div>

            {/* ════════════════════════════════════════════
          TAB: RESUMEN
      ════════════════════════════════════════════ */}
            {tab === "resumen" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

                    {/* KPI cards */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14 }}>
                        <KpiCard label="Actividades" value={totals.totalActs} icon="⚡" color="#6366f1" goal={totals.goalActs} />
                        <KpiCard label="Tareas completadas" value={totals.tasksDone} icon="✅" color="#10b981" goal={totals.goalTareas} />
                        <KpiCard label="Nuevos prospectos" value={totals.newProspects} icon="👥" color="#3b82f6" goal={totals.goalProspects} />
                        <KpiCard label="Ventas cerradas" value={totals.closed} icon="🏆" color="#f59e0b" goal={totals.goalVentas} />
                        <KpiCard label="Ingresos generados" value={fm(totals.revenue)} icon="💰" color="#ec4899"
                            sub={`${totals.closed} cierres · ticket prom. ${totals.closed > 0 ? fm(Math.round(totals.revenue / totals.closed)) : "$0"}`} />
                    </div>

                    {/* Table per user */}
                    <div style={S.card}>
                        <div style={S.ch}><span style={S.ct}>Resumen por asesor — {monthLabel(periodo)}</span></div>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                                <tr>
                                    {["Asesor", "Actividades", "Tareas ✅", "Prospectos", "Ventas", "Ingresos", "Conversión", "Ticket prom."].map(h => (
                                        <th key={h} style={S.th}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {userStats.map(u => (
                                    <tr key={u.userId}>
                                        <td style={S.td}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                <Avatar name={u.name} color={u.color} />
                                                <span style={{ fontWeight: 700, color: "#fff" }}>{u.name}</span>
                                            </div>
                                        </td>
                                        <td style={S.td}>
                                            <span style={{ fontWeight: 700, color: "#6366f1" }}>{u.totalActs}</span>
                                            {u.goals.actividades > 0 && <span style={{ fontSize: 10, color: "#374151", marginLeft: 5 }}>/{u.goals.actividades}</span>}
                                        </td>
                                        <td style={S.td}><span style={{ color: "#10b981", fontWeight: 700 }}>{u.tasksDone}</span></td>
                                        <td style={S.td}>{u.newProspects}</td>
                                        <td style={S.td}><span style={{ color: "#f59e0b", fontWeight: 700 }}>{u.closed}</span></td>
                                        <td style={S.td}><span style={{ color: "#ec4899", fontWeight: 700 }}>{fm(u.revenue)}</span></td>
                                        <td style={S.td}>
                                            <span style={S.bdg(u.convRate >= 30 ? "#10b981" : u.convRate >= 15 ? "#f59e0b" : "#ef4444")}>
                                                {u.convRate}%
                                            </span>
                                        </td>
                                        <td style={S.td}>{fm(u.ticketProm)}</td>
                                    </tr>
                                ))}
                                {userStats.length === 0 && (
                                    <tr><td colSpan={8} style={{ ...S.td, textAlign: "center", color: "#374151", padding: 28 }}>Sin datos para este período</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Rankings */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
                        {[
                            { title: "🏆 Top Actividades", data: rankingActs, key: "totalActs", color: "#6366f1", fmt: v => v },
                            { title: "👥 Top Prospectos", data: rankingProspects, key: "newProspects", color: "#3b82f6", fmt: v => v },
                            { title: "💰 Top Ingresos", data: rankingRevenue, key: "revenue", color: "#ec4899", fmt: fm },
                        ].map(({ title, data, key, color, fmt }) => (
                            <div key={title} style={S.card}>
                                <div style={S.ch}><span style={S.ct}>{title}</span></div>
                                <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                                    {data.map((u, i) => (
                                        <div key={u.userId} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                            <span style={{ fontSize: 18, width: 24, textAlign: "center" }}>{["🥇", "🥈", "🥉"][i] || `#${i + 1}`}</span>
                                            <Avatar name={u.name} color={u.color} />
                                            <span style={{ flex: 1, fontSize: 13, color: "#dde0f0" }}>{u.name}</span>
                                            <span style={{ fontWeight: 900, color, fontSize: 15 }}>{fmt(u[key])}</span>
                                        </div>
                                    ))}
                                    {data.length === 0 && <div style={{ color: "#374151", textAlign: "center", padding: 16 }}>Sin datos</div>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════════════
          TAB: ACTIVIDADES
      ════════════════════════════════════════════ */}
            {tab === "actividades" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

                    {/* Cards por asesor */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 14 }}>
                        {filteredStats.map(u => (
                            <div key={u.userId} style={{ ...S.card, borderLeft: `4px solid ${u.color}` }}>
                                <div style={{ padding: "14px 18px", borderBottom: "1px solid #14142a", display: "flex", alignItems: "center", gap: 8 }}>
                                    <Avatar name={u.name} color={u.color} />
                                    <span style={{ fontWeight: 800, color: "#fff" }}>{u.name}</span>
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
                                    <div style={{ borderTop: "1px solid #14142a", paddingTop: 10, marginTop: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <span style={{ fontSize: 12, color: "#6b7280" }}>Total</span>
                                        <span style={{ fontWeight: 900, color: "#fff", fontSize: 18 }}>{u.totalActs}</span>
                                    </div>
                                    {u.goals.actividades > 0 && (
                                        <div>
                                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                                <span style={{ fontSize: 10, color: "#374151" }}>Meta: {u.goals.actividades}</span>
                                                <span style={{ fontSize: 10, fontWeight: 700, color: pct(u.totalActs, u.goals.actividades) >= 100 ? "#10b981" : u.color }}>
                                                    {pct(u.totalActs, u.goals.actividades)}%
                                                </span>
                                            </div>
                                            <PBar value={u.totalActs} max={u.goals.actividades} color={u.color} height={8} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Bar chart */}
                    <div style={S.card}>
                        <div style={S.ch}><span style={S.ct}>Actividades por tipo y asesor</span></div>
                        <div style={{ padding: 20, height: 300 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={actByTypeChartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#14142a" />
                                    <XAxis dataKey="tipo" tick={{ fill: "#6b7280", fontSize: 11 }} />
                                    <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} />
                                    <Tooltip {...TOOLTIP_STYLE} />
                                    <Legend />
                                    {userStats.map(u => (
                                        <Bar key={u.userId} dataKey={u.name} fill={u.color} radius={[4, 4, 0, 0]} />
                                    ))}
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Radar */}
                    {userStats.length > 0 && (
                        <div style={S.card}>
                            <div style={S.ch}><span style={S.ct}>Radar de actividades</span></div>
                            <div style={{ padding: 20, height: 300 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart data={radarData}>
                                        <PolarGrid stroke="#14142a" />
                                        <PolarAngleAxis dataKey="tipo" tick={{ fill: "#6b7280", fontSize: 11 }} />
                                        <PolarRadiusAxis tick={{ fill: "#374151", fontSize: 9 }} />
                                        {userStats.map(u => (
                                            <Radar key={u.userId} name={u.name} dataKey={u.name}
                                                stroke={u.color} fill={u.color} fillOpacity={0.2} />
                                        ))}
                                        <Legend />
                                        <Tooltip {...TOOLTIP_STYLE} />
                                    </RadarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ════════════════════════════════════════════
          TAB: PROSPECTOS
      ════════════════════════════════════════════ */}
            {tab === "prospectos" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

                    {/* KPIs */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
                        <KpiCard label="Nuevos prospectos" value={totals.newProspects} icon="👥" color="#3b82f6" goal={totals.goalProspects} />
                        <KpiCard label="Ventas cerradas" value={totals.closed} icon="🏆" color="#f59e0b" />
                        <KpiCard label="Tasa de cierre" value={`${totals.newProspects > 0 ? Math.round(totals.closed / totals.newProspects * 100) : 0}%`} icon="📈" color="#10b981" />
                        <KpiCard label="Total en pipeline" value={prospects.length} icon="🔄" color="#8b5cf6" />
                    </div>

                    {/* Prospectos por lista */}
                    <div style={S.card}>
                        <div style={S.ch}><span style={S.ct}>Nuevos prospectos por lista</span></div>
                        <div style={{ padding: 20, height: 280 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={prospectsByTabData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#14142a" />
                                    <XAxis dataKey="lista" tick={{ fill: "#6b7280", fontSize: 10 }} />
                                    <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} />
                                    <Tooltip {...TOOLTIP_STYLE} />
                                    <Legend />
                                    {userStats.map(u => (
                                        <Bar key={u.userId} dataKey={u.name} fill={u.color} radius={[4, 4, 0, 0]} />
                                    ))}
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Embudo por asesor */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 14 }}>
                        {filteredStats.map(u => {
                            const entries = Object.entries(u.stageCounts).sort((a, b) => b[1] - a[1]);
                            const maxVal = Math.max(...entries.map(([, v]) => v), 1);
                            return (
                                <div key={u.userId} style={S.card}>
                                    <div style={{ padding: "14px 18px", borderBottom: "1px solid #14142a", display: "flex", alignItems: "center", gap: 8 }}>
                                        <Avatar name={u.name} color={u.color} />
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
                                                <PBar value={count} max={maxVal} color={u.color} height={7} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════════════
          TAB: INGRESOS
      ════════════════════════════════════════════ */}
            {tab === "ingresos" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

                    {/* KPIs */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
                        <KpiCard label="Ingresos totales" value={fm(totals.revenue)} icon="💰" color="#ec4899" />
                        <KpiCard label="Ventas cerradas" value={totals.closed} icon="🏆" color="#f59e0b" goal={totals.goalVentas} />
                        <KpiCard label="Ticket promedio" value={fm(totals.closed > 0 ? Math.round(totals.revenue / totals.closed) : 0)} icon="🎫" color="#10b981" />
                        <KpiCard label="Tasa de cierre" value={`${totals.newProspects > 0 ? Math.round(totals.closed / totals.newProspects * 100) : 0}%`} icon="📈" color="#6366f1" />
                    </div>

                    {/* Bar chart */}
                    <div style={S.card}>
                        <div style={S.ch}><span style={S.ct}>Ingresos y ventas por asesor</span></div>
                        <div style={{ padding: 20, height: 280 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={revenueChartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#14142a" />
                                    <XAxis dataKey="name" tick={{ fill: "#6b7280", fontSize: 11 }} />
                                    <YAxis yAxisId="left" tick={{ fill: "#6b7280", fontSize: 11 }} />
                                    <YAxis yAxisId="right" orientation="right" tick={{ fill: "#6b7280", fontSize: 11 }} />
                                    <Tooltip {...TOOLTIP_STYLE} formatter={(v, name) => [name === "Ingresos" ? fm(v) : v, name]} />
                                    <Legend />
                                    <Bar yAxisId="left" dataKey="Ingresos" fill="#ec4899" radius={[4, 4, 0, 0]} />
                                    <Bar yAxisId="right" dataKey="Ventas" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Detalle de ventas */}
                    <div style={S.card}>
                        <div style={S.ch}><span style={S.ct}>Detalle de ventas cerradas</span></div>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                                <tr>
                                    {["Asesor", "Prospecto", "Servicio", "Monto", "Plazo", "Total contrato", "Fecha inicio"].map(h => (
                                        <th key={h} style={S.th}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {prospects.filter(pr => pr.venta?.monto).map(pr => {
                                    const owner = profiles.find(p => p.user_id === pr.owner_id);
                                    const nombrePr = pr.data?.nombre || "—";
                                    const total = Number(pr.venta.monto) * Number(pr.venta.plazo || 1);
                                    return (
                                        <tr key={pr.id}>
                                            <td style={S.td}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                    {owner && <Avatar name={owner.full_name} color={COLORS[profiles.indexOf(owner) % COLORS.length]} />}
                                                    <span style={{ color: "#fff", fontWeight: 600 }}>{owner?.full_name || "—"}</span>
                                                </div>
                                            </td>
                                            <td style={S.td}>{nombrePr}</td>
                                            <td style={S.td}><span style={{ color: "#9ca3af" }}>{pr.venta.servicio || "—"}</span></td>
                                            <td style={S.td}>{fm(pr.venta.monto)}</td>
                                            <td style={S.td}>{pr.venta.plazo || 1} meses</td>
                                            <td style={S.td}><span style={{ color: "#ec4899", fontWeight: 700 }}>{fm(total)}</span></td>
                                            <td style={S.td}><span style={{ color: "#6b7280" }}>{pr.venta.fechaInicio || "—"}</span></td>
                                        </tr>
                                    );
                                })}
                                {prospects.filter(pr => pr.venta?.monto).length === 0 && (
                                    <tr><td colSpan={7} style={{ ...S.td, textAlign: "center", color: "#374151", padding: 28 }}>Sin ventas registradas en este período</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════════════
          TAB: COMPARATIVO
      ════════════════════════════════════════════ */}
            {tab === "comparativo" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

                    {/* Selector */}
                    <div style={{ ...S.card, padding: 18 }}>
                        <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700, marginBottom: 12 }}>
                            Selecciona asesores a comparar (mínimo 2)
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {profiles.map((p, i) => {
                                const active = compareUsers.includes(p.user_id);
                                return (
                                    <button key={p.user_id}
                                        style={{ ...S.btn(active ? "primary" : "secondary", active ? COLORS[i % COLORS.length] : undefined), display: "flex", alignItems: "center", gap: 6 }}
                                        onClick={() => setCompareUsers(prev =>
                                            prev.includes(p.user_id) ? prev.filter(x => x !== p.user_id) : [...prev, p.user_id]
                                        )}>
                                        {active ? "✓ " : ""}{p.full_name}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {compareUsers.length < 2 ? (
                        <div style={{ ...S.card, padding: 40, textAlign: "center", color: "#374151" }}>
                            Selecciona al menos 2 asesores para comparar
                        </div>
                    ) : (() => {
                        const cUsers = userStats.filter(u => compareUsers.includes(u.userId));
                        const metrics = [
                            { key: "totalActs", label: "Actividades", color: "#6366f1", fmt: v => v },
                            { key: "tasksDone", label: "Tareas completadas", color: "#10b981", fmt: v => v },
                            { key: "newProspects", label: "Nuevos prospectos", color: "#3b82f6", fmt: v => v },
                            { key: "closed", label: "Ventas cerradas", color: "#f59e0b", fmt: v => v },
                            { key: "revenue", label: "Ingresos", color: "#ec4899", fmt: fm },
                            { key: "convRate", label: "Conversión %", color: "#8b5cf6", fmt: v => `${v}%` },
                        ];
                        return (
                            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                                {metrics.map(m => {
                                    const maxVal = Math.max(...cUsers.map(u => u[m.key]), 1);
                                    return (
                                        <div key={m.key} style={S.card}>
                                            <div style={S.ch}><span style={S.ct}>{m.label}</span></div>
                                            <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
                                                {cUsers.map(u => (
                                                    <div key={u.userId}>
                                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, alignItems: "center" }}>
                                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                                <Avatar name={u.name} color={u.color} />
                                                                <span style={{ fontSize: 13, color: "#dde0f0" }}>{u.name}</span>
                                                            </div>
                                                            <span style={{ fontWeight: 900, color: m.color, fontSize: 16 }}>{m.fmt(u[m.key])}</span>
                                                        </div>
                                                        <PBar value={u[m.key]} max={maxVal} color={u.color} height={10} />
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

            {/* ════════════════════════════════════════════
          TAB: METAS
      ════════════════════════════════════════════ */}
            {tab === "metas" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>
                        Configura las metas mensuales para cada asesor · {monthLabel(periodo)}
                    </div>

                    {profiles.length === 0 && (
                        <div style={{ ...S.card, padding: 40, textAlign: "center", color: "#374151" }}>
                            No hay asesores registrados aún
                        </div>
                    )}

                    {profiles.map((p, pi) => {
                        const uStats = userStats.find(u => u.userId === p.user_id);
                        return (
                            <div key={p.user_id} style={S.card}>
                                <div style={{ padding: "16px 20px", borderBottom: "1px solid #14142a", display: "flex", alignItems: "center", gap: 10 }}>
                                    <Avatar name={p.full_name} color={COLORS[pi % COLORS.length]} />
                                    <span style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>{p.full_name}</span>
                                    <span style={S.bdg("#6b7280")}>Asesor</span>
                                </div>
                                <div style={{ padding: 20, display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14 }}>
                                    {CATS.map(c => {
                                        const key = `${p.user_id}_${c.id}`;
                                        const currentGoal = uStats?.goals[c.id] || 0;
                                        const currentVal = c.id === "actividades" ? (uStats?.totalActs || 0)
                                            : c.id === "tareas" ? (uStats?.tasksDone || 0)
                                                : c.id === "prospectos" ? (uStats?.newProspects || 0)
                                                    : c.id === "ventas" ? (uStats?.closed || 0)
                                                        : (uStats?.revenue || 0);
                                        const inputVal = editGoals[key] !== undefined ? editGoals[key] : currentGoal;
                                        const p_ = pct(currentVal, currentGoal);

                                        return (
                                            <div key={c.id} style={{ background: "#07070f", borderRadius: 10, padding: 16, border: `1px solid ${c.color}22`, display: "flex", flexDirection: "column", gap: 8 }}>
                                                <div style={{ fontSize: 22 }}>{c.icon}</div>
                                                <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 700 }}>{c.label}</div>
                                                <div style={{ fontSize: 24, fontWeight: 900, color: c.color, lineHeight: 1 }}>{c.fmt(currentVal)}</div>
                                                <div style={{ fontSize: 9, color: "#374151" }}>actual en período</div>

                                                <label style={{ ...S.lbl, fontSize: 10, marginBottom: 2 }}>Meta del mes</label>
                                                <input
                                                    type="number" min="0"
                                                    style={{ ...S.inp, fontSize: 12, padding: "7px 10px" }}
                                                    value={inputVal}
                                                    onChange={e => setEditGoals(prev => ({ ...prev, [key]: e.target.value }))}
                                                />

                                                {currentGoal > 0 && (
                                                    <div>
                                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                                                            <span style={{ fontSize: 9, color: "#374151" }}>Progreso</span>
                                                            <span style={{ fontSize: 9, fontWeight: 700, color: p_ >= 100 ? "#10b981" : c.color }}>{p_}%</span>
                                                        </div>
                                                        <PBar value={currentVal} max={currentGoal} color={p_ >= 100 ? "#10b981" : c.color} height={5} />
                                                    </div>
                                                )}

                                                <button
                                                    style={{ ...S.btn("primary", c.color), padding: "7px 0", fontSize: 11, marginTop: 4 }}
                                                    disabled={saving}
                                                    onClick={() => saveGoal(p.user_id, c.id, inputVal)}
                                                >
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

            {/* Toast */}
            {toast && (
                <div style={{ position: "fixed", bottom: 20, right: 20, background: toast.ok ? "#10b981" : "#dc2626", color: "#fff", padding: "11px 20px", borderRadius: 10, fontSize: 13, fontWeight: 700, zIndex: 300, boxShadow: "0 8px 32px rgba(0,0,0,.5)" }}>
                    {toast.msg}
                </div>
            )}
        </div>
    );
}
