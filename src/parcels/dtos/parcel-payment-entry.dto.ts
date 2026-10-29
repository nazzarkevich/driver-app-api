import {
  ParcelPaymentEntryKind,
  ParcelPaymentMethod,
  PaymentParty,
} from '@prisma/client';

type Actor = { id: number; firstName: string | null; lastName: string | null };

export class ParcelPaymentEntryDto {
  id: number;
  kind: ParcelPaymentEntryKind;
  amount: string;
  currency: string;
  method: ParcelPaymentMethod | null;
  payerParty: PaymentParty | null;
  note: string | null;
  reason: string | null;
  createdAt: Date;
  collector: Actor | null;
  recordedBy: Actor | null;
  reversesEntryId: number | null;
  reversalEntryId: number | null;
  replacementEntryId: number | null;

  constructor(entry: Record<string, any>) {
    this.id = entry.id;
    this.kind = entry.kind;
    this.amount = entry.amount.toFixed(2);
    this.currency = entry.currency;
    this.method = entry.method ?? null;
    this.payerParty = entry.payerParty ?? null;
    this.note = entry.note ?? null;
    this.reason = entry.reason ?? null;
    this.createdAt = entry.createdAt;
    this.collector = entry.collector ?? null;
    this.recordedBy = entry.recordedBy ?? null;
    this.reversesEntryId = entry.reversesEntryId ?? null;
    this.reversalEntryId = entry.reversalEntry?.id ?? null;
    this.replacementEntryId = entry.replacementEntryId ?? null;
  }
}
