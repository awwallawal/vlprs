-- VLPRS Production Schema
-- Run: docker exec -i vlprs-db-1 psql -U vlprs -d vlprs_prod < scripts/init-schema.sql

DO $$ BEGIN CREATE TYPE role AS ENUM ('super_admin', 'dept_admin', 'mda_officer'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS mdas (id UUID PRIMARY KEY, name VARCHAR(255) NOT NULL, code VARCHAR(50) NOT NULL UNIQUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());

CREATE TABLE IF NOT EXISTS users (id UUID PRIMARY KEY, email VARCHAR(255) NOT NULL UNIQUE, hashed_password TEXT NOT NULL, first_name VARCHAR(100) NOT NULL, last_name VARCHAR(100) NOT NULL, role role NOT NULL, mda_id UUID REFERENCES mdas(id), is_active BOOLEAN NOT NULL DEFAULT TRUE, failed_login_attempts INTEGER NOT NULL DEFAULT 0, locked_until TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), deleted_at TIMESTAMPTZ);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS refresh_tokens (id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id), token_hash TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL, last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), revoked_at TIMESTAMPTZ);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_revoked ON refresh_tokens(user_id, revoked_at);

CREATE TABLE IF NOT EXISTS audit_log (id UUID PRIMARY KEY, user_id UUID REFERENCES users(id), email VARCHAR(255), role VARCHAR(50), mda_id UUID, action VARCHAR(100) NOT NULL, resource VARCHAR(255), method VARCHAR(10), request_body_hash VARCHAR(64), response_status INTEGER, ip_address VARCHAR(45) NOT NULL, user_agent TEXT, duration_ms INTEGER, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);

CREATE OR REPLACE FUNCTION fn_prevent_modification() RETURNS TRIGGER AS $t$ BEGIN RAISE EXCEPTION 'Modifications to % are not allowed: % operation rejected', TG_TABLE_NAME, TG_OP USING ERRCODE = 'restrict_violation'; END; $t$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_log_immutable ON audit_log;
CREATE TRIGGER trg_audit_log_immutable BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION fn_prevent_modification();

SELECT 'Schema applied successfully!' AS result;
