# Joe Tracker

Дневник питания и тренировок — React + Vite + TypeScript + Supabase + PWA

## Быстрый старт

```bash
npm install
npm run dev        # http://localhost:5173/Joe-Tracker-/
npm run build      # production build → dist/
```

## Deploy на GitHub Pages

### 1. Настрой Supabase (один раз)
Открой https://supabase.com/dashboard/project/wqqcenttsrbcawxfuenu/sql
Вставь содержимое `supabase-setup.sql` → Run

### 2. Создай репо и запушь
```bash
git init
git add .
git commit -m "init"
gh repo create Joe-Tracker- --public --push --source=.
```

### 3. Включи GitHub Pages
GitHub → Settings → Pages → Source: **gh-pages** branch → Save

GitHub Action задеплоит автоматически при каждом push в `main`.
Приложение: `https://USERNAME.github.io/Joe-Tracker-/`

## Структура

```
src/
  lib/supabase.ts    ← Supabase client + getLogs / addLog / saveLogs
  App.tsx            ← PWA banner + передача Supabase props в Tracker
  main.tsx           ← React root + SW registration
  Tracker.tsx        ← весь трекер (UI + analytics + storage)
  vite-env.d.ts
public/
  icons/             ← PWA иконки (placeholder, замени на настоящие)
  manifest.json
.github/workflows/
  deploy.yml         ← автодеплой на gh-pages
supabase-setup.sql   ← SQL для создания таблицы
```

## Data flow

```
Запуск:
  localStorage (мгновенно) → merge → Supabase getLogs (cloud wins) → setState

Изменение дня:
  setState → localStorage debounce 800ms
           → Supabase addLog upsert (fire-and-forget, silent on error)
```

## Offline

Приложение полностью работает без интернета — данные из localStorage.
При восстановлении сети Supabase синхронизируется автоматически.
