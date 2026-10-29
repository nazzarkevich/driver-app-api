import { DeliveryStatus, JourneyStatus } from '@prisma/client';

export interface JourneyClosureDto {
  canClose: boolean;
  reasons: string[];
  unresolvedParcelCount: number;
  unresolvedDamageCount: number;
}

export interface JourneySummaryCurrencyDto {
  currency: string;
  parcelCount: number;
  totalWeightKg: number;
  chargedAmount: string;
  collectedAmount: string;
  outstandingAmount: string;
  collectibleOutstandingAmount: string;
  exceptionOutstandingAmount: string;
  creditAmount: string;
  collectionPercent: number | null;
  averageCharge: string | null;
  chargePerKg: string | null;
  incompleteParcelCount: number;
}

export interface JourneySummaryTariffDto extends JourneySummaryCurrencyDto {
  key: string;
  tariffId: number | null;
  tariffGroupId: number | null;
  name: string;
}

export interface JourneySummaryDto {
  journeyId: number;
  status: JourneyStatus;
  updatedAt: string;
  arrivalDate: string | null;
  actualDepartureAt: string | null;
  closedAt: string | null;
  closedBy: {
    id: number;
    firstName: string | null;
    lastName: string | null;
  } | null;
  calculatedAt: string;
  closure: JourneyClosureDto;
  delivery: {
    countsByStatus: Record<DeliveryStatus, number>;
    deliveredParcelCount: number;
    resolvedParcelCount: number;
    unresolvedParcelCount: number;
    unresolvedDamageCount: number;
    deliveryPercent: number;
  };
  volume: {
    parcelCount: number;
    shipmentCount: number;
    uniqueCustomerCount: number;
    totalWeightKg: number;
    travelDurationSeconds: number | null;
  };
  financialsByCurrency: JourneySummaryCurrencyDto[];
  tariffs: JourneySummaryTariffDto[];
  unknownCurrencyParcelCount: number;
  incompletePaymentParcelCount: number;
}
