import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./lib/supabase";

// ── Types ─────────────────────────────────────────────────────

interface MacroResult {
  calories: number;
  protein:  number;
  carbs:    number;
  fat:      number;
}

interface MealEntry {
  id:         number;
  text:       string;
  calories:   number;
  protein:    number;
  carbs:      number;
  fat:        number;
  created_at: string;
}

interface AnalyticsSummary {
  totalCalories: number;
  totalProtein:  number;
  totalCarbs:    number;
  totalFat:      number;
  count:         number;
}

// ── Edge Function URL ─────────────────────────────────────────
const MEAL_FN_URL =
  "https://wqqcenttsrbcawxfuenu.supabase.co/functions/v1/meal";

// ── Design tokens (mirrors Tracker.tsx) ──────────────────────
const T = {
  bg:          "#030712",
  bgCard:      "#0d0d0d",
  bgInput:     "#111",
  border:      "#1a1a1a",
  borderSub:   "#222",
  green:       "#4ade80",
  greenDim:    "rgba(74,222,128,0.1)",
  greenBorder: "rgba(74,222,128,0.2)",
  amber:       "#fbbf24",
  blue:        "#60a5fa",
  pink:        "#f472b6",
  red:         "#f87171",
  text:        "#ffffff",
  textSub:     "#9ca3af",
  textMuted:   "#6b7280",
  textGhost:   "#4b5563",
  fontMono:    "'DM Mono', monospace",
  radius:      "12px",
  radiusSm:    "8px",
};

// ── Helpers ───────────────────────────────────────────────────

function todayStr(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function computeSummary(entries: MealEntry[]): AnalyticsSummary {
  return entries.reduce(
    (acc, e) => ({
      totalCalories: acc.totalCalories + (e.calories || 0),
      totalProtein:  acc.totalProtein  + (e.protein  || 0),
      totalCarbs:    acc.totalCarbs    + (e.carbs    || 0),
      totalFat:      acc.totalFat      + (e.fat      || 0),
      count:         acc.count + 1,
    }),
    { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0, count: 0 }
  );
}

// ── MacroBar ──────────────────────────────────────────────────

function MacroBar({
  label, value, max, color,
}: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min((value / Math.max(max, 1)) * 100, 100);
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
        <span style={{ color: T.textMuted }}>{label}</span>
        <span style={{ color, fontFamily: T.fontMono, fontWeight: 600 }}>{Math.round(value)}</span>
      </div>
      <div style={{ background: T.border, borderRadius: 999, height: 4, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 999, transition: "width 0.4s ease" }} />
      </div>
    </div>
  );
}

// ── MealCard ──────────────────────────────────────────────────

function MealCard({ entry, onDelete }: { entry: MealEntry; onDelete: (id: number) => void }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await supabase.from("meal_entries").delete().eq("id", entry.id);
    if (!error) onDelete(entry.id);
    else setDeleting(false);
  };

  return (
    <div style={{
      background: T.bgCard, borderRadius: T.radius,
      border: `1px solid ${T.border}`, padding: "12px 14px",
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <p style={{ margin: 0, fontSize: 13, color: T.text, lineHeight: 1.4, flex: 1 }}>
          {entry.text}
        </p>
        <button
          onClick={handleDelete}
          disabled={deleting}
          style={{
            background: "none", border: "none", color: T.textGhost,
            cursor: "pointer", fontSize: 16, flexShrink: 0, padding: "0 2px",
            opacity: deleting ? 0.4 : 1,
          }}
          aria-label="Удалить"
        >✕</button>
      </div>

      {/* Macro chips */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {[
          { label: `${entry.calories} ккал`, color: T.amber },
          { label: `Б ${entry.protein}г`,    color: T.green },
          { label: `У ${entry.carbs}г`,      color: T.blue  },
          { label: `Ж ${entry.fat}г`,        color: T.pink  },
        ].map(({ label, color }) => (
          <span key={label} style={{
            fontSize: 11, padding: "2px 8px", borderRadius: 999,
            background: `${color}18`, color, fontFamily: T.fontMono, fontWeight: 600,
          }}>{label}</span>
        ))}
      </div>

      <div style={{ fontSize: 10, color: T.textGhost, fontFamily: T.fontMono }}>
        {fmtTime(entry.created_at)}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

export default function MealInput() {
  const [text,      setText]      = useState("");
  const [loading,   setLoading]   = useState(false);
  const [entries,   setEntries]   = useState<MealEntry[]>([]);
  const [fetching,  setFetching]  = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [lastAdded, setLastAdded] = useState<MacroResult | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── Load today's entries ──────────────────────────────────
  const loadEntries = useCallback(async () => {
    setFetching(true);
    const { data, error: err } = await supabase
      .from("meal_entries")
      .select("*")
      .order("created_at", { ascending: false });

    if (!err && data) setEntries(data as MealEntry[]);
    setFetching(false);
  }, []);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  // ── Realtime subscription ─────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel("meal_entries_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "meal_entries" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setEntries((prev) => [payload.new as MealEntry, ...prev]);
          } else if (payload.eventType === "DELETE") {
            setEntries((prev) => prev.filter((e) => e.id !== (payload.old as MealEntry).id));
          } else if (payload.eventType === "UPDATE") {
            setEntries((prev) =>
              prev.map((e) => (e.id === (payload.new as MealEntry).id ? (payload.new as MealEntry) : e))
            );
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── Submit ────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError(null);
    setLastAdded(null);

    try {
      // 1. Call Edge Function
      const res = await fetch(MEAL_FN_URL, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text: trimmed }),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Edge Function error ${res.status}: ${body}`);
      }

      const macros = (await res.json()) as MacroResult;

      // Validate response shape
      if (
        typeof macros.calories !== "number" ||
        typeof macros.protein  !== "number" ||
        typeof macros.carbs    !== "number" ||
        typeof macros.fat      !== "number"
      ) {
        throw new Error("Некорректный ответ от сервера");
      }

      // 2. Save to Supabase table meal_entries
      const { error: insertErr } = await supabase
        .from("meal_entries")
        .insert({
          text:     trimmed,
          calories: Math.round(macros.calories),
          protein:  Math.round(macros.protein),
          carbs:    Math.round(macros.carbs),
          fat:      Math.round(macros.fat),
        });

      if (insertErr) throw new Error(`Supabase insert: ${insertErr.message}`);

      // 3. Also persist to logs table for today (upsert adds to day total)
      const today = todayStr();
      const { data: existing } = await supabase
        .from("logs")
        .select("payload")
        .eq("log_date", today)
        .maybeSingle();

      const prev = (existing?.payload as Record<string, number>) ?? {};
      const updatedPayload = {
        ...prev,
        date:     today,
        calories: String((Number(prev.calories) || 0) + Math.round(macros.calories)),
        protein:  String((Number(prev.protein)  || 0) + Math.round(macros.protein)),
        carbs:    String((Number(prev.carbs)    || 0) + Math.round(macros.carbs)),
        fat:      String((Number(prev.fat)      || 0) + Math.round(macros.fat)),
      };

      await supabase
        .from("logs")
        .upsert({ log_date: today, payload: updatedPayload }, { onConflict: "log_date" });

      // 4. Clear input, show result
      setText("");
      setLastAdded(macros);
      inputRef.current?.focus();

    } catch (e) {
      setError(e instanceof Error ? e.message : "Неизвестная ошибка");
    } finally {
      setLoading(false);
    }
  }, [text, loading]);

  // Submit on Cmd/Ctrl + Enter
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleSubmit();
    },
    [handleSubmit]
  );

  // ── Analytics for today ───────────────────────────────────
  const todayEntries = entries.filter(
    (e) => e.created_at.startsWith(new Date().toISOString().slice(0, 10))
  );
  const summary = computeSummary(todayEntries);

  // ── Render ────────────────────────────────────────────────
  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>

      {/* ── Input card ── */}
      <div style={{ background: T.bgCard, borderRadius: T.radius, padding: 14, border: `1px solid ${T.border}` }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: T.text }}>
          Что съел?
        </div>

        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => { setText(e.target.value); setError(null); }}
          onKeyDown={handleKeyDown}
          placeholder="Например: куриная грудка 200г + рис 150г"
          rows={3}
          disabled={loading}
          style={{
            width: "100%", boxSizing: "border-box",
            background: T.bgInput, border: `1px solid ${text ? T.greenBorder : T.borderSub}`,
            borderRadius: T.radiusSm, padding: "10px 12px",
            fontSize: 14, color: T.text, resize: "none", outline: "none",
            fontFamily: "inherit", lineHeight: 1.5,
            opacity: loading ? 0.6 : 1,
            transition: "border-color 0.2s",
          }}
        />

        {/* Error message */}
        {error && (
          <div style={{
            marginTop: 8, padding: "8px 10px", borderRadius: T.radiusSm,
            background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)",
            fontSize: 12, color: T.red, lineHeight: 1.4,
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Last result */}
        {lastAdded && !error && (
          <div style={{
            marginTop: 8, padding: "8px 12px", borderRadius: T.radiusSm,
            background: T.greenDim, border: `1px solid ${T.greenBorder}`,
            fontSize: 12, color: T.green,
            display: "flex", gap: 10, flexWrap: "wrap",
          }}>
            <span>✅ Добавлено</span>
            <span style={{ fontFamily: T.fontMono }}>{lastAdded.calories} ккал</span>
            <span style={{ fontFamily: T.fontMono }}>Б{lastAdded.protein}г</span>
            <span style={{ fontFamily: T.fontMono }}>У{lastAdded.carbs}г</span>
            <span style={{ fontFamily: T.fontMono }}>Ж{lastAdded.fat}г</span>
          </div>
        )}

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={!text.trim() || loading}
          style={{
            marginTop: 10, width: "100%", padding: "12px",
            borderRadius: T.radiusSm, border: "none",
            background: !text.trim() || loading ? T.bgInput : T.green,
            color:      !text.trim() || loading ? T.textGhost : "#000",
            fontSize: 14, fontWeight: 600, cursor: !text.trim() || loading ? "default" : "pointer",
            transition: "background 0.2s, color 0.2s",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          {loading ? (
            <>
              <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid #4ade8040", borderTopColor: T.green, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
              Анализирую...
            </>
          ) : "Добавить"}
        </button>

        <div style={{ fontSize: 10, color: T.textGhost, marginTop: 6, textAlign: "center" }}>
          Cmd+Enter для отправки
        </div>
      </div>

      {/* ── Today's analytics ── */}
      {todayEntries.length > 0 && (
        <div style={{ background: T.bgCard, borderRadius: T.radius, padding: 14, border: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
            Сегодня — {todayEntries.length} {todayEntries.length === 1 ? "запись" : "записей"}
          </div>
          <MacroBar label="Калории"  value={summary.totalCalories} max={1800} color={T.amber} />
          <MacroBar label="Белок г"  value={summary.totalProtein}  max={160}  color={T.green} />
          <MacroBar label="Углев. г" value={summary.totalCarbs}    max={150}  color={T.blue}  />
          <MacroBar label="Жиры г"   value={summary.totalFat}      max={50}   color={T.pink}  />
        </div>
      )}

      {/* ── Feed ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 600 }}>
          {fetching ? "Загрузка..." : entries.length === 0 ? "Записей пока нет" : `Все записи (${entries.length})`}
        </div>
        {entries.map((entry) => (
          <MealCard
            key={entry.id}
            entry={entry}
            onDelete={(id) => setEntries((prev) => prev.filter((e) => e.id !== id))}
          />
        ))}
      </div>

      {/* Spinner keyframes */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
