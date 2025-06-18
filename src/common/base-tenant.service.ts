import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserRequestType } from 'src/users/decorators/current-user.decorator';

@Injectable()
export abstract class BaseTenantService {
  constructor(protected readonly prismaService: PrismaService) {}

  protected async validateBusinessAccess(
    businessId: number,
    currentUser?: UserRequestType,
  ): Promise<void> {
    // SuperAdmin can access any business
    if (currentUser?.isSuperAdmin) {
      const business = await this.prismaService.business.findUnique({
        where: { id: businessId },
      });
      if (!business) {
        throw new NotFoundException('Business not found');
      }
      return;
    }

    // Regular business validation
    const business = await this.prismaService.business.findUnique({
      where: { id: businessId },
    });

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    if (!business.isActive) {
      throw new NotFoundException('Business is not active');
    }

    // Non-SuperAdmin users can only access their own business
    if (currentUser && currentUser.businessId !== businessId) {
      throw new NotFoundException('Access denied to this business');
    }
  }

  protected getBusinessFilter(
    businessId: number,
    currentUser?: UserRequestType,
  ) {
    // SuperAdmin can filter by any businessId provided
    if (currentUser?.isSuperAdmin) {
      return { businessId };
    }

    // Regular users can only filter by their own businessId
    return { businessId: currentUser?.businessId || businessId };
  }

  protected getBusinessWhere(
    businessId: number,
    additionalConditions: Record<string, any> = {},
    currentUser?: UserRequestType,
  ) {
    // SuperAdmin can specify any businessId
    if (currentUser?.isSuperAdmin) {
      return {
        businessId,
        ...additionalConditions,
      };
    }

    // Regular users can only access their own business
    return {
      businessId: currentUser?.businessId || businessId,
      ...additionalConditions,
    };
  }

  protected canAccessBusiness(
    targetBusinessId: number,
    currentUser: UserRequestType,
  ): boolean {
    // SuperAdmin can access any business
    if (currentUser.isSuperAdmin) {
      return true;
    }

    // Regular users can only access their own business
    return currentUser.businessId === targetBusinessId;
  }
}
