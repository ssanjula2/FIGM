-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'DEVELOPER', 'AUDITOR');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SCAN_SUCCESS', 'SCAN_FAILED', 'AI_FINISHED', 'EXPORT_FINISHED', 'SECURITY_ALERT');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('REGISTER', 'LOGIN', 'LOGOUT', 'REFRESH_TOKEN', 'FORGOT_PASSWORD', 'RESET_PASSWORD', 'ACCESS_DENIED', 'CREATE_PROJECT', 'DELETE_PROJECT', 'SCAN_RUN');

-- CreateEnum
CREATE TYPE "ExportFormat" AS ENUM ('PDF', 'JSON', 'CSV', 'MARKDOWN');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'DEVELOPER',
    "reset_token" TEXT,
    "reset_token_expiry" TIMESTAMP(3),
    "refresh_token" TEXT,
    "api_key" TEXT,
    "avatar_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_login_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "framework" TEXT NOT NULL DEFAULT 'React',
    "repo_url" TEXT NOT NULL DEFAULT '',
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "quality_score" INTEGER NOT NULL DEFAULT 100,
    "total_scans" INTEGER NOT NULL DEFAULT 0,
    "last_scan_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_reports" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT,
    "file_name" TEXT NOT NULL,
    "framework" TEXT NOT NULL DEFAULT 'React',
    "repository_url" TEXT NOT NULL DEFAULT 'Local Repository',
    "scan_time_ms" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "memory_usage_mb" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "quality_score" INTEGER NOT NULL DEFAULT 100,
    "rule_count" INTEGER NOT NULL DEFAULT 0,
    "critical_count" INTEGER NOT NULL DEFAULT 0,
    "high_count" INTEGER NOT NULL DEFAULT 0,
    "medium_count" INTEGER NOT NULL DEFAULT 0,
    "low_count" INTEGER NOT NULL DEFAULT 0,
    "ai_fix_count" INTEGER NOT NULL DEFAULT 0,
    "diagnostics" JSONB NOT NULL DEFAULT '[]',
    "is_favorite" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scan_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "email" TEXT,
    "action" "AuditAction" NOT NULL,
    "ip_address" TEXT NOT NULL,
    "user_agent" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "details" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'dark',
    "auto_save" BOOLEAN NOT NULL DEFAULT true,
    "auto_scan" BOOLEAN NOT NULL DEFAULT true,
    "ai_model" TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
    "export_format" TEXT NOT NULL DEFAULT 'PDF',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Default API Key',
    "last_used" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_reports" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "scan_report_id" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_evaluations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "dataset_name" TEXT NOT NULL,
    "sample_count" INTEGER NOT NULL,
    "precision_score" DOUBLE PRECISION NOT NULL,
    "recall_score" DOUBLE PRECISION NOT NULL,
    "f1_score" DOUBLE PRECISION NOT NULL,
    "accuracy_score" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "research_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "framework_benchmarks" (
    "id" TEXT NOT NULL,
    "framework" TEXT NOT NULL,
    "sample_count" INTEGER NOT NULL,
    "avg_latency_ms" DOUBLE PRECISION NOT NULL,
    "avg_memory_mb" DOUBLE PRECISION NOT NULL,
    "avg_score" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "framework_benchmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_history" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "scan_report_id" TEXT,
    "rule_id" TEXT NOT NULL,
    "patch_content" TEXT NOT NULL,
    "applied" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_history" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "format" "ExportFormat" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "export_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_api_key_key" ON "users"("api_key");

-- CreateIndex
CREATE INDEX "projects_user_id_idx" ON "projects"("user_id");

-- CreateIndex
CREATE INDEX "projects_status_idx" ON "projects"("status");

-- CreateIndex
CREATE INDEX "scan_reports_user_id_idx" ON "scan_reports"("user_id");

-- CreateIndex
CREATE INDEX "scan_reports_project_id_idx" ON "scan_reports"("project_id");

-- CreateIndex
CREATE INDEX "scan_reports_created_at_idx" ON "scan_reports"("created_at" DESC);

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_read_idx" ON "notifications"("read");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "settings_user_id_key" ON "settings"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_key" ON "api_keys"("key");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_reports" ADD CONSTRAINT "scan_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_reports" ADD CONSTRAINT "scan_reports_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_reports" ADD CONSTRAINT "saved_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_reports" ADD CONSTRAINT "saved_reports_scan_report_id_fkey" FOREIGN KEY ("scan_report_id") REFERENCES "scan_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_evaluations" ADD CONSTRAINT "research_evaluations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_history" ADD CONSTRAINT "ai_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_history" ADD CONSTRAINT "ai_history_scan_report_id_fkey" FOREIGN KEY ("scan_report_id") REFERENCES "scan_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_history" ADD CONSTRAINT "export_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

