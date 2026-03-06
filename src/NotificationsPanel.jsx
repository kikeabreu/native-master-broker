import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "./supabaseClient";

// ── UTILS ─────────────────────────────────────────────────────────────────────
function timeAgo(ts) {
    const s = Math.floor((Date.now() - new Date(ts)) / 1000);
    if (s < 60) return "Hace un momento";
    if (s < 3600) return `Hace ${Math.floor(s / 60)} min`;
    if (s < 86400) return `Hace ${Math.floor(s / 3600)}h`;
    return `Hace ${Math.floor(s / 86400)} días`;
}
function todayStr() { return new Date().toISOString().split("T")[0]; }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split("T")[0]; }
function monthStart() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`; }

// ── BROWSER NOTIFICATIONS ─────────────────────────────────────────────────────
export async function requestNotifPermission() {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    const p = await Notification.requestPermission();
    return p === "granted";
}
export function showBrowserNotif(title, body) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    try { new Notification(title, { body, icon: "/favicon.ico", tag: "crm-notif-" + Date.now() }); }
    catch(e) { /* iframes can block */ }
}

// ── STYLES ────────────────────────────────────────────────────────────────────
const S2="#0d0d1a"; const S3="#141b24"; const BD="1px solid #14142a";
const TX="#e8ecf4"; const TX2="#8892a4"; const TX3="#4a5468";
const TIPO={
    urgente:    {color:"#f05060",bg:"rgba(240,80,96,.10)",  ib:"rgba(240,80,96,.15)",  lbl:"URGENTE"},
    alerta:     {color:"#f0c060",bg:"rgba(240,192,96,.08)", ib:"rgba(240,192,96,.15)",  lbl:"ALERTA"},
    info:       {color:"#5090f0",bg:"rgba(80,144,240,.08)", ib:"rgba(80,144,240,.15)",  lbl:"INFO"},
    logro:      {color:"#3dd9c0",bg:"rgba(61,217,192,.08)", ib:"rgba(61,217,192,.15)",  lbl:"LOGRO"},
    oportunidad:{color:"#a78bfa",bg:"rgba(167,139,250,.08)",ib:"rgba(167,139,250,.15)", lbl:"OPORTUNIDAD"},
    motivacion: {color:"#f59e0b",bg:"rgba(245,158,11,.08)", ib:"rgba(245,158,11,.15)",  lbl:"HOY"},
    manual:     {color:"#6366f1",bg:"rgba(99,102,241,.08)", ib:"rgba(99,102,241,.15)",  lbl:"MENSAJE"},
};
const ACT_ICONS  = {llamada:"📞",whatsapp:"💬",email:"📧",propuesta:"📄",reunion:"🤝",seguimiento:"🔄"};
const ACT_LABELS = {llamada:"Llamadas",whatsapp:"WhatsApp",email:"Emails",propuesta:"Propuestas",reunion:"Reuniones",seguimiento:"Seguimientos"};

// ── TODAY PANEL ───────────────────────────────────────────────────────────────
function TodayPanel({ user_id }) {
    const [d, setD] = useState(null);
    useEffect(() => {
        if (!user_id) return;
        (async () => {
            const today = todayStr();
            const [{ data: acts },{ data: tasks },{ data: pros }] = await Promise.all([
                supabase.from("activities").select("tipo,cantidad").eq("owner_id",user_id).eq("fecha",today),
                supabase.from("tasks").select("id,estado").eq("owner_id",user_id).eq("fecha",today),
                supabase.from("prospects").select("id").eq("owner_id",user_id).gte("updated_at",today+"T00:00:00"),
            ]);
            const total = (acts||[]).reduce((s,a)=>s+(Number(a.cantidad)||1),0);
            const byType = {};
            (acts||[]).forEach(a=>{byType[a.tipo]=(byType[a.tipo]||0)+(Number(a.cantidad)||1);});
            setD({
                total, byType,
                tareasPend: (tasks||[]).filter(t=>t.estado==="pendiente").length,
                tareasOk:   (tasks||[]).filter(t=>t.estado==="completada").length,
                prosAct:    (pros||[]).length,
                fecha: new Date().toLocaleDateString("es-MX",{weekday:"long",day:"numeric",month:"long"}),
            });
        })();
    }, [user_id]);
    if (!d) return null;

    return (
        <div style={{background:"linear-gradient(135deg,#0f0f2a,#1a1a3e)",border:"1px solid #6366f133",borderRadius:14,padding:20,marginBottom:20}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                <div>
                    <div style={{fontSize:10,color:"#6366f1",fontWeight:700,letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>📅 Tu día hoy</div>
                    <div style={{fontSize:17,fontWeight:900,color:TX,textTransform:"capitalize"}}>{d.fecha}</div>
                </div>
                <div style={{textAlign:"right"}}>
                    <div style={{fontSize:38,fontWeight:900,color:d.total>0?"#6366f1":"#2a2a4a",lineHeight:1}}>{d.total}</div>
                    <div style={{fontSize:10,color:TX3,marginTop:2}}>actividades hoy</div>
                </div>
            </div>

            {/* Desglose por tipo */}
            {d.total>0 && (
                <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
                    {Object.entries(d.byType).map(([tipo,cnt])=>(
                        <div key={tipo} style={{background:"rgba(99,102,241,.13)",border:"1px solid #6366f133",borderRadius:8,padding:"6px 12px",display:"flex",alignItems:"center",gap:6}}>
                            <span style={{fontSize:15}}>{ACT_ICONS[tipo]||"⚡"}</span>
                            <span style={{fontWeight:800,color:TX,fontSize:14}}>{cnt}</span>
                            <span style={{fontSize:10,color:TX3}}>{ACT_LABELS[tipo]||tipo}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* KPIs del día */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                {[
                    {icon:"✅",lbl:"Tareas completadas hoy",val:d.tareasOk,  color:"#10b981"},
                    {icon:"⏳",lbl:"Tareas pendientes hoy", val:d.tareasPend, color:d.tareasPend>0?"#f59e0b":"#374151"},
                    {icon:"👥",lbl:"Prospectos actualizados",val:d.prosAct,   color:"#3b82f6"},
                ].map(k=>(
                    <div key={k.lbl} style={{background:"rgba(0,0,0,.3)",borderRadius:8,padding:"10px 12px"}}>
                        <div style={{fontSize:10,color:TX3,marginBottom:4}}>{k.icon} {k.lbl}</div>
                        <div style={{fontSize:22,fontWeight:900,color:k.color}}>{k.val}</div>
                    </div>
                ))}
            </div>

            {d.total===0&&(
                <div style={{marginTop:14,padding:"10px 14px",background:"rgba(239,68,68,.08)",border:"1px solid #ef444433",borderRadius:8,fontSize:12,color:"#fca5a5"}}>
                    🚨 Sin actividades aún hoy — registrar una toma menos de 30 segundos.
                </div>
            )}
        </div>
    );
}

// ── NOTIF CARD ────────────────────────────────────────────────────────────────
function NotifCard({ notif, onRead }) {
    const tc = TIPO[notif.tipo] || TIPO.info;
    const isAuto = typeof notif.id==="string" && notif.id.startsWith("auto_");
    return (
        <div style={{background:notif.leida?S2:tc.bg,border:`1px solid ${notif.leida?"#14142a":tc.color+"33"}`,borderRadius:12,padding:16,display:"flex",gap:12,transition:"all .2s",position:"relative"}}>
            {!notif.leida&&!isAuto&&<div style={{position:"absolute",top:12,right:12,width:8,height:8,borderRadius:"50%",background:tc.color,boxShadow:`0 0 8px ${tc.color}`}}/>}
            <div style={{width:40,height:40,borderRadius:10,background:tc.ib,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{notif.icono||"📬"}</div>
            <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                    <span style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:4,background:tc.color+"22",color:tc.color,letterSpacing:1}}>{tc.lbl}</span>
                    <span style={{fontSize:11,color:TX3}}>{notif.ts?timeAgo(notif.ts):""}</span>
                    {notif.fromName&&<span style={{fontSize:11,color:TX3}}>· de {notif.fromName}</span>}
                    {isAuto&&<span style={{fontSize:9,color:TX3,background:"#14142a",padding:"1px 5px",borderRadius:4}}>AUTO</span>}
                </div>
                <div style={{fontSize:13,fontWeight:700,color:TX,marginBottom:4}}>{notif.titulo}</div>
                <div style={{fontSize:13,color:TX2,lineHeight:1.6}}>{notif.texto}</div>
                {!notif.leida&&!isAuto&&notif.id&&(
                    <button onClick={()=>onRead(notif.id)} style={{marginTop:8,fontSize:11,color:"#818cf8",background:"transparent",border:"1px solid #6366f133",borderRadius:6,cursor:"pointer",padding:"4px 10px",fontWeight:600}}>
                        ✓ Marcar como leída
                    </button>
                )}
            </div>
        </div>
    );
}

// ── AUTO-NOTIFICATIONS (CRM-based, sin Smart Sales) ───────────────────────────
async function generateAutoNotifications(user_id, appCfg={}) {
    const today    = todayStr();
    const hora     = new Date().getHours();
    const friosDias = Number(appCfg.prospectosFriosDias) || 7;
    const propDias  = Number(appCfg.propuestaDias)       || 5;
    const msgs = [];

    try {
        const [
            {data:actsHoy},
            {data:actsStreak},
            {data:tareasVenc},
            {data:prosFrios},
            {data:prosAll},
            {data:rankingRows},
            {data:goals},
        ] = await Promise.all([
            supabase.from("activities").select("tipo,cantidad").eq("owner_id",user_id).eq("fecha",today),
            supabase.from("activities").select("fecha").eq("owner_id",user_id).gte("fecha",daysAgo(30)).order("fecha",{ascending:false}),
            supabase.from("tasks").select("id,titulo,fecha").eq("owner_id",user_id).eq("estado","pendiente").lt("fecha",today).limit(10),
            supabase.from("prospects").select("id,data,updated_at").eq("owner_id",user_id).eq("perdido",false).lt("updated_at",daysAgo(friosDias)+"T23:59:59").limit(30),
            supabase.from("prospects").select("id,data,stages,updated_at").eq("owner_id",user_id).eq("perdido",false),
            supabase.rpc("get_ranking").limit(50),
            supabase.from("goals").select("*").eq("user_id",user_id).eq("periodo",today.slice(0,7)),
        ]);

        const totalHoy = (actsHoy||[]).reduce((s,a)=>s+(Number(a.cantidad)||1),0);
        const metaDia  = Number((goals||[]).find(g=>g.categoria==="actividades")?.meta)||0;

        // 1. Motivacional mañana / resumen tarde
        if (hora<12 && totalHoy===0) {
            const frases=["El top seller no tuvo suerte — tuvo disciplina. Hoy empieza la tuya.","Cada llamada que no hagas hoy es una comisión que alguien más va a cobrar.","Un prospecto registrado hoy = comisión cocinándose. ¿Cuántos pones hoy?","Los grandes meses se construyen con grandes mañanas. ¿Arrancamos?","El pipeline no se llena solo. Hoy es un buen día."];
            msgs.push({id:"auto_morning",tipo:"motivacion",icono:"🌟",titulo:"¡Buenos días, a darle!",texto:frases[new Date().getDate()%frases.length],ts:new Date().toISOString()});
        }
        if (hora>=17 && totalHoy>0) {
            const txt = metaDia>0
                ? `Registraste ${totalHoy} actividades hoy vs tu meta de ${metaDia}. ${totalHoy>=metaDia?"¡Meta cumplida! 🔥":`Faltan ${metaDia-totalHoy} para llegar.`}`
                : `Registraste ${totalHoy} actividades hoy. ¡Sigue así!`;
            msgs.push({id:"auto_tarde",tipo:"info",icono:"📊",titulo:"Resumen de tu día",texto:txt,ts:new Date().toISOString()});
        }

        // 2. Meta del día (mediodía)
        if (metaDia>0 && hora>=14 && hora<17) {
            const pct = Math.min(Math.round((totalHoy/metaDia)*100),100);
            if (pct===0) msgs.push({id:"auto_meta_dia_0",tipo:"urgente",icono:"🚨",titulo:`¡0 de ${metaDia} actividades!`,texto:`Son las ${hora}:00 y aún no registras actividad. Tu meta es ${metaDia}. ¡El tiempo corre!`,ts:new Date().toISOString()});
            else if (pct<50) msgs.push({id:"auto_meta_dia_low",tipo:"alerta",icono:"⚠️",titulo:`Solo ${pct}% de tu meta de hoy`,texto:`Llevas ${totalHoy} de ${metaDia} actividades. Son las ${hora}:00 — aún puedes cerrar fuerte.`,ts:new Date().toISOString()});
            else if (pct>=100) msgs.push({id:"auto_meta_dia_ok",tipo:"logro",icono:"🔥",titulo:"¡Meta de actividades del día cumplida!",texto:`Completaste tus ${metaDia} actividades del día. Cada extra es una oportunidad más.`,ts:new Date().toISOString()});
        }

        // 3. Tareas vencidas
        const numVenc = (tareasVenc||[]).length;
        if (numVenc>0) {
            const ejs = (tareasVenc||[]).slice(0,3).map(t=>`"${t.titulo}"`).join(", ");
            msgs.push({id:"auto_tareas_venc",tipo:numVenc>=3?"urgente":"alerta",icono:"⏰",titulo:`${numVenc} tarea${numVenc!==1?"s":""} vencida${numVenc!==1?"s":""} sin atender`,texto:`Tienes ${numVenc} tarea${numVenc!==1?"s":""} con fecha pasada: ${ejs}${numVenc>3?` y ${numVenc-3} más`:""}. Cada día que pasa = prospecto más frío.`,ts:new Date().toISOString()});
        }

        // 4. Prospectos fríos
        const numFrios = (prosFrios||[]).length;
        if (numFrios>0) {
            const ejs = (prosFrios||[]).slice(0,2).map(p=>p.data?.nombre||"Sin nombre").join(", ");
            msgs.push({id:"auto_pros_frios",tipo:numFrios>=5?"urgente":"alerta",icono:"🧊",titulo:`${numFrios} prospecto${numFrios!==1?"s":""} frío${numFrios!==1?"s":""} (+${friosDias} días sin actividad)`,texto:`${ejs}${numFrios>2?` y ${numFrios-2} más`:""} no tienen actividad en ${friosDias}+ días. Un WhatsApp hoy puede reactivarlos.`,ts:new Date().toISOString()});
        }

        // 5. Propuestas sin respuesta
        const propsSinResp = (prosAll||[]).filter(p=>{
            const st=p.stages||{};
            const tieneProp=Object.keys(st).some(k=>k.toLowerCase().includes("propuesta")&&st[k]);
            const tienePago=Object.keys(st).some(k=>(k.toLowerCase().includes("pago")||k.toLowerCase().includes("hizo ventas"))&&st[k]);
            if (!tieneProp||tienePago) return false;
            return Math.floor((Date.now()-new Date(p.updated_at))/86400000)>=propDias;
        });
        if (propsSinResp.length>0) {
            const ejs=propsSinResp.slice(0,2).map(p=>p.data?.nombre||"Sin nombre").join(", ");
            const maxDias=Math.max(...propsSinResp.map(p=>Math.floor((Date.now()-new Date(p.updated_at))/86400000)));
            msgs.push({id:"auto_propuestas",tipo:"alerta",icono:"📄",titulo:`${propsSinResp.length} propuesta${propsSinResp.length!==1?"s":""} sin respuesta (hasta ${maxDias} días)`,texto:`${ejs}${propsSinResp.length>2?` y ${propsSinResp.length-2} más`:""} tienen propuesta enviada sin avance. El seguimiento post-propuesta determina si cierras o pierdes.`,ts:new Date().toISOString()});
        }

        // 6. Racha de actividad
        const fechas=new Set((actsStreak||[]).map(a=>(a.fecha||"").slice(0,10)));
        let racha=0; let checkD=new Date();
        if (!fechas.has(today)) checkD.setDate(checkD.getDate()-1);
        for (let i=0;i<30;i++) {
            const d=checkD.toISOString().split("T")[0];
            if (fechas.has(d)){racha++;checkD.setDate(checkD.getDate()-1);}else break;
        }
        if (racha>=3) {
            const em=racha>=10?"🔥🔥🔥":racha>=7?"🔥🔥":"🔥";
            msgs.push({id:"auto_racha",tipo:"logro",icono:"🔥",titulo:`¡Racha de ${racha} días consecutivos! ${em}`,texto:racha>=7?`¡${racha} días de actividad seguidos! Eso es lo que separa a los top performers. El equipo te está viendo.`:`Llevas ${racha} días consecutivos con actividad. ¡No rompas la racha!`,ts:new Date().toISOString()});
        } else if (racha===0 && hora>=10) {
            msgs.push({id:"auto_sin_racha",tipo:"info",icono:"⚡",titulo:"Registra actividad hoy y empieza tu racha",texto:"Los mejores asesores tienen algo en común: registran algo todos los días, aunque sea una llamada. ¿Empezamos?",ts:new Date().toISOString()});
        }

        // 7. Ranking vs compañero cercano
        if (rankingRows&&rankingRows.length>0) {
            const sorted=[...rankingRows].sort((a,b)=>(b.actividades_total||0)-(a.actividades_total||0));
            const myIdx=sorted.findIndex(r=>r.user_id===user_id);
            if (myIdx>=0) {
                const me=sorted[myIdx]; const pos=myIdx+1; const total=sorted.length;
                const above=myIdx>0?sorted[myIdx-1]:null; const below=sorted[myIdx+1];
                if (pos===1) {
                    msgs.push({id:"auto_rank_1",tipo:"logro",icono:"🥇",titulo:"¡Vas PRIMERO en el ranking de actividades!",texto:`Eres #1 de ${total} asesores.${below?` ${below.full_name||"Alguien"} está a ${(me.actividades_total||0)-(below.actividades_total||0)} actividades de alcanzarte.`:" ¡Sigue dominando!"}`,ts:new Date().toISOString()});
                } else if (above) {
                    const diff=(above.actividades_total||0)-(me.actividades_total||0);
                    msgs.push({id:"auto_rank_pos",tipo:diff<=5?"oportunidad":"info",icono:pos<=3?"🥈":"📈",titulo:diff<=5?`¡A solo ${diff} actividad${diff!==1?"es":""} del puesto #${pos-1}!`:`Puesto #${pos} de ${total} en actividades`,texto:diff<=5?`${above.full_name||"Tu compañero"} lleva ${above.actividades_total} y tú ${me.actividades_total||0}. ¡${diff} actividades más y lo superas!`:`${above.full_name||"Tu compañero"} en #${pos-1} lleva ${above.actividades_total} actividades. Diferencia: ${diff}.`,ts:new Date().toISOString()});
                }
            }
        }

    } catch(e) { console.error("generateAutoNotifications error:",e); }
    return msgs;
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function NotificationsPanel({ user_id, role, profiles=[], onUnreadCountChange, appCfg={} }) {
    const [autoNotifs,   setAuto]   = useState([]);
    const [manualNotifs, setManual] = useState([]);
    const [loading,      setLoad]   = useState(true);
    const [filter,       setFilter] = useState("all");
    const [showCompose,  setCompose]= useState(false);
    const [cDest,  setCDest] = useState("all");
    const [cTipo,  setCTipo] = useState("manual");
    const [cTitulo,setCTit]  = useState("");
    const [cTexto, setCTxt]  = useState("");
    const [cSaving,setCSav]  = useState(false);
    const [toast,  setToast] = useState(null);

    const toast_=(msg,ok=true)=>{setToast({msg,ok});setTimeout(()=>setToast(null),2500);};

    // Pedir permiso navegador la primera vez
    useEffect(()=>{
        if ("Notification" in window && Notification.permission==="default") {
            setTimeout(()=>requestNotifPermission(),2000);
        }
    },[]);

    const loadAll = useCallback(async()=>{
        if (!user_id) return;
        setLoad(true);
        try {
            const [{data:manuales}, autoGens] = await Promise.all([
                supabase.from("notifications").select("*").eq("user_id",user_id).order("created_at",{ascending:false}).limit(60),
                generateAutoNotifications(user_id, appCfg),
            ]);
            const enriched=(manuales||[]).map(m=>{
                const sender=profiles.find(p=>p.user_id===m.from_id);
                let parsed={...m,fromName:sender?.full_name||(m.from_id?"Admin":null),icono:"📩",tipo:"manual",ts:m.created_at,titulo:"Mensaje",texto:m.mensaje};
                try{const d=JSON.parse(m.mensaje);parsed={...parsed,titulo:d.titulo,texto:d.texto,icono:d.icono||"📩",tipo:d.tipo||"manual"};}catch{}
                return parsed;
            });
            setManual(enriched);
            setAuto(autoGens);
            const unread=enriched.filter(n=>!n.leida).length;
            onUnreadCountChange?.(unread);
        } catch(e){console.error(e);}
        setLoad(false);
    },[user_id, appCfg, profiles]);

    useEffect(()=>{loadAll();},[loadAll]);

    const markRead = async(id)=>{
        await supabase.from("notifications").update({leida:true}).eq("id",id);
        setManual(prev=>{
            const u=prev.map(n=>n.id===id?{...n,leida:true}:n);
            onUnreadCountChange?.(u.filter(n=>!n.leida).length);
            return u;
        });
    };

    const markAllRead = async()=>{
        const ids=manualNotifs.filter(n=>!n.leida).map(n=>n.id);
        if (!ids.length) return;
        await supabase.from("notifications").update({leida:true}).in("id",ids);
        setManual(prev=>{const u=prev.map(n=>({...n,leida:true}));onUnreadCountChange?.(0);return u;});
        toast_("✓ Todas marcadas como leídas");
    };

    const sendNotif = async()=>{
        if (!cTitulo.trim()||!cTexto.trim()){toast_("Completa título y mensaje",false);return;}
        setCSav(true);
        try {
            const targets=cDest==="all"?profiles.map(p=>p.user_id):[cDest];
            const rows=targets.map(uid=>({user_id:uid,from_id:user_id,tipo:"manual",mensaje:JSON.stringify({titulo:cTitulo,texto:cTexto,icono:"📩",tipo:cTipo}),leida:false,created_at:new Date().toISOString()}));
            const {error}=await supabase.from("notifications").insert(rows);
            if (error) throw error;
            toast_(`✅ Enviado a ${cDest==="all"?profiles.length+" personas":"1 persona"}`);
            setCTit(""); setCTxt(""); setCompose(false); loadAll();
        } catch(e){console.error(e);toast_("❌ Error enviando",false);}
        setCSav(false);
    };

    const unreadCount = manualNotifs.filter(n=>!n.leida).length;

    const filteredAuto = useMemo(()=>{
        if (filter==="unread") return [];
        if (filter==="alertas") return autoNotifs.filter(n=>n.tipo==="urgente"||n.tipo==="alerta");
        if (filter==="logros")  return autoNotifs.filter(n=>n.tipo==="logro"||n.tipo==="oportunidad");
        return autoNotifs;
    },[autoNotifs,filter]);

    const filteredManual = useMemo(()=>{
        if (filter==="unread")  return manualNotifs.filter(n=>!n.leida);
        if (filter==="alertas") return manualNotifs.filter(n=>n.tipo==="urgente"||n.tipo==="alerta");
        if (filter==="logros")  return manualNotifs.filter(n=>n.tipo==="logro"||n.tipo==="motivacion");
        return manualNotifs;
    },[manualNotifs,filter]);

    const totalVisible = filteredAuto.length + filteredManual.length;

    return (
        <div style={{maxWidth:720}}>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

            {/* HEADER */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
                <div>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <h2 style={{fontSize:20,fontWeight:800,color:TX,margin:0}}>🔔 Notificaciones</h2>
                        {unreadCount>0&&(
                            <span style={{background:"#ef4444",color:"#fff",fontSize:11,fontWeight:800,padding:"2px 9px",borderRadius:20,minWidth:20,textAlign:"center"}}>
                                {unreadCount}
                            </span>
                        )}
                    </div>
                    <div style={{fontSize:12,color:TX3,marginTop:4}}>Alertas automáticas del sistema y mensajes del equipo</div>
                </div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {unreadCount>0&&<button onClick={markAllRead} style={{padding:"8px 14px",borderRadius:8,border:BD,background:"transparent",color:TX3,fontSize:12,cursor:"pointer",fontWeight:600}}>✓ Marcar todas leídas</button>}
                    <button onClick={loadAll} style={{padding:"8px 14px",borderRadius:8,border:BD,background:"transparent",color:TX3,fontSize:12,cursor:"pointer",fontWeight:600}}>🔄 Actualizar</button>
                    {role==="admin"&&<button onClick={()=>setCompose(s=>!s)} style={{padding:"8px 16px",borderRadius:8,border:"1px solid #6366f133",background:"#6366f118",color:"#818cf8",fontSize:12,fontWeight:700,cursor:"pointer"}}>✉️ Enviar mensaje</button>}
                </div>
            </div>

            {/* PANEL HOY */}
            <TodayPanel user_id={user_id}/>

            {/* COMPOSE */}
            {role==="admin"&&showCompose&&(
                <div style={{background:"#0a0a1a",border:"1px solid #6366f133",borderRadius:12,padding:20,marginBottom:20}}>
                    <div style={{fontSize:13,fontWeight:700,color:"#818cf8",marginBottom:16}}>✉️ Enviar notificación al equipo</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:12}}>
                        {[
                            {lbl:"Destinatario", el:<select value={cDest} onChange={e=>setCDest(e.target.value)} style={{width:"100%",background:S3,border:BD,borderRadius:8,padding:"10px 12px",color:TX,fontSize:13,outline:"none",fontFamily:"inherit"}}><option value="all">Todo el equipo ({profiles.length})</option>{profiles.map(p=><option key={p.user_id} value={p.user_id}>{p.full_name}</option>)}</select>},
                            {lbl:"Tipo",el:<select value={cTipo} onChange={e=>setCTipo(e.target.value)} style={{width:"100%",background:S3,border:BD,borderRadius:8,padding:"10px 12px",color:TX,fontSize:13,outline:"none",fontFamily:"inherit"}}><option value="motivacion">🌟 Motivacional</option><option value="logro">🏆 Reconocimiento</option><option value="alerta">⚠️ Recordatorio</option><option value="info">ℹ️ Informativo</option><option value="manual">📩 General</option></select>},
                            {lbl:"Título",el:<input value={cTitulo} onChange={e=>setCTit(e.target.value)} placeholder="Ej: ¡Vamos equipo!" style={{width:"100%",background:S3,border:BD,borderRadius:8,padding:"10px 12px",color:TX,fontSize:13,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>},
                        ].map(({lbl,el})=>(
                            <div key={lbl}><label style={{display:"block",fontSize:11,color:TX3,fontWeight:600,marginBottom:6,textTransform:"uppercase",letterSpacing:.8}}>{lbl}</label>{el}</div>
                        ))}
                    </div>
                    <div style={{marginBottom:12}}>
                        <label style={{display:"block",fontSize:11,color:TX3,fontWeight:600,marginBottom:6,textTransform:"uppercase",letterSpacing:.8}}>Mensaje</label>
                        <textarea value={cTexto} onChange={e=>setCTxt(e.target.value)} placeholder="Escribe tu mensaje..." rows={3} style={{width:"100%",background:S3,border:BD,borderRadius:8,padding:"10px 12px",color:TX,fontSize:13,outline:"none",fontFamily:"inherit",resize:"vertical",boxSizing:"border-box"}}/>
                    </div>
                    <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
                        <button onClick={()=>setCompose(false)} style={{padding:"9px 16px",borderRadius:8,border:BD,background:"transparent",color:TX3,fontSize:13,cursor:"pointer",fontWeight:600}}>Cancelar</button>
                        <button onClick={sendNotif} disabled={cSaving} style={{padding:"9px 20px",borderRadius:8,background:"#6366f1",color:"#fff",border:"none",fontSize:13,fontWeight:700,cursor:"pointer"}}>{cSaving?"Enviando...":"📤 Enviar"}</button>
                    </div>
                </div>
            )}

            {/* FILTROS */}
            <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
                {[
                    {id:"all",   lbl:"Todas"},
                    {id:"unread",lbl:`Sin leer${unreadCount>0?` (${unreadCount})`:""}` },
                    {id:"alertas",lbl:"⚠️ Alertas"},
                    {id:"logros", lbl:"🏆 Logros"},
                ].map(f=>(
                    <button key={f.id} onClick={()=>setFilter(f.id)} style={{padding:"7px 14px",borderRadius:8,border:filter===f.id?"1px solid #6366f133":BD,background:filter===f.id?"#6366f118":"transparent",color:filter===f.id?"#818cf8":TX3,fontSize:12,fontWeight:700,cursor:"pointer",transition:"all .15s"}}>
                        {f.lbl}
                    </button>
                ))}
            </div>

            {/* LISTA */}
            {loading ? (
                <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:200,color:TX3,fontSize:13,gap:12}}>
                    <div style={{width:24,height:24,borderRadius:"50%",border:"3px solid #6366f1",borderTopColor:"transparent",animation:"spin 1s linear infinite"}}/>
                    Cargando notificaciones...
                </div>
            ) : totalVisible===0 ? (
                <div style={{background:S2,border:BD,borderRadius:12,padding:40,textAlign:"center",color:TX3}}>
                    <div style={{fontSize:32,marginBottom:12}}>🎉</div>
                    <div style={{fontSize:14,fontWeight:600,color:TX}}>Todo al día</div>
                    <div style={{fontSize:13,marginTop:6}}>No hay notificaciones en esta vista.</div>
                </div>
            ) : (
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    {filteredAuto.length>0&&(
                        <>
                            <div style={{fontFamily:"monospace",fontSize:10,letterSpacing:"2px",textTransform:"uppercase",color:TX3,padding:"0 2px",marginTop:4}}>
                                💡 Alertas automáticas del sistema
                            </div>
                            {filteredAuto.map(n=><NotifCard key={n.id} notif={{...n,leida:false}} onRead={()=>{}}/>)}
                        </>
                    )}
                    {filteredManual.length>0&&(
                        <>
                            <div style={{fontFamily:"monospace",fontSize:10,letterSpacing:"2px",textTransform:"uppercase",color:TX3,padding:"0 2px",marginTop:filteredAuto.length>0?12:4}}>
                                ✉️ Mensajes del equipo
                            </div>
                            {filteredManual.map(n=><NotifCard key={n.id} notif={n} onRead={markRead}/>)}
                        </>
                    )}
                </div>
            )}

            {toast&&<div style={{position:"fixed",bottom:20,right:20,background:toast.ok?"#10b981":"#dc2626",color:"#fff",padding:"11px 20px",borderRadius:10,fontSize:13,fontWeight:700,zIndex:999,boxShadow:"0 8px 32px rgba(0,0,0,.5)"}}>{toast.msg}</div>}
        </div>
    );
}
