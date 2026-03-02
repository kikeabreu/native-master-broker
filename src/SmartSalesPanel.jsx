import { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabaseClient";

// ── PRESETS ──────────────────────────────────────────────────────────────────
const PRESETS = {
    a: {
        cayococo: { nombre: "Cayo Coco", precio: 664000, tipoC: "escalon", tipoD: "residencial", e1: 3.5, e2: 4, e3: 4.5, u2: 4, u3: 9 },
        soletta: { nombre: "Soletta", precio: 580000, tipoC: "escalon", tipoD: "residencial", e1: 3.5, e2: 4, e3: 4.5, u2: 4, u3: 9 },
        zenha: { nombre: "Zen-Ha", precio: 620000, tipoC: "escalon", tipoD: "residencial", e1: 3.5, e2: 4, e3: 4.5, u2: 4, u3: 9 },
    },
    b: {
        palmarena: { nombre: "Palmarena", precio: 115000, tipoC: "escalon", tipoD: "semiurb", e1: 6, e2: 7, e3: 8, u2: 4, u3: 9 },
        granpuerto: { nombre: "Gran Puerto Telchac", precio: 108000, tipoC: "escalon", tipoD: "semiurb", e1: 6, e2: 7, e3: 8, u2: 4, u3: 9 },
        recoleta: { nombre: "Recoleta", precio: 112000, tipoC: "escalon", tipoD: "semiurb", e1: 6, e2: 7, e3: 8, u2: 4, u3: 9 },
    },
};

const DEFAULT_CFG = {
    asesorNombre: "", metaMes: 50000,
    presetA: "", nombreA: "Proyecto A", precioA: 664000, tipoComA: "fija", tipoDevA: "residencial",
    comisionA: 3.5, comAE1: 3.5, comAE2: 4, comAE3: 4.5, comAUmbral2: 4, comAUmbral3: 9,
    presetB: "", nombreB: "Proyecto B", precioB: 115000, tipoComB: "escalon", tipoDevB: "semiurb",
    comisionB: 6, comB1: 6, comB2: 7, comB3: 8, comBUmbral2: 4, comBUmbral3: 9,
    efAMin: 10, efAMax: 20, efBMin: 70, efBMax: 80,
    respPorPres: 5, llamadasPorResp: 10, llamadasDia: 50, diasSemana: 5, embudoVentasObj: 9,
    trackVentasA: 0, trackVentasB: 0,
    sliderA: 1, sliderB: 5, mixVentasA: 1, mixVentasB: 5,
};

// ── UTILS ─────────────────────────────────────────────────────────────────────
const fmt = n => "$" + Math.round(n).toLocaleString("es-MX");
const n = v => Number(v) || 0;

function getComA(ventas, c) {
    const precio = n(c.precioA);
    if (c.tipoComA === "fija") {
        const pct = n(c.comisionA);
        return { pct, comPorVenta: precio * pct / 100, total: n(ventas) * precio * pct / 100 };
    }
    const [e1, e2, e3, u2, u3] = [n(c.comAE1), n(c.comAE2), n(c.comAE3), n(c.comAUmbral2), n(c.comAUmbral3)];
    const pct = n(ventas) >= u3 ? e3 : n(ventas) >= u2 ? e2 : e1;
    return { pct, comPorVenta: precio * pct / 100, total: n(ventas) * precio * pct / 100 };
}

function getComB(ventas, c) {
    const precio = n(c.precioB);
    if (c.tipoComB === "fija") {
        const pct = n(c.comisionB);
        return { pct, comPorVenta: precio * pct / 100, total: n(ventas) * precio * pct / 100 };
    }
    const [e1, e2, e3, u2, u3] = [n(c.comB1), n(c.comB2), n(c.comB3), n(c.comBUmbral2), n(c.comBUmbral3)];
    const pct = n(ventas) >= u3 ? e3 : n(ventas) >= u2 ? e2 : e1;
    return { pct, comPorVenta: precio * pct / 100, total: n(ventas) * precio * pct / 100 };
}

// ── STYLES ────────────────────────────────────────────────────────────────────
const G = "#f0c060"; const T = "#3dd9c0"; const BG = "#07070f";
const S2 = "#0e1219"; const S3 = "#141b24"; const S4 = "#1a2333";
const BD = "rgba(255,255,255,0.06)"; const BD2 = "rgba(255,255,255,0.10)";
const TX = "#e8ecf4"; const TX2 = "#8892a4"; const TX3 = "#4a5468";
const GD = `rgba(240,192,96,0.12)`; const GB = `rgba(240,192,96,0.25)`;
const TD = `rgba(61,217,192,0.10)`; const TB = `rgba(61,217,192,0.25)`;
const BD_BLUE = "rgba(80,144,240,0.25)"; const BLUE = "#5090f0"; const BLUE_D = "rgba(80,144,240,0.10)";

const crd = (extra = {}) => ({ background: S2, border: `1px solid ${BD}`, borderRadius: 14, padding: 24, marginBottom: 16, ...extra });
const sbox = (color = "default") => ({
    background: color === "gold" ? GD : color === "teal" ? TD : color === "blue" ? BLUE_D : S3,
    border: `1px solid ${color === "gold" ? GB : color === "teal" ? TB : color === "blue" ? BD_BLUE : BD}`,
    borderRadius: 12, padding: "18px 20px",
});
const field_s = { marginBottom: 16 };
const lbl_s = { display: "block", fontSize: 11, fontWeight: 600, color: TX3, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 7 };
const inp_s = { width: "100%", background: S3, border: `1px solid ${BD}`, borderRadius: 8, padding: "11px 14px", color: TX, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
const btn_s = (c = G) => ({ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 8, border: `1px solid ${c}44`, background: `${c}18`, color: c, fontWeight: 700, fontSize: 13, cursor: "pointer", transition: "all 0.15s" });
const slbl_s = { fontFamily: "monospace", fontSize: 10, letterSpacing: "2.5px", textTransform: "uppercase", color: TX3, display: "flex", alignItems: "center", gap: 10, marginBottom: 16 };

function SLabel({ children }) {
    return <div style={slbl_s}>{children}<span style={{ flex: 1, height: 1, background: BD }} /></div>;
}
function Field({ label, children }) {
    return <div style={field_s}><label style={lbl_s}>{label}</label>{children}</div>;
}
function Inp({ value, onChange, type = "number", min, max, step, placeholder, style = {} }) {
    return <input type={type} value={value} onChange={e => onChange(type === "number" ? Number(e.target.value) : e.target.value)} min={min} max={max} step={step} placeholder={placeholder} style={{ ...inp_s, ...style }} />;
}
function Sel({ value, onChange, options, style = {} }) {
    return (
        <select value={value} onChange={e => onChange(e.target.value)} style={{ ...inp_s, ...style, cursor: "pointer" }}>
            {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
    );
}
function StatBox({ label, val, sub, color = "default" }) {
    const vc = color === "gold" ? G : color === "teal" ? T : color === "blue" ? BLUE : TX;
    return (
        <div style={sbox(color)}>
            <div style={{ fontSize: 11, fontWeight: 600, color: TX3, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>{label}</div>
            <div style={{ fontFamily: "monospace", fontSize: 22, fontWeight: 600, color: vc, lineHeight: 1 }}>{val}</div>
            {sub && <div style={{ fontSize: 11, color: TX3, marginTop: 5 }}>{sub}</div>}
        </div>
    );
}
function PBar({ pct, color = G, height = 8 }) {
    return (
        <div style={{ background: S4, borderRadius: 4, height, overflow: "hidden", margin: "8px 0" }}>
            <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 4, transition: "width 0.4s" }} />
        </div>
    );
}
function Alert({ type = "warn", icon, children }) {
    const map = { warn: { bg: `rgba(240,192,96,0.08)`, bd: `rgba(240,192,96,0.2)`, cl: G }, info: { bg: TD, bd: TB, cl: T }, red: { bg: `rgba(240,80,96,0.10)`, bd: `rgba(240,80,96,0.25)`, cl: "#f05060" } };
    const m = map[type];
    return (
        <div style={{ display: "flex", gap: 12, padding: "14px 16px", borderRadius: 10, marginTop: 14, fontSize: 13, background: m.bg, border: `1px solid ${m.bd}`, color: m.cl }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
            <div style={{ flex: 1, lineHeight: 1.7 }}>{children}</div>
        </div>
    );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function SmartSalesPanel({ user_id, userName }) {
    const [cfg, setCfg] = useState(DEFAULT_CFG);
    const [tab, setTab] = useState("config");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState(null);

    const toast_ = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 2500); };

    // ── LOAD ─────────────────────────────────────────────────────────────────
    useEffect(() => {
        (async () => {
            if (!user_id) { setLoading(false); return; }
            try {
                const { data } = await supabase.from("smart_sales_profiles").select("config").eq("user_id", user_id).single();
                if (data?.config) setCfg(prev => ({ ...prev, ...data.config }));
            } catch { }
            setLoading(false);
        })();
    }, [user_id]);

    const set = (key, val) => setCfg(prev => ({ ...prev, [key]: val }));

    // Apply preset
    const applyPreset = (pre, which) => {
        const p = PRESETS[which][pre];
        if (!p) return;
        if (which === "a") {
            setCfg(prev => ({
                ...prev, presetA: pre, nombreA: p.nombre, precioA: p.precio, tipoComA: p.tipoC, tipoDevA: p.tipoD,
                comAE1: p.e1 || prev.comAE1, comAE2: p.e2 || prev.comAE2, comAE3: p.e3 || prev.comAE3, comAUmbral2: p.u2 || prev.comAUmbral2, comAUmbral3: p.u3 || prev.comAUmbral3, comisionA: p.e1 || prev.comisionA
            }));
        } else {
            setCfg(prev => ({
                ...prev, presetB: pre, nombreB: p.nombre, precioB: p.precio, tipoComB: p.tipoC, tipoDevB: p.tipoD,
                comB1: p.e1 || prev.comB1, comB2: p.e2 || prev.comB2, comB3: p.e3 || prev.comB3, comBUmbral2: p.u2 || prev.comBUmbral2, comBUmbral3: p.u3 || prev.comBUmbral3, comisionB: p.e1 || prev.comisionB
            }));
        }
    };

    // ── SAVE ──────────────────────────────────────────────────────────────────
    const guardar = async () => {
        if (!user_id) return;
        setSaving(true);
        try {
            const { error } = await supabase.from("smart_sales_profiles")
                .upsert({ user_id: user_id, config: cfg, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
            if (error) throw error;
            toast_("✅ Perfil guardado correctamente");
        } catch (e) { toast_("❌ Error al guardar", false); console.error(e); }
        setSaving(false);
    };

    // ── CALCS (memoized) ──────────────────────────────────────────────────────
    const resA = useMemo(() => getComA(cfg.trackVentasA, cfg), [cfg]);
    const resB = useMemo(() => getComB(cfg.trackVentasB, cfg), [cfg]);
    const total = useMemo(() => resA.total + resB.total, [resA, resB]);
    const trackPct = useMemo(() => cfg.metaMes > 0 ? Math.min(Math.round(total / cfg.metaMes * 100), 999) : 0, [total, cfg.metaMes]);

    const simA = useMemo(() => getComA(cfg.sliderA, cfg), [cfg]);
    const simB = useMemo(() => getComB(cfg.sliderB, cfg), [cfg]);
    const simTotal = useMemo(() => simA.total + simB.total, [simA, simB]);

    const mixA = useMemo(() => getComA(cfg.mixVentasA, cfg), [cfg]);
    const mixB = useMemo(() => getComB(cfg.mixVentasB, cfg), [cfg]);
    const mixTotal = useMemo(() => mixA.total + mixB.total, [mixA, mixB]);

    // Escenarios fijos
    const escenarios = useMemo(() => [
        { nombre: "Conservador", badge: "cons", vA: 1, vB: 3 },
        { nombre: "Realista", badge: "real", vA: 1, vB: 6 },
        { nombre: "Agresivo 🔥", badge: "agr", vA: 2, vB: n(cfg.comBUmbral3) },
    ].map(e => {
        const rA = getComA(e.vA, cfg), rB = getComB(e.vB, cfg);
        return { ...e, rA, rB, tot: rA.total + rB.total };
    }), [cfg]);

    // Embudo
    const embudo = useMemo(() => {
        const vObj = n(cfg.embudoVentasObj);
        const calcFun = (efMin, efMax) => {
            if (!efMin || !efMax) return null;
            const presMin = Math.ceil(vObj / (efMax / 100));
            const presMax = Math.ceil(vObj / (efMin / 100));
            const llamMin = presMin * n(cfg.respPorPres) * n(cfg.llamadasPorResp);
            const llamMax = presMax * n(cfg.respPorPres) * n(cfg.llamadasPorResp);
            const diasSem = n(cfg.diasSemana);
            const llamDia = n(cfg.llamadasDia);
            const diasMin = llamDia > 0 ? Math.ceil(llamMin / llamDia) : 0;
            const diasMax = llamDia > 0 ? Math.ceil(llamMax / llamDia) : 0;
            return { vObj, presMin, presMax, llamMin, llamMax, diasMin, diasMax };
        };
        return { a: calcFun(n(cfg.efAMin), n(cfg.efAMax)), b: calcFun(n(cfg.efBMin), n(cfg.efBMax)) };
    }, [cfg]);

    // Tiempo (para estrategia)
    const tiempo = useMemo(() => {
        const calcDias = (efMin, efMax) => {
            if (!efMin || !efMax) return { diasMin: 0, diasMax: 0 };
            const llamPorPres = n(cfg.respPorPres) * n(cfg.llamadasPorResp);
            const llamDia = n(cfg.llamadasDia);
            const presMin = Math.ceil(1 / (efMax / 100));
            const presMax = Math.ceil(1 / (efMin / 100));
            const diasMin = llamDia > 0 ? Math.ceil(presMin * llamPorPres / llamDia) : 0;
            const diasMax = llamDia > 0 ? Math.ceil(presMax * llamPorPres / llamDia) : 0;
            return { diasMin, diasMax };
        };
        return { a: calcDias(n(cfg.efAMin), n(cfg.efAMax)), b: calcDias(n(cfg.efBMin), n(cfg.efBMax)) };
    }, [cfg]);

    // Veredicto
    const veredicto = useMemo(() => {
        const meta = n(cfg.metaMes);
        const resA1 = getComA(1, cfg);
        const u3B = n(cfg.comBUmbral3);
        const resB_top = getComB(u3B, cfg);
        const ventasNecA = resA1.comPorVenta > 0 ? Math.ceil(meta / resA1.comPorVenta) : "∞";
        const ventasNecB = resB_top.comPorVenta > 0 ? Math.ceil(meta / resB_top.comPorVenta) : "∞";
        const ingreso9B = u3B * resB_top.comPorVenta;
        const ingCombinado = ingreso9B + resA1.comPorVenta;
        const efB = cfg.tipoDevB === "residencial" ? "10–20%" : "70–80%";
        return { ventasNecA, ventasNecB, ingreso9B, ingCombinado, efB, u3B, resA1, resB_top };
    }, [cfg]);

    // Trimestral
    const trimestral = useMemo(() => {
        const rA = getComA(2, cfg);
        const rB = getComB(n(cfg.comBUmbral3), cfg);
        return { trimA: 3 * 2 * rA.comPorVenta, trimB: 3 * n(cfg.comBUmbral3) * rB.comPorVenta, rA, rB };
    }, [cfg]);

    // Meta ventas visual
    const metaVentas = useMemo(() => {
        const meta = n(cfg.metaMes);
        const rA1 = getComA(1, cfg);
        const rB3 = getComB(n(cfg.comBUmbral3), cfg);
        const necA = rA1.comPorVenta > 0 ? Math.ceil(meta / rA1.comPorVenta) : 0;
        const necB = rB3.comPorVenta > 0 ? Math.ceil(meta / rB3.comPorVenta) : 0;
        return { necA, necB, rA1, rB3 };
    }, [cfg]);

    const TABS = [
        { id: "config", label: "⚙️ Configuración" },
        { id: "tracker", label: "📊 Tracker" },
        { id: "comparativa", label: "⚖️ Comparativa" },
        { id: "escenarios", label: "🎯 Escenarios" },
        { id: "embudo", label: "🔻 Embudo" },
        { id: "estrategia", label: "🧠 Estrategia" },
    ];

    if (loading) return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: TX3, fontSize: 13 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", border: `3px solid ${G}`, borderTopColor: "transparent", animation: "spin 1s linear infinite", marginRight: 12 }} />
            Cargando perfil Smart Sales...
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    );

    return (
        <div style={{ fontFamily: "inherit" }}>

            {/* ── HEADER ── */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
                <div>
                    <div style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: TX3, marginBottom: 6 }}>PLAN DE ACCIÓN PERSONAL</div>
                    <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5, lineHeight: 1 }}>
                        <span style={{ color: G }}>Native</span> <span style={{ color: TX }}>Smart</span> <span style={{ color: T }}>Sales</span>
                    </div>
                    {cfg.asesorNombre && <div style={{ fontSize: 12, color: TX3, marginTop: 4 }}>Perfil de: {cfg.asesorNombre}</div>}
                </div>
                <button style={{ ...btn_s(T), fontSize: 13 }} disabled={saving} onClick={guardar}>
                    {saving ? "Guardando..." : "💾 Guardar perfil"}
                </button>
            </div>

            {/* ── TABS ── */}
            <div style={{ display: "flex", gap: 2, background: S2, border: `1px solid ${BD}`, borderRadius: 12, padding: 4, marginBottom: 24, overflowX: "auto" }}>
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        style={{ flex: 1, minWidth: 100, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 8px", border: `1px solid ${tab === t.id ? BD2 : "transparent"}`, background: tab === t.id ? S4 : "transparent", color: tab === t.id ? TX : TX3, fontFamily: "inherit", fontSize: 13, fontWeight: 500, borderRadius: 9, cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap" }}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ══════════════ CONFIG ══════════════ */}
            {tab === "config" && (
                <div>
                    {/* Asesor */}
                    <SLabel>Asesor</SLabel>
                    <div style={crd()}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            <Field label="Tu nombre"><Inp type="text" value={cfg.asesorNombre} onChange={v => set("asesorNombre", v)} placeholder="Tu nombre" /></Field>
                            <Field label="Meta mensual ($)"><Inp value={cfg.metaMes} onChange={v => set("metaMes", v)} /></Field>
                        </div>
                    </div>

                    {/* Proyecto A */}
                    <SLabel>Proyecto A <span style={{ marginLeft: 8, fontSize: 10, background: GD, border: `1px solid ${GB}`, color: G, padding: "2px 8px", borderRadius: 4 }}>Personalizable</span></SLabel>
                    <div style={{ ...crd(), borderColor: GB }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: G, marginBottom: 16 }}>🟡 Proyecto A</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            <Field label="Seleccionar preset">
                                <Sel value={cfg.presetA} onChange={v => { set("presetA", v); applyPreset(v, "a"); }}
                                    options={[["", "— Personalizado —"], ["cayococo", "Cayo Coco"], ["soletta", "Soletta"], ["zenha", "Zen-Ha"]]} />
                            </Field>
                            <Field label="Nombre personalizado"><Inp type="text" value={cfg.nombreA} onChange={v => set("nombreA", v)} placeholder="Proyecto A" /></Field>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                            <Field label="Precio de venta ($)"><Inp value={cfg.precioA} onChange={v => set("precioA", v)} /></Field>
                            <Field label="Tipo de comisión">
                                <Sel value={cfg.tipoComA} onChange={v => set("tipoComA", v)} options={[["fija", "Comisión fija"], ["escalon", "Escalonada"]]} />
                            </Field>
                            <Field label="Tipo de desarrollo">
                                <Sel value={cfg.tipoDevA} onChange={v => set("tipoDevA", v)} options={[["residencial", "Residencial"], ["semiurb", "Semi-urbanizado"]]} />
                            </Field>
                        </div>
                        {cfg.tipoComA === "fija" ? (
                            <Field label="Comisión fija (%)"><Inp value={cfg.comisionA} onChange={v => set("comisionA", v)} step={0.1} /></Field>
                        ) : (
                            <>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                                    <Field label="% Nivel 1 (base)"><Inp value={cfg.comAE1} onChange={v => set("comAE1", v)} step={0.1} /></Field>
                                    <Field label="% Nivel 2"><Inp value={cfg.comAE2} onChange={v => set("comAE2", v)} step={0.1} /></Field>
                                    <Field label="% Nivel 3 (máx)"><Inp value={cfg.comAE3} onChange={v => set("comAE3", v)} step={0.1} /></Field>
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                    <Field label={`Umbral nivel 2 (ventas)`}><Inp value={cfg.comAUmbral2} onChange={v => set("comAUmbral2", v)} /></Field>
                                    <Field label={`Umbral nivel 3 (ventas)`}><Inp value={cfg.comAUmbral3} onChange={v => set("comAUmbral3", v)} /></Field>
                                </div>
                            </>
                        )}
                        {/* Preview tabla */}
                        <div style={{ marginTop: 8, background: S4, borderRadius: 8, overflow: "hidden" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead><tr>{["Nivel", "Rango", "% Comisión", "Por venta"].map(h => <th key={h} style={{ padding: "8px 12px", fontSize: 11, fontWeight: 600, color: TX3, textTransform: "uppercase", letterSpacing: "0.8px", textAlign: "left", borderBottom: `1px solid ${BD}` }}>{h}</th>)}</tr></thead>
                                <tbody>
                                    {cfg.tipoComA === "fija" ? (
                                        <tr><td style={{ padding: "10px 12px", fontSize: 13, color: TX }}>Fija</td><td style={{ padding: "10px 12px", fontSize: 13, color: TX3 }}>Todas</td><td style={{ padding: "10px 12px", fontFamily: "monospace", color: G }}>{cfg.comisionA}%</td><td style={{ padding: "10px 12px", fontFamily: "monospace", color: G }}>{fmt(n(cfg.precioA) * n(cfg.comisionA) / 100)}</td></tr>
                                    ) : (
                                        [[1, `1–${n(cfg.comAUmbral2) - 1}`, cfg.comAE1], [2, `${cfg.comAUmbral2}–${n(cfg.comAUmbral3) - 1}`, cfg.comAE2], [3, `${cfg.comAUmbral3}+`, cfg.comAE3]].map(([nivel, rango, pct]) => (
                                            <tr key={nivel}><td style={{ padding: "10px 12px", fontSize: 13, color: TX }}>N{nivel}</td><td style={{ padding: "10px 12px", color: TX3, fontSize: 13 }}>{rango}</td><td style={{ padding: "10px 12px", fontFamily: "monospace", color: G }}>{pct}%</td><td style={{ padding: "10px 12px", fontFamily: "monospace", color: G }}>{fmt(n(cfg.precioA) * n(pct) / 100)}</td></tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Proyecto B */}
                    <SLabel>Proyecto B <span style={{ marginLeft: 8, fontSize: 10, background: TD, border: `1px solid ${TB}`, color: T, padding: "2px 8px", borderRadius: 4 }}>Personalizable</span></SLabel>
                    <div style={{ ...crd(), borderColor: TB }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: T, marginBottom: 16 }}>🟢 Proyecto B</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            <Field label="Seleccionar preset">
                                <Sel value={cfg.presetB} onChange={v => { set("presetB", v); applyPreset(v, "b"); }}
                                    options={[["", "— Personalizado —"], ["palmarena", "Palmarena"], ["granpuerto", "Gran Puerto Telchac"], ["recoleta", "Recoleta"]]} />
                            </Field>
                            <Field label="Nombre personalizado"><Inp type="text" value={cfg.nombreB} onChange={v => set("nombreB", v)} placeholder="Proyecto B" /></Field>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                            <Field label="Precio de venta ($)"><Inp value={cfg.precioB} onChange={v => set("precioB", v)} /></Field>
                            <Field label="Tipo de comisión">
                                <Sel value={cfg.tipoComB} onChange={v => set("tipoComB", v)} options={[["fija", "Comisión fija"], ["escalon", "Escalonada"]]} />
                            </Field>
                            <Field label="Tipo de desarrollo">
                                <Sel value={cfg.tipoDevB} onChange={v => set("tipoDevB", v)} options={[["residencial", "Residencial"], ["semiurb", "Semi-urbanizado"]]} />
                            </Field>
                        </div>
                        {cfg.tipoComB === "fija" ? (
                            <Field label="Comisión fija (%)"><Inp value={cfg.comisionB} onChange={v => set("comisionB", v)} step={0.1} /></Field>
                        ) : (
                            <>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                                    <Field label="% Nivel 1"><Inp value={cfg.comB1} onChange={v => set("comB1", v)} step={0.1} /></Field>
                                    <Field label="% Nivel 2"><Inp value={cfg.comB2} onChange={v => set("comB2", v)} step={0.1} /></Field>
                                    <Field label="% Nivel 3 (máx)"><Inp value={cfg.comB3} onChange={v => set("comB3", v)} step={0.1} /></Field>
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                    <Field label="Umbral nivel 2 (ventas)"><Inp value={cfg.comBUmbral2} onChange={v => set("comBUmbral2", v)} /></Field>
                                    <Field label="Umbral nivel 3 (ventas)"><Inp value={cfg.comBUmbral3} onChange={v => set("comBUmbral3", v)} /></Field>
                                </div>
                            </>
                        )}
                        <div style={{ marginTop: 8, background: S4, borderRadius: 8, overflow: "hidden" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead><tr>{["Nivel", "Rango", "% Comisión", "Por venta"].map(h => <th key={h} style={{ padding: "8px 12px", fontSize: 11, fontWeight: 600, color: TX3, textTransform: "uppercase", letterSpacing: "0.8px", textAlign: "left", borderBottom: `1px solid ${BD}` }}>{h}</th>)}</tr></thead>
                                <tbody>
                                    {cfg.tipoComB === "fija" ? (
                                        <tr><td style={{ padding: "10px 12px", fontSize: 13, color: TX }}>Fija</td><td style={{ padding: "10px 12px", fontSize: 13, color: TX3 }}>Todas</td><td style={{ padding: "10px 12px", fontFamily: "monospace", color: T }}>{cfg.comisionB}%</td><td style={{ padding: "10px 12px", fontFamily: "monospace", color: T }}>{fmt(n(cfg.precioB) * n(cfg.comisionB) / 100)}</td></tr>
                                    ) : (
                                        [[1, `1–${n(cfg.comBUmbral2) - 1}`, cfg.comB1], [2, `${cfg.comBUmbral2}–${n(cfg.comBUmbral3) - 1}`, cfg.comB2], [3, `${cfg.comBUmbral3}+`, cfg.comB3]].map(([nivel, rango, pct]) => (
                                            <tr key={nivel}><td style={{ padding: "10px 12px", fontSize: 13, color: TX }}>N{nivel}</td><td style={{ padding: "10px 12px", color: TX3, fontSize: 13 }}>{rango}</td><td style={{ padding: "10px 12px", fontFamily: "monospace", color: T }}>{pct}%</td><td style={{ padding: "10px 12px", fontFamily: "monospace", color: T }}>{fmt(n(cfg.precioB) * n(pct) / 100)}</td></tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Embudo params */}
                    <SLabel>Parámetros del embudo</SLabel>
                    <div style={crd()}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                            <div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: G, marginBottom: 12 }}>🟡 Efectividad {cfg.nombreA}</div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                    <Field label="Efectividad min (%)"><Inp value={cfg.efAMin} onChange={v => set("efAMin", v)} min={1} max={100} /></Field>
                                    <Field label="Efectividad max (%)"><Inp value={cfg.efAMax} onChange={v => set("efAMax", v)} min={1} max={100} /></Field>
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: T, marginBottom: 12 }}>🟢 Efectividad {cfg.nombreB}</div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                    <Field label="Efectividad min (%)"><Inp value={cfg.efBMin} onChange={v => set("efBMin", v)} min={1} max={100} /></Field>
                                    <Field label="Efectividad max (%)"><Inp value={cfg.efBMax} onChange={v => set("efBMax", v)} min={1} max={100} /></Field>
                                </div>
                            </div>
                        </div>
                        <div style={{ height: 1, background: BD, margin: "8px 0 16px" }} />
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                            <Field label="Respuestas por presentación"><Inp value={cfg.respPorPres} onChange={v => set("respPorPres", v)} min={1} /></Field>
                            <Field label="Llamadas por respuesta"><Inp value={cfg.llamadasPorResp} onChange={v => set("llamadasPorResp", v)} min={1} /></Field>
                            <Field label="Llamadas que haces/día"><Inp value={cfg.llamadasDia} onChange={v => set("llamadasDia", v)} min={1} /></Field>
                        </div>
                    </div>

                    <button style={{ ...btn_s(T), width: "100%", justifyContent: "center", fontSize: 14, padding: "13px" }} disabled={saving} onClick={guardar}>
                        {saving ? "Guardando..." : "💾 Guardar perfil completo"}
                    </button>
                </div>
            )}

            {/* ══════════════ TRACKER ══════════════ */}
            {tab === "tracker" && (
                <div>
                    <SLabel>¿Cómo vas este mes?</SLabel>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                        <div style={{ ...crd(), borderColor: GB, marginBottom: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: G, marginBottom: 12 }}>🟡 Ventas de {cfg.nombreA} este mes</div>
                            <Field label="Ventas cerradas"><Inp value={cfg.trackVentasA} onChange={v => set("trackVentasA", v)} min={0} /></Field>
                            {resA.total > 0 && <div style={{ fontSize: 12, color: TX3 }}>Comisión: <span style={{ color: G, fontWeight: 700 }}>{fmt(resA.total)}</span> · {resA.pct}%</div>}
                        </div>
                        <div style={{ ...crd(), borderColor: TB, marginBottom: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: T, marginBottom: 12 }}>🟢 Ventas de {cfg.nombreB} este mes</div>
                            <Field label="Ventas cerradas"><Inp value={cfg.trackVentasB} onChange={v => set("trackVentasB", v)} min={0} /></Field>
                            {resB.total > 0 && (
                                <div style={{ fontSize: 12, color: TX3 }}>
                                    Comisión: <span style={{ color: T, fontWeight: 700 }}>{fmt(resB.total)}</span> · {resB.pct}% ·{" "}
                                    <span style={{ color: n(cfg.trackVentasB) >= n(cfg.comBUmbral3) ? "#10b981" : n(cfg.trackVentasB) >= n(cfg.comBUmbral2) ? "#f59e0b" : "#6b7280", fontWeight: 700 }}>
                                        {n(cfg.trackVentasB) >= n(cfg.comBUmbral3) ? "Nivel 3 🔥" : n(cfg.trackVentasB) >= n(cfg.comBUmbral2) ? "Nivel 2" : "Nivel 1"}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Meta progress */}
                    <div style={{ background: `linear-gradient(135deg,${S2},${S3})`, border: `1px solid ${BD2}`, borderRadius: 14, padding: 28, textAlign: "center", marginBottom: 16 }}>
                        <div style={{ fontFamily: "monospace", fontSize: 52, fontWeight: 600, lineHeight: 1, background: `linear-gradient(135deg,${G},${T})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{trackPct}%</div>
                        <div style={{ fontSize: 13, color: TX3, marginTop: 8 }}>de tu meta mensual ({fmt(n(cfg.metaMes))})</div>
                        <div style={{ background: S4, borderRadius: 6, height: 10, overflow: "hidden", maxWidth: 320, margin: "16px auto 0" }}>
                            <div style={{ height: "100%", width: `${Math.min(trackPct, 100)}%`, background: `linear-gradient(90deg,${G},${T})`, borderRadius: 6, transition: "width 0.5s" }} />
                        </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
                        <StatBox label={`Comisión ${cfg.nombreA}`} val={fmt(resA.total)} sub={`${cfg.trackVentasA} venta${cfg.trackVentasA !== 1 ? "s" : ""} · ${resA.pct}%`} color="gold" />
                        <StatBox label={`Comisión ${cfg.nombreB}`} val={fmt(resB.total)} sub={`${cfg.trackVentasB} venta${cfg.trackVentasB !== 1 ? "s" : ""} · ${resB.pct}%`} color="teal" />
                        <StatBox label="Total acumulado" val={fmt(total)} sub={n(cfg.metaMes) - total > 0 ? `Faltan ${fmt(n(cfg.metaMes) - total)}` : `✓ Meta superada en ${fmt(total - n(cfg.metaMes))}`} color="blue" />
                    </div>

                    {/* Alertas tracker */}
                    {cfg.tipoComB === "escalon" && n(cfg.trackVentasB) >= n(cfg.comBUmbral2) && n(cfg.trackVentasB) < n(cfg.comBUmbral3) && (
                        <Alert type="warn" icon="⚡">
                            Estás a <strong>{n(cfg.comBUmbral3) - n(cfg.trackVentasB)} venta{n(cfg.comBUmbral3) - n(cfg.trackVentasB) !== 1 ? "s" : ""}</strong> de llegar al nivel máximo de {cfg.nombreB}.
                            Si lo alcanzas, ganarías <strong>{fmt((n(cfg.comBUmbral3) * getComB(n(cfg.comBUmbral3), cfg).comPorVenta) - resB.total)} adicionales</strong> por comisión retroactiva.
                        </Alert>
                    )}
                    {trackPct >= 100 && <Alert type="info" icon="🎯"><strong>¡Meta alcanzada!</strong> Ya superaste tu objetivo mensual. Cada venta extra es ganancia adicional.</Alert>}
                    {trackPct >= 70 && trackPct < 100 && <Alert type="info" icon="🔥">Vas muy bien. Te falta poco para cerrar el mes. Enfócate en llegar al siguiente escalón de comisión.</Alert>}
                    {trackPct >= 30 && trackPct < 70 && <Alert type="warn" icon="⚠️">Ritmo por debajo de lo ideal. Revisa tu embudo y acelera las presentaciones.</Alert>}
                    {trackPct < 30 && total === 0 && <Alert type="red" icon="🚨">Aún no registras ventas este mes. Prioriza activar tu embudo hoy mismo — revisa la pestaña Embudo.</Alert>}

                    <div style={{ marginTop: 16 }}>
                        <button style={{ ...btn_s(G) }} onClick={guardar} disabled={saving}>{saving ? "Guardando..." : "💾 Guardar tracker"}</button>
                    </div>
                </div>
            )}

            {/* ══════════════ COMPARATIVA ══════════════ */}
            {tab === "comparativa" && (
                <div>
                    {/* Cara a cara */}
                    <SLabel>¿Cuánto vale cada venta?</SLabel>
                    <div style={{ background: S2, border: `1px solid ${BD}`, borderRadius: 14, overflow: "hidden", marginBottom: 16 }}>
                        {/* Header */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 1fr", alignItems: "center", padding: "16px 20px", borderBottom: `1px solid ${BD}`, background: S3 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: G }}>🟡 {cfg.nombreA}</div>
                            <div style={{ textAlign: "center", fontFamily: "monospace", fontSize: 11, color: TX3 }}>VS</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: T, textAlign: "right" }}>🟢 {cfg.nombreB}</div>
                        </div>
                        {/* Rows */}
                        {[
                            ["Precio", fmt(n(cfg.precioA)), fmt(n(cfg.precioB))],
                            ["Com. base", `${cfg.tipoComA === "fija" ? cfg.comisionA : cfg.comAE1}%`, `${cfg.tipoComB === "fija" ? cfg.comisionB : cfg.comB1}%`],
                            ["Com. máxima", `${cfg.tipoComA === "fija" ? cfg.comisionA : cfg.comAE3}%`, `${cfg.tipoComB === "fija" ? cfg.comisionB : cfg.comB3}%`],
                            ["Venta base", fmt(getComA(1, cfg).comPorVenta), fmt(getComB(1, cfg).comPorVenta)],
                            ["Venta máxima", fmt(getComA(n(cfg.comAUmbral3), cfg).comPorVenta), fmt(getComB(n(cfg.comBUmbral3), cfg).comPorVenta)],
                            ["Efectividad", `${cfg.efAMin}–${cfg.efAMax}%`, `${cfg.efBMin}–${cfg.efBMax}%`],
                        ].map(([lbl, a, b]) => (
                            <div key={lbl} style={{ display: "grid", gridTemplateColumns: "1fr 80px 1fr", alignItems: "center", padding: "12px 20px", borderBottom: `1px solid ${BD}` }}>
                                <div style={{ fontFamily: "monospace", fontWeight: 600, color: G }}>{a}</div>
                                <div style={{ textAlign: "center", fontSize: 11, color: TX3 }}>{lbl}</div>
                                <div style={{ fontFamily: "monospace", fontWeight: 600, color: T, textAlign: "right" }}>{b}</div>
                            </div>
                        ))}
                    </div>

                    {/* Simuladores duales */}
                    <SLabel>Simula tu mes — mueve los sliders</SLabel>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                        {/* Slider A */}
                        <div style={{ ...crd(), borderColor: GB, marginBottom: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: G, marginBottom: 12 }}>🟡 {cfg.nombreA}</div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                <span style={{ fontSize: 11, color: TX3 }}>0 ventas</span>
                                <span style={{ fontFamily: "monospace", fontSize: 28, fontWeight: 800, color: G }}>{cfg.sliderA}</span>
                                <span style={{ fontSize: 11, color: TX3 }}>20 ventas</span>
                            </div>
                            <input type="range" min={0} max={20} value={cfg.sliderA} onChange={e => set("sliderA", Number(e.target.value))}
                                style={{ width: "100%", accentColor: G, cursor: "pointer" }} />
                            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                                {[["Comisión por venta", fmt(simA.comPorVenta), G], ["% aplicado", `${simA.pct}%`, TX], ["💰 Total del mes", fmt(simA.total), G]].map(([l, v, c]) => (
                                    <div key={l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${BD}` }}>
                                        <span style={{ fontSize: 12, color: TX3 }}>{l}</span>
                                        <span style={{ fontFamily: "monospace", fontSize: l.includes("Total") ? 22 : 15, fontWeight: 600, color: c }}>{v}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Slider B */}
                        <div style={{ ...crd(), borderColor: TB, marginBottom: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: T, marginBottom: 12 }}>🟢 {cfg.nombreB}</div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                <span style={{ fontSize: 11, color: TX3 }}>0 ventas</span>
                                <span style={{ fontFamily: "monospace", fontSize: 28, fontWeight: 800, color: T }}>{cfg.sliderB}</span>
                                <span style={{ fontSize: 11, color: TX3 }}>20 ventas</span>
                            </div>
                            <input type="range" min={0} max={20} value={cfg.sliderB} onChange={e => set("sliderB", Number(e.target.value))}
                                style={{ width: "100%", accentColor: T, cursor: "pointer" }} />
                            {/* Nivel badge */}
                            <div style={{ marginTop: 10, padding: "8px 12px", background: S4, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: n(cfg.sliderB) >= n(cfg.comBUmbral3) ? T : n(cfg.sliderB) >= n(cfg.comBUmbral2) ? G : TX3 }}>
                                    {n(cfg.sliderB) >= n(cfg.comBUmbral3) ? "🔥 Nivel 3 — Máximo" : n(cfg.sliderB) >= n(cfg.comBUmbral2) ? "⚡ Nivel 2" : "Nivel 1"}
                                </span>
                                <span style={{ fontSize: 11, color: TX3 }}>
                                    {n(cfg.sliderB) < n(cfg.comBUmbral2) ? `Faltan ${n(cfg.comBUmbral2) - n(cfg.sliderB)} para N2` : n(cfg.sliderB) < n(cfg.comBUmbral3) ? `Faltan ${n(cfg.comBUmbral3) - n(cfg.sliderB)} para N3 🔥` : "¡En el tope!"}
                                </span>
                            </div>
                            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
                                {[["Comisión por venta", fmt(simB.comPorVenta), T], ["% aplicado", `${simB.pct}%`, TX], ["💰 Total del mes", fmt(simB.total), T]].map(([l, v, c]) => (
                                    <div key={l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${BD}` }}>
                                        <span style={{ fontSize: 12, color: TX3 }}>{l}</span>
                                        <span style={{ fontFamily: "monospace", fontSize: l.includes("Total") ? 22 : 15, fontWeight: 600, color: c }}>{v}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Combinado en vivo */}
                    <div style={{ background: `linear-gradient(135deg,${GD},${TD})`, border: `1px solid ${BD2}`, borderRadius: 14, padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 16 }}>
                        <div style={{ fontFamily: "monospace", fontSize: 13, color: TX2, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ color: G }}>{fmt(simA.total)}</span>
                            <span style={{ color: TX3 }}>+</span>
                            <span style={{ color: T }}>{fmt(simB.total)}</span>
                            <span style={{ color: TX3 }}>= combinado</span>
                        </div>
                        <div>
                            <div style={{ fontFamily: "monospace", fontSize: 32, fontWeight: 700, color: simTotal >= n(cfg.metaMes) ? T : TX }}>{fmt(simTotal)}</div>
                            <div style={{ fontSize: 12, color: TX3, marginTop: 4 }}>
                                {simTotal >= n(cfg.metaMes) ? `✓ Meta superada en ${fmt(simTotal - n(cfg.metaMes))}` : `Faltan ${fmt(n(cfg.metaMes) - simTotal)} para tu meta`}
                            </div>
                        </div>
                    </div>

                    {/* Meta visual */}
                    <SLabel>🎯 ¿Cuántas ventas necesitas para tu meta?</SLabel>
                    <div style={{ ...crd(), marginBottom: 16 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                            <span style={{ fontSize: 14, fontWeight: 700 }}>Solo con {cfg.nombreA} ({metaVentas.rA1.pct}%)</span>
                            <span style={{ fontFamily: "monospace", fontSize: 13, color: TX3 }}>{fmt(n(cfg.metaMes))}</span>
                        </div>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                            {Array.from({ length: Math.min(metaVentas.necA, 15) }).map((_, i) => (
                                <span key={i} style={{ fontSize: 20, lineHeight: 1 }}>🏠</span>
                            ))}
                            {metaVentas.necA > 15 && <span style={{ fontSize: 13, color: TX3, alignSelf: "center" }}>+{metaVentas.necA - 15} más</span>}
                        </div>
                        <div style={{ fontSize: 13, color: TX3 }}><strong style={{ color: G }}>{metaVentas.necA} ventas</strong> de {cfg.nombreA} × {fmt(metaVentas.rA1.comPorVenta)} c/u</div>

                        <div style={{ height: 1, background: BD, margin: "16px 0" }} />

                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                            <span style={{ fontSize: 14, fontWeight: 700 }}>Solo con {cfg.nombreB} (nivel máx.)</span>
                        </div>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                            {Array.from({ length: Math.min(metaVentas.necB, 20) }).map((_, i) => (
                                <span key={i} style={{ fontSize: 20, lineHeight: 1 }}>🏡</span>
                            ))}
                            {metaVentas.necB > 20 && <span style={{ fontSize: 13, color: TX3, alignSelf: "center" }}>+{metaVentas.necB - 20} más</span>}
                        </div>
                        <div style={{ fontSize: 13, color: TX3 }}><strong style={{ color: T }}>{metaVentas.necB} ventas</strong> de {cfg.nombreB} × {fmt(metaVentas.rB3.comPorVenta)} c/u (nivel {n(cfg.comBUmbral3)}+)</div>
                    </div>

                    {/* Trimestral */}
                    <SLabel>Proyección trimestral</SLabel>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        <StatBox label={`${cfg.nombreA.toUpperCase()} — 2 ventas/mes`} val={fmt(trimestral.trimA)} sub={`6 ventas × ${fmt(trimestral.rA.comPorVenta)}`} color="gold" />
                        <StatBox label={`${cfg.nombreB.toUpperCase()} — ${cfg.comBUmbral3} ventas/mes`} val={fmt(trimestral.trimB)} sub={`${3 * n(cfg.comBUmbral3)} ventas × ${fmt(trimestral.rB.comPorVenta)} (${trimestral.rB.pct}%)`} color="teal" />
                    </div>
                </div>
            )}

            {/* ══════════════ ESCENARIOS ══════════════ */}
            {tab === "escenarios" && (
                <div>
                    <SLabel>Escenarios mensuales</SLabel>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 24 }}>
                        {escenarios.map(e => {
                            const ok = e.tot >= n(cfg.metaMes);
                            const bc = e.badge === "cons" ? BLUE : e.badge === "real" ? G : T;
                            return (
                                <div key={e.nombre} style={{ background: S3, border: `1px solid ${BD}`, borderRadius: 12, padding: 18, transition: "border-color 0.2s" }}>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                                        <span style={{ fontSize: 13, fontWeight: 700, color: TX2 }}>{e.nombre}</span>
                                        <span style={{ fontFamily: "monospace", fontSize: 10, padding: "3px 8px", borderRadius: 4, background: `${bc}18`, border: `1px solid ${bc}33`, color: bc }}>{e.badge === "cons" ? "CONSERVADOR" : e.badge === "real" ? "REALISTA" : "AGRESIVO"}</span>
                                    </div>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                                        <div style={{ padding: 10, borderRadius: 8, background: S2, border: `1px solid ${BD}` }}>
                                            <div style={{ fontSize: 10, color: TX3, marginBottom: 3 }}>{cfg.nombreA}</div>
                                            <div style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 500, color: G }}>{fmt(e.rA.total)}</div>
                                            <div style={{ fontSize: 10, color: TX3, marginTop: 2 }}>{e.vA} venta{e.vA !== 1 ? "s" : ""} · {e.rA.pct}%</div>
                                        </div>
                                        <div style={{ padding: 10, borderRadius: 8, background: S2, border: `1px solid ${BD}` }}>
                                            <div style={{ fontSize: 10, color: TX3, marginBottom: 3 }}>{cfg.nombreB}</div>
                                            <div style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 500, color: T }}>{fmt(e.rB.total)}</div>
                                            <div style={{ fontSize: 10, color: TX3, marginTop: 2 }}>{e.vB} ventas · {e.rB.pct}%</div>
                                        </div>
                                    </div>
                                    <div style={{ borderTop: `1px solid ${BD}`, paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                                        <span style={{ fontSize: 11, color: TX3 }}>Total mensual</span>
                                        <span style={{ fontFamily: "monospace", fontSize: 22, fontWeight: 600, color: ok ? T : TX }}>{fmt(e.tot)}</span>
                                    </div>
                                    {ok && <div style={{ fontSize: 11, color: T, marginTop: 6, fontWeight: 700 }}>✓ Supera tu meta</div>}
                                </div>
                            );
                        })}
                    </div>

                    {/* Mix personalizado */}
                    <SLabel>Mix personalizado</SLabel>
                    <div style={crd()}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: TX2, marginBottom: 16 }}>🎛 Construye tu escenario ideal</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                            <div>
                                <Field label={`Ventas de ${cfg.nombreA}`}><Inp value={cfg.mixVentasA} onChange={v => set("mixVentasA", v)} min={0} /></Field>
                                <div style={sbox("gold")}>
                                    <div style={{ fontSize: 11, color: TX3, fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.8px" }}>Com. {cfg.nombreA}</div>
                                    <div style={{ fontFamily: "monospace", fontSize: 22, color: G }}>{fmt(mixA.total)}</div>
                                    <div style={{ fontSize: 11, color: TX3, marginTop: 4 }}>{mixA.pct}% por venta</div>
                                </div>
                            </div>
                            <div>
                                <Field label={`Ventas de ${cfg.nombreB}`}><Inp value={cfg.mixVentasB} onChange={v => set("mixVentasB", v)} min={0} /></Field>
                                <div style={sbox("teal")}>
                                    <div style={{ fontSize: 11, color: TX3, fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.8px" }}>Com. {cfg.nombreB}</div>
                                    <div style={{ fontFamily: "monospace", fontSize: 22, color: T }}>{fmt(mixB.total)}</div>
                                    <div style={{ fontSize: 11, color: TX3, marginTop: 4 }}>Nivel: {n(cfg.mixVentasB) >= n(cfg.comBUmbral3) ? "3 🔥" : n(cfg.mixVentasB) >= n(cfg.comBUmbral2) ? "2" : "1"} · {mixB.pct}%</div>
                                </div>
                            </div>
                        </div>
                        <div style={{ marginTop: 16, background: `linear-gradient(135deg,${GD},${TD})`, border: `1px solid ${BD2}`, borderRadius: 12, padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                            <div>
                                <div style={{ fontSize: 12, color: TX3 }}>Ingreso combinado</div>
                                <div style={{ fontFamily: "monospace", fontSize: 36, fontWeight: 700, color: mixTotal >= n(cfg.metaMes) ? T : TX }}>{fmt(mixTotal)}</div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: 12, color: TX3 }}>vs. tu meta de {fmt(n(cfg.metaMes))}</div>
                                <div style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 700, color: mixTotal >= n(cfg.metaMes) ? T : "#f05060", marginTop: 4 }}>
                                    {mixTotal >= n(cfg.metaMes) ? `✓ +${fmt(mixTotal - n(cfg.metaMes))}` : `⚠️ Faltan ${fmt(n(cfg.metaMes) - mixTotal)}`}
                                </div>
                            </div>
                        </div>
                        <PBar pct={n(cfg.metaMes) > 0 ? Math.min((mixTotal / n(cfg.metaMes)) * 100, 100) : 0} color={mixTotal >= n(cfg.metaMes) ? T : G} />
                    </div>
                </div>
            )}

            {/* ══════════════ EMBUDO ══════════════ */}
            {tab === "embudo" && (
                <div>
                    <SLabel>Parámetros del embudo <span style={{ marginLeft: 8, fontSize: 10, background: GD, border: `1px solid ${GB}`, color: G, padding: "2px 8px", borderRadius: 4 }}>Editables</span></SLabel>
                    <div style={crd()}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                            <div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: G, marginBottom: 12 }}>🟡 {cfg.nombreA} (Residencial)</div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                    <Field label="Efectividad min (%)"><Inp value={cfg.efAMin} onChange={v => set("efAMin", v)} min={1} max={100} /></Field>
                                    <Field label="Efectividad max (%)"><Inp value={cfg.efAMax} onChange={v => set("efAMax", v)} min={1} max={100} /></Field>
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: T, marginBottom: 12 }}>🟢 {cfg.nombreB} (Semi-urb)</div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                    <Field label="Efectividad min (%)"><Inp value={cfg.efBMin} onChange={v => set("efBMin", v)} min={1} max={100} /></Field>
                                    <Field label="Efectividad max (%)"><Inp value={cfg.efBMax} onChange={v => set("efBMax", v)} min={1} max={100} /></Field>
                                </div>
                            </div>
                        </div>
                        <div style={{ height: 1, background: BD, margin: "8px 0 16px" }} />
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                            <Field label="Respuestas por presentación"><Inp value={cfg.respPorPres} onChange={v => set("respPorPres", v)} min={1} /></Field>
                            <Field label="Llamadas por respuesta"><Inp value={cfg.llamadasPorResp} onChange={v => set("llamadasPorResp", v)} min={1} /></Field>
                            <Field label="Ventas objetivo"><Inp value={cfg.embudoVentasObj} onChange={v => set("embudoVentasObj", v)} min={1} /></Field>
                        </div>
                    </div>

                    {/* Embudos visuales */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        {[
                            { label: cfg.nombreA, d: embudo.a, color: G, scolor: "gold" },
                            { label: cfg.nombreB, d: embudo.b, color: T, scolor: "teal" },
                        ].map(({ label, d, color, scolor }) => (
                            <div key={label} style={crd({ marginBottom: 0 })}>
                                <div style={{ fontSize: 13, fontWeight: 700, color, marginBottom: 16 }}>🔻 Embudo — {label}</div>
                                {d ? (
                                    <>
                                        {[
                                            { icon: "📞", title: "Llamadas necesarias", val: `${d.llamMin.toLocaleString()}–${d.llamMax.toLocaleString()}`, sub: "Para generar suficientes respuestas" },
                                            { icon: "🤝", title: "Presentaciones", val: `${d.presMin}–${d.presMax}`, sub: `Con efectividad ${scolor === "gold" ? cfg.efAMin : cfg.efBMin}–${scolor === "gold" ? cfg.efAMax : cfg.efBMax}%` },
                                            { icon: "🏆", title: "Ventas objetivo", val: `${d.vObj}`, sub: "Cierre esperado" },
                                        ].map((step, i) => (
                                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 0", borderBottom: `1px solid ${BD}`, position: "relative" }}>
                                                <div style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, background: S3, fontSize: 16, flexShrink: 0 }}>{step.icon}</div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: 12, fontWeight: 600, color: TX2 }}>{step.title}</div>
                                                    <div style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 600, color, lineHeight: 1, margin: "4px 0 2px" }}>{step.val}</div>
                                                    <div style={{ fontSize: 11, color: TX3 }}>{step.sub}</div>
                                                </div>
                                            </div>
                                        ))}
                                        <div style={{ marginTop: 16, padding: 16, background: S3, borderRadius: 10 }}>
                                            <div style={{ fontSize: 12, color: TX3, marginBottom: 4 }}>⏱ Tiempo estimado para primera venta</div>
                                            <div style={{ fontFamily: "monospace", fontSize: 22, fontWeight: 700, color }}>
                                                {d.diasMin}–{d.diasMax} días
                                            </div>
                                            <div style={{ fontSize: 11, color: TX3, marginTop: 4 }}>Con {cfg.llamadasDia} llamadas/día · {cfg.diasSemana} días/semana</div>
                                        </div>
                                    </>
                                ) : <div style={{ color: TX3, fontSize: 13 }}>Configura los parámetros arriba</div>}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ══════════════ ESTRATEGIA ══════════════ */}
            {tab === "estrategia" && (
                <div>
                    {/* Calculadora de tiempo */}
                    <SLabel>Calculadora de tiempo</SLabel>
                    <div style={crd()}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: TX2, marginBottom: 16 }}>⏱ ¿En cuántos días cierras tu primera venta?</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                            <Field label="Llamadas por día"><Inp value={cfg.llamadasDia} onChange={v => set("llamadasDia", v)} min={1} /></Field>
                            <Field label="Días hábiles por semana"><Inp value={cfg.diasSemana} onChange={v => set("diasSemana", v)} min={1} max={7} /></Field>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                            <div style={sbox("gold")}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: TX3, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>Primera venta · {cfg.nombreA}</div>
                                <div style={{ fontFamily: "monospace", fontSize: 22, fontWeight: 600, color: G }}>{tiempo.a.diasMin}–{tiempo.a.diasMax} días</div>
                                <div style={{ fontSize: 11, color: TX3, marginTop: 5 }}>{tiempo.a.diasMin > 28 ? `≈ ${Math.ceil(tiempo.a.diasMin / 7)} semanas` : "Dentro del primer mes"}</div>
                            </div>
                            <div style={sbox("teal")}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: TX3, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>Primera venta · {cfg.nombreB}</div>
                                <div style={{ fontFamily: "monospace", fontSize: 22, fontWeight: 600, color: T }}>{tiempo.b.diasMin}–{tiempo.b.diasMax} días</div>
                                <div style={{ fontSize: 11, color: TX3, marginTop: 5 }}>{tiempo.b.diasMin <= 5 ? "¡Rápido!" : tiempo.b.diasMin > 28 ? `≈ ${Math.ceil(tiempo.b.diasMin / 7)} semanas` : "Dentro del primer mes"}</div>
                            </div>
                        </div>
                    </div>

                    {/* Veredicto */}
                    <SLabel style={{ marginTop: 8 }}>Recomendación personalizada</SLabel>
                    <div style={{ background: `linear-gradient(135deg,${GD},${TD})`, border: `1px solid ${GB}`, borderRadius: 14, padding: 28, marginBottom: 16 }}>
                        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>
                            🎯 Recomendación para {cfg.asesorNombre || "el asesor"}
                        </div>
                        <div style={{ fontSize: 14, lineHeight: 1.8, color: TX2 }}>
                            Con una meta de <strong style={{ color: TX }}>{fmt(n(cfg.metaMes))}/mes</strong>, necesitas:<br /><br />
                            → <strong style={{ color: G }}>{veredicto.ventasNecA} venta{veredicto.ventasNecA !== 1 ? "s" : ""} de {cfg.nombreA}</strong> · {fmt(veredicto.resA1.comPorVenta)} c/u<br />
                            → <strong style={{ color: T }}>{veredicto.ventasNecB} venta{veredicto.ventasNecB !== 1 ? "s" : ""} de {cfg.nombreB}</strong> al tope ({veredicto.resB_top.pct}%) · {fmt(veredicto.resB_top.comPorVenta)} c/u<br /><br />
                            Con {veredicto.u3B} ventas de <strong style={{ color: T }}>{cfg.nombreB}</strong> alcanzas el máximo y generas <strong style={{ color: TX }}>{fmt(veredicto.ingreso9B)}</strong>.
                            Si sumas 1 venta de <strong style={{ color: G }}>{cfg.nombreA}</strong>, llegas a <strong style={{ color: TX }}>{fmt(veredicto.ingCombinado)}</strong>.<br /><br />
                            <strong>Recomendación: enfoca tu energía en {cfg.nombreB} (efectividad {veredicto.efB}), llega al nivel máximo y usa {cfg.nombreA} como bono de alto valor.</strong>
                        </div>
                    </div>

                    {/* Riesgos y estrategias */}
                    <SLabel>Riesgos y estrategias</SLabel>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        <div style={crd({ marginBottom: 0 })}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: G, marginBottom: 12 }}>🟡 {cfg.nombreA}</div>
                            <div style={{ fontSize: 13, color: TX2, lineHeight: 1.8 }}>
                                ✅ Ticket alto → cada venta pesa mucho<br />
                                ✅ Ideal para diversificar ingresos<br />
                                ⚠️ Efectividad de presentaciones baja ({cfg.efAMin}–{cfg.efAMax}%)<br />
                                ⚠️ Ciclo de venta más largo<br />
                                💡 <em>1–2 ventas/mes de {cfg.nombreA} son un bono muy significativo</em>
                            </div>
                        </div>
                        <div style={crd({ marginBottom: 0 })}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: T, marginBottom: 12 }}>🟢 {cfg.nombreB}</div>
                            <div style={{ fontSize: 13, color: TX2, lineHeight: 1.8 }}>
                                ✅ Alta efectividad de cierre ({cfg.efBMin}–{cfg.efBMax}%)<br />
                                ✅ Comisión retroactiva al alcanzar escalón<br />
                                ✅ Volumen posible para flujo constante<br />
                                ⚠️ Ticket menor, necesita volumen<br />
                                💡 <em>{cfg.comBUmbral3}+ ventas/mes activa el nivel máximo y cambia todo</em>
                            </div>
                        </div>
                    </div>
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
