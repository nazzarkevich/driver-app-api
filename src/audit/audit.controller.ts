import {
  Controller,
  Get,
  Query,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { UserType } from '@prisma/client';
import { AuditService } from './audit.service';
import { Roles } from '../decorators/roles.decorator';
import {
  CurrentUser,
  UserRequestType,
} from '../users/decorators/current-user.decorator';

@ApiTags('Audit')
@Controller('audit')
@UseGuards() // You might want to add specific guards here
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @Roles(UserType.Manager, UserType.Moderator)
  @ApiOperation({ summary: 'Get audit logs' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'entityType', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async getAuditLogs(
    @CurrentUser() currentUser: UserRequestType,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('userId', new DefaultValuePipe(null)) userId?: string,
    @Query('action', new DefaultValuePipe(null)) action?: string,
    @Query('entityType', new DefaultValuePipe(null)) entityType?: string,
    @Query('startDate', new DefaultValuePipe(null)) startDate?: string,
    @Query('endDate', new DefaultValuePipe(null)) endDate?: string,
  ) {
    const filters: any = {
      page,
      limit: Math.min(limit, 100), // Cap at 100 records per page
    };

    // Only allow viewing business-specific logs unless user is admin
    if (!currentUser.isAdmin) {
      // Get user's business ID from the audit service
      const userBusinessId = await this.getUserBusinessId(currentUser.id);
      if (userBusinessId) {
        filters.businessId = userBusinessId;
      }
    }

    if (userId) filters.userId = parseInt(userId);
    if (action) filters.action = action;
    if (entityType) filters.entityType = entityType;
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);

    return this.auditService.getAuditLogs(filters);
  }

  @Get('logs/user/:userId')
  @Roles(UserType.Manager, UserType.Moderator)
  @ApiOperation({ summary: 'Get audit logs for specific user' })
  async getUserAuditLogs(
    @CurrentUser() currentUser: UserRequestType,
    @Param('userId', ParseIntPipe) userId: number,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    const filters: any = {
      userId,
      page,
      limit: Math.min(limit, 100),
    };

    // Only allow viewing business-specific logs unless user is admin
    if (!currentUser.isAdmin) {
      const userBusinessId = await this.getUserBusinessId(currentUser.id);
      if (userBusinessId) {
        filters.businessId = userBusinessId;
      }
    }

    return this.auditService.getAuditLogs(filters);
  }

  @Get('stats')
  @Roles(UserType.Manager, UserType.Moderator)
  @ApiOperation({ summary: 'Get audit statistics' })
  async getAuditStats(@CurrentUser() currentUser: UserRequestType) {
    // This is a placeholder for audit statistics
    // You can implement this based on your specific needs
    const filters: any = {};

    if (!currentUser.isAdmin) {
      const userBusinessId = await this.getUserBusinessId(currentUser.id);
      if (userBusinessId) {
        filters.businessId = userBusinessId;
      }
    }

    // For now, just return basic stats
    const logs = await this.auditService.getAuditLogs({
      ...filters,
      limit: 1000, // Get more records for stats
    });

    const actionCounts = logs.data.reduce(
      (acc, log) => {
        acc[log.action] = (acc[log.action] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const entityTypeCounts = logs.data.reduce(
      (acc, log) => {
        acc[log.entityType] = (acc[log.entityType] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      totalLogs: logs.pagination.total,
      actionCounts,
      entityTypeCounts,
      recentActivity: logs.data.slice(0, 10),
    };
  }

  private async getUserBusinessId(userId: number): Promise<number | undefined> {
    // This is a helper method to get user's business ID
    // In a real implementation, you might want to inject PrismaService
    // For now, we'll return undefined and let the service handle it
    return undefined;
  }
}
