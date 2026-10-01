import {
  DeliveryStatus,
  ParcelType,
  PaymentStatus,
  PaymentParty,
  ParcelDestinationType,
  Prisma,
} from '@prisma/client';
import { Expose } from 'class-transformer';
import { AddressWithCountryDto } from './address-with-country.dto';

@Expose()
export class ParcelDto {
  id: number;
  businessId: number;
  weight: number;
  price: number;
  calculatedPrice?: number;
  parcelType: ParcelType;
  trackingNumber: string;
  novaPostTrackingNumber: string;
  parcelMoneyAmount: number;
  isLost: boolean;
  isArchived: boolean;
  isDamaged: boolean;
  hasBorderCheck: boolean;
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

  groupId: string | null;
  groupSize: number;

  // Relationships
  senderId: number;
  recipientId: number;
  journeyId: number | null;
  courierJourneyId: number;
  originType: ParcelDestinationType;
  originAddressId: number | null;
  originCustomerNovaPostAddressId: number | null;
  originNovaPostWarehouseId: number | null;
  destinationType: ParcelDestinationType;
  destinationAddressId: number | null;
  customerNovaPostAddressId: number | null;
  novaPostWarehouseId: number | null;
  destinationSnapshot: Prisma.JsonValue | null;
  originSnapshot: Prisma.JsonValue | null;
  originAddress: AddressWithCountryDto | null;
  originCustomerNovaPostAddress?: Record<string, any> | null;
  originNovaPostWarehouse?: Record<string, any> | null;
  destinationAddress: AddressWithCountryDto | null;
  customerNovaPostAddress?: Record<string, any> | null;
  novaPostWarehouse?: Record<string, any> | null;
  pricing?: {
    tariffId: number;
    tariffGroupId: number;
    tariff?: Record<string, any> | null;
    tariffGroup?: Record<string, any> | null;
    calculatedPrice: number;
    finalPrice: number;
    isOverridden: boolean;
    currency: string;
  };

  constructor(partial: Record<string, any>) {
    Object.assign(this, partial);

    if (partial.weight != null) this.weight = Number(partial.weight);
    if (partial.price != null) this.price = Number(partial.price);
    if (partial.calculatedPrice != null)
      this.calculatedPrice = Number(partial.calculatedPrice);
    if (partial.parcelMoneyAmount != null)
      this.parcelMoneyAmount = Number(partial.parcelMoneyAmount);

    const selectedPrice = partial.selectedPrice;
    if (
      selectedPrice?.tariffId != null &&
      selectedPrice?.tariffGroupId != null
    ) {
      this.pricing = {
        tariffId: selectedPrice.tariffId,
        tariffGroupId: selectedPrice.tariffGroupId,
        tariff: selectedPrice.tariff ?? null,
        tariffGroup:
          selectedPrice.tariffGroup ??
          selectedPrice.tariff?.tariffGroup ??
          null,
        calculatedPrice: Number(selectedPrice.baseAmount),
        finalPrice: Number(selectedPrice.finalAmount),
        isOverridden: selectedPrice.isOverridden,
        currency: selectedPrice.currency,
      };
    }

    this.groupId = partial.groupId ?? null;
    this.groupSize = partial.groupSize ?? 1;

    // Preserve the legacy response shape while sourcing parcel history from the
    // immutable snapshots instead of mutable customer address relations.
    if (partial?.originSnapshot?.type === 'CustomerAddress') {
      this.originAddress = this.addressFromSnapshot(
        partial.originSnapshot,
        partial.originAddress,
      );
    } else if (partial?.originAddress) {
      this.originAddress = new AddressWithCountryDto(
        partial.originAddress as any,
      );
    } else {
      this.originAddress = null;
    }
    if (partial?.destinationSnapshot?.type === 'CustomerAddress') {
      this.destinationAddress = this.addressFromSnapshot(
        partial.destinationSnapshot,
        partial.destinationAddress,
      );
    } else if (partial?.destinationAddress) {
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

  private addressFromSnapshot(
    snapshot: Record<string, any>,
    fallback?: Record<string, any> | null,
  ): AddressWithCountryDto {
    return new AddressWithCountryDto({
      ...(fallback ?? {}),
      ...snapshot,
      street: snapshot.line1 ?? snapshot.street,
      country: {
        ...(fallback?.country ?? {}),
        isoCode: snapshot.countryIsoCode ?? fallback?.country?.isoCode,
      },
    });
  }
}
