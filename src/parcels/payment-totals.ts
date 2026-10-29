import { ParcelPaymentEntryKind, Prisma } from '@prisma/client';

export const netCollectedAmount = (
  entries: ReadonlyArray<{
    kind: ParcelPaymentEntryKind;
    amount: Prisma.Decimal.Value;
  }>,
): Prisma.Decimal =>
  entries.reduce(
    (total, entry) =>
      entry.kind === ParcelPaymentEntryKind.Reversal
        ? total.minus(entry.amount)
        : total.plus(entry.amount),
    new Prisma.Decimal(0),
  );
