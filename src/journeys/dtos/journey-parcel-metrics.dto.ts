export class JourneyParcelMetricsDto {
  journeyId: number;
  totalParcelCount: number;
  collectedParcelCount: number;
  totalWeightKg: number;
  collectionProgressPercent: number;
  parcelCountTarget: number;
  weightTargetKg: number;
  parcelCountTargetProgressPercent: number;
  weightTargetProgressPercent: number;
  readyParcelCount: number;
  blockingParcelCount: number;
  novaPostWarehouseCount: number;
  deliveredParcelCount: number;
  readyForDeliveryCount: number;
  countsByStatus: Record<string, number>;

  constructor(partial: JourneyParcelMetricsDto) {
    Object.assign(this, partial);
  }
}
