import SmartSalesPanel from "./SmartSalesPanel";
import NotificationsPanel from "./NotificationsPanel";
import { useState, useEffect, useMemo, useRef } from "react";
import ReporteAdmin from "./ReporteAdmin";

if (typeof window !== "undefined" && !window.storage) {
  window.storage = {
    async get(key) { const v = localStorage.getItem(key); return v ? { value: v } : null; },
    async set(key, value) { localStorage.setItem(key, value); return true; },
  };
}

// ── CONSTANTS ──────────────────────────────────────────────────────────────────
const LIST_TABS = ["avatar", "circulo", "referidores", "referidos", "facebook"];
const TM = {
  avatar:      { label: "Entrevistados Avatar",  icon: "🎯", color: "#6366f1" },
  circulo:     { label: "Círculo de Poder",       icon: "⭐", color: "#f59e0b" },
  referidores: { label: "Referidores",            icon: "🤝", color: "#10b981" },
  referidos:   { label: "Referidos",              icon: "🔗", color: "#3b82f6" },
  facebook:    { label: "Facebook",               icon: "📘", color: "#818cf8" },
};
const STAGES = {
  avatar:      ["Contactado","Entrevista Avatar","Sesión de Venta","Propuesta Realizada","Pago","Contrato","Testimonio"],
  circulo:     ["Contactado","Agendó Sesión","Sesión de Venta","Propuesta Realizada","Pago","Contrato","Testimonio"],
  referidores: ["Contactado","Propuesta Realizada","Pasó Referidos","Hizo Ventas","Comisiones Pagadas"],
  referidos:   ["Contactado","Sesión de Venta","Propuesta Realizada","Pago","Contrato","Testimonio"],
  facebook:    ["Contactado","Sesión de Venta","Propuesta Realizada","Pago","Contrato","Testimonio"],
};
const KANBAN_COLS = ["Nuevo","Contactado","En Proceso","Propuesta Enviada","Negociación","Cerrado ✅","Perdido ❌"];
const KC = { "Nuevo":"#374151","Contactado":"#6366f1","En Proceso":"#3b82f6","Propuesta Enviada":"#8b5cf6","Negociación":"#f59e0b","Cerrado ✅":"#10b981","Perdido ❌":"#ef4444" };
const ACT_TYPES = [
  { id:"llamada",    label:"Llamada",           icon:"📞" },
  { id:"whatsapp",   label:"WhatsApp",          icon:"💬" },
  { id:"email",      label:"Email",             icon:"📧" },
  { id:"propuesta",  label:"Propuesta enviada", icon:"📄" },
  { id:"reunion",    label:"Reunión",           icon:"🤝" },
  { id:"seguimiento",label:"Seguimiento",       icon:"🔄" },
];
const TASK_TYPES = [
  { id:"llamada",    label:"Llamada",           icon:"📞" },
  { id:"reunion",    label:"Reunión presencial",icon:"🤝" },
  { id:"seguimiento",label:"Seguimiento",       icon:"🔄" },
  { id:"cita",       label:"Cita presencial",   icon:"📅" },
  { id:"apartado",   label:"Apartado",          icon:"🏠" },
  { id:"otro",       label:"Otro",              icon:"⚡" },
];
const CONOCE_POR_OPTIONS = ["Círculo cercano","Marketplace","Redes sociales","TikTok","Referido","Ads","Native Leads","Cliente"];
const PRIO_C = { Alta:"#ef4444", Media:"#f59e0b", Baja:"#10b981" };
const FIELDS = {
  avatar:      ["nombre","correo","telefono","presupuesto","propositoInversion","desarrolloInteres","conocePor"],
  circulo:     ["nombre","correo","telefono","presupuesto","propositoInversion","desarrolloInteres","conocePor"],
  referidores: ["nombre","correo","telefono","propositoInversion","conocePor","comision"],
  referidos:   ["nombre","correo","telefono","presupuesto","propositoInversion","desarrolloInteres","quienRefiere"],
  facebook:    ["nombre","correo","telefono","facebook","amigosCom","presupuesto"],
};
const FL = {
  nombre:"Nombre y Apellido", correo:"Correo", telefono:"Teléfono",
  presupuesto:"Presupuesto ($)", propositoInversion:"Propósito de inversión",
  desarrolloInteres:"Desarrollo de interés", conocePor:"¿De dónde lo conozco?",
  comision:"Comisión acordada", quienRefiere:"¿Quién lo refiere?",
  facebook:"Perfil Facebook", amigosCom:"Amigos en común",
};
const DEFAULT_CONFIG = {
  // General
  agencia:"NATIVE MASTER BROKER", socios:"", moneda:"MXN",
  metaClientes:10, metaIngresos:50000, inversion:0,
  periodoInicio:new Date().toISOString().slice(0,7)+"-01",
  periodoFin:new Date().toISOString().slice(0,10),
  // Alertas y umbrales
  prospectosFriosDias:7, propuestaDias:5,
  // Horario laboral (para notificaciones)
  diasLaborales:[1,2,3,4,5], horaInicioLaboral:"09:00", horaFinLaboral:"19:00",
  // Visibilidad y permisos
  rankingVisible:"todos",   // "todos" | "solo_propio"
  asesoresPuedenEliminar:false,
  maxProspectosAsesor:0,    // 0 = sin límite
  // Campos obligatorios por lista (array de field keys)
  camposObligatorios:{ avatar:["nombre","telefono"], circulo:["nombre","telefono"], referidores:["nombre","telefono"], referidos:["nombre","telefono"], facebook:["nombre","telefono"] },
  // Mensaje de bienvenida
  mensajeBienvenida:"",
  // Etiqueta personalizada del pipeline
  etiquetaCerrado:"Cerrado ✅",
};

// ── UTILS ─────────────────────────────────────────────────────────────────────
const uid  = () => Date.now().toString(36)+Math.random().toString(36).slice(2,5);
const today= () => new Date().toISOString().split("T")[0];
const fd   = d  => d ? new Date(d+"T12:00:00").toLocaleDateString("es-MX",{day:"2-digit",month:"short"}) : "—";
const fm   = (v,c="MXN") => v ? "$"+Number(v).toLocaleString("es-MX")+" "+c : "—";
const ds   = d  => d ? Math.floor((Date.now()-new Date(d+"T12:00:00"))/86400000) : 999;
const isUuid = v => typeof v==="string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

const getVentas = p => {
  if (Array.isArray(p.venta)) return p.venta.filter(v=>v.monto);
  if (p.venta?.monto) return [p.venta];
  return [];
};
const isClosed = (p,tab) => { const s=STAGES[tab]||[]; const k=s.find(x=>x.toLowerCase().includes("pago")||x.toLowerCase().includes("ventas")); return k ? !!p.stages?.[k] : false; };
const pct      = (p,tab) => { const s=STAGES[tab]||[]; const d=s.filter(x=>p.stages?.[x]).length; return s.length ? Math.round(d/s.length*100) : 0; };
const kStage   = (p,tab) => {
  if (p.perdido) return "Perdido ❌";
  if (isClosed(p,tab)) return "Cerrado ✅";
  const s=STAGES[tab]||[]; const pIdx=s.findIndex(x=>x.toLowerCase().includes("propuesta")); const last=s.reduce((a,x,i)=>p.stages?.[x]?i:a,-1);
  if (last<0 && !p.stages?.[s[0]]) return "Nuevo";
  if (last<0) return "Contactado";
  if (pIdx>=0 && last>=pIdx) return last>pIdx ? "Negociación" : "Propuesta Enviada";
  return last>0 ? "En Proceso" : "Contactado";
};
const kanbanToStages = (tab, target) => {
  const stages=STAGES[tab]||[];
  if (target==="Perdido ❌") return { stages:{}, perdido:true };
  // Etapas que el usuario debe marcar manualmente (no auto-fill)
  const MANUAL_STAGES = ["contrato","testimonio","comisiones pagadas"];
  const isManual = s => MANUAL_STAGES.some(m => s.toLowerCase().includes(m));
  const propIdx=stages.findIndex(x=>x.toLowerCase().includes("propuesta"));
  let fill=0;
  if (target==="Nuevo")            fill=0;
  else if (target==="Contactado")  fill=1;
  else if (target==="En Proceso")  fill=2;
  else if (target==="Propuesta Enviada") fill=propIdx>=0 ? propIdx+1 : 3;
  else if (target==="Negociación") fill=propIdx>=0 ? propIdx+2 : 4;
  else if (target==="Cerrado ✅")  fill=stages.length;
  const ns={}; 
  stages.slice(0,fill).forEach(st=>{ 
    if (!isManual(st)) ns[st]=true; 
  });
  return { stages:ns, perdido:false };
};
const calcTemp = (p,tab,tareas) => {
  if (isClosed(p,tab)) return { e:"✅",l:"Cerrado",c:"#10b981" };
  if (p.perdido) return { e:"❌",l:"Perdido",c:"#ef4444" };
  const days=ds(p.updatedAt||p.creadoEn), pr=pct(p,tab), hasTarea=tareas.some(t=>t.prospectId===p.id&&t.estado==="pendiente");
  let score=0;
  if (days<2) score+=3; else if (days<5) score+=2; else if (days<10) score+=1;
  if (pr>75) score+=3; else if (pr>50) score+=2; else if (pr>25) score+=1;
  if (hasTarea) score+=1;
  if (score>=6) return { e:"🔥",l:"Caliente",c:"#ef4444" };
  if (score>=3) return { e:"🟡",l:"Tibio",c:"#f59e0b" };
  return { e:"🧊",l:"Frío",c:"#6366f1" };
};

// ── STYLES ─────────────────────────────────────────────────────────────────────
const S = {
  app:   { fontFamily:"'DM Sans',sans-serif", background:"#07070f", minHeight:"100vh", color:"#dde0f0", display:"flex", fontSize:14 },
  side:  { width:232, background:"#0b0b17", borderRight:"1px solid #14142a", display:"flex", flexDirection:"column", flexShrink:0 },
  logo:  { padding:"22px 18px 16px", borderBottom:"1px solid #14142a" },
  main:  { flex:1, overflow:"auto", display:"flex", flexDirection:"column", minWidth:0 },
  topbar:{ background:"#0b0b17", borderBottom:"1px solid #14142a", padding:"12px 24px", display:"flex", justifyContent:"space-between", alignItems:"center", position:"sticky", top:0, zIndex:10 },
  page:  { padding:"20px 24px", flex:1 },
  card:  { background:"#0d0d1a", border:"1px solid #14142a", borderRadius:12, overflow:"hidden" },
  ch:    { padding:"14px 18px", borderBottom:"1px solid #14142a", display:"flex", justifyContent:"space-between", alignItems:"center" },
  ct:    { fontSize:13, fontWeight:700, color:"#fff" },
  btn:   (v,c) => ({ padding:"8px 16px", borderRadius:8, border:"none", cursor:"pointer", fontWeight:700, fontSize:12, transition:"opacity .15s", background:v==="primary"?(c||"#6366f1"):v==="danger"?"#dc2626":v==="green"?"#10b981":v==="ghost"?"transparent":"#161628", color:v==="ghost"?"#6b7280":"#fff" }),
  inp:   { background:"#07070f", border:"1px solid #1a1a2e", borderRadius:8, padding:"9px 12px", color:"#dde0f0", fontSize:13, width:"100%", outline:"none", boxSizing:"border-box" },
  lbl:   { fontSize:11, color:"#6b7280", fontWeight:700, letterSpacing:.5, marginBottom:5, display:"block" },
  th:    { padding:"9px 14px", textAlign:"left", fontSize:10, color:"#374151", fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", borderBottom:"1px solid #14142a", whiteSpace:"nowrap" },
  td:    { padding:"10px 14px", borderBottom:"1px solid #0c0c18", verticalAlign:"middle" },
  bdg:   (c="#6366f1") => ({ display:"inline-flex", alignItems:"center", padding:"3px 9px", borderRadius:20, fontSize:10, fontWeight:700, background:c+"22", color:c, border:`1px solid ${c}33` }),
  nav:   (a,c="#6366f1") => ({ display:"flex", alignItems:"center", gap:8, padding:"8px 18px", cursor:"pointer", fontSize:12, fontWeight:a?700:400, color:a?"#fff":"#6b7280", background:a?c+"18":"transparent", borderLeft:a?`3px solid ${c}`:"3px solid transparent", transition:"all .15s" }),
  pbw:   { height:5, borderRadius:3, background:"#1a1a2e", overflow:"hidden", flex:1 },
  modal: { position:"fixed", inset:0, background:"rgba(0,0,0,.88)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200, padding:16 },
  mbox:  { background:"#0d0d1a", border:"1px solid #1a1a2e", borderRadius:16, width:"100%", maxWidth:600, maxHeight:"92vh", overflow:"auto", display:"flex", flexDirection:"column" },
  chk:   (on,c) => ({ width:20, height:20, borderRadius:5, border:`2px solid ${on?c:"#374151"}`, background:on?c:"transparent", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", transition:"all .15s", flexShrink:0 }),
  g2:    { display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 },
  row:   { display:"flex", gap:10, alignItems:"center" },
};

const Chk = ({ on, color="#6366f1", onChange }) => (
  <div style={S.chk(on,color)} onClick={onChange}>
    {on && <svg width="11" height="11" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
  </div>
);
const PBar = ({ p, color, h=5 }) => (
  <div style={{...S.pbw,height:h}}>
    <div style={{ height:"100%", width:`${Math.min(p,100)}%`, background:color, borderRadius:3, transition:"width .4s" }}/>
  </div>
);

// ── APP ────────────────────────────────────────────────────────────────────────
export default function CRM({ user, role="team" }) {
  const [view,    setView]    = useState("dashboard");
  const [pros,    setPros]    = useState({ avatar:[],circulo:[],referidores:[],referidos:[],facebook:[] });
  const [tareas,  setTareas]  = useState([]);
  const [acts,    setActs]    = useState([]);
  const [cfg,     setCfg]     = useState(DEFAULT_CONFIG);
  const [profiles,setProfiles]= useState([]);
  const [modal,   setModal]   = useState(null);
  const [toast,   setToast]   = useState(null);
  const [saving,  setSaving]  = useState(false);
  const [kFilter, setKFilter] = useState("all");
  const [notifUnread, setNotifUnread] = useState(0);
  // Admin global filter: "all" | user_id
  const [viewAs, setViewAs] = useState("all");
  // Persists ProspectModal form state at CRM level so it survives component remounts
  // (ProspectModal re-defined on every CRM render → React unmounts/remounts it)
  const prospectStateRef = useRef({ key: null, form: null, ventas: null, tab: "datos" });

  const safeRole = String(role||"").trim().toLowerCase();
  const isAdmin  = safeRole === "admin";

  // ── LOAD ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { supabase } = await import("./supabaseClient");
        const { dbGetProspects, dbGetTasks, dbGetActivities, dbGetTasksWithOwner, dbGetConfig } = await import("./db");

        const entries = await Promise.all(
          LIST_TABS.map(async tab => {
            const rows = await dbGetProspects(tab);
            const list = (rows??[]).map(r => ({
              id:r.id, tab:r.tab,
              owner_id: r.owner_id||null,
              owner_name: r.owner_name||null,
              ...(r.data||{}),
              stages: r.stages||{},
              perdido: !!r.perdido,
              venta: r.venta||[],
              notasHistorial: r.notas_historial||[],
              creadoEn: (r.created_at||"").slice(0,10),
              updatedAt: (r.updated_at||"").slice(0,10),
            }));
            return [tab, list];
          })
        );

        const tRows = isAdmin ? await dbGetTasksWithOwner() : await dbGetTasks();
        const tList = (tRows??[]).map(t => ({
          id:t.id, prospectId:t.prospect_id||"",
          titulo:t.titulo, prioridad:t.prioridad,
          fecha:(t.fecha||"").slice(0,10),
          hora: t.hora||"",
          tipoTarea: t.tipo_tarea||"llamada",
          estado:t.estado, notas:t.notas||"",
          ownerId:t.owner_id||"", ownerName:t.owner_name||t.ownerName||"—", ownerRole:t.owner_role||t.ownerRole||null,
        }));

        const aRows = await import("./db").then(m=>m.dbGetActivities());
        const aList = (aRows??[]).map(a => ({
          id:a.id, tipo:a.tipo, cantidad:a.cantidad,
          fecha:(a.fecha||"").slice(0,10), notas:a.notas||"",
          prospectId:a.prospect_id||null,
          ownerId:a.owner_id||"", ownerName:a.owner_name||a.ownerName||"—", ownerRole:a.owner_role||a.ownerRole||null,
        }));

        const { data: pRows } = await supabase.from("profiles").select("*");

        let c=null; try { c=await dbGetConfig(); } catch {}

        if (!alive) return;
        setPros({ avatar:[],circulo:[],referidores:[],referidos:[],facebook:[], ...Object.fromEntries(entries) });
        setTareas(tList);
        setActs(aList);
        setProfiles(pRows||[]);
        if (c) {
          const s = c.settings || {};
          setCfg({ ...DEFAULT_CONFIG,
            agencia:c.agencia, socios:c.socios, moneda:c.moneda,
            metaClientes:c.meta_clientes, metaIngresos:Number(c.meta_ingresos),
            inversion:Number(c.inversion),
            periodoInicio:(c.periodo_inicio||"").slice(0,10),
            periodoFin:(c.periodo_fin||"").slice(0,10),
            // Extended settings stored in JSONB
            prospectosFriosDias: s.prospectosFriosDias ?? 7,
            propuestaDias:       s.propuestaDias       ?? 5,
            diasLaborales:       s.diasLaborales       ?? [1,2,3,4,5],
            horaInicioLaboral:   s.horaInicioLaboral   ?? "09:00",
            horaFinLaboral:      s.horaFinLaboral      ?? "19:00",
            rankingVisible:      s.rankingVisible      ?? "todos",
            asesoresPuedenEliminar: s.asesoresPuedenEliminar ?? false,
            maxProspectosAsesor: s.maxProspectosAsesor ?? 0,
            camposObligatorios:  s.camposObligatorios  ?? DEFAULT_CONFIG.camposObligatorios,
            mensajeBienvenida:   s.mensajeBienvenida   ?? "",
            etiquetaCerrado:     s.etiquetaCerrado     ?? "Cerrado ✅",
          });
        }
      } catch(e) { console.error(e); }
    })();
    return () => { alive=false; };
  }, []);

  const toast_ = (msg,ok=true) => { setToast({msg,ok}); setTimeout(()=>setToast(null),2600); };
  const allP   = useMemo(() => LIST_TABS.flatMap(t=>pros[t].map(p=>({...p,_tab:t}))), [pros]);

  // Filtered display data for admin viewAs — does NOT affect allP (used in autocomplete/modals)
  const displayPros = useMemo(() => {
    if (!isAdmin || viewAs === "all") return pros;
    return Object.fromEntries(LIST_TABS.map(t => [t, pros[t].filter(p => p.owner_id === viewAs)]));
  }, [pros, viewAs, isAdmin]);
  const displayAllP = useMemo(() => LIST_TABS.flatMap(t=>displayPros[t].map(p=>({...p,_tab:t}))), [displayPros]);
  const displayTareas = useMemo(() => {
    if (!isAdmin || viewAs === "all") return tareas;
    return tareas.filter(t => t.ownerId === viewAs);
  }, [tareas, viewAs, isAdmin]);
  const displayActs = useMemo(() => {
    if (!isAdmin || viewAs === "all") return acts;
    return acts.filter(a => a.ownerId === viewAs);
  }, [acts, viewAs, isAdmin]);

  // ── STATS ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    // Use display versions so Dashboard/ModoVendedor respect viewAs filter
    const closed   = LIST_TABS.reduce((a,t)=>a+displayPros[t].filter(p=>isClosed(p,t)).length,0);
    const total    = LIST_TABS.reduce((a,t)=>a+displayPros[t].length,0);
    const byTab    = Object.fromEntries(LIST_TABS.map(t=>[t,displayPros[t].length]));
    const cByTab   = Object.fromEntries(LIST_TABS.map(t=>[t,displayPros[t].filter(p=>isClosed(p,t)).length]));
    const allVentas= displayAllP.flatMap(p=>getVentas(p).map(v=>({...v,_p:p})));
    const mrr      = allVentas.reduce((s,v)=>s+Number(v.monto||0),0);
    const ticket   = allVentas.length ? mrr/allVentas.length : 0;
    const roi      = Number(cfg.inversion)>0 ? Math.round((mrr-Number(cfg.inversion))/Number(cfg.inversion)*100) : null;
    const frios    = displayAllP.filter(p=>!isClosed(p,p._tab)&&!p.perdido&&ds(p.updatedAt||p.creadoEn)>7);
    const wAgo     = new Date(Date.now()-7*864e5).toISOString().split("T")[0];
    const mStart   = today().slice(0,7)+"-01";
    const actW     = displayActs.filter(a=>a.fecha>=wAgo);
    const actM     = displayActs.filter(a=>a.fecha>=mStart);
    const actTot   = displayActs.reduce((a,x)=>a+(Number(x.cantidad)||1),0);
    const convRate = total ? Math.round(closed/total*100) : 0;
    const propSent = displayAllP.filter(p=>{ const s=STAGES[p._tab]||[]; return s.some(x=>x.toLowerCase().includes("propuesta")&&p.stages?.[x]); }).length;
    const contacted= displayAllP.filter(p=>{ const s=STAGES[p._tab]||[]; return s[0]&&p.stages?.[s[0]]; }).length;
    const tarHoy   = displayTareas.filter(t=>t.estado==="pendiente"&&t.fecha<=today());
    const dayN     = new Date().getDate();
    const daysIM   = new Date(new Date().getFullYear(),new Date().getMonth()+1,0).getDate();
    const proyect  = dayN>0 ? Math.round(closed/dayN*daysIM) : 0;
    return { closed,total,byTab,cByTab,mrr,ticket,roi,frios,actW,actM,actTot,convRate,propSent,contacted,tarHoy,proyect,allVentas };
  }, [allP,tareas,acts,cfg,pros]);

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const mapTaskRow = row => ({
    id:row.id, prospectId:row.prospect_id||"",
    titulo:row.titulo, prioridad:row.prioridad,
    fecha:(row.fecha||"").slice(0,10),
    hora:row.hora||"",
    tipoTarea:row.tipo_tarea||"llamada",
    estado:row.estado, notas:row.notas||"",
    ownerId:row.owner_id||"", ownerName:row.owner_name||row.ownerName||"—", ownerRole:row.owner_role||row.ownerRole||null,
  });

  const reloadTareas = async () => {
    const { dbGetTasks, dbGetTasksWithOwner } = await import("./db");
    const rows = isAdmin ? await dbGetTasksWithOwner() : await dbGetTasks();
    setTareas((rows??[]).map(mapTaskRow));
  };

  const reloadPros = async (tab) => {
    const { dbGetProspects } = await import("./db");
    const rows = await dbGetProspects(tab);
    const list = (rows??[]).map(r=>({
      id:r.id, tab:r.tab,
      owner_id:r.owner_id||null, owner_name:r.owner_name||null,
      ...(r.data||{}),
      stages:r.stages||{}, perdido:!!r.perdido,
      venta:r.venta||[],
      notasHistorial:r.notas_historial||[],
      creadoEn:(r.created_at||"").slice(0,10),
      updatedAt:(r.updated_at||"").slice(0,10),
    }));
    setPros(prev=>({...prev,[tab]:list}));
  };

  const saveP = async (tab, p) => {
    // OWNER FIX: admin puede reasignar; non-admin siempre preserva owner original
    const existingOwner = allP.find(x=>x.id===p.id)?.owner_id;
    const ownerId = (isAdmin && p.owner_id) ? p.owner_id : (existingOwner || user.id);
    const u = { ...p, owner_id: ownerId, updatedAt: today() };

    // Optimistic UI
    setPros(prev => {
      const l=prev[tab];
      return { ...prev, [tab]: l.find(x=>x.id===p.id) ? l.map(x=>x.id===p.id?u:x) : [...l,u] };
    });

    try {
      const { dbUpsertProspect } = await import("./db");
      const conocePorVal = typeof u.conocePor === 'string' ? u.conocePor : (Array.isArray(u.conocePor) ? (u.conocePor[0]||"") : "");
      const dataFields = Object.fromEntries((FIELDS[tab]||[]).map(k=>[k, k==="conocePor" ? conocePorVal : (u[k]??"")]));
      const payload = {
        ...(isUuid(u.id) ? {id:u.id} : {}),
        tab,
        owner_id: ownerId,
        data: dataFields,
        stages: u.stages||{},
        perdido: !!u.perdido,
        venta: Array.isArray(u.venta) ? u.venta : (u.venta?.monto ? [u.venta] : []),
        notas_historial: u.notasHistorial||[],
      };
      await dbUpsertProspect(payload);
      await reloadPros(tab);
    } catch(e) { console.error(e); toast_("Error guardando en Supabase",false); }

    toast_("✅ Guardado");
    setModal(null);
  };

  const delP = async (tab,id) => {
    if (!confirm("¿Eliminar este registro?")) return;
    setPros(prev=>({...prev,[tab]:prev[tab].filter(p=>p.id!==id)}));
    try { const { dbDeleteProspect }=await import("./db"); await dbDeleteProspect(id); } catch(e) { console.error(e); }
    toast_("Eliminado",false);
    setModal(null);
  };

  const toggleStage = async (tab,pid,stage) => {
    const n={...pros,[tab]:pros[tab].map(p=>p.id===pid?{...p,stages:{...p.stages,[stage]:!p.stages?.[stage]},updatedAt:today()}:p)};
    const p=n[tab].find(x=>x.id===pid);
    if (!p) return;
    // Build auto-nota inline so we save stages + nota in ONE call
    const hora = new Date().toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"});
    const accion = p.stages?.[stage] ? "✅" : "↩️";
    const nota = { id:uid(), texto:`${accion} Etapa "${stage}" ${p.stages?.[stage]?"completada":"desmarcada"}`, fecha:today(), hora };
    const newHistorial = [...(p.notasHistorial||[]), nota];
    const pWithNota = {...p, notasHistorial:newHistorial};
    setPros({...n,[tab]:n[tab].map(x=>x.id===pid?pWithNota:x)});
    try {
      const { dbUpsertProspect }=await import("./db");
      const existingOwner=allP.find(x=>x.id===pid)?.owner_id||user.id;
      const conocePorVal=Array.isArray(p.conocePor)?p.conocePor:(p.conocePor?[p.conocePor]:[]);
      await dbUpsertProspect({ id:pid, tab, owner_id:existingOwner, data:Object.fromEntries((FIELDS[tab]||[]).map(k=>[k,k==="conocePor"?conocePorVal:(p[k]??"")] )), stages:p.stages||{}, perdido:!!p.perdido, venta:Array.isArray(p.venta)?p.venta:(p.venta?.monto?[p.venta]:[]), notas_historial:newHistorial });
    } catch(e){ console.error(e); }
  };

  const saveTarea = async (t) => {
    const isExisting = !!tareas.find(x=>x.id===t.id);
    const n = isExisting ? tareas.map(x=>x.id===t.id?t:x) : [...tareas,t];
    setTareas(n);
    try {
      const { dbUpsertTask }=await import("./db");
      await dbUpsertTask({
        ...(isUuid(t.id)?{id:t.id}:{}),
        owner_id:user.id, prospect_id:t.prospectId||null,
        titulo:t.titulo, prioridad:t.prioridad, fecha:t.fecha,
        hora:t.hora||null, tipo_tarea:t.tipoTarea||"llamada",
        estado:t.estado, notas:t.notas||"",
      });
      await reloadTareas();
      // Auto-nota en historial del contacto
      if (t.prospectId) {
        const tt=TASK_TYPES.find(x=>x.id===t.tipoTarea)||{icon:"✅",label:"Tarea"};
        const accion = isExisting ? "editada" : "creada";
        const txt = `${tt.icon} Tarea ${accion}: "${t.titulo}"${t.notas?` — ${t.notas}`:""}`;
        await addAutoNota(t.prospectId, txt);
      }
    } catch(e) { console.error(e); toast_("Error guardando tarea",false); }
    toast_("✅ Tarea guardada");
    setModal(null);
  };

  const saveTareaInline = async (t) => {
    const isExisting = !!tareas.find(x=>x.id===t.id);
    const n = isExisting ? tareas.map(x=>x.id===t.id?t:x) : [...tareas,t];
    setTareas(n);
    try {
      const { dbUpsertTask }=await import("./db");
      await dbUpsertTask({
        ...(isUuid(t.id)?{id:t.id}:{}),
        owner_id:user.id, prospect_id:t.prospectId||null,
        titulo:t.titulo, prioridad:t.prioridad, fecha:t.fecha,
        hora:t.hora||null, tipo_tarea:t.tipoTarea||"llamada",
        estado:t.estado, notas:t.notas||"",
      });
      await reloadTareas();
      // Auto-nota en historial del contacto
      if (t.prospectId) {
        const tt=TASK_TYPES.find(x=>x.id===t.tipoTarea)||{icon:"✅",label:"Tarea"};
        const txt = `${tt.icon} Tarea ${isExisting?"editada":"creada"}: "${t.titulo}"${t.prioridad?` [${t.prioridad}]`:""}`;
        await addAutoNota(t.prospectId, txt);
      }
    } catch(e) { console.error(e); toast_("Error guardando tarea",false); }
  };

  const toggleTarea = async (id) => {
    const n=tareas.map(t=>t.id===id?{...t,estado:t.estado==="pendiente"?"completada":"pendiente"}:t);
    setTareas(n);
    try {
      const t=n.find(x=>x.id===id); if (!t||!isUuid(t.id)) return;
      const { dbUpsertTask }=await import("./db");
      await dbUpsertTask({ id:t.id, owner_id:user.id, prospect_id:t.prospectId||null, titulo:t.titulo, prioridad:t.prioridad, fecha:t.fecha, hora:t.hora||null, tipo_tarea:t.tipoTarea||"llamada", estado:t.estado, notas:t.notas||"" });
      await reloadTareas();
      // Auto-nota al contacto
      if (t.prospectId) {
        const tt=TASK_TYPES.find(x=>x.id===t.tipoTarea)||{icon:"✅",label:"Tarea"};
        const estado = t.estado==="completada" ? "✅ completada" : "↩️ reabierta";
        await addAutoNota(t.prospectId, `${tt.icon} Tarea ${estado}: "${t.titulo}"`);
      }
    } catch(e) { console.error(e); }
  };

  const delTarea = async (id) => {
    setTareas(prev=>prev.filter(t=>t.id!==id));
    try { if (isUuid(id)) { const { dbDeleteTask }=await import("./db"); await dbDeleteTask(id); } await reloadTareas(); } catch(e) { console.error(e); }
  };

  // ── AUTO-NOTA HELPER ─────────────────────────────────────────────────────
  const addAutoNota = async (prospectId, texto) => {
    if (!prospectId) return;
    const p = allP.find(x => x.id === prospectId);
    if (!p) return;
    const hora = new Date().toLocaleTimeString("es-MX", {hour:"2-digit", minute:"2-digit"});
    const nota = { id: uid(), texto, fecha: today(), hora };
    const newHistorial = [...(p.notasHistorial||[]), nota];
    const tab = p._tab;
    setPros(prev => ({
      ...prev,
      [tab]: prev[tab].map(x => x.id === p.id ? {...x, notasHistorial: newHistorial} : x)
    }));
    try {
      const { dbUpsertProspect } = await import("./db");
      const conocePorVal = Array.isArray(p.conocePor) ? p.conocePor : (p.conocePor ? [p.conocePor] : []);
      const dataFields = Object.fromEntries((FIELDS[tab]||[]).map(k=>[k, k==="conocePor" ? conocePorVal : (p[k]??"")]));
      await dbUpsertProspect({ id:p.id, tab, owner_id:p.owner_id, data:dataFields, stages:p.stages||{}, perdido:!!p.perdido, venta:Array.isArray(p.venta)?p.venta:(p.venta?.monto?[p.venta]:[]), notas_historial:newHistorial });
    } catch(e) { console.error("addAutoNota error:", e); }
  };

  const addAct = async (a) => {
    const optimistic=[...acts,{id:uid(),fecha:a.fecha||today(),...a,prospectId:a.prospect_id||null,ownerId:user.id,ownerName:user?.user_metadata?.full_name||"—",ownerRole:role||"team"}];
    setActs(optimistic);
    try {
      const { dbInsertActivity, dbGetActivities }=await import("./db");
      await dbInsertActivity({ owner_id:user.id, tipo:a.tipo, cantidad:Number(a.cantidad||1), fecha:a.fecha||today(), notas:a.notas||"", prospect_id:a.prospect_id||null });
      const rows=await dbGetActivities();
      const list=(rows??[]).map(row=>({ id:row.id, tipo:row.tipo, cantidad:row.cantidad, fecha:(row.fecha||"").slice(0,10), notas:row.notas||"", prospectId:row.prospect_id||null, ownerId:row.owner_id||"", ownerName:row.owner_name||row.ownerName||"—", ownerRole:row.owner_role||row.ownerRole||null }));
      if (list.length>0) setActs(list);
      // Auto-nota en historial del contacto
      if (a.prospect_id) {
        const at=ACT_TYPES.find(x=>x.id===a.tipo)||{icon:"⚡",label:a.tipo};
        const txt=`${at.icon} ${at.label}${a.cantidad>1?` (×${a.cantidad})`:""}${a.notas?` — "${a.notas}"`:""}`;
        await addAutoNota(a.prospect_id, txt);
      }
    } catch(e) { console.error(e); toast_("Error registrando actividad",false); }
    toast_("✅ Actividad registrada");
    // Notificación al navegador
    try {
      const { showBrowserNotif } = await import("./NotificationsPanel");
      const at=ACT_TYPES.find(x=>x.id===a.tipo)||{icon:"⚡",label:a.tipo};
      showBrowserNotif(`${at.icon} Actividad registrada`, `${at.label}${a.cantidad>1?` ×${a.cantidad}`:""}${a.notas?` — ${a.notas}`:""}`);
    } catch {}
    setModal(null);
  };

  const saveCfg = async (c) => {
    setCfg(c);
    try {
      const { dbUpdateConfig, dbGetConfig }=await import("./db");
      const settings = {
        prospectosFriosDias: c.prospectosFriosDias,
        propuestaDias:       c.propuestaDias,
        diasLaborales:       c.diasLaborales,
        horaInicioLaboral:   c.horaInicioLaboral,
        horaFinLaboral:      c.horaFinLaboral,
        rankingVisible:      c.rankingVisible,
        asesoresPuedenEliminar: c.asesoresPuedenEliminar,
        maxProspectosAsesor: c.maxProspectosAsesor,
        camposObligatorios:  c.camposObligatorios,
        mensajeBienvenida:   c.mensajeBienvenida,
        etiquetaCerrado:     c.etiquetaCerrado,
      };
      await dbUpdateConfig({ agencia:c.agencia||"Native Master Broker", socios:c.socios||"", moneda:c.moneda||"MXN", meta_clientes:Number(c.metaClientes||10), meta_ingresos:Number(c.metaIngresos||50000), inversion:Number(c.inversion||0), periodo_inicio:c.periodoInicio, periodo_fin:c.periodoFin, settings });
      const row=await dbGetConfig();
      const s=row.settings||{};
      setCfg({ ...DEFAULT_CONFIG, agencia:row.agencia, socios:row.socios, moneda:row.moneda, metaClientes:row.meta_clientes, metaIngresos:Number(row.meta_ingresos), inversion:Number(row.inversion), periodoInicio:(row.periodo_inicio||"").slice(0,10), periodoFin:(row.periodo_fin||"").slice(0,10), prospectosFriosDias:s.prospectosFriosDias??7, propuestaDias:s.propuestaDias??5, diasLaborales:s.diasLaborales??[1,2,3,4,5], horaInicioLaboral:s.horaInicioLaboral??"09:00", horaFinLaboral:s.horaFinLaboral??"19:00", rankingVisible:s.rankingVisible??"todos", asesoresPuedenEliminar:s.asesoresPuedenEliminar??false, maxProspectosAsesor:s.maxProspectosAsesor??0, camposObligatorios:s.camposObligatorios??DEFAULT_CONFIG.camposObligatorios, mensajeBienvenida:s.mensajeBienvenida??"", etiquetaCerrado:s.etiquetaCerrado??"Cerrado ✅" });
    } catch(e) { console.error(e); toast_("Error guardando config",false); return; }
    toast_("✅ Configuración guardada");
    setModal(null);
  };

  // ── DASHBOARD ─────────────────────────────────────────────────────────────
  const Dashboard = () => {
    const gPct=Math.min(stats.closed/Number(cfg.metaClientes||10)*100,100);
    const rPct=Math.min(stats.mrr/Number(cfg.metaIngresos||50000)*100,100);
    return (
      <div style={{display:"flex",flexDirection:"column",gap:18}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <div style={{background:"linear-gradient(135deg,#3730a3,#6d28d9)",borderRadius:14,padding:24,position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",right:-20,top:-20,width:130,height:130,background:"rgba(255,255,255,.05)",borderRadius:"50%"}}/>
            <div style={{fontSize:10,color:"rgba(255,255,255,.6)",fontWeight:700,letterSpacing:2,marginBottom:8}}>🎯 META CLIENTES</div>
            <div style={{display:"flex",alignItems:"flex-end",gap:8,marginBottom:12}}>
              <span style={{fontSize:50,fontWeight:900,color:"#fff",lineHeight:1}}>{stats.closed}</span>
              <span style={{fontSize:24,color:"rgba(255,255,255,.35)",marginBottom:4}}>/{cfg.metaClientes||10}</span>
            </div>
            <div style={{background:"rgba(255,255,255,.2)",borderRadius:6,height:9,overflow:"hidden",marginBottom:5}}>
              <div style={{height:"100%",width:`${gPct}%`,background:"rgba(255,255,255,.9)",borderRadius:6,transition:"width .8s"}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"rgba(255,255,255,.6)"}}>
              <span>{Math.round(gPct)}% completado</span><span>Proyección: {stats.proyect} al cierre</span>
            </div>
          </div>
          <div style={{background:"linear-gradient(135deg,#065f46,#047857)",borderRadius:14,padding:24,position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",right:-20,top:-20,width:130,height:130,background:"rgba(255,255,255,.05)",borderRadius:"50%"}}/>
            <div style={{fontSize:10,color:"rgba(255,255,255,.6)",fontWeight:700,letterSpacing:2,marginBottom:8}}>💰 META INGRESOS</div>
            <div style={{display:"flex",alignItems:"flex-end",gap:8,marginBottom:12}}>
              <span style={{fontSize:28,fontWeight:900,color:"#fff",lineHeight:1}}>{fm(stats.mrr,cfg.moneda)}</span>
            </div>
            <div style={{background:"rgba(255,255,255,.2)",borderRadius:6,height:9,overflow:"hidden",marginBottom:5}}>
              <div style={{height:"100%",width:`${rPct}%`,background:"rgba(255,255,255,.9)",borderRadius:6,transition:"width .8s"}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"rgba(255,255,255,.6)"}}>
              <span>{Math.round(rPct)}% de {fm(cfg.metaIngresos,cfg.moneda)}</span>
              {stats.roi!==null&&<span>ROI: {stats.roi}%</span>}
            </div>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12}}>
          {[
            {l:"Total Prospectos",v:stats.total,c:"#6366f1",sub:"en pipeline"},
            {l:"Propuestas",v:stats.propSent,c:"#8b5cf6",sub:"enviadas"},
            {l:"Actividades",v:stats.actTot,c:"#3b82f6",sub:"registradas"},
            {l:"Tareas hoy",v:stats.tarHoy.length,c:stats.tarHoy.length?"#ef4444":"#10b981",sub:"pendientes"},
            {l:"Conversión",v:`${stats.convRate}%`,c:"#f59e0b",sub:"tasa global"},
          ].map(k=>(
            <div key={k.l} style={{background:"#0d0d1a",border:`1px solid ${k.c}22`,borderTop:`3px solid ${k.c}`,borderRadius:12,padding:16}}>
              <div style={{fontSize:28,fontWeight:900,color:k.c,lineHeight:1}}>{k.v}</div>
              <div style={{fontSize:11,color:"#fff",fontWeight:600,marginTop:5}}>{k.l}</div>
              <div style={{fontSize:10,color:"#374151"}}>{k.sub}</div>
            </div>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"5fr 3fr",gap:16}}>
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            <div style={S.card}>
              <div style={S.ch}><span style={S.ct}>📊 Embudo de conversión</span><span style={S.bdg("#6366f1")}>{stats.convRate}% tasa</span></div>
              <div style={{padding:18,display:"flex",flexDirection:"column",gap:10}}>
                {[{l:"Prospectos totales",v:stats.total,c:"#6366f1"},{l:"Contactados",v:stats.contacted,c:"#3b82f6"},{l:"Propuestas enviadas",v:stats.propSent,c:"#8b5cf6"},{l:"Clientes cerrados",v:stats.closed,c:"#10b981"}].map((f,i,arr)=>{
                  const p2=arr[0].v?Math.round(f.v/arr[0].v*100):0;
                  return (<div key={f.l}><div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:12,color:"#9ca3af"}}>{f.l}</span><div style={S.row}><span style={{fontSize:11,color:f.c,fontWeight:700}}>{f.v}</span><span style={{fontSize:10,color:"#374151"}}>({p2}%)</span></div></div><PBar p={p2} color={f.c}/></div>);
                })}
              </div>
            </div>
            <div style={S.card}>
              <div style={S.ch}><span style={S.ct}>⚡ Actividad esta semana</span><button style={S.btn("primary")} onClick={()=>setModal({type:"actividad"})}>+ Registrar</button></div>
              <div style={{padding:16,display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:10}}>
                {ACT_TYPES.map(a=>{
                  const cnt=stats.actW.filter(x=>x.tipo===a.id).reduce((s,x)=>s+(Number(x.cantidad)||1),0);
                  return (<div key={a.id} style={{textAlign:"center",background:"#07070f",borderRadius:10,padding:12,cursor:"pointer"}} onClick={()=>setModal({type:"actividad",pre:{tipo:a.id}})}><div style={{fontSize:22,marginBottom:3}}>{a.icon}</div><div style={{fontSize:22,fontWeight:900,color:"#fff",lineHeight:1}}>{cnt}</div><div style={{fontSize:9,color:"#4b5563",marginTop:3}}>{a.label}</div></div>);
                })}
              </div>
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={S.card}>
              <div style={S.ch}><span style={S.ct}>🧊 Prospectos fríos</span><span style={S.bdg("#ef4444")}>{stats.frios.length}</span></div>
              <div style={{padding:12}}>
                {stats.frios.length===0
                  ? <div style={{fontSize:12,color:"#374151",textAlign:"center",padding:16}}>¡Todos activos! 🔥</div>
                  : stats.frios.slice(0,5).map(p=>(<div key={p.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid #14142a",cursor:"pointer"}} onClick={()=>setModal({type:"prospect",tab:p._tab,person:p})}><div><div style={{fontSize:12,fontWeight:600,color:"#fff"}}>{p.nombre}</div><div style={{fontSize:10,color:"#ef4444"}}>{ds(p.updatedAt||p.creadoEn)}d sin actividad</div></div><span style={S.bdg(TM[p._tab].color)}>{TM[p._tab].icon}</span></div>))
                }
              </div>
            </div>
            <div style={S.card}>
              <div style={S.ch}><span style={S.ct}>✅ Tareas hoy</span></div>
              <div style={{padding:12}}>
                {stats.tarHoy.length===0
                  ? <div style={{fontSize:12,color:"#374151",textAlign:"center",padding:16}}>Sin tareas pendientes</div>
                  : stats.tarHoy.slice(0,5).map(t=>(<div key={t.id} style={{display:"flex",gap:8,alignItems:"center",padding:"7px 0",borderBottom:"1px solid #14142a"}}><Chk on={false} color="#10b981" onChange={()=>toggleTarea(t.id)}/><div style={{flex:1}}><div style={{fontSize:12,color:"#fff"}}>{t.titulo}</div><div style={{fontSize:10,color:PRIO_C[t.prioridad]}}>{t.prioridad}</div></div></div>))
                }
                {stats.tarHoy.length>5&&<div style={{fontSize:10,color:"#374151",textAlign:"center",paddingTop:8}}>+{stats.tarHoy.length-5} más</div>}
              </div>
            </div>
            <div style={S.card}>
              <div style={S.ch}><span style={S.ct}>📈 Proyección del mes</span></div>
              <div style={{padding:18,textAlign:"center"}}>
                <div style={{fontSize:42,fontWeight:900,color:"#6366f1",lineHeight:1}}>{stats.proyect}</div>
                <div style={{fontSize:11,color:"#6b7280",marginTop:4}}>clientes proyectados</div>
                <div style={{fontSize:11,color:stats.proyect>=Number(cfg.metaClientes)?"#10b981":"#ef4444",fontWeight:700,marginTop:8}}>{stats.proyect>=Number(cfg.metaClientes)?"🎉 ¡Vas a alcanzar la meta!":"⚠️ Necesitas acelerar el ritmo"}</div>
              </div>
            </div>
          </div>
        </div>
        <div style={S.card}>
          <div style={S.ch}><span style={S.ct}>🕐 Últimos registros</span></div>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr><th style={S.th}>Nombre</th><th style={S.th}>Canal</th><th style={S.th}>Progreso</th><th style={S.th}>Temp.</th><th style={S.th}>Estado</th></tr></thead>
            <tbody>
              {allP.sort((a,b)=>(b.updatedAt||b.creadoEn||"").localeCompare(a.updatedAt||a.creadoEn||"")).slice(0,7).map(p=>{
                const pc=pct(p,p._tab); const cl=isClosed(p,p._tab); const temp=calcTemp(p,p._tab,tareas);
                return (<tr key={p.id} style={{cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.background="#0f0f1c"} onMouseLeave={e=>e.currentTarget.style.background="transparent"} onClick={()=>setModal({type:"prospect",tab:p._tab,person:p})}>
                  <td style={S.td}><div style={{fontWeight:600,color:"#fff"}}>{p.nombre}</div><div style={{fontSize:10,color:"#374151"}}>{fd(p.updatedAt||p.creadoEn)}</div></td>
                  <td style={S.td}><span style={S.bdg(TM[p._tab].color)}>{TM[p._tab].icon} {TM[p._tab].label}</span></td>
                  <td style={{...S.td,minWidth:120}}><div style={S.row}><PBar p={pc} color={TM[p._tab].color}/><span style={{fontSize:10,color:"#6b7280",whiteSpace:"nowrap"}}>{pc}%</span></div></td>
                  <td style={S.td}><span title={temp.l} style={{fontSize:16}}>{temp.e}</span></td>
                  <td style={S.td}><span style={S.bdg(cl?"#10b981":p.perdido?"#ef4444":"#374151")}>{cl?"✅ Cerrado":p.perdido?"❌ Perdido":"🔄 Activo"}</span></td>
                </tr>);
              })}
              {allP.length===0&&<tr><td colSpan={5} style={{...S.td,textAlign:"center",color:"#374151",padding:36}}>¡Agrega tu primer prospecto desde las listas! 🚀</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ── KANBAN con Drag & Drop ────────────────────────────────────────────────
  const Kanban = () => {
    const [dragId,  setDragId]  = useState(null);
    const [dragTab, setDragTab] = useState(null);
    const [overCol, setOverCol] = useState(null);
    const filtered = displayAllP.filter(p=>kFilter==="all"||p._tab===kFilter);
    const byStage  = Object.fromEntries(KANBAN_COLS.map(st=>[st,filtered.filter(p=>kStage(p,p._tab)===st)]));

    const onDragStart = (p) => { setDragId(p.id); setDragTab(p._tab); };
    const onDrop = async (targetStage) => {
      if (!dragId||!dragTab) return;
      const p = pros[dragTab].find(x=>x.id===dragId);
      if (!p) return;
      const { stages: newStages, perdido } = kanbanToStages(dragTab, targetStage);
      const updated = { ...p, stages:newStages, perdido, updatedAt:today() };
      setPros(prev=>({...prev,[dragTab]:prev[dragTab].map(x=>x.id===dragId?updated:x)}));
      try {
        const { dbUpsertProspect }=await import("./db");
        const existingOwner=allP.find(x=>x.id===dragId)?.owner_id||user.id;
        await dbUpsertProspect({ 
  id:dragId, 
  tab:dragTab, 
  owner_id:existingOwner, 
  data:Object.fromEntries((FIELDS[dragTab]||[]).map(k=>[k,k==="conocePor"?(Array.isArray(p.conocePor)?p.conocePor:(p.conocePor?[p.conocePor]:[])):(p[k]??"")])), 
  stages:newStages, 
  perdido, 
  venta:Array.isArray(p.venta)?p.venta:(p.venta?.monto?[p.venta]:[]), 
  notas_historial:p.notasHistorial||[] 
});
        await reloadPros(dragTab);
      } catch(e) { console.error(e); toast_("Error moviendo prospecto",false); }
      setDragId(null); setDragTab(null); setOverCol(null);
    };

    return (
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {[{id:"all",label:"Todos los canales"},...LIST_TABS.map(t=>({id:t,label:TM[t].label,color:TM[t].color}))].map(f=>(
            <button key={f.id} style={{...S.btn(kFilter===f.id?"primary":"secondary",f.color),padding:"6px 14px"}} onClick={()=>setKFilter(f.id)}>{f.id==="all"?"🌐 ":""}{f.label}</button>
          ))}
        </div>
        <div style={{display:"flex",gap:12,overflowX:"auto",paddingBottom:16,alignItems:"flex-start"}}>
          {KANBAN_COLS.filter(st=>st!=="Perdido ❌"||(byStage["Perdido ❌"]||[]).length>0).map(stage=>{
            const cards=byStage[stage]||[]; const color=KC[stage];
            const isOver=overCol===stage;
            return (
              <div key={stage} style={{minWidth:215,flex:"0 0 215px"}}
                onDragOver={e=>{e.preventDefault();setOverCol(stage);}}
                onDragLeave={()=>setOverCol(null)}
                onDrop={()=>onDrop(stage)}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <span style={{fontSize:12,fontWeight:700,color}}>{stage}</span>
                  <span style={S.bdg(color)}>{cards.length}</span>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:10,minHeight:60,background:isOver?color+"11":"transparent",borderRadius:10,padding:isOver?"4px":"0",transition:"all .15s"}}>
                  {cards.map(p=>{
                    const pc=pct(p,p._tab); const temp=calcTemp(p,p._tab,tareas);
                    const nt=tareas.find(t=>t.prospectId===p.id&&t.estado==="pendiente");
                    const isDragging=dragId===p.id;
                    return (
                      <div key={p.id}
                        draggable
                        onDragStart={()=>onDragStart(p)}
                        onDragEnd={()=>{setDragId(null);setDragTab(null);setOverCol(null);}}
                        style={{background:"#0d0d1a",border:`1px solid ${color}33`,borderRadius:10,padding:14,cursor:"grab",transition:"all .2s",opacity:isDragging?.4:1,transform:isDragging?"scale(1.02)":"none",boxShadow:isDragging?`0 8px 24px ${color}33`:"none"}}
                        onClick={()=>!isDragging&&setModal({type:"prospect",tab:p._tab,person:p})}
                        onMouseEnter={e=>e.currentTarget.style.borderColor=color}
                        onMouseLeave={e=>e.currentTarget.style.borderColor=color+"33"}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                          <div style={{fontWeight:700,color:"#fff",fontSize:13}}>{p.nombre}</div>
                          <span title={temp.l}>{temp.e}</span>
                        </div>
                        <div style={{marginBottom:8}}><span style={S.bdg(TM[p._tab].color)}>{TM[p._tab].icon} {TM[p._tab].label}</span></div>
                        <PBar p={pc} color={color}/>
                        <div style={{display:"flex",justifyContent:"space-between",marginTop:5}}>
                          <span style={{fontSize:10,color:"#374151"}}>{pc}%</span>
                          {p.owner_name&&<span style={{fontSize:10,color:"#6b7280"}}>👤 {p.owner_name}</span>}
                        </div>
                        {nt&&<div style={{fontSize:10,color:"#f59e0b",marginTop:6}}>→ {nt.titulo}</div>}
                        <div style={{fontSize:9,color:"#374151",marginTop:4,textAlign:"center"}}>⠿ arrastra para mover</div>
                      </div>
                    );
                  })}
                  {cards.length===0&&<div style={{fontSize:11,color:isOver?color:"#1a1a2e",textAlign:"center",padding:"18px 0",border:`2px dashed ${isOver?color:"#1a1a2e"}`,borderRadius:8,transition:"all .15s"}}>{isOver?"Soltar aquí ✓":"—"}</div>}
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
    const color=TM[tab].color; const stages=STAGES[tab];
    const [bq,setBq]=useState(""); const [ef,setEf]=useState("all");
    const list=displayPros[tab].filter(p=>{
      const mb=!bq||Object.values(p).join(" ").toLowerCase().includes(bq.toLowerCase());
      const me=ef==="all"||(ef==="cerrado"&&isClosed(p,tab))||(ef==="activo"&&!isClosed(p,tab)&&!p.perdido)||(ef==="perdido"&&p.perdido);
      return mb&&me;
    });
    return (
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={{display:"flex",gap:10}}>
          <input style={{...S.inp,flex:1}} placeholder="🔍 Buscar..." value={bq} onChange={e=>setBq(e.target.value)}/>
          <select style={{...S.inp,width:"auto"}} value={ef} onChange={e=>setEf(e.target.value)}>
            <option value="all">Todos</option><option value="activo">Activos</option><option value="cerrado">Cerrados</option><option value="perdido">Perdidos</option>
          </select>
        </div>
        <div style={S.card}>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>
                <th style={S.th}>Nombre</th><th style={S.th}>Contacto</th><th style={S.th}>Propietario</th>
                {tab==="referidos"&&<th style={S.th}>Referente</th>}
                {tab==="referidores"&&<th style={S.th}>Comisión</th>}
                {tab==="facebook"&&<th style={S.th}>Facebook</th>}
                {stages.map(st=><th key={st} style={{...S.th,textAlign:"center",padding:"9px 6px",fontSize:9,maxWidth:56}}>{st.replace("Realizada","Real.").replace("Testimonio","Test.").replace("Avatar","Avt.").replace("Sesión","Ses.")}</th>)}
                {isAdmin&&<th style={S.th}>Propietario</th>}
                <th style={S.th}>Tmp</th><th style={S.th}></th>
              </tr></thead>
              <tbody>
                {list.length===0&&<tr><td colSpan={20} style={{...S.td,textAlign:"center",color:"#374151",padding:36}}>{pros[tab].length===0?"¡Agrega tu primer registro! 🚀":"Sin resultados"}</td></tr>}
                {list.map(p=>{
                  const cl=isClosed(p,tab); const temp=calcTemp(p,tab,tareas);
                  return (<tr key={p.id} style={{background:cl?"rgba(16,185,129,.04)":p.perdido?"rgba(239,68,68,.04)":"transparent"}} onMouseEnter={e=>e.currentTarget.style.background="#0e0e1c"} onMouseLeave={e=>e.currentTarget.style.background=cl?"rgba(16,185,129,.04)":p.perdido?"rgba(239,68,68,.04)":"transparent"}>
                    <td style={S.td}><div style={{fontWeight:600,color:"#fff",cursor:"pointer"}} onClick={()=>setModal({type:"prospect",tab,person:p})}>{p.nombre||"—"}</div><div style={{fontSize:10,color:"#374151"}}>{fd(p.creadoEn)}</div></td>
                    <td style={{...S.td,whiteSpace:"nowrap"}}><div style={{fontSize:12,color:"#9ca3af"}}>{p.telefono||"—"}</div><div style={{fontSize:10,color:"#374151"}}>{p.correo}</div></td>
                    <td style={{...S.td,whiteSpace:"nowrap"}}><div style={{fontSize:12,color:"#9ca3af"}}>👤 {p.owner_name||"—"}</div></td>
                    {tab==="referidos"&&<td style={{...S.td,fontSize:12,color:"#10b981"}}>{p.quienRefiere||"—"}</td>}
                    {tab==="referidores"&&<td style={{...S.td,fontSize:12,color:"#10b981"}}>{p.comision||"—"}</td>}
                    {tab==="facebook"&&<td style={{...S.td,fontSize:12,color:"#818cf8"}}>{p.facebook||"—"}</td>}
                    {stages.map(st=>(<td key={st} style={{...S.td,textAlign:"center",padding:"10px 6px"}}><div style={{display:"flex",justifyContent:"center"}}><Chk on={!!p.stages?.[st]} color={color} onChange={()=>toggleStage(tab,p.id,st)}/></div></td>))}
                    <td style={S.td}><span title={temp.l} style={{fontSize:16}}>{temp.e}</span></td>
                    <td style={{...S.td,whiteSpace:"nowrap"}}><div style={{display:"flex",gap:6}}>
                      <button style={{...S.btn("secondary"),padding:"4px 9px",fontSize:11}} onClick={()=>setModal({type:"prospect",tab,person:p})}>✏️</button>
                      <button style={{...S.btn("danger"),padding:"4px 9px",fontSize:11}} onClick={()=>delP(tab,p.id)}>✕</button>
                    </div></td>
                  </tr>);
                })}
              </tbody>
            </table>
          </div>
          <div style={{padding:"10px 18px",borderTop:"1px solid #14142a",display:"flex",justifyContent:"space-between"}}>
            <span style={{fontSize:11,color:"#374151"}}>{list.length} registros</span>
            <span style={{fontSize:11,color:TM[tab].color,fontWeight:700}}>{pros[tab].filter(p=>isClosed(p,tab)).length} cerrados / {pros[tab].length} total</span>
          </div>
        </div>
      </div>
    );
  };

  // ── TAREAS ────────────────────────────────────────────────────────────────
  const Tareas = () => {
    const [f,setF]=useState("pendiente");
    const list=displayTareas.filter(t=>f==="all"||(f==="pendiente"&&t.estado==="pendiente")||(f==="completada"&&t.estado==="completada")).sort((a,b)=>a.fecha.localeCompare(b.fecha));
    return (
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={{display:"flex",gap:8}}>
          {["pendiente","completada","all"].map(x=>(
            <button key={x} style={{...S.btn(f===x?"primary":"secondary"),padding:"6px 14px"}} onClick={()=>setF(x)}>
              {x==="pendiente"?"⏳ Pendientes":x==="completada"?"✅ Completadas":"📋 Todas"}
              {x==="pendiente"&&displayTareas.filter(t=>t.estado==="pendiente").length>0&&<span style={{marginLeft:6,background:"rgba(255,255,255,.2)",borderRadius:10,padding:"0 6px",fontSize:10}}>{displayTareas.filter(t=>t.estado==="pendiente").length}</span>}
            </button>
          ))}
        </div>
        <div style={S.card}>
          {list.length===0&&<div style={{textAlign:"center",color:"#374151",padding:40,fontSize:13}}>Sin tareas aquí.</div>}
          {list.map(t=>{
            const prospect=allP.find(p=>p.id===t.prospectId);
            const overdue=t.fecha<today()&&t.estado==="pendiente";
            const tt=TASK_TYPES.find(x=>x.id===t.tipoTarea)||TASK_TYPES[0];
            return (
              <div key={t.id} style={{display:"flex",alignItems:"flex-start",gap:14,padding:"13px 18px",borderBottom:"1px solid #14142a",background:t.estado==="completada"?"rgba(16,185,129,.03)":"transparent"}}>
                <div style={{paddingTop:2}}><Chk on={t.estado==="completada"} color="#10b981" onChange={()=>toggleTarea(t.id)}/></div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:13,color:t.estado==="completada"?"#4b5563":"#fff",textDecoration:t.estado==="completada"?"line-through":"none"}}>{tt.icon} {t.titulo}</div>
                  <div style={{display:"flex",gap:8,marginTop:4,flexWrap:"wrap",alignItems:"center"}}>
                    {prospect&&<span style={S.bdg(TM[prospect._tab].color)}>{TM[prospect._tab].icon} {prospect.nombre}</span>}
                    <span style={S.bdg(PRIO_C[t.prioridad]||"#374151")}>{t.prioridad}</span>
                    {isAdmin&&<span style={S.bdg("#9ca3af")}>👤 {t.ownerName||"—"}</span>}
                    <span style={{fontSize:10,color:overdue?"#ef4444":"#6b7280"}}>{fd(t.fecha)}{t.hora?" · "+t.hora:""}{overdue?" ⚠️":""}</span>
                  </div>
                  {t.notas&&<div style={{fontSize:11,color:"#4b5563",marginTop:4}}>{t.notas}</div>}
                </div>
                <div style={{display:"flex",gap:6}}>
                  <button style={{...S.btn("secondary"),padding:"4px 9px",fontSize:11}} onClick={()=>setModal({type:"tarea",tarea:t})}>✏️</button>
                  <button style={{...S.btn("danger"),padding:"4px 9px",fontSize:11}} onClick={()=>delTarea(t.id)}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── AGENDA (Calendario tipo Google) ──────────────────────────────────────
  const Agenda = () => {
    const [calView,    setCalView]    = useState("week");
    const [curDate,    setCurDate]    = useState(new Date());
    const [filterType, setFilterType] = useState("all");
    const [filterPrio, setFilterPrio] = useState("all");

    const navigate = (dir) => {
      const d=new Date(curDate);
      if (calView==="day")   d.setDate(d.getDate()+dir);
      if (calView==="week")  d.setDate(d.getDate()+dir*7);
      if (calView==="month") d.setMonth(d.getMonth()+dir);
      setCurDate(d);
    };

    const getDays = () => {
      if (calView==="day") return [curDate.toISOString().split("T")[0]];
      if (calView==="week") {
        const days=[]; const s=new Date(curDate);
        s.setDate(s.getDate()-s.getDay()+1);
        for (let i=0;i<7;i++) { const d=new Date(s); d.setDate(d.getDate()+i); days.push(d.toISOString().split("T")[0]); }
        return days;
      }
      if (calView==="month") {
        const year=curDate.getFullYear(); const month=curDate.getMonth();
        const first=new Date(year,month,1); const last=new Date(year,month+1,0);
        const days=[];
        const startDay=first.getDay()||7;
        for (let i=1;i<startDay;i++) { const d=new Date(first); d.setDate(d.getDate()-(startDay-i)); days.push({date:d.toISOString().split("T")[0],otherMonth:true}); }
        for (let i=1;i<=last.getDate();i++) days.push({date:new Date(year,month,i).toISOString().split("T")[0],otherMonth:false});
        while (days.length<42) { const last2=new Date(days[days.length-1].date+"T12:00:00"); last2.setDate(last2.getDate()+1); days.push({date:last2.toISOString().split("T")[0],otherMonth:true}); }
        return days;
      }
      return [];
    };

    const getTasksForDay = (dateStr) => {
      return displayTareas.filter(t=>{
        if (t.fecha!==dateStr) return false;
        if (filterType!=="all"&&t.tipoTarea!==filterType) return false;
        if (filterPrio!=="all"&&t.prioridad!==filterPrio) return false;
        return true;
      });
    };

    const headerLabel = () => {
      const opts={month:"long",year:"numeric"};
      if (calView==="day") return curDate.toLocaleDateString("es-MX",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
      if (calView==="week") { const days=getDays(); const f=new Date(days[0]+"T12:00:00"); const l=new Date(days[6]+"T12:00:00"); return `${f.toLocaleDateString("es-MX",{day:"numeric",month:"short"})} — ${l.toLocaleDateString("es-MX",{day:"numeric",month:"short",year:"numeric"})}`; }
      return curDate.toLocaleDateString("es-MX",opts);
    };

    const days=getDays();
    const todayStr=today();
    const WEEKDAYS=["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];

    return (
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        {/* Controls */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <button style={{...S.btn("secondary"),padding:"6px 12px"}} onClick={()=>navigate(-1)}>‹</button>
            <div style={{fontSize:15,fontWeight:800,color:"#fff",minWidth:240}}>{headerLabel()}</div>
            <button style={{...S.btn("secondary"),padding:"6px 12px"}} onClick={()=>navigate(1)}>›</button>
            <button style={{...S.btn("secondary"),padding:"6px 12px",fontSize:11}} onClick={()=>setCurDate(new Date())}>Hoy</button>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {["day","week","month"].map(v=>(
              <button key={v} style={{...S.btn(calView===v?"primary":"secondary"),padding:"6px 14px"}} onClick={()=>setCalView(v)}>
                {v==="day"?"Día":v==="week"?"Semana":"Mes"}
              </button>
            ))}
            <select style={{...S.inp,width:"auto",padding:"6px 10px"}} value={filterType} onChange={e=>setFilterType(e.target.value)}>
              <option value="all">Todos los tipos</option>
              {TASK_TYPES.map(t=><option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
            </select>
            <select style={{...S.inp,width:"auto",padding:"6px 10px"}} value={filterPrio} onChange={e=>setFilterPrio(e.target.value)}>
              <option value="all">Todas las prioridades</option>
              <option value="Alta">🔴 Alta</option>
              <option value="Media">🟡 Media</option>
              <option value="Baja">🟢 Baja</option>
            </select>
            <button style={{...S.btn("primary"),padding:"6px 14px"}} onClick={()=>setModal({type:"tarea"})}>+ Nueva tarea</button>
          </div>
        </div>

        {/* Month view header */}
        {calView==="month"&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
            {WEEKDAYS.map(d=><div key={d} style={{textAlign:"center",fontSize:10,fontWeight:700,color:"#374151",padding:"8px 0",textTransform:"uppercase",letterSpacing:1}}>{d}</div>)}
          </div>
        )}
        {/* Week view header */}
        {calView==="week"&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4}}>
            {WEEKDAYS.map(d=><div key={d} style={{textAlign:"center",fontSize:10,fontWeight:700,color:"#374151",padding:"6px 0",textTransform:"uppercase"}}>{d}</div>)}
          </div>
        )}

        {/* Grid */}
        <div style={{
          display:"grid",
          gridTemplateColumns: calView==="month"?"repeat(7,1fr)":calView==="week"?"repeat(7,1fr)":"1fr",
          gap: calView==="month"?2:10,
        }}>
          {(calView==="month"?days:days.map(d=>({date:d,otherMonth:false}))).map((item,idx)=>{
            const dateStr=typeof item==="string"?item:item.date;
            const isOther=typeof item==="object"&&item.otherMonth;
            const dt=getTasksForDay(dateStr);
            const isT=dateStr===todayStr;
            const dn=new Date(dateStr+"T12:00:00");
            const dayNum=dn.getDate();

            return (
              <div key={dateStr+idx} style={{
                background:isOther?"#070710":isT?"rgba(99,102,241,.1)":"#0d0d1a",
                border:`1px solid ${isT?"#6366f1":"#14142a"}`,
                borderRadius:calView==="month"?8:12,
                padding:calView==="month"?"8px":"12px",
                minHeight:calView==="month"?90:calView==="day"?400:160,
                opacity:isOther?.4:1,
              }}>
                <div style={{textAlign:"center",marginBottom:calView==="month"?6:10}}>
                  <div style={{fontSize:calView==="month"?18:22,fontWeight:900,color:isT?"#6366f1":isOther?"#374151":"#fff",lineHeight:1.2}}>{dayNum}</div>
                  {calView==="day"&&<div style={{fontSize:10,color:"#6b7280",marginTop:2}}>{dn.toLocaleDateString("es-MX",{weekday:"long"})}</div>}
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:calView==="month"?3:6}}>
                  {dt.map(t=>{
                    const tt=TASK_TYPES.find(x=>x.id===t.tipoTarea)||TASK_TYPES[0];
                    const prospect=allP.find(p=>p.id===t.prospectId);
                    return (
                      <div key={t.id} style={{background:PRIO_C[t.prioridad]+"18",border:`1px solid ${PRIO_C[t.prioridad]||"#374151"}33`,borderRadius:6,padding:calView==="month"?"4px 6px":"8px 10px",cursor:"pointer",opacity:t.estado==="completada"?.5:1}} onClick={()=>setModal({type:"tarea",tarea:t})}>
                        <div style={{fontSize:calView==="month"?10:12,fontWeight:600,color:"#fff"}}>{tt.icon} {t.titulo}</div>
                        {calView!=="month"&&<>
                          {t.hora&&<div style={{fontSize:10,color:PRIO_C[t.prioridad]||"#9ca3af"}}>🕐 {t.hora}</div>}
                          {prospect&&<div style={{fontSize:10,color:"#6b7280"}}>{prospect.nombre}</div>}
                          {isAdmin&&<div style={{fontSize:9,color:"#4b5563"}}>👤 {t.ownerName||"—"}</div>}
                          {t.estado==="completada"&&<div style={{fontSize:9,color:"#10b981"}}>✓ Completada</div>}
                        </>}
                      </div>
                    );
                  })}
                  {dt.length===0&&calView!=="month"&&<div style={{fontSize:10,color:"#1a1a2e",textAlign:"center",paddingTop:6}}>—</div>}
                  {calView==="month"&&dt.length===0&&<div style={{fontSize:9,color:"#1a1a2e",textAlign:"center"}}>·</div>}
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
    const [limit,setLimit]=useState(20);
    const wAgo=new Date(Date.now()-7*864e5).toISOString().split("T")[0];
    const mS=today().slice(0,7)+"-01";
    const byType=Object.fromEntries(ACT_TYPES.map(a=>[a.id,{s:0,m:0,t:0}]));
    displayActs.forEach(a=>{ if (!byType[a.tipo]) return; const q=Number(a.cantidad)||1; byType[a.tipo].t+=q; if (a.fecha>=wAgo) byType[a.tipo].s+=q; if (a.fecha>=mS) byType[a.tipo].m+=q; });
    const totS=Object.values(byType).reduce((a,x)=>a+x.s,0);
    const totM=Object.values(byType).reduce((a,x)=>a+x.m,0);
    const mx=Math.max(...Object.values(byType).map(x=>x.s),1);
    return (
      <div style={{display:"flex",flexDirection:"column",gap:18}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
          {[{l:"Esta semana",v:totS,c:"#6366f1"},{l:"Este mes",v:totM,c:"#10b981"},{l:"Total histórico",v:stats.actTot,c:"#f59e0b"}].map(k=>(
            <div key={k.l} style={{...S.card,padding:20,borderTop:`3px solid ${k.c}`}}>
              <div style={{fontSize:36,fontWeight:900,color:k.c,lineHeight:1}}>{k.v}</div>
              <div style={{fontSize:12,color:"#9ca3af",marginTop:6}}>{k.l} · actividades</div>
            </div>
          ))}
        </div>
        <div style={S.card}>
          <div style={S.ch}><span style={S.ct}>Desglose por tipo</span></div>
          <div style={{padding:18,display:"flex",flexDirection:"column",gap:12}}>
            {ACT_TYPES.map(a=>(<div key={a.id}><div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{fontSize:13,color:"#9ca3af"}}>{a.icon} {a.label}</span><div style={S.row}><span style={{fontSize:11,color:"#6366f1",fontWeight:700}}>{byType[a.id].s} sem.</span><span style={{fontSize:11,color:"#374151"}}>{byType[a.id].m} mes</span></div></div><PBar p={Math.round(byType[a.id].s/mx*100)} color="#6366f1"/></div>))}
          </div>
        </div>
        <div style={S.card}>
          <div style={S.ch}><span style={S.ct}>Historial</span><button style={S.btn("primary")} onClick={()=>setModal({type:"actividad"})}>+ Registrar</button></div>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr><th style={S.th}>Tipo</th><th style={S.th}>Cant.</th><th style={S.th}>Fecha</th>{isAdmin&&<th style={S.th}>Propietario</th>}<th style={S.th}>Notas</th></tr></thead>
            <tbody>
              {displayActs.slice(0,limit).map(a=>{ const at=ACT_TYPES.find(x=>x.id===a.tipo)||{icon:"⚡",label:a.tipo}; return (<tr key={a.id}><td style={S.td}><span style={S.bdg("#6366f1")}>{at.icon} {at.label}</span></td><td style={{...S.td,fontWeight:700,color:"#fff"}}>{a.cantidad||1}</td><td style={{...S.td,fontSize:12,color:"#6b7280"}}>{fd(a.fecha)}</td>{isAdmin&&<td style={{...S.td,fontSize:12,color:"#93c5fd"}}>{a.ownerName||"—"}</td>}<td style={{...S.td,fontSize:12,color:"#4b5563"}}>{a.notas||"—"}</td></tr>); })}
              {displayActs.length===0&&<tr><td colSpan={isAdmin?5:4} style={{...S.td,textAlign:"center",color:"#374151",padding:28}}>Sin actividades</td></tr>}
            </tbody>
          </table>
          {displayActs.length>limit&&<div style={{padding:16,textAlign:"center",borderTop:"1px solid #14142a"}}><button style={S.btn("secondary")} onClick={()=>setLimit(l=>l+20)}>Ver más ({displayActs.length-limit} restantes)</button></div>}
        </div>
      </div>
    );
  };

  // ── MODO VENDEDOR ─────────────────────────────────────────────────────────
  const ModoVendedor = () => {
    const hoy=displayTareas.filter(t=>t.estado==="pendiente"&&t.fecha<=today()).sort((a,b)=>["Alta","Media","Baja"].indexOf(a.prioridad)-["Alta","Media","Baja"].indexOf(b.prioridad));
    return (
      <div style={{maxWidth:460,margin:"0 auto",display:"flex",flexDirection:"column",gap:14}}>
        <div style={{background:"linear-gradient(135deg,#1e1b4b,#312e81)",borderRadius:14,padding:22,textAlign:"center"}}>
          <div style={{fontSize:32,marginBottom:6}}>🚀</div>
          <div style={{fontSize:20,fontWeight:900,color:"#fff"}}>Modo Vendedor</div>
          <div style={{fontSize:12,color:"rgba(255,255,255,.6)",marginTop:4}}>{hoy.length} tareas para hoy · {new Date().toLocaleDateString("es-MX",{weekday:"long",day:"numeric",month:"long"})}</div>
        </div>
        {hoy.length===0&&(<div style={{...S.card,padding:36,textAlign:"center"}}><div style={{fontSize:42,marginBottom:10}}>🎉</div><div style={{fontSize:16,fontWeight:700,color:"#fff"}}>¡Todo al día!</div><div style={{fontSize:12,color:"#6b7280",marginTop:4}}>No hay tareas pendientes para hoy.</div></div>)}
        {hoy.map(t=>{
          const prospect=allP.find(p=>p.id===t.prospectId);
          const tt=TASK_TYPES.find(x=>x.id===t.tipoTarea)||TASK_TYPES[0];
          return (
            <div key={t.id} style={{...S.card,padding:18,borderLeft:`4px solid ${PRIO_C[t.prioridad]||"#6366f1"}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                <div><div style={{fontWeight:700,color:"#fff",fontSize:15}}>{tt.icon} {t.titulo}</div><span style={S.bdg(PRIO_C[t.prioridad]||"#6366f1")}>{t.prioridad}</span>{t.hora&&<span style={{fontSize:11,color:"#6b7280",marginLeft:8}}>🕐 {t.hora}</span>}</div>
                {isAdmin&&<span style={S.bdg("#9ca3af")}>👤 {t.ownerName||"—"}</span>}
                <Chk on={false} color="#10b981" onChange={()=>toggleTarea(t.id)}/>
              </div>
              {prospect&&(<div style={{background:"#07070f",borderRadius:10,padding:14,marginBottom:12}}>
                <div style={{fontWeight:700,color:"#fff",marginBottom:4}}>{prospect.nombre}</div>
                <div style={{fontSize:12,color:"#6b7280",marginBottom:10}}>{prospect.telefono||prospect.correo||"Sin datos de contacto"}</div>
                {prospect.telefono&&(<a href={`https://wa.me/${prospect.telefono.replace(/\D/g,"")}`} target="_blank" rel="noreferrer" style={{display:"inline-flex",alignItems:"center",gap:6,background:"#128c7e",color:"#fff",padding:"8px 16px",borderRadius:8,textDecoration:"none",fontSize:12,fontWeight:700}}>💬 Abrir en WhatsApp</a>)}
              </div>)}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                {[["📞 Llamé","llamada"],["📅 Agendé","reunion"],["❌ No contestó","seguimiento"]].map(([label,tipo])=>(
                  <button key={label} style={{...S.btn("secondary"),padding:"9px 0",fontSize:11,textAlign:"center"}} onClick={()=>{ addAct({tipo,cantidad:1,notas:`${label} — ${prospect?.nombre||""}`,fecha:today()}); toggleTarea(t.id); }}>{label}</button>
                ))}
              </div>
            </div>
          );
        })}
        <button style={{...S.btn("primary"),padding:14,textAlign:"center",display:"block",width:"100%"}} onClick={()=>setModal({type:"actividad"})}>⚡ Registrar otra actividad</button>
      </div>
    );
  };

  // ── REPORTE ───────────────────────────────────────────────────────────────
  const Reporte = () => {
    const copyR = () => {
      const t=`REPORTE COMERCIAL — ${cfg.agencia||"NATIVE MASTER BROKER"}\n${fd(cfg.periodoInicio)} — ${fd(cfg.periodoFin)}${cfg.socios?"\nPara: "+cfg.socios:""}\n\nMETA: ${stats.closed}/${cfg.metaClientes} clientes (${Math.round(Math.min(stats.closed/cfg.metaClientes*100,100))}%)\nINGRESOS: ${fm(stats.mrr,cfg.moneda)} | Ticket prom: ${fm(stats.ticket,cfg.moneda)}\nROI: ${stats.roi!==null?stats.roi+"%":"Sin inversión"} | Conversión: ${stats.convRate}%\n\nEMBUDO:\nProspectos: ${stats.total} → Contactados: ${stats.contacted} → Propuestas: ${stats.propSent} → Cerrados: ${stats.closed}\n\nPRODUCTIVIDAD:\n`+ACT_TYPES.map(a=>`${a.label}: ${acts.filter(x=>x.tipo===a.id).reduce((s,x)=>s+(Number(x.cantidad)||1),0)}`).join(" | ");
      navigator.clipboard?.writeText(t).then(()=>toast_("📋 Copiado")).catch(()=>toast_("Error al copiar",false));
    };
    return (
      <div style={{display:"flex",flexDirection:"column",gap:18}}>
        <div style={{...S.card,padding:28}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24,flexWrap:"wrap",gap:12}}>
            <div>
              <div style={{fontSize:10,color:"#6366f1",fontWeight:700,letterSpacing:3,marginBottom:6}}>{(cfg.agencia||"NATIVE MASTER BROKER").toUpperCase()}</div>
              <div style={{fontSize:22,fontWeight:900,color:"#fff",letterSpacing:-1}}>Reporte Comercial</div>
              <div style={{fontSize:12,color:"#4b5563"}}>{fd(cfg.periodoInicio)} — {fd(cfg.periodoFin)}</div>
              {cfg.socios&&<div style={{fontSize:12,color:"#6b7280",marginTop:2}}>Para: {cfg.socios}</div>}
            </div>
            <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
              <button style={S.btn("secondary")} onClick={copyR}>📋 Copiar</button>
              <div style={{textAlign:"right"}}><div style={{fontSize:10,color:"#6b7280"}}>CLIENTES</div><div style={{fontSize:40,fontWeight:900,color:"#6366f1",lineHeight:1}}>{stats.closed}/{cfg.metaClientes}</div></div>
            </div>
          </div>
          <div style={{background:"#07070f",borderRadius:10,padding:18,marginBottom:22}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontSize:12,fontWeight:700,color:"#fff"}}>Avance hacia meta</span><span style={{fontSize:12,color:"#6366f1",fontWeight:700}}>{Math.round(Math.min(stats.closed/cfg.metaClientes*100,100))}%</span></div>
            <PBar p={Math.min(stats.closed/Number(cfg.metaClientes||10)*100,100)} color="#6366f1" h={12}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:22}}>
            {[{l:"Ingresos generados",v:fm(stats.mrr,cfg.moneda),c:"#10b981"},{l:"Ticket promedio",v:fm(stats.ticket,cfg.moneda),c:"#3b82f6"},{l:"ROI publicidad",v:stats.roi!==null?`${stats.roi}%`:"Orgánico",c:"#f59e0b"},{l:"Total ventas",v:stats.allVentas.length,c:"#6366f1"}].map(k=>(
              <div key={k.l} style={{background:"#07070f",borderRadius:10,padding:16,borderTop:`2px solid ${k.c}`}}><div style={{fontSize:11,color:"#374151",marginBottom:4}}>{k.l}</div><div style={{fontSize:18,fontWeight:900,color:k.c}}>{k.v}</div></div>
            ))}
          </div>
          {stats.allVentas.length>0&&(
            <div style={{marginBottom:22}}>
              <div style={{fontSize:10,color:"#374151",fontWeight:700,letterSpacing:2,marginBottom:12}}>VENTAS CERRADAS</div>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr><th style={S.th}>Cliente</th><th style={S.th}>Canal</th><th style={S.th}>Desarrollo</th><th style={S.th}>Monto</th><th style={S.th}>Tipo</th><th style={S.th}>Enganche Dif.</th></tr></thead>
                <tbody>
                  {stats.allVentas.map((v,i)=>(<tr key={i}><td style={S.td}><span style={{fontWeight:600,color:"#fff"}}>{v._p?.nombre||"—"}</span></td><td style={S.td}><span style={S.bdg(TM[v._p?._tab]?.color||"#6366f1")}>{TM[v._p?._tab]?.icon}</span></td><td style={{...S.td,fontSize:11,color:"#9ca3af"}}>{v.desarrollo||"—"}</td><td style={{...S.td,fontWeight:700,color:"#10b981"}}>{fm(v.monto,cfg.moneda)}</td><td style={{...S.td,fontSize:11,color:"#6b7280"}}>{v.tipo||"—"}</td><td style={S.td}>{v.engancheDiferido?<span style={S.bdg("#f59e0b")}>Sí</span>:<span style={S.bdg("#374151")}>No</span>}</td></tr>))}
                </tbody>
              </table>
            </div>
          )}
          <div>
            <div style={{fontSize:10,color:"#374151",fontWeight:700,letterSpacing:2,marginBottom:12}}>PRODUCTIVIDAD COMERCIAL</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
              {ACT_TYPES.map(a=>{ const cnt=acts.filter(x=>x.tipo===a.id).reduce((s,x)=>s+(Number(x.cantidad)||1),0); return (<div key={a.id} style={{display:"flex",gap:10,alignItems:"center",background:"#07070f",borderRadius:8,padding:"10px 14px"}}><span style={{fontSize:20}}>{a.icon}</span><div><div style={{fontWeight:700,color:"#fff",fontSize:18}}>{cnt}</div><div style={{fontSize:10,color:"#374151"}}>{a.label}</div></div></div>); })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── CONFIG ────────────────────────────────────────────────────────────────
  const Config = () => {
    const [lc, setLc] = useState({...cfg});
    const [tab_, setTab_] = useState("general");

    const CFG_TABS = [
      {id:"general",    icon:"🏢", label:"General"},
      {id:"alertas",    icon:"🔔", label:"Alertas y umbrales"},
      {id:"campos",     icon:"📋", label:"Campos obligatorios"},
      {id:"permisos",   icon:"🔐", label:"Permisos del equipo"},
      {id:"horario",    icon:"🕐", label:"Horario laboral"},
      {id:"mensajes",   icon:"✉️",  label:"Mensajes"},
    ];

    const fieldsByTab = {
      avatar:      ["nombre","correo","telefono","presupuesto","propositoInversion","desarrolloInteres","conocePor"],
      circulo:     ["nombre","correo","telefono","presupuesto","propositoInversion","desarrolloInteres","conocePor"],
      referidores: ["nombre","correo","telefono","propositoInversion","conocePor","comision"],
      referidos:   ["nombre","correo","telefono","presupuesto","propositoInversion","conocePor"],
      facebook:    ["nombre","correo","telefono","presupuesto","propositoInversion","conocePor"],
    };
    const fieldLabels = {nombre:"Nombre",correo:"Correo",telefono:"Teléfono",presupuesto:"Presupuesto",propositoInversion:"Propósito de inversión",desarrolloInteres:"Desarrollo de interés",conocePor:"¿De dónde lo conozco?",comision:"% Comisión"};
    const listLabels  = {avatar:"Entrevistados Avatar",circulo:"Círculo de Poder",referidores:"Referidores",referidos:"Referidos",facebook:"Facebook"};
    const DIAS_SEMANA = [{v:1,l:"Lun"},{v:2,l:"Mar"},{v:3,l:"Mié"},{v:4,l:"Jue"},{v:5,l:"Vie"},{v:6,l:"Sáb"},{v:0,l:"Dom"}];

    const toggleDia = (v) => {
      const arr = lc.diasLaborales||[1,2,3,4,5];
      setLc(x=>({...x, diasLaborales: arr.includes(v)?arr.filter(d=>d!==v):[...arr,v]}));
    };
    const toggleCampo = (lista, campo) => {
      const curr = (lc.camposObligatorios||{})[lista]||[];
      const next  = curr.includes(campo) ? curr.filter(c=>c!==campo) : [...curr,campo];
      setLc(x=>({...x, camposObligatorios:{...(x.camposObligatorios||{}), [lista]:next}}));
    };

    return (
      <div style={{display:"flex",flexDirection:"column",gap:18,maxWidth:800}}>
        {/* Title */}
        <div style={{background:"linear-gradient(135deg,#0f0f2a,#1a1a3e)",border:"1px solid #6366f133",borderRadius:14,padding:20}}>
          <div style={{fontSize:11,color:"#6366f1",fontWeight:700,letterSpacing:2,textTransform:"uppercase",marginBottom:6}}>PANEL DE ADMINISTRADOR</div>
          <div style={{fontSize:20,fontWeight:900,color:"#fff",marginBottom:4}}>⚙️ Configuración del CRM</div>
          <div style={{fontSize:12,color:"#4a5468"}}>Ajustes globales que aplican a todo el equipo. Solo visible para administradores.</div>
        </div>

        {/* Tab nav */}
        <div style={{display:"flex",gap:4,flexWrap:"wrap",borderBottom:"1px solid #14142a",paddingBottom:0}}>
          {CFG_TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab_(t.id)} style={{padding:"9px 16px",borderRadius:"8px 8px 0 0",border:"none",cursor:"pointer",fontSize:12,fontWeight:700,background:tab_===t.id?"#0d0d1a":"transparent",color:tab_===t.id?"#818cf8":"#4a5468",borderBottom:tab_===t.id?"2px solid #6366f1":"2px solid transparent",transition:"all .15s"}}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ── GENERAL ── */}
        {tab_==="general"&&(
          <div style={S.card}>
            <div style={S.ch}><span style={S.ct}>🏢 Datos de la agencia</span></div>
            <div style={{padding:20,display:"flex",flexDirection:"column",gap:14}}>
              <div style={S.g2}>
                <div><label style={S.lbl}>Nombre de la agencia</label><input style={S.inp} value={lc.agencia||""} onChange={e=>setLc(x=>({...x,agencia:e.target.value}))}/></div>
                <div><label style={S.lbl}>Moneda</label><select style={S.inp} value={lc.moneda||"MXN"} onChange={e=>setLc(x=>({...x,moneda:e.target.value}))}><option>MXN</option><option>USD</option><option>EUR</option><option>COP</option><option>ARS</option></select></div>
              </div>
              <div><label style={S.lbl}>Socios (separados por coma)</label><input style={S.inp} value={lc.socios||""} onChange={e=>setLc(x=>({...x,socios:e.target.value}))} placeholder="Carlos, María, Luis"/></div>
              <div style={S.g2}>
                <div><label style={S.lbl}>Meta de clientes del mes</label><input type="number" style={S.inp} value={lc.metaClientes||10} onChange={e=>setLc(x=>({...x,metaClientes:e.target.value}))}/></div>
                <div><label style={S.lbl}>Meta de ingresos del mes</label><input type="number" style={S.inp} value={lc.metaIngresos||50000} onChange={e=>setLc(x=>({...x,metaIngresos:e.target.value}))}/></div>
              </div>
              <div><label style={S.lbl}>Inversión en publicidad (0 = orgánico)</label><input type="number" style={S.inp} value={lc.inversion||0} onChange={e=>setLc(x=>({...x,inversion:e.target.value}))}/></div>
              <div style={S.g2}>
                <div><label style={S.lbl}>Inicio del periodo</label><input type="date" style={S.inp} value={lc.periodoInicio||""} onChange={e=>setLc(x=>({...x,periodoInicio:e.target.value}))}/></div>
                <div><label style={S.lbl}>Fin del periodo</label><input type="date" style={S.inp} value={lc.periodoFin||""} onChange={e=>setLc(x=>({...x,periodoFin:e.target.value}))}/></div>
              </div>
            </div>
          </div>
        )}

        {/* ── ALERTAS Y UMBRALES ── */}
        {tab_==="alertas"&&(
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={S.card}>
              <div style={S.ch}><span style={S.ct}>🧊 Prospectos fríos</span></div>
              <div style={{padding:20,display:"flex",flexDirection:"column",gap:12}}>
                <div style={{fontSize:12,color:"#4a5468",padding:"10px 14px",background:"#07070f",borderRadius:8,border:"1px solid #1a1a2e"}}>
                  Un prospecto se considera <strong style={{color:"#5090f0"}}>"frío"</strong> cuando no tiene actividad registrada por N días. El sistema envía una alerta automática al asesor.
                </div>
                <div>
                  <label style={S.lbl}>Días de inactividad para considerarlo frío</label>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <input type="range" min={3} max={30} value={lc.prospectosFriosDias||7} onChange={e=>setLc(x=>({...x,prospectosFriosDias:Number(e.target.value)}))} style={{flex:1,accentColor:"#6366f1"}}/>
                    <span style={{fontSize:20,fontWeight:900,color:"#5090f0",minWidth:40,textAlign:"center"}}>{lc.prospectosFriosDias||7}</span>
                    <span style={{fontSize:12,color:"#4a5468"}}>días</span>
                  </div>
                </div>
              </div>
            </div>
            <div style={S.card}>
              <div style={S.ch}><span style={S.ct}>📄 Propuestas sin respuesta</span></div>
              <div style={{padding:20,display:"flex",flexDirection:"column",gap:12}}>
                <div style={{fontSize:12,color:"#4a5468",padding:"10px 14px",background:"#07070f",borderRadius:8,border:"1px solid #1a1a2e"}}>
                  Alerta cuando un prospecto tiene propuesta enviada pero no se registra avance en N días.
                </div>
                <div>
                  <label style={S.lbl}>Días sin respuesta para alertar</label>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <input type="range" min={1} max={14} value={lc.propuestaDias||5} onChange={e=>setLc(x=>({...x,propuestaDias:Number(e.target.value)}))} style={{flex:1,accentColor:"#6366f1"}}/>
                    <span style={{fontSize:20,fontWeight:900,color:"#f0c060",minWidth:40,textAlign:"center"}}>{lc.propuestaDias||5}</span>
                    <span style={{fontSize:12,color:"#4a5468"}}>días</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── CAMPOS OBLIGATORIOS ── */}
        {tab_==="campos"&&(
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{fontSize:12,color:"#4a5468",padding:"10px 14px",background:"#07070f",borderRadius:8,border:"1px solid #1a1a2e"}}>
              📋 Define qué campos <strong style={{color:"#fff"}}>deben llenarse obligatoriamente</strong> al crear o guardar un contacto en cada lista. Los campos marcados mostrarán error si están vacíos.
            </div>
            {Object.keys(fieldsByTab).map(lista=>(
              <div key={lista} style={S.card}>
                <div style={S.ch}>
                  <span style={S.ct}>{listLabels[lista]||lista}</span>
                  <span style={{fontSize:11,color:"#4a5468"}}>{((lc.camposObligatorios||{})[lista]||[]).length} campos obligatorios</span>
                </div>
                <div style={{padding:16,display:"flex",gap:8,flexWrap:"wrap"}}>
                  {fieldsByTab[lista].map(campo=>{
                    const on = ((lc.camposObligatorios||{})[lista]||[]).includes(campo);
                    return (
                      <button key={campo} onClick={()=>toggleCampo(lista,campo)} style={{padding:"7px 14px",borderRadius:20,border:`1px solid ${on?"#6366f1":"#1a1a2e"}`,background:on?"#6366f122":"transparent",color:on?"#818cf8":"#4a5468",fontSize:12,fontWeight:on?700:400,cursor:"pointer",transition:"all .15s"}}>
                        {on?"✓ ":""}{fieldLabels[campo]||campo}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── PERMISOS ── */}
        {tab_==="permisos"&&(
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {[
              {key:"rankingVisible",       tipo:"select",  lbl:"Visibilidad del ranking",         desc:"¿Quién puede ver el ranking completo con nombres?",     options:[{v:"todos",l:"Todos los asesores"},{v:"solo_propio",l:"Solo el admin (asesores ven solo su posición)"}]},
              {key:"asesoresPuedenEliminar",tipo:"toggle", lbl:"Asesores pueden eliminar contactos",desc:"Si está OFF, solo el admin puede eliminar prospectos."},
              {key:"maxProspectosAsesor",   tipo:"number", lbl:"Límite de prospectos por asesor",  desc:"Máx. contactos que puede tener asignados un asesor. 0 = sin límite."},
            ].map(({key,tipo,lbl,desc,options})=>(
              <div key={key} style={S.card}>
                <div style={{padding:18}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
                    <div>
                      <div style={{fontSize:14,fontWeight:700,color:"#fff",marginBottom:4}}>{lbl}</div>
                      <div style={{fontSize:12,color:"#4a5468"}}>{desc}</div>
                    </div>
                    {tipo==="toggle"&&(
                      <div onClick={()=>setLc(x=>({...x,[key]:!x[key]}))} style={{width:48,height:26,borderRadius:13,background:lc[key]?"#6366f1":"#1a1a2e",cursor:"pointer",transition:"background .2s",position:"relative",flexShrink:0}}>
                        <div style={{position:"absolute",top:3,left:lc[key]?24:3,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"left .2s"}}/>
                      </div>
                    )}
                    {tipo==="select"&&(
                      <select style={{...S.inp,minWidth:260}} value={lc[key]} onChange={e=>setLc(x=>({...x,[key]:e.target.value}))}>
                        {options.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                      </select>
                    )}
                    {tipo==="number"&&(
                      <input type="number" min={0} style={{...S.inp,width:100,textAlign:"center"}} value={lc[key]||0} onChange={e=>setLc(x=>({...x,[key]:Number(e.target.value)}))}/>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── HORARIO LABORAL ── */}
        {tab_==="horario"&&(
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{fontSize:12,color:"#4a5468",padding:"10px 14px",background:"#07070f",borderRadius:8,border:"1px solid #1a1a2e"}}>
              🕐 El sistema solo enviará alertas automáticas durante el horario y días laborales configurados aquí. Fuera de horario los asesores descansan.
            </div>
            <div style={S.card}>
              <div style={S.ch}><span style={S.ct}>📅 Días laborales</span></div>
              <div style={{padding:16,display:"flex",gap:10,flexWrap:"wrap"}}>
                {DIAS_SEMANA.map(({v,l})=>{
                  const on=(lc.diasLaborales||[1,2,3,4,5]).includes(v);
                  return (
                    <button key={v} onClick={()=>toggleDia(v)} style={{width:52,height:52,borderRadius:10,border:`2px solid ${on?"#6366f1":"#1a1a2e"}`,background:on?"#6366f122":"transparent",color:on?"#818cf8":"#4a5468",fontSize:12,fontWeight:on?800:400,cursor:"pointer",transition:"all .15s"}}>
                      {l}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={S.card}>
              <div style={S.ch}><span style={S.ct}>🕐 Horario de alertas</span></div>
              <div style={{padding:20,display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                <div><label style={S.lbl}>Hora de inicio</label><input type="time" style={S.inp} value={lc.horaInicioLaboral||"09:00"} onChange={e=>setLc(x=>({...x,horaInicioLaboral:e.target.value}))}/></div>
                <div><label style={S.lbl}>Hora de fin</label><input type="time" style={S.inp} value={lc.horaFinLaboral||"19:00"} onChange={e=>setLc(x=>({...x,horaFinLaboral:e.target.value}))}/></div>
              </div>
            </div>
          </div>
        )}

        {/* ── MENSAJES ── */}
        {tab_==="mensajes"&&(
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={S.card}>
              <div style={S.ch}><span style={S.ct}>👋 Mensaje de bienvenida del equipo</span></div>
              <div style={{padding:20,display:"flex",flexDirection:"column",gap:10}}>
                <div style={{fontSize:12,color:"#4a5468"}}>Se muestra en el dashboard de cada asesor al iniciar sesión. Úsalo para transmitir la visión del mes, el foco del equipo o un mensaje motivacional fijo.</div>
                <textarea rows={4} style={{...S.inp,resize:"vertical"}} value={lc.mensajeBienvenida||""} onChange={e=>setLc(x=>({...x,mensajeBienvenida:e.target.value}))} placeholder="Ej: Este mes cerramos 30 ventas. Cada llamada cuenta. ¡Vamos equipo!"/>
                <div style={{fontSize:11,color:"#374151"}}>{(lc.mensajeBienvenida||"").length}/300 caracteres</div>
              </div>
            </div>
          </div>
        )}

        {/* Save button */}
        <div style={{display:"flex",justifyContent:"flex-end",gap:10,paddingTop:4}}>
          <button style={{...S.btn("secondary"),padding:"12px 20px"}} onClick={()=>setLc({...cfg})}>↩️ Descartar cambios</button>
          <button style={{...S.btn("primary"),padding:"12px 24px"}} onClick={()=>saveCfg(lc)}>💾 Guardar configuración</button>
        </div>
      </div>
    );
  };

  // ── RANKING ───────────────────────────────────────────────────────────────
  const Ranking = () => {
    const [data,setData]   = useState([]);
    const [loading,setL]   = useState(true);
    const [cat,setCat]     = useState("actividades_total");
    const [periodo,setPer] = useState("mes");
    const [rango,setRango] = useState({inicio:today().slice(0,7)+"-01",fin:today()});
    const [rpcErr,setErr]  = useState(null);

    const getPeriodDates = (p) => {
      const t=today();
      if (p==="hoy")   return { p_start:t, p_end:t };
      if (p==="semana"){ const d=new Date(); d.setDate(d.getDate()-6); return { p_start:d.toISOString().split("T")[0], p_end:t }; }
      if (p==="mes")   return { p_start:t.slice(0,7)+"-01", p_end:t };
      if (p==="rango") return { p_start:rango.inicio, p_end:rango.fin };
      return { p_start:null, p_end:null }; // todo
    };

    const loadRanking = async (p) => {
      setL(true); setErr(null);
      try {
        const { supabase }=await import("./supabaseClient");
        const { p_start, p_end }=getPeriodDates(p||periodo);
        const params={}; if (p_start) params.p_start=p_start; if (p_end) params.p_end=p_end;
        const { data:rows,error }=await supabase.rpc("get_ranking", params);
        if (error) { setErr(error.message||"Error al llamar get_ranking"); setData([]); setL(false); return; }
        if (!rows || rows.length===0) { setErr("⚠️ La función get_ranking no devuelve datos. Ve a Supabase → SQL Editor y ejecuta: SELECT * FROM profiles LIMIT 5; — Si profiles está vacía, ese es el problema."); setData([]); setL(false); return; }
        const facByOwner={};
        allP.forEach(p=>{ const sum=getVentas(p).reduce((s,v)=>s+Number(v.monto||0),0); if (sum>0) facByOwner[p.owner_id]=(facByOwner[p.owner_id]||0)+sum; });
        const enriched=(rows||[]).map(r=>({ ...r, facturacion:facByOwner[r.user_id]||0 })).sort((a,b)=>b[cat]-a[cat]);
        setData(enriched);
      } catch(e){ setErr(e.message||"Error desconocido"); console.error(e); }
      setL(false);
    };

    useEffect(()=>{ loadRanking(periodo); },[periodo, rango.inicio, rango.fin]);

    const CATS = [
      { id:"actividades_total", label:"Actividades",      icon:"⚡" },
      { id:"llamadas",          label:"Llamadas",          icon:"📞" },
      { id:"reuniones",         label:"Reuniones",         icon:"🤝" },
      { id:"prospectos",        label:"Prospectos",        icon:"👥" },
      { id:"ventas",            label:"Ventas cerradas",   icon:"🏆" },
      { id:"tareas_completadas",label:"Tareas completas",  icon:"✅" },
      { id:"facturacion",       label:"Facturación",       icon:"💰" },
    ];
    const PERIODOS=[{id:"hoy",l:"Hoy"},{id:"semana",l:"7 días"},{id:"mes",l:"Este mes"},{id:"todo",l:"Todo"},{id:"rango",l:"Rango"}];
    const sorted=[...data].sort((a,b)=>(b[cat]||0)-(a[cat]||0));
    const top3=sorted.slice(0,3);
    const rest=sorted.slice(3);
    const medal=["🥇","🥈","🥉"];
    const podiumColor=["#f59e0b","#9ca3af","#b45309"];
    const fmt2 = (v,catId) => catId==="facturacion" ? fm(v,"MXN") : v?.toLocaleString("es-MX")||"0";

    return (
      <div style={{display:"flex",flexDirection:"column",gap:20}}>
        {/* Header */}
        <div style={{background:"linear-gradient(135deg,#1e1b4b,#312e81)",borderRadius:14,padding:24,textAlign:"center"}}>
          <div style={{fontSize:32,marginBottom:8}}>🏆</div>
          <div style={{fontSize:22,fontWeight:900,color:"#fff"}}>Ranking del Equipo</div>
          <div style={{fontSize:12,color:"rgba(255,255,255,.6)",marginTop:4}}>La competencia que te hace mejorar · Todos visibles</div>
        </div>

        {/* Filtros de periodo */}
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          <span style={{fontSize:11,color:"#6b7280",fontWeight:700}}>PERIODO:</span>
          {PERIODOS.map(p=>(
            <button key={p.id} style={{...S.btn(periodo===p.id?"primary":"secondary","#6366f1"),padding:"6px 14px"}} onClick={()=>setPer(p.id)}>{p.l}</button>
          ))}
          {periodo==="rango"&&(
            <div style={{display:"flex",gap:8,alignItems:"center",marginLeft:4}}>
              <input type="date" style={{...S.inp,width:140,padding:"6px 10px"}} value={rango.inicio} onChange={e=>setRango(r=>({...r,inicio:e.target.value}))}/>
              <span style={{color:"#6b7280",fontSize:12}}>→</span>
              <input type="date" style={{...S.inp,width:140,padding:"6px 10px"}} value={rango.fin} onChange={e=>setRango(r=>({...r,fin:e.target.value}))}/>
            </div>
          )}
        </div>

        {/* Category selector */}
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {CATS.map(c=>(
            <button key={c.id} style={{...S.btn(cat===c.id?"primary":"secondary","#6366f1"),padding:"7px 14px"}} onClick={()=>setCat(c.id)}>
              {c.icon} {c.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{textAlign:"center",padding:60,color:"#374151"}}>Cargando ranking...</div>
        ) : rpcErr ? (
          <div style={{background:"#1a0a0a",border:"1px solid #ef444433",borderRadius:12,padding:24}}>
            <div style={{fontSize:14,fontWeight:700,color:"#ef4444",marginBottom:8}}>❌ Problema con el Ranking</div>
            <div style={{fontSize:12,color:"#9ca3af",lineHeight:1.8,whiteSpace:"pre-wrap"}}>{rpcErr}</div>
            <div style={{marginTop:16,padding:14,background:"#0d0d1a",borderRadius:8,fontSize:11,color:"#6366f1"}}>
              <div style={{fontWeight:700,marginBottom:6}}>🔧 Cómo diagnósticar:</div>
              <div style={{color:"#9ca3af",lineHeight:2}}>
                1. Ve a Supabase → SQL Editor<br/>
                2. Ejecuta: <code style={{background:"#07070f",padding:"2px 6px",borderRadius:4}}>SELECT * FROM profiles LIMIT 5;</code><br/>
                3. Si no hay filas → la tabla profiles está vacía (el trigger no funcionó)<br/>
                4. Si hay filas pero no muestra ranking → ejecuta: <code style={{background:"#07070f",padding:"2px 6px",borderRadius:4}}>SELECT * FROM get_ranking();</code>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Podio top 3 */}
            {top3.length>0&&(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
                {[top3[1],top3[0],top3[2]].map((p,idx)=>{
                  if (!p) return <div key={idx}/>;
                  const rank=sorted.indexOf(p);
                  const h=rank===0?160:rank===1?130:100;
                  return (
                    <div key={p.user_id} style={{textAlign:"center"}}>
                      <div style={{fontSize:32,marginBottom:8}}>{medal[rank]}</div>
                      <div style={{background:"#0d0d1a",border:`2px solid ${podiumColor[rank]}44`,borderRadius:12,padding:20,marginBottom:0}}>
                        <div style={{width:52,height:52,background:podiumColor[rank]+"22",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px",fontSize:22,border:`2px solid ${podiumColor[rank]}44`}}>
                          {p.full_name?.charAt(0)||"?"}
                        </div>
                        <div style={{fontSize:14,fontWeight:800,color:"#fff",marginBottom:4}}>{p.full_name||"—"}</div>
                        <div style={{fontFamily:"monospace",fontSize:28,fontWeight:900,color:podiumColor[rank],lineHeight:1}}>{fmt2(p[cat],cat)}</div>
                        <div style={{fontSize:10,color:"#6b7280",marginTop:4}}>{CATS.find(c2=>c2.id===cat)?.label}</div>
                        <div style={{marginTop:8,display:"flex",justifyContent:"center"}}><span style={S.bdg(p.role==="admin"?"#6366f1":"#374151")}>{p.role}</span></div>
                      </div>
                      <div style={{background:podiumColor[rank],height:h,borderRadius:"0 0 8px 8px",marginTop:-4,opacity:.3}}/>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Tabla completa */}
            <div style={S.card}>
              <div style={S.ch}><span style={S.ct}>📋 Clasificación completa</span></div>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr>
                  <th style={S.th}>#</th>
                  <th style={S.th}>Asesor</th>
                  {CATS.map(c=><th key={c.id} style={{...S.th,color:cat===c.id?"#6366f1":"#374151",background:cat===c.id?"#6366f108":"transparent"}}>{c.icon} {c.label}</th>)}
                </tr></thead>
                <tbody>
                  {sorted.map((p,i)=>(
                    <tr key={p.user_id} style={{background:i<3?"rgba(99,102,241,.03)":"transparent"}} onMouseEnter={e=>e.currentTarget.style.background="#0e0e1c"} onMouseLeave={e=>e.currentTarget.style.background=i<3?"rgba(99,102,241,.03)":"transparent"}>
                      <td style={S.td}><span style={{fontSize:20}}>{i<3?medal[i]:i+1}</span></td>
                      <td style={S.td}>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <div style={{width:32,height:32,borderRadius:"50%",background:"#6366f122",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:"#818cf8"}}>{p.full_name?.charAt(0)||"?"}</div>
                          <div><div style={{fontWeight:600,color:"#fff",fontSize:13}}>{p.full_name||"—"}</div><span style={S.bdg(p.role==="admin"?"#6366f1":"#374151")}>{p.role}</span></div>
                        </div>
                      </td>
                      {CATS.map(c=>(
                        <td key={c.id} style={{...S.td,fontFamily:"monospace",fontWeight:cat===c.id?800:400,color:cat===c.id?"#fff":"#6b7280",fontSize:cat===c.id?15:13}}>
                          {fmt2(p[c.id],c.id)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {sorted.length===0&&<tr><td colSpan={9} style={{...S.td,textAlign:"center",color:"#374151",padding:36}}>Sin datos disponibles</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    );
  };

  // ── TUTORIALES ────────────────────────────────────────────────────────────
  const Tutoriales = () => {
    const [open,setOpen]=useState(null);
    const sections=[
      { id:"inicio", icon:"🚀", title:"Primeros pasos", content:`
Bienvenido al CRM de Native Master Broker. Aquí tienes todo lo que necesitas para gestionar tus prospectos y comisiones.

1. Empieza por agregar tus primeros contactos en las listas (Avatar, Círculo de Poder, etc.) usando el botón "+ Agregar" en la barra superior.
2. Completa los datos del contacto: nombre, teléfono, presupuesto, propósito de inversión y de dónde lo conoces.
3. Ve marcando las etapas conforme avances con el prospecto.
4. Crea tareas para no perder ningún seguimiento.
5. Usa Smart Sales para calcular tus comisiones y ver cuánto te falta para tu meta.
      ` },
      { id:"contactos", icon:"👥", title:"Gestión de contactos", content:`
LISTAS DE CONTACTOS:
• Avatar — Prospectos entrevistados para entender su perfil de inversión
• Círculo de Poder — Tu red cercana de confianza
• Referidores — Personas que te mandan clientes
• Referidos — Clientes que llegaron por recomendación
• Facebook — Prospectos de redes sociales

CAMPOS IMPORTANTES:
• Presupuesto — ¿Cuánto puede invertir?
• Propósito de inversión — ¿Para qué quiere el inmueble? (hogar, renta, inversión, etc.)
• Desarrollo de interés — ¿Qué proyecto le interesa?
• ¿De dónde lo conozco? — Puedes seleccionar múltiples fuentes (Círculo cercano, TikTok, Ads, etc.)

ETAPAS: Marca el progreso del prospecto desde Contactado hasta Testimonio. El sistema calcula automáticamente la "temperatura" del prospecto (🔥 Caliente, 🟡 Tibio, 🧊 Frío).
      ` },
      { id:"tareas", icon:"✅", title:"Tareas y seguimiento", content:`
Las tareas son tu motor de ventas. Sin seguimiento no hay venta.

CREAR TAREAS:
• Desde la pestaña "Tareas" del menú → Nueva tarea
• Desde la ficha de un contacto → pestaña "Tareas" → agregar directamente vinculada al contacto
• Desde el Modo Vendedor al registrar una acción

TIPOS DE TAREA:
📞 Llamada · 🤝 Reunión presencial · 🔄 Seguimiento · 📅 Cita presencial · 🏠 Apartado

HORA: Puedes asignar hora exacta a cada tarea para tener una agenda precisa.

PRIORIDADES: Alta (🔴) · Media (🟡) · Baja (🟢)

Las tareas aparecen en el Calendario y en el Modo Vendedor del día correspondiente.
      ` },
      { id:"calendario", icon:"📅", title:"Calendario", content:`
El calendario muestra todas tus tareas programadas.

VISTAS:
• Día — Ve en detalle todo lo que tienes hoy
• Semana — Vista de 7 días para planear tu semana
• Mes — Vista completa del mes para planificación a largo plazo

FILTROS:
• Por tipo de tarea (llamada, reunión, cita, etc.)
• Por prioridad (Alta, Media, Baja)

NAVEGACIÓN: Usa las flechas ‹ › para moverte entre períodos. El botón "Hoy" te regresa al día actual.

Haz clic en cualquier tarea para editarla o marcarla como completada.
      ` },
      { id:"kanban", icon:"🗂️", title:"Pipeline Kanban (Drag & Drop)", content:`
El Pipeline Kanban te muestra el estado de todos tus prospectos de un vistazo.

COLUMNAS: Nuevo → Contactado → En Proceso → Propuesta Enviada → Negociación → Cerrado ✅

DRAG & DROP: Simplemente arrastra un prospecto de una columna a otra para moverlo de etapa. El sistema actualiza automáticamente las etapas marcadas.

FILTROS: Puedes filtrar por canal (Avatar, Círculo de Poder, etc.) para ver solo los prospectos que te interesan.

TEMPERATURA: El ícono en cada tarjeta indica si el prospecto está 🔥 Caliente, 🟡 Tibio o 🧊 Frío según la última actividad.
      ` },
      { id:"ventas", icon:"💰", title:"Registro de ventas", content:`
Cada contacto puede tener MÚLTIPLES ventas/operaciones registradas.

CÓMO REGISTRAR UNA VENTA:
1. Abre la ficha del contacto
2. Ve a la pestaña "Ventas"
3. Clic en "+ Nueva operación"
4. Llena los datos:
   • Desarrollo — ¿Qué proyecto compró?
   • Monto — Precio de venta
   • Tipo — Contado / Financiado / Pre-venta
   • Fecha de inicio
   • Enganche diferido — Si aplica o no

Las ventas aparecen en el Reporte de Socios y se suman a la facturación del Ranking.
      ` },
      { id:"smartsales", icon:"🚀", title:"Smart Sales", content:`
Smart Sales es tu calculadora de comisiones personales.

CÓMO USARLO:
1. Ve a Smart Sales desde el menú lateral
2. En Configuración: pon tu nombre, meta mensual y configura los proyectos A y B con sus precios y estructuras de comisión
3. Los presets incluyen: Cayo Coco, Soletta, Zen-Ha (residenciales) y Palmarena, Gran Puerto Telchac, Recoleta (semi-urbanizados)

PESTAÑAS:
• 📊 Tracker — Registra tus ventas del mes y ve tu avance hacia la meta
• ⚖️ Comparativa — Compara proyectos y simula con sliders
• 🎯 Escenarios — Ve cuánto ganarías en escenario conservador/realista/agresivo
• 🔻 Embudo — Calcula cuántas llamadas necesitas para cerrar
• 🧠 Estrategia — Recomendación personalizada basada en tus datos

Guarda tu perfil para que persista entre sesiones.
      ` },
      { id:"ranking", icon:"🏆", title:"Ranking del equipo", content:`
El Ranking es visible para todos — admin y asesores.

CATEGORÍAS:
• ⚡ Actividades totales
• 📞 Llamadas
• 🤝 Reuniones
• 👥 Prospectos creados
• 🏆 Ventas cerradas
• ✅ Tareas completadas
• 💰 Facturación total

El objetivo es generar sana competencia dentro del equipo. Nadie puede hacerse el desentendido cuando todos pueden ver los números.

TOP 3: El podio muestra a los tres mejores de cada categoría.
      ` },
      { id:"owner", icon:"🔐", title:"Propietario de contactos", content:`
REGLA DE ORO: El propietario de un contacto es quien lo creó. Nadie puede quitarte un contacto editándolo.

Si un admin abre y edita un contacto tuyo, el propietario NO cambia. Solo el propietario original se conserva.

CAMBIAR PROPIETARIO (solo admin):
Si un admin necesita reasignar un contacto, puede hacerlo desde la ficha del contacto → pestaña Datos → selector "Reasignar a" (visible solo para administradores).

IMPORTANTE: Esta acción es permanente. Asegúrate de hacerlo intencionalmente.
      ` },
    ];
    return (
      <div style={{display:"flex",flexDirection:"column",gap:14,maxWidth:820}}>
        <div style={{background:"linear-gradient(135deg,#0f172a,#1e293b)",borderRadius:14,padding:24}}>
          <div style={{fontSize:28,marginBottom:8}}>❓</div>
          <div style={{fontSize:22,fontWeight:900,color:"#fff"}}>Centro de Ayuda</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,.6)",marginTop:4}}>Todo lo que necesitas saber para usar el CRM al máximo</div>
        </div>
        {sections.map(s=>(
          <div key={s.id} style={{...S.card,overflow:"visible"}}>
            <div style={{...S.ch,cursor:"pointer"}} onClick={()=>setOpen(open===s.id?null:s.id)}>
              <span style={{...S.ct,fontSize:15}}>{s.icon} {s.title}</span>
              <span style={{color:"#374151",fontSize:18,fontWeight:300}}>{open===s.id?"−":"+"}</span>
            </div>
            {open===s.id&&(
              <div style={{padding:20}}>
                {s.content.trim().split("\n").map((line,i)=>{
                  if (!line.trim()) return <div key={i} style={{height:10}}/>;
                  const isBold=line.match(/^[A-ZÁÉÍÓÚ\s]+:$/)||line.match(/^CÓMO/)||line.match(/^REGLA/)||line.match(/^IMPORTANTE/)||line.match(/^PESTAÑAS/)||line.match(/^TIPOS/)||line.match(/^CAMPOS/)||line.match(/^LISTAS/)||line.match(/^VISTAS/)||line.match(/^COLUMNAS/)||line.match(/^FILTROS/)||line.match(/^NAVEGACIÓN/)||line.match(/^TEMPERATURA/)||line.match(/^CATEGORÍAS/)||line.match(/^TOP/)||line.match(/^CAMBIAR/)||line.match(/^DRAG/)||line.match(/^PRIORIDADES/)||line.match(/^HORA/);
                  return <div key={i} style={{fontSize:13,color:isBold?"#fff":line.startsWith("•")?"#9ca3af":line.startsWith("📞")||line.startsWith("🤝")||line.startsWith("🔄")||line.startsWith("📅")||line.startsWith("🏠")?"#818cf8":"#6b7280",fontWeight:isBold?700:400,lineHeight:1.8,marginLeft:line.startsWith("•")?"8px":0}}>{line}</div>;
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // ── PROSPECT MODAL ────────────────────────────────────────────────────────
  const ProspectModal = () => {
    const isNew=!modal.person?.id||!allP.find(p=>p.id===modal.person?.id);
    const tab  =modal.person?.tab||modal.tab;
    const color=TM[tab]?.color||"#6366f1";

    const initVentas = () => {
      // Prefer state persisted in modal object (survives re-renders)
      if (modal._ventas !== undefined) return modal._ventas;
      if (!modal.person) return [];
      const v=modal.person.venta;
      if (Array.isArray(v)) return v;
      if (v?.monto) return [v];
      return [];
    };

    const initForm = () => {
      if (modal._form !== undefined) return modal._form;
      return modal.person ? {...modal.person,tab} : {id:uid(),tab,stages:{},notasHistorial:[],creadoEn:today(),updatedAt:today()};
    };

    // ── State init: reads from CRM-level ref so it survives ProspectModal remounts ──
    // ProspectModal is defined inside CRM → every CRM re-render creates a new function
    // reference → React unmounts/remounts → local state would reset. prospectStateRef
    // lives at CRM level and is never lost.
    const modalKey = modal.person?.id || `new-${tab}`;
    const saved    = prospectStateRef.current?.key === modalKey ? prospectStateRef.current : null;

    const [form,   setFormLocal]   = useState(() => saved?.form   ?? initForm());
    const [tab_,   setTab_Local]   = useState(() => saved?.tab    ?? "datos");
    const [ventas, setVentasLocal] = useState(() => saved?.ventas ?? initVentas());
    const [nNota,  setNNota]  = useState("");
    const [newTask,setNewTask]= useState(null);
    const [ventaErrors, setVentaErrors] = useState({});
    const [formErrors,  setFormErrors]  = useState({});

    // Wrappers: update local state AND CRM-level ref synchronously.
    // Ref assignment is synchronous so even if the component remounts immediately
    // after, useState(init) will read the latest value from the ref.
    // NO setModal() calls here → no CRM re-renders while typing.
    const setForm = (updater) => {
      setFormLocal(prev => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        prospectStateRef.current = { ...prospectStateRef.current, key: modalKey, form: next };
        return next;
      });
    };
    const setVentas = (updater) => {
      setVentasLocal(prev => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        prospectStateRef.current = { ...prospectStateRef.current, key: modalKey, ventas: next };
        return next;
      });
    };
    const setTab_ = (t) => {
      prospectStateRef.current = { ...prospectStateRef.current, key: modalKey, tab: t };
      setTab_Local(t);
    };

    // conocePor como string simple (single select)
    const conocePorVal = Array.isArray(form.conocePor) ? (form.conocePor[0]||"") : (form.conocePor||"");

    const addNotaLocal = () => { if (!nNota.trim()) return; const n={id:uid(),texto:nNota,fecha:today(),hora:new Date().toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"})}; setForm(f=>({...f,notasHistorial:[...(f.notasHistorial||[]),n]})); setNNota(""); };
    const addVenta = () => setVentas(v=>[...v,{id:uid(),desarrollo:"",monto:"",tipo:"contado",fechaInicio:"",engancheDiferido:false,engancheTipo:"pct"}]);
    const updVenta = (id,key,val) => setVentas(v=>v.map(x=>x.id===id?{...x,[key]:val}:x));
    const delVenta = (id) => setVentas(v=>v.filter(x=>x.id!==id));

    // Validación de ventas
    const validateVentas = () => {
      const errs = {};
      ventas.forEach((v,i) => {
        const vErr = {};
        if (!v.desarrollo?.trim()) vErr.desarrollo = "Obligatorio";
        if (!v.monto || Number(v.monto)<=0) vErr.monto = "Obligatorio";
        if (!v.fechaInicio) vErr.fechaInicio = "Obligatorio";
        if (v.tipo==="financiado") {
          if (!v.plazoMeses || Number(v.plazoMeses)<=0) vErr.plazoMeses = "Obligatorio para financiado";
        }
        if (Object.keys(vErr).length) errs[v.id] = vErr;
      });
      setVentaErrors(errs);
      return Object.keys(errs).length === 0;
    };

    // Tareas vinculadas
    const linkedTareas = tareas.filter(t=>t.prospectId===form.id);
    const initNewTask  = () => setNewTask({id:uid(),titulo:"",prospectId:form.id,prioridad:"Media",fecha:today(),hora:"",tipoTarea:"llamada",estado:"pendiente",notas:""});
    const handleSaveInlineTask = async () => {
      if (!newTask?.titulo?.trim()) return;
      await saveTareaInline(newTask);
      setNewTask(null);
    };

    // Validate required fields from admin config
    const validateForm = () => {
      const required = (cfg.camposObligatorios||{})[tab] || [];
      const errs = {};
      required.forEach(campo => {
        const val = form[campo];
        if (!val || (typeof val === "string" && !val.trim())) {
          errs[campo] = "Este campo es obligatorio";
        }
      });
      setFormErrors(errs);
      return Object.keys(errs).length === 0;
    };

    const handleSave = () => {
      // Validate required fields (from admin config)
      if (!validateForm()) {
        setTab_("datos"); // jump to datos tab where most required fields live
        return;
      }
      // Validate ventas if any
      if (ventas.length>0 && !validateVentas()) {
        setTab_("venta");
        return;
      }
      prospectStateRef.current = { key: null, form: null, ventas: null, tab: "datos" };
      saveP(tab, {...form, venta:ventas});
    };

    const PROSPECT_TABS=[["datos","👤 Datos"],["etapas","📊 Etapas"],["notas","📝 Historial"],["actividades","⚡ Actividades"],["tareas","✅ Tareas"],["venta","💰 Ventas"]];

    return (
      <div style={S.modal} onClick={e=>{if(e.target===e.currentTarget){prospectStateRef.current={key:null,form:null,ventas:null,tab:"datos"};setModal(null);}}}>
        <div style={{...S.mbox,maxWidth:640}}>
          {/* Header */}
          <div style={{padding:"16px 20px",borderBottom:"1px solid #1a1a2e",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
            <div><div style={{fontSize:10,color,fontWeight:700,letterSpacing:2}}>{TM[tab]?.icon} {TM[tab]?.label?.toUpperCase()}</div><div style={{fontSize:15,fontWeight:800,color:"#fff"}}>{isNew?"Nuevo registro":"Editar registro"}</div></div>
            <button style={S.btn("ghost")} onClick={()=>setModal(null)}>✕</button>
          </div>
          {/* Tabs */}
          <div style={{display:"flex",gap:4,padding:"10px 20px",borderBottom:"1px solid #1a1a2e",flexShrink:0,overflowX:"auto"}}>
            {PROSPECT_TABS.map(([id,label])=>(
              <button key={id} style={{...S.btn(tab_===id?"primary":"secondary",tab_===id?color:undefined),padding:"5px 12px",whiteSpace:"nowrap"}} onClick={()=>setTab_(id)}>
                {label}
                {id==="tareas"&&linkedTareas.length>0&&<span style={{marginLeft:5,background:"rgba(255,255,255,.2)",borderRadius:10,padding:"0 5px",fontSize:9}}>{linkedTareas.length}</span>}
                {id==="actividades"&&acts.filter(a=>a.prospectId===form.id).length>0&&<span style={{marginLeft:5,background:"rgba(255,255,255,.2)",borderRadius:10,padding:"0 5px",fontSize:9}}>{acts.filter(a=>a.prospectId===form.id).length}</span>}
              </button>
            ))}
          </div>

          {/* Body */}
          <div style={{padding:20,overflow:"auto",flex:1}}>

            {/* ── DATOS ── */}
            {tab_==="datos"&&(
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {/* Required fields error banner */}
                {Object.keys(formErrors).length>0&&(
                  <div style={{background:"rgba(239,68,68,.08)",border:"1px solid #ef444433",borderRadius:8,padding:"10px 14px"}}>
                    <div style={{fontSize:12,fontWeight:700,color:"#f87171",marginBottom:4}}>⚠️ Faltan campos obligatorios — corrígelos para poder guardar</div>
                    {(()=>{const FL={"nombre":"Nombre y Apellido","correo":"Correo","telefono":"Teléfono","presupuesto":"Presupuesto","propositoInversion":"Propósito de inversión","desarrolloInteres":"Desarrollo de interés","conocePor":"¿De dónde lo conozco?","comision":"Comisión acordada"};return Object.keys(formErrors).map(k=>(<div key={k} style={{fontSize:11,color:"#fca5a5",marginTop:2}}>· {FL[k]||k}</div>));})()}
                  </div>
                )}
                {/* nombre full width */}
                <div>
                  <label style={{...S.lbl,color:formErrors.nombre?"#ef4444":undefined}}>Nombre y Apellido{(cfg.camposObligatorios||{})[tab]?.includes("nombre")&&<span style={{color:"#ef4444"}}> *</span>}</label>
                  <input style={{...S.inp,borderColor:formErrors.nombre?"#ef4444":undefined}} value={form.nombre||""} onChange={e=>{setForm(f=>({...f,nombre:e.target.value}));setFormErrors(fe=>({...fe,nombre:undefined}));}} placeholder="Nombre completo"/>
                  {formErrors.nombre&&<div style={{fontSize:10,color:"#ef4444",marginTop:3}}>⚠️ {formErrors.nombre}</div>}
                </div>
                <div style={S.g2}>
                  <div>
                    <label style={{...S.lbl,color:formErrors.correo?"#ef4444":undefined}}>Correo{(cfg.camposObligatorios||{})[tab]?.includes("correo")&&<span style={{color:"#ef4444"}}> *</span>}</label>
                    <input style={{...S.inp,borderColor:formErrors.correo?"#ef4444":undefined}} value={form.correo||""} onChange={e=>{setForm(f=>({...f,correo:e.target.value}));setFormErrors(fe=>({...fe,correo:undefined}));}} placeholder="correo@email.com"/>
                    {formErrors.correo&&<div style={{fontSize:10,color:"#ef4444",marginTop:3}}>⚠️ {formErrors.correo}</div>}
                  </div>
                  <div>
                    <label style={{...S.lbl,color:formErrors.telefono?"#ef4444":undefined}}>Teléfono{(cfg.camposObligatorios||{})[tab]?.includes("telefono")&&<span style={{color:"#ef4444"}}> *</span>}</label>
                    <input style={{...S.inp,borderColor:formErrors.telefono?"#ef4444":undefined}} value={form.telefono||""} onChange={e=>{setForm(f=>({...f,telefono:e.target.value}));setFormErrors(fe=>({...fe,telefono:undefined}));}} placeholder="+52 999 000 0000"/>
                    {formErrors.telefono&&<div style={{fontSize:10,color:"#ef4444",marginTop:3}}>⚠️ {formErrors.telefono}</div>}
                  </div>
                </div>
                {(FIELDS[tab]||[]).includes("presupuesto")&&(
                  <div style={S.g2}>
                    <div>
                      <label style={{...S.lbl,color:formErrors.presupuesto?"#ef4444":undefined}}>Presupuesto ($){(cfg.camposObligatorios||{})[tab]?.includes("presupuesto")&&<span style={{color:"#ef4444"}}> *</span>}</label>
                      <input type="number" style={{...S.inp,borderColor:formErrors.presupuesto?"#ef4444":undefined}} value={form.presupuesto||""} onChange={e=>{setForm(f=>({...f,presupuesto:e.target.value}));setFormErrors(fe=>({...fe,presupuesto:undefined}));}} placeholder="0"/>
                      {formErrors.presupuesto&&<div style={{fontSize:10,color:"#ef4444",marginTop:3}}>⚠️ {formErrors.presupuesto}</div>}
                    </div>
                    <div>
                      <label style={{...S.lbl,color:formErrors.propositoInversion?"#ef4444":undefined}}>Propósito de inversión{(cfg.camposObligatorios||{})[tab]?.includes("propositoInversion")&&<span style={{color:"#ef4444"}}> *</span>}</label>
                      <input style={{...S.inp,borderColor:formErrors.propositoInversion?"#ef4444":undefined}} value={form.propositoInversion||""} onChange={e=>{setForm(f=>({...f,propositoInversion:e.target.value}));setFormErrors(fe=>({...fe,propositoInversion:undefined}));}} placeholder="Hogar propio, renta, inversión..."/>
                      {formErrors.propositoInversion&&<div style={{fontSize:10,color:"#ef4444",marginTop:3}}>⚠️ {formErrors.propositoInversion}</div>}
                    </div>
                  </div>
                )}
                {(FIELDS[tab]||[]).includes("desarrolloInteres")&&(
                  <div>
                    <label style={{...S.lbl,color:formErrors.desarrolloInteres?"#ef4444":undefined}}>Desarrollo de interés{(cfg.camposObligatorios||{})[tab]?.includes("desarrolloInteres")&&<span style={{color:"#ef4444"}}> *</span>}</label>
                    <input style={{...S.inp,borderColor:formErrors.desarrolloInteres?"#ef4444":undefined}} value={form.desarrolloInteres||""} onChange={e=>{setForm(f=>({...f,desarrolloInteres:e.target.value}));setFormErrors(fe=>({...fe,desarrolloInteres:undefined}));}} placeholder="Cayo Coco, Palmarena, Gran Puerto..."/>
                    {formErrors.desarrolloInteres&&<div style={{fontSize:10,color:"#ef4444",marginTop:3}}>⚠️ {formErrors.desarrolloInteres}</div>}
                  </div>
                )}
                {(FIELDS[tab]||[]).includes("comision")&&(
                  <div>
                    <label style={{...S.lbl,color:formErrors.comision?"#ef4444":undefined}}>Comisión acordada{(cfg.camposObligatorios||{})[tab]?.includes("comision")&&<span style={{color:"#ef4444"}}> *</span>}</label>
                    <input style={{...S.inp,borderColor:formErrors.comision?"#ef4444":undefined}} value={form.comision||""} onChange={e=>{setForm(f=>({...f,comision:e.target.value}));setFormErrors(fe=>({...fe,comision:undefined}));}}/>
                    {formErrors.comision&&<div style={{fontSize:10,color:"#ef4444",marginTop:3}}>⚠️ {formErrors.comision}</div>}
                  </div>
                )}
                {(FIELDS[tab]||[]).includes("quienRefiere")&&(
                  <div><label style={S.lbl}>¿Quién lo refiere?</label><input style={S.inp} value={form.quienRefiere||""} onChange={e=>setForm(f=>({...f,quienRefiere:e.target.value}))}/></div>
                )}
                {(FIELDS[tab]||[]).includes("facebook")&&(
                  <div style={S.g2}>
                    <div><label style={S.lbl}>Perfil Facebook</label><input style={S.inp} value={form.facebook||""} onChange={e=>setForm(f=>({...f,facebook:e.target.value}))}/></div>
                    <div><label style={S.lbl}>Amigos en común</label><input style={S.inp} value={form.amigosCom||""} onChange={e=>setForm(f=>({...f,amigosCom:e.target.value}))}/></div>
                  </div>
                )}
                {(FIELDS[tab]||[]).includes("conocePor")&&(
                  <div>
                    <label style={S.lbl}>¿De dónde lo conozco?</label>
                    <select style={S.inp} value={conocePorVal} onChange={e=>setForm(f=>({...f,conocePor:e.target.value}))}>
                      <option value="">Selecciona una opción...</option>
                      {CONOCE_POR_OPTIONS.map(opt=><option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                )}
                {/* Perdido toggle */}
                <div style={{paddingTop:8,display:"flex",alignItems:"center",gap:10,cursor:"pointer"}} onClick={()=>setForm(f=>({...f,perdido:!f.perdido}))}>
                  <Chk on={!!form.perdido} color="#ef4444" onChange={()=>{}}/>
                  <span style={{fontSize:13,color:"#9ca3af"}}>Marcar como perdido / no calificó</span>
                </div>
                {/* Admin: reasignar propietario */}
                {isAdmin&&!isNew&&profiles.length>0&&(
                  <div style={{borderTop:"1px solid #1a1a2e",paddingTop:14,marginTop:4}}>
                    <label style={{...S.lbl,color:"#f59e0b"}}>⚠️ Reasignar propietario (solo admin)</label>
                    <select style={{...S.inp,borderColor:"#f59e0b44"}} value={form.owner_id||""} onChange={e=>setForm(f=>({...f,owner_id:e.target.value}))}>
                      {profiles.map(p=><option key={p.user_id} value={p.user_id}>{p.full_name} ({p.role})</option>)}
                    </select>
                    <div style={{fontSize:10,color:"#6b7280",marginTop:4}}>Propietario actual: {form.owner_name||"—"}</div>
                  </div>
                )}
              </div>
            )}

            {/* ── ETAPAS ── */}
            {tab_==="etapas"&&(
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                <div style={{fontSize:12,color:"#6b7280",marginBottom:8}}>Marca las etapas completadas.</div>
                {(STAGES[tab]||[]).map(st=>(
                  <div key={st} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 12px",borderRadius:8,cursor:"pointer",background:form.stages?.[st]?"rgba(16,185,129,.08)":"transparent"}} onClick={()=>setForm(f=>({...f,stages:{...f.stages,[st]:!f.stages?.[st]}}))}>
                    <Chk on={!!form.stages?.[st]} color={color} onChange={()=>{}}/>
                    <span style={{fontSize:13,color:form.stages?.[st]?"#10b981":"#9ca3af",fontWeight:form.stages?.[st]?700:400}}>{st}</span>
                  </div>
                ))}
              </div>
            )}

            {/* ── HISTORIAL ── */}
            {tab_==="notas"&&(
              <div>
                <div style={{display:"flex",gap:8,marginBottom:16}}>
                  <input style={{...S.inp,flex:1}} value={nNota} onChange={e=>setNNota(e.target.value)} placeholder="Escribe una nota..." onKeyDown={e=>e.key==="Enter"&&addNotaLocal()}/>
                  <button style={S.btn("primary")} onClick={addNotaLocal}>+ Agregar</button>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {(form.notasHistorial||[]).slice().reverse().map(n=>{
                    const isAuto=n.texto?.startsWith("📞")||n.texto?.startsWith("💬")||n.texto?.startsWith("📧")||n.texto?.startsWith("📄")||n.texto?.startsWith("🤝")||n.texto?.startsWith("🔄")||n.texto?.startsWith("✅")||n.texto?.startsWith("↩️")||n.texto?.startsWith("⚡")||n.texto?.startsWith("✅")||n.texto?.startsWith("🏠");
                    return (
                      <div key={n.id} style={{background:"#07070f",borderRadius:8,padding:14,borderLeft:`3px solid ${isAuto?"#6366f144":"#374151"}`}}>
                        <div style={{display:"flex",gap:8,marginBottom:4,alignItems:"center"}}>
                          <span style={{fontSize:11,color:isAuto?"#6366f1":"#374151",fontWeight:700}}>{fd(n.fecha)}{n.hora?` · ${n.hora}`:""}</span>
                          {isAuto&&<span style={{fontSize:9,color:"#6366f1",background:"#6366f111",padding:"1px 6px",borderRadius:8,fontWeight:700}}>AUTO</span>}
                        </div>
                        <div style={{fontSize:13,color:"#dde0f0"}}>{n.texto}</div>
                      </div>
                    );
                  })}
                  {(form.notasHistorial||[]).length===0&&<div style={{textAlign:"center",color:"#374151",fontSize:12,padding:24}}>Sin historial aún.</div>}
                </div>
              </div>
            )}

            {/* ── ACTIVIDADES ── */}
            {tab_==="actividades"&&(
              <div style={{display:"flex",flexDirection:"column",gap:14}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:12,color:"#6b7280"}}>{acts.filter(a=>a.prospectId===form.id).length} actividades vinculadas</span>
                  <button style={{...S.btn("primary",color),padding:"6px 14px"}} onClick={()=>{ setModal(null); setTimeout(()=>setModal({type:"actividad",pre:{prospect_id:form.id,prospectNombre:form.nombre}}),50); }}>+ Registrar actividad</button>
                </div>
                {acts.filter(a=>a.prospectId===form.id).length===0&&(
                  <div style={{textAlign:"center",color:"#374151",fontSize:12,padding:32}}>Sin actividades registradas para este contacto.</div>
                )}
                {acts.filter(a=>a.prospectId===form.id).sort((a,b)=>b.fecha.localeCompare(a.fecha)).map(a=>{
                  const at=ACT_TYPES.find(x=>x.id===a.tipo)||{icon:"⚡",label:a.tipo};
                  return (
                    <div key={a.id} style={{background:"#07070f",borderRadius:10,padding:14,display:"flex",gap:14,alignItems:"flex-start"}}>
                      <div style={{fontSize:24,flexShrink:0}}>{at.icon}</div>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                          <span style={{fontWeight:700,color:"#fff",fontSize:13}}>{at.label}</span>
                          <span style={{fontSize:11,color:"#374151"}}>{fd(a.fecha)}</span>
                        </div>
                        {a.cantidad>1&&<div style={{fontSize:11,color:"#6366f1"}}>×{a.cantidad}</div>}
                        {a.notas&&<div style={{fontSize:12,color:"#9ca3af",marginTop:4}}>{a.notas}</div>}
                        {isAdmin&&<div style={{fontSize:10,color:"#4b5563",marginTop:4}}>👤 {a.ownerName||"—"}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── TAREAS ── */}
            {tab_==="tareas"&&(
              <div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                  <span style={{fontSize:12,color:"#6b7280"}}>{linkedTareas.length} tarea{linkedTareas.length!==1?"s":""} vinculadas a este contacto</span>
                  {!newTask&&<button style={{...S.btn("primary",color),padding:"6px 14px"}} onClick={initNewTask}>+ Nueva tarea</button>}
                </div>

                {/* Form nueva tarea inline */}
                {newTask&&(
                  <div style={{background:"#07070f",border:`1px solid ${color}33`,borderRadius:10,padding:16,marginBottom:16}}>
                    <div style={{fontSize:12,fontWeight:700,color,marginBottom:12}}>Nueva tarea para {form.nombre||"este contacto"}</div>
                    <div style={{marginBottom:10}}>
                      <label style={S.lbl}>Tipo de tarea</label>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                        {TASK_TYPES.map(tt=>(
                          <button key={tt.id} style={{...S.btn(newTask.tipoTarea===tt.id?"primary":"secondary",newTask.tipoTarea===tt.id?color:undefined),padding:"5px 10px",fontSize:11}} onClick={()=>setNewTask(t=>({...t,tipoTarea:tt.id}))}>
                            {tt.icon} {tt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div><label style={S.lbl}>Título*</label><input style={S.inp} value={newTask.titulo} onChange={e=>setNewTask(t=>({...t,titulo:e.target.value}))} placeholder="¿Qué hay que hacer?"/></div>
                    <div style={{...S.g2,marginTop:10}}>
                      <div><label style={S.lbl}>Fecha</label><input type="date" style={S.inp} value={newTask.fecha} onChange={e=>setNewTask(t=>({...t,fecha:e.target.value}))}/></div>
                      <div><label style={S.lbl}>Hora (opcional)</label><input type="time" style={S.inp} value={newTask.hora} onChange={e=>setNewTask(t=>({...t,hora:e.target.value}))}/></div>
                    </div>
                    <div style={{...S.g2,marginTop:10}}>
                      <div><label style={S.lbl}>Prioridad</label>
                        <select style={S.inp} value={newTask.prioridad} onChange={e=>setNewTask(t=>({...t,prioridad:e.target.value}))}><option>Alta</option><option>Media</option><option>Baja</option></select>
                      </div>
                      <div><label style={S.lbl}>Notas</label><input style={S.inp} value={newTask.notas} onChange={e=>setNewTask(t=>({...t,notas:e.target.value}))} placeholder="Opcional"/></div>
                    </div>
                    <div style={{display:"flex",gap:8,marginTop:12,justifyContent:"flex-end"}}>
                      <button style={S.btn("secondary")} onClick={()=>setNewTask(null)}>Cancelar</button>
                      <button style={{...S.btn("primary",color)}} onClick={handleSaveInlineTask}>💾 Guardar tarea</button>
                    </div>
                  </div>
                )}

                {/* Lista de tareas vinculadas */}
                {linkedTareas.length===0&&!newTask&&<div style={{textAlign:"center",color:"#374151",fontSize:12,padding:32}}>Sin tareas vinculadas. Crea una para dar seguimiento.</div>}
                {linkedTareas.map(t=>{
                  const tt=TASK_TYPES.find(x=>x.id===t.tipoTarea)||TASK_TYPES[0];
                  const overdue=t.fecha<today()&&t.estado==="pendiente";
                  return (
                    <div key={t.id} style={{display:"flex",alignItems:"flex-start",gap:12,padding:"12px 0",borderBottom:"1px solid #14142a"}}>
                      <Chk on={t.estado==="completada"} color="#10b981" onChange={()=>toggleTarea(t.id)}/>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:600,color:t.estado==="completada"?"#4b5563":"#fff",textDecoration:t.estado==="completada"?"line-through":"none"}}>{tt.icon} {t.titulo}</div>
                        <div style={{display:"flex",gap:8,marginTop:4,flexWrap:"wrap"}}>
                          <span style={S.bdg(PRIO_C[t.prioridad]||"#374151")}>{t.prioridad}</span>
                          <span style={{fontSize:10,color:overdue?"#ef4444":"#6b7280"}}>{fd(t.fecha)}{t.hora?" · "+t.hora:""}{overdue?" ⚠️":""}</span>
                        </div>
                        {t.notas&&<div style={{fontSize:11,color:"#4b5563",marginTop:4}}>{t.notas}</div>}
                      </div>
                      <button style={{...S.btn("danger"),padding:"4px 9px",fontSize:11}} onClick={()=>delTarea(t.id)}>✕</button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── VENTAS ── */}
            {tab_==="venta"&&(
              <div style={{display:"flex",flexDirection:"column",gap:16}}>
                <div style={{background:"rgba(16,185,129,.05)",border:"1px solid #10b98133",borderRadius:10,padding:14,fontSize:12,color:"#10b981"}}>
                  Registra cada operación inmobiliaria cerrada con este contacto. Puedes registrar múltiples ventas.
                </div>
                {ventas.length===0&&<div style={{textAlign:"center",color:"#374151",fontSize:12,padding:24}}>Sin ventas registradas. Clic en "+ Agregar operación" cuando se cierre.</div>}
                {ventas.map((v,i)=>{
                  // Cálculo amortización
                  const montoNum=Number(v.monto||0);
                  const enganchemontoBruto = v.engancheTipo==="pct" ? montoNum*(Number(v.enganchemonto||0)/100) : Number(v.enganchemonto||0);
                  const financiado=montoNum-enganchemontoBruto;
                  const tasaMensual=(Number(v.tasaAnual||0)/100)/12;
                  const plazo=Number(v.plazoMeses||12);
                  const mensualidad = tasaMensual>0 && plazo>0 && financiado>0
                    ? (financiado * tasaMensual) / (1 - Math.pow(1+tasaMensual,-plazo))
                    : (plazo>0&&financiado>0 ? financiado/plazo : 0);
                  const vErr = ventaErrors[v.id] || {};
                  return (
                  <div key={v.id} style={{background:"#07070f",border:`1px solid ${Object.keys(vErr).length?"#ef4444":"#10b981"}33`,borderRadius:10,padding:16}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                      <span style={{fontSize:12,fontWeight:700,color:"#10b981"}}>Operación #{i+1}</span>
                      <button style={{...S.btn("danger"),padding:"3px 8px",fontSize:11}} onClick={()=>delVenta(v.id)}>✕ Eliminar</button>
                    </div>
                    <div>
                      <label style={S.lbl}>Desarrollo / Proyecto <span style={{color:"#ef4444"}}>*</span></label>
                      <input style={{...S.inp,borderColor:vErr.desarrollo?"#ef4444":undefined}} value={v.desarrollo||""} onChange={e=>updVenta(v.id,"desarrollo",e.target.value)} placeholder="Cayo Coco, Palmarena, Gran Puerto..."/>
                      {vErr.desarrollo&&<div style={{fontSize:10,color:"#ef4444",marginTop:3}}>⚠️ {vErr.desarrollo}</div>}
                    </div>
                    <div style={{...S.g2,marginTop:10}}>
                      <div>
                        <label style={S.lbl}>Monto de venta ($) <span style={{color:"#ef4444"}}>*</span></label>
                        <input type="number" style={{...S.inp,borderColor:vErr.monto?"#ef4444":undefined}} value={v.monto||""} onChange={e=>updVenta(v.id,"monto",e.target.value)}/>
                        {vErr.monto&&<div style={{fontSize:10,color:"#ef4444",marginTop:3}}>⚠️ {vErr.monto}</div>}
                      </div>
                      <div><label style={S.lbl}>Tipo de operación</label>
                        <select style={S.inp} value={v.tipo||"contado"} onChange={e=>updVenta(v.id,"tipo",e.target.value)}>
                          <option value="contado">Contado</option>
                          <option value="financiado">Financiado</option>
                        </select>
                      </div>
                    </div>
                    <div style={{marginTop:10}}>
                      <label style={S.lbl}>Fecha de cierre <span style={{color:"#ef4444"}}>*</span></label>
                      <input type="date" style={{...S.inp,borderColor:vErr.fechaInicio?"#ef4444":undefined}} value={v.fechaInicio||""} onChange={e=>updVenta(v.id,"fechaInicio",e.target.value)}/>
                      {vErr.fechaInicio&&<div style={{fontSize:10,color:"#ef4444",marginTop:3}}>⚠️ {vErr.fechaInicio}</div>}
                    </div>

                    {/* ── Campos de financiado ── */}
                    {v.tipo==="financiado"&&(
                      <div style={{marginTop:14,padding:14,background:"#0b0b18",borderRadius:8,display:"flex",flexDirection:"column",gap:12}}>
                        <div style={{fontSize:11,color:"#6366f1",fontWeight:700,letterSpacing:1}}>💳 DETALLES DE FINANCIAMIENTO</div>

                        {/* Enganche */}
                        <div>
                          <label style={S.lbl}>Enganche</label>
                          <div style={{display:"flex",gap:8}}>
                            <select style={{...S.inp,width:80,flexShrink:0}} value={v.engancheTipo||"pct"} onChange={e=>updVenta(v.id,"engancheTipo",e.target.value)}>
                              <option value="pct">%</option>
                              <option value="monto">$</option>
                            </select>
                            <input type="number" style={S.inp} placeholder={v.engancheTipo==="pct"?"Ej. 20":"Ej. 150000"} value={v.enganchemonto||""} onChange={e=>updVenta(v.id,"enganchemonto",e.target.value)}/>
                          </div>
                          {montoNum>0&&v.enganchemonto&&(
                            <div style={{fontSize:11,color:"#10b981",marginTop:4}}>
                              = {fm(enganchemontoBruto,"MXN")} de enganche · Financiado: {fm(financiado,"MXN")}
                            </div>
                          )}
                        </div>

                        {/* Plazo y tasa */}
                        <div style={S.g2}>
                          <div>
                            <label style={S.lbl}>Plazo (meses) <span style={{color:"#ef4444"}}>*</span></label>
                            <input type="number" style={{...S.inp,borderColor:vErr.plazoMeses?"#ef4444":undefined}} placeholder="Ej. 60" value={v.plazoMeses||""} onChange={e=>updVenta(v.id,"plazoMeses",e.target.value)}/>
                            {vErr.plazoMeses&&<div style={{fontSize:10,color:"#ef4444",marginTop:3}}>⚠️ {vErr.plazoMeses}</div>}
                          </div>
                          <div><label style={S.lbl}>Tasa anual (%) <span style={{color:"#9ca3af",fontWeight:400}}>(opcional)</span></label><input type="number" style={S.inp} placeholder="Ej. 12" value={v.tasaAnual||""} onChange={e=>updVenta(v.id,"tasaAnual",e.target.value)}/></div>
                        </div>

                        {/* Enganche diferido */}
                        <div>
                          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:v.engancheDiferido?10:0,cursor:"pointer"}} onClick={()=>updVenta(v.id,"engancheDiferido",!v.engancheDiferido)}>
                            <Chk on={!!v.engancheDiferido} color="#f59e0b" onChange={()=>{}}/>
                            <span style={{fontSize:13,color:"#9ca3af"}}>Enganche diferido</span>
                          </div>
                          {v.engancheDiferido&&(
                            <div>
                              <label style={S.lbl}>Meses a diferir el enganche</label>
                              <input type="number" style={S.inp} placeholder="Ej. 6" value={v.mesesDiferido||""} onChange={e=>updVenta(v.id,"mesesDiferido",e.target.value)}/>
                            </div>
                          )}
                        </div>

                        {/* Mini amortización */}
                        {mensualidad>0&&financiado>0&&plazo>0&&(
                          <div style={{background:"#07070f",borderRadius:8,padding:12}}>
                            <div style={{fontSize:11,color:"#6366f1",fontWeight:700,marginBottom:10}}>📊 RESUMEN DE AMORTIZACIÓN</div>
                            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                              {[
                                {l:"Monto financiado",v:fm(financiado,"MXN"),c:"#fff"},
                                {l:"Mensualidad aprox.",v:fm(mensualidad,"MXN"),c:"#10b981"},
                                {l:"Total a pagar",v:fm(mensualidad*plazo,"MXN"),c:"#f59e0b"},
                                {l:"Total intereses",v:fm(mensualidad*plazo-financiado,"MXN"),c:"#ef4444"},
                              ].map(r=>(
                                <div key={r.l} style={{background:"#0b0b18",borderRadius:6,padding:10}}>
                                  <div style={{fontSize:9,color:"#374151",marginBottom:2}}>{r.l}</div>
                                  <div style={{fontSize:14,fontWeight:700,color:r.c}}>{r.v}</div>
                                </div>
                              ))}
                            </div>
                            {v.engancheDiferido&&v.mesesDiferido&&(
                              <div style={{marginTop:8,fontSize:11,color:"#f59e0b"}}>⚠️ El enganche de {fm(enganchemontoBruto,"MXN")} se difiere {v.mesesDiferido} meses</div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {v.monto&&<div style={{marginTop:12,fontSize:12,color:"#10b981",fontWeight:700}}>💰 Total operación: {fm(Number(v.monto),"MXN")}</div>}
                  </div>
                  );
                })}
                <button style={{...S.btn("green"),padding:12,width:"100%",textAlign:"center"}} onClick={addVenta}>+ Agregar operación</button>
                {ventas.length>0&&<div style={{background:"#07070f",borderRadius:10,padding:14,fontSize:13,color:"#6b7280"}}>Total acumulado: <strong style={{color:"#10b981",fontSize:16}}>{fm(ventas.reduce((s,v)=>s+Number(v.monto||0),0),"MXN")}</strong> en {ventas.length} operación{ventas.length!==1?"es":""}</div>}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{padding:"14px 20px",borderTop:"1px solid #1a1a2e",display:"flex",justifyContent:"space-between",flexShrink:0}}>
            {!isNew ? <button style={{...S.btn("danger"),fontSize:11}} onClick={()=>delP(tab,form.id)}>Eliminar</button> : <div/>}
            <div style={{display:"flex",gap:8}}>
              <button style={S.btn("secondary")} onClick={()=>setModal(null)}>Cancelar</button>
              <button style={{...S.btn("primary",color)}} onClick={handleSave}>💾 Guardar</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── TAREA MODAL ───────────────────────────────────────────────────────────
  const TareaModal = () => {
    const preProspect = modal.prospectId||"";
    const preNombre   = preProspect ? (allP.find(p=>p.id===preProspect)?.nombre||"") : "";
    const [form,setForm]=useState(()=>modal.tarea?{...modal.tarea}:{id:uid(),titulo:"",prospectId:preProspect,prioridad:"Media",fecha:today(),hora:"",tipoTarea:"llamada",estado:"pendiente",notas:""});
    const [buscaP,  setBuscaP]  = useState(preNombre);
    const [showList,setShowList]= useState(false);
    const prospectFiltrado = buscaP.length>1 ? allP.filter(p=>p.nombre&&p.nombre.toLowerCase().includes(buscaP.toLowerCase())).slice(0,8) : [];
    const prospectSel = allP.find(p=>p.id===form.prospectId);
    return (
      <div style={S.modal} onClick={e=>{if(e.target===e.currentTarget)setModal(null)}}>
        <div style={{...S.mbox,maxWidth:500}}>
          <div style={{padding:"16px 20px",borderBottom:"1px solid #1a1a2e",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
            <div style={{fontWeight:800,color:"#fff",fontSize:15}}>{modal.tarea?"Editar tarea":"Nueva tarea"}</div>
            <button style={S.btn("ghost")} onClick={()=>setModal(null)}>✕</button>
          </div>
          <div style={{padding:20,display:"flex",flexDirection:"column",gap:14,overflow:"auto",flex:1}}>
            {/* Tipo de tarea */}
            <div>
              <label style={S.lbl}>Tipo de tarea</label>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {TASK_TYPES.map(tt=>(
                  <button key={tt.id} style={{...S.btn(form.tipoTarea===tt.id?"primary":"secondary",form.tipoTarea===tt.id?"#6366f1":undefined),padding:"6px 12px",fontSize:11}} onClick={()=>setForm(f=>({...f,tipoTarea:tt.id}))}>
                    {tt.icon} {tt.label}
                  </button>
                ))}
              </div>
            </div>
            <div><label style={S.lbl}>Título*</label><input style={S.inp} value={form.titulo} onChange={e=>setForm(f=>({...f,titulo:e.target.value}))} placeholder="¿Qué hay que hacer?"/></div>
            <div style={S.g2}>
              <div><label style={S.lbl}>Prioridad</label>
                <select style={S.inp} value={form.prioridad} onChange={e=>setForm(f=>({...f,prioridad:e.target.value}))}><option>Alta</option><option>Media</option><option>Baja</option></select>
              </div>
              <div><label style={S.lbl}>Fecha</label><input type="date" style={S.inp} value={form.fecha} onChange={e=>setForm(f=>({...f,fecha:e.target.value}))}/></div>
            </div>
            <div><label style={S.lbl}>Hora (opcional)</label><input type="time" style={S.inp} value={form.hora||""} onChange={e=>setForm(f=>({...f,hora:e.target.value}))}/></div>

            {/* Vincular a contacto — autocomplete search */}
            <div style={{position:"relative"}}>
              <label style={S.lbl}>Vincular a contacto (opcional)</label>
              {prospectSel ? (
                <div style={{display:"flex",gap:8,alignItems:"center",background:"#0d0d1a",border:"1px solid #6366f133",borderRadius:8,padding:"8px 12px"}}>
                  <span style={S.bdg(TM[prospectSel._tab]?.color||"#6366f1")}>{TM[prospectSel._tab]?.icon} {prospectSel.nombre}</span>
                  <button style={{...S.btn("ghost"),padding:"2px 8px",fontSize:11,marginLeft:"auto"}} onClick={()=>{setForm(f=>({...f,prospectId:""}));setBuscaP("");}}>✕ Quitar</button>
                </div>
              ) : (
                <>
                  <input style={S.inp} value={buscaP} onChange={e=>{setBuscaP(e.target.value);setShowList(true);}} onFocus={()=>setShowList(true)} placeholder="Buscar por nombre..." autoComplete="off"/>
                  {showList&&prospectFiltrado.length>0&&(
                    <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:50,background:"#0d0d1a",border:"1px solid #1a1a2e",borderRadius:8,marginTop:4,maxHeight:200,overflow:"auto",boxShadow:"0 8px 24px rgba(0,0,0,.6)"}}>
                      {prospectFiltrado.map(p=>(
                        <div key={p.id} style={{padding:"10px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,borderBottom:"1px solid #14142a"}} onMouseEnter={e=>e.currentTarget.style.background="#14142a"} onMouseLeave={e=>e.currentTarget.style.background="transparent"} onClick={()=>{setForm(f=>({...f,prospectId:p.id}));setBuscaP(p.nombre||"");setShowList(false);}}>
                          <span style={S.bdg(TM[p._tab]?.color||"#6366f1")}>{TM[p._tab]?.icon}</span>
                          <div><div style={{fontSize:13,color:"#fff"}}>{p.nombre}</div><div style={{fontSize:10,color:"#374151"}}>{p.telefono||p.correo||""}</div></div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
              {form.prospectId&&<div style={{fontSize:10,color:"#10b981",marginTop:4}}>✅ Se registrará en el historial del contacto automáticamente</div>}
            </div>

            <div><label style={S.lbl}>Notas</label><textarea style={{...S.inp,minHeight:60,resize:"vertical"}} value={form.notas} onChange={e=>setForm(f=>({...f,notas:e.target.value}))}/></div>
          </div>
          <div style={{padding:"14px 20px",borderTop:"1px solid #1a1a2e",display:"flex",justifyContent:"flex-end",gap:8,flexShrink:0}}>
            <button style={S.btn("secondary")} onClick={()=>setModal(null)}>Cancelar</button>
            <button style={S.btn("primary")} onClick={()=>saveTarea(form)}>💾 Guardar</button>
          </div>
        </div>
      </div>
    );
  };

  // ── ACTIVIDAD MODAL ───────────────────────────────────────────────────────
  const ActividadModal = () => {
    const preProspect = modal.pre?.prospect_id||"";
    const preNombre   = modal.pre?.prospectNombre||"";
    const [form,setForm]=useState({tipo:modal.pre?.tipo||"llamada",cantidad:1,notas:"",fecha:today(),prospect_id:preProspect});
    const [buscaP, setBuscaP]=useState(preNombre);
    const [showList, setShowList]=useState(false);
    const prospectFiltrado = buscaP.length>1 ? allP.filter(p=>p.nombre&&p.nombre.toLowerCase().includes(buscaP.toLowerCase())).slice(0,8) : [];
    const prospectSel = allP.find(p=>p.id===form.prospect_id);
    return (
      <div style={S.modal} onClick={e=>{if(e.target===e.currentTarget)setModal(null)}}>
        <div style={{...S.mbox,maxWidth:440}}>
          <div style={{padding:"16px 20px",borderBottom:"1px solid #1a1a2e",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
            <div style={{fontWeight:800,color:"#fff",fontSize:15}}>⚡ Registrar actividad</div>
            <button style={S.btn("ghost")} onClick={()=>setModal(null)}>✕</button>
          </div>
          <div style={{padding:20,display:"flex",flexDirection:"column",gap:14,overflow:"auto",flex:1}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
              {ACT_TYPES.map(a=>(
                <button key={a.id} style={{...S.btn(form.tipo===a.id?"primary":"secondary",form.tipo===a.id?"#6366f1":undefined),padding:"12px 0",display:"flex",flexDirection:"column",alignItems:"center",gap:4}} onClick={()=>setForm(f=>({...f,tipo:a.id}))}>
                  <span style={{fontSize:22}}>{a.icon}</span>
                  <span style={{fontSize:10}}>{a.label}</span>
                </button>
              ))}
            </div>
            <div style={S.g2}>
              <div><label style={S.lbl}>Cantidad</label><input type="number" min="1" style={S.inp} value={form.cantidad} onChange={e=>setForm(f=>({...f,cantidad:e.target.value}))}/></div>
              <div><label style={S.lbl}>Fecha</label><input type="date" style={S.inp} value={form.fecha} onChange={e=>setForm(f=>({...f,fecha:e.target.value}))}/></div>
            </div>
            <div><label style={S.lbl}>Notas (opcional)</label><input style={S.inp} value={form.notas} onChange={e=>setForm(f=>({...f,notas:e.target.value}))} placeholder="Ej. Llamé a 3 prospectos..."/></div>

            {/* Vincular a contacto */}
            <div style={{position:"relative"}}>
              <label style={S.lbl}>Vincular a contacto (opcional)</label>
              {prospectSel ? (
                <div style={{display:"flex",gap:8,alignItems:"center",background:"#0d0d1a",border:"1px solid #6366f133",borderRadius:8,padding:"8px 12px"}}>
                  <span style={S.bdg(TM[prospectSel._tab]?.color||"#6366f1")}>{TM[prospectSel._tab]?.icon} {prospectSel.nombre}</span>
                  <button style={{...S.btn("ghost"),padding:"2px 8px",fontSize:11,marginLeft:"auto"}} onClick={()=>{setForm(f=>({...f,prospect_id:""}));setBuscaP("");}}>✕ Quitar</button>
                </div>
              ) : (
                <>
                  <input style={S.inp} value={buscaP} onChange={e=>{setBuscaP(e.target.value);setShowList(true);}} onFocus={()=>setShowList(true)} placeholder="Buscar por nombre..."/>
                  {showList&&prospectFiltrado.length>0&&(
                    <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:50,background:"#0d0d1a",border:"1px solid #1a1a2e",borderRadius:8,marginTop:4,maxHeight:200,overflow:"auto",boxShadow:"0 8px 24px rgba(0,0,0,.6)"}}>
                      {prospectFiltrado.map(p=>(
                        <div key={p.id} style={{padding:"10px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,borderBottom:"1px solid #14142a"}} onMouseEnter={e=>e.currentTarget.style.background="#14142a"} onMouseLeave={e=>e.currentTarget.style.background="transparent"} onClick={()=>{setForm(f=>({...f,prospect_id:p.id}));setBuscaP(p.nombre||"");setShowList(false);}}>
                          <span style={S.bdg(TM[p._tab]?.color||"#6366f1")}>{TM[p._tab]?.icon}</span>
                          <div><div style={{fontSize:13,color:"#fff"}}>{p.nombre}</div><div style={{fontSize:10,color:"#374151"}}>{p.telefono||p.correo||""}</div></div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
              {form.prospect_id&&<div style={{fontSize:10,color:"#10b981",marginTop:4}}>✅ Se registrará en el historial del contacto automáticamente</div>}
            </div>
          </div>
          <div style={{padding:"14px 20px",borderTop:"1px solid #1a1a2e",display:"flex",justifyContent:"flex-end",gap:8,flexShrink:0}}>
            <button style={S.btn("secondary")} onClick={()=>setModal(null)}>Cancelar</button>
            <button style={S.btn("primary")} onClick={()=>addAct(form)}>✅ Registrar</button>
          </div>
        </div>
      </div>
    );
  };

  // ── NAV ────────────────────────────────────────────────────────────────────
  const NAV = [
    { s:"General", items:[
      { id:"dashboard",    icon:"📊", label:"Dashboard" },
      { id:"kanban",       icon:"🗂️", label:"Pipeline Kanban" },
      { id:"modo-vendedor",icon:"🚀", label:"Modo Vendedor" },
      { id:"ranking",      icon:"🏆", label:"Ranking" },
    ]},
    { s:"Listas", items:LIST_TABS.map(t=>({ id:t, icon:TM[t].icon, label:TM[t].label, color:TM[t].color, cnt:displayPros[t].length })) },
    { s:"Productividad", items:[
      { id:"tareas",       icon:"✅", label:"Tareas",       cnt:stats.tarHoy.length, cc:"#ef4444" },
      { id:"agenda",       icon:"📅", label:"Agenda" },
      { id:"productividad",icon:"⚡", label:"Productividad" },
    ]},
    ...(isAdmin ? [{ s:"Informes", items:[
      { id:"reporte",icon:"📋", label:"Reporte Socios" },
      { id:"config", icon:"⚙️", label:"Configuración" },
    ]}] : []),
    { s:"Herramientas", items:[
      { id:"smartsales",    icon:"🚀", label:"Smart Sales" },
      { id:"tutoriales",    icon:"❓", label:"Ayuda" },
    ]},
  ];

  const curNav  = NAV.flatMap(s=>s.items).find(i=>i.id===view)||{icon:"",label:""};
  const isListV = LIST_TABS.includes(view);

  return (
    <div style={S.app}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;800;900&display=swap" rel="stylesheet"/>

      {/* Sidebar */}
      <div style={S.side}>
        <div style={S.logo}>
          <div style={{fontSize:9,color:"#6366f1",fontWeight:700,letterSpacing:3,textTransform:"uppercase"}}>VENTAS INMOBILIARIAS</div>
          <div style={{fontSize:19,fontWeight:900,color:"#fff",letterSpacing:-.5}}>NATIVE MASTER BROKER</div>
          <div style={{fontSize:9,color:"#4b5563",marginTop:1}}>CRM · Comercial Interno</div>
          <div style={{marginTop:10,display:"flex",gap:6}}>
            <span style={S.bdg(isAdmin?"#6366f1":"#374151")}>{isAdmin?"admin":"asesor"}</span>
            <button style={{...S.btn("secondary"),padding:"4px 10px",fontSize:10}} onClick={async()=>{ const { supabase }=await import("./supabaseClient"); await supabase.auth.signOut(); }}>Salir</button>
          </div>
        </div>
        <div style={{flex:1,overflow:"auto",paddingTop:8}}>

          {/* ── Notificaciones (siempre arriba) ── */}
          <div style={{padding:"6px 10px 2px"}}>
            <div style={S.nav(view==="notificaciones","#6366f1")} onClick={()=>setView("notificaciones")}>
              <span style={{fontSize:13}}>🔔</span>
              <span style={{flex:1}}>Notificaciones</span>
              {notifUnread>0&&<span style={{fontSize:9,fontWeight:700,color:"#ef4444",background:"#07070f",borderRadius:8,padding:"1px 6px",minWidth:16,textAlign:"center"}}>{notifUnread}</span>}
            </div>
          </div>

          {/* ── ViewAs selector (solo admin) ── */}
          {isAdmin&&(
            <div style={{margin:"8px 10px 4px",background:"#07070f",border:"1px solid #1a1a2e",borderRadius:10,padding:"10px 12px"}}>
              <div style={{fontSize:9,fontWeight:700,letterSpacing:1.5,color:"#4a5468",textTransform:"uppercase",marginBottom:6}}>👁 Viendo como</div>
              <select
                value={viewAs}
                onChange={e=>setViewAs(e.target.value)}
                style={{width:"100%",background:"#0d0d1a",border:"1px solid #1a1a2e",borderRadius:7,padding:"7px 10px",color:viewAs==="all"?"#6b7280":"#818cf8",fontSize:12,fontWeight:viewAs==="all"?400:700,outline:"none",cursor:"pointer",fontFamily:"inherit"}}
              >
                <option value="all">— Todo el equipo —</option>
                {profiles.map(p=>(
                  <option key={p.user_id} value={p.user_id}>{p.full_name}{p.role==="admin"?" (Admin)":""}</option>
                ))}
              </select>
              {viewAs!=="all"&&(
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:6}}>
                  <span style={{fontSize:10,color:"#6366f1"}}>● Filtro activo</span>
                  <button onClick={()=>setViewAs("all")} style={{fontSize:10,color:"#4a5468",background:"transparent",border:"none",cursor:"pointer",padding:0,textDecoration:"underline"}}>Quitar</button>
                </div>
              )}
            </div>
          )}

          {NAV.map(sec=>(
            <div key={sec.s} style={{paddingTop:10}}>
              <div style={{fontSize:9,fontWeight:700,letterSpacing:2,color:"#1a1a2e",padding:"0 18px 6px",textTransform:"uppercase"}}>{sec.s}</div>
              {sec.items.map(item=>(
                <div key={item.id} style={S.nav(view===item.id,item.color||"#6366f1")} onClick={()=>setView(item.id)}>
                  <span style={{fontSize:13}}>{item.icon}</span>
                  <span style={{flex:1}}>{item.label}</span>
                  {item.cnt>0&&<span style={{fontSize:9,fontWeight:700,color:item.cc||item.color||"#6366f1",background:"#07070f",borderRadius:8,padding:"1px 6px",minWidth:16,textAlign:"center"}}>{item.cnt}</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{padding:"10px 18px",borderTop:"1px solid #14142a"}}>
          <div style={{fontSize:9,color:saving?"#6366f1":"#14142a",fontWeight:700,transition:"color .3s"}}>{saving?"💾 Guardando...":"● Auto-guardado activo"}</div>
        </div>
      </div>

      {/* Main */}
      <div style={S.main}>
        <div style={S.topbar}>
          <div>
            <div style={{fontSize:17,fontWeight:900,color:"#fff",letterSpacing:-.5}}>{curNav.icon} {curNav.label}</div>
            {isListV&&<div style={{fontSize:10,color:"#374151",marginTop:1}}>{displayPros[view]?.length||0} registros · {displayPros[view]?.filter(p=>isClosed(p,view)).length||0} cerrados · {displayPros[view]?.filter(p=>calcTemp(p,view,displayTareas).e==="🔥").length||0} 🔥 calientes</div>}
          </div>
          <div style={{display:"flex",gap:8}}>
            {isListV&&<button style={{...S.btn("primary",TM[view]?.color),padding:"7px 16px"}} onClick={()=>setModal({type:"prospect",tab:view,person:null})}>+ Agregar</button>}
            {view==="tareas"&&<button style={S.btn("primary")} onClick={()=>setModal({type:"tarea"})}>+ Nueva tarea</button>}
            {view==="productividad"&&<button style={S.btn("primary")} onClick={()=>setModal({type:"actividad"})}>+ Actividad</button>}
          </div>
        </div>
        <div style={S.page}>
          {view==="dashboard"    && <Dashboard/>}
          {view==="kanban"       && <Kanban/>}
          {isListV               && <ListView tab={view}/>}
          {view==="tareas"       && <Tareas/>}
          {view==="agenda"       && <Agenda/>}
          {view==="productividad"&& <Productividad/>}
          {view==="modo-vendedor"&& <ModoVendedor/>}
          {view==="ranking"      && <Ranking/>}
          {view==="tutoriales"   && <Tutoriales/>}
          {view==="reporte"      && (isAdmin ? <ReporteAdmin/> : <div style={{color:"#fff"}}>Sin acceso</div>)}
          {view==="config"       && (isAdmin ? <Config/> : <div style={{color:"#fff"}}>Sin acceso</div>)}
          {view==="smartsales"   && <SmartSalesPanel userId={user?.id} userName={user?.user_metadata?.full_name}/>}
          {view==="notificaciones"&&<NotificationsPanel user_id={user?.id} role={role} profiles={profiles} appCfg={cfg} onUnreadCountChange={setNotifUnread}/>}
        </div>
      </div>

      {modal?.type==="prospect"  && <ProspectModal/>}
      {modal?.type==="tarea"     && <TareaModal/>}
      {modal?.type==="actividad" && <ActividadModal/>}

      {toast&&(
        <div style={{position:"fixed",bottom:20,right:20,background:toast.ok?"#10b981":"#dc2626",color:"#fff",padding:"11px 20px",borderRadius:10,fontSize:13,fontWeight:700,zIndex:300,boxShadow:"0 8px 32px rgba(0,0,0,.5)",transition:"all .3s"}}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
