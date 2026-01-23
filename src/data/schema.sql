-- LF Game Theory Experiment Database Schema

CREATE TABLE IF NOT EXISTS experiments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  config_yaml TEXT NOT NULL,
  phase TEXT NOT NULL DEFAULT 'setup',
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL,
  name TEXT NOT NULL,
  model_provider TEXT NOT NULL,
  model_id TEXT NOT NULL,
  knowledge_level TEXT NOT NULL,
  lightning_agent_id INTEGER,
  lightning_api_key TEXT,
  group_index INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (experiment_id) REFERENCES experiments(id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL,
  game_type TEXT NOT NULL,
  stake INTEGER NOT NULL,
  iteration_type TEXT NOT NULL,
  total_rounds INTEGER NOT NULL,
  players TEXT NOT NULL, -- JSON array of agent IDs
  status TEXT NOT NULL DEFAULT 'pending',
  condition_index INTEGER,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (experiment_id) REFERENCES experiments(id)
);

CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  round INTEGER NOT NULL,
  action TEXT NOT NULL, -- parsed action label
  action_data TEXT, -- JSON with game-specific details
  raw_response TEXT NOT NULL, -- full LLM response verbatim
  prompt TEXT NOT NULL, -- full prompt sent
  payoff INTEGER NOT NULL DEFAULT 0, -- sats earned
  response_time_ms INTEGER,
  tokens_input INTEGER,
  tokens_output INTEGER,
  option_order TEXT, -- JSON showing randomized order presented
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (session_id) REFERENCES sessions(id),
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  from_agent_id TEXT, -- NULL = operator pool
  to_agent_id TEXT NOT NULL,
  amount INTEGER NOT NULL, -- sats
  reason TEXT NOT NULL,
  lightning_tx_id TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS balances (
  agent_id TEXT NOT NULL,
  experiment_id TEXT NOT NULL,
  balance INTEGER NOT NULL DEFAULT 0,
  last_updated TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (agent_id, experiment_id),
  FOREIGN KEY (agent_id) REFERENCES agents(id),
  FOREIGN KEY (experiment_id) REFERENCES experiments(id)
);

CREATE TABLE IF NOT EXISTS experiment_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  experiment_id TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info', -- info, warn, error
  message TEXT NOT NULL,
  metadata TEXT, -- JSON
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (experiment_id) REFERENCES experiments(id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_decisions_session ON decisions(session_id);
CREATE INDEX IF NOT EXISTS idx_decisions_agent ON decisions(agent_id);
CREATE INDEX IF NOT EXISTS idx_decisions_round ON decisions(session_id, round);
CREATE INDEX IF NOT EXISTS idx_sessions_experiment ON sessions(experiment_id);
CREATE INDEX IF NOT EXISTS idx_sessions_game ON sessions(game_type);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_payments_session ON payments(session_id);
CREATE INDEX IF NOT EXISTS idx_agents_experiment ON agents(experiment_id);
CREATE INDEX IF NOT EXISTS idx_log_experiment ON experiment_log(experiment_id);
