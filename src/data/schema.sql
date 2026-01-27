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
  priming_condition TEXT NOT NULL,
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

-- ═══════════════════════════════════════════════════════════
-- Arena: Multi-agent economic simulation tables
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS arena_rounds (
  id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL,
  round_number INTEGER NOT NULL,
  transfer_count INTEGER NOT NULL DEFAULT 0,
  message_count INTEGER NOT NULL DEFAULT 0,
  eliminated_count INTEGER NOT NULL DEFAULT 0,
  summary TEXT, -- JSON round summary
  started_at TEXT,
  completed_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (experiment_id) REFERENCES experiments(id)
);

CREATE TABLE IF NOT EXISTS arena_messages (
  id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL,
  round INTEGER NOT NULL,
  from_agent_id TEXT NOT NULL,
  from_name TEXT NOT NULL,
  to_agent_id TEXT, -- NULL for broadcast
  to_name TEXT,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL, -- 'private' or 'public'
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (experiment_id) REFERENCES experiments(id),
  FOREIGN KEY (from_agent_id) REFERENCES agents(id)
);

CREATE TABLE IF NOT EXISTS arena_transfers (
  id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL,
  round INTEGER NOT NULL,
  from_agent_id TEXT NOT NULL,
  from_name TEXT NOT NULL,
  to_agent_id TEXT NOT NULL,
  to_name TEXT NOT NULL,
  amount INTEGER NOT NULL,
  success INTEGER NOT NULL DEFAULT 1,
  error_message TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (experiment_id) REFERENCES experiments(id),
  FOREIGN KEY (from_agent_id) REFERENCES agents(id),
  FOREIGN KEY (to_agent_id) REFERENCES agents(id)
);

CREATE TABLE IF NOT EXISTS arena_actions (
  id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL,
  round INTEGER NOT NULL,
  agent_id TEXT NOT NULL,
  raw_response TEXT NOT NULL,
  parsed_actions TEXT NOT NULL, -- JSON array of parsed actions
  prompt TEXT NOT NULL,
  response_time_ms INTEGER,
  tokens_input INTEGER,
  tokens_output INTEGER,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (experiment_id) REFERENCES experiments(id),
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);

CREATE TABLE IF NOT EXISTS arena_balances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  experiment_id TEXT NOT NULL,
  round INTEGER NOT NULL,
  agent_id TEXT NOT NULL,
  balance INTEGER NOT NULL,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (experiment_id) REFERENCES experiments(id),
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);

-- ═══════════════════════════════════════════════════════════
-- Indexes for common queries
-- ═══════════════════════════════════════════════════════════

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

-- Arena indexes
CREATE INDEX IF NOT EXISTS idx_arena_rounds_experiment ON arena_rounds(experiment_id);
CREATE INDEX IF NOT EXISTS idx_arena_messages_experiment ON arena_messages(experiment_id);
CREATE INDEX IF NOT EXISTS idx_arena_messages_round ON arena_messages(experiment_id, round);
CREATE INDEX IF NOT EXISTS idx_arena_messages_type ON arena_messages(message_type);
CREATE INDEX IF NOT EXISTS idx_arena_messages_to ON arena_messages(to_agent_id);
CREATE INDEX IF NOT EXISTS idx_arena_transfers_experiment ON arena_transfers(experiment_id);
CREATE INDEX IF NOT EXISTS idx_arena_transfers_round ON arena_transfers(experiment_id, round);
CREATE INDEX IF NOT EXISTS idx_arena_transfers_from ON arena_transfers(from_agent_id);
CREATE INDEX IF NOT EXISTS idx_arena_transfers_to ON arena_transfers(to_agent_id);
CREATE INDEX IF NOT EXISTS idx_arena_actions_experiment ON arena_actions(experiment_id);
CREATE INDEX IF NOT EXISTS idx_arena_actions_round ON arena_actions(experiment_id, round);
CREATE INDEX IF NOT EXISTS idx_arena_actions_agent ON arena_actions(agent_id);
CREATE INDEX IF NOT EXISTS idx_arena_balances_experiment ON arena_balances(experiment_id);
CREATE INDEX IF NOT EXISTS idx_arena_balances_round ON arena_balances(experiment_id, round);
CREATE INDEX IF NOT EXISTS idx_arena_balances_agent ON arena_balances(agent_id);
