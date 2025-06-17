import { SetMetadata } from '@nestjs/common';
import { AuditAction } from '@prisma/client';

export interface AuditLogOptions {
  action: AuditAction;
  entityType: string;
  description?: string;
  includeRequestBody?: boolean;
  includeResponseData?: boolean;
}

export const AUDIT_LOG_METADATA = 'audit-log';

export const AuditLog = (options: AuditLogOptions) =>
  SetMetadata(AUDIT_LOG_METADATA, options);
