import { ApiProperty } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';

export class AuditLogDto {
  @ApiProperty()
  id: number;

  @ApiProperty({ required: false })
  userId?: number;

  @ApiProperty({ enum: AuditAction })
  action: AuditAction;

  @ApiProperty()
  entityType: string;

  @ApiProperty({ required: false })
  entityId?: string;

  @ApiProperty()
  description: string;

  @ApiProperty({ required: false })
  metadata?: any;

  @ApiProperty({ required: false })
  ipAddress?: string;

  @ApiProperty({ required: false })
  userAgent?: string;

  @ApiProperty({ required: false })
  sessionId?: string;

  @ApiProperty({ required: false })
  method?: string;

  @ApiProperty({ required: false })
  endpoint?: string;

  @ApiProperty({ required: false })
  requestId?: string;

  @ApiProperty({ required: false })
  duration?: number;

  @ApiProperty({ required: false })
  statusCode?: number;

  @ApiProperty({ required: false })
  businessId?: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ required: false })
  user?: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    type: string;
  };

  @ApiProperty({ required: false })
  business?: {
    id: number;
    name: string;
  };
}
