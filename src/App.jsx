import { useEffect, useState } from "react";
import CRM from "./CRM";
import Login from "./Login";
import { supabase } from "./supabaseClient";
import { dbGetMyRole } from "./db";

export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("team");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;

    // 1) Cargar sesión SIN bloquear
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!alive) return;
        const u = data.session?.user ?? null;
        setUser(u);
        setReady(true); // <- clave: ya no se queda colgado

        // 2) Cargar rol en segundo plano (no bloquea UI)
        if (u) {
          Promise.race([
            dbGetMyRole(),
            new Promise((_, rej) => setTimeout(() => rej(new Error("role timeout")), 3000)),
          ])
            .then((r) => alive && setRole(r || "team"))
            .catch(() => alive && setRole("team"));
        } else {
          setRole("team");
        }
      })
      .catch(() => {
        if (!alive) return;
        setUser(null);
        setRole("team");
        setReady(true);
      });

    // 3) Escuchar cambios de sesión (login/logout)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);

      if (u) {
        Promise.race([
          dbGetMyRole(),
          new Promise((_, rej) => setTimeout(() => rej(new Error("role timeout")), 3000)),
        ])
          .then((r) => setRole(r || "team"))
          .catch(() => setRole("team"));
      } else {
        setRole("team");
      }
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!ready) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#07070f", color: "#fff", fontWeight: 800 }}>
        Cargando sesión...
      </div>
    );
  }

  if (!user) return <Login onAuthed={setUser} />;

  return <CRM user={user} role={role || "team"} />;
}