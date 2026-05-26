import { createClient } from "@supabase/supabase-js";

// ── Client ────────────────────────────────────────────────────
const SUPABASE_URL      = "https://wqqcenttsrbcawxfuenu.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Gq_Vm4rNOQ89pswJdEYjZw_25bBVxyl";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Types ─────────────────────────────────────────────────────
export interface DailyLogRow {
  id?:        number;
  log_date:   string;   // "дд.мм.гггг" — unique conflict key
  payload:    Record<string, unknown>;
  updated_at?: string;
}

// ── getLogs ───────────────────────────────────────────────────
/**
 * Fetch all logs from Supabase ordered by date.
 * Returns null on any error so caller can fall back to localStorage.
 */
export async function getLogs(): Promise<Record<string, unknown>[] | null> {
  try {
    const { data, error } = await supabase
      .from("logs")
      .select("payload")
      .order("log_date", { ascending: true });

    if (error) {
      console.warn("[supabase] getLogs:", error.message);
      return null;
    }
    return (data ?? []).map((r) => r.payload as Record<string, unknown>);
  } catch (e) {
    console.warn("[supabase] getLogs network error:", e);
    return null;
  }
}

// ── addLog (single upsert) ────────────────────────────────────
/**
 * Upsert one DailyLog. log_date is the conflict key.
 * Silent on error — never blocks the UI.
 */
export async function addLog(
  log: { date: string } & Record<string, unknown>
): Promise<void> {
  if (!log.date) return;
  try {
    const { error } = await supabase
      .from("logs")
      .upsert({ log_date: log.date, payload: log }, { onConflict: "log_date" });
    if (error) console.warn("[supabase] addLog:", error.message);
  } catch (e) {
    console.warn("[supabase] addLog network error:", e);
  }
}

// ── saveLogs (bulk upsert) ────────────────────────────────────
/**
 * Upsert an entire array of logs in one request.
 * Used on initial seed and after JSON import.
 */
export async function saveLogs(
  logs: Array<{ date: string } & Record<string, unknown>>
): Promise<void> {
  if (!logs.length) return;
  try {
    const rows: DailyLogRow[] = logs
      .filter((l) => Boolean(l.date))
      .map((l) => ({ log_date: l.date, payload: l as Record<string, unknown> }));

    const { error } = await supabase
      .from("logs")
      .upsert(rows, { onConflict: "log_date" });

    if (error) console.warn("[supabase] saveLogs:", error.message);
  } catch (e) {
    console.warn("[supabase] saveLogs network error:", e);
  }
}
