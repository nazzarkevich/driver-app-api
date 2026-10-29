import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, DeliveryStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import { BaseTenantService } from 'src/common/base-tenant.service';
import { UserRequestType } from 'src/users/decorators/current-user.decorator';
import { AuditService } from 'src/audit/audit.service';
import { TrackingLookupDto } from './dtos/public-tracking.dto';
import { hashTrackingValue, normalizePostcode } from './tracking.utils';

const TRACKING_UNAVAILABLE =
  'Tracking information is unavailable. Check your details or use a tracking link.';

@Injectable()
export class ShipmentTrackingService extends BaseTenantService {
  constructor(
    prisma: PrismaService,
    private readonly audit: AuditService,
  ) {
    super(prisma);
  }

  async lookup(input: TrackingLookupDto) {
    const parcel = await this.prismaService.parcel.findFirst({
      where: {
        businessId: input.businessId,
        trackingNumber: input.trackingNumber.trim().toUpperCase(),
        isDeleted: false,
        business: { isActive: true, isDeleted: false },
      },
      select: {
        shipment: { select: { id: true, verificationPostcode: true } },
      },
    });
    const postcode = normalizePostcode(input.postcode);
    if (
      !parcel?.shipment?.verificationPostcode ||
      !postcode ||
      parcel.shipment.verificationPostcode !== postcode
    ) {
      throw new NotFoundException(TRACKING_UNAVAILABLE);
    }
    return this.publicShipment(parcel.shipment.id);
  }

  async resolve(token: string) {
    const link = await this.prismaService.shipmentTrackingLink.findUnique({
      where: { tokenHash: hashTrackingValue(token) },
      select: { shipmentId: true, revokedAt: true },
    });
    if (!link || link.revokedAt)
      throw new NotFoundException(TRACKING_UNAVAILABLE);
    return this.publicShipment(link.shipmentId);
  }

  async issueLink(user: UserRequestType, shipmentId: string) {
    const shipment = await this.authorize(user, shipmentId);
    const token = randomBytes(32).toString('hex');
    const link = await this.prismaService.$transaction(async (tx) => {
      const created = await tx.shipmentTrackingLink.create({
        data: { shipmentId, tokenHash: hashTrackingValue(token) },
        select: { id: true },
      });
      await tx.auditLog.createMany({
        data: shipment.parcels.map(({ id }) => ({
          userId: user.id,
          businessId: shipment.businessId,
          action: AuditAction.CREATE,
          entityType: 'Parcel',
          entityId: String(id),
          description: 'Issued shipment tracking link',
          method: 'PARCEL_EVENT',
          metadata: {
            eventType: 'TrackingLinkIssued',
            details: { shipmentId, linkId: created.id },
          },
        })),
      });
      return created;
    });
    await this.audit.log({
      userId: user.id,
      businessId: shipment.businessId,
      action: AuditAction.CREATE,
      entityType: 'Shipment',
      description: 'Issued shipment tracking link',
      metadata: { shipmentId, linkId: link.id },
    });
    return { token };
  }

  async revokeLinks(user: UserRequestType, shipmentId: string) {
    const shipment = await this.authorize(user, shipmentId);
    const result = await this.prismaService.$transaction(async (tx) => {
      const updated = await tx.shipmentTrackingLink.updateMany({
        where: { shipmentId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.auditLog.createMany({
        data: shipment.parcels.map(({ id }) => ({
          userId: user.id,
          businessId: shipment.businessId,
          action: AuditAction.UPDATE,
          entityType: 'Parcel',
          entityId: String(id),
          description: 'Revoked shipment tracking links',
          method: 'PARCEL_EVENT',
          metadata: {
            eventType: 'TrackingLinkRevoked',
            details: { shipmentId, revokedCount: updated.count },
          },
        })),
      });
      return updated;
    });
    await this.audit.log({
      userId: user.id,
      businessId: shipment.businessId,
      action: AuditAction.UPDATE,
      entityType: 'Shipment',
      description: 'Revoked shipment tracking links',
      metadata: { shipmentId, revokedCount: result.count },
    });
    return { revokedCount: result.count };
  }

  private async authorize(user: UserRequestType, shipmentId: string) {
    const shipment = await this.prismaService.shipment.findFirst({
      where: {
        id: shipmentId,
        ...(user.isSuperAdmin ? {} : { businessId: user.businessId }),
        business: { isActive: true, isDeleted: false },
        parcels: { some: { isDeleted: false } },
      },
      select: {
        businessId: true,
        parcels: { where: { isDeleted: false }, select: { id: true } },
      },
    });
    if (!shipment) throw new NotFoundException('Shipment not found');
    await this.validateBusinessAccess(shipment.businessId, user);
    return shipment;
  }

  private async publicShipment(shipmentId: string) {
    const shipment = await this.prismaService.shipment.findFirst({
      where: { id: shipmentId, business: { isActive: true, isDeleted: false } },
      select: {
        verificationPostcodeSource: true,
        parcels: {
          where: { isDeleted: false },
          orderBy: { id: 'asc' },
          select: {
            trackingNumber: true,
            deliveryStatus: true,
            createdAt: true,
            pickedUpAt: true,
            deliveredAt: true,
          },
        },
      },
    });
    if (!shipment?.parcels.length)
      throw new NotFoundException(TRACKING_UNAVAILABLE);
    const countsByStatus = Object.fromEntries(
      Object.values(DeliveryStatus).map((status) => [status, 0]),
    );
    shipment.parcels.forEach((parcel) => {
      countsByStatus[parcel.deliveryStatus] += 1;
    });
    return {
      parcels: shipment.parcels,
      totalParcels: shipment.parcels.length,
      countsByStatus,
      postcodeSource: shipment.verificationPostcodeSource,
    };
  }
}
