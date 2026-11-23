import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

// Serialize lifecycle changes and new parcel selections for a customer. Callers
// locking several profiles must do so in ascending ID order to avoid deadlocks.
export async function lockNovaPostCustomer(
  tx: Prisma.TransactionClient,
  customerId: number,
  businessId: number,
) {
  const rows = await tx.$queryRaw<{ id: number }[]>(Prisma.sql`
    SELECT id FROM "CustomerProfile"
    WHERE id = ${customerId} AND "businessId" = ${businessId} AND "isDeleted" = false
    FOR UPDATE
  `);
  if (!rows.length) throw new NotFoundException('Customer profile not found');
}
