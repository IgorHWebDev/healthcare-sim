-- Create schema if not exists
CREATE SCHEMA IF NOT EXISTS bot_schema;

-- Set search path
SET search_path TO bot_schema;

-- Grant permissions to bot_user
GRANT USAGE ON SCHEMA bot_schema TO bot_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA bot_schema TO bot_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA bot_schema TO bot_user;

-- Reference tables for controlled values
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS case_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS metric_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users table to store user information
CREATE TABLE IF NOT EXISTS bot_users (
    user_id BIGINT PRIMARY KEY,
    username VARCHAR(255),
    first_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Progress table to track user progress
CREATE TABLE IF NOT EXISTS user_progress (
    id SERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES bot_users(user_id) ON DELETE CASCADE,
    category_id INT REFERENCES categories(id) ON DELETE RESTRICT,
    completed_count INT DEFAULT 0 CHECK (completed_count >= 0),
    total_count INT NOT NULL CHECK (total_count > 0),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, category_id)
);

-- Practice sessions table
CREATE TABLE IF NOT EXISTS practice_sessions (
    id SERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES bot_users(user_id) ON DELETE CASCADE,
    practice_type VARCHAR(50) NOT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    score INT CHECK (score >= 0 AND score <= 100),
    status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned'))
);

-- ED Cases table (based on MIMIC4ED)
CREATE TABLE IF NOT EXISTS ed_cases (
    id SERIAL PRIMARY KEY,
    case_type_id INT REFERENCES case_types(id) ON DELETE RESTRICT,
    difficulty_level INT CHECK (difficulty_level BETWEEN 1 AND 5),
    triage_level VARCHAR(20) CHECK (triage_level IN ('immediate', 'emergent', 'urgent', 'semi-urgent', 'non-urgent')),
    chief_complaint TEXT NOT NULL,
    vital_signs JSONB,
    lab_results JSONB,
    correct_diagnosis TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ED User Responses table
CREATE TABLE IF NOT EXISTS ed_responses (
    id SERIAL PRIMARY KEY,
    session_id BIGINT REFERENCES practice_sessions(id) ON DELETE CASCADE,
    case_id BIGINT REFERENCES ed_cases(id) ON DELETE RESTRICT,
    user_id BIGINT REFERENCES bot_users(user_id) ON DELETE CASCADE,
    user_diagnosis TEXT NOT NULL,
    triage_decision VARCHAR(20) CHECK (triage_decision IN ('immediate', 'emergent', 'urgent', 'semi-urgent', 'non-urgent')),
    resource_allocation JSONB,
    accuracy_score FLOAT CHECK (accuracy_score >= 0 AND accuracy_score <= 1),
    response_time INT CHECK (response_time > 0), -- in seconds
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ED Performance Metrics
CREATE TABLE IF NOT EXISTS ed_metrics (
    id SERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES bot_users(user_id) ON DELETE CASCADE,
    metric_type_id INT REFERENCES metric_types(id) ON DELETE RESTRICT,
    metric_value FLOAT CHECK (metric_value >= 0 AND metric_value <= 1),
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_user_id ON practice_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ed_responses_user_id ON ed_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_ed_metrics_user_id ON ed_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_ed_cases_vital_signs ON ed_cases USING GIN (vital_signs);
CREATE INDEX IF NOT EXISTS idx_ed_cases_lab_results ON ed_cases USING GIN (lab_results);

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA bot_schema
GRANT ALL PRIVILEGES ON TABLES TO bot_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA bot_schema
GRANT ALL PRIVILEGES ON SEQUENCES TO bot_user;