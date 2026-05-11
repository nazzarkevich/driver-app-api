-- Add groupId to Parcel
ALTER TABLE "Parcel" ADD COLUMN "groupId" UUID;

-- Create index for groupId lookups
CREATE INDEX "Parcel_groupId_idx" ON "Parcel"("groupId");

-- Backfill: assign a shared UUID to parcels connected via batch/bulk
-- Each cluster of connected parcels (reachable via ConnectedParcel) gets one UUID
DO $$
DECLARE
  rec RECORD;
  cluster_uuid UUID;
  parcel_id INT;
  visited INT[] := '{}';
  queue INT[];
  current_id INT;
  neighbor_ids INT[];
BEGIN
  FOR rec IN SELECT DISTINCT "parcelId" FROM "ConnectedParcel" LOOP
    IF NOT (rec."parcelId" = ANY(visited)) THEN
      cluster_uuid := gen_random_uuid();
      queue := ARRAY[rec."parcelId"];
      WHILE array_length(queue, 1) > 0 LOOP
        current_id := queue[1];
        queue := queue[2:];
        IF NOT (current_id = ANY(visited)) THEN
          visited := array_append(visited, current_id);
          UPDATE "Parcel" SET "groupId" = cluster_uuid WHERE id = current_id;
          SELECT array_agg(CASE WHEN "parcelId" = current_id THEN "connectedToId" ELSE "parcelId" END)
          INTO neighbor_ids
          FROM "ConnectedParcel"
          WHERE "parcelId" = current_id OR "connectedToId" = current_id;
          IF neighbor_ids IS NOT NULL THEN
            SELECT array_agg(n) INTO neighbor_ids
            FROM unnest(neighbor_ids) AS n
            WHERE NOT (n = ANY(visited));
            IF neighbor_ids IS NOT NULL THEN
              queue := queue || neighbor_ids;
            END IF;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END $$;

-- Drop ConnectedParcel table
DROP TABLE "ConnectedParcel";
