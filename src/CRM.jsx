import SmartSalesPanel from "./SmartSalesPanel";
import NotificationsPanel from "./NotificationsPanel";
import { useState, useEffect, useMemo } from "react";
import ReporteAdmin from "./ReporteAdmin";
/**
 * PARCHE TEMPORAL (para que tu app no truene en Vite):
 * Tu código usa window.storage.get/set (como si estuvieras en un sandbox).
 * En una app React normal eso no existe.
 *
 * Esto crea window.storage usando localStorage.
 * (Luego lo cambiaremos para guardar en Supabase/BD).
 */
if (typeof window !== "undefined" && !window.storage) {
  window.storage = {
    async get(key) {
      const value = localStorage.getItem(key);
      return value ? { value } : null;
    },
    async set(key, value) {
      localStorage.setItem(key, value);
      return true;
    },
  };
}

// ── CONSTANTS ──────────────────────────────────────────────────────────────
const LIST_TABS = ["avatar", "circulo", "referidores", "referidos", "facebook"];
const TM = {
  avatar: { label: "Entrevistados Avatar", icon: "🎯", color: "#6366f1" },
  circulo: { label: "Círculo de Poder", icon: "⭐", color: "#f59e0b" },
  referidores: { label: "Referidores", icon: "🤝", color: "#10b981" },
  referidos: { label: "Referidos", icon: "🔗", color: "#3b82f6" },
  facebook: { label: "Facebook", icon: "📘", color: "#818cf8" },
};
const STAGES = {
  avatar: ["Contactado", "Entrevista Avatar", "Sesión de Venta", "Propuesta Realizada", "Pago", "Contrato", "Testimonio"],
  circulo: ["Contactado", "Agendó Sesión", "Sesión de Venta", "Propuesta Realizada", "Pago", "Contrato", "Testimonio"],
  referidores: ["Contactado", "Propuesta Realizada", "Pasó Referidos", "Hizo Ventas", "Comisiones Pagadas"],
  referidos: ["Contactado", "Sesión de Venta", "Propuesta Realizada", "Pago", "Contrato", "Testimonio"],
  facebook: ["Contactado", "Sesión de Venta", "Propuesta Realizada", "Pago", "Contrato", "Testimonio"],
};
const KANBAN_COLS = ["Nuevo", "Contactado", "En Proceso", "Propuesta Enviada", "Negociación", "Cerrado ✅", "Perdido ❌"];
const KC = { "Nuevo": "#374151", "Contactado": "#6366f1", "En Proceso": "#3b82f6", "Propuesta Enviada": "#8b5cf6", "Negociación": "#f59e0b", "Cerrado ✅": "#10b981", "Perdido ❌": "#ef4444" };
const ACT_TYPES = [
  { id: "llamada", label: "Llamada", icon: "📞" },
  { id: "whatsapp", label: "WhatsApp", icon: "💬" },
  { id: "email", label: "Email", icon: "📧" },
  { id: "propuesta", label: "Propuesta enviada", icon: "📄" },
  { id: "reunion", label: "Reunión", icon: "🤝" },
  { id: "seguimiento", label: "Seguimiento", icon: "🔄" },
];
const PRIO_C = { Alta: "#ef4444", Media: "#f59e0b", Baja: "#10b981" };
const FIELDS = {
  avatar: ["nombre", "correo", "telefono", "web", "redSocial", "conocePor"],
  circulo: ["nombre", "correo", "telefono", "web", "redSocial", "conocePor"],
  referidores: ["nombre", "correo", "telefono", "redSocial", "conocePor", "comision"],
  referidos: ["nombre", "correo", "telefono", "web", "redSocial", "quienRefiere"],
  facebook: ["nombre", "correo", "telefono", "facebook", "amigosCom"],
};
const FL = { nombre: "Nombre y Apellido", correo: "Correo", telefono: "Teléfono", web: "Sitio Web", redSocial: "Red Social", conocePor: "¿Cómo lo conozco?", comision: "Comisión acordada", quienRefiere: "¿Quién lo refiere?", facebook: "Perfil Facebook", amigosCom: "Amigos en común" };
const DEFAULT_CONFIG = { agencia: "Top Seller", socios: "", moneda: "MXN", metaClientes: 10, metaIngresos: 50000, inversion: 0, periodoInicio: new Date().toISOString().slice(0, 7) + "-01", periodoFin: new Date().toISOString().slice(0, 10) };

// ── UTILS ──────────────────────────────────────────────────────────────────
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const today = () => new Date().toISOString().split("T")[0];
const fd = d => d ? new Date(d + "T12:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) : "—";
const fm = (v, c = "MXN") => v ? `$${Number(v).toLocaleString("es-MX")} ${c}` : "—";
const ds = d => d ? Math.floor((Date.now() - new Date(d + "T12:00:00")) / (86400000)) : 999;

const isClosed = (p, tab) => {
  const s = STAGES[tab] || []; const k = s.find(x => x.toLowerCase().includes("pago") || x.toLowerCase().includes("ventas"));
  return k ? !!p.stages?.[k] : false;
};
const pct = (p, tab) => { const s = STAGES[tab] || []; const d = s.filter(x => p.stages?.[x]).length; return s.length ? Math.round(d / s.length * 100) : 0; };
const kStage = (p, tab) => {
  if (p.perdido) return "Perdido ❌";
  if (isClosed(p, tab)) return "Cerrado ✅";
  const s = STAGES[tab] || []; const pIdx = s.findIndex(x => x.toLowerCase().includes("propuesta")); const last = s.reduce((a, x, i) => p.stages?.[x] ? i : a, -1);
  if (last < 0 && !p.stages?.[s[0]]) return "Nuevo";
  if (last < 0) return "Contactado";
  if (pIdx >= 0 && last >= pIdx) return last > pIdx ? "Negociación" : "Propuesta Enviada";
  return last > 0 ? "En Proceso" : "Contactado";
};
const calcTemp = (p, tab, tareas) => {
  if (isClosed(p, tab)) return { e: "✅", l: "Cerrado", c: "#10b981" };
  if (p.perdido) return { e: "❌", l: "Perdido", c: "#ef4444" };
  const days = ds(p.updatedAt || p.creadoEn), pr = pct(p, tab), hasTarea = tareas.some(t => t.prospectId === p.id && t.estado === "pendiente");
  let score = 0;
  if (days < 2) score += 3; else if (days < 5) score += 2; else if (days < 10) score += 1;
  if (pr > 75) score += 3; else if (pr > 50) score += 2; else if (pr > 25) score += 1;
  if (hasTarea) score += 1;
  if (score >= 6) return { e: "🔥", l: "Caliente", c: "#ef4444" };
  if (score >= 3) return { e: "🟡", l: "Tibio", c: "#f59e0b" };
  return { e: "🧊", l: "Frío", c: "#6366f1" };
};

// ── STYLES ─────────────────────────────────────────────────────────────────
const S = {
  app: { fontFamily: "'DM Sans',sans-serif", background: "#07070f", minHeight: "100vh", color: "#dde0f0", display: "flex", fontSize: 14 },
  side: { width: 232, background: "#0b0b17", borderRight: "1px solid #14142a", display: "flex", flexDirection: "column", flexShrink: 0 },
  logo: { padding: "22px 18px 16px", borderBottom: "1px solid #14142a" },
  main: { flex: 1, overflow: "auto", display: "flex", flexDirection: "column", minWidth: 0 },
  topbar: { background: "#0b0b17", borderBottom: "1px solid #14142a", padding: "12px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 10 },
  page: { padding: "20px 24px", flex: 1 },
  card: { background: "#0d0d1a", border: "1px solid #14142a", borderRadius: 12, overflow: "hidden" },
  ch: { padding: "14px 18px", borderBottom: "1px solid #14142a", display: "flex", justifyContent: "space-between", alignItems: "center" },
  ct: { fontSize: 13, fontWeight: 700, color: "#fff" },
  btn: (v, c) => ({
    padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12, transition: "opacity .15s",
    background: v === "primary" ? (c || "#6366f1") : v === "danger" ? "#dc2626" : v === "green" ? "#10b981" : v === "ghost" ? "transparent" : "#161628",
    color: v === "ghost" ? "#6b7280" : "#fff"
  }),
  inp: { background: "#07070f", border: "1px solid #1a1a2e", borderRadius: 8, padding: "9px 12px", color: "#dde0f0", fontSize: 13, width: "100%", outline: "none", boxSizing: "border-box" },
  lbl: { fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: .5, marginBottom: 5, display: "block" },
  th: { padding: "9px 14px", textAlign: "left", fontSize: 10, color: "#374151", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", borderBottom: "1px solid #14142a", whiteSpace: "nowrap" },
  td: { padding: "10px 14px", borderBottom: "1px solid #0c0c18", verticalAlign: "middle" },
  bdg: (c = "#6366f1") => ({ display: "inline-flex", alignItems: "center", padding: "3px 9px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: c + "22", color: c, border: `1px solid ${c}33` }),
  nav: (a, c = "#6366f1") => ({ display: "flex", alignItems: "center", gap: 8, padding: "8px 18px", cursor: "pointer", fontSize: 12, fontWeight: a ? 700 : 400, color: a ? "#fff" : "#6b7280", background: a ? c + "18" : "transparent", borderLeft: a ? `3px solid ${c}` : "3px solid transparent", transition: "all .15s" }),
  pbw: { height: 5, borderRadius: 3, background: "#1a1a2e", overflow: "hidden", flex: 1 },
  modal: { position: "fixed", inset: 0, background: "rgba(0,0,0,.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 },
  mbox: { background: "#0d0d1a", border: "1px solid #1a1a2e", borderRadius: 16, width: "100%", maxWidth: 580, maxHeight: "92vh", overflow: "auto", display: "flex", flexDirection: "column" },
  chk: (on, c) => ({ width: 20, height: 20, borderRadius: 5, border: `2px solid ${on ? c : "#374151"}`, background: on ? c : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all .15s", flexShrink: 0 }),
  g2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  row: { display: "flex", gap: 10, alignItems: "center" },
};

// ── SHARED COMPONENTS ─────────────────────────────────────────────────────
const Chk = ({ on, color = "#6366f1", onChange }) => (
  <div style={S.chk(on, color)} onClick={onChange}>
    {on && <svg width="11" height="11" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
  </div>
);
const PBar = ({ p, color, h = 5 }) => (
  <div style={{ ...S.pbw, height: h }}>
    <div style={{ height: "100%", width: `${Math.min(p, 100)}%`, background: color, borderRadius: 3, transition: "width .4s" }} />
  </div>
);

// ── APP ────────────────────────────────────────────────────────────────────
export default function CRM({ user, role = "team" }) {
  const [view, setView] = useState("dashboard");
  const [pros, setPros] = useState({ avatar: [], circulo: [], referidores: [], referidos: [], facebook: [] });
  const [tareas, setTareas] = useState([]);
  const [acts, setActs] = useState([]);
  const [cfg, setCfg] = useState(DEFAULT_CONFIG);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);
  const [kFilter, setKFilter] = useState("all");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const { dbGetProspects, dbGetTasks, dbGetActivities, dbGetTasksWithOwner, dbGetActivitiesWithOwner, dbGetConfig } = await import("./db");

        // 1) Prospectos por tab
        const entries = await Promise.all(
          ["avatar", "circulo", "referidores", "referidos", "facebook"].map(async (tab) => {
            const rows = await dbGetProspects(tab);

            // rows: { id, tab, data, stages, perdido, venta, notas_historial, created_at, updated_at }
            const list = (rows ?? []).map(r => ({
              id: r.id,
              tab: r.tab,
              owner_id: r.owner_id || null,
              owner_name: r.owner_name || null,
              ...(r.data || {}),
              stages: r.stages || {},
              perdido: !!r.perdido,
              venta: r.venta || {},
              notasHistorial: r.notas_historial || [],
              creadoEn: (r.created_at || "").slice(0, 10),
              updatedAt: (r.updated_at || "").slice(0, 10),
            }));

            return [tab, list];
          })
        );

        const pObj = Object.fromEntries(entries);

        // 2) Tareas
        const tRows = role === "admin" ? await dbGetTasksWithOwner() : await dbGetTasks();
        const tList = (tRows ?? []).map(t => ({
          id: t.id,
          prospectId: t.prospect_id || "",
          titulo: t.titulo,
          prioridad: t.prioridad,
          fecha: (t.fecha || "").slice(0, 10),
          estado: t.estado,
          notas: t.notas || "",
          ownerId: t.owner_id || t.ownerId || "",
          ownerName: t.owner_name || t.ownerName || "—",
          ownerRole: t.owner_role || t.ownerRole || null,
        }));

        // 3) Actividades
        const aRows = await dbGetActivities();
        const aList = (aRows ?? []).map(a => ({
          id: a.id,
          tipo: a.tipo,
          cantidad: a.cantidad,
          fecha: (a.fecha || "").slice(0, 10),
          notas: a.notas || "",
          ownerId: a.owner_id || "",
          ownerName: a.owner_name || a.ownerName || "—",
          ownerRole: a.owner_role || a.ownerRole || null,
        }));

        // 4) Config (solo admin por policies)
        let c = null;
        try { c = await dbGetConfig(); } catch { c = null; }

        if (!alive) return;

        setPros({ avatar: [], circulo: [], referidores: [], referidos: [], facebook: [], ...(pObj || {}) });

        console.log("TAREA 0:", tList?.[0]);
        setTareas(tList);
        setActs(aList);
        if (c) {
          setCfg({
            ...DEFAULT_CONFIG,
            agencia: c.agencia,
            socios: c.socios,
            moneda: c.moneda,
            metaClientes: c.meta_clientes,
            metaIngresos: Number(c.meta_ingresos),
            inversion: Number(c.inversion),
            periodoInicio: (c.periodo_inicio || "").slice(0, 10),
            periodoFin: (c.periodo_fin || "").slice(0, 10),
          });
        }
      } catch (e) {
        console.error(e);
      }
    })();

    return () => { alive = false; };
  }, []);

  const persist = async (p, t, a, c) => {
    setSaving(true);
    try { await window.storage.set("ts_v5", JSON.stringify({ p: p ?? pros, t: t ?? tareas, a: a ?? acts, c: c ?? cfg })); } catch { }
    setTimeout(() => setSaving(false), 600);
  };
  const toast_ = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 2600); };

  const allP = useMemo(() => LIST_TABS.flatMap(t => pros[t].map(p => ({ ...p, _tab: t }))), [pros]);

  const stats = useMemo(() => {
    const closed = LIST_TABS.reduce((a, t) => a + pros[t].filter(p => isClosed(p, t)).length, 0);
    const total = LIST_TABS.reduce((a, t) => a + pros[t].length, 0);
    const byTab = Object.fromEntries(LIST_TABS.map(t => [t, pros[t].length]));
    const cByTab = Object.fromEntries(LIST_TABS.map(t => [t, pros[t].filter(p => isClosed(p, t)).length]));
    const ventasP = allP.filter(p => p.venta?.monto);
    const mrr = ventasP.reduce((a, p) => a + Number(p.venta.monto) * (p.venta.tipo === "mensual" ? Number(p.venta.plazo || 1) : 1), 0);
    const ltv = ventasP.reduce((a, p) => a + Number(p.venta.monto) * Number(p.venta.plazo || 1), 0);
    const ticket = ventasP.length ? mrr / ventasP.length : 0;
    const roi = Number(cfg.inversion) > 0 ? Math.round((mrr - Number(cfg.inversion)) / Number(cfg.inversion) * 100) : null;
    const frios = allP.filter(p => !isClosed(p, p._tab) && !p.perdido && ds(p.updatedAt || p.creadoEn) > 7);
    const wAgo = new Date(Date.now() - 7 * 864e5).toISOString().split("T")[0];
    const mStart = today().slice(0, 7) + "-01";
    const actW = acts.filter(a => a.fecha >= wAgo);
    const actM = acts.filter(a => a.fecha >= mStart);
    const actTot = acts.reduce((a, x) => a + (Number(x.cantidad) || 1), 0);
    const convRate = total ? Math.round(closed / total * 100) : 0;
    const propSent = allP.filter(p => { const s = STAGES[p._tab] || []; return s.some(x => x.toLowerCase().includes("propuesta") && p.stages?.[x]); }).length;
    const contacted = allP.filter(p => { const s = STAGES[p._tab] || []; return s[0] && p.stages?.[s[0]]; }).length;
    const tarHoy = tareas.filter(t => t.estado === "pendiente" && t.fecha <= today());
    const dayN = new Date().getDate();
    const daysIM = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const proyect = dayN > 0 ? Math.round(closed / dayN * daysIM) : 0;
    return { closed, total, byTab, cByTab, mrr, ltv, ticket, roi, frios, actW, actM, actTot, convRate, propSent, contacted, tarHoy, proyect, ventasP };
  }, [allP, tareas, acts, cfg, pros]);

  // ── CRUD ─────────────────────────────────────────────────────────────────
  const saveP = async (tab, p) => {
    const u = { ...p, updatedAt: today() };

    // 1) Guarda en UI (para que se vea inmediato)
    const l = pros[tab];
    const n = {
      ...pros,
      [tab]: l.find((x) => x.id === p.id) ? l.map((x) => (x.id === p.id ? u : x)) : [...l, u],
    };
    setPros(n);

    // 2) Guarda en Supabase (BD)
    try {
      const { dbUpsertProspect } = await import("./db");

      // Convierte tu objeto UI -> formato BD
      const isUuid = (v) =>
        typeof v === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

      const payload = {
        ...(isUuid(u.id) ? { id: u.id } : {}),
        tab,
        owner_id: user.id,
        data: Object.fromEntries((FIELDS[tab] || []).map((k) => [k, u[k] ?? ""])),
        stages: u.stages || {},
        perdido: !!u.perdido,
        venta: u.venta || {},
        notas_historial: u.notasHistorial || [],
      };

      await dbUpsertProspect(payload);
      const { dbGetProspects } = await import("./db");
      const rows = await dbGetProspects(tab);
      const list = (rows ?? []).map(r => ({
        id: r.id,
        tab: r.tab,
        ...(r.data || {}),
        stages: r.stages || {},
        perdido: !!r.perdido,
        venta: r.venta || {},
        notasHistorial: r.notas_historial || [],
        creadoEn: (r.created_at || "").slice(0, 10),
        updatedAt: (r.updated_at || "").slice(0, 10),
      }));

      setPros(prev => ({ ...prev, [tab]: list }));
    } catch (e) {
      console.error(e);
      toast_("Error guardando en Supabase", false);
    }

    toast_("✅ Guardado");
    setModal(null);
  };
  const delP = async (tab, id) => {
    if (!confirm("¿Eliminar este registro?")) return;

    // 1) Borra en UI inmediato
    const n = { ...pros, [tab]: pros[tab].filter((p) => p.id !== id) };
    setPros(n);

    // 2) Borra en Supabase
    try {
      const { dbDeleteProspect } = await import("./db");
      await dbDeleteProspect(id);
    } catch (e) {
      console.error(e);
      toast_("Error eliminando en Supabase", false);
    }

    toast_("Eliminado", false);
    setModal(null);
  };
  const toggleStage = async (tab, pid, stage) => { const n = { ...pros, [tab]: pros[tab].map(p => p.id === pid ? { ...p, stages: { ...p.stages, [stage]: !p.stages?.[stage] }, updatedAt: today() } : p) }; setPros(n); await persist(n, null, null, null); };
  const saveTarea = async (t) => {
    // helper UUID 100% exacto
    const isUuid = (v) =>
      typeof v === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

    // 1) UI inmediato
    const n = tareas.find((x) => x.id === t.id)
      ? tareas.map((x) => (x.id === t.id ? t : x))
      : [...tareas, t];
    setTareas(n);

    // 2) BD (upsert)
    try {
      const { dbUpsertTask, dbGetTasks } = await import("./db");

      const payload = {
        ...(isUuid(t.id) ? { id: t.id } : {}), // <-- exacto
        owner_id: user.id,
        prospect_id: t.prospectId || null,
        titulo: t.titulo,
        prioridad: t.prioridad,
        fecha: t.fecha, // YYYY-MM-DD
        estado: t.estado,
        notas: t.notas || "",
      };

      await dbUpsertTask(payload);

      // 3) Refresco total (para agarrar IDs reales y evitar duplicados)
      const { dbGetTasksWithOwner } = await import("./db");
      const rows = role === "admin" ? await dbGetTasksWithOwner() : await dbGetTasks();

      const list = (rows ?? []).map((row) => ({
        id: row.id,
        prospectId: row.prospect_id || "",
        titulo: row.titulo,
        prioridad: row.prioridad,
        fecha: (row.fecha || "").slice(0, 10),
        estado: row.estado,
        notas: row.notas || "",
        ownerId: row.owner_id || "",
        ownerName: row.owner_name || row.ownerName || "—",
        ownerRole: row.owner_role || row.ownerRole || null,
      }));

      setTareas(list);
      console.log("TAREAS CARGADAS:", list);
      setTareas(list);
    } catch (e) {
      console.error(e);
      toast_("Error guardando tarea en Supabase", false);
    }

    toast_("✅ Tarea guardada");
    setModal(null);
  };
  const toggleTarea = async (id) => {
    // 1) UI inmediato
    const n = tareas.map((t) =>
      t.id === id ? { ...t, estado: t.estado === "pendiente" ? "completada" : "pendiente" } : t
    );
    setTareas(n);

    // 2) BD
    try {
      const t = n.find((x) => x.id === id);
      if (!t) return;

      const { dbUpsertTask, dbGetTasks, dbGetTasksWithOwner } = await import("./db");

      const isUuid = (v) =>
        typeof v === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

      // si no es uuid real, no intentamos update (pero con refresh ya deben ser uuid)
      if (!isUuid(t.id)) return;

      await dbUpsertTask({
        id: t.id,
        owner_id: user.id,
        prospect_id: t.prospectId || null,
        titulo: t.titulo,
        prioridad: t.prioridad,
        fecha: t.fecha,
        estado: t.estado,
        notas: t.notas || "",
      });

      // refresco para consistencia multiusuario
      const rows = role === "admin" ? await dbGetTasksWithOwner() : await dbGetTasks();
      const list = (rows ?? []).map((row) => ({
        id: row.id,
        prospectId: row.prospect_id || "",
        titulo: row.titulo,
        prioridad: row.prioridad,
        fecha: (row.fecha || "").slice(0, 10),
        estado: row.estado,
        notas: row.notas || "",
        ownerId: row.owner_id || "",
        ownerName: row.owner_name || row.ownerName || "—",
        ownerRole: row.owner_role || row.ownerRole || null,
      }));
      setTareas(list);
    } catch (e) {
      console.error(e);
      toast_("Error actualizando tarea en Supabase", false);
    }
  };
  const delTarea = async (id) => {
    // 1) UI inmediato (borra de tareas, no de actividades)
    const n = tareas.filter((t) => t.id !== id);
    setTareas(n);

    // 2) BD
    try {
      const { dbDeleteTask, dbGetTasks, dbGetTasksWithOwner } = await import("./db");

      const isUuid = (v) =>
        typeof v === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

      if (isUuid(id)) await dbDeleteTask(id);

      // refresco
      const rows = role === "admin" ? await dbGetTasksWithOwner() : await dbGetTasks();
      const list = (rows ?? []).map((row) => ({
        id: row.id,
        prospectId: row.prospect_id || "",
        titulo: row.titulo,
        prioridad: row.prioridad,
        fecha: (row.fecha || "").slice(0, 10),
        estado: row.estado,
        notas: row.notas || "",
        ownerId: row.owner_id || "",
        ownerName: row.owner_name || row.ownerName || "—",
        ownerRole: row.owner_role || row.ownerRole || null,
      }));
      setTareas(list);
    } catch (e) {
      console.error(e);
      toast_("Error eliminando tarea en Supabase", false);
    }
  };
  const addAct = async (a) => {
    const optimistic = [...acts, {
      id: uid(),
      fecha: a.fecha || today(),
      ...a,
      ownerId: user.id,
      ownerName: user?.user_metadata?.full_name || "—",
      ownerRole: role || "team",
    }];
    setActs(optimistic);

    try {
      const { dbInsertActivity, dbGetActivities } = await import("./db");

      console.log("1. Insertando actividad...");
      await dbInsertActivity({
        owner_id: user.id,
        tipo: a.tipo,
        cantidad: Number(a.cantidad || 1),
        fecha: a.fecha || today(),
        notas: a.notas || "",
      });
      console.log("2. Insertada OK. Leyendo actividades...");

      const rows = await dbGetActivities();
      console.log("3. Rows recibidos:", rows);

      const list = (rows ?? []).map((row) => ({
        id: row.id,
        tipo: row.tipo,
        cantidad: row.cantidad,
        fecha: (row.fecha || "").slice(0, 10),
        notas: row.notas || "",
        ownerId: row.owner_id || "",
        ownerName: row.owner_name || row.ownerName || "—",
        ownerRole: row.owner_role || row.ownerRole || null,
      }));

      console.log("4. Lista procesada:", list);
      if (list.length > 0) setActs(list);

    } catch (e) {
      console.error("❌ Error en addAct:", e);
      toast_("Error registrando actividad en Supabase", false);
    }

    toast_("✅ Actividad registrada");
    setModal(null);
  };

  const saveCfg = async (c) => {
    setCfg(c);

    try {
      const { dbUpdateConfig, dbGetConfig } = await import("./db");

      // patch a formato BD
      const patch = {
        agencia: c.agencia || "Top Seller",
        socios: c.socios || "",
        moneda: c.moneda || "MXN",
        meta_clientes: Number(c.metaClientes || 10),
        meta_ingresos: Number(c.metaIngresos || 50000),
        inversion: Number(c.inversion || 0),
        periodo_inicio: c.periodoInicio,
        periodo_fin: c.periodoFin,
      };

      await dbUpdateConfig(patch);

      // refresca config desde BD (consistencia)
      const row = await dbGetConfig();
      setCfg({
        ...DEFAULT_CONFIG,
        agencia: row.agencia,
        socios: row.socios,
        moneda: row.moneda,
        metaClientes: row.meta_clientes,
        metaIngresos: Number(row.meta_ingresos),
        inversion: Number(row.inversion),
        periodoInicio: (row.periodo_inicio || "").slice(0, 10),
        periodoFin: (row.periodo_fin || "").slice(0, 10),
      });
    } catch (e) {
      console.error(e);
      toast_("Error guardando configuración en Supabase", false);
      return;
    }

    toast_("✅ Configuración guardada");
    setModal(null);
  };

  // ── DASHBOARD ─────────────────────────────────────────────────────────────
  const Dashboard = () => {
    const gPct = Math.min(stats.closed / Number(cfg.metaClientes || 10) * 100, 100);
    const rPct = Math.min(stats.mrr / Number(cfg.metaIngresos || 50000) * 100, 100);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Goal Banners */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ background: "linear-gradient(135deg,#3730a3,#6d28d9)", borderRadius: 14, padding: 24, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", right: -20, top: -20, width: 130, height: 130, background: "rgba(255,255,255,.05)", borderRadius: "50%" }} />
            <div style={{ fontSize: 10, color: "rgba(255,255,255,.6)", fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>🎯 META CLIENTES</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 50, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{stats.closed}</span>
              <span style={{ fontSize: 24, color: "rgba(255,255,255,.35)", marginBottom: 4 }}>/{cfg.metaClientes || 10}</span>
            </div>
            <div style={{ background: "rgba(255,255,255,.2)", borderRadius: 6, height: 9, overflow: "hidden", marginBottom: 5 }}>
              <div style={{ height: "100%", width: `${gPct}%`, background: "rgba(255,255,255,.9)", borderRadius: 6, transition: "width .8s" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(255,255,255,.6)" }}>
              <span>{Math.round(gPct)}% completado</span><span>Proyección: {stats.proyect} al cierre</span>
            </div>
          </div>
          <div style={{ background: "linear-gradient(135deg,#065f46,#047857)", borderRadius: 14, padding: 24, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", right: -20, top: -20, width: 130, height: 130, background: "rgba(255,255,255,.05)", borderRadius: "50%" }} />
            <div style={{ fontSize: 10, color: "rgba(255,255,255,.6)", fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>💰 META INGRESOS</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 28, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{fm(stats.mrr, cfg.moneda)}</span>
            </div>
            <div style={{ background: "rgba(255,255,255,.2)", borderRadius: 6, height: 9, overflow: "hidden", marginBottom: 5 }}>
              <div style={{ height: "100%", width: `${rPct}%`, background: "rgba(255,255,255,.9)", borderRadius: 6, transition: "width .8s" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(255,255,255,.6)" }}>
              <span>{Math.round(rPct)}% de {fm(cfg.metaIngresos, cfg.moneda)}</span>
              {stats.roi !== null && <span>ROI: {stats.roi}%</span>}
            </div>
          </div>
        </div>

        {/* KPI Row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12 }}>
          {[
            { l: "Total Prospectos", v: stats.total, c: "#6366f1", sub: "en pipeline" },
            { l: "Propuestas", v: stats.propSent, c: "#8b5cf6", sub: "enviadas" },
            { l: "Actividades", v: stats.actTot, c: "#3b82f6", sub: "registradas" },
            { l: "Tareas hoy", v: stats.tarHoy.length, c: stats.tarHoy.length ? "#ef4444" : "#10b981", sub: "pendientes" },
            { l: "Conversión", v: `${stats.convRate}%`, c: "#f59e0b", sub: "tasa global" },
          ].map(k => (
            <div key={k.l} style={{ background: "#0d0d1a", border: `1px solid ${k.c}22`, borderTop: `3px solid ${k.c}`, borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: k.c, lineHeight: 1 }}>{k.v}</div>
              <div style={{ fontSize: 11, color: "#fff", fontWeight: 600, marginTop: 5 }}>{k.l}</div>
              <div style={{ fontSize: 10, color: "#374151" }}>{k.sub}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "5fr 3fr", gap: 16 }}>
          {/* Funnel + Activity */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={S.card}>
              <div style={S.ch}><span style={S.ct}>📊 Embudo de conversión</span><span style={S.bdg("#6366f1")}>{stats.convRate}% tasa</span></div>
              <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { l: "Prospectos totales", v: stats.total, c: "#6366f1" },
                  { l: "Contactados", v: stats.contacted, c: "#3b82f6" },
                  { l: "Propuestas enviadas", v: stats.propSent, c: "#8b5cf6" },
                  { l: "Clientes cerrados", v: stats.closed, c: "#10b981" },
                ].map((f, i, arr) => {
                  const p2 = arr[0].v ? Math.round(f.v / arr[0].v * 100) : 0; return (
                    <div key={f.l}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: "#9ca3af" }}>{f.l}</span>
                        <div style={S.row}><span style={{ fontSize: 11, color: f.c, fontWeight: 700 }}>{f.v}</span><span style={{ fontSize: 10, color: "#374151" }}>({p2}%)</span></div>
                      </div>
                      <PBar p={p2} color={f.c} />
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={S.card}>
              <div style={S.ch}><span style={S.ct}>⚡ Actividad esta semana</span><button style={S.btn("primary")} onClick={() => setModal({ type: "actividad" })}>+ Registrar</button></div>
              <div style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 10 }}>
                {ACT_TYPES.map(a => {
                  const cnt = stats.actW.filter(x => x.tipo === a.id).reduce((s, x) => s + (Number(x.cantidad) || 1), 0);
                  return (
                    <div key={a.id} style={{ textAlign: "center", background: "#07070f", borderRadius: 10, padding: 12, cursor: "pointer" }} onClick={() => setModal({ type: "actividad", pre: { tipo: a.id } })}>
                      <div style={{ fontSize: 22, marginBottom: 3 }}>{a.icon}</div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{cnt}</div>
                      <div style={{ fontSize: 9, color: "#4b5563", marginTop: 3 }}>{a.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right column alerts */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={S.card}>
              <div style={S.ch}><span style={S.ct}>🧊 Prospectos fríos</span><span style={S.bdg("#ef4444")}>{stats.frios.length}</span></div>
              <div style={{ padding: 12 }}>
                {stats.frios.length === 0
                  ? <div style={{ fontSize: 12, color: "#374151", textAlign: "center", padding: 16 }}>¡Todos tus prospectos están activos! 🔥</div>
                  : stats.frios.slice(0, 5).map(p => (
                    <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid #14142a", cursor: "pointer" }} onClick={() => setModal({ type: "prospect", tab: p._tab, person: p })}>
                      <div><div style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{p.nombre}</div><div style={{ fontSize: 10, color: "#ef4444" }}>{ds(p.updatedAt || p.creadoEn)}d sin actividad</div></div>
                      <span style={S.bdg(TM[p._tab].color)}>{TM[p._tab].icon}</span>
                    </div>
                  ))
                }
              </div>
            </div>
            <div style={S.card}>
              <div style={S.ch}><span style={S.ct}>✅ Tareas hoy</span></div>
              <div style={{ padding: 12 }}>
                {stats.tarHoy.length === 0
                  ? <div style={{ fontSize: 12, color: "#374151", textAlign: "center", padding: 16 }}>Sin tareas pendientes</div>
                  : stats.tarHoy.slice(0, 5).map(t => (
                    <div key={t.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "7px 0", borderBottom: "1px solid #14142a" }}>
                      <Chk on={false} color="#10b981" onChange={() => toggleTarea(t.id)} />
                      <div style={{ flex: 1 }}><div style={{ fontSize: 12, color: "#fff" }}>{t.titulo}</div><div style={{ fontSize: 10, color: PRIO_C[t.prioridad] }}>{t.prioridad}</div></div>
                    </div>
                  ))
                }
                {stats.tarHoy.length > 5 && <div style={{ fontSize: 10, color: "#374151", textAlign: "center", paddingTop: 8 }}>+{stats.tarHoy.length - 5} más</div>}
              </div>
            </div>
            <div style={S.card}>
              <div style={S.ch}><span style={S.ct}>📈 Proyección del mes</span></div>
              <div style={{ padding: 18, textAlign: "center" }}>
                <div style={{ fontSize: 42, fontWeight: 900, color: "#6366f1", lineHeight: 1 }}>{stats.proyect}</div>
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>clientes proyectados</div>
                <div style={{ fontSize: 11, color: stats.proyect >= Number(cfg.metaClientes) ? "#10b981" : "#ef4444", fontWeight: 700, marginTop: 8 }}>
                  {stats.proyect >= Number(cfg.metaClientes) ? "🎉 ¡Vas a alcanzar la meta!" : "⚠️ Necesitas acelerar el ritmo"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent */}
        <div style={S.card}>
          <div style={S.ch}><span style={S.ct}>🕐 Últimos registros</span></div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={S.th}>Nombre</th><th style={S.th}>Canal</th><th style={S.th}>Progreso</th><th style={S.th}>Temp.</th><th style={S.th}>Estado</th></tr></thead>
            <tbody>
              {allP.sort((a, b) => (b.updatedAt || b.creadoEn || "").localeCompare(a.updatedAt || a.creadoEn || "")).slice(0, 7).map(p => {
                const pc = pct(p, p._tab); const cl = isClosed(p, p._tab); const temp = calcTemp(p, p._tab, tareas);
                return (
                  <tr key={p.id} style={{ cursor: "pointer" }} onMouseEnter={e => e.currentTarget.style.background = "#0f0f1c"} onMouseLeave={e => e.currentTarget.style.background = "transparent"} onClick={() => setModal({ type: "prospect", tab: p._tab, person: p })}>
                    <td style={S.td}><div style={{ fontWeight: 600, color: "#fff" }}>{p.nombre}</div><div style={{ fontSize: 10, color: "#374151" }}>{fd(p.updatedAt || p.creadoEn)}</div></td>
                    <td style={S.td}><span style={S.bdg(TM[p._tab].color)}>{TM[p._tab].icon} {TM[p._tab].label}</span></td>
                    <td style={{ ...S.td, minWidth: 120 }}><div style={S.row}><PBar p={pc} color={TM[p._tab].color} /><span style={{ fontSize: 10, color: "#6b7280", whiteSpace: "nowrap" }}>{pc}%</span></div></td>
                    <td style={S.td}><span title={temp.l} style={{ fontSize: 16 }}>{temp.e}</span></td>
                    <td style={S.td}><span style={S.bdg(cl ? "#10b981" : p.perdido ? "#ef4444" : "#374151")}>{cl ? "✅ Cerrado" : p.perdido ? "❌ Perdido" : "🔄 Activo"}</span></td>
                  </tr>
                );
              })}
              {allP.length === 0 && <tr><td colSpan={5} style={{ ...S.td, textAlign: "center", color: "#374151", padding: 36 }}>¡Agrega tu primer prospecto desde las listas! 🚀</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ── KANBAN ────────────────────────────────────────────────────────────────
  const Kanban = () => {
    const filtered = allP.filter(p => kFilter === "all" || p._tab === kFilter);
    const byStage = Object.fromEntries(KANBAN_COLS.map(st => [st, filtered.filter(p => kStage(p, p._tab) === st)]));
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[{ id: "all", label: "Todos los canales" }, ...LIST_TABS.map(t => ({ id: t, label: TM[t].label, color: TM[t].color }))].map(f => (
            <button key={f.id} style={{ ...S.btn(kFilter === f.id ? "primary" : "secondary", f.color), padding: "6px 14px" }} onClick={() => setKFilter(f.id)}>{f.id === "all" ? "🌐" : ""} {f.label}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 16, alignItems: "flex-start" }}>
          {KANBAN_COLS.filter(st => st !== "Perdido ❌" || (byStage["Perdido ❌"] || []).length > 0).map(stage => {
            const cards = byStage[stage] || []; const color = KC[stage];
            return (
              <div key={stage} style={{ minWidth: 215, flex: "0 0 215px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color }}>{stage}</span>
                  <span style={S.bdg(color)}>{cards.length}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {cards.map(p => {
                    const pc = pct(p, p._tab); const temp = calcTemp(p, p._tab, tareas);
                    const nt = tareas.find(t => t.prospectId === p.id && t.estado === "pendiente");
                    return (
                      <div key={p.id} style={{ background: "#0d0d1a", border: `1px solid ${color}33`, borderRadius: 10, padding: 14, cursor: "pointer", transition: "border-color .2s" }}
                        onClick={() => setModal({ type: "prospect", tab: p._tab, person: p })}
                        onMouseEnter={e => e.currentTarget.style.borderColor = color}
                        onMouseLeave={e => e.currentTarget.style.borderColor = color + "33"}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                          <div style={{ fontWeight: 700, color: "#fff", fontSize: 13 }}>{p.nombre}</div>
                          <span title={temp.l}>{temp.e}</span>
                        </div>
                        <div style={{ marginBottom: 8 }}><span style={S.bdg(TM[p._tab].color)}>{TM[p._tab].icon} {TM[p._tab].label}</span></div>
                        <PBar p={pc} color={color} />
                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
                          <span style={{ fontSize: 10, color: "#374151" }}>{pc}%</span>
                          {p.venta?.monto && <span style={{ fontSize: 10, color: "#10b981", fontWeight: 700 }}>{fm(p.venta.monto, cfg.moneda)}</span>}
                        </div>
                        {nt && <div style={{ fontSize: 10, color: "#f59e0b", marginTop: 6 }}>→ {nt.titulo}</div>}
                      </div>
                    );
                  })}
                  {cards.length === 0 && <div style={{ fontSize: 11, color: "#1a1a2e", textAlign: "center", padding: "18px 0" }}>—</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── LIST VIEW ─────────────────────────────────────────────────────────────
  const ListView = ({ tab }) => {
    const color = TM[tab].color; const stages = STAGES[tab];
    const [bq, setBq] = useState(""); const [ef, setEf] = useState("all");
    const list = pros[tab].filter(p => {
      const mb = !bq || Object.values(p).join(" ").toLowerCase().includes(bq.toLowerCase());
      const me = ef === "all" || (ef === "cerrado" && isClosed(p, tab)) || (ef === "activo" && !isClosed(p, tab) && !p.perdido) || (ef === "perdido" && p.perdido);
      return mb && me;
    });
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <input style={{ ...S.inp, flex: 1 }} placeholder="🔍 Buscar..." value={bq} onChange={e => setBq(e.target.value)} />
          <select style={{ ...S.inp, width: "auto" }} value={ef} onChange={e => setEf(e.target.value)}>
            <option value="all">Todos</option><option value="activo">Activos</option><option value="cerrado">Cerrados</option><option value="perdido">Perdidos</option>
          </select>
        </div>
        <div style={S.card}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={S.th}>Nombre</th><th style={S.th}>Contacto</th>
                {tab === "referidos" && <th style={S.th}>Referente</th>}
                {tab === "referidores" && <th style={S.th}>Comisión</th>}
                {tab === "facebook" && <th style={S.th}>Facebook</th>}
                {stages.map(st => <th key={st} style={{ ...S.th, textAlign: "center", padding: "9px 6px", fontSize: 9, maxWidth: 56 }}>{st.replace("Realizada", "Real.").replace("Testimonio", "Test.").replace("Avatar", "Avt.").replace("Sesión", "Ses.")}</th>)}
                {isAdmin && <th style={S.th}>Propietario</th>}
                <th style={S.th}>Tmp</th><th style={S.th}></th>
              </tr></thead>
              <tbody>
                {list.length === 0 && <tr><td colSpan={20} style={{ ...S.td, textAlign: "center", color: "#374151", padding: 36 }}>{pros[tab].length === 0 ? "¡Agrega tu primer registro! 🚀" : "Sin resultados"}</td></tr>}
                {list.map(p => {
                  const cl = isClosed(p, tab); const temp = calcTemp(p, tab, tareas);
                  return (
                    <tr key={p.id} style={{ background: cl ? "rgba(16,185,129,.04)" : p.perdido ? "rgba(239,68,68,.04)" : "transparent" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#0e0e1c"} onMouseLeave={e => e.currentTarget.style.background = cl ? "rgba(16,185,129,.04)" : p.perdido ? "rgba(239,68,68,.04)" : "transparent"}>
                      <td style={S.td}><div style={{ fontWeight: 600, color: "#fff", cursor: "pointer" }} onClick={() => setModal({ type: "prospect", tab, person: p })}>{p.nombre || "—"}</div><div style={{ fontSize: 10, color: "#374151" }}>{fd(p.creadoEn)}</div></td>
                      <td style={{ ...S.td, whiteSpace: "nowrap" }}><div style={{ fontSize: 12, color: "#9ca3af" }}>{p.telefono || "—"}</div><div style={{ fontSize: 10, color: "#374151" }}>{p.correo}</div></td>
                      <td style={{ ...S.td, whiteSpace: "nowrap" }}>
                        <div style={{ fontSize: 12, color: "#9ca3af" }}>
                          👤 {p.owner_name || "Sin propietario"}
                        </div>
                      </td>
                      {tab === "referidos" && <td style={{ ...S.td, fontSize: 12, color: "#10b981" }}>{p.quienRefiere || "—"}</td>}
                      {tab === "referidores" && <td style={{ ...S.td, fontSize: 12, color: "#10b981" }}>{p.comision || "—"}</td>}
                      {tab === "facebook" && <td style={{ ...S.td, fontSize: 12, color: "#818cf8" }}>{p.facebook || "—"}</td>}
                      {stages.map(st => (<td key={st} style={{ ...S.td, textAlign: "center", padding: "10px 6px" }}><div style={{ display: "flex", justifyContent: "center" }}><Chk on={!!p.stages?.[st]} color={color} onChange={() => toggleStage(tab, p.id, st)} /></div></td>))}
                      <td style={S.td}><span title={temp.l} style={{ fontSize: 16 }}>{temp.e}</span></td>
                      <td style={{ ...S.td, whiteSpace: "nowrap" }}><div style={{ display: "flex", gap: 6 }}>
                        <button style={{ ...S.btn("secondary"), padding: "4px 9px", fontSize: 11 }} onClick={() => setModal({ type: "prospect", tab, person: p })}>✏️</button>
                        <button style={{ ...S.btn("danger"), padding: "4px 9px", fontSize: 11 }} onClick={() => delP(tab, p.id)}>✕</button>
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "10px 18px", borderTop: "1px solid #14142a", display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: "#374151" }}>{list.length} registros</span>
            <span style={{ fontSize: 11, color: TM[tab].color, fontWeight: 700 }}>{pros[tab].filter(p => isClosed(p, tab)).length} cerrados / {pros[tab].length} total</span>
          </div>
        </div>
      </div>
    );
  };

  // ── TAREAS ────────────────────────────────────────────────────────────────
  const Tareas = () => {
    const [f, setF] = useState("pendiente");
    const list = tareas.filter(t => f === "all" || (f === "pendiente" && t.estado === "pendiente") || (f === "completada" && t.estado === "completada")).sort((a, b) => a.fecha.localeCompare(b.fecha));
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {["pendiente", "completada", "all"].map(x => (
            <button key={x} style={{ ...S.btn(f === x ? "primary" : "secondary"), padding: "6px 14px" }} onClick={() => setF(x)}>
              {x === "pendiente" ? "⏳ Pendientes" : x === "completada" ? "✅ Completadas" : "📋 Todas"}
              {x === "pendiente" && tareas.filter(t => t.estado === "pendiente").length > 0 && <span style={{ marginLeft: 6, background: "rgba(255,255,255,.2)", borderRadius: 10, padding: "0 6px", fontSize: 10 }}>{tareas.filter(t => t.estado === "pendiente").length}</span>}
            </button>
          ))}
        </div>
        <div style={S.card}>
          {list.length === 0 && <div style={{ textAlign: "center", color: "#374151", padding: 40, fontSize: 13 }}>Sin tareas aquí.</div>}
          {list.map(t => {
            const prospect = allP.find(p => p.id === t.prospectId);
            const overdue = t.fecha < today() && t.estado === "pendiente";
            return (
              <div key={t.id} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "13px 18px", borderBottom: "1px solid #14142a", background: t.estado === "completada" ? "rgba(16,185,129,.03)" : "transparent" }}>
                <div style={{ paddingTop: 2 }}><Chk on={t.estado === "completada"} color="#10b981" onChange={() => toggleTarea(t.id)} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: t.estado === "completada" ? "#4b5563" : "#fff", textDecoration: t.estado === "completada" ? "line-through" : "none" }}>{t.titulo}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap", alignItems: "center" }}>
                    {prospect && <span style={S.bdg(TM[prospect._tab].color)}>{TM[prospect._tab].icon} {prospect.nombre}</span>}
                    <span style={S.bdg(PRIO_C[t.prioridad] || "#374151")}>{t.prioridad}</span>
                    {isAdmin && <span style={S.bdg("#eeeeeeee")}>👤 {t.ownerName || "—"}</span>}
                    <span style={{ fontSize: 10, color: overdue ? "#ef4444" : "#6b7280" }}>{fd(t.fecha)}{overdue ? " ⚠️" : ""}</span>
                  </div>
                  {t.notas && <div style={{ fontSize: 11, color: "#4b5563", marginTop: 4 }}>{t.notas}</div>}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button style={{ ...S.btn("secondary"), padding: "4px 9px", fontSize: 11 }} onClick={() => setModal({ type: "tarea", tarea: t })}>✏️</button>
                  <button style={{ ...S.btn("danger"), padding: "4px 9px", fontSize: 11 }} onClick={() => delTarea(t.id)}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── AGENDA ────────────────────────────────────────────────────────────────
  const Agenda = () => {
    const week = []; const s = new Date(); s.setDate(s.getDate() - s.getDay() + 1);
    for (let i = 0; i < 7; i++) { const d = new Date(s); d.setDate(d.getDate() + i); week.push(d.toISOString().split("T")[0]); }
    return (
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 10 }}>
          {week.map(d => {
            const dt = tareas.filter(t => t.fecha === d);
            const dn = new Date(d + "T12:00:00").toLocaleDateString("es-MX", { weekday: "short" });
            const dd = new Date(d + "T12:00:00").getDate();
            const isT = d === today();
            return (
              <div key={d} style={{ background: isT ? "rgba(99,102,241,.1)" : "#0d0d1a", border: `1px solid ${isT ? "#6366f1" : "#14142a"}`, borderRadius: 12, padding: 12, minHeight: 160 }}>
                <div style={{ textAlign: "center", marginBottom: 10 }}>
                  <div style={{ fontSize: 9, color: isT ? "#818cf8" : "#374151", fontWeight: 700, textTransform: "uppercase" }}>{dn}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: isT ? "#6366f1" : "#fff", lineHeight: 1.2 }}>{dd}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {dt.map(t => (
                    <div key={t.id} style={{ background: PRIO_C[t.prioridad] + "18", border: `1px solid ${PRIO_C[t.prioridad] || "#374151"}33`, borderRadius: 6, padding: "5px 8px", cursor: "pointer" }} onClick={() => setModal({ type: "tarea", tarea: t })}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#fff" }}>{t.titulo}</div>
                      {isAdmin && <span style={S.bdg("#eeeeeeee")}>👤 {t.ownerName || "—"}</span>}
                      {t.estado === "completada" && <div style={{ fontSize: 9, color: "#10b981" }}>✓ Hecha</div>}
                    </div>
                  ))}
                  {dt.length === 0 && <div style={{ fontSize: 10, color: "#1a1a2e", textAlign: "center", paddingTop: 6 }}>—</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };
  // ── PRODUCTIVIDAD ─────────────────────────────────────────────────────────
  const Productividad = () => {
    const [limit, setLimit] = useState(20);
    const wAgo = new Date(Date.now() - 7 * 864e5).toISOString().split("T")[0];
    const mS = today().slice(0, 7) + "-01";
    const byType = Object.fromEntries(ACT_TYPES.map(a => [a.id, { s: 0, m: 0, t: 0 }]));
    acts.forEach(a => { if (!byType[a.tipo]) return; const q = Number(a.cantidad) || 1; byType[a.tipo].t += q; if (a.fecha >= wAgo) byType[a.tipo].s += q; if (a.fecha >= mS) byType[a.tipo].m += q; });
    const totS = Object.values(byType).reduce((a, x) => a + x.s, 0);
    const totM = Object.values(byType).reduce((a, x) => a + x.m, 0);
    const mx = Math.max(...Object.values(byType).map(x => x.s), 1);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
          {[{ l: "Esta semana", v: totS, c: "#6366f1" }, { l: "Este mes", v: totM, c: "#10b981" }, { l: "Total histórico", v: stats.actTot, c: "#f59e0b" }].map(k => (
            <div key={k.l} style={{ ...S.card, padding: 20, borderTop: `3px solid ${k.c}` }}>
              <div style={{ fontSize: 36, fontWeight: 900, color: k.c, lineHeight: 1 }}>{k.v}</div>
              <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 6 }}>{k.l} · actividades</div>
            </div>
          ))}
        </div>
        <div style={S.card}>
          <div style={S.ch}><span style={S.ct}>Desglose por tipo</span></div>
          <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
            {ACT_TYPES.map(a => (
              <div key={a.id}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 13, color: "#9ca3af" }}>{a.icon} {a.label}</span>
                  <div style={S.row}>
                    <span style={{ fontSize: 11, color: "#6366f1", fontWeight: 700 }}>{byType[a.id].s} sem.</span>
                    <span style={{ fontSize: 11, color: "#374151" }}>{byType[a.id].m} mes</span>
                    <span style={{ fontSize: 11, color: "#1a1a2e" }}>{byType[a.id].t} total</span>
                  </div>
                </div>
                <PBar p={Math.round(byType[a.id].s / mx * 100)} color="#6366f1" />
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
          {[
            { l: "Actividades / cliente", v: stats.closed > 0 ? Math.round(stats.actTot / stats.closed) + "x" : stats.actTot, sub: "registradas por cada venta", c: "#6366f1" },
            { l: "Propuestas enviadas", v: stats.propSent, sub: `${stats.total ? Math.round(stats.propSent / stats.total * 100) : 0}% de los prospectos`, c: "#8b5cf6" },
            { l: "Ratio de contactos", v: `1:${stats.closed > 0 ? Math.round(stats.contacted / stats.closed) : "∞"}`, sub: "contactados por cliente cerrado", c: "#f59e0b" },
          ].map(k => (
            <div key={k.l} style={{ ...S.card, padding: 18, borderTop: `2px solid ${k.c}` }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: k.c }}>{k.v}</div>
              <div style={{ fontSize: 11, color: "#fff", fontWeight: 600, marginTop: 4 }}>{k.l}</div>
              <div style={{ fontSize: 10, color: "#374151" }}>{k.sub}</div>
            </div>
          ))}
        </div>
        <div style={S.card}>
          <div style={S.ch}>
            <span style={S.ct}>Historial</span>
            <button style={S.btn("primary")} onClick={() => setModal({ type: "actividad" })}>
              + Registrar
            </button>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={S.th}>Tipo</th>
                <th style={S.th}>Cant.</th>
                <th style={S.th}>Fecha</th>
                {isAdmin && <th style={S.th}>Propietario</th>}
                <th style={S.th}>Notas</th>
              </tr>
            </thead>

            <tbody>
              {acts.slice(0, limit).map(a => {
                const at = ACT_TYPES.find(x => x.id === a.tipo) || { icon: "⚡", label: a.tipo };

                return (
                  <tr key={a.id}>
                    <td style={S.td}>
                      <span style={S.bdg("#6366f1")}>{at.icon} {at.label}</span>
                    </td>

                    <td style={{ ...S.td, fontWeight: 700, color: "#fff" }}>
                      {a.cantidad || 1}
                    </td>

                    <td style={{ ...S.td, fontSize: 12, color: "#6b7280" }}>
                      {fd(a.fecha)}
                    </td>

                    {isAdmin && (
                      <td style={{ ...S.td, fontSize: 12, color: "#93c5fd" }}>
                        {a.ownerName || "—"}
                      </td>
                    )}

                    <td style={{ ...S.td, fontSize: 12, color: "#4b5563" }}>
                      {a.notas || "—"}
                    </td>
                  </tr>
                );
              })}

              {acts.length === 0 && (
                <tr>
                  <td
                    colSpan={isAdmin ? 5 : 4}
                    style={{ ...S.td, textAlign: "center", color: "#374151", padding: 28 }}
                  >
                    Sin actividades registradas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {acts.length > limit && (
            <div style={{ padding: 16, textAlign: "center", borderTop: "1px solid #14142a" }}>
              <button
                style={S.btn("secondary")}
                onClick={() => setLimit(l => l + 20)}
              >
                Ver más ({acts.length - limit} restantes)
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── MODO VENDEDOR ─────────────────────────────────────────────────────────
  const ModoVendedor = () => {
    const hoy = tareas.filter(t => t.estado === "pendiente" && t.fecha <= today()).sort((a, b) => (["Alta", "Media", "Baja"].indexOf(a.prioridad)) - ["Alta", "Media", "Baja"].indexOf(b.prioridad));
    return (
      <div style={{ maxWidth: 460, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ background: "linear-gradient(135deg,#1e1b4b,#312e81)", borderRadius: 14, padding: 22, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 6 }}>🚀</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>Modo Vendedor</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.6)", marginTop: 4 }}>{hoy.length} tareas para hoy · {new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}</div>
        </div>
        {hoy.length === 0 && (
          <div style={{ ...S.card, padding: 36, textAlign: "center" }}>
            <div style={{ fontSize: 42, marginBottom: 10 }}>🎉</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>¡Todo al día!</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>No hay tareas pendientes para hoy.</div>
          </div>
        )}
        {hoy.map(t => {
          const prospect = allP.find(p => p.id === t.prospectId);
          return (
            <div key={t.id} style={{ ...S.card, padding: 18, borderLeft: `4px solid ${PRIO_C[t.prioridad] || "#6366f1"}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div><div style={{ fontWeight: 700, color: "#fff", fontSize: 15 }}>{t.titulo}</div><span style={S.bdg(PRIO_C[t.prioridad] || "#6366f1")}>{t.prioridad}</span></div>
                {isAdmin && <span style={S.bdg("#eeeeeeee")}>👤 {t.ownerName || "—"}</span>}
                <Chk on={false} color="#10b981" onChange={() => toggleTarea(t.id)} />
              </div>
              {prospect && (
                <div style={{ background: "#07070f", borderRadius: 10, padding: 14, marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, color: "#fff", marginBottom: 4 }}>{prospect.nombre}</div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>{prospect.telefono || prospect.correo || "Sin datos de contacto"}</div>
                  {prospect.telefono && (
                    <a href={`https://wa.me/${prospect.telefono.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#128c7e", color: "#fff", padding: "8px 16px", borderRadius: 8, textDecoration: "none", fontSize: 12, fontWeight: 700 }}>
                      💬 Abrir en WhatsApp
                    </a>
                  )}
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {[["📞 Llamé", "llamada"], ["📅 Agendé", "reunion"], ["❌ No contestó", "seguimiento"]].map(([label, tipo]) => (
                  <button key={label} style={{ ...S.btn("secondary"), padding: "9px 0", fontSize: 11, textAlign: "center" }} onClick={() => { addAct({ tipo, cantidad: 1, notas: `${label} — ${prospect?.nombre || ""}`, fecha: today() }); toggleTarea(t.id); }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        <button style={{ ...S.btn("primary"), padding: 14, textAlign: "center", display: "block", width: "100%" }} onClick={() => setModal({ type: "actividad" })}>⚡ Registrar otra actividad</button>
      </div>
    );
  };

  // ── REPORTE ───────────────────────────────────────────────────────────────
  const Reporte = () => {
    const copyR = () => {
      const t = `REPORTE COMERCIAL — ${cfg.agencia || "Top Seller"}\n${fd(cfg.periodoInicio)} — ${fd(cfg.periodoFin)}${cfg.socios ? "\nPara: " + cfg.socios : ""}\n\n` +
        `META: ${stats.closed}/${cfg.metaClientes} clientes (${Math.round(Math.min(stats.closed / cfg.metaClientes * 100, 100))}%)\n` +
        `INGRESOS: ${fm(stats.mrr, cfg.moneda)} | Ticket prom: ${fm(stats.ticket, cfg.moneda)}\n` +
        `ROI: ${stats.roi !== null ? stats.roi + "%" : "Sin inversión"} | Conversión: ${stats.convRate}%\n\n` +
        `EMBUDO:\nProspectos: ${stats.total} → Contactados: ${stats.contacted} → Propuestas: ${stats.propSent} → Cerrados: ${stats.closed}\n\n` +
        `PRODUCTIVIDAD:\n` + ACT_TYPES.map(a => `${a.label}: ${acts.filter(x => x.tipo === a.id).reduce((s, x) => s + (Number(x.cantidad) || 1), 0)}`).join(" | ");
      navigator.clipboard?.writeText(t).then(() => toast_("📋 Copiado al portapapeles")).catch(() => toast_("Error al copiar", false));
    };
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ ...S.card, padding: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: "#6366f1", fontWeight: 700, letterSpacing: 3, marginBottom: 6 }}>{(cfg.agencia || "TOP SELLER").toUpperCase()}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: -1 }}>Reporte Comercial</div>
              <div style={{ fontSize: 12, color: "#4b5563" }}>{fd(cfg.periodoInicio)} — {fd(cfg.periodoFin)}</div>
              {cfg.socios && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Para: {cfg.socios}</div>}
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <button style={S.btn("secondary")} onClick={copyR}>📋 Copiar</button>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 10, color: "#6b7280" }}>CLIENTES</div>
                <div style={{ fontSize: 40, fontWeight: 900, color: "#6366f1", lineHeight: 1 }}>{stats.closed}/{cfg.metaClientes}</div>
              </div>
            </div>
          </div>

          {/* Goal bar */}
          <div style={{ background: "#07070f", borderRadius: 10, padding: 18, marginBottom: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>Avance hacia meta</span>
              <span style={{ fontSize: 12, color: "#6366f1", fontWeight: 700 }}>{Math.round(Math.min(stats.closed / cfg.metaClientes * 100, 100))}%</span>
            </div>
            <PBar p={Math.min(stats.closed / Number(cfg.metaClientes || 10) * 100, 100)} color="#6366f1" h={12} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: "#374151" }}>
              <span>Proyección fin de mes: {stats.proyect} clientes</span>
              <span>Inversión pub.: {Number(cfg.inversion) > 0 ? fm(cfg.inversion, cfg.moneda) : "$0 (100% orgánico)"}</span>
            </div>
          </div>

          {/* Financial KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 22 }}>
            {[
              { l: "Ingresos generados", v: fm(stats.mrr, cfg.moneda), c: "#10b981" },
              { l: "LTV estimado", v: fm(stats.ltv, cfg.moneda), c: "#6366f1" },
              { l: "Ticket promedio", v: fm(stats.ticket, cfg.moneda), c: "#3b82f6" },
              { l: "ROI publicidad", v: stats.roi !== null ? `${stats.roi}%` : "Orgánico", c: "#f59e0b" },
            ].map(k => (
              <div key={k.l} style={{ background: "#07070f", borderRadius: 10, padding: 16, borderTop: `2px solid ${k.c}` }}>
                <div style={{ fontSize: 11, color: "#374151", marginBottom: 4 }}>{k.l}</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: k.c }}>{k.v}</div>
              </div>
            ))}
          </div>

          {/* Funnel */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 10, color: "#374151", fontWeight: 700, letterSpacing: 2, marginBottom: 12 }}>EMBUDO DE CONVERSIÓN</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
              {[
                { l: "Prospectos", v: stats.total, c: "#6366f1" },
                { l: "Contactados", v: stats.contacted, c: "#3b82f6" },
                { l: "Propuestas", v: stats.propSent, c: "#8b5cf6" },
                { l: "Cerrados", v: stats.closed, c: "#10b981" },
              ].map(f => {
                const p2 = stats.total ? Math.round(f.v / stats.total * 100) : 0; return (
                  <div key={f.l} style={{ background: "#07070f", borderRadius: 10, padding: 14, textAlign: "center" }}>
                    <div style={{ fontSize: 28, fontWeight: 900, color: f.c }}>{f.v}</div>
                    <div style={{ fontSize: 10, color: "#374151", marginTop: 2 }}>{f.l}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: f.c, marginTop: 2 }}>{p2}%</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ventas table */}
          {stats.ventasP.length > 0 && (
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 10, color: "#374151", fontWeight: 700, letterSpacing: 2, marginBottom: 12 }}>VENTAS CERRADAS</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={S.th}>Cliente</th><th style={S.th}>Canal</th><th style={S.th}>Monto</th><th style={S.th}>Tipo</th><th style={S.th}>Plazo</th><th style={S.th}>LTV</th><th style={S.th}>Servicio</th></tr></thead>
                <tbody>
                  {stats.ventasP.map(p => (
                    <tr key={p.id}>
                      <td style={S.td}><span style={{ fontWeight: 600, color: "#fff" }}>{p.nombre}</span></td>
                      <td style={S.td}><span style={S.bdg(TM[p._tab].color)}>{TM[p._tab].icon}</span></td>
                      <td style={{ ...S.td, fontWeight: 700, color: "#10b981" }}>{fm(p.venta.monto, cfg.moneda)}</td>
                      <td style={{ ...S.td, fontSize: 11, color: "#6b7280" }}>{p.venta.tipo}</td>
                      <td style={{ ...S.td, fontSize: 11, color: "#9ca3af" }}>{p.venta.plazo || "—"} mes(es)</td>
                      <td style={{ ...S.td, fontWeight: 700, color: "#6366f1" }}>{fm(Number(p.venta.monto) * Number(p.venta.plazo || 1), cfg.moneda)}</td>
                      <td style={{ ...S.td, fontSize: 11, color: "#6b7280" }}>{p.venta.servicio || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Productividad */}
          <div>
            <div style={{ fontSize: 10, color: "#374151", fontWeight: 700, letterSpacing: 2, marginBottom: 12 }}>PRODUCTIVIDAD COMERCIAL</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
              {ACT_TYPES.map(a => {
                const cnt = acts.filter(x => x.tipo === a.id).reduce((s, x) => s + (Number(x.cantidad) || 1), 0); return (
                  <div key={a.id} style={{ display: "flex", gap: 10, alignItems: "center", background: "#07070f", borderRadius: 8, padding: "10px 14px" }}>
                    <span style={{ fontSize: 20 }}>{a.icon}</span>
                    <div><div style={{ fontWeight: 700, color: "#fff", fontSize: 18 }}>{cnt}</div><div style={{ fontSize: 10, color: "#374151" }}>{a.label}</div></div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── CONFIG ────────────────────────────────────────────────────────────────
  const Config = () => {
    const [lc, setLc] = useState({ ...cfg });
    return (
      <div style={{ maxWidth: 580, display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={S.card}>
          <div style={S.ch}><span style={S.ct}>⚙️ Configuración General</span></div>
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={S.g2}>
              <div><label style={S.lbl}>Nombre de la agencia</label><input style={S.inp} value={lc.agencia || ""} onChange={e => setLc(x => ({ ...x, agencia: e.target.value }))} /></div>
              <div><label style={S.lbl}>Moneda</label>
                <select style={S.inp} value={lc.moneda || "MXN"} onChange={e => setLc(x => ({ ...x, moneda: e.target.value }))}>
                  <option>MXN</option><option>USD</option><option>EUR</option><option>COP</option><option>ARS</option>
                </select>
              </div>
            </div>
            <div><label style={S.lbl}>Socios (separados por coma)</label><input style={S.inp} value={lc.socios || ""} onChange={e => setLc(x => ({ ...x, socios: e.target.value }))} placeholder="Carlos, María, Luis" /></div>
            <div style={S.g2}>
              <div><label style={S.lbl}>Meta de clientes este mes</label><input type="number" style={S.inp} value={lc.metaClientes || 10} onChange={e => setLc(x => ({ ...x, metaClientes: e.target.value }))} /></div>
              <div><label style={S.lbl}>Meta de ingresos</label><input type="number" style={S.inp} value={lc.metaIngresos || 50000} onChange={e => setLc(x => ({ ...x, metaIngresos: e.target.value }))} /></div>
            </div>
            <div><label style={S.lbl}>Inversión en publicidad este periodo (0 = estrategia orgánica)</label><input type="number" style={S.inp} value={lc.inversion || 0} onChange={e => setLc(x => ({ ...x, inversion: e.target.value }))} /></div>
            <div style={S.g2}>
              <div><label style={S.lbl}>Inicio del periodo</label><input type="date" style={S.inp} value={lc.periodoInicio || ""} onChange={e => setLc(x => ({ ...x, periodoInicio: e.target.value }))} /></div>
              <div><label style={S.lbl}>Fin del periodo</label><input type="date" style={S.inp} value={lc.periodoFin || ""} onChange={e => setLc(x => ({ ...x, periodoFin: e.target.value }))} /></div>
            </div>
            <button style={{ ...S.btn("primary"), padding: 12 }} onClick={() => saveCfg(lc)}>💾 Guardar configuración</button>
          </div>
        </div>
      </div>
    );
  };

  // ── MODALS ────────────────────────────────────────────────────────────────
  const ProspectModal = () => {
    const isNew = !modal.person?.id || !allP.find(p => p.id === modal.person?.id);
    const [form, setForm] = useState(() => modal.person ? { ...modal.person } : { id: uid(), tab: modal.tab, stages: {}, notasHistorial: [], creadoEn: today(), updatedAt: today() });
    const [tab_, setTab_] = useState("datos");
    const [nNota, setNNota] = useState("");
    const tab = form.tab || modal.tab; const color = TM[tab]?.color || "#6366f1";
    const addNotaLocal = () => { if (!nNota.trim()) return; const n = { id: uid(), texto: nNota, fecha: today() }; setForm(f => ({ ...f, notasHistorial: [...(f.notasHistorial || []), n] })); setNNota(""); };
    return (
      <div style={S.modal} onClick={e => { if (e.target === e.currentTarget) setModal(null) }}>
        <div style={S.mbox}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #1a1a2e", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
            <div><div style={{ fontSize: 10, color, fontWeight: 700, letterSpacing: 2 }}>{TM[tab]?.icon} {TM[tab]?.label?.toUpperCase()}</div><div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>{isNew ? "Nuevo registro" : "Editar registro"}</div></div>
            <button style={S.btn("ghost")} onClick={() => setModal(null)}>✕</button>
          </div>
          <div style={{ display: "flex", gap: 4, padding: "10px 20px", borderBottom: "1px solid #1a1a2e", flexShrink: 0 }}>
            {[["datos", "👤 Datos"], ["etapas", "📊 Etapas"], ["notas", "📝 Historial"], ["venta", "💰 Venta"]].map(([id, label]) => (
              <button key={id} style={{ ...S.btn(tab_ === id ? "primary" : "secondary", tab_ === id ? color : undefined), padding: "5px 12px" }} onClick={() => setTab_(id)}>{label}</button>
            ))}
          </div>
          <div style={{ padding: 20, overflow: "auto", flex: 1 }}>
            {tab_ === "datos" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {(FIELDS[tab] || []).map(key => (
                  <div key={key} style={key === "nombre" ? { gridColumn: "1/-1" } : {}}>
                    <label style={S.lbl}>{FL[key] || key}</label>
                    <input style={S.inp} value={form[key] || ""} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={FL[key] || key} />
                  </div>
                ))}
                <div style={{ gridColumn: "1/-1", paddingTop: 8, display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setForm(f => ({ ...f, perdido: !f.perdido }))}>
                  <Chk on={!!form.perdido} color="#ef4444" onChange={() => { }} />
                  <span style={{ fontSize: 13, color: "#9ca3af" }}>Marcar como perdido / no calificó</span>
                </div>
              </div>
            )}
            {tab_ === "etapas" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>Marca las etapas completadas por este prospecto.</div>
                {(STAGES[tab] || []).map(st => (
                  <div key={st} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderRadius: 8, cursor: "pointer", background: form.stages?.[st] ? "rgba(16,185,129,.08)" : "transparent" }} onClick={() => setForm(f => ({ ...f, stages: { ...f.stages, [st]: !f.stages?.[st] } }))}>
                    <Chk on={!!form.stages?.[st]} color={color} onChange={() => { }} />
                    <span style={{ fontSize: 13, color: form.stages?.[st] ? "#10b981" : "#9ca3af", fontWeight: form.stages?.[st] ? 700 : 400 }}>{st}</span>
                  </div>
                ))}
              </div>
            )}
            {tab_ === "notas" && (
              <div>
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  <input style={{ ...S.inp, flex: 1 }} value={nNota} onChange={e => setNNota(e.target.value)} placeholder="Escribe una nota con fecha automática..." onKeyDown={e => e.key === "Enter" && addNotaLocal()} />
                  <button style={S.btn("primary")} onClick={addNotaLocal}>+ Agregar</button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {(form.notasHistorial || []).slice().reverse().map(n => (
                    <div key={n.id} style={{ background: "#07070f", borderRadius: 8, padding: 14 }}>
                      <div style={{ fontSize: 11, color: "#6366f1", fontWeight: 700, marginBottom: 4 }}>{fd(n.fecha)}</div>
                      <div style={{ fontSize: 13, color: "#dde0f0" }}>{n.texto}</div>
                    </div>
                  ))}
                  {(form.notasHistorial || []).length === 0 && <div style={{ textAlign: "center", color: "#374151", fontSize: 12, padding: 24 }}>Sin historial. Las notas quedan guardadas con fecha.</div>}
                </div>
              </div>
            )}
            {tab_ === "venta" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ background: "rgba(16,185,129,.05)", border: "1px solid #10b98133", borderRadius: 10, padding: 14, fontSize: 12, color: "#10b981" }}>Registra los detalles del contrato cuando se cierre la venta para que aparezca en el reporte de socios.</div>
                <div style={S.g2}>
                  <div><label style={S.lbl}>Monto del contrato ({cfg.moneda})</label><input type="number" style={S.inp} value={form.venta?.monto || ""} onChange={e => setForm(f => ({ ...f, venta: { ...(f.venta || {}), monto: e.target.value } }))} /></div>
                  <div><label style={S.lbl}>Tipo de pago</label>
                    <select style={S.inp} value={form.venta?.tipo || "mensual"} onChange={e => setForm(f => ({ ...f, venta: { ...(f.venta || {}), tipo: e.target.value } }))}>
                      <option value="mensual">Mensual recurrente</option><option value="unico">Pago único</option><option value="proyecto">Por proyecto</option>
                    </select>
                  </div>
                </div>
                <div style={S.g2}>
                  <div><label style={S.lbl}>Duración (meses)</label><input type="number" style={S.inp} value={form.venta?.plazo || ""} onChange={e => setForm(f => ({ ...f, venta: { ...(f.venta || {}), plazo: e.target.value } }))} /></div>
                  <div><label style={S.lbl}>Fecha de inicio</label><input type="date" style={S.inp} value={form.venta?.fechaInicio || ""} onChange={e => setForm(f => ({ ...f, venta: { ...(f.venta || {}), fechaInicio: e.target.value } }))} /></div>
                </div>
                <div><label style={S.lbl}>Servicio contratado</label><input style={S.inp} value={form.venta?.servicio || ""} onChange={e => setForm(f => ({ ...f, venta: { ...(f.venta || {}), servicio: e.target.value } }))} placeholder="Ej. Social Media, Google Ads, Branding..." /></div>
                {form.venta?.monto && form.venta?.plazo && (
                  <div style={{ background: "#07070f", borderRadius: 10, padding: 14, fontSize: 12, color: "#6b7280" }}>
                    LTV estimado: <strong style={{ color: "#10b981", fontSize: 14 }}>{fm(Number(form.venta.monto) * Number(form.venta.plazo), cfg.moneda)}</strong>
                  </div>
                )}
              </div>
            )}
          </div>
          <div style={{ padding: "14px 20px", borderTop: "1px solid #1a1a2e", display: "flex", justifyContent: "space-between", flexShrink: 0 }}>
            {!isNew ? <button style={{ ...S.btn("danger"), fontSize: 11 }} onClick={() => delP(tab, form.id)}>Eliminar</button> : <div />}
            <div style={{ display: "flex", gap: 8 }}>
              <button style={S.btn("secondary")} onClick={() => setModal(null)}>Cancelar</button>
              <button style={{ ...S.btn("primary", color) }} onClick={() => saveP(tab, form)}>💾 Guardar</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const TareaModal = () => {
    const [form, setForm] = useState(() => modal.tarea ? { ...modal.tarea } : { id: uid(), titulo: "", prospectId: "", prioridad: "Media", fecha: today(), estado: "pendiente", notas: "" });
    return (
      <div style={S.modal} onClick={e => { if (e.target === e.currentTarget) setModal(null) }}>
        <div style={{ ...S.mbox, maxWidth: 480 }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #1a1a2e", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
            <div style={{ fontWeight: 800, color: "#fff", fontSize: 15 }}>{modal.tarea ? "Editar tarea" : "Nueva tarea"}</div>
            <button style={S.btn("ghost")} onClick={() => setModal(null)}>✕</button>
          </div>
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12, overflow: "auto", flex: 1 }}>
            <div><label style={S.lbl}>Título*</label><input style={S.inp} value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="¿Qué hay que hacer?" /></div>
            <div style={S.g2}>
              <div><label style={S.lbl}>Prioridad</label>
                <select style={S.inp} value={form.prioridad} onChange={e => setForm(f => ({ ...f, prioridad: e.target.value }))}>
                  <option>Alta</option><option>Media</option><option>Baja</option>
                </select>
              </div>
              <div><label style={S.lbl}>Fecha límite</label><input type="date" style={S.inp} value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} /></div>
            </div>
            <div><label style={S.lbl}>Vincular a prospecto</label>
              <select style={S.inp} value={form.prospectId} onChange={e => setForm(f => ({ ...f, prospectId: e.target.value }))}>
                <option value="">Sin prospecto</option>
                {allP.filter(p => p.nombre).map(p => <option key={p.id} value={p.id}>{TM[p._tab]?.icon} {p.nombre}</option>)}
              </select>
            </div>
            <div><label style={S.lbl}>Notas</label><textarea style={{ ...S.inp, minHeight: 60, resize: "vertical" }} value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} /></div>
          </div>
          <div style={{ padding: "14px 20px", borderTop: "1px solid #1a1a2e", display: "flex", justifyContent: "flex-end", gap: 8, flexShrink: 0 }}>
            <button style={S.btn("secondary")} onClick={() => setModal(null)}>Cancelar</button>
            <button style={S.btn("primary")} onClick={() => saveTarea(form)}>💾 Guardar</button>
          </div>
        </div>
      </div>
    );
  };

  const ActividadModal = () => {
    const [form, setForm] = useState({ tipo: modal.pre?.tipo || "llamada", cantidad: 1, notas: "", fecha: today() });
    return (
      <div style={S.modal} onClick={e => { if (e.target === e.currentTarget) setModal(null) }}>
        <div style={{ ...S.mbox, maxWidth: 440 }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #1a1a2e", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
            <div style={{ fontWeight: 800, color: "#fff", fontSize: 15 }}>⚡ Registrar actividad</div>
            <button style={S.btn("ghost")} onClick={() => setModal(null)}>✕</button>
          </div>
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14, overflow: "auto", flex: 1 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
              {ACT_TYPES.map(a => (
                <button key={a.id} style={{ ...S.btn(form.tipo === a.id ? "primary" : "secondary", form.tipo === a.id ? "#6366f1" : undefined), padding: "12px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
                  onClick={() => setForm(f => ({ ...f, tipo: a.id }))}>
                  <span style={{ fontSize: 22 }}>{a.icon}</span>
                  <span style={{ fontSize: 10 }}>{a.label}</span>
                </button>
              ))}
            </div>
            <div style={S.g2}>
              <div><label style={S.lbl}>Cantidad</label><input type="number" min="1" style={S.inp} value={form.cantidad} onChange={e => setForm(f => ({ ...f, cantidad: e.target.value }))} /></div>
              <div><label style={S.lbl}>Fecha</label><input type="date" style={S.inp} value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} /></div>
            </div>
            <div><label style={S.lbl}>Notas (opcional)</label><input style={S.inp} value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} placeholder="Ej. Llamé a 3 prospectos del círculo..." /></div>
          </div>
          <div style={{ padding: "14px 20px", borderTop: "1px solid #1a1a2e", display: "flex", justifyContent: "flex-end", gap: 8, flexShrink: 0 }}>
            <button style={S.btn("secondary")} onClick={() => setModal(null)}>Cancelar</button>
            <button style={S.btn("primary")} onClick={() => addAct(form)}>✅ Registrar</button>
          </div>
        </div>
      </div>
    );
  };

  // ── NAV ───────────────────────────────────────────────────────────────────
  const safeRole = String(role || "").trim().toLowerCase();
  const isAdmin = safeRole === "admin";
  console.log("DEBUG ROLE:", { role, safeRole, isAdmin, view });



  const NAV = [
    { s: "General", items: [{ id: "dashboard", icon: "📊", label: "Dashboard" }, { id: "kanban", icon: "🗂️", label: "Pipeline Kanban" }, { id: "modo-vendedor", icon: "🚀", label: "Modo Vendedor" }] },
    { s: "Listas", items: LIST_TABS.map(t => ({ id: t, icon: TM[t].icon, label: TM[t].label, color: TM[t].color, cnt: pros[t].length })) },
    { s: "Productividad", items: [{ id: "tareas", icon: "✅", label: "Tareas", cnt: stats.tarHoy.length, cc: "#ef4444" }, { id: "agenda", icon: "📅", label: "Agenda" }, { id: "productividad", icon: "⚡", label: "Productividad" }] },
    ...(isAdmin ? [{ s: "Informes", items: [{ id: "reporte", icon: "📋", label: "Reporte Socios" }, { id: "config", icon: "⚙️", label: "Configuración" }] }] : []),
  ];
  const curNav = NAV.flatMap(s => s.items).find(i => i.id === view) || { icon: "", label: "" };
  const isListV = LIST_TABS.includes(view);

  return (
    <div style={S.app}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;800;900&display=swap" rel="stylesheet" />

      {/* Sidebar */}
      <div style={S.side}>
        <div style={S.logo}>
          <div style={{ fontSize: 9, color: "#6366f1", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" }}>Agencia de Marketing</div>
          <div style={{ fontSize: 19, fontWeight: 900, color: "#fff", letterSpacing: -.5 }}>Top Seller Inmobiliario</div>
          <button
            style={S.btn("secondary")}
            onClick={async () => {
              const { supabase } = await import("./supabaseClient");
              await supabase.auth.signOut();
            }}
          >
            Salir
          </button>
          <div style={{ fontSize: 9, color: "#fff", marginTop: 1 }}>CRM · Área Comercial</div>
          <button
            style={S.btn("secondary")}
            onClick={() => setView("smartsales")}>
            🚀 Smart Sales
          </button>

          <button
            style={S.btn("secondary")}
            onClick={() => setView("notificaciones")}>
            🔔 Notificaciones
          </button>
        </div>
        <div style={{ flex: 1, overflow: "auto", paddingTop: 8 }}>
          {NAV.map(sec => (
            <div key={sec.s} style={{ paddingTop: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: "#1a1a2e", padding: "0 18px 6px", textTransform: "uppercase" }}>{sec.s}</div>
              {sec.items.map(item => (
                <div key={item.id} style={S.nav(view === item.id, item.color || "#6366f1")} onClick={() => setView(item.id)}>
                  <span style={{ fontSize: 13 }}>{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.cnt > 0 && <span style={{ fontSize: 9, fontWeight: 700, color: item.cc || item.color || "#6366f1", background: "#07070f", borderRadius: 8, padding: "1px 6px", minWidth: 16, textAlign: "center" }}>{item.cnt}</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ padding: "10px 18px", borderTop: "1px solid #14142a" }}>
          <div style={{ fontSize: 9, color: saving ? "#6366f1" : "#14142a", fontWeight: 700, transition: "color .3s" }}>{saving ? "💾 Guardando..." : "● Auto-guardado activo"}</div>
        </div>
      </div>

      {/* Main */}
      <div style={S.main}>
        <div style={S.topbar}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 900, color: "#fff", letterSpacing: -.5 }}>{curNav.icon} {curNav.label}</div>
            {isListV && <div style={{ fontSize: 10, color: "#374151", marginTop: 1 }}>{pros[view]?.length || 0} registros · {pros[view]?.filter(p => isClosed(p, view)).length || 0} cerrados · {pros[view]?.filter(p => calcTemp(p, view, tareas).e === "🔥").length || 0} 🔥 calientes</div>}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {isListV && <button style={{ ...S.btn("primary", TM[view]?.color), padding: "7px 16px" }} onClick={() => setModal({ type: "prospect", tab: view, person: null })}>+ Agregar</button>}
            {view === "tareas" && <button style={S.btn("primary")} onClick={() => setModal({ type: "tarea" })}>+ Nueva tarea</button>}
            {view === "productividad" && <button style={S.btn("primary")} onClick={() => setModal({ type: "actividad" })}>+ Actividad</button>}
          </div>
        </div>
        <div style={S.page}>
          {view === "dashboard" && <Dashboard />}
          {view === "kanban" && <Kanban />}
          {isListV && <ListView tab={view} />}
          {view === "tareas" && <Tareas />}
          {view === "agenda" && <Agenda />}
          {view === "productividad" && <Productividad />}
          {view === "modo-vendedor" && <ModoVendedor />}
          {view === "reporte" && (role === "admin" ? <ReporteAdmin /> : <div style={{ color: "#fff" }}>Sin acceso</div>)}
          {view === "config" && (role === "admin" ? <Config /> : <div style={{ color: "#fff" }}>Sin acceso</div>)}
          {view === "smartsales" && <SmartSalesPanel user_id={user?.id} userName={user?.full_name} />}
          {view === "notificaciones" && <NotificationsPanel user_id={user?.id} />}
        </div>
      </div>

      {modal?.type === "prospect" && <ProspectModal />}
      {modal?.type === "tarea" && <TareaModal />}
      {modal?.type === "actividad" && <ActividadModal />}

      {toast && (
        <div style={{ position: "fixed", bottom: 20, right: 20, background: toast.ok ? "#10b981" : "#dc2626", color: "#fff", padding: "11px 20px", borderRadius: 10, fontSize: 13, fontWeight: 700, zIndex: 300, boxShadow: "0 8px 32px rgba(0,0,0,.5)", transition: "all .3s" }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}