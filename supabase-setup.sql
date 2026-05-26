-- Run once in: https://supabase.com/dashboard/project/wqqcenttsrbcawxfuenu/sql

CREATE TABLE IF NOT EXISTS logs (
  id         BIGSERIAL    PRIMARY KEY,
  log_date   TEXT         NOT NULL UNIQUE,
  payload    JSONB        NOT NULL,
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_logs_updated_at ON logs;
CREATE TRIGGER trg_logs_updated_at
  BEFORE UPDATE ON logs FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_logs_log_date ON logs (log_date);

ALTER TABLE logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON logs FOR ALL USING (true) WITH CHECK (true);

SELECT 'Setup complete' AS status;

-- ── meal_entries table (for MealInput screen) ────────────────

CREATE TABLE IF NOT EXISTS meal_entries (
  id         BIGSERIAL    PRIMARY KEY,
  text       TEXT         NOT NULL,
  calories   INTEGER      NOT NULL DEFAULT 0,
  protein    INTEGER      NOT NULL DEFAULT 0,
  carbs      INTEGER      NOT NULL DEFAULT 0,
  fat        INTEGER      NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Index for date-range queries
CREATE INDEX IF NOT EXISTS idx_meal_entries_created_at ON meal_entries (created_at);

-- Enable RLS
ALTER TABLE meal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_meal_entries" ON meal_entries
  FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE meal_entries;

SELECT 'meal_entries table ready' AS status;
