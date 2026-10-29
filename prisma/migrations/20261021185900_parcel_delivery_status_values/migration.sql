-- PostgreSQL requires enum values added with ALTER TYPE to be committed
-- before a later transaction can use them in data updates.
ALTER TYPE "DeliveryStatus" RENAME VALUE 'Initial' TO 'AtOriginWarehouse';
ALTER TYPE "DeliveryStatus" RENAME VALUE 'InProgress' TO 'InTransit';
ALTER TYPE "DeliveryStatus" ADD VALUE 'AwaitingPickup';
ALTER TYPE "DeliveryStatus" ADD VALUE 'PickedUp';
ALTER TYPE "DeliveryStatus" ADD VALUE 'AtDestinationWarehouse';
ALTER TYPE "DeliveryStatus" ADD VALUE 'AtNovaPostWarehouse';
