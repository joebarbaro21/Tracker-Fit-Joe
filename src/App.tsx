import { useCallback, useEffect, useRef, useState } from "react";
import Tracker from "./Tracker";
import { getLogs, addLog, saveLogs } from "./lib/supabase";

// ── Types ─────────────────────────────────────────────────────
interface DailyLog {
  date: string;
  [key: string]: unknown;
}

// ── Storage key (must match Tracker.tsx) ─────────────────────
const LOCAL_KEY = "fitness_logs_v35";

// ── localStorage helpers ──────────────────────────────────────
function localRead(): DailyLog[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as DailyLog[]) : [];
  } catch {
    return [];
  }
}

function localWrite(logs: DailyLog[]): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(logs));
  } catch (e) {
    console.warn("[localStorage] write failed:", e);
  }
}

// ── App ───────────────────────────────────────────────────────
export default function App() {
  const [updateReady, setUpdateReady] = useState(false);

  // Track which log_dates are already synced to avoid redundant upserts
  const syncedDates = useRef<Set<string>>(new Set());

  // ── PWA update banner ──────────────────────────────────────
  useEffect(() => {
    const handler = () => setUpdateReady(true);
    window.addEventListener("pwa-update-available", handler);
    return () => window.removeEventListener("pwa-update-available", handler);
  }, []);

  // ── onCloudLoad: fetch from Supabase, merge into localStorage ──
  //    Called once on app start by Tracker.
  const handleCloudLoad = useCallback(async (): Promise<DailyLog[] | null> => {
    const cloudLogs = await getLogs();
    if (!cloudLogs) return null;

    // Merge cloud → localStorage (cloud wins on same date)
    const local = localRead();
    const map = new Map<string, DailyLog>(local.map((l) => [l.date, l]));
    let changed = false;

    for (const cl of cloudLogs as DailyLog[]) {
      if (!cl.date) continue;
      syncedDates.current.add(cl.date); // already in cloud
      if (!map.has(cl.date) || JSON.stringify(map.get(cl.date)) !== JSON.stringify(cl)) {
        map.set(cl.date, cl);
        changed = true;
      }
    }

    if (changed) {
      const merged = [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
      localWrite(merged);
    }

    return cloudLogs as DailyLog[];
  }, []);

  // ── onCloudSave: bulk upsert (used after import / initial seed) ──
  const handleCloudSave = useCallback(async (logs: DailyLog[]): Promise<void> => {
    // 1. Write to localStorage first (synchronous, instant)
    localWrite(logs);

    // 2. Bulk upsert to Supabase (async, fire-and-forget on error)
    await saveLogs(logs);

    // Mark all as synced
    logs.forEach((l) => { if (l.date) syncedDates.current.add(l.date); });
  }, []);

  // ── onCloudLogUpdate: called on every single-log change ──────
  //    This is the hot path: every edit → localStorage + Supabase upsert.
  const handleCloudLogUpdate = useCallback(async (log: DailyLog): Promise<void> => {
    if (!log.date) return;

    // 1. Persist to localStorage immediately
    const current = localRead();
    const idx = current.findIndex((l) => l.date === log.date);
    if (idx !== -1) current[idx] = log;
    else current.push(log);
    localWrite(current);

    // 2. Upsert to Supabase (insert if new, update if exists)
    await addLog(log);
    syncedDates.current.add(log.date);
  }, []);

  // ── Render ────────────────────────────────────────────────────
  return (
    <>
      {/* PWA update banner */}
      {updateReady && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 16px",
          background: "#0d0d0d", borderBottom: "1px solid #1a1a1a",
        }}>
          <span style={{ flex: 1, fontSize: 13, color: "#9ca3af" }}>
            🔄 Доступна новая версия
          </span>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "6px 14px", borderRadius: 8,
              background: "#60a5fa", color: "#000",
              border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}
          >
            Обновить
          </button>
        </div>
      )}

      {/*
        Tracker receives storage callbacks.
        Every change goes through:
          handleCloudLogUpdate → localStorage.setItem + supabase.upsert
        On load:
          handleCloudLoad → supabase.select → merge → localStorage.setItem
      */}
      <Tracker
        onCloudLoad={handleCloudLoad}
        onCloudSave={handleCloudSave}
        onCloudLogUpdate={handleCloudLogUpdate}
      />
    </>
  );
}
