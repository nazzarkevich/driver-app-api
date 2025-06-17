import { Injectable } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UserRequestType } from '../users/decorators/current-user.decorator';

export interface AuditLogInput {
  userId?: number;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  description: string;
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  method?: string;
  endpoint?: string;
  requestId?: string;
  duration?: number;
  statusCode?: number;
  businessId?: number;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditLogInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: input.userId,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId,
          description: input.description,
          metadata: input.metadata,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          sessionId: input.sessionId,
          method: input.method,
          endpoint: input.endpoint,
          requestId: input.requestId,
          duration: input.duration,
          statusCode: input.statusCode,
          businessId: input.businessId,
        },
      });
    } catch (error) {
      // Log error but don't throw to avoid breaking main functionality
      console.error('Failed to create audit log:', error);
    }
  }

  async logUserAction(
    user: UserRequestType | null,
    action: AuditAction,
    entityType: string,
    entityId?: string,
    description?: string,
    metadata?: any,
  ): Promise<void> {
    await this.log({
      userId: user?.id,
      action,
      entityType,
      entityId,
      description: description || `${action.toLowerCase()} ${entityType}`,
      metadata,
      businessId: user?.id ? await this.getUserBusinessId(user.id) : undefined,
    });
  }

  async logSystemAction(
    action: AuditAction,
    entityType: string,
    entityId?: string,
    description?: string,
    metadata?: any,
  ): Promise<void> {
    await this.log({
      action,
      entityType,
      entityId,
      description:
        description || `System ${action.toLowerCase()} ${entityType}`,
      metadata,
    });
  }

  async getAuditLogs(filters: {
    userId?: number;
    action?: AuditAction;
    entityType?: string;
    businessId?: number;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }) {
    const {
      userId,
      action,
      entityType,
      businessId,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = filters;

    const where: any = {};

    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (businessId) where.businessId = businessId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              type: true,
            },
          },
          business: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private async getUserBusinessId(userId: number): Promise<number | undefined> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { businessId: true },
      });
      return user?.businessId;
    } catch {
      return undefined;
    }
  }
}
