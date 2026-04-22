-- CreateTable
CREATE TABLE "bug_reports" (
    "id" TEXT NOT NULL,
    "accountId" TEXT,
    "userEmail" TEXT,
    "source" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT,
    "userAgent" TEXT,
    "stackTrace" TEXT,
    "metadata" JSONB,
    "screenshot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bug_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bug_reports_status_createdAt_idx" ON "bug_reports"("status", "createdAt");

-- CreateIndex
CREATE INDEX "bug_reports_severity_createdAt_idx" ON "bug_reports"("severity", "createdAt");
