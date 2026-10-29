import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  DeliveryStatus,
  JourneyStatus,
  PaymentReconciliationState,
  Prisma,
  UserType,
} from '@prisma/client';

import { BaseTenantService } from 'src/common/base-tenant.service';
import { netCollectedAmount } from 'src/parcels/payment-totals';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserRequestType } from 'src/users/decorators/current-user.decorator';
import {
  JourneyClosureDto,
  JourneySummaryDto,
} from '../dtos/journey-summary.dto';
import { TransitionJourneyDto } from '../dtos/transition-journey.dto';

const FINAL_STATUSES = new Set<DeliveryStatus>([
  DeliveryStatus.Delivered,
  DeliveryStatus.Returned,
  DeliveryStatus.Cancelled,
  DeliveryStatus.Lost,
]);
const EXCEPTION_STATUSES = new Set<DeliveryStatus>([
  DeliveryStatus.Returned,
  DeliveryStatus.Cancelled,
  DeliveryStatus.Lost,
]);

const journeySelect = {
  id: true,
  status: true,
  updatedAt: true,
  arrivalDate: true,
  actualDepartureAt: true,
  isArchived: true,
  closedAt: true,
  closedBy: { select: { id: true, firstName: true, lastName: true } },
  driverProfiles: { select: { userId: true, isDeleted: true } },
} satisfies Prisma.JourneySelect;

type SummaryJourney = Prisma.JourneyGetPayload<{
  select: typeof journeySelect;
}>;
type ParcelState = { deliveryStatus: DeliveryStatus; isDamaged: boolean };
type Bucket = {
  currency: string;
  parcelCount: number;
  weight: Prisma.Decimal;
  charged: Prisma.Decimal;
  collected: Prisma.Decimal;
  outstanding: Prisma.Decimal;
  collectible: Prisma.Decimal;
  exception: Prisma.Decimal;
  credit: Prisma.Decimal;
  incomplete: number;
};

const createBucket = (currency: string): Bucket => ({
  currency,
  parcelCount: 0,
  weight: new Prisma.Decimal(0),
  charged: new Prisma.Decimal(0),
  collected: new Prisma.Decimal(0),
  outstanding: new Prisma.Decimal(0),
  collectible: new Prisma.Decimal(0),
  exception: new Prisma.Decimal(0),
  credit: new Prisma.Decimal(0),
  incomplete: 0,
});

const serializeBucket = (bucket: Bucket) => ({
  currency: bucket.currency,
  parcelCount: bucket.parcelCount,
  totalWeightKg: Number(bucket.weight),
  chargedAmount: bucket.charged.toFixed(2),
  collectedAmount: bucket.collected.toFixed(2),
  outstandingAmount: bucket.outstanding.toFixed(2),
  collectibleOutstandingAmount: bucket.collectible.toFixed(2),
  exceptionOutstandingAmount: bucket.exception.toFixed(2),
  creditAmount: bucket.credit.toFixed(2),
  incompleteParcelCount: bucket.incomplete,
  collectionPercent:
    bucket.incomplete > 0 || bucket.charged.isZero()
      ? null
      : Number(bucket.collected.div(bucket.charged).mul(100).toFixed(1)),
  averageCharge: bucket.parcelCount
    ? bucket.charged.div(bucket.parcelCount).toFixed(2)
    : null,
  chargePerKg: bucket.weight.greaterThan(0)
    ? bucket.charged.div(bucket.weight).toFixed(2)
    : null,
});

const closureFor = (
  journey: Pick<SummaryJourney, 'status' | 'closedAt' | 'isArchived'>,
  parcels: ReadonlyArray<ParcelState>,
): JourneyClosureDto => {
  const unresolvedParcelCount = parcels.filter(
    (parcel) => !FINAL_STATUSES.has(parcel.deliveryStatus),
  ).length;
  const unresolvedDamageCount = parcels.filter(
    (parcel) => parcel.isDamaged,
  ).length;
  const reasons: string[] = [];
  if (journey.closedAt) reasons.push('AlreadyClosed');
  if (journey.status !== JourneyStatus.Completed)
    reasons.push('JourneyNotCompleted');
  if (journey.isArchived) reasons.push('JourneyArchived');
  if (parcels.length === 0) reasons.push('NoParcels');
  if (unresolvedParcelCount) reasons.push('UnresolvedDeliveries');
  if (unresolvedDamageCount) reasons.push('UnresolvedDamage');
  return {
    canClose: reasons.length === 0,
    reasons,
    unresolvedParcelCount,
    unresolvedDamageCount,
  };
};

@Injectable()
export class JourneySummaryService extends BaseTenantService {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  private async accessibleJourney(
    tx: Prisma.TransactionClient,
    id: number,
    user: UserRequestType,
  ): Promise<SummaryJourney> {
    const journey = await tx.journey.findFirst({
      where: { id, businessId: user.businessId, isDeleted: false },
      select: journeySelect,
    });
    if (!journey) throw new NotFoundException('Journey not found');
    if (
      user.type === UserType.InternationalDriver &&
      !journey.driverProfiles.some(
        (driver) => driver.userId === user.id && !driver.isDeleted,
      )
    ) {
      throw new ForbiddenException(
        'Drivers can only access their own journeys',
      );
    }
    return journey;
  }

  async summary(id: number, user: UserRequestType): Promise<JourneySummaryDto> {
    await this.validateBusinessAccess(user.businessId, user);
    return this.prismaService.$transaction(
      async (tx) => {
        const journey = await this.accessibleJourney(tx, id, user);
        const parcels = await tx.parcel.findMany({
          where: {
            journeyId: id,
            businessId: user.businessId,
            isDeleted: false,
          },
          select: {
            id: true,
            shipmentId: true,
            groupId: true,
            senderId: true,
            recipientId: true,
            deliveryStatus: true,
            isDamaged: true,
            weight: true,
            price: true,
            paymentCurrency: true,
            paymentReconciliationState: true,
            selectedPrice: {
              select: {
                tariffId: true,
                tariffGroupId: true,
                tariffName: true,
                tariffGroupName: true,
                label: true,
                currency: true,
              },
            },
            paymentEntries: {
              select: { kind: true, amount: true, currency: true },
            },
          },
        });
        const currencies = new Map<string, Bucket>();
        const tariffs = new Map<
          string,
          {
            bucket: Bucket;
            tariffId: number | null;
            tariffGroupId: number | null;
            name: string;
          }
        >();
        const countsByStatus = Object.fromEntries(
          Object.values(DeliveryStatus).map((status) => [status, 0]),
        ) as Record<DeliveryStatus, number>;
        const customers = new Set<number>();
        const shipments = new Set<string>();
        let weight = new Prisma.Decimal(0);
        let unknownCurrencyParcelCount = 0;
        let incompletePaymentParcelCount = 0;

        for (const parcel of parcels) {
          countsByStatus[parcel.deliveryStatus]++;
          customers.add(parcel.senderId);
          customers.add(parcel.recipientId);
          shipments.add(
            parcel.shipmentId
              ? `shipment:${parcel.shipmentId}`
              : parcel.groupId
                ? `group:${parcel.groupId}`
                : `parcel:${parcel.id}`,
          );
          weight = weight.plus(parcel.weight);
          const currency =
            parcel.paymentCurrency || parcel.selectedPrice?.currency;
          if (!currency) {
            unknownCurrencyParcelCount++;
            incompletePaymentParcelCount++;
            continue;
          }
          const price = parcel.selectedPrice;
          const name = price?.tariffName || price?.label || 'Без тарифу';
          const tariffKey = JSON.stringify([
            price?.tariffGroupId ?? null,
            price?.tariffId ?? null,
            name,
            currency,
          ]);
          if (!currencies.has(currency))
            currencies.set(currency, createBucket(currency));
          if (!tariffs.has(tariffKey)) {
            tariffs.set(tariffKey, {
              bucket: createBucket(currency),
              name,
              tariffId: price?.tariffId ?? null,
              tariffGroupId: price?.tariffGroupId ?? null,
            });
          }
          const collected = netCollectedAmount(parcel.paymentEntries);
          const isReconciled =
            parcel.paymentReconciliationState ===
              PaymentReconciliationState.Reconciled &&
            Boolean(parcel.paymentCurrency) &&
            parcel.paymentEntries.every(
              (entry) => entry.currency === currency,
            ) &&
            !collected.lessThan(0);
          if (!isReconciled) incompletePaymentParcelCount++;
          for (const bucket of [
            currencies.get(currency),
            tariffs.get(tariffKey).bucket,
          ]) {
            bucket.parcelCount++;
            bucket.weight = bucket.weight.plus(parcel.weight);
            bucket.charged = bucket.charged.plus(parcel.price);
            if (!isReconciled) {
              bucket.incomplete++;
              continue;
            }
            const balance = parcel.price.minus(collected);
            const outstanding = Prisma.Decimal.max(balance, 0);
            bucket.collected = bucket.collected.plus(collected);
            bucket.outstanding = bucket.outstanding.plus(outstanding);
            bucket.credit = bucket.credit.plus(
              Prisma.Decimal.max(balance.negated(), 0),
            );
            if (EXCEPTION_STATUSES.has(parcel.deliveryStatus)) {
              bucket.exception = bucket.exception.plus(outstanding);
            } else {
              bucket.collectible = bucket.collectible.plus(outstanding);
            }
          }
        }

        const closure = closureFor(journey, parcels);
        return {
          journeyId: id,
          status: journey.status,
          updatedAt: journey.updatedAt.toISOString(),
          actualDepartureAt: journey.actualDepartureAt?.toISOString() ?? null,
          arrivalDate: journey.arrivalDate?.toISOString() ?? null,
          closedAt: journey.closedAt?.toISOString() ?? null,
          closedBy: journey.closedBy,
          calculatedAt: new Date().toISOString(),
          closure,
          delivery: {
            countsByStatus,
            deliveredParcelCount: countsByStatus.Delivered,
            resolvedParcelCount: parcels.length - closure.unresolvedParcelCount,
            unresolvedParcelCount: closure.unresolvedParcelCount,
            unresolvedDamageCount: closure.unresolvedDamageCount,
            deliveryPercent: parcels.length
              ? Number(
                  ((countsByStatus.Delivered * 100) / parcels.length).toFixed(
                    1,
                  ),
                )
              : 0,
          },
          volume: {
            parcelCount: parcels.length,
            shipmentCount: shipments.size,
            uniqueCustomerCount: customers.size,
            totalWeightKg: Number(weight),
            travelDurationSeconds:
              journey.actualDepartureAt && journey.arrivalDate
                ? Math.max(
                    0,
                    Math.round(
                      (journey.arrivalDate.getTime() -
                        journey.actualDepartureAt.getTime()) /
                        1000,
                    ),
                  )
                : null,
          },
          financialsByCurrency: [...currencies.values()]
            .sort((a, b) => a.currency.localeCompare(b.currency))
            .map(serializeBucket),
          tariffs: [...tariffs.entries()]
            .map(([key, row]) => ({
              key,
              name: row.name,
              tariffId: row.tariffId,
              tariffGroupId: row.tariffGroupId,
              ...serializeBucket(row.bucket),
            }))
            .sort(
              (a, b) =>
                a.currency.localeCompare(b.currency) ||
                a.name.localeCompare(b.name),
            ),
          unknownCurrencyParcelCount,
          incompletePaymentParcelCount,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async close(
    id: number,
    body: TransitionJourneyDto,
    user: UserRequestType,
  ): Promise<void> {
    await this.validateBusinessAccess(user.businessId, user);
    await this.prismaService
      .$transaction(
        async (tx) => {
          const journey = await this.accessibleJourney(tx, id, user);
          // A repeated request retains the original close date and audit event.
          if (journey.closedAt) return;
          if (journey.updatedAt.toISOString() !== body.expectedUpdatedAt) {
            throw new ConflictException('Journey was changed by another user');
          }
          const parcels = await tx.parcel.findMany({
            where: {
              journeyId: id,
              businessId: user.businessId,
              isDeleted: false,
            },
            select: { deliveryStatus: true, isDamaged: true },
          });
          const closure = closureFor(journey, parcels);
          if (!closure.canClose) {
            throw new ConflictException({
              message: 'Journey is not ready to close',
              ...closure,
            });
          }
          const closedAt = new Date();
          const updated = await tx.journey.updateMany({
            where: {
              id,
              businessId: user.businessId,
              updatedAt: journey.updatedAt,
              closedAt: null,
            },
            data: { closedAt, closedByUserId: user.id },
          });
          if (updated.count !== 1)
            throw new ConflictException('Journey was changed by another user');
          await tx.auditLog.create({
            data: {
              businessId: user.businessId,
              userId: user.id,
              action: AuditAction.UPDATE,
              entityType: 'Journey',
              entityId: String(id),
              method: 'JOURNEY_EVENT',
              description: 'Journey finally closed',
              metadata: {
                eventType: 'JourneyClosed',
                details: { closedAt: closedAt.toISOString() },
              },
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
      .catch((error: unknown) => {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034'
        ) {
          throw new ConflictException(
            'Journey or its parcels changed. Reload the summary and try again',
          );
        }
        throw error;
      });
  }
}
