// Kept as a TS string (not a .sql file) so it ships with `nest build` without asset config.
// Every row is scoped by location so the same schema serves many practices.
export const SCHEMA = /* sql */ `
CREATE TABLE IF NOT EXISTS locations (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  address    TEXT NOT NULL,
  phone      TEXT NOT NULL,
  timezone   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS providers (
  id          TEXT PRIMARY KEY,
  location_id TEXT NOT NULL REFERENCES locations(id),
  name        TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('dentist', 'hygienist'))
);

CREATE TABLE IF NOT EXISTS households (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS patients (
  id             TEXT PRIMARY KEY,
  location_id    TEXT NOT NULL REFERENCES locations(id),
  first_name     TEXT NOT NULL,
  last_name      TEXT NOT NULL,
  date_of_birth  TEXT NOT NULL,              -- YYYY-MM-DD
  phone          TEXT NOT NULL,              -- 10 digits, no formatting
  insurance_name TEXT,                       -- NULL means self-pay
  household_id   TEXT REFERENCES households(id),
  guardian_id    TEXT REFERENCES patients(id),
  created_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS patients_identity
  ON patients (location_id, last_name COLLATE NOCASE, date_of_birth);
CREATE INDEX IF NOT EXISTS patients_household ON patients (household_id);

-- Bookable capacity. Slot length follows provider role (hygienist 60 min, dentist 30 min).
CREATE TABLE IF NOT EXISTS slots (
  id             TEXT PRIMARY KEY,
  provider_id    TEXT NOT NULL REFERENCES providers(id),
  start_at       TEXT NOT NULL,              -- UTC ISO
  end_at         TEXT NOT NULL,              -- UTC ISO
  emergency_hold INTEGER NOT NULL DEFAULT 0, -- reserved for same-day emergencies
  UNIQUE (provider_id, start_at)
);
CREATE INDEX IF NOT EXISTS slots_start ON slots (start_at);

CREATE TABLE IF NOT EXISTS appointments (
  id            TEXT PRIMARY KEY,
  patient_id    TEXT NOT NULL REFERENCES patients(id),
  slot_id       TEXT NOT NULL REFERENCES slots(id),
  type          TEXT NOT NULL CHECK (type IN ('cleaning', 'checkup', 'emergency')),
  status        TEXT NOT NULL CHECK (status IN ('booked', 'cancelled', 'completed')),
  reason        TEXT,                        -- e.g. emergency summary
  cancel_reason TEXT,
  booked_by_id  TEXT REFERENCES patients(id),
  request_id    TEXT UNIQUE,                 -- idempotency key from the caller
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
-- The double-booking guard: at most one live appointment per slot, enforced by the database.
CREATE UNIQUE INDEX IF NOT EXISTS appointments_one_live_per_slot
  ON appointments (slot_id) WHERE status = 'booked';
CREATE INDEX IF NOT EXISTS appointments_patient ON appointments (patient_id, status);

CREATE TABLE IF NOT EXISTS staff_notifications (
  id              TEXT PRIMARY KEY,
  location_id     TEXT NOT NULL REFERENCES locations(id),
  kind            TEXT NOT NULL CHECK (kind IN ('emergency', 'escalation', 'callback')),
  priority        TEXT NOT NULL CHECK (priority IN ('urgent', 'high', 'normal')),
  patient_id      TEXT REFERENCES patients(id),
  conversation_id TEXT,
  summary         TEXT NOT NULL,
  details         TEXT,                      -- JSON
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged')),
  created_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS staff_notifications_open
  ON staff_notifications (location_id, status, created_at);

CREATE TABLE IF NOT EXISTS conversations (
  id              TEXT PRIMARY KEY,
  location_id     TEXT NOT NULL REFERENCES locations(id),
  patient_id      TEXT REFERENCES patients(id),
  started_at      TEXT NOT NULL,
  last_message_at TEXT NOT NULL,
  outcome         TEXT
);

CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content         TEXT NOT NULL,             -- JSON
  created_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_conversation ON messages (conversation_id, created_at);

-- What each finished turn showed the patient (reply, cards, flags), so a reloaded chat
-- looks the way it did live. Kept beside messages, which stay append-only and untouched.
CREATE TABLE IF NOT EXISTS turn_outcomes (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  message_id      TEXT NOT NULL REFERENCES messages(id), -- the patient message that opened the turn
  payload         TEXT NOT NULL,             -- JSON
  created_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS turn_outcomes_conversation ON turn_outcomes (conversation_id);

-- Runtime settings saved through PUT /admin/llm (e.g. LLM provider and model knobs).
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,                  -- JSON
  updated_at TEXT NOT NULL
);

-- Feedback loop: patient ratings tied to the exact conversation that earned them.
CREATE TABLE IF NOT EXISTS feedback (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  rating          INTEGER NOT NULL CHECK (rating IN (-1, 1)),
  comment         TEXT,
  created_at      TEXT NOT NULL
);
`;
