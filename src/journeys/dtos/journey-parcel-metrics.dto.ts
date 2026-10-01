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

  constructor(partial: JourneyParcelMetricsDto) {
    Object.assign(this, partial);
  }
}
