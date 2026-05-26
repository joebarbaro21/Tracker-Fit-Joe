import { useState, useEffect, useMemo, useCallback, memo, useRef } from "react";
import MealInput from "./MealInput";

// ╔══════════════════════════════════════════════════════════╗
// ║  SECTION 1 — TYPES (JSDoc)                              ║
// ╚══════════════════════════════════════════════════════════╝

/**
 * @typedef {"силовая"|"кардио"|"отдых"} WorkoutType
 */

/**
 * @typedef {Object} Nutrition
 * @property {number} calories
 * @property {number} protein
 * @property {number} carbs
 * @property {number} fat
 */

/**
 * @typedef {Object} MealSlot
 * @property {string} time       — "08:00"
 * @property {string} emoji
 * @property {string} title
 * @property {string} desc
 * @property {number|null} kcal
 * @property {number} p          — protein grams
 * @property {number} c          — carb grams
 * @property {number} f          — fat grams
 */

/**
 * @typedef {Object} Plan
 * @property {number} calories
 * @property {number} protein
 * @property {number} carbs
 * @property {number} fat
 * @property {MealSlot[]} meals
 */

/**
 * @typedef {Object} DailyLog
 * @property {string}      date         — "дд.мм.гггг"
 * @property {string}      weight       — stringified float, e.g. "77.5"
 * @property {string}      calories
 * @property {string}      protein
 * @property {string}      carbs
 * @property {string}      fat
 * @property {WorkoutType} workout
 * @property {string}      notes
 * @property {boolean[]}   meals        — [breakfast, lunch, snack, dinner]
 * @property {string[]}    mealDetails  — free-text per slot
 * @property {string}      [createdAt]  — ISO string, added in v34
 * @property {string[]}    [tags]       — added in v34
 */

/**
 * @typedef {Object} AnalyticsResult
 * @property {number|null}  start
 * @property {number|null}  current
 * @property {number|null}  min
 * @property {number|null}  delta
 * @property {number}       avgCal
 * @property {number}       avgProt
 * @property {number}       avgCarbs
 * @property {number}       avgFat
 * @property {number}       adherence        — 0-100
 * @property {number|null}  weeklyLoss       — kg/week, negative = loss
 * @property {number|null}  tdee             — estimated kcal
 * @property {{ strength:number, cardio:number, rest:number }} workouts
 * @property {DailyLog[]}   wLogs
 * @property {number[]}     weights
 * @property {number[]}     ma7              — 7-day moving average
 * @property {number[]}     ma14             — 14-day moving average
 * @property {{ date:string, value:number }[]} caloriesTimeline
 * @property {{ date:string, value:number }[]} proteinTimeline
 */

// ╔══════════════════════════════════════════════════════════╗
// ║  SECTION 2 — DESIGN TOKENS                              ║
// ╚══════════════════════════════════════════════════════════╝

/** Central source of truth for all visual constants. */
const T = {
  // Colours
  bg:        "#030712",
  bgCard:    "#0d0d0d",
  bgInput:   "#111",
  bgHover:   "#161616",
  border:    "#1a1a1a",
  borderSub: "#222",

  green:     "#4ade80",
  greenDim:  "rgba(74,222,128,0.1)",
  greenBorder:"rgba(74,222,128,0.2)",
  amber:     "#fbbf24",
  blue:      "#60a5fa",
  orange:    "#fb923c",
  pink:      "#f472b6",
  purple:    "#a78bfa",
  red:       "#f87171",

  text:      "#ffffff",
  textSub:   "#9ca3af",
  textMuted: "#6b7280",
  textGhost: "#4b5563",
  textDark:  "#374151",

  // Typography
  fontMono:  "'DM Mono', monospace",
  fontSans:  "'DM Sans', sans-serif",

  // Spacing / radius
  radius:    "12px",
  radiusSm:  "8px",
  radiusXs:  "6px",
  radiusPill:"20px",
  radiusFull:"50%",

  // Shadows
  glowGreen: "0 0 12px rgba(74,222,128,0.25)",
};

/** Workout colour config keyed by WorkoutType. */
const WCOLOR = {
  "силовая": { bg: "rgba(96,165,250,0.1)",  text: T.blue   },
  "кардио":  { bg: "rgba(251,146,60,0.1)",   text: T.orange },
  "отдых":   { bg: "rgba(107,114,128,0.1)",  text: T.textSub },
};

/**
 * Tiny style-factory — merges base style with overrides.
 * Keeps call sites clean without needing a CSS-in-JS lib.
 * @param {React.CSSProperties} base
 * @param {React.CSSProperties} [overrides]
 * @returns {React.CSSProperties}
 */
const sx = (base, overrides) => overrides ? { ...base, ...overrides } : base;

/** Reusable style presets. */
const S = {
  card:    { background: T.bgCard, borderRadius: T.radius, padding: "14px", border: `1px solid ${T.border}` },
  cardSm:  { background: T.bgInput, borderRadius: T.radiusSm, padding: "10px 12px", border: `1px solid ${T.border}` },
  input:   { width: "100%", background: T.bgInput, border: `1px solid ${T.borderSub}`, borderRadius: T.radiusSm, padding: "8px 10px", fontSize: "13px", color: T.text, outline: "none", boxSizing: "border-box" },
  inputSm: { width: "100%", background: T.bgInput, border: `1px solid ${T.borderSub}`, borderRadius: T.radiusXs, padding: "6px 8px", fontSize: "13px", color: T.text, outline: "none", boxSizing: "border-box" },
  label:   { fontSize: "11px", color: T.textMuted, marginBottom: "4px" },
  labelSm: { fontSize: "10px", color: T.textMuted, marginBottom: "3px" },
  section: { display: "flex", flexDirection: "column", gap: "12px" },
  row:     { display: "flex", alignItems: "center", gap: "8px" },
  grid2:   { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" },
  pill:    (active) => ({
    flexShrink: 0, padding: "6px 12px", borderRadius: T.radiusPill,
    fontSize: "12px", fontWeight: "500", cursor: "pointer",
    background: active ? T.green  : T.bgInput,
    color:      active ? "#000"   : T.textSub,
    border:     active ? "none"   : `1px solid ${T.borderSub}`,
  }),
  btnGhost: { background: "none", border: "none", cursor: "pointer", color: T.textMuted },
  tag: (color) => ({
    fontSize: "10px", padding: "2px 8px", borderRadius: "10px", display: "inline-block",
    background: WCOLOR[color]?.bg ?? T.bgInput,
    color:      WCOLOR[color]?.text ?? T.textSub,
  }),
  hScroll: {
    display: "flex", overflowX: "auto", WebkitOverflowScrolling: "touch",
    scrollbarWidth: "none", msOverflowStyle: "none",
  },
};


// ╔══════════════════════════════════════════════════════════╗
// ║  SECTION 3 — STORAGE + MIGRATION                        ║
// ╚══════════════════════════════════════════════════════════╝

const CURRENT_VERSION = 35;
const STORAGE_KEY     = `fitness_logs_v${CURRENT_VERSION}`;
const META_KEY        = "fitness_meta";
const BACKUP_KEY      = "fitness_backup";
const MAX_BACKUPS     = 3;

/** @returns {DailyLog} */
function emptyLog() {
  return {
    date: "", weight: "", calories: "", protein: "", carbs: "", fat: "",
    workout: "силовая", notes: "",
    meals: [false, false, false, false],
    mealDetails: ["", "", "", ""],
    createdAt: new Date().toISOString(),
    tags: [],
  };
}

/**
 * Migration registry.
 * To add a new version: bump CURRENT_VERSION and append an entry.
 * @type {Array<{ from:number, to:number, up:(logs:DailyLog[])=>DailyLog[] }>}
 */
const MIGRATIONS = [
  {
    from: 0, to: 33,
    up(logs) {
      return logs.map(l => ({
        ...l,
        mealDetails: Array.isArray(l.mealDetails) && l.mealDetails.length === 4
          ? l.mealDetails : ["", "", "", ""],
        meals: Array.isArray(l.meals) && l.meals.length === 4
          ? l.meals : [false, false, false, false],
      }));
    },
  },
  {
    from: 33, to: 34,
    up(logs) {
      return logs.map(l => ({
        ...l,
        createdAt: l.createdAt ?? new Date().toISOString(),
        tags:      l.tags      ?? [],
      }));
    },
  },
  // ── Add future migrations here ──
  // { from: 34, to: 35, up(logs) { return logs.map(l => ({ ...l, newField: default })); } }
];

/**
 * Run applicable migrations in order.
 * Stops chain on error and returns best-effort result.
 * @param {DailyLog[]} logs
 * @param {number} fromVersion
 * @returns {{ data: DailyLog[], version: number }}
 */
function runMigrations(logs, fromVersion) {
  let version = fromVersion;
  let data = logs;
  const chain = MIGRATIONS
    .filter(m => m.from >= fromVersion && m.to <= CURRENT_VERSION)
    .sort((a, b) => a.from - b.from);

  for (const m of chain) {
    try {
      data = m.up(data);
      version = m.to;
      console.info(`[migration] v${m.from}→v${m.to} ✓ (${data.length} records)`);
    } catch (err) {
      console.error(`[migration] v${m.from}→v${m.to} FAILED:`, err);
      break;
    }
  }
  return { data, version };
}

// ── Low-level primitives ──────────────────────────────────────

/** @param {string} key @returns {Promise<any|null>} */
async function rawGet(key) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; }
  catch { return null; }
}

/** @param {string} key @param {any} value @returns {Promise<boolean>} */
async function rawSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }
}

/** Scan legacy version keys v1…v(current-1), newest first. */
async function findLegacyData() {
  for (let v = CURRENT_VERSION - 1; v >= 1; v--) {
    const data = await rawGet(`fitness_logs_v${v}`);
    if (Array.isArray(data) && data.length > 0) return { data, foundVersion: v };
  }
  return null;
}

/** Save a pre-migration snapshot to a timestamped key. */
async function saveBackup(logs, fromVersion) {
  const key  = `${BACKUP_KEY}_v${fromVersion}_${Date.now()}`;
  const meta = (await rawGet(META_KEY)) ?? { backups: [] };
  await rawSet(key, logs);
  meta.backups = [
    { version: fromVersion, savedAt: new Date().toISOString(), key },
    ...(meta.backups ?? []),
  ].slice(0, MAX_BACKUPS);
  await rawSet(META_KEY, meta);
  console.info(`[backup] saved pre-migration snapshot → ${key}`);
}

// ── Public API ────────────────────────────────────────────────

const storageService = {
  /**
   * Load logs, running migrations if needed.
   * @returns {Promise<{ logs:DailyLog[]|null, migrated:boolean, fromVersion:number }>}
   */
  async load() {
    let raw         = await rawGet(STORAGE_KEY);
    let fromVersion = CURRENT_VERSION;
    let migrated    = false;

    if (!Array.isArray(raw) || raw.length === 0) {
      const legacy = await findLegacyData();
      if (legacy) { raw = legacy.data; fromVersion = legacy.foundVersion; }
    }

    if (!Array.isArray(raw)) return { logs: null, migrated: false, fromVersion: 0 };

    if (fromVersion < CURRENT_VERSION) {
      await saveBackup(raw, fromVersion);
      const result = runMigrations(raw, fromVersion);
      raw      = result.data;
      migrated = true;
      await rawSet(STORAGE_KEY, raw);
      const meta = (await rawGet(META_KEY)) ?? {};
      await rawSet(META_KEY, {
        ...meta,
        version: CURRENT_VERSION,
        migratedAt: new Date().toISOString(),
        migratedFrom: fromVersion,
      });
    }

    return { logs: raw, migrated, fromVersion };
  },

  /** @param {DailyLog[]} logs */
  async save(logs) { return rawSet(STORAGE_KEY, logs); },

  /** @returns {Promise<Array<{ version:number, savedAt:string, key:string }>>} */
  async listBackups() { return (await rawGet(META_KEY))?.backups ?? []; },

  /** @param {string} backupKey @returns {Promise<DailyLog[]>} */
  async restoreBackup(backupKey) {
    const data = await rawGet(backupKey);
    if (!Array.isArray(data)) throw new Error("Backup not found or invalid");
    await rawSet(STORAGE_KEY, data);
    return data;
  },

  // ── Export ──────────────────────────────────────────────────

  /** Download current logs as a versioned JSON file. @param {DailyLog[]} logs */
  exportJSON(logs) {
    const payload = {
      version:    CURRENT_VERSION,
      exportedAt: new Date().toISOString(),
      count:      logs.length,
      logs,
    };
    const json = JSON.stringify(payload, null, 2);
    const url  = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `fitness-v${CURRENT_VERSION}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // ── Validation ──────────────────────────────────────────────

  /**
   * Validate and normalise one raw log entry from an import.
   * Returns null when the record is unrecoverable.
   * @param {unknown} raw
   * @param {number} index   position in the array — used in error messages
   * @returns {{ log: DailyLog, warnings: string[] }|null}
   */
  _validateLog(raw, index) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;

    const warnings = [];
    const r = raw;

    // date — must be a non-empty string
    const date = typeof r.date === "string" ? r.date.trim() : "";
    if (!date) warnings.push(`[${index}] missing date`);

    // weight — coerce to string; empty string is OK (no weigh-in that day)
    const weight = r.weight != null ? String(r.weight) : "";

    // numeric macro fields — coerce, default 0
    const toNum = (v, name) => {
      const n = parseFloat(v);
      if (v != null && isNaN(n)) warnings.push(`[${index}] invalid ${name}: ${v}`);
      return isNaN(n) ? "" : String(Math.round(n));
    };
    const calories = toNum(r.calories, "calories");
    const protein  = toNum(r.protein,  "protein");
    const carbs    = toNum(r.carbs,    "carbs");
    const fat      = toNum(r.fat,      "fat");

    // workout — must be one of the three valid values
    const VALID_WORKOUTS = ["силовая", "кардио", "отдых"];
    const workout = VALID_WORKOUTS.includes(r.workout) ? r.workout : "отдых";
    if (!VALID_WORKOUTS.includes(r.workout)) warnings.push(`[${index}] unknown workout "${r.workout}", defaulted to "отдых"`);

    // meals — boolean[4]
    const meals = Array.isArray(r.meals) && r.meals.length === 4
      ? r.meals.map(v => Boolean(v))
      : [false, false, false, false];

    // mealDetails — string[4]
    const mealDetails = Array.isArray(r.mealDetails) && r.mealDetails.length === 4
      ? r.mealDetails.map(v => (typeof v === "string" ? v : ""))
      : ["", "", "", ""];

    // notes
    const notes = typeof r.notes === "string" ? r.notes : "";

    // v34+ fields
    const createdAt = typeof r.createdAt === "string" ? r.createdAt : new Date().toISOString();
    const tags      = Array.isArray(r.tags) ? r.tags.filter(t => typeof t === "string") : [];

    const log = { date, weight, calories, protein, carbs, fat, workout, notes, meals, mealDetails, createdAt, tags };
    return { log, warnings };
  },

  /**
   * Validate an entire imported array.
   * @param {unknown[]} arr
   * @returns {{ valid: DailyLog[], skipped: number, warnings: string[] }}
   */
  _validateLogs(arr) {
    const valid    = [];
    const warnings = [];
    let skipped    = 0;

    for (let i = 0; i < arr.length; i++) {
      const result = this._validateLog(arr[i], i);
      if (!result) { skipped++; warnings.push(`[${i}] unrecognisable record — skipped`); continue; }
      valid.push(result.log);
      warnings.push(...result.warnings);
    }

    return { valid, skipped, warnings };
  },

  // ── Import — merge strategy ─────────────────────────────────

  /**
   * Merge imported logs into existing ones.
   * Rule: same date → imported wins (more recent data).
   * @param {DailyLog[]} existing
   * @param {DailyLog[]} imported
   * @returns {DailyLog[]}
   */
  _mergeLogs(existing, imported) {
    const map = new Map(existing.map(l => [l.date, l]));
    for (const l of imported) {
      if (l.date) map.set(l.date, l);   // imported wins on conflict
    }
    return [...map.values()].sort((a, b) => {
      // Sort chronologically by date string дд.мм.гггг
      const parse = s => {
        const [d, m, y] = (s || "").split(".").map(Number);
        return new Date(y, m - 1, d).getTime() || 0;
      };
      return parse(a.date) - parse(b.date);
    });
  },

  /**
   * Import from a JSON file.
   * @param {File}   file
   * @param {DailyLog[]} currentLogs  — needed for merge mode
   * @param {"merge"|"replace"} mode
   * @param {(result: { logs:DailyLog[], warnings:string[], skipped:number, mode:string }) => void} onSuccess
   * @param {(err: string) => void} onError
   */
  importJSON(file, currentLogs, mode = "merge", onSuccess, onError) {
    // Guard: only accept .json files
    if (!file.name.toLowerCase().endsWith(".json") && file.type !== "application/json") {
      return onError("Файл должен быть .json");
    }
    // Guard: size limit 5 MB
    if (file.size > 5 * 1024 * 1024) {
      return onError("Файл слишком большой (лимит 5 МБ)");
    }

    const reader = new FileReader();

    reader.onerror = () => onError("Ошибка чтения файла");

    reader.onload = async e => {
      try {
        // 1. Parse JSON
        let parsed;
        try {
          parsed = JSON.parse(e.target.result);
        } catch {
          throw new Error("Невалидный JSON — файл повреждён");
        }

        // 2. Extract logs array (support wrapped {logs:[]} and bare [])
        const rawArr = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.logs)
          ? parsed.logs
          : null;

        if (!rawArr) throw new Error("Не найден массив logs в файле");
        if (rawArr.length === 0) throw new Error("Файл не содержит записей");

        // 3. Validate each record
        const { valid, skipped, warnings } = this._validateLogs(rawArr);
        if (valid.length === 0) throw new Error("Нет валидных записей после проверки");

        // 4. Run migrations on validated data
        const fromVersion = typeof parsed?.version === "number" ? parsed.version : 0;
        const { data: migrated } = runMigrations(valid, fromVersion);

        // 5. Merge or replace
        const final = mode === "merge"
          ? this._mergeLogs(currentLogs, migrated)
          : migrated;

        // 6. Save backup of current data before overwriting
        if (currentLogs.length > 0) await saveBackup(currentLogs, CURRENT_VERSION);

        // 7. Persist
        await rawSet(STORAGE_KEY, final);

        onSuccess({ logs: final, warnings, skipped, mode });

      } catch (err) {
        onError(err.message ?? "Неизвестная ошибка импорта");
      }
    };

    reader.readAsText(file);
  },
};


// ╔══════════════════════════════════════════════════════════╗
// ║  SECTION 4 — ANALYTICS LAYER                            ║
// ╚══════════════════════════════════════════════════════════╝
//
// Architecture:
//   Pure functions only — no side effects, no React imports.
//   Call computeAnalytics(logs) at the top level and memoize
//   with useMemo. Sub-functions are exported logically so they
//   can be unit-tested independently.
//
// Types live in Section 1 (JSDoc @typedef).

// ── Analytics JSDoc types ─────────────────────────────────

/**
 * @typedef {Object} WeightStats
 * Weight-specific metrics for the full period.
 * @property {number|null} start      First recorded weight (кг)
 * @property {number|null} current    Latest recorded weight (кг)
 * @property {number|null} min        All-time minimum weight (кг)
 * @property {number|null} max        All-time maximum weight (кг)
 * @property {number|null} delta      current - start, negative = loss
 * @property {number[]}    ma7        7-day moving average series
 * @property {number[]}    ma14       14-day moving average series
 * @property {number[]}    weights    Raw weight series (filtered, parsed)
 * @property {DailyLog[]}  wLogs      Logs that have a weight value
 * @property {{slope:number,start:number,end:number}|null} trend  Linear regression
 */

/**
 * @typedef {Object} NutritionStats
 * Caloric and macro averages across the full period.
 * @property {number} avgCal    Average daily calories
 * @property {number} avgProt   Average daily protein (г)
 * @property {number} avgCarbs  Average daily carbohydrates (г)
 * @property {number} avgFat    Average daily fat (г)
 * @property {{ date:string, value:number }[]} caloriesTimeline
 * @property {{ date:string, value:number }[]} proteinTimeline
 */

/**
 * @typedef {Object} AdherenceStats
 * How consistently the user follows their plan.
 * @property {number}   meals        Overall meal adherence 0-100 %
 * @property {number[]} perSlot      Per-meal-slot adherence [B, L, S, D] 0-100 %
 * @property {number}   workout      % of days with planned workout (силовая or кардио)
 * @property {number}   protein      % of days hitting protein target (≥ 150г)
 * @property {number}   streak       Current consecutive days with all 4 meals logged
 * @property {number}   bestStreak   All-time best streak
 */

/**
 * @typedef {Object} ProgressStats
 * Rate-of-change and projection metrics.
 * @property {number|null} weeklyRate   kg lost per week (negative = loss), all-period
 * @property {number|null} rate7d       kg lost per week based on last 7 weigh-ins
 * @property {number|null} rate14d      kg lost per week based on last 14 weigh-ins
 * @property {number|null} tdee         Estimated TDEE from energy balance (kcal)
 * @property {number|null} daysToGoal   Projected days to reach 75kg at current rate7d
 * @property {number}      proteinHitPct % days with protein ≥ target
 */

/**
 * @typedef {Object} WorkoutStats
 * @property {number} strength
 * @property {number} cardio
 * @property {number} rest
 * @property {number} total
 * @property {number} activePct  % of days that were strength or cardio
 */

/**
 * @typedef {Object} FullAnalytics
 * The complete analytics result returned by computeAnalytics().
 * @property {WeightStats}    weight
 * @property {NutritionStats} nutrition
 * @property {AdherenceStats} adherence
 * @property {ProgressStats}  progress
 * @property {WorkoutStats}   workouts
 */

// ── Primitives ────────────────────────────────────────────

/**
 * N-day simple moving average. O(n·w) but w is small (≤14).
 * @param {number[]} values
 * @param {number} [w=7]
 * @returns {number[]}
 */
function movingAverage(values, w = 7) {
  if (!values.length) return [];
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - w + 1), i + 1);
    return +(slice.reduce((a, b) => a + b, 0) / slice.length).toFixed(2);
  });
}

/**
 * Ordinary least-squares linear regression.
 * @param {number[]} values
 * @returns {{ slope:number, start:number, end:number }|null}
 */
function linearRegression(values) {
  const n = values.length;
  if (n < 3) return null;
  const sumX  = (n * (n - 1)) / 2;
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
  const sumY  = values.reduce((a, b) => a + b, 0);
  const sumXY = values.reduce((a, v, i) => a + i * v, 0);
  const denom = n * sumX2 - sumX ** 2;
  if (denom === 0) return null;
  const slope     = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope: +slope.toFixed(4), start: +intercept.toFixed(2), end: +(intercept + slope * (n - 1)).toFixed(2) };
}

/**
 * Average of a numeric string field across logs that have it.
 * @param {DailyLog[]} logs
 * @param {string} field
 * @returns {number}
 */
function avgField(logs, field) {
  const valid = logs.filter(l => parseFloat(l[field]) > 0);
  if (!valid.length) return 0;
  return Math.round(valid.reduce((a, l) => a + parseFloat(l[field]), 0) / valid.length);
}

/**
 * Timeline series for a numeric field (for charting).
 * @param {DailyLog[]} logs
 * @param {string} field
 * @returns {{ date:string, value:number }[]}
 */
function buildTimeline(logs, field) {
  return logs
    .filter(l => parseFloat(l[field]) > 0)
    .map(l => ({ date: l.date, value: parseFloat(l[field]) }));
}

/**
 * Weekly rate of change (kg/week) from the last N weight records.
 * Returns null if fewer than 2 records available.
 * @param {number[]} weights  Full sorted weight series
 * @param {number} [n]        Last N entries to use; defaults to all
 * @returns {number|null}
 */
function weeklyRate(weights, n) {
  const slice = n != null ? weights.slice(-n) : weights;
  if (slice.length < 2) return null;
  const weeks = (slice.length - 1) / 7;
  if (weeks === 0) return null;                      // guard: avoid ÷0
  const delta = slice[slice.length - 1] - slice[0];
  return +(delta / weeks).toFixed(2);
}

// ── Sub-functions (one concern each) ─────────────────────

/**
 * @param {DailyLog[]} logs
 * @returns {WeightStats}
 */
function computeWeightStats(logs) {
  const wLogs   = logs.filter(l => l.weight && !isNaN(parseFloat(l.weight)));
  const weights = wLogs.map(l => parseFloat(l.weight));

  if (!weights.length) {
    return { start:null, current:null, min:null, max:null, delta:null,
             ma7:[], ma14:[], weights:[], wLogs:[], trend:null };
  }

  const start   = weights[0];
  const current = weights[weights.length - 1];
  const min     = Math.min(...weights);
  const max     = Math.max(...weights);
  const delta   = +(current - start).toFixed(1);
  const ma7     = movingAverage(weights, 7);
  const ma14    = movingAverage(weights, 14);
  const trend   = linearRegression(weights);

  return { start, current, min, max, delta, ma7, ma14, weights, wLogs, trend };
}

/**
 * @param {DailyLog[]} logs
 * @returns {NutritionStats}
 */
function computeNutritionStats(logs) {
  return {
    avgCal:          avgField(logs, "calories"),
    avgProt:         avgField(logs, "protein"),
    avgCarbs:        avgField(logs, "carbs"),
    avgFat:          avgField(logs, "fat"),
    caloriesTimeline: buildTimeline(logs, "calories"),
    proteinTimeline:  buildTimeline(logs, "protein"),
  };
}

const PROTEIN_TARGET = 150; // г/день

/**
 * @param {DailyLog[]} logs
 * @returns {AdherenceStats}
 */
function computeAdherenceStats(logs) {
  if (!logs.length) return { meals:0, perSlot:[0,0,0,0], workout:0, protein:0, streak:0, bestStreak:0 };

  // Meal adherence per slot
  const perSlot = [0,1,2,3].map(i =>
    Math.round(logs.filter(l => l.meals?.[i]).length / logs.length * 100)
  );
  const meals = Math.round(perSlot.reduce((a, b) => a + b, 0) / 4);

  // Workout adherence: % of days that were strength or cardio
  const activeDays = logs.filter(l => l.workout === "силовая" || l.workout === "кардио").length;
  const workout = Math.round(activeDays / logs.length * 100);

  // Protein hit rate
  const proteinDays = logs.filter(l => parseFloat(l.protein) >= PROTEIN_TARGET).length;
  const protein = Math.round(proteinDays / logs.length * 100);

  // Current streak: consecutive days with all 4 meals
  let streak = 0;
  for (let i = logs.length - 1; i >= 0; i--) {
    if ((logs[i].meals || []).filter(Boolean).length === 4) streak++;
    else break;
  }

  // Best streak ever
  let bestStreak = 0, cur = 0;
  for (const l of logs) {
    if ((l.meals || []).filter(Boolean).length === 4) { cur++; bestStreak = Math.max(bestStreak, cur); }
    else cur = 0;
  }

  return { meals, perSlot, workout, protein, streak, bestStreak };
}

/**
 * @param {number[]} weights   Full weight series
 * @param {number} avgCal      Average daily calories
 * @returns {ProgressStats}
 */
function computeProgressStats(weights, avgCal) {
  const GOAL_KG = 75;

  const weeklyRateAll = weeklyRate(weights);
  const rate7d        = weeklyRate(weights, 7);
  const rate14d       = weeklyRate(weights, 14);

  // TDEE estimate: avgCal = TDEE + daily_deficit
  // daily_deficit = weeklyRateAll * 7700 / 7
  const tdee = weeklyRateAll != null && avgCal
    ? Math.round(avgCal - (weeklyRateAll * 7700) / 7)
    : null;

  // Days to goal using 7-day rate (most recent signal)
  const current = weights[weights.length - 1] ?? null;
  const daysToGoal = rate7d != null && rate7d < 0 && current != null && current > GOAL_KG
    ? Math.ceil((current - GOAL_KG) / Math.abs(rate7d) * 7)
    : null;

  const proteinHitPct = 0; // filled by adherence layer — kept here for compat

  return { weeklyRate: weeklyRateAll, rate7d, rate14d, tdee, daysToGoal, proteinHitPct };
}

/**
 * @param {DailyLog[]} logs
 * @returns {WorkoutStats}
 */
function computeWorkoutStats(logs) {
  const strength = logs.filter(l => l.workout === "силовая").length;
  const cardio   = logs.filter(l => l.workout === "кардио").length;
  const rest     = logs.filter(l => l.workout === "отдых").length;
  const total    = logs.length;
  const activePct = total ? Math.round((strength + cardio) / total * 100) : 0;
  return { strength, cardio, rest, total, activePct };
}

// ── Orchestrator ──────────────────────────────────────────

/**
 * Compute full analytics from logs.
 * Call this once with useMemo — do not call inside renders.
 *
 * @param {DailyLog[]} logs
 * @returns {FullAnalytics}
 */
function computeAnalytics(logs) {
  const weight    = computeWeightStats(logs);
  const nutrition = computeNutritionStats(logs);
  const adherence = computeAdherenceStats(logs);
  const progress  = computeProgressStats(weight.weights, nutrition.avgCal);
  const workouts  = computeWorkoutStats(logs);

  // Patch proteinHitPct from adherence into progress
  progress.proteinHitPct = adherence.protein;

  // Backwards-compat flat fields (used by existing UI components)
  return {
    weight,
    nutrition,
    adherence,
    progress,
    workouts,
    // ── Flat aliases (so existing destructuring doesn't break) ──
    start:             weight.start,
    current:           weight.current,
    min:               weight.min,
    max:               weight.max,
    delta:             weight.delta,
    ma7:               weight.ma7,
    ma14:              weight.ma14,
    weights:           weight.weights,
    wLogs:             weight.wLogs,
    avgCal:            nutrition.avgCal,
    avgProt:           nutrition.avgProt,
    avgCarbs:          nutrition.avgCarbs,
    avgFat:            nutrition.avgFat,
    caloriesTimeline:  nutrition.caloriesTimeline,
    proteinTimeline:   nutrition.proteinTimeline,
    weeklyLoss:        progress.weeklyRate,
    tdee:              progress.tdee,
    proteinHitPct:     adherence.protein,
    adherence:         adherence.meals,
    adherencePerSlot:  adherence.perSlot,
    streak:            adherence.streak,
    workouts:          workouts,    // NOTE: shadows flat workouts object
  };
}


// ╔══════════════════════════════════════════════════════════╗
// ║  SECTION 4b — SMART INSIGHTS SYSTEM                     ║
// ╚══════════════════════════════════════════════════════════╝
//
// Architecture:
//   - RULES[]  registry of pure InsightRule objects
//   - generateInsights(logs, stats) runs each rule's check(),
//     collects fired rules, sorts by priority, caps at MAX_INSIGHTS
//   - InsightsPanel component renders them as subtle inline cards
//   - Adding a new rule = one object in RULES, zero other changes

// ── Insight types (JSDoc) ─────────────────────────────────

/**
 * @typedef {"warning"|"info"|"success"} InsightSeverity
 */

/**
 * @typedef {"protein"|"fats"|"calories"|"weight"|"plateau"|"meals"|"streak"|"pace"} InsightCategory
 */

/**
 * @typedef {Object} InsightRule
 * Pure rule definition. No state, no side effects.
 * @property {string}           id         Stable unique key
 * @property {InsightCategory}  category
 * @property {InsightSeverity}  severity
 * @property {number}           priority   1 = highest; lower shown first
 * @property {(logs: DailyLog[], stats: FullAnalytics) => boolean} check
 *   Return true when this insight should fire.
 * @property {(logs: DailyLog[], stats: FullAnalytics) => string} message
 *   Human-readable message. Called only when check() === true.
 * @property {((logs: DailyLog[], stats: FullAnalytics) => string|null)} [detail]
 *   Optional one-line sub-text with numbers / context.
 */

/**
 * @typedef {Object} Insight
 * A fired insight ready for rendering.
 * @property {string}           id
 * @property {InsightCategory}  category
 * @property {InsightSeverity}  severity
 * @property {number}           priority
 * @property {string}           message
 * @property {string|null}      detail
 */

// ── Helpers used only by rules ────────────────────────────

/**
 * Average of a numeric field over the last N logs that have it.
 * @param {DailyLog[]} logs
 * @param {string} field
 * @param {number} n
 * @returns {number|null}  null when fewer than n/2 records available
 */
function recentAvg(logs, field, n) {
  const slice = logs.slice(-n).filter(l => parseFloat(l[field]) > 0);
  if (slice.length < Math.ceil(n / 2)) return null;   // need at least half
  return slice.reduce((a, l) => a + parseFloat(l[field]), 0) / slice.length;
}

/**
 * Weight values for the last N weigh-in logs.
 * @param {DailyLog[]} logs
 * @param {number} n
 * @returns {number[]}
 */
function recentWeights(logs, n) {
  return logs
    .filter(l => l.weight && !isNaN(parseFloat(l.weight)))
    .slice(-n)
    .map(l => parseFloat(l.weight));
}

/** @param {number} x @param {number} decimals */
const fmt = (x, decimals = 1) => x.toFixed(decimals);

// ── Rules registry ────────────────────────────────────────
// To add a rule: append one object. That's it.

/** @type {InsightRule[]} */
const RULES = [
  // ── 1. Protein below target ───────────────────────────
  {
    id:       "protein_low",
    category: "protein",
    severity: "warning",
    priority: 1,
    check(logs) {
      const avg = recentAvg(logs, "protein", 3);
      return avg !== null && avg < 130;
    },
    message: () => "Белок ниже нормы последние 3 дня",
    detail(logs) {
      const avg = recentAvg(logs, "protein", 3);
      return avg !== null ? `Среднее ${fmt(avg)}г — цель 150г+` : null;
    },
  },

  // ── 2. Fats too low ───────────────────────────────────
  {
    id:       "fats_low",
    category: "fats",
    severity: "warning",
    priority: 2,
    check(logs) {
      const avg = recentAvg(logs, "fat", 7);
      return avg !== null && avg < 30;
    },
    message: () => "Жиры слишком низкие 7 дней подряд",
    detail(logs) {
      const avg = recentAvg(logs, "fat", 7);
      return avg !== null ? `Среднее ${fmt(avg)}г/день — минимум 30г для гормонов` : null;
    },
  },

  // ── 3. Calories too low ───────────────────────────────
  {
    id:       "calories_very_low",
    category: "calories",
    severity: "warning",
    priority: 3,
    check(logs) {
      const avg = recentAvg(logs, "calories", 5);
      return avg !== null && avg < 1400;
    },
    message: () => "Очень низкая калорийность 5 дней",
    detail(logs) {
      const avg = recentAvg(logs, "calories", 5);
      return avg !== null ? `Среднее ${Math.round(avg)} ккал — риск потери мышц` : null;
    },
  },

  // ── 4. Rapid weight loss ──────────────────────────────
  {
    id:       "rapid_loss",
    category: "pace",
    severity: "warning",
    priority: 4,
    check(logs, stats) {
      const r = stats?.progress?.rate7d;
      return r != null && r < -1.5;
    },
    message: () => "Слишком быстрое снижение веса",
    detail(_, stats) {
      const r = stats?.progress?.rate7d;
      return r != null ? `${fmt(r)} кг/нед — безопасный предел −1.0 кг/нед` : null;
    },
  },

  // ── 5. Plateau detection ──────────────────────────────
  {
    id:       "plateau",
    category: "plateau",
    severity: "info",
    priority: 5,
    check(logs) {
      const w = recentWeights(logs, 10);
      if (w.length < 6) return false;
      const span = Math.max(...w) - Math.min(...w);
      return span < 0.4;
    },
    message: () => "Плато: вес стабилен 10 взвешиваний",
    detail(logs) {
      const w = recentWeights(logs, 10);
      const span = Math.max(...w) - Math.min(...w);
      return `Диапазон ±${fmt(span / 2, 2)} кг — рассмотри углеводное чередование`;
    },
  },

  // ── 6. Missed meals streak ────────────────────────────
  {
    id:       "missed_meals",
    category: "meals",
    severity: "info",
    priority: 6,
    check(logs) {
      const recent = logs.slice(-3);
      if (recent.length < 3) return false;
      return recent.every(l => (l.meals || []).filter(Boolean).length < 3);
    },
    message: () => "Пропуски приёмов пищи 3 дня подряд",
    detail(logs) {
      const recent = logs.slice(-3);
      const avg = recent.reduce((a, l) => a + (l.meals || []).filter(Boolean).length, 0) / recent.length;
      return `В среднем ${fmt(avg, 0)}/4 приёмов — старайся держать 4/4`;
    },
  },

  // ── 7. Protein streak celebration ────────────────────
  {
    id:       "protein_streak",
    category: "protein",
    severity: "success",
    priority: 7,
    check(logs) {
      if (logs.length < 5) return false;
      const recent = logs.slice(-5);
      return recent.every(l => parseFloat(l.protein) >= 150);
    },
    message: () => "Белок в норме 5 дней подряд 💪",
    detail(logs) {
      const recent = logs.slice(-5);
      const avg = recent.reduce((a, l) => a + parseFloat(l.protein), 0) / recent.length;
      return `Среднее ${fmt(avg, 0)}г/день — отлично!`;
    },
  },

  // ── 8. Meal adherence streak celebration ─────────────
  {
    id:       "meal_streak",
    category: "streak",
    severity: "success",
    priority: 8,
    check(logs, stats) {
      const s = stats?.adherence?.streak ?? stats?.streak ?? 0;
      return s >= 7;
    },
    message(_, stats) {
      const s = stats?.adherence?.streak ?? stats?.streak ?? 0;
      return `Серия ${s} дней — все приёмы пищи! 🔥`;
    },
    detail: () => "Продолжай в том же духе",
  },

  // ── 9. Good weekly pace ───────────────────────────────
  {
    id:       "good_pace",
    category: "pace",
    severity: "success",
    priority: 9,
    check(logs, stats) {
      const r = stats?.progress?.rate7d;
      return r != null && r <= -0.3 && r >= -1.0;
    },
    message: () => "Темп снижения в норме",
    detail(_, stats) {
      const r = stats?.progress?.rate7d;
      return r != null ? `${fmt(r)} кг/нед — безопасная зона −0.3…−1.0` : null;
    },
  },

  // ── 10. New minimum ───────────────────────────────────
  {
    id:       "new_minimum",
    category: "weight",
    severity: "success",
    priority: 2,   // high priority — celebrate immediately
    check(logs) {
      const w = recentWeights(logs, logs.length);
      if (w.length < 2) return false;
      const latest = w[w.length - 1];
      const previous = Math.min(...w.slice(0, -1));
      return latest < previous;
    },
    message: () => "Новый минимум веса! 🏆",
    detail(logs) {
      const w = recentWeights(logs, logs.length);
      return `${w[w.length - 1]} кг — личный рекорд`;
    },
  },
];

// ── Orchestrator ──────────────────────────────────────────

const MAX_INSIGHTS = 4;   // cap so the panel never overwhelms

/**
 * Run all rules, collect fired ones, sort and cap.
 * Pure function — memoize with useMemo at call site.
 *
 * @param {DailyLog[]} logs
 * @param {FullAnalytics} stats
 * @returns {Insight[]}
 */
function generateInsights(logs, stats) {
  if (!logs.length) return [];

  const fired = [];

  for (const rule of RULES) {
    try {
      if (!rule.check(logs, stats)) continue;
      fired.push({
        id:       rule.id,
        category: rule.category,
        severity: rule.severity,
        priority: rule.priority,
        message:  rule.message(logs, stats),
        detail:   rule.detail ? rule.detail(logs, stats) : null,
      });
    } catch (e) {
      // Never let a buggy rule crash the whole app
      console.warn(`[insight rule ${rule.id}]`, e);
    }
  }

  // Warnings first, then info, then success; break ties by priority number
  const ORDER = { warning: 0, info: 1, success: 2 };
  return fired
    .sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || a.priority - b.priority)
    .slice(0, MAX_INSIGHTS);
}

// ── InsightsPanel component ───────────────────────────────

/** Severity → subtle left-border colour (no fill, no popups). */
const INSIGHT_COLOR = {
  warning: T.amber,
  info:    T.blue,
  success: T.green,
};

const INSIGHT_ICON = {
  warning: "⚠️",
  info:    "💡",
  success: "✅",
};

/**
 * Inline panel rendered in Tab 0 below the day selector.
 * Disappears when there are no insights.
 * @param {{ insights: Insight[] }} props
 */
const InsightsPanel = memo(function InsightsPanel({ insights }) {
  if (!insights.length) return null;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
      {insights.map(ins => {
        const color = INSIGHT_COLOR[ins.severity];
        return (
          <div key={ins.id} style={{
            display: "flex",
            gap: "10px",
            padding: "10px 12px",
            borderRadius: T.radiusSm,
            background: T.bgCard,
            borderLeft: `3px solid ${color}`,
            border: `1px solid ${T.border}`,
            borderLeftColor: color,
          }}>
            <span style={{ fontSize:"14px", flexShrink:0, lineHeight:"1.4" }}>
              {INSIGHT_ICON[ins.severity]}
            </span>
            <div style={{ minWidth:0 }}>
              <div style={{ fontSize:"12px", fontWeight:"600", color:T.text, lineHeight:"1.4" }}>
                {ins.message}
              </div>
              {ins.detail && (
                <div style={{ fontSize:"11px", color:T.textMuted, marginTop:"2px", lineHeight:"1.4" }}>
                  {ins.detail}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
});



/** @type {Plan} */
const PLAN = {
  calories: 1800, protein: 160, carbs: 150, fat: 45,
  meals: [
    { time:"08:00", emoji:"🌅", title:"Завтрак",        desc:"Овсянка 20-25г + льняное масло + белок жидкий + какао",         kcal:370, p:16, c:25, f:20 },
    { time:"12:00", emoji:"🍽",  title:"Обед",           desc:"Белок 170-180г + крупа/паста 140г + овощи",                     kcal:535, p:46, c:44, f:12 },
    { time:"15:30", emoji:"🥜", title:"Перекус",         desc:"Белок 150г + крупа 100г + овощи",                               kcal:460, p:42, c:38, f:8  },
    { time:"18:00", emoji:"🍍", title:"Последний приём", desc:"Белок 110г + кв. капуста + ананас + банан + протеин 1.5 скупа", kcal:520, p:63, c:37, f:8  },
    { time:"20:00", emoji:"🏋️", title:"Тренировка",      desc:"Силовая / Кардио",                                             kcal:null, p:0, c:0, f:0 },
  ],
};

const MEAL_NAMES  = ["🌅 Завтрак","🍽 Обед","🥜 Перекус","🍍 Последний приём"];
const MEAL_EMOJIS = ["🌅","🍽","🥜","🍍"];

// ╔══════════════════════════════════════════════════════════╗
// ║  SECTION 6 — COMPONENTS                                 ║
// ╚══════════════════════════════════════════════════════════╝

// ── Ring ─────────────────────────────────────────────────────
/**
 * @param {{ value:string|number, max:number, color:string, label:string, unit:string }} props
 */
const Ring = memo(function Ring({ value, max, color, label, unit }) {
  const pct   = Math.min((parseFloat(value) || 0) / max, 1);
  const r     = 28, cx = 36, cy = 36, stroke = 5;
  const circ  = 2 * Math.PI * r;
  const dash  = circ * pct;
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"4px" }}>
      <svg width="72" height="72">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={T.border} strokeWidth={stroke}/>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ-dash}`} strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition:"stroke-dasharray 0.5s ease" }}/>
        <text x={cx} y={cy-4} textAnchor="middle" fill={T.text}    fontSize="11" fontWeight="700">{value||"—"}</text>
        <text x={cx} y={cy+9} textAnchor="middle" fill={T.textSub} fontSize="9">{unit}</text>
      </svg>
      <span style={{ fontSize:"10px", color:T.textSub }}>{label}</span>
    </div>
  );
});

// ── MacroRings ────────────────────────────────────────────────
/** Four macro rings for a given log entry. */
const MacroRings = memo(function MacroRings({ log }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-around" }}>
      <Ring value={log.calories} max={PLAN.calories} color={T.amber}  label="Калории"  unit="ккал"/>
      <Ring value={log.protein}  max={PLAN.protein}  color={T.green}  label="Белок"    unit="г"/>
      <Ring value={log.carbs}    max={PLAN.carbs}    color={T.blue}   label="Углеводы" unit="г"/>
      <Ring value={log.fat}      max={PLAN.fat}      color={T.pink}   label="Жиры"     unit="г"/>
    </div>
  );
});

// ── WeightChart ───────────────────────────────────────────────
/**
 * @param {{ wLogs:DailyLog[], weights:number[], ma7:number[], start:number|null, min:number|null, delta:number|null }} props
 */
const WeightChart = memo(function WeightChart({ wLogs, weights, ma7, start, min, delta }) {
  if (weights.length < 2) {
    return (
      <div style={{ color:T.textGhost, fontSize:"12px", textAlign:"center", padding:"20px 0" }}>
        Нужно минимум 2 записи с весом
      </div>
    );
  }

  const W = 340, H = 110;
  const PAD = { t:18, r:28, b:8, l:8 };
  const cW = W - PAD.l - PAD.r, cH = H - PAD.t - PAD.b;

  const allVals = [...weights, ...ma7].filter(Boolean);
  const yMin = Math.min(...allVals) - 0.3;
  const yMax = Math.max(...allVals) + 0.3;

  const toX = i => PAD.l + (i / Math.max(weights.length - 1, 1)) * cW;
  const toY = v => PAD.t + cH - ((v - yMin) / (yMax - yMin)) * cH;

  // Smooth cubic bezier path
  const pts  = weights.map((v, i) => ({ x: toX(i), y: toY(v) }));
  const maPts = ma7.map((v, i) => ({ x: toX(i), y: toY(v) }));

  function toPath(points) {
    if (points.length < 2) return "";
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i-1)];
      const p1 = points[i];
      const p2 = points[i+1];
      const p3 = points[Math.min(points.length-1, i+2)];
      const t  = 0.25;
      const cp1x = p1.x + (p2.x - p0.x) * t;
      const cp1y = p1.y + (p2.y - p0.y) * t;
      const cp2x = p2.x - (p3.x - p1.x) * t;
      const cp2y = p2.y - (p3.y - p1.y) * t;
      d += ` C ${cp1x} ${cp1y},${cp2x} ${cp2y},${p2.x} ${p2.y}`;
    }
    return d;
  }

  const mainPath = toPath(pts);
  const maPath   = toPath(maPts);
  const areaPath = mainPath
    ? `${mainPath} L ${pts.at(-1).x} ${PAD.t+cH} L ${pts[0].x} ${PAD.t+cH} Z`
    : "";

  // Y-grid
  const range = yMax - yMin;
  const step  = range > 4 ? 1 : 0.5;
  const gridStart = Math.ceil(yMin / step) * step;
  const gridLines = [];
  for (let v = gridStart; v <= yMax; v = +(v + step).toFixed(1)) gridLines.push(v);

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display:"block" }}>
        <defs>
          <linearGradient id="wArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={T.green} stopOpacity="0.18"/>
            <stop offset="100%" stopColor={T.green} stopOpacity="0"/>
          </linearGradient>
        </defs>

        {/* Grid */}
        {gridLines.map(v => {
          const y = toY(v);
          if (y < PAD.t || y > PAD.t + cH) return null;
          return (
            <g key={v}>
              <line x1={PAD.l} y1={y} x2={W-PAD.r} y2={y} stroke={T.border} strokeWidth="1"/>
              <text x={W-PAD.r+3} y={y+3.5} fill={T.textDark} fontSize="7.5" textAnchor="start">{v}</text>
            </g>
          );
        })}

        {/* Area fill */}
        {areaPath && <path d={areaPath} fill="url(#wArea)"/>}

        {/* MA7 line */}
        {maPath && (
          <path d={maPath} fill="none" stroke="rgba(74,222,128,0.4)" strokeWidth="1.8"
            strokeDasharray="5 3" strokeLinecap="round"/>
        )}

        {/* Main line */}
        {mainPath && (
          <path d={mainPath} fill="none" stroke={T.green} strokeWidth="2.5" strokeLinecap="round"/>
        )}

        {/* Points */}
        {pts.map(({ x, y }, i) => {
          const v      = weights[i];
          const isMin  = v === min;
          const show   = isMin || i === 0 || i === weights.length - 1;
          return (
            <g key={i}>
              {isMin && <circle cx={x} cy={y} r={10} fill={T.amber} opacity="0.12"/>}
              <circle cx={x} cy={y} r={isMin ? 5 : 3.5}
                fill={isMin ? T.amber : T.green} stroke={T.bg} strokeWidth="1.5"/>
              {show && (
                <text x={x} y={y-(isMin?7:6)} textAnchor="middle"
                  fill={isMin ? T.amber : T.textSub}
                  fontSize="8" fontWeight={isMin?"700":"400"}>{v}</text>
              )}
            </g>
          );
        })}
      </svg>

      <div style={{ display:"flex", justifyContent:"space-between", marginTop:"6px", padding:"0 4px" }}>
        <span style={{ fontSize:"11px", color:T.textMuted }}>Старт: {start} кг</span>
        {delta != null && (
          <span style={{ fontSize:"11px", fontWeight:"600", color: parseFloat(delta) <= 0 ? T.green : T.red }}>
            {parseFloat(delta) <= 0 ? "▼" : "▲"} {Math.abs(parseFloat(delta))} кг
          </span>
        )}
        <span style={{ fontSize:"11px", color:T.amber }}>Мин: {min} кг</span>
      </div>
      <div style={{ fontSize:"10px", color:T.textGhost, textAlign:"center", marginTop:"4px" }}>
        — — скользящее среднее 7 дней
      </div>
    </div>
  );
});

// ── DayDetail ─────────────────────────────────────────────────
/**
 * @param {{ log:DailyLog, onClose:()=>void, onSave:(log:DailyLog)=>void }} props
 */
function DayDetail({ log, onClose, onSave }) {
  const [details, setDetails] = useState(log.mealDetails ?? ["","","",""]);
  const [dirty,   setDirty]   = useState(false);
  const wc = WCOLOR[log.workout] ?? WCOLOR["отдых"];

  const handleChange = useCallback((i, val) => {
    setDetails(prev => { const next = [...prev]; next[i] = val; return next; });
    setDirty(true);
  }, []);

  const handleSave = useCallback(() => {
    onSave({ ...log, mealDetails: details });
    setDirty(false);
  }, [log, details, onSave]);

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.88)", zIndex:100,
      display:"flex", alignItems:"flex-end", justifyContent:"center" }} onClick={onClose}>
      <div style={{ background:"#0d0d0d", borderRadius:"20px 20px 0 0", width:"100%",
        maxWidth:"420px", maxHeight:"90vh", overflowY:"auto", padding:"20px 16px 36px" }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px" }}>
          <div>
            <div style={{ fontSize:"16px", fontWeight:"700" }}>{log.date}</div>
            <div style={{ display:"flex", gap:"8px", alignItems:"center", marginTop:"4px" }}>
              <span style={{ fontSize:"13px", color:T.green, fontWeight:"600" }}>
                {log.weight ? `${log.weight} кг` : "—"}
              </span>
              <span style={S.tag(log.workout)}>{log.workout}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background:"#1f2937", border:"none", color:T.textSub,
            borderRadius:T.radiusFull, width:"32px", height:"32px", cursor:"pointer", fontSize:"16px" }}>✕</button>
        </div>

        {/* КБЖУ */}
        <div style={sx(S.cardSm, { marginBottom:"12px" })}>
          <div style={{ fontSize:"11px", color:T.textMuted, marginBottom:"10px" }}>КБЖУ за день</div>
          <MacroRings log={log}/>
        </div>

        {/* Editable meal details */}
        <div style={{ marginBottom:"12px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"8px" }}>
            <div style={{ fontSize:"12px", color:T.textMuted, fontWeight:"600" }}>Что съел</div>
            {dirty && (
              <button onClick={handleSave} style={{ fontSize:"11px", padding:"4px 10px",
                borderRadius:T.radiusSm, background:T.green, color:"#000", border:"none",
                cursor:"pointer", fontWeight:"600" }}>Сохранить</button>
            )}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
            {MEAL_NAMES.map((name, i) => (
              <div key={i} style={sx(S.cardSm, {
                border: `1px solid ${log.meals?.[i] ? "rgba(74,222,128,0.25)" : T.border}`
              })}>
                <div style={{ fontSize:"12px", fontWeight:"600", marginBottom:"4px",
                  color: log.meals?.[i] ? T.green : T.textGhost }}>
                  {name} {log.meals?.[i] ? "✓" : "✗"}
                </div>
                <textarea value={details[i] || ""} rows={2}
                  placeholder={log.meals?.[i] ? "По плану" : "Не съел"}
                  onChange={e => handleChange(i, e.target.value)}
                  style={{ width:"100%", background:"transparent", border:"none",
                    borderTop:`1px solid ${T.borderSub}`, color:T.textSub,
                    fontSize:"11px", lineHeight:"1.5", resize:"none", outline:"none",
                    paddingTop:"6px", fontFamily:T.fontSans, boxSizing:"border-box" }}/>
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        {log.notes && (
          <div style={S.cardSm}>
            <div style={{ fontSize:"12px", color:T.textMuted, marginBottom:"4px", fontWeight:"600" }}>Заметки</div>
            <div style={{ fontSize:"12px", color:T.textSub, lineHeight:"1.5" }}>{log.notes}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── DayForm meal presets ──────────────────────────────────────

// ╔══════════════════════════════════════════════════════════╗
// ║  SECTION 6b — MEAL PRESET SYSTEM                        ║
// ╚══════════════════════════════════════════════════════════╝

/**
 * @typedef {"breakfast"|"lunch"|"snack"|"dinner"|"protein"} PresetCategory
 */

/**
 * @typedef {Object} MealPreset
 * @property {string}          id        Stable unique key (used for React key)
 * @property {string}          label     Short display label, e.g. "🍗 Курица + рис"
 * @property {PresetCategory}  category
 * @property {number[]}        slots     Which meal slots this preset suits (0=завтрак…3=ужин)
 * @property {string}          detail    Text that fills mealDetails[slot]
 * @property {{calories:number,protein:number,carbs:number,fat:number}} [macros]
 *   Optional — when present, ADDS to existing log macros (not replaces)
 * @property {string[]}        [tags]    For future search / filtering
 */

/** @type {MealPreset[]} */
const PRESETS = [
  // ── Завтрак (slot 0) ──────────────────────────────────
  {
    id: "b_oat_oil",
    label: "🌾 Овсянка + масло",
    category: "breakfast", slots: [0],
    detail: "Овсянка 20-25г + льняное масло 1 ст.л. + какао 7г",
    macros: { calories: 280, protein: 6, carbs: 28, fat: 15 },
    tags: ["oats","linseed"],
  },
  {
    id: "b_oat_white",
    label: "🥚 Овсянка + белок",
    category: "breakfast", slots: [0],
    detail: "Овсянка 20г + белок жидкий 150мл + льняное масло + какао 7г",
    macros: { calories: 370, protein: 22, carbs: 25, fat: 16 },
    tags: ["oats","egg_white"],
  },
  {
    id: "b_granola",
    label: "🥣 Гранола AXA",
    category: "breakfast", slots: [0],
    detail: "Гранола AXA 35-40г + льняное масло + какао 7г",
    macros: { calories: 350, protein: 7, carbs: 42, fat: 16 },
    tags: ["granola"],
  },
  {
    id: "b_rice_egg",
    label: "🍚 Рис + яйца",
    category: "breakfast", slots: [0],
    detail: "Рис 130г + яйца 2шт + маасдам 15г",
    macros: { calories: 445, protein: 22, carbs: 30, fat: 16 },
    tags: ["rice","egg"],
  },
  {
    id: "b_bar",
    label: "⚡ Батончик",
    category: "breakfast", slots: [0],
    detail: "Батончик протеиновый 80г + кофе",
    macros: { calories: 310, protein: 28, carbs: 22, fat: 7 },
    tags: ["bar"],
  },

  // ── Обед / Перекус (slots 1, 2) ───────────────────────
  {
    id: "l_chicken_rice",
    label: "🍗 Курица + рис",
    category: "lunch", slots: [1, 2],
    detail: "Курица 170-180г + рис 150-180г готового + морковь корейская 80г",
    macros: { calories: 530, protein: 44, carbs: 45, fat: 8 },
    tags: ["chicken","rice"],
  },
  {
    id: "l_chicken_buckwheat",
    label: "🍗 Курица + гречка",
    category: "lunch", slots: [1, 2],
    detail: "Курица 170г + гречка 180г готовой + морковь корейская 80г",
    macros: { calories: 500, protein: 43, carbs: 42, fat: 7 },
    tags: ["chicken","buckwheat"],
  },
  {
    id: "l_chicken_bulgur",
    label: "🍗 Курица + булгур",
    category: "lunch", slots: [1, 2],
    detail: "Курица 170г + булгур 170г готового + морковь корейская 80г",
    macros: { calories: 510, protein: 43, carbs: 45, fat: 7 },
    tags: ["chicken","bulgur"],
  },
  {
    id: "l_beef_buckwheat",
    label: "🥩 Котлеты говяжьи",
    category: "lunch", slots: [1, 2],
    detail: "Котлеты говяжьи 160г + гречка 180г готовой + морковь корейская 80г",
    macros: { calories: 560, protein: 38, carbs: 45, fat: 22 },
    tags: ["beef","buckwheat"],
  },
  {
    id: "l_chicken_cutlets",
    label: "🍗 Котлеты куриные",
    category: "lunch", slots: [1, 2],
    detail: "Котлеты куриные 160г + гречка/рис 180г + маасдам 20г",
    macros: { calories: 520, protein: 44, carbs: 40, fat: 14 },
    tags: ["chicken","cutlets"],
  },
  {
    id: "l_puzata",
    label: "🏠 Пузата Хата",
    category: "lunch", slots: [1, 2],
    detail: "Стейк куриный гриль 2×90г + гречка 200г + салаты 2×200г",
    macros: { calories: 445, protein: 27, carbs: 55, fat: 12 },
    tags: ["restaurant","puzata"],
  },
  {
    id: "l_kungsao",
    label: "🌶 Кунг Пао",
    category: "lunch", slots: [1, 2],
    detail: "Кунг Пао курица 470г + зелёный салат 300г (Скромний)",
    macros: { calories: 870, protein: 49, carbs: 57, fat: 43 },
    tags: ["restaurant","skromnyi"],
  },

  // ── Ужин / Последний приём (slots 2, 3) ───────────────
  {
    id: "d_chicken_cabbage",
    label: "🥬 Курица + капуста",
    category: "dinner", slots: [2, 3],
    detail: "Курица 120г + квашеная капуста 70г",
    macros: { calories: 195, protein: 27, carbs: 5, fat: 4 },
    tags: ["chicken","cabbage"],
  },
  {
    id: "d_chicken_banana",
    label: "🍌 Курица + банан",
    category: "dinner", slots: [2, 3],
    detail: "Курица 120г + квашеная капуста 70г + банан 100г",
    macros: { calories: 285, protein: 28, carbs: 28, fat: 4 },
    tags: ["chicken","banana"],
  },

  // ── Протеин (все слоты) ────────────────────────────────
  {
    id: "p_whey_1",
    label: "🥤 Протеин 1 скуп",
    category: "protein", slots: [0, 1, 2, 3],
    detail: "Протеин 1 скуп (30г)",
    macros: { calories: 120, protein: 23, carbs: 4, fat: 1 },
    tags: ["whey"],
  },
  {
    id: "p_whey_15",
    label: "🥤 Протеин 1.5 скупа",
    category: "protein", slots: [0, 1, 2, 3],
    detail: "Протеин 1.5 скупа (45г)",
    macros: { calories: 180, protein: 35, carbs: 6, fat: 2 },
    tags: ["whey"],
  },
  {
    id: "p_whey_banana",
    label: "🥤🍌 Протеин + банан",
    category: "protein", slots: [0, 1, 2, 3],
    detail: "Протеин 1.5 скупа + банан 60-80г",
    macros: { calories: 255, protein: 36, carbs: 25, fat: 2 },
    tags: ["whey","banana"],
  },
  {
    id: "p_monster",
    label: "👾 Батончик Monsters",
    category: "protein", slots: [0, 1, 2, 3],
    detail: "Батончик Monsters 80г (клубника/шоколад)",
    macros: { calories: 271, protein: 28, carbs: 20, fat: 6 },
    tags: ["bar","monsters"],
  },
  {
    id: "p_joes",
    label: "🥜 Joe's Cookie Dough",
    category: "protein", slots: [0, 1, 2, 3],
    detail: "Weider Joe's Cookie Dough Peanut 50г",
    macros: { calories: 197, protein: 14, carbs: 17, fat: 10 },
    tags: ["bar","joes"],
  },
];

/**
 * Filter presets for a given meal slot.
 * @param {number} slot  0-3
 * @returns {MealPreset[]}
 */
function presetsForSlot(slot) {
  return PRESETS.filter(p => p.slots.includes(slot));
}

/**
 * Apply a preset to a log, returning a patched copy.
 * Macros ADD onto existing values (not replace) so you can
 * apply multiple presets per slot progressively.
 * Pass addMacros=false to skip macro accumulation.
 *
 * @param {DailyLog} log
 * @param {number} slot
 * @param {MealPreset} preset
 * @param {{ addMacros?: boolean }} [opts]
 * @returns {DailyLog}
 */
function applyPreset(log, slot, preset, opts = {}) {
  const { addMacros = true } = opts;

  // Update mealDetails for this slot
  const mealDetails = [...(log.mealDetails ?? ["","","",""])];
  const existing = mealDetails[slot] ? mealDetails[slot] + " + " : "";
  mealDetails[slot] = existing + preset.detail;

  // Mark meal as eaten
  const meals = [...(log.meals ?? [false,false,false,false])];
  meals[slot] = true;

  // Optionally accumulate macros
  if (addMacros && preset.macros) {
    return {
      ...log,
      meals,
      mealDetails,
      calories: String(Math.round((parseFloat(log.calories) || 0) + preset.macros.calories)),
      protein:  String(Math.round((parseFloat(log.protein)  || 0) + preset.macros.protein)),
      carbs:    String(Math.round((parseFloat(log.carbs)    || 0) + preset.macros.carbs)),
      fat:      String(Math.round((parseFloat(log.fat)      || 0) + preset.macros.fat)),
    };
  }

  return { ...log, meals, mealDetails };
}

/**
 * Horizontal scrollable row of preset quick-tap chips for one meal slot.
 * @param {{ slot:number, onApply:(preset:MealPreset)=>void }} props
 */
const PresetRow = memo(function PresetRow({ slot, onApply }) {
  const presets = useMemo(() => presetsForSlot(slot), [slot]);
  const [expanded, setExpanded] = useState(false);

  // Show 3 most relevant presets collapsed, all when expanded
  const visible = expanded ? presets : presets.slice(0, 3);

  return (
    <div style={{ marginTop:"6px" }}>
      <div style={{ display:"flex", gap:"5px", overflowX:"auto", paddingBottom:"2px",
        WebkitOverflowScrolling:"touch", scrollbarWidth:"none" }}>
        {visible.map(p => (
          <button
            key={p.id}
            onClick={() => onApply(p)}
            title={p.detail}
            style={{
              flexShrink: 0,
              padding: "4px 10px",
              borderRadius: "999px",
              fontSize: "11px",
              fontWeight: "500",
              cursor: "pointer",
              background: "rgba(255,255,255,0.04)",
              color: T.textSub,
              border: `1px solid ${T.borderSub}`,
              whiteSpace: "nowrap",
              transition: "background 0.15s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = T.greenDim}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
          >
            {p.label}
          </button>
        ))}
        {presets.length > 3 && (
          <button
            onClick={() => setExpanded(v => !v)}
            style={{
              flexShrink: 0,
              padding: "4px 10px",
              borderRadius: "999px",
              fontSize: "11px",
              cursor: "pointer",
              background: "transparent",
              color: T.textGhost,
              border: `1px solid ${T.border}`,
              whiteSpace: "nowrap",
            }}
          >
            {expanded ? "▲ свернуть" : `+${presets.length - 3}`}
          </button>
        )}
      </div>
    </div>
  );
});

// ── DayForm (extracted from Tab 0) ───────────────────────────
/**
 * @param {{ log:DailyLog, onChange:(log:DailyLog)=>void }} props
 */
const DayForm = memo(function DayForm({ log, onChange }) {
  const update = useCallback(patch => onChange({ ...log, ...patch }), [log, onChange]);

  const toggleMeal = useCallback(i => {
    const meals = [...(log.meals || [false,false,false,false])];
    meals[i] = !meals[i];
    update({ meals });
  }, [log.meals, update]);

  return (
    <div style={S.section}>
      {/* Date + Weight */}
      <div style={S.grid2}>
        {[
          { label:"Дата",     field:"date",   placeholder:"дд.мм.гггг", type:"text"   },
          { label:"Вес (кг)", field:"weight", placeholder:"80.0",       type:"number" },
        ].map(({ label, field, placeholder, type }) => (
          <div key={field}>
            <div style={S.label}>{label}</div>
            <input type={type} placeholder={placeholder} value={log[field]}
              onChange={e => update({ [field]: e.target.value })}
              style={S.input}/>
          </div>
        ))}
      </div>

      {/* Workout type */}
      <div>
        <div style={S.label}>Тренировка</div>
        <div style={{ display:"flex", gap:"6px" }}>
          {["силовая","кардио","отдых"].map(w => (
            <button key={w} onClick={() => update({ workout: w })}
              style={{ flex:1, padding:"8px", borderRadius:T.radiusSm, fontSize:"12px",
                fontWeight:"500", cursor:"pointer",
                background: log.workout === w ? T.green : T.bgInput,
                color:      log.workout === w ? "#000"  : T.textSub,
                border:     log.workout === w ? "none"  : `1px solid ${T.borderSub}`,
              }}>{w}</button>
          ))}
        </div>
      </div>

      {/* Meal checkboxes + preset rows */}
      <div>
        <div style={S.label}>Приёмы пищи</div>
        <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
          {MEAL_NAMES.map((name, i) => {
            const checked = log.meals?.[i] ?? false;
            return (
              <div key={i}>
                <button onClick={() => toggleMeal(i)} style={{
                  display:"flex", alignItems:"center", gap:"10px", width:"100%",
                  padding:"10px 12px", borderRadius:"10px", cursor:"pointer", textAlign:"left",
                  background: checked ? T.greenDim : T.bgInput,
                  border: `1px solid ${checked ? "rgba(74,222,128,0.35)" : T.border}`,
                }}>
                  <div style={{
                    width:"18px", height:"18px", borderRadius:T.radiusFull, flexShrink:0,
                    background: checked ? T.green : "transparent",
                    border: checked ? "none" : `2px solid ${T.textDark}`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                  }}>
                    {checked && <span style={{ fontSize:"10px", color:"#000", fontWeight:"700" }}>✓</span>}
                  </div>
                  <span style={{ fontSize:"13px", color: checked ? T.green : T.textSub }}>{name}</span>
                </button>
                <PresetRow
                  slot={i}
                  onApply={preset => onChange(applyPreset(log, i, preset))}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Macro inputs */}
      <div style={sx(S.card, { background:T.bgCard })}>
        <div style={{ fontSize:"11px", color:T.textMuted, marginBottom:"12px" }}>КБЖУ по факту</div>
        <MacroRings log={log}/>
        <div style={sx(S.grid2, { marginTop:"12px" })}>
          {[
            { field:"calories", label:"Калории",    placeholder:`${PLAN.calories}` },
            { field:"protein",  label:"Белок г",    placeholder:`${PLAN.protein}`  },
            { field:"carbs",    label:"Углеводы г", placeholder:`${PLAN.carbs}`    },
            { field:"fat",      label:"Жиры г",     placeholder:`${PLAN.fat}`      },
          ].map(({ field, label, placeholder }) => (
            <div key={field}>
              <div style={S.labelSm}>{label}</div>
              <input type="number" placeholder={placeholder} value={log[field]}
                onChange={e => update({ [field]: e.target.value })}
                style={S.inputSm}/>
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <div style={S.label}>Заметки / тренировка</div>
        <textarea placeholder="Как прошёл день..." value={log.notes} rows={3}
          onChange={e => update({ notes: e.target.value })}
          style={{ ...S.input, resize:"none", fontFamily:T.fontSans }}/>
      </div>
    </div>
  );
});

// ── DayHistory (extracted from Tab 1) ────────────────────────
/**
 * @param {{ logs:DailyLog[], minWeight:number|null, onSelect:(log:DailyLog)=>void }} props
 */
const DayHistory = memo(function DayHistory({ logs, minWeight, onSelect }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
      {[...logs].reverse().map((l, i) => {
        const wc    = WCOLOR[l.workout] ?? WCOLOR["отдых"];
        const isMin = l.weight && parseFloat(l.weight) === minWeight;
        return (
          <button key={i} onClick={() => onSelect(l)} style={{
            display:"flex", alignItems:"center", justifyContent:"space-between",
            padding:"10px 12px", background:T.bgInput, borderRadius:T.radiusSm,
            border:`1px solid ${T.border}`, cursor:"pointer", textAlign:"left", width:"100%",
          }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:"13px", fontWeight:"500", color:T.text }}>{l.date || "—"}</div>
              <div style={{ fontSize:"11px", color:T.textMuted, marginTop:"1px", fontFamily:T.fontMono }}>
                {l.calories ? `${l.calories} ккал` : "—"} · Б{l.protein||"?"} У{l.carbs||"?"} Ж{l.fat||"?"}
              </div>
              <div style={{ display:"flex", gap:"4px", marginTop:"4px" }}>
                {(l.meals||[]).map((m, mi) => (
                  <span key={mi} style={{ fontSize:"10px", color: m ? T.green : T.textDark }}>
                    {MEAL_EMOJIS[mi]}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ textAlign:"right", flexShrink:0, marginLeft:"10px" }}>
              <div style={{ fontSize:"14px", fontWeight:"700", color: isMin ? T.amber : T.green }}>
                {l.weight ? `${l.weight} кг` : "—"}{isMin ? " 🏆" : ""}
              </div>
              <div style={sx(S.tag(l.workout), { marginTop:"3px" })}>{l.workout}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
});

// ── BackupPanel ───────────────────────────────────────────────
function BackupPanel() {
  const [backups,   setBackups]   = useState([]);
  const [open,      setOpen]      = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [msg,       setMsg]       = useState(null);

  useEffect(() => {
    if (open) storageService.listBackups().then(b => { setBackups(b); });
  }, [open]);

  const restore = async (key, savedAt) => {
    if (!confirm(`Восстановить бэкап от ${new Date(savedAt).toLocaleString()}?\nТекущие данные будут перезаписаны.`)) return;
    setRestoring(true);
    setMsg(null);
    try {
      await storageService.restoreBackup(key);
      window.location.reload();
    } catch (e) {
      setMsg({ type:"error", text:"Ошибка: " + e.message });
      setRestoring(false);
    }
  };

  if (!open) return (
    <button onClick={() => setOpen(true)} style={{ padding:"10px", borderRadius:T.radiusSm,
      background:T.bgInput, border:`1px solid ${T.borderSub}`, color:T.textGhost,
      fontSize:"12px", cursor:"pointer", width:"100%", textAlign:"left" }}>
      🗄️ Резервные копии ({backups.length || "..."}) →
    </button>
  );

  return (
    <div style={S.card}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"10px" }}>
        <div style={{ fontSize:"13px", fontWeight:"600" }}>Резервные копии</div>
        <button onClick={() => setOpen(false)} style={sx(S.btnGhost, { fontSize:"16px" })}>✕</button>
      </div>
      {msg && (
        <div style={{ padding:"8px 10px", borderRadius:T.radiusSm, marginBottom:"8px", fontSize:"12px",
          background: msg.type === "error" ? "rgba(248,113,113,0.1)" : "rgba(74,222,128,0.1)",
          color: msg.type === "error" ? T.red : T.green }}>
          {msg.text}
        </div>
      )}
      {backups.length === 0
        ? <div style={{ fontSize:"12px", color:T.textGhost, textAlign:"center", padding:"10px 0" }}>
            Бэкапы создаются автоматически перед миграцией и импортом
          </div>
        : backups.map((b, i) => (
          <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
            padding:"8px 0", borderBottom:`1px solid ${T.border}` }}>
            <div>
              <div style={{ fontSize:"11px", color:T.textSub }}>
                v{b.version} · {b.key?.includes("migration") ? "до миграции" : "до импорта"}
              </div>
              <div style={{ fontSize:"10px", color:T.textGhost }}>{new Date(b.savedAt).toLocaleString()}</div>
            </div>
            <button onClick={() => restore(b.key, b.savedAt)} disabled={restoring}
              style={{ padding:"4px 10px", borderRadius:T.radiusSm, cursor:"pointer",
                background:"rgba(251,146,60,0.1)", border:"1px solid rgba(251,146,60,0.2)",
                color:T.orange, fontSize:"11px", opacity: restoring ? 0.5 : 1 }}>
              {restoring ? "..." : "Восстановить"}
            </button>
          </div>
        ))
      }
    </div>
  );
}

// ── ImportExportPanel ─────────────────────────────────────────
/**
 * @param {{ logs: DailyLog[], onImport?: (logs: DailyLog[]) => void }} props
 */
function ImportExportPanel({ logs, onImport }) {
  const [mode,    setMode]    = useState("merge");
  const [status,  setStatus]  = useState(null);
  const [loading, setLoading] = useState(false);

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";   // allow re-selecting same file
    setStatus(null);
    setLoading(true);

    storageService.importJSON(
      file,
      logs,
      mode,
      ({ logs: newLogs, warnings, skipped, mode: usedMode }) => {
        setLoading(false);
        const parts = [
          `${usedMode === "merge" ? "Объединено" : "Заменено"}: ${newLogs.length} записей`,
          skipped > 0        ? `Пропущено: ${skipped}`              : null,
          warnings.length > 0 ? `Предупреждений: ${warnings.length}` : null,
        ].filter(Boolean);
        setStatus({ type:"success", text:`✅ ${parts.join(" · ")}` });

        if (onImport) {
          // Parent updates state directly — no page reload needed
          onImport(newLogs);
        } else {
          // Fallback: reload after feedback delay
          setTimeout(() => window.location.reload(), 1500);
        }
      },
      (err) => {
        setLoading(false);
        setStatus({ type:"error", text:`⚠️ ${err}` });
      }
    );
  };

  return (
    <div style={S.card}>
      <div style={{ fontSize:"13px", fontWeight:"600", marginBottom:"12px" }}>
        Экспорт / Импорт
      </div>

      {/* Export */}
      <button
        onClick={() => storageService.exportJSON(logs)}
        style={{ width:"100%", padding:"11px", borderRadius:T.radiusSm, marginBottom:"8px",
          background:T.greenDim, border:`1px solid ${T.greenBorder}`,
          color:T.green, fontSize:"13px", fontWeight:"600", cursor:"pointer", textAlign:"center" }}>
        📥 Скачать backup ({logs.length} записей)
      </button>

      {/* Import mode toggle */}
      <div style={{ display:"flex", gap:"6px", marginBottom:"8px" }}>
        {[
          { value:"merge",   label:"Объединить" },
          { value:"replace", label:"Заменить"   },
        ].map(o => (
          <button key={o.value} onClick={() => setMode(o.value)} style={{
            flex:1, padding:"7px", borderRadius:T.radiusSm, fontSize:"12px",
            fontWeight:"500", cursor:"pointer",
            background: mode === o.value ? "rgba(96,165,250,0.12)" : T.bgInput,
            color:      mode === o.value ? T.blue : T.textGhost,
            border:     `1px solid ${mode === o.value ? "rgba(96,165,250,0.3)" : T.border}`,
          }}>{o.label}</button>
        ))}
      </div>
      <div style={{ fontSize:"10px", color:T.textGhost, marginBottom:"8px" }}>
        {mode === "merge"
          ? "Импорт объединится с текущими данными. Совпадающие даты — импорт приоритетнее."
          : "⚠️ Текущие данные будут заменены. Автоматический бэкап создастся перед операцией."}
      </div>

      {/* Import button */}
      <label style={{
        display:"block", width:"100%", padding:"11px", borderRadius:T.radiusSm,
        background:"rgba(96,165,250,0.08)", border:"1px solid rgba(96,165,250,0.2)",
        color: loading ? T.textGhost : T.blue,
        fontSize:"13px", fontWeight:"600", cursor: loading ? "default" : "pointer",
        textAlign:"center", boxSizing:"border-box",
        opacity: loading ? 0.6 : 1,
      }}>
        {loading ? "⏳ Импорт..." : "📤 Загрузить .json"}
        <input
          type="file"
          accept=".json,application/json"
          style={{ display:"none" }}
          disabled={loading}
          onChange={handleImport}
        />
      </label>

      {/* Status feedback */}
      {status && (
        <div style={{ marginTop:"8px", padding:"8px 10px", borderRadius:T.radiusSm,
          fontSize:"12px", lineHeight:"1.4",
          background: status.type === "error" ? "rgba(248,113,113,0.08)" : "rgba(74,222,128,0.08)",
          color:      status.type === "error" ? T.red : T.green,
          border:     `1px solid ${status.type === "error" ? "rgba(248,113,113,0.2)" : T.greenBorder}`,
        }}>
          {status.text}
        </div>
      )}
    </div>
  );
}

// ── AnalyticsTab ──────────────────────────────────────────────
/**
 * @param {{ stats:AnalyticsResult, logs:DailyLog[] }} props
 */
function AnalyticsTab({ stats, logs, onImport }) {
  // Support both new nested structure and old flat aliases
  const p  = stats.progress   ?? {};
  const a  = stats.adherence  ?? {};
  const w  = stats.weight     ?? {};
  const n  = stats.nutrition  ?? {};
  const wk = stats.workouts   ?? {};

  // Flat aliases (backwards compat)
  const start        = w.start   ?? stats.start;
  const current      = w.current ?? stats.current;
  const min          = w.min     ?? stats.min;
  const delta        = w.delta   ?? stats.delta;
  const avgCal       = n.avgCal  ?? stats.avgCal;
  const avgProt      = n.avgProt ?? stats.avgProt;
  const avgCarbs     = n.avgCarbs ?? stats.avgCarbs;
  const avgFat       = n.avgFat  ?? stats.avgFat;
  const weeklyAll    = p.weeklyRate ?? stats.weeklyLoss;
  const rate7d       = p.rate7d;
  const rate14d      = p.rate14d;
  const tdee         = p.tdee   ?? stats.tdee;
  const daysToGoal   = p.daysToGoal;
  const mealAdh      = typeof a === "object" ? a.meals   : stats.adherence;
  const workoutAdh   = typeof a === "object" ? a.workout : null;
  const proteinAdh   = typeof a === "object" ? a.protein : stats.proteinHitPct;
  const perSlot      = typeof a === "object" ? a.perSlot : stats.adherencePerSlot;
  const streak       = typeof a === "object" ? a.streak  : stats.streak;
  const bestStreak   = typeof a === "object" ? a.bestStreak : null;
  const ma7Last      = w.ma7?.length ? w.ma7[w.ma7.length - 1] : (stats.ma7?.slice(-1)[0] ?? null);

  const StatCard = ({ label, value, sub, color = T.green }) => (
    <div style={sx(S.card, { border:`1px solid ${color}18` })}>
      <div style={{ fontSize:"10px", color:T.textMuted, marginBottom:"4px",
        textTransform:"uppercase", letterSpacing:"0.5px" }}>{label}</div>
      <div style={{ fontSize:"18px", fontWeight:"700", color }}>{value}</div>
      {sub && <div style={{ fontSize:"10px", color:T.textGhost, marginTop:"2px" }}>{sub}</div>}
    </div>
  );

  const AdherBar = ({ value, color }) => (
    <div style={{ background:T.border, borderRadius:"999px", height:"5px", overflow:"hidden", marginTop:"4px" }}>
      <div style={{ height:"100%", borderRadius:"999px", width:`${value}%`,
        background: color, transition:"width 0.6s ease" }}/>
    </div>
  );

  return (
    <div style={{ padding:"16px", display:"flex", flexDirection:"column", gap:"12px" }}>

      {/* Progress summary */}
      <div style={sx(S.card, {
        background:"linear-gradient(135deg,rgba(74,222,128,0.06),rgba(96,165,250,0.04))",
        border:`1px solid ${T.greenBorder}`,
      })}>
        <div style={{ fontSize:"13px", fontWeight:"600", marginBottom:"12px", color:T.green }}>
          📊 Прогресс
        </div>
        <div style={S.grid2}>
          <StatCard label="Начало"    value={`${start ?? "—"} кг`}  color={T.textSub}/>
          <StatCard label="Сейчас"    value={`${current ?? "—"} кг`} color={T.green}/>
          <StatCard label="Минимум"   value={`${min ?? "—"} кг`}     color={T.amber}/>
          <StatCard label="Результат"
            value={delta != null ? `${delta <= 0 ? "−" : "+"}${Math.abs(delta)} кг` : "—"}
            color={delta != null && delta <= 0 ? T.green : T.red}/>
        </div>
      </div>

      {/* Rate of change — 3 windows */}
      <div style={S.card}>
        <div style={{ fontSize:"13px", fontWeight:"600", marginBottom:"10px" }}>Темп снижения</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"8px" }}>
          {[
            { label:"Весь период",   value: weeklyAll, sub: `${(stats.weights ?? stats.wLogs?.map(l=>parseFloat(l.weight)) ?? []).length} взвешиваний` },
            { label:"Последние 14",  value: rate14d,   sub: "14 взвешиваний" },
            { label:"Последние 7",   value: rate7d,    sub: "7 взвешиваний"  },
          ].map(({ label, value, sub }) => {
            const v = value;
            const color = v == null ? T.textGhost : v < 0 ? T.green : v === 0 ? T.textSub : T.red;
            const display = v != null ? `${v > 0 ? "+" : ""}${v} кг/нед` : "—";
            return (
              <div key={label} style={{ background:T.bgCard, borderRadius:T.radiusSm,
                padding:"10px 8px", textAlign:"center", border:`1px solid ${T.border}` }}>
                <div style={{ fontSize:"13px", fontWeight:"700", color }}>{display}</div>
                <div style={{ fontSize:"9px", color:T.textMuted, marginTop:"3px" }}>{label}</div>
              </div>
            );
          })}
        </div>
        {daysToGoal != null && (
          <div style={{ marginTop:"10px", padding:"8px 10px", borderRadius:T.radiusSm,
            background:"rgba(96,165,250,0.07)", border:`1px solid rgba(96,165,250,0.15)`,
            fontSize:"12px", color:T.blue }}>
            📍 До цели 75 кг: ~{daysToGoal} дней при текущем темпе
          </div>
        )}
      </div>

      {/* MA7 + TDEE */}
      <div style={S.grid2}>
        <StatCard label="MA7 сейчас" value={ma7Last ? `${ma7Last} кг` : "—"} sub="скольз. среднее" color={T.blue}/>
        <StatCard label="Расч. TDEE"  value={tdee ? `${tdee} ккал` : "—"}    sub="оценка обмена"  color={T.purple}/>
      </div>

      {/* Nutrition averages */}
      <div style={sx(S.card)}>
        <div style={{ fontSize:"13px", fontWeight:"600", marginBottom:"10px" }}>Среднее КБЖУ/день</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:"6px" }}>
          {[
            { label:"Ккал",  value: avgCal,   color: T.amber  },
            { label:"Белок", value: avgProt,  color: T.green  },
            { label:"Углев", value: avgCarbs, color: T.blue   },
            { label:"Жиры",  value: avgFat,   color: T.pink   },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ textAlign:"center" }}>
              <div style={{ fontSize:"15px", fontWeight:"700", color }}>{value || "—"}</div>
              <div style={{ fontSize:"9px", color:T.textMuted, marginTop:"2px" }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Adherence — meals, workout, protein */}
      <div style={S.card}>
        <div style={{ fontSize:"13px", fontWeight:"600", marginBottom:"12px" }}>Соблюдение плана</div>
        {[
          { label:"Приёмы пищи",  value: mealAdh   ?? 0, color: T.green  },
          { label:"Тренировки",   value: workoutAdh ?? 0, color: T.blue   },
          { label:"Белок ≥150г",  value: proteinAdh ?? 0, color: T.amber  },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ marginBottom:"10px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:"12px", marginBottom:"3px" }}>
              <span style={{ color:T.textSub }}>{label}</span>
              <span style={{ fontWeight:"600", color }}>{value}%</span>
            </div>
            <AdherBar value={value} color={color}/>
          </div>
        ))}

        {/* Per-slot breakdown */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"4px", marginTop:"8px" }}>
          {MEAL_EMOJIS.map((emoji, i) => (
            <div key={i} style={{ textAlign:"center" }}>
              <div style={{ fontSize:"12px" }}>{emoji}</div>
              <div style={{ fontSize:"11px", fontWeight:"600", color:T.green }}>{perSlot?.[i] ?? 0}%</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize:"10px", color:T.textGhost, marginTop:"8px",
          display:"flex", justifyContent:"space-between" }}>
          <span>🔥 Серия сейчас: {streak ?? 0} дн</span>
          {bestStreak != null && <span>🏆 Рекорд: {bestStreak} дн</span>}
        </div>
      </div>

      {/* Workouts */}
      <div style={S.card}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"10px" }}>
          <div style={{ fontSize:"13px", fontWeight:"600" }}>Тренировки</div>
          {wk.activePct != null && (
            <div style={{ fontSize:"11px", color:T.blue, fontWeight:"600" }}>{wk.activePct}% активных дней</div>
          )}
        </div>
        <div style={{ display:"flex", gap:"8px" }}>
          {[
            { label:"Силовых", val: wk.strength ?? 0, color:T.blue   },
            { label:"Кардио",  val: wk.cardio   ?? 0, color:T.orange },
            { label:"Отдых",   val: wk.rest      ?? 0, color:T.textSub},
          ].map(({ label, val, color }) => (
            <div key={label} style={{ flex:1, background:T.bg, borderRadius:T.radiusSm, padding:"10px",
              textAlign:"center", border:`1px solid ${color}22` }}>
              <div style={{ fontSize:"20px", fontWeight:"700", color }}>{val}</div>
              <div style={{ fontSize:"10px", color:T.textMuted, marginTop:"2px" }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Export / Import */}
      <ImportExportPanel logs={logs} onImport={onImport}/>

      <BackupPanel/>
    </div>
  );
}

// ── PlanTab (extracted from main) ─────────────────────────────
const PlanTab = memo(function PlanTab() {
  return (
    <div style={{ padding:"16px", display:"flex", flexDirection:"column", gap:"10px" }}>
      <div style={S.grid2}>
        {[
          { label:"Калории",        value:"~1800 ккал", color:T.amber  },
          { label:"Белок",          value:"160+ г",     color:T.green  },
          { label:"Углеводы трен.", value:"~150 г",     color:T.blue   },
          { label:"Углеводы отдых", value:"120-130 г",  color:T.purple },
        ].map(({ label, value, color }) => (
          <div key={label} style={sx(S.card, { border:`1px solid ${color}22` })}>
            <div style={{ fontSize:"10px", color:T.textMuted }}>{label}</div>
            <div style={{ fontSize:"14px", fontWeight:"700", color, marginTop:"4px" }}>{value}</div>
          </div>
        ))}
      </div>

      {PLAN.meals.map((m, i) => (
        <div key={i} style={sx(S.card, { display:"flex", gap:"12px" })}>
          <div style={{ textAlign:"center", minWidth:"44px" }}>
            <div style={{ fontSize:"20px" }}>{m.emoji}</div>
            <div style={{ fontSize:"10px", color:T.textMuted, fontFamily:T.fontMono, marginTop:"2px" }}>{m.time}</div>
          </div>
          <div>
            <div style={{ fontSize:"13px", fontWeight:"600" }}>{m.title}</div>
            <div style={{ fontSize:"11px", color:T.textSub, marginTop:"3px", lineHeight:"1.5" }}>{m.desc}</div>
            {m.kcal && (
              <div style={{ fontSize:"11px", color:T.green, marginTop:"4px", fontFamily:T.fontMono }}>
                {m.kcal} ккал · Б{m.p} · У{m.c} · Ж{m.f}
              </div>
            )}
          </div>
        </div>
      ))}

      <div style={sx(S.card, { background:"rgba(251,191,36,0.05)", border:"1px solid rgba(251,191,36,0.15)" })}>
        <div style={{ fontSize:"12px", fontWeight:"600", color:T.amber, marginBottom:"8px" }}>⚠️ Особенности</div>
        {[
          "Мочевая кислота 422 мкмоль/л — 2–2.5л воды/день",
          "Псориаз — триггеры: арахис, квашеная капуста",
          "Льняное масло 1-2 ст.л. ежедневно — омега-3",
          "Молочное и мясо — не совмещать",
          "Углеводное чередование: трен. 150г / отдых 120-130г",
          "Жидкий яичный белок — удобная замена",
          "Псилиум — клетчатка, пить с большим количеством воды",
          "Желатин/коллаген 10г/день — суставы и кожа",
          "Креатин Creapure 6г/день — сила и восстановление",
        ].map((t, i) => (
          <div key={i} style={{ fontSize:"11px", color:T.textSub, marginBottom:"4px" }}>· {t}</div>
        ))}
      </div>
    </div>
  );
});

const SEEDED_LOGS = [
  {
    date: "25.03.2026", weight: "81.6", calories: "2005", protein: "179", carbs: "184", fat: "44",
    workout: "силовая",
    mealDetails: ["Овсянка 40г + 3 яйца + арахисовая паста 10г", "Курица 180г + рис 200г + мекс. смесь 200г + кв. капуста 80г", "Макароны 55г сухих + 3 яйца + банан + протеин 1.5 скупа", "Курица 180г + мекс. смесь 150г + ананас 100г"],
    notes: "Плечи + руки.", meals: [true, true, true, true]
  },
  {
    date: "26.03.2026", weight: "81.2", calories: "1765", protein: "151", carbs: "183", fat: "38",
    workout: "отдых",
    mealDetails: ["Овсянка 145г + банан 70г + паста 15г", "Курица 160г + гречка 180г + смесь 180г", "Булгур 150г + 3 яйца + банан + протеин 1.5 скупа", "Курица 160г + смесь 135г + ананас 100г"],
    notes: "День отдыха.", meals: [true, true, true, true]
  },
  {
    date: "27.03.2026", weight: "80.8", calories: "1577", protein: "138", carbs: "134", fat: "45",
    workout: "кардио",
    mealDetails: ["Овсянка 70г + паста 7г", "Мясо 170г + гречка 130г + смесь 180г", "Булгур 113г + 3 яйца + капуста + пудинг + протеин 1 скуп", "Мясо 170г + смесь 135г + ананас 100г"],
    notes: "Кардио 30 мин.", meals: [true, true, true, true]
  },
  {
    date: "28.03.2026", weight: "80.4", calories: "1825", protein: "134", carbs: "160", fat: "86",
    workout: "силовая",
    mealDetails: ["Овсянка 100г + паста 7.5г + банан 40г", "Мясо 170г + рис 150г + смесь + банан + пудинг + протеин 1.5 скупа", "Ресторан: бутерброд — хлеб + говядина + крем-сыр", "Ресторан: ростбиф + овощи гриль + куриный суп"],
    notes: "Тренировка ног. Рестораны.", meals: [true, true, true, true]
  },
  {
    date: "29.03.2026", weight: "80.4", calories: "1580", protein: "103", carbs: "194", fat: "74",
    workout: "кардио",
    mealDetails: ["Банан + паста 4г (перед бегом)", "Ресторан: зелёный салат + курица в кисло-сладком соусе", "Ресторан: тортик в стакане", "Гречка + котлета + салат"],
    notes: "Бег 4 км. Свободный день.", meals: [true, true, true, true]
  },
  {
    date: "30.03.2026", weight: "81.1", calories: "1725", protein: "114", carbs: "155", fat: "51",
    workout: "силовая",
    mealDetails: ["Овсянка 100г + паста + масло", "Курица 100г + рис 150г + смесь + капуста", "Курица 100г + рис 150г + банан + спаржа + протеин", "3 яйца + овощи + ананас + инжир"],
    notes: "Верх + кардио.", meals: [true, true, true, true]
  },
  {
    date: "31.03.2026", weight: "80.8", calories: "1882", protein: "154", carbs: "159", fat: "50",
    workout: "силовая",
    mealDetails: ["Овсянка 130г + паста 15г + банан 55г + масло", "Курица 180г + макароны 180г + овощи", "Курица 190г + макароны 65г + овощи + капуста + PRO десерт", "Протеин 1.5 скупа + банан"],
    notes: "Верх.", meals: [true, true, true, true]
  },
  {
    date: "01.04.2026", weight: "80.9", calories: "1813", protein: "118", carbs: "164", fat: "59",
    workout: "силовая",
    mealDetails: ["Овсянка + паста + масло + банан + 3 белка", "Фарш 160г + рис 150г + смесь + яйца (судок 1)", "Фарш 160г + рис 150г + яйца (судок 2) + пиво + Холс + Haribo", "Ресторан: зелёный салат + протеин"],
    notes: "Ноги + кардио 15 мин.", meals: [true, true, true, true]
  },
  {
    date: "02.04.2026", weight: "80.9", calories: "1990", protein: "150", carbs: "176", fat: "55",
    workout: "отдых",
    mealDetails: ["Овсянка 20г + паста 10г", "Фарш 180г + рис 100г + морковь + капуста", "Тунец 100г + булгур 220г + буряк + томатный сок + хлебцы", "Фарш 180г + булгур 100г + ананас + протеин 1.5 скупа"],
    notes: "Отдых.", meals: [true, true, true, true]
  },
  {
    date: "03.04.2026", weight: "80.8", calories: "1999", protein: "183", carbs: "176", fat: "54",
    workout: "силовая",
    mealDetails: ["Овсянка 30г + масло + 3 белка", "Фарш грудки 180г + макароны 150г + брокколи + 2 яйца", "Тунец 100г + булгур + кукуруза + буряк + капуста", "Фарш грудки 180г + макароны 120г + ананас + протеин 1.5 скупа"],
    notes: "Грудь + спина.", meals: [true, true, true, true]
  },
  {
    date: "04.04.2026", weight: "80.3", calories: "2137", protein: "133", carbs: "223", fat: "71",
    workout: "силовая",
    mealDetails: ["Овсянка 30г + протеин 20г + паста + масло", "Фарш грудки 100г + рис 230г + кукуруза + буряк + 2 яйца + пудинг", "Банан + протеин 1 скуп", "Ресторан: зелёный салат + курица кисло-сладкая"],
    notes: "Плечи + бицепс + трицепс.", meals: [true, true, true, true]
  },
  {
    date: "05.04.2026", weight: "80.3", calories: "2217", protein: "129", carbs: "206", fat: "85",
    workout: "кардио",
    mealDetails: ["Батончик Vale 40г (перед бегом)", "Курица 180г + рис 240г + яйцо + буряк + кукуруза", "Ресторан: зелёный салат + сырники (рикотта+маскарпоне)", "Домашние сырники + квас 500мл + протеин 1 скуп"],
    notes: "Бег 4 км. Два порции сырников 😄", meals: [true, true, true, true]
  },
  {
    date: "06.04.2026", weight: "80.8", calories: "1800", protein: "142", carbs: "166", fat: "50",
    workout: "отдых",
    mealDetails: ["Овсянка 30г + 2 белка (без масла)", "Фарш грудки 180г + рис 200г + брокколи + 2 яйца + томатный сок", "Фарш грудки 180г + рис 250г + кукуруза + морковь", "3 белка + капуста + ананас"],
    notes: "Отдых. Масло забыл.", meals: [true, true, true, true]
  },
  {
    date: "07.04.2026", weight: "80.8", calories: "1827", protein: "150", carbs: "206", fat: "36",
    workout: "силовая",
    mealDetails: ["Овсянка 30г + банан 50г + масло", "Фарш грудки 180г + рис 200г + брокколи + морковь + 2 яйца + томаты", "Фарш грудки 180г + гречка 200г + кукуруза + буряк + морковь", "2 белка + капуста + протеин 1.5 скупа + сок апельсиновый + пудинг"],
    notes: "Спина + грудь.", meals: [true, true, true, true]
  },
  {
    date: "08.04.2026", weight: "80.8", calories: "1505", protein: "136", carbs: "161", fat: "24",
    workout: "отдых",
    mealDetails: ["Овсянка 30г + 2 белка (без масла)", "1/4 обеда — брокколи + морковь (недоел)", "Фарш грудки 180г + гречка 150г + кукуруза + буряк + Haribo", "3 белка + капуста + ананас + протеин 2 скупа + хлебцы"],
    notes: "Отдых. Обед недоеден. Мало жиров.", meals: [true, false, true, true]
  },
  {
    date: "09.04.2026", weight: "80.4", calories: "1880", protein: "166", carbs: "156", fat: "32",
    workout: "отдых",
    mealDetails: ["Льняное масло 1 ст.л.", "Филе 180г + рис 150г + томаты Pomi + 3 белка + хлебцы", "Филе 150г + гречка 150г + кукуруза + буряк + хлебцы + банан + протеин 1.5 скупа", "Филе 120г + капуста + Haribo"],
    notes: "Отдых. Жидкий яичный белок.", meals: [true, true, true, true]
  },
  {
    date: "10.04.2026", weight: "79.6", calories: "1768", protein: "165", carbs: "158", fat: "39",
    workout: "силовая",
    mealDetails: ["Овсянка 30г + масло 2 ст.л. + белок жидкий 140мл + какао", "Филе 130г + рис 150г + томаты + морковь + белок 100мл", "Филе 150г + гречка 150г + кукуруза + буряк + белок 100мл", "Белок 150мл + капуста + ананас + банан + протеин 1.5 скупа + масло"],
    notes: "Верх. Новый минимум — 79.6 кг! 🏆", meals: [true, true, true, true]
  },
  {
    date: "11.04.2026", weight: "79.8", calories: "1885", protein: "132", carbs: "150", fat: "78",
    workout: "силовая",
    mealDetails: ["Овсянка 30г + масло + белок 200мл + какао + оливковое масло", "Протеин 2 скупа + банан 1.3шт", "В гостях: 2 отбивные в кляре + крыло + сыр + красная капуста", "Пасха 1/4 (~100г)"],
    notes: "Плечи утром. Пасха 🐣", meals: [true, true, true, true]
  },
  {
    date: "12.04.2026", weight: "", calories: "", protein: "", carbs: "", fat: "",
    workout: "силовая",
    mealDetails: ["", "", "", ""],
    notes: "Данные не зафиксированы.", meals: [false, false, false, false]
  },
  {
    date: "13.04.2026", weight: "", calories: "1855", protein: "172", carbs: "153", fat: "42",
    workout: "силовая",
    mealDetails: ["Овсянка 25г + масло + белок жидкий 150мл", "Отбивные 180г + макароны 140г + морковь корейская 80г", "Отбивные 150г + рис 100г + кукуруза 80г + буряк 100г", "Отбивные 110г + капуста + ананас + протеин 1.5 скупа + банан"],
    notes: "Тренировка низа.", meals: [true, true, true, true]
  },
  {
    date: "14.04.2026", weight: "80.1", calories: "1885", protein: "170", carbs: "144", fat: "48",
    workout: "силовая",
    mealDetails: ["Овсянка 25г + белок жидкий 100мл + масло + какао 10г", "Отбивные 180г + макароны 140г + морковь корейская 80г", "Отбивные 150г + рис 100г + кукуруза 80г + буряк 100г", "Отбивные 110г + капуста + ананас + банан 30г + протеин 1.5 скупа"],
    notes: "Тренировка. Углеводы снижены до 150г (тренировочные дни), 120-130г (дни отдыха).",
    meals: [true, true, true, true]
  },
  {
    date: "15.04.2026", weight: "79.6", calories: "1848", protein: "163", carbs: "164", fat: "49",
    workout: "силовая",
    mealDetails: [
      "Овсянка 40г + какао 10г + льняное масло 1 ст.л.",
      "Отбивные 180г (филе+яйцо+мука+масло) + булгур 130г + морковь корейская 80г",
      "Отбивные 150г + кукуруза 80г + буряк 100г + морковь свежая 100г",
      "Отбивные 150г + салат 70г + ананас 100г + леденцы 3шт + протеин 1.5 скупа"
    ],
    notes: "Тренировка плечи 20:00. Вечерний вес 80.8 кг.",
    meals: [true, true, true, true]
  },
  {
    date: "16.04.2026", weight: "79.9", calories: "1775", protein: "165", carbs: "150", fat: "38",
    workout: "отдых",
    mealDetails: [
      "Овсянка 30г + какао 7г + пасха 30г (без масла и белка)",
      "Отбивные 180г (белок+мука) + булгур 150г + морковь корейская 80г",
      "Отбивные 150г + салат Пелюстка 100г + буряк 100г + морковь свежая 100г",
      "Отбивные 170г + кв. капуста 70г + протеин 1.5 скупа (без банана)"
    ],
    notes: "День отдыха. Масло утром забыл.",
    meals: [true, true, true, true]
  },
  {
    date: "17.04.2026", weight: "79.4", calories: "1785", protein: "151", carbs: "136", fat: "62",
    workout: "силовая",
    mealDetails: [
      "Овсянка 50г сухой + белок жидкий 100мл + какао 5г + льняное масло 1 ст.л.",
      "Котлеты 160г + булгур 130г готового + морковь корейская 80г",
      "Котлеты 130г + салат традиційний 100г + булгур 30г готового",
      "Котлеты 120г + кв. капуста 70г + банан 65г + протеин 1.5 скупа + печенье Снежок 20г"
    ],
    notes: "Тренировка ноги. Новый минимум утром 79.4 кг! 🏆",
    meals: [true, true, true, true]
  },
  {
    date: "18.04.2026", weight: "79.5", calories: "1890", protein: "152", carbs: "140", fat: "65",
    workout: "силовая",
    mealDetails: [
      "Банан 100г + какао 5г (перед бегом) + овсянка 30г + белок жидкий 150мл + какао 5г",
      "Ресторан: сирники з грецьким йогуртом та чорничним джемом 280г + джерки 30г",
      "Ресторан: салат Цезарь з курячим філе 280г + лимонад",
      "Ресторан: шашлык говядина 100г + перец 2шт + черри + лаваш + протеин 1 скуп (30г)"
    ],
    notes: "Двойная тренировка — бег 6.35 км личный рекорд 🏆 + силовая грудь/спина. Весь день в ресторане Sun Ray Hotel.",
    meals: [true, true, true, true]
  },
  {
    date: "19.04.2026", weight: "79.7", calories: "1652", protein: "121", carbs: "146", fat: "58",
    workout: "отдых",
    mealDetails: [
      "Овсянка 30г + белок жидкий 150мл + льняное масло 1 ст.л. + какао 10г + пасха 49г",
      "Ресторан: зелёный салат 300г + курица в кисло-сладком соусе 460г",
      "Белок жидкий 200мл + кунжут 5г + протеин 1.5 скупа",
      ""
    ],
    notes: "День вне дома. Ресторан Скромний.",
    meals: [true, true, true, false]
  },
  {
    date: "20.04.2026", weight: "79.8", calories: "1892", protein: "170", carbs: "142", fat: "49",
    workout: "силовая",
    mealDetails: [
      "Овсянка 20г + белок жидкий 120мл + льняное масло 1 ст.л. + какао 10г + батончик 13г",
      "Котлеты из индейки 170г + рис 150г готового + морковь корейская 80г + Chewy Joy 20г",
      "Котлеты из индейки 150г + рис 130г готового + буряк 100г",
      "Котлеты из индейки 60г + кв. капуста 70г + банан 35г + протеин 1.5 скупа"
    ],
    notes: "Тренировка ноги.",
    meals: [true, true, true, true]
  },
  {
    date: "21.04.2026", weight: "79.2", calories: "1453", protein: "130", carbs: "112", fat: "38",
    workout: "силовая",
    mealDetails: [
      "Овсянка 20г + льняное масло 1 ст.л. + белок жидкий 150мл + какао 10г",
      "Котлеты из индейки 150г + рис 150г готового + морковь корейская 80г",
      "Котлеты из индейки 120г + рис 130г готового + буряк 100г",
      "Протеин 1.5 скупа + банан 25г (ужин не осилил)"
    ],
    notes: "Тренировка плечи + трицепс. Ужин не съел.",
    meals: [true, true, true, false]
  },
  {
    date: "22.04.2026", weight: "78.7", calories: "1703", protein: "140", carbs: "158", fat: "43",
    workout: "силовая",
    mealDetails: [
      "Овсянка плющена 40г + белок жидкий 150мл + льняное масло 1 ст.л. + какао 7г",
      "Котлеты куриные 160г + рис 180г готового + морковь корейская 80г",
      "Котлеты куриные 140г + рис 150г готового + буряк 100г",
      "Протеин 1.5 скупа + банан 75г (последний приём не съел)"
    ],
    notes: "Тренировка грудь + спина. Новый минимум 78.7 кг! 🏆",
    meals: [true, true, true, false]
  },
  {
    date: "23.04.2026", weight: "78.3", calories: "1470", protein: "127", carbs: "144", fat: "29",
    workout: "отдых",
    mealDetails: [
      "Завтрак пропущен",
      "Котлеты куриные 160г + рис 150г готового + морковь корейская 80г",
      "Котлеты куриные 130г + рис 100г готового + буряк 100г",
      "Котлеты куриные 60г + кв. капуста 70г + банан половина + ананасовый сок 150мл + протеин 1.5 скупа + банан 100г"
    ],
    notes: "День отдыха. Без завтрака. Новый минимум 78.3 кг! 🏆",
    meals: [false, true, true, true]
  },
  {
    date: "24.04.2026", weight: "77.8", calories: "1748", protein: "164", carbs: "151", fat: "48",
    workout: "отдых",
    mealDetails: [
      "Овсянка 20г + отбивная 40г + какао 7г + льняное масло 1 ст.л.",
      "Отбивные 170г + рис 180г готового + морковь корейская 80г + леденец 5г",
      "Отбивные 150г + рис 150г готового + буряк 100г",
      "Отбивные 80г (только мясо) + протеин 2 скупа + банан 100г"
    ],
    notes: "Тренировки не было. Новый минимум 77.8 кг! 🏆",
    meals: [true, true, true, true]
  },
  {
    date: "25.04.2026", weight: "77.5", calories: "2070", protein: "135", carbs: "174", fat: "83",
    workout: "силовая",
    mealDetails: [
      "Овсянка 20г + батончик 26г + какао 7г (без масла)",
      "Котлеты говяжьи 160г + рис 180г готового + морковь корейская 80г",
      "Котлеты говяжьи 140г + рис 150г готового + буряк 100г",
      "Протеин 1.5 скупа + банан 100г + ресторан: зелёный салат 300г"
    ],
    notes: "Тренировка верх — спина + грудь. Говяжий фарш Salsus первый раз.",
    meals: [true, true, true, true]
  },
  {
    date: "26.04.2026", weight: "77.7", calories: "1471", protein: "106", carbs: "122", fat: "52",
    workout: "кардио",
    mealDetails: [
      "Протеиновый батончик 80г (перед бегом)",
      "Яичница 2 яйца + котлеты говяжьи 120г + рис 150г + морковь корейская 80г + жир со сковороды",
      "Желатин 10г + печенье домашнее 90г",
      "Протеин 1 скуп (30г)"
    ],
    notes: "Утренний бег 6.22 км | 7:45/км — 2й лучший результат на 5 км! 🥈 Сожжено 345 ккал. Приготовил курицу и картошку в духовке на завтра.",
    meals: [true, true, true, true]
  },
  {
    date: "27.04.2026", weight: "77.7", calories: "2055", protein: "180", carbs: "164", fat: "49",
    workout: "силовая",
    mealDetails: [
      "Овсянка плющена 50г + какао 7г + желатин 10г + 2 яйца + льняное масло 1 ст.л.",
      "Курица из духовки 180г + картошка запечённая 200г + морковь корейская 80г + аджика 30г",
      "Курица из духовки 150г + рис 150г готового + морковь свежая 100г + аджика 25г",
      "Курица из духовки 130г + кв. капуста 70г + протеин 1.5 скупа + банан 70г + хлебцы 1.5шт + желатин 10г"
    ],
    notes: "Тренировка плечи + руки. Первый раз курица из духовки.",
    meals: [true, true, true, true]
  },
  {
    date: "28.04.2026", weight: "78.0", calories: "1800", protein: "136", carbs: "181", fat: "26",
    workout: "силовая",
    mealDetails: [
      "Овсянка 20г + протеин 20г + какао 7г + пасха 75г (без масла)",
      "Курица из духовки 180г + картошка запечённая 150г + макароны 100г готовых",
      "Курица из духовки 150г + макароны 120г готовых + морковь корейская 80г",
      "Протеин 1.5 скупа + банан 100г (ужин не съел — перенос на 29.04)"
    ],
    notes: "Тренировка ноги. Жиров мало — масло не пил. Ужин перенесён на 29.04.",
    meals: [true, true, true, false]
  },
  {
    date: "29.04.2026", weight: "77.3", calories: "1978", protein: "152", carbs: "190", fat: "43",
    workout: "силовая",
    mealDetails: [
      "Овсянка 20г + какао 7г + пасха 75г + льняное масло 1 ст.л.",
      "Курица из духовки 180г + макароны 150г готовых + морковь корейская 80г",
      "Курица 150г + макароны 86г + морковь корейская 80г + протеин 1.5 скупа + банан 70г",
      "Курица 130г + кв. капуста 70г + банан 1шт"
    ],
    notes: "Тренировка грудь + спина. Последняя пасха съедена 😄",
    meals: [true, true, true, true]
  },
  {
    date: "30.04.2026", weight: "77.3", calories: "1863", protein: "148", carbs: "150", fat: "58",
    workout: "отдых",
    mealDetails: [
      "Овсянка 20г + льняное масло 1 ст.л. + какао 7г + печенье 3шт (~45г)",
      "Курица из духовки 180г + рис 150г готового + морковь корейская 80г",
      "Курица из духовки 150г + рис 130г готового + кв. капуста 70г",
      "Курица из духовки 120г + кв. капуста 70г + протеин 1.5 скупа + банан 70г"
    ],
    notes: "День отдыха.",
    meals: [true, true, true, true]
  },
  {
    date: "01.05.2026", weight: "77.0", calories: "3215", protein: "114", carbs: "269", fat: "101",
    workout: "отдых",
    mealDetails: [
      "Овсянка 15г + какао 7г + льняное масло + йогурт Baltais 100г + батончик 80г + капучино",
      "Ресторан Моніка: суп Папа Помодоро 1/3 + пінца маргарита 2 куски + теплий салат з телятиною",
      "Ресторан Суке: курочка кацу з локшиною 450г + пиво Asahi 5х330мл",
      "Пирожное шу 72г + пиво Кроненберг 0.5л"
    ],
    notes: "Одесса, 1 мая 🎉 Праздничный день.",
    meals: [true, true, true, true]
  },
  {
    date: "02.05.2026", weight: "", calories: "2480", protein: "105", carbs: "238", fat: "114",
    workout: "отдых",
    mealDetails: [
      "Капучино + Макчикен",
      "Ресторан Естер: биті огірки 130г + поке з лососем 310г",
      "Піца Пепероні зі страчателлою 1.5 куска (~118г) + мороженое 80г",
      "Шаурма 400г"
    ],
    notes: "Одесса, день 2. Без веса утром.",
    meals: [true, true, true, true]
  },
  {
    date: "03.05.2026", weight: "", calories: "2150", protein: "129", carbs: "151", fat: "84",
    workout: "отдых",
    mealDetails: [
      "Ресторан Естер: яєчня з мортаделою 250г + капучино",
      "2 батончика Excellent Nutrition по 80г",
      "Ресторан Скромний: зелёный салат 300г + курица в кисло-сладком 460г",
      ""
    ],
    notes: "Возвращение домой. Без веса утром.",
    meals: [true, true, true, false]
  },
  {
    date: "04.05.2026", weight: "78.4", calories: "1541", protein: "110", carbs: "177", fat: "32",
    workout: "силовая",
    mealDetails: [
      "Овсянка 10г + какао 7г + йогурт Baltais 170г",
      "Пузата Хата: стейк куриный гриль 2х90г + картошка 200г + гречка 200г + салаты 2х200г (1/2)",
      "Пузата Хата: вторая половина заказа + протеин 1 скуп",
      "Протеин 1 скуп"
    ],
    notes: "Тренировка плечи. Возврат к режиму после праздников.",
    meals: [true, true, true, true]
  },
  {
    date: "05.05.2026", weight: "77.7", calories: "2113", protein: "163", carbs: "165", fat: "59",
    workout: "силовая",
    mealDetails: [
      "Овсянка 20г + какао 7г + льняное масло + конфета Франческа 8г",
      "Курица 180г + рис 180г + маасдам 30г + морковь корейская 80г",
      "Курица 150г + рис 150г + маасдам 20г + морковь корейская 80г",
      "Курица 130г + рис 100г + кв. капуста 70г + протеин 1.5 скупа + банан 70г"
    ],
    notes: "Тренировка ноги. День 1 лечения: Хьюмер+Изофра+Фликс+Целиста+Бактоблис.",
    meals: [true, true, true, true]
  },
  {
    date: "06.05.2026", weight: "77.3", calories: "2347", protein: "175", carbs: "194", fat: "68",
    workout: "силовая",
    mealDetails: [
      "Овсянка 20г + льняное масло + какао 10г + печенье Мария 4шт",
      "Курица 180г + рис 180г + маасдам 30г + морковь корейская 80г",
      "Курица 150г + рис 150г + маасдам 20г + морковь корейская 80г + конфеты Морські Скарби 3шт",
      "Курица 130г + кв. капуста 70г + протеин 2 скупа + банан 80г"
    ],
    notes: "Тренировка грудь + спина. День 2 лечения.",
    meals: [true, true, true, true]
  },
  {
    date: "07.05.2026", weight: "77.2", calories: "2210", protein: "167", carbs: "172", fat: "68",
    workout: "отдых",
    mealDetails: [
      "Овсянка 20г + льняное масло + какао 10г + конфеты Птичье молоко 1.5шт",
      "Курица 180г + рис 150г + маасдам 30г + морковь корейская 80г",
      "Курица 150г + рис 120г + морковь корейская 80г + кв. капуста 70г + орешки 2шт",
      "Курица 120г + протеин 2 скупа + банан 40г + чорнослив в глазурі 2шт"
    ],
    notes: "День отдыха. День 3 лечения.",
    meals: [true, true, true, true]
  },
  {
    date: "08.05.2026", weight: "77.0", calories: "2762", protein: "170", carbs: "224", fat: "79",
    workout: "силовая",
    mealDetails: [
      "Овсянка 20г + белок жидкий 150мл + льняное масло + маасдам 25г + какао + кофе с молоком + печенье Ловита",
      "Курица 180г + рис 150г + маасдам 30г + морковь корейская 80г",
      "Курица 150г + рис 105г + морковь корейская 80г + кофе + печенье Ловита + орешек",
      "Протеин 2 скупа + банан 60г + печенье с дропсами 3шт + пиво 2х0.5л"
    ],
    notes: "Тренировка руки. День 4 лечения.",
    meals: [true, true, true, true]
  },
  {
    date: "09.05.2026", weight: "76.7", calories: "2351", protein: "136", carbs: "204", fat: "84",
    workout: "силовая",
    mealDetails: [
      "Овсянка 27г + белок жидкий 167мл + льняное+оливковое масло + маасдам 30г + какао + кофе с молоком + печенье с дропсами 2шт",
      "Протеин 2 скупа + банан 60г + Макчикен",
      "Ресторан Скромний: курица в кисло-сладком 460г + зелёный салат 300г + пиво 0.5л",
      ""
    ],
    notes: "Тренировка грудь + спина. Новый минимум 76.7 кг! 🏆 День 5 лечения.",
    meals: [true, true, true, false]
  },
  {
    date: "10.05.2026", weight: "76.9", calories: "2219", protein: "130", carbs: "163", fat: "88",
    workout: "кардио",
    mealDetails: [
      "Овсянка 20г + какао 8г + конфеты Провансаль 2шт + псилиум",
      "Котлеты говяжьи 160г + курица 60г + гречка 150г + морковь корейская 80г + маасдам 20г + белок жидкий 100мл",
      "Мороженое Mr.Pops лаймовый чизкейк 80г + ресторан: куриный суп с мітболами + ростбіф с овощами гриль",
      "Пиво 0.5л + мороженое 2 шарика (~150г)"
    ],
    notes: "Кардио: бег 5.79 км — новый личный рекорд 6:10/км! 🏆 + ~25 км ходьбы. День 6 лечения.",
    meals: [true, true, true, true]
  },
  {
    date: "11.05.2026", weight: "77.1", calories: "1944", protein: "126", carbs: "161", fat: "76",
    workout: "силовая",
    mealDetails: [
      "Овсянка 20г + белок жидкий 130мл + какао 10г + льняное масло + кофе с молоком 100мл",
      "Котлеты говяжьи 150г + гречка 180г готовой + морковь корейская 80г",
      "Котлеты говяжьи 130г + гречка 180г готовой + маасдам 20г + кофе с молоком",
      "Котлеты говяжьи 80г + кв. капуста 70г + протеин 1.5 скупа + банан 60г + печенье с дропсами 5шт"
    ],
    notes: "Тренировка ноги. День 7 лечения.",
    meals: [true, true, true, true]
  },
  {
    date: "12.05.2026", weight: "76.9", calories: "1732", protein: "173", carbs: "146", fat: "54",
    workout: "силовая",
    mealDetails: [
      "Псилиум + овсянка 15г + белок жидкий 150мл + кофе с молоком + печенье 3шт",
      "Котлеты куриные 170г + гречка 180г готовой + морковь корейская 80г",
      "Котлеты куриные 150г + гречка 150г готовой + маасдам 20г",
      "Котлеты куриные 130г + кв. капуста 70г + протеин 1.5 скупа"
    ],
    notes: "Тренировка руки. День 8 лечения.",
    meals: [true, true, true, true]
  },
  {
    date: "13.05.2026", weight: "76.3", calories: "2041", protein: "140", carbs: "170", fat: "80",
    workout: "силовая",
    mealDetails: [
      "Псилиум + овсянка 10г + льняное масло 10г",
      "Котлеты говяжьи 160г + гречка 180г готовой + морковь корейская 80г + кофе с молоком + печенье 1.5шт",
      "Котлеты говяжьи 140г + гречка 180г готовой + маасдам 20г + томатный сок 400мл + протеин 1.5 скупа + банан 60г + хлебцы 2шт",
      "Котлеты говяжьи 100г + кв. капуста 70г"
    ],
    notes: "Тренировка ноги. Новый минимум 76.3 кг! 🏆 День 9 лечения.",
    meals: [true, true, true, true]
  },
  {
    date: "14.05.2026", weight: "76.3", calories: "2230", protein: "139", carbs: "197", fat: "76",
    workout: "отдых",
    mealDetails: [
      "Гранола AXA 35г + какао 8г + льняное масло + конфетка Престиж",
      "Курица 180г + рис 150г с изюмом + помидоры жёлтые 100г + морковь корейская 80г + Kinder Joy 2шт",
      "Курица 150г + рис 120г с изюмом + маасдам 20г + печенье с дропсами 5шт",
      "Курица 40г + кв. капуста 70г + протеин 1.5 скупа"
    ],
    notes: "День отдыха. День 10 лечения — последний день Изофры!",
    meals: [true, true, true, true]
  },
  {
    date: "15.05.2026", weight: "76.1", calories: "2716", protein: "158", carbs: "245", fat: "50",
    workout: "силовая",
    mealDetails: [
      "Овсянка плющена 38г + какао 8г + псилиум + батончик 80г",
      "Курица 160г + рис 180г с изюмом + помидоры жёлтые 100г + морковь корейская 80г + Kinder Joy + печенье 2шт",
      "Курица 150г + рис 150г с изюмом + маасдам 20г + кв. капуста 70г + томатный сок 250мл",
      "Протеин 1.5 скупа + пиво 0.5л + пиво Blue Moon 3х0.33л"
    ],
    notes: "Тренировка грудь + спина. Новый минимум 76.1 кг! 🏆 День 11 лечения.",
    meals: [true, true, true, true]
  },
  {
    date: "16.05.2026", weight: "76.2", calories: "2514", protein: "175", carbs: "236", fat: "73",
    workout: "силовая",
    mealDetails: [
      "Гранола AXA 40г + батончик 80г + флэт уайт + псилиум",
      "Ресторан Скромний: кунг пао курица 470г",
      "Ресторан Dimpl: рамен каррі з куркою панко + хіяші з водоростями",
      "Протеин 2 скупа + банан 60г"
    ],
    notes: "Тренировка плечи + руки. День 12 лечения.",
    meals: [true, true, true, true]
  },
  {
    date: "17.05.2026", weight: "76.9", calories: "1820", protein: "105", carbs: "155", fat: "79",
    workout: "кардио",
    mealDetails: [
      "Гранола 40г + батончик 80г + флэт уайт",
      "Трубочка со сгущёнкой 50г + ресторан Mammi: курячий суп з мітболами + салат Ростбіф",
      "Печенье с дропсами 80г",
      ""
    ],
    notes: "Кардио: бег 5.97 км | 6:15/км. День 13 лечения.",
    meals: [true, true, true, false]
  },
  {
    date: "18.05.2026", weight: "76.2", calories: "1849", protein: "143", carbs: "160", fat: "52",
    workout: "силовая",
    mealDetails: [
      "Гранола 40г + псилиум + какао",
      "Курица из духовки 160г + рис 180г + морковь корейская 80г",
      "Курица 160г + рис 180г + кв. капуста 70г + маасдам 20г + флэт уайт + кофе с молоком + орешек",
      "Weider Joe's 50г + протеин 1.5 скупа"
    ],
    notes: "Тренировка грудь + спина. День 14 лечения.",
    meals: [true, true, true, true]
  },
  {
    date: "19.05.2026", weight: "76.5", calories: "1842", protein: "143", carbs: "174", fat: "46",
    workout: "силовая",
    mealDetails: [
      "Овсянка з чіа 40г + какао 7г + арахисовая паста 5г",
      "Курица из духовки 180г + макароны 150г + морковь корейская 80г",
      "Курица 150г + макароны 130г + маасдам 20г + флэт уайт + кофе с молоком + орешек + протеин 1.5 скупа + банан 60г + батончик Monsters половина",
      ""
    ],
    notes: "Тренировка ноги. День 15 лечения.",
    meals: [true, true, true, false]
  },
  {
    date: "20.05.2026", weight: "76.7", calories: "2382", protein: "160", carbs: "195", fat: "62",
    workout: "отдых",
    mealDetails: [
      "Овсянка 30г + арахисовая паста 10г + льняное масло + какао 7г + кофе фильтр + трубочка со сгущёнкой",
      "Курица из духовки 180г + булгур 150г + морковь корейская 80г + кофе с молоком + батончик Joe's 50г",
      "Курица 116г + булгур 130г + кв. капуста 70г",
      "Батончик Monsters 80г + протеин 1.5 скупа + банан 50г + пиво лагер 0.5л"
    ],
    notes: "День отдыха. День 16 лечения.",
    meals: [true, true, true, true]
  },
  {
    date: "21.05.2026", weight: "76.0", calories: "2440", protein: "177", carbs: "170", fat: "100",
    workout: "отдых",
    mealDetails: [
      "Овсянка 20г + арахисовая паста 10г + какао 5г + кофе с молоком + батончик Joe's 50г",
      "Ресторан Скромний: кунг пао курица 470г × 2 + зелёный салат 300г",
      "Протеин 1.5 скупа + батончик Monsters 80г",
      ""
    ],
    notes: "День отдыха. Новый минимум 76.0 кг! 🏆 День 17 лечения.",
    meals: [true, true, true, false]
  },
  {
    date: "22.05.2026", weight: "77.2", calories: "2155", protein: "195", carbs: "185", fat: "53",
    workout: "силовая",
    mealDetails: [
      "Псилиум + овсянка 25г + арахисовая паста 5г",
      "Курица 180г + булгур 180г + морковь корейская 80г + кофе с молоком + батончик Joe's 50г",
      "Протеин 1.5 скупа + банан 100г + батончик Monsters 80г",
      "Курица 150г + булгур 150г + маасдам 20г + курица 120г + кв. капуста 70г"
    ],
    notes: "Тренировка ноги. День 18 лечения.",
    meals: [true, true, true, true]
  },
  {
    date: "23.05.2026", weight: "75.9", calories: "2409", protein: "153", carbs: "185", fat: "82",
    workout: "силовая",
    mealDetails: [
      "Псилиум + овсянка 30г + арахисовая паста 10г + батончик Monsters 80г + банан 137г",
      "Белок жидкий 150мл + маасдам 20г + курица 120г + булгур 90г + морковь корейская 80г + креатин 6г + кофе с молоком + батончик Joe's 50г",
      "Протеин 1 скуп + ресторан Скромний: зелёный салат 300г + курица в кисло-сладком 70% порции",
      "Пиво Samuel Smith Chocolate Stout 355мл"
    ],
    notes: "Тренировка грудь + спина. Новый минимум 75.9 кг! 🏆 День 19 лечения.",
    meals: [true, true, true, true]
  },
  {
    date: "24.05.2026", weight: "75.7", calories: "1764", protein: "113", carbs: "155", fat: "65",
    workout: "кардио",
    mealDetails: [
      "Банан 137г + овсянка 20г + белок жидкий 150мл + арахисовая паста 10г + маасдам 20г",
      "Флэт уайт + батончик Monsters 80г + флэт уайт + мороженое iPops клубника 80г",
      "Ресторан BigMama: куриный суп с митболами + салат Ростбиф с говядиной",
      ""
    ],
    notes: "Кардио: бег 5.77 км | 7:17/км. Новый минимум 75.7 кг! 🏆 День 20 лечения.",
    meals: [true, true, true, false]
  },
  {
    date: "25.05.2026", weight: "75.6", calories: "2172", protein: "194", carbs: "182", fat: "53",
    workout: "силовая",
    mealDetails: [
      "Завтрак пропущен",
      "Курица 180г + булгур 180г + морковь корейская 80г + кофе с молоком + батончик Joe's 50г + орешек со сгущёнкой",
      "Курица 150г + булгур 150г + маасдам 20г + батончик Monsters 80г + кофе с молоком + протеин 1.5 скупа",
      "Курица 120г + кв. капуста 70г + банан 100г"
    ],
    notes: "Тренировка руки. Новый минимум 75.6 кг = -6.0 кг за 61 день! 🏆🔥 День 21 лечения.",
    meals: [false, true, true, true]
  },
  {
    date: "26.05.2026", weight: "75.6", calories: "2257", protein: "195", carbs: "193", fat: "57",
    workout: "силовая",
    mealDetails: [
      "Завтрак пропущен",
      "Курица 180г + булгур 180г + морковь корейская 80г + кофе с молоком + батончик Joe's 50г + орешек со сгущёнкой",
      "Курица 150г + булгур 150г + маасдам 20г + батончик Monsters 80г + кофе с молоком + протеин 1.5 скупа",
      "Курица 120г + кв. капуста 70г + банан 100г + орешек со сгущёнкой"
    ],
    notes: "Тренировка руки. День 22 лечения.",
    meals: [false, true, true, true]
  }
];
// ║  SECTION 7 — MAIN TRACKER COMPONENT                     ║
// ╚══════════════════════════════════════════════════════════╝

export default function Tracker({
  onCloudLoad    = null,
  onCloudSave    = null,
  onCloudLogUpdate = null,
} = {}) {
  const [tab,         setTab]         = useState(0);
  const [logs,        setLogs]        = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [activeDay,   setActiveDay]   = useState(0);
  const [detailLog,   setDetailLog]   = useState(/** @type {DailyLog|null} */(null));
  const [cloudStatus, setCloudStatus] = useState("idle"); // "idle"|"syncing"|"ok"|"error"

  // ── Debounce refs ──────────────────────────────────────────
  const pendingRef  = useRef(null);
  const timerRef    = useRef(null);
  const DEBOUNCE_MS = 800;

  const flush = useCallback(async () => {
    if (pendingRef.current === null) return;
    const toSave = pendingRef.current;
    pendingRef.current = null;
    setSaving(true);
    await storageService.save(toSave);
    setSaving(false);
  }, []);

  const debouncedSave = useCallback((newLogs) => {
    pendingRef.current = newLogs;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, DEBOUNCE_MS);
  }, [flush]);

  // Flush on unmount — never lose last keystrokes
  useEffect(() => {
    return () => {
      clearTimeout(timerRef.current);
      if (pendingRef.current !== null) storageService.save(pendingRef.current);
    };
  }, []);

  // ── Load: localStorage → merge with Supabase cloud ────────
  useEffect(() => {
    (async () => {
      try {
        // Step 1: load from localStorage (instant, offline-safe)
        const { logs: saved, migrated, fromVersion } = await storageService.load();
        let merged = [...SEEDED_LOGS];
        if (saved) {
          saved.forEach(log => {
            const idx = merged.findIndex(s => s.date === log.date);
            if (idx === -1) merged.push(log);
            else merged[idx] = { ...merged[idx], ...log };
          });
          if (migrated) console.info(`[tracker] migrated v${fromVersion}→v${CURRENT_VERSION}`);
        }

        // Step 2: merge with Supabase (cloud wins on conflict)
        if (onCloudLoad) {
          setCloudStatus("syncing");
          try {
            const cloudLogs = await onCloudLoad();
            if (Array.isArray(cloudLogs) && cloudLogs.length > 0) {
              cloudLogs.forEach(log => {
                if (!log || !log.date) return;
                const idx = merged.findIndex(s => s.date === log.date);
                if (idx === -1) merged.push(log);
                else merged[idx] = { ...merged[idx], ...log };
              });
              console.info(`[supabase] merged ${cloudLogs.length} cloud logs`);
            }
            setCloudStatus("ok");
          } catch {
            setCloudStatus("error");
            console.warn("[supabase] load failed — using local data");
          }
        }

        // Step 3: persist merged result
        setLogs(merged);
        setActiveDay(merged.length - 1);
        await storageService.save(merged);

        // Step 4: push seed/merged data to cloud (no-op if already in sync)
        if (onCloudSave) onCloudSave(merged).catch(() => {});

      } catch {
        setLogs(SEEDED_LOGS);
        setActiveDay(SEEDED_LOGS.length - 1);
      }
      setLoading(false);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mutations ──────────────────────────────────────────────
  const addDay = useCallback(() => {
    const newLogs = [...logs, emptyLog()];
    setLogs(newLogs);
    setActiveDay(newLogs.length - 1);
    clearTimeout(timerRef.current);
    pendingRef.current = null;
    storageService.save(newLogs);
  }, [logs]);

  const updateDay = useCallback((index, updated) => {
    const newLogs = logs.map((l, i) => i === index ? updated : l);
    setLogs(newLogs);
    debouncedSave(newLogs);
    // Supabase: upsert only the changed record (fire-and-forget)
    if (onCloudLogUpdate && updated.date) {
      onCloudLogUpdate(updated).catch(() => {});
    }
  }, [logs, debouncedSave, onCloudLogUpdate]);

  const handleDetailSave = useCallback((updatedLog) => {
    const idx = logs.findIndex(l => l.date === updatedLog.date);
    if (idx === -1) return;
    const newLogs = logs.map((l, i) => i === idx ? updatedLog : l);
    setLogs(newLogs);
    setDetailLog(updatedLog);
    clearTimeout(timerRef.current);
    pendingRef.current = null;
    setSaving(true);
    storageService.save(newLogs).then(() => setSaving(false));
    if (onCloudLogUpdate && updatedLog.date) {
      onCloudLogUpdate(updatedLog).catch(() => {});
    }
  }, [logs, onCloudLogUpdate]);

  // ── Derived data (memoized) ────────────────────────────────
  const stats    = useMemo(() => computeAnalytics(logs), [logs]);
  const insights = useMemo(() => generateInsights(logs, stats), [logs, stats]);
  const current = logs[activeDay];
  const TABS    = ["📋 Дневник", "📈 Прогресс", "📊 Аналитика", "📌 План", "🍽 Еда"];

  // ── Loading screen ─────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight:"100vh", background:T.bg,
      display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ color:T.green, fontSize:"14px", fontFamily:T.fontMono }}>загрузка...</div>
    </div>
  );

  // ── App shell ──────────────────────────────────────────────
  return (
    <div style={{ minHeight:"100vh", background:T.bg, color:T.text,
      fontFamily:T.fontSans, maxWidth:"420px", margin:"0 auto", paddingBottom:"24px" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>

      {detailLog && (
        <DayDetail log={detailLog} onClose={() => setDetailLog(null)} onSave={handleDetailSave}/>
      )}

      {/* ── Header ── */}
      <div style={{ background:"linear-gradient(135deg,#0f1b0f 0%,#0a1628 100%)",
        padding:"20px 16px 16px", borderBottom:`1px solid #1a2a1a` }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <div style={{ fontSize:"18px", fontWeight:"700", letterSpacing:"-0.5px" }}>Трекер питания</div>
            <div style={{ fontSize:"11px", color:T.green, marginTop:"2px", fontFamily:T.fontMono }}>
              178см · старт 81.6кг · сушка/рекомпо
            </div>
          </div>
          <div style={{ textAlign:"right" }}>
            {stats.current ? (
              <>
                <div style={{ fontSize:"22px", fontWeight:"700", color:T.green }}>
                  {stats.current} <span style={{ fontSize:"12px", color:T.textMuted }}>кг</span>
                </div>
                {stats.delta != null && (
                  <div style={{ fontSize:"11px", fontFamily:T.fontMono,
                    color: parseFloat(stats.delta) < 0 ? T.green : T.red }}>
                    {parseFloat(stats.delta) < 0 ? "▼" : "▲"} {Math.abs(parseFloat(stats.delta))} кг
                  </div>
                )}
              </>
            ) : <div style={{ fontSize:"11px", color:T.textGhost }}>нет данных</div>}
            {saving && <div style={{ fontSize:"10px", color:T.textMuted, marginTop:"2px" }}>сохранение...</div>}
            {cloudStatus === "syncing" && <div style={{ fontSize:"10px", color:T.blue,     marginTop:"2px" }}>☁ синхронизация...</div>}
            {cloudStatus === "ok"      && <div style={{ fontSize:"10px", color:T.green,    marginTop:"2px" }}>☁ синхронизировано</div>}
            {cloudStatus === "error"   && <div style={{ fontSize:"10px", color:T.textGhost,marginTop:"2px" }}>☁ офлайн режим</div>}
          </div>
        </div>

        <div style={{ display:"flex", gap:"8px", marginTop:"12px" }}>
          {[
            { label:"Дней",     value: logs.length },
            { label:"Силовых",  value: stats.workouts?.strength ?? 0 },
            { label:"Минимум",  value: stats.min ? `${stats.min}кг` : "—" },
          ].map(s => (
            <div key={s.label} style={{ flex:1, background:T.greenDim, borderRadius:T.radiusSm,
              padding:"8px", textAlign:"center", border:`1px solid ${T.greenBorder}` }}>
              <div style={{ fontSize:"14px", fontWeight:"700", color:T.green }}>{s.value}</div>
              <div style={{ fontSize:"10px", color:T.textMuted }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Analytics mini-strip ── */}
        {(stats.ma7?.length ?? 0) > 0 && (
          <div style={{ display:"flex", gap:"6px", marginTop:"8px" }}>
            {[
              {
                label: "MA7",
                value: `${stats.ma7?.at(-1) ?? "—"} кг`,
                sub: "средн. 7 дн",
                color: T.blue,
              },
              {
                label: "Темп/нед",
                value: stats.progress?.rate7d != null
                  ? `${stats.progress.rate7d > 0 ? "+" : ""}${stats.progress.rate7d} кг`
                  : "—",
                sub: "последние 7",
                color: (stats.progress?.rate7d ?? 0) < 0 ? T.green : T.red,
              },
              {
                label: "Питание",
                value: `${stats.adherence?.meals ?? (typeof stats.adherence === "number" ? stats.adherence : 0)}%`,
                sub: "adherence",
                color: (stats.adherence?.meals ?? (typeof stats.adherence === "number" ? stats.adherence : 0)) >= 80 ? T.green : T.amber,
              },
            ].map(({ label, value, sub, color }) => (
              <div key={label} style={{ flex:1, background:"rgba(255,255,255,0.03)",
                borderRadius:T.radiusSm, padding:"6px 8px", textAlign:"center",
                border:`1px solid ${color}20` }}>
                <div style={{ fontSize:"12px", fontWeight:"700", color }}>{value}</div>
                <div style={{ fontSize:"9px", color:T.textGhost, marginTop:"1px" }}>{sub}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Tab bar ── */}
      <div style={{ ...S.hScroll, background:"#0a0a0a", borderBottom:`1px solid ${T.border}` }}>
        {TABS.map((t, i) => (
          <button key={i} onClick={() => setTab(i)} style={{
            flex:"0 0 auto", padding:"12px 14px", fontSize:"11px", background:"none", border:"none",
            cursor:"pointer", whiteSpace:"nowrap",
            fontWeight: tab === i ? "600" : "400",
            color:      tab === i ? T.green : T.textMuted,
            borderBottom: `2px solid ${tab === i ? T.green : "transparent"}`,
          }}>{t}</button>
        ))}
      </div>

      {/* ── TAB 0 — Дневник ── */}
      {tab === 0 && (
        <div style={{ padding:"16px", display:"flex", flexDirection:"column", gap:"12px" }}>
          {/* Day selector */}
          <div style={{ ...S.hScroll, gap:"6px", paddingBottom:"4px" }}>
            {logs.map((l, i) => (
              <button key={i} onClick={() => setActiveDay(i)} style={S.pill(activeDay === i)}>
                {l.date || `День ${i+1}`}
              </button>
            ))}
            <button onClick={addDay} style={{ flexShrink:0, padding:"6px 12px",
              borderRadius:T.radiusPill, fontSize:"12px", background:T.bgInput,
              color:T.green, border:`1px solid #1a3a1a`, cursor:"pointer" }}>+ день</button>
          </div>

          {!current
            ? <div style={{ textAlign:"center", padding:"40px 0", color:T.textGhost, fontSize:"13px" }}>
                Нажми «+ день» чтобы начать
              </div>
            : <>
                <InsightsPanel insights={insights}/>
                <DayForm log={current} onChange={updated => updateDay(activeDay, updated)}/>
              </>
          }
        </div>
      )}

      {/* ── TAB 1 — Прогресс ── */}
      {tab === 1 && (
        <div style={{ padding:"16px", display:"flex", flexDirection:"column", gap:"14px" }}>
          <div style={S.card}>
            <div style={{ fontSize:"13px", fontWeight:"600", marginBottom:"12px" }}>Динамика веса</div>
            <WeightChart
              wLogs={stats.wLogs} weights={stats.weights} ma7={stats.ma7}
              start={stats.start} min={stats.min} delta={stats.delta}/>
          </div>

          <div style={S.card}>
            <div style={{ fontSize:"13px", fontWeight:"600", marginBottom:"4px" }}>История дней</div>
            <div style={{ fontSize:"11px", color:T.textGhost, marginBottom:"8px" }}>Нажми для деталей и редактирования</div>
            <DayHistory logs={logs} minWeight={stats.min} onSelect={setDetailLog}/>
          </div>
        </div>
      )}

      {/* ── TAB 2 — Аналитика ── */}
      {tab === 2 && <AnalyticsTab stats={stats} logs={logs} onImport={newLogs => { setLogs(newLogs); setActiveDay(newLogs.length - 1); }}/>}

      {/* ── TAB 3 — План ── */}
      {tab === 3 && <PlanTab/>}

      {/* ── TAB 4 — Еда (Edge Function + Supabase) ── */}
      {tab === 4 && <MealInput/>}
    </div>
  );
}
