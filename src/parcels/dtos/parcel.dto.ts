import {
  ParcelType,
  DiscountType,
  DeliveryStatus,
  PaymentStatus,
} from '@prisma/client';
import { Expose } from 'class-transformer';

export interface ConnectedParcelInfo {
  id: number;
  trackingNumber: string;
  connectionType: string;
  connectedAt: Date;
  sender?: {
    id: number;
    firstName: string;
    lastName: string;
  };
  recipient?: {
    id: number;
    firstName: string;
    lastName: string;
  };
}

@Expose()
export class ParcelDto {
  id: number;
  businessId: number;
  weight: number;
  price: number;
  cost: number;
  discount: number;
  cargoType: ParcelType; // Fixed: was 'type', should match schema
  discountType: DiscountType;
  notes: string;
  trackingNumber: string;
  novaPostTrackingNumber: string;
  parcelMoneyAmount: number; // TODO: should be visible only to admins
  isLost: boolean;
  isArchived: boolean;
  isDamaged: boolean;
  hasBorderCheck: boolean;
  pickupDate: Date;
  deliveryDate: Date;
  createdAt: Date;
  updatedAt: Date;
  deliveryStatus: DeliveryStatus;
  paymentStatus: PaymentStatus;

  // Connection information
  connectedParcels: ConnectedParcelInfo[];
  connectionCount: number;
  hasConnections: boolean;

  // Relationships
  senderId: number;
  recipientId: number;
  journeyId: number;
  courierJourneyId: number;
  originAddressId: number;
  destinationAddressId: number;

  constructor(partial: Partial<ParcelDto>) {
    Object.assign(this, partial);

    // Calculate connection stats
    this.connectionCount = this.connectedParcels?.length || 0;
    this.hasConnections = this.connectionCount > 0;
  }
}
