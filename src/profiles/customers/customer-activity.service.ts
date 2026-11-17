import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { BaseTenantService } from 'src/common/base-tenant.service';
import { ParcelsService } from 'src/parcels/parcels.service';
import type { UserRequestType } from 'src/users/decorators/current-user.decorator';
@Injectable()
export class CustomerActivityService extends BaseTenantService {
  constructor(
    prisma: PrismaService,
    private readonly parcels: ParcelsService,
  ) {
    super(prisma);
  }
  private async checkCustomer(
    id: number,
    businessId: number,
    user: UserRequestType,
  ) {
    await this.validateBusinessAccess(businessId, user);
    const customer = await this.prismaService.customerProfile.findFirst({
      where: { id, businessId, isDeleted: false },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Customer profile not found');
  }
  async getParcels(
    id: number,
    businessId: number,
    user: UserRequestType,
    page: number,
  ) {
    await this.checkCustomer(id, businessId, user);
    return this.parcels.findAll(
      businessId,
      user,
      page,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      id,
    );
  }
  async getSummary(id: number, businessId: number, user: UserRequestType) {
    await this.checkCustomer(id, businessId, user);
    return this.prismaService.$transaction(async (tx) => {
      const where = {
        businessId,
        isDeleted: false,
        OR: [{ senderId: id }, { recipientId: id }],
      };
      const [all, sent, received, paidTotals] = await Promise.all([
        tx.parcel.aggregate({
          where,
          _count: { id: true },
          _max: { createdAt: true },
        }),
        tx.parcel.count({
          where: { businessId, isDeleted: false, senderId: id },
        }),
        tx.parcel.count({
          where: { businessId, isDeleted: false, recipientId: id },
        }),
        tx.$queryRaw<
          Array<{ currency: string | null; amount: Prisma.Decimal }>
        >(Prisma.sql`
          SELECT COALESCE(NULLIF(p."paymentCurrency", ''), NULLIF(price."currency", '')) AS currency, SUM(p."price") AS amount
          FROM "Parcel" p LEFT JOIN "ParcelPrice" price ON price.id = p."selectedPriceId"
          WHERE p."businessId" = ${businessId} AND p."isDeleted" = false AND p."paymentStatus" = 'Paid'
            AND ((p."senderId" = ${id} AND p."paidBy" = 'Sender') OR (p."recipientId" = ${id} AND p."paidBy" = 'Recipient'))
          GROUP BY COALESCE(NULLIF(p."paymentCurrency", ''), NULLIF(price."currency", '')) ORDER BY currency NULLS LAST
        `),
      ]);
      return {
        totalParcelCount: all._count.id,
        sentParcelCount: sent,
        receivedParcelCount: received,
        latestParcelAt: all._max.createdAt,
        paidTotals: paidTotals.map((row) => ({
          currency: row.currency,
          amount: row.amount.toFixed(2),
        })),
      };
    });
  }
}
