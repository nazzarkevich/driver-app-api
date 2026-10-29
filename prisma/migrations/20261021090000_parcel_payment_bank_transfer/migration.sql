-- Add manually confirmed bank transfers without changing existing cash entries.
ALTER TYPE "ParcelPaymentMethod" ADD VALUE IF NOT EXISTS 'BankTransfer';
