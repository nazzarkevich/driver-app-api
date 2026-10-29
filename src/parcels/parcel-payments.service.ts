import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  DeliveryStatus,
  ParcelPaymentEntryKind,
  ParcelPaymentMethod,
  PaymentReconciliationState,
  PaymentStatus,
  Prisma,
  TariffPricingType,
  UserType,
} from '@prisma/client';

import { Pagination } from 'src/dtos/pagination.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserRequestType } from 'src/users/decorators/current-user.decorator';
import {
  CashCollectionDto,
  CashCollectionType,
} from './dtos/cash-collection.dto';
import { CollectParcelPaymentDto } from './dtos/collect-parcel-payment.dto';
import { ParcelPaymentEntryDto } from './dtos/parcel-payment-entry.dto';
import { ReconcileParcelPaymentDto } from './dtos/reconcile-parcel-payment.dto';
import { ReverseParcelPaymentDto } from './dtos/reverse-parcel-payment.dto';
import { creationFingerprint } from './tracking.utils';
import { netCollectedAmount } from './payment-totals';

const MONEY_SCALE = 2;
const HISTORY_PAGE_SIZE = 15;
const EXCLUDED_COLLECTION_STATUSES: DeliveryStatus[] = [
  DeliveryStatus.Cancelled,
  DeliveryStatus.Returned,
  DeliveryStatus.Lost,
];

type Transaction = Prisma.TransactionClient;
type PaymentHistory = Pagination<ParcelPaymentEntryDto> & {
  activeCollectionCount: number;
};

@Injectable()
export class ParcelPaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async history(
    parcelId: number,
    businessId: number,
    page: number,
  ): Promise<PaymentHistory> {
    const parcel = await this.prisma.parcel.findFirst({
      where: { id: parcelId, businessId, isDeleted: false },
      select: { id: true },
    });
    if (!parcel) throw new NotFoundException('Parcel not found');

    const currentPage = Number.isInteger(page) && page > 0 ? page : 1;
    const [entries, totalCount, activeCollectionCount] = await Promise.all([
      this.prisma.parcelPaymentEntry.findMany({
        where: { parcelId, businessId },
        include: {
          collector: { select: { id: true, firstName: true, lastName: true } },
          recordedBy: { select: { id: true, firstName: true, lastName: true } },
          reversalEntry: { select: { id: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (currentPage - 1) * HISTORY_PAGE_SIZE,
        take: HISTORY_PAGE_SIZE,
      }),
      this.prisma.parcelPaymentEntry.count({ where: { parcelId, businessId } }),
      this.prisma.parcelPaymentEntry.count({
        where: {
          parcelId,
          businessId,
          kind: ParcelPaymentEntryKind.Collection,
          reversalEntry: null,
        },
      }),
    ]);
    const pageCount = Math.ceil(totalCount / HISTORY_PAGE_SIZE);
    return {
      items: entries.map((entry) => new ParcelPaymentEntryDto(entry)),
      currentPage,
      pageCount,
      totalCount,
      activeCollectionCount,
      isFirstPage: currentPage <= 1,
      isLastPage: pageCount === 0 || currentPage >= pageCount,
      previousPage: currentPage > 1 ? currentPage - 1 : null,
      nextPage: currentPage < pageCount ? currentPage + 1 : null,
    };
  }

  async collect(
    parcelId: number,
    dto: CollectParcelPaymentDto,
    user: UserRequestType,
    idempotencyKey?: string,
    allowSettled = false,
  ): Promise<void> {
    await this.mutate(
      parcelId,
      user,
      idempotencyKey,
      'collect',
      dto,
      async (tx, parcel) => {
        this.assertCollectionAllowed(parcel);
        this.assertExpectedVersion(parcel.updatedAt, dto.expectedUpdatedAt);
        const totals = await this.totals(tx, parcelId);
        if (
          allowSettled &&
          totals.collected.greaterThanOrEqualTo(parcel.price)
        ) {
          return;
        }
        const amount = this.collectionAmount(
          dto.collection,
          parcel.price,
          totals.collected,
        );
        await this.createCollection(
          tx,
          parcel,
          dto.collection,
          amount,
          user.id,
        );
        await this.updateTotals(tx, parcel, totals.collected.plus(amount));
        await this.audit(
          tx,
          user,
          parcel.businessId,
          parcelId,
          'PaymentCollected',
          'Recorded parcel payment collection',
          {
            amount: amount.toFixed(MONEY_SCALE),
            currency: parcel.paymentCurrency,
            payerParty: dto.collection.payerParty,
            method: dto.collection.method ?? ParcelPaymentMethod.Cash,
          },
        );
      },
    );
  }

  async reverse(
    parcelId: number,
    entryId: number,
    dto: ReverseParcelPaymentDto,
    user: UserRequestType,
    idempotencyKey?: string,
  ): Promise<void> {
    await this.mutate(
      parcelId,
      user,
      idempotencyKey,
      `reverse:${entryId}`,
      dto,
      async (tx, parcel) => {
        this.assertExpectedVersion(parcel.updatedAt, dto.expectedUpdatedAt);
        const original = await tx.parcelPaymentEntry.findFirst({
          where: { id: entryId, parcelId, businessId: parcel.businessId },
          include: { reversalEntry: { select: { id: true } } },
        });
        if (!original) throw new NotFoundException('Payment entry not found');
        if (original.kind === ParcelPaymentEntryKind.Reversal) {
          throw new ConflictException('Reversal entries cannot be reversed');
        }
        if (
          original.kind === ParcelPaymentEntryKind.LegacyOpeningBalance &&
          !user.isAdmin &&
          !user.isSuperAdmin &&
          user.type !== UserType.Manager
        ) {
          throw new ForbiddenException(
            'Only managers and administrators can correct legacy balances',
          );
        }
        if (original.reversalEntry) {
          throw new ConflictException(
            'Payment entry has already been reversed',
          );
        }
        const reason = dto.reason.trim();
        if (!reason)
          throw new BadRequestException('A reversal reason is required');
        const totals = await this.totals(tx, parcelId);
        const afterReversal = totals.collected.minus(original.amount);
        const reversal = await tx.parcelPaymentEntry.create({
          data: {
            businessId: parcel.businessId,
            parcelId,
            parcelPriceId: original.parcelPriceId,
            kind: ParcelPaymentEntryKind.Reversal,
            amount: original.amount,
            currency: original.currency,
            recordedById: user.id,
            reason,
            reversesEntryId: original.id,
          },
        });

        let finalCollected = afterReversal;
        let replacementEntryId: number | null = null;
        if (dto.replacement) {
          const replacementAmount = this.collectionAmount(
            dto.replacement,
            parcel.price,
            afterReversal,
          );
          const replacement = await this.createCollection(
            tx,
            parcel,
            dto.replacement,
            replacementAmount,
            user.id,
          );
          await tx.parcelPaymentEntry.update({
            where: { id: reversal.id },
            data: { replacementEntryId: replacement.id },
          });
          replacementEntryId = replacement.id;
          finalCollected = finalCollected.plus(replacementAmount);
        }
        await this.updateTotals(tx, parcel, finalCollected);
        await this.audit(
          tx,
          user,
          parcel.businessId,
          parcelId,
          dto.replacement ? 'PaymentReplaced' : 'PaymentReversed',
          'Reversed parcel payment entry',
          {
            reversedEntryId: original.id,
            reversedAmount: original.amount.toFixed(MONEY_SCALE),
            currency: original.currency,
            reversalEntryId: reversal.id,
            replacementEntryId,
            reason,
          },
        );
      },
    );
  }

  async reconcile(
    parcelId: number,
    dto: ReconcileParcelPaymentDto,
    user: UserRequestType,
    idempotencyKey?: string,
  ): Promise<void> {
    await this.mutate(
      parcelId,
      user,
      idempotencyKey,
      'reconcile',
      dto,
      async (tx, parcel) => {
        this.assertExpectedVersion(parcel.updatedAt, dto.expectedUpdatedAt);
        if (
          parcel.paymentReconciliationState !==
          PaymentReconciliationState.RequiresReconciliation
        ) {
          throw new ConflictException(
            'Parcel payment balance is already reconciled',
          );
        }
        const reason = dto.reason.trim();
        if (!reason)
          throw new BadRequestException('A reconciliation reason is required');
        const amount = this.money(dto.amount, true);
        const charge = this.money(parcel.price);
        if (amount.greaterThan(charge)) {
          throw new BadRequestException(
            'Reconciled amount cannot exceed parcel charge',
          );
        }

        let parcelPriceId = parcel.selectedPriceId;
        if (parcel.selectedPrice) {
          if (parcel.selectedPrice.currency !== dto.currency) {
            throw new ConflictException(
              'Currency does not match the pricing snapshot',
            );
          }
        } else {
          const snapshot = await tx.parcelPrice.create({
            data: {
              parcelId,
              label: 'Legacy reconciliation',
              currency: dto.currency,
              baseAmount: charge,
              finalAmount: charge,
              isSelected: true,
              isOverridden: false,
              parcelType: parcel.parcelType,
              weight: parcel.weight,
              pricingType: TariffPricingType.Fixed,
              fixedPrice: charge,
              minimumPrice: charge,
              changeReason: reason,
              changedByUserId: user.id,
            },
          });
          parcelPriceId = snapshot.id;
        }
        if (!parcelPriceId)
          throw new ConflictException('Pricing snapshot is missing');

        if (amount.greaterThan(0)) {
          await tx.parcelPaymentEntry.create({
            data: {
              businessId: parcel.businessId,
              parcelId,
              parcelPriceId,
              kind: ParcelPaymentEntryKind.LegacyOpeningBalance,
              amount,
              currency: dto.currency,
              recordedById: user.id,
              reason,
            },
          });
        }
        await tx.parcel.update({
          where: { id: parcelId },
          data: {
            selectedPriceId: parcelPriceId,
            paymentCurrency: dto.currency,
            paymentReconciliationState: PaymentReconciliationState.Reconciled,
            paymentStatus: this.status(charge, amount),
            updatedAt: new Date(),
          },
        });
        await this.audit(
          tx,
          user,
          parcel.businessId,
          parcelId,
          'PaymentReconciled',
          'Reconciled legacy parcel payment',
          {
            amount: amount.toFixed(MONEY_SCALE),
            currency: dto.currency,
            reason,
          },
        );
      },
    );
  }

  async totalsForParcel(parcelId: number) {
    return this.totals(this.prisma, parcelId);
  }

  private async mutate(
    parcelId: number,
    user: UserRequestType,
    idempotencyKey: string | undefined,
    operation: string,
    payload: unknown,
    action: (tx: Transaction, parcel: any) => Promise<void>,
  ) {
    this.assertIdempotencyKey(idempotencyKey);
    const target = await this.prisma.parcel.findUnique({
      where: { id: parcelId },
      select: { businessId: true },
    });
    if (
      !target ||
      (!user.isSuperAdmin && target.businessId !== user.businessId)
    ) {
      throw new NotFoundException('Parcel not found');
    }
    const businessId = target.businessId;
    const fingerprint = creationFingerprint({ operation, parcelId, payload });
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const keyLock = `parcel-payment-key:${businessId}:${idempotencyKey}`;
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${keyLock}, 0))::text`;
            const previous = await tx.parcelPaymentRequest.findUnique({
              where: {
                businessId_idempotencyKey: {
                  businessId,
                  idempotencyKey: idempotencyKey!,
                },
              },
            });
            if (previous) {
              if (previous.fingerprint !== fingerprint) {
                throw new ConflictException(
                  'Idempotency-Key was already used with a different request',
                );
              }
              return;
            }
            const parcelLock = `parcel-payment:${businessId}:${parcelId}`;
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${parcelLock}, 0))::text`;
            const parcel = await tx.parcel.findFirst({
              where: { id: parcelId, businessId, isDeleted: false },
              include: { selectedPrice: true },
            });
            if (!parcel) throw new NotFoundException('Parcel not found');
            await action(tx, parcel);
            await tx.parcelPaymentRequest.create({
              data: {
                businessId,
                idempotencyKey: idempotencyKey!,
                parcelId,
                operation,
                fingerprint,
                responsePayload: { parcelId },
              },
            });
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            maxWait: 10000,
            timeout: 30000,
          },
        );
      } catch (error) {
        if (
          attempt < 3 &&
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034'
        ) {
          continue;
        }
        throw error;
      }
    }
  }

  private assertCollectionAllowed(parcel: any) {
    if (
      parcel.paymentReconciliationState !==
      PaymentReconciliationState.Reconciled
    ) {
      throw new ConflictException(
        'Parcel payment balance requires reconciliation',
      );
    }
    if (!parcel.paymentCurrency || !parcel.selectedPriceId) {
      throw new ConflictException(
        'Parcel payment currency or pricing is missing',
      );
    }
    if (
      parcel.isArchived ||
      EXCLUDED_COLLECTION_STATUSES.includes(parcel.deliveryStatus)
    ) {
      throw new ConflictException(
        'Archived, cancelled, returned or lost parcels cannot collect payment',
      );
    }
  }

  private assertExpectedVersion(updatedAt: Date, expected: string) {
    if (updatedAt.getTime() !== new Date(expected).getTime()) {
      throw new ConflictException('Parcel changed. Reload it and try again');
    }
  }

  private assertIdempotencyKey(key?: string): asserts key is string {
    if (!key || !/^[A-Za-z0-9_-]{8,128}$/.test(key)) {
      throw new BadRequestException('A valid Idempotency-Key is required');
    }
  }

  private money(value: Prisma.Decimal.Value, allowZero = false) {
    const amount = new Prisma.Decimal(value);
    if (
      !amount.isFinite() ||
      (allowZero ? amount.lessThan(0) : amount.lessThanOrEqualTo(0))
    ) {
      throw new BadRequestException('Invalid monetary amount');
    }
    return amount.toDecimalPlaces(MONEY_SCALE, Prisma.Decimal.ROUND_HALF_UP);
  }

  private collectionAmount(
    collection: CashCollectionDto,
    chargeValue: Prisma.Decimal.Value,
    collectedValue: Prisma.Decimal,
  ) {
    const charge = this.money(chargeValue, true);
    const outstanding = charge.minus(collectedValue);
    if (outstanding.lessThanOrEqualTo(0)) {
      throw new ConflictException('Parcel has no outstanding balance');
    }
    if (collection.type === CashCollectionType.Full) {
      if (collection.amount !== undefined) {
        throw new BadRequestException(
          'Full collection amount is server calculated',
        );
      }
      return outstanding;
    }
    if (!collection.amount)
      throw new BadRequestException('Partial amount is required');
    const amount = this.money(collection.amount);
    if (amount.greaterThanOrEqualTo(outstanding)) {
      throw new BadRequestException(
        'Partial amount must be below the outstanding balance',
      );
    }
    return amount;
  }

  private async createCollection(
    tx: Transaction,
    parcel: any,
    collection: CashCollectionDto,
    amount: Prisma.Decimal,
    actorId: number,
  ) {
    return tx.parcelPaymentEntry.create({
      data: {
        businessId: parcel.businessId,
        parcelId: parcel.id,
        parcelPriceId: parcel.selectedPriceId,
        kind: ParcelPaymentEntryKind.Collection,
        amount,
        currency: parcel.paymentCurrency,
        method: collection.method ?? ParcelPaymentMethod.Cash,
        payerParty: collection.payerParty,
        collectorId: actorId,
        recordedById: actorId,
        note: collection.note?.trim() || null,
      },
    });
  }

  private async totals(tx: Transaction | PrismaService, parcelId: number) {
    const entries = await tx.parcelPaymentEntry.findMany({
      where: { parcelId },
      select: { kind: true, amount: true },
    });
    const collected = netCollectedAmount(entries);
    return { collected: collected.toDecimalPlaces(MONEY_SCALE) };
  }

  private status(charge: Prisma.Decimal, collected: Prisma.Decimal) {
    if (charge.equals(0) || collected.equals(charge)) return PaymentStatus.Paid;
    if (collected.equals(0)) return PaymentStatus.NotPaid;
    return PaymentStatus.PartiallyPaid;
  }

  private async updateTotals(
    tx: Transaction,
    parcel: any,
    collected: Prisma.Decimal,
  ) {
    const charge = this.money(parcel.price, true);
    if (collected.lessThan(0) || collected.greaterThan(charge)) {
      throw new ConflictException('Payment total is outside the parcel charge');
    }
    await tx.parcel.update({
      where: { id: parcel.id },
      data: {
        paymentStatus: this.status(charge, collected),
        updatedAt: new Date(),
      },
    });
  }

  private audit(
    tx: Transaction,
    user: UserRequestType,
    businessId: number,
    parcelId: number,
    eventType: string,
    description: string,
    metadata: Prisma.InputJsonValue,
  ) {
    return tx.auditLog.create({
      data: {
        userId: user.id,
        businessId,
        action: AuditAction.UPDATE,
        entityType: 'Parcel',
        entityId: String(parcelId),
        description,
        method: 'PARCEL_EVENT',
        metadata: { eventType, details: metadata },
      },
    });
  }
}
