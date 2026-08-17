-- =============================================================================
-- Framework-Independent Guideline Model (FIGM)
-- Production Supabase PostgreSQL Multi-Tenant Database Schema (RLS & 12 Models)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums
DO $$ BEGIN
    CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'DEVELOPER', 'AUDITOR');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE "NotificationType" AS ENUM ('SCAN_SUCCESS', 'SCAN_FAILED', 'AI_FINISHED', 'EXPORT_FINISHED', 'SECURITY_ALERT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE "AuditAction" AS ENUM ('REGISTER', 'LOGIN', 'LOGOUT', 'REFRESH_TOKEN', 'FORGOT_PASSWORD', 'RESET_PASSWORD', 'ACCESS_DENIED', 'CREATE_PROJECT', 'DELETE_PROJECT', 'SCAN_RUN');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE "ExportFormat" AS ENUM ('PDF', 'JSON', 'CSV', 'MARKDOWN');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role "UserRole" NOT NULL DEFAULT 'DEVELOPER',
    reset_token VARCHAR(255),
    reset_token_expiry TIMESTAMP WITH TIME ZONE,
    refresh_token TEXT,
    api_key VARCHAR(255) UNIQUE,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 2. Projects Table
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    framework VARCHAR(50) DEFAULT 'React',
    repo_url TEXT DEFAULT '',
    status "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    quality_score INT DEFAULT 100,
    total_scans INT DEFAULT 0,
    last_scan_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- 3. Scan Reports Table
CREATE TABLE IF NOT EXISTS scan_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    file_name VARCHAR(255) NOT NULL,
    framework VARCHAR(50) DEFAULT 'React',
    repository_url TEXT DEFAULT 'Local Repository',
    scan_time_ms NUMERIC(10, 2) DEFAULT 0.0,
    memory_usage_mb NUMERIC(10, 2) DEFAULT 0.0,
    quality_score INT DEFAULT 100,
    rule_count INT DEFAULT 0,
    critical_count INT DEFAULT 0,
    high_count INT DEFAULT 0,
    medium_count INT DEFAULT 0,
    low_count INT DEFAULT 0,
    ai_fix_count INT DEFAULT 0,
    diagnostics JSONB DEFAULT '[]'::jsonb,
    is_favorite BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_scan_reports_user_id ON scan_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_scan_reports_project_id ON scan_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_scan_reports_created_at ON scan_reports(created_at DESC);

-- Additive, non-destructive migration for a scan_reports table that was already provisioned
-- before the severity-count columns existed -- ADD COLUMN IF NOT EXISTS never drops or alters
-- existing rows/columns, safe to re-run any number of times against a live database.
ALTER TABLE scan_reports ADD COLUMN IF NOT EXISTS critical_count INT DEFAULT 0;
ALTER TABLE scan_reports ADD COLUMN IF NOT EXISTS high_count INT DEFAULT 0;
ALTER TABLE scan_reports ADD COLUMN IF NOT EXISTS medium_count INT DEFAULT 0;
ALTER TABLE scan_reports ADD COLUMN IF NOT EXISTS low_count INT DEFAULT 0;

-- 4. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type "NotificationType" NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);

-- 5. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    email VARCHAR(255),
    action "AuditAction" NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'SUCCESS',
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- 6. Settings Table
CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    theme VARCHAR(20) DEFAULT 'dark',
    auto_save BOOLEAN DEFAULT TRUE,
    auto_scan BOOLEAN DEFAULT TRUE,
    ai_model VARCHAR(50) DEFAULT 'gemini-2.5-flash',
    export_format VARCHAR(20) DEFAULT 'PDF',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. API Keys Table
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(100) DEFAULT 'Default API Key',
    last_used TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Saved Reports Table
CREATE TABLE IF NOT EXISTS saved_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scan_report_id UUID NOT NULL REFERENCES scan_reports(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Research Evaluations Table
CREATE TABLE IF NOT EXISTS research_evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    dataset_name VARCHAR(100) NOT NULL,
    sample_count INT NOT NULL,
    precision_score NUMERIC(5, 4) NOT NULL,
    recall_score NUMERIC(5, 4) NOT NULL,
    f1_score NUMERIC(5, 4) NOT NULL,
    accuracy_score NUMERIC(5, 4) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Framework Benchmarks Table
CREATE TABLE IF NOT EXISTS framework_benchmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    framework VARCHAR(50) NOT NULL,
    sample_count INT NOT NULL,
    avg_latency_ms NUMERIC(10, 2) NOT NULL,
    avg_memory_mb NUMERIC(10, 2) NOT NULL,
    avg_score NUMERIC(5, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. AI History Table
CREATE TABLE IF NOT EXISTS ai_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scan_report_id UUID REFERENCES scan_reports(id) ON DELETE SET NULL,
    rule_id VARCHAR(50) NOT NULL,
    patch_content TEXT NOT NULL,
    applied BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. Export History Table
CREATE TABLE IF NOT EXISTS export_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    format "ExportFormat" NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- =============================================================================
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_projects_isolation ON projects
    FOR ALL USING (user_id = current_setting('app.current_user_id', true)::uuid);

CREATE POLICY user_scans_isolation ON scan_reports
    FOR ALL USING (user_id = current_setting('app.current_user_id', true)::uuid);

CREATE POLICY user_notifs_isolation ON notifications
    FOR ALL USING (user_id = current_setting('app.current_user_id', true)::uuid);

CREATE POLICY user_settings_isolation ON settings
    FOR ALL USING (user_id = current_setting('app.current_user_id', true)::uuid);
