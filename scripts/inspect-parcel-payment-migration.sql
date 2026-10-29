SELECT
  COUNT(*) FILTER (WHERE p."selectedPriceId" IS NULL) AS missing_selected_price,
  COUNT(*) FILTER (WHERE pp."currency" IS NULL) AS missing_currency,
  COUNT(*) FILTER (
    WHERE pp."id" IS NOT NULL AND p."price" <> pp."finalAmount"
  ) AS price_snapshot_mismatch,
  COUNT(*) FILTER (WHERE p."paymentStatus" = 'Paid') AS legacy_paid,
  COUNT(*) FILTER (WHERE p."paymentStatus" = 'PartiallyPaid') AS legacy_partial,
  COUNT(*) FILTER (WHERE p."price" = 0) AS zero_charge
FROM "Parcel" p
LEFT JOIN "ParcelPrice" pp ON pp."id" = p."selectedPriceId"
WHERE p."isDeleted" = false;
