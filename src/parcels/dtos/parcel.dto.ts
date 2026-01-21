import {
  ParcelType,
  DiscountType,
  DeliveryStatus,
  PaymentStatus,
  PaymentParty,
} from '@prisma/client';
import { Expose } from 'class-transformer';
import { AddressWithCountryDto } from './address-with-country.dto';

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
  paidBy: PaymentParty;
  pickedUpByCourierId?: number | null;
  pickedUpByDriverId?: number | null;
  pickedUpAt?: Date | null;
  deliveredByCourierId?: number | null;
  deliveredByDriverId?: number | null;
  deliveredAt?: Date | null;
  pickedUpBy?: {
    id: number;
    firstName: string;
    lastName: string;
  } | null;
  deliveredBy?: {
    id: number;
    firstName: string;
    lastName: string;
  } | null;

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
  originAddress: AddressWithCountryDto;
  destinationAddress: AddressWithCountryDto;

  constructor(partial: Partial<ParcelDto> & Record<string, any>) {
    Object.assign(this, partial);

    this.connectionCount = this.connectedParcels?.length || 0;
    this.hasConnections = this.connectionCount > 0;

    if (partial?.originAddress) {
      this.originAddress = new AddressWithCountryDto(
        partial.originAddress as any,
      );
    }
    if (partial?.destinationAddress) {
      this.destinationAddress = new AddressWithCountryDto(
        partial.destinationAddress as any,
      );
    }

    const pickedUpByCourier = partial?.pickedUpByCourier as any;
    const pickedUpByDriver = partial?.pickedUpByDriver as any;
    if (pickedUpByCourier?.user) {
      this.pickedUpBy = {
        id: pickedUpByCourier.user.id,
        firstName: pickedUpByCourier.user.firstName,
        lastName: pickedUpByCourier.user.lastName,
      };
    } else if (pickedUpByDriver?.user) {
      this.pickedUpBy = {
        id: pickedUpByDriver.user.id,
        firstName: pickedUpByDriver.user.firstName,
        lastName: pickedUpByDriver.user.lastName,
      };
    }

    const deliveredByCourier = partial?.deliveredByCourier as any;
    const deliveredByDriver = partial?.deliveredByDriver as any;
    if (deliveredByCourier?.user) {
      this.deliveredBy = {
        id: deliveredByCourier.user.id,
        firstName: deliveredByCourier.user.firstName,
        lastName: deliveredByCourier.user.lastName,
      };
    } else if (deliveredByDriver?.user) {
      this.deliveredBy = {
        id: deliveredByDriver.user.id,
        firstName: deliveredByDriver.user.firstName,
        lastName: deliveredByDriver.user.lastName,
      };
    }
  }
}
