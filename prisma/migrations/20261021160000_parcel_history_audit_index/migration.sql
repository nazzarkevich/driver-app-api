CREATE INDEX "AuditLog_businessId_entityType_entityId_createdAt_idx"
ON "AuditLog"("businessId", "entityType", "entityId", "createdAt");
