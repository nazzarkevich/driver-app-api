import {
  ParcelType,
  DiscountType,
  DeliveryStatus,
  PaymentStatus,
  ConnectedParcel,
} from '@prisma/client';
import { Expose } from 'class-transformer';

@Expose()
export class ParcelDto {
  id: number;
  businessId: number;
  weight: number;
  price: number;
  discount: number;
  type: ParcelType;
  discountType: DiscountType;
  notes: string;
  trackingNumber: string;
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
  connectedParcels: ConnectedParcel[];
  senderId: number;
  recipientId: number;
  journeyId: number;
  courierProfileId: number;

  constructor(partial: Partial<ParcelDto>) {
    Object.assign(this, partial);
  }
}
