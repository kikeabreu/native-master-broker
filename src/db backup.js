import { supabase } from "./supabaseClient";

// ---------- PROSPECTS ----------
export async function dbGetProspects(tab) {
    const { data, error } = await supabase
        .from("prospects")
        .select("*")
        .eq("tab", tab)
        .order("updated_at", { ascending: false });

    if (error) throw error;
    return data ?? [];
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
    return data ?? [];
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
    return data ?? [];
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
    const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", (await supabase.auth.getUser()).data.user.id)
        .single();

    if (error) throw error;
    return data?.role || "team";
}