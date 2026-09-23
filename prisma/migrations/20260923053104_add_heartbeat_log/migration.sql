-- CreateTable
CREATE TABLE "HeartbeatLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HeartbeatLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HeartbeatLog_userId_createdAt_idx" ON "HeartbeatLog"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "HeartbeatLog" ADD CONSTRAINT "HeartbeatLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
