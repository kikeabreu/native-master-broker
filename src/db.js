import { supabase } from "./supabaseClient";

// ---------- HELPERS ----------
async function dbGetProfilesMapByUserId() {
    const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, role");

    if (error) throw error;

    const map = new Map();
    for (const p of data ?? []) {
        map.set(p.user_id, {
            full_name: p.full_name || "",
            role: p.role || "team",
        });
    }
    return map;
}

function withOwnerMeta(rows, profilesMap) {
    return (rows ?? []).map((row) => {
        const owner = profilesMap.get(row.owner_id);
        return {
            ...row,
            owner_name: owner?.full_name || row.owner_id || "Sin propietario",
            owner_role: owner?.role || null,
        };
    });
}

// ---------- PROSPECTS ----------
export async function dbGetProspects(tab) {
    const { data, error } = await supabase
        .from("prospects")
        .select("*")
        .eq("tab", tab)
        .order("updated_at", { ascending: false });

    if (error) throw error;

    const prospects = data ?? [];

    const ownerIds = [...new Set(prospects.map(p => p.owner_id).filter(Boolean))];

    if (ownerIds.length === 0) {
        return prospects.map((p) => ({
            ...p,
            owner_name: null,
        }));
    }

    const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", ownerIds);

    if (profilesError) throw profilesError;

    const profileMap = Object.fromEntries(
        (profiles ?? []).map((pr) => [pr.user_id, pr.full_name || null])
    );

    return prospects.map((p) => ({
        ...p,
        owner_name: profileMap[p.owner_id] || null,
    }));
}

export async function dbUpsertProspect(p) {
    // p debe incluir: id (opcional), tab, data, stages, perdido, venta, notas_historial, owner_id
    const { data, error } = await supabase
        .from("prospects")
        .upsert(
            { ...p, updated_at: new Date().toISOString() },
            { onConflict: "id" }
        )
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function dbDeleteProspect(id) {
    const { error } = await supabase.from("prospects").delete().eq("id", id);
    if (error) throw error;
}

// ---------- TASKS ----------
export async function dbGetTasks() {
    const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("fecha", { ascending: true });

    if (error) throw error;

    const profilesMap = await dbGetProfilesMapByUserId();
    return withOwnerMeta(data ?? [], profilesMap);
}

export async function dbUpsertTask(t) {
    const { data, error } = await supabase
        .from("tasks")
        .upsert(
            { ...t, updated_at: new Date().toISOString() },
            { onConflict: "id" }
        )
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function dbDeleteTask(id) {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) throw error;
}

// ---------- ACTIVITIES ----------
export async function dbGetActivities() {
    const { data, error } = await supabase
        .from("activities")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) throw error;

    const profilesMap = await dbGetProfilesMapByUserId();
    return withOwnerMeta(data ?? [], profilesMap);
}

export async function dbInsertActivity(a) {
    const { data, error } = await supabase
        .from("activities")
        .insert(a)
        .select()
        .single();

    if (error) throw error;
    return data;
}

// ---------- CONFIG (admin only, por tus policies) ----------
export async function dbGetConfig() {
    const { data, error } = await supabase
        .from("config")
        .select("*")
        .limit(1)
        .single();

    if (error) throw error;
    return data;
}

export async function dbUpdateConfig(patch) {
    // actualiza la única fila existente
    const { data, error } = await supabase
        .from("config")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .neq("id", "00000000-0000-0000-0000-000000000000") // truco para "update all rows", sin depender de id fijo
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function dbGetMyRole() {
    const authRes = await supabase.auth.getUser();
    const userId = authRes?.data?.user?.id;

    if (!userId) return "team";

    const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", userId)
        .single();

    if (error) throw error;
    return data?.role || "team";
}
// ---------- TASKS (admin: traer owner_name) ----------
export async function dbGetTasksWithOwner() {
    const { data, error } = await supabase
        .from("tasks")
        .select("*, profiles:owner_id(full_name)")
        .order("fecha", { ascending: true });

    if (error) throw error;

    return (data ?? []).map((r) => ({
        ...r,
        owner_name: r.profiles?.full_name ?? null,
    }));
}

