import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./lib/supabase";

// ── Types ─────────────────────────────────────────────────────

interface MacroResult {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface MealEntry {
  id: number;
  text: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  created_at: string;
}

interface AnalyticsSummary {
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  count: number;
}

// ── Edge Function URL ─────────────────────────────────────────
const MEAL_FN_URL =
  "https://wqqcenttsrbcawxfuenu.supabase.co/functions/v1/meel";

// ── Design tokens ─────────────────────────────────────────────
const T = {
  bg: "#030712",
  bgCard: "#0d0d0d",
  bgInput: "#111",
  border: "#1a1a1a",
  borderSub: "#222",
  green: "#4ade80",
  greenDim: "rgba(74,222,128,0.1)",
  greenBorder: "rgba(74,222,128,0.2)",
  amber: "#fbbf24",
  blue: "#60a5fa",
  pink: "#f472b6",
  red: "#f87171",
  text: "#ffffff",
  textSub: "#9ca3af",
  textMuted: "#6b7280",
  textGhost: "#4b5563",
  fontMono: "'DM Mono', monospace",
  radius: "12px",
  radiusSm: "8px",
};

// ── Helpers ───────────────────────────────────────────────────

function todayStr(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}.${String(
    d.getMonth() + 1
  ).padStart(2, "0")}.${d.getFullYear()}`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function computeSummary(entries: MealEntry[]): AnalyticsSummary {
  return entries.reduce(
    (acc, e) => ({
      totalCalories: acc.totalCalories + (e.calories || 0),
      totalProtein: acc.totalProtein + (e.protein || 0),
      totalCarbs: acc.totalCarbs + (e.carbs || 0),
      totalFat: acc.totalFat + (e.fat || 0),
      count: acc.count + 1,
    }),
    {
      totalCalories: 0,
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0,
      count: 0,
    }
  );
}

// ── Main component ────────────────────────────────────────────

export default function MealInput() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<MealEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── Load entries ───────────────────────────────────────────
  const loadEntries = useCallback(async () => {
    const { data } = await supabase
      .from("meal_entries")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) setEntries(data as MealEntry[]);
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // ── Submit ─────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim();

    if (!trimmed || loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(MEAL_FN_URL, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    text: trimmed,
  }),
});

      if (!res.ok) {
        const body = await res.text();
        throw new Error(body);
      }

      const macros = (await res.json()) as MacroResult;

      const { error: insertErr } = await supabase
        .from("meal_entries")
        .insert({
          text: trimmed,
          calories: Math.round(macros.calories),
          protein: Math.round(macros.protein),
          carbs: Math.round(macros.carbs),
          fat: Math.round(macros.fat),
        });

      if (insertErr) {
        throw new Error(insertErr.message);
      }

      setText("");
      loadEntries();
      inputRef.current?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }, [text, loading, loadEntries]);

  // ── Analytics ──────────────────────────────────────────────
  const summary = computeSummary(entries);

  // ── Render ─────────────────────────────────────────────────
  return (
    <div
      style={{
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div
        style={{
          background: T.bgCard,
          borderRadius: T.radius,
          padding: 14,
          border: `1px solid ${T.border}`,
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 10,
            color: T.text,
          }}
        >
          Что съел?
        </div>

        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Например: курица 200г + рис 150г"
          rows={3}
          disabled={loading}
          style={{
            width: "100%",
            boxSizing: "border-box",
            background: T.bgInput,
            border: `1px solid ${T.borderSub}`,
            borderRadius: T.radiusSm,
            padding: "10px 12px",
            fontSize: 14,
            color: T.text,
            resize: "none",
            outline: "none",
          }}
        />

        {error && (
          <div
            style={{
              marginTop: 8,
              padding: "8px 10px",
              borderRadius: T.radiusSm,
              background: "rgba(248,113,113,0.08)",
              border: "1px solid rgba(248,113,113,0.2)",
              fontSize: 12,
              color: T.red,
            }}
          >
            ⚠️ {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!text.trim() || loading}
          style={{
            marginTop: 10,
            width: "100%",
            padding: "12px",
            borderRadius: T.radiusSm,
            border: "none",
            background: T.green,
            color: "#000",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {loading ? "Анализ..." : "Добавить"}
        </button>
      </div>

      <div
        style={{
          background: T.bgCard,
          borderRadius: T.radius,
          padding: 14,
          border: `1px solid ${T.border}`,
        }}
      >
        <div style={{ marginBottom: 10, fontWeight: 600 }}>
          Сегодня
        </div>

        <div style={{ color: T.amber }}>
          Калории: {summary.totalCalories}
        </div>

        <div style={{ color: T.green }}>
          Белки: {summary.totalProtein}
        </div>

        <div style={{ color: T.blue }}>
          Углеводы: {summary.totalCarbs}
        </div>

        <div style={{ color: T.pink }}>
          Жиры: {summary.totalFat}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {entries.map((entry) => (
          <div
            key={entry.id}
            style={{
              background: T.bgCard,
              borderRadius: T.radius,
              border: `1px solid ${T.border}`,
              padding: "12px 14px",
            }}
          >
            <div style={{ color: T.text, marginBottom: 8 }}>
              {entry.text}
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                fontSize: 12,
              }}
            >
              <span style={{ color: T.amber }}>
                {entry.calories} ккал
              </span>

              <span style={{ color: T.green }}>
                Б {entry.protein}
              </span>

              <span style={{ color: T.blue }}>
                У {entry.carbs}
              </span>

              <span style={{ color: T.pink }}>
                Ж {entry.fat}
              </span>
            </div>

            <div
              style={{
                marginTop: 6,
                fontSize: 10,
                color: T.textGhost,
              }}
            >
              {fmtTime(entry.created_at)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
