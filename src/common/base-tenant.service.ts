import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

export abstract class BaseTenantService {
  constructor(protected prismaService: PrismaService) {}

  protected getBusinessFilter(businessId: number) {
    return { businessId };
  }

  protected async validateBusinessAccess(businessId: number): Promise<void> {
    const business = await this.prismaService.business.findUnique({
      where: { id: businessId },
    });

    if (!business?.isActive) {
      throw new ForbiddenException('Business not found or inactive');
    }
  }

  protected getBusinessWhere(businessId: number, additionalWhere: any = {}) {
    return {
      ...additionalWhere,
      businessId,
    };
  }
}
