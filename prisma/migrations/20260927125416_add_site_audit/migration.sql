-- CreateTable
CREATE TABLE "SiteAudit" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "pageTitle" TEXT,
    "score" INTEGER NOT NULL,
    "grade" TEXT NOT NULL,
    "siteType" TEXT NOT NULL,
    "verdict" TEXT,
    "report" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "sentAt" TIMESTAMP(3),
    "leadId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SiteAudit_createdAt_idx" ON "SiteAudit"("createdAt");

-- CreateIndex
CREATE INDEX "SiteAudit_leadId_idx" ON "SiteAudit"("leadId");

-- CreateIndex
CREATE INDEX "SiteAudit_createdById_idx" ON "SiteAudit"("createdById");

-- CreateIndex
CREATE INDEX "SiteAudit_domain_idx" ON "SiteAudit"("domain");

-- AddForeignKey
ALTER TABLE "SiteAudit" ADD CONSTRAINT "SiteAudit_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteAudit" ADD CONSTRAINT "SiteAudit_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
