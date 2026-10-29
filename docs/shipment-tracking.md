# Shipment tracking

Parcel references retain their existing format. A shipment connects physical parcels for customer tracking; single-parcel shipments are supported too. `groupId` and existing parcel endpoints remain compatible.

New parcel references use a three-digit daily sequence, for example `SLVGB260902-001`. The sequence runs from `001` to `999` per business and resets each UTC day. Creation beyond that daily limit fails rather than issuing a longer reference. Existing references are never renumbered.

## Deployment

1. Back up the database and apply migrations with `npx prisma migrate deploy`.
2. Generate the Prisma client (`npx prisma generate`) and deploy the backend.
3. Once every old backend instance has stopped, run `npx prisma db execute --file scripts/backfill-shipments.sql --schema prisma/schema.prisma`. This idempotent catch-up covers parcels created by old instances between migration and deployment. It never changes existing shipment verification data.
4. Confirm `SELECT count(*) FROM "Parcel" WHERE "shipmentId" IS NULL;` returns zero. Check grouped parcel counts by business and spot-check postcode sources before enabling customer tracking.
5. Configure `EXPO_PUBLIC_TRACKING_BASE_URL` to the HTTPS origin or site base path serving the future customer tracking page, then rebuild the tablet. Leave it unset until that page exists; link copying remains disabled. Link revocation remains available.

`shipmentId` is nullable at the database boundary for rolling deployment compatibility. The new creation service always assigns it. Migration and catch-up derive tenant-scoped shipment IDs from existing parcel groups and never renumber parcels. Inconsistent or incomplete legacy group postcodes disable manual lookup instead of choosing an arbitrary postcode.

If behind a reverse proxy, configure `TRUST_PROXY` with the trusted proxy subnet(s), or an exact hop count only when every ingress path has that many hops. Do not trust arbitrary forwarded headers. Without this setting, clients behind the proxy share its IP rate limit.

## Public API

Paths below are relative to the existing API base URL. Serve the future website through a same-origin API proxy or separately configure an explicit permitted CORS origin.

- `POST /public/tracking/lookup`: `{ "businessId": 1, "trackingNumber": "SLVUA261008-001", "postcode": "79001" }`.
- `POST /public/tracking/resolve`: `{ "token": "<64 lowercase hex characters>" }`.

Both return HTTP 200 with `parcels` (reference, delivery status, created/picked-up/delivered timestamps), `totalParcels`, `countsByStatus`, and `postcodeSource`. They exclude internal IDs, postcodes, names, addresses, contacts, payment details, money contents, staff identities and notes. Tracking always excludes deleted parcels and inactive/deleted businesses.

Manual lookup compares the normalized destination postcode recorded at creation, or the sender postcode if destination postcode is absent. Normalization removes whitespace and uppercases letters; leading zeros remain significant. No postcode means manual lookup is unavailable. Unknown references, incorrect postcodes, unavailable manual lookup and invalid/revoked links share a generic HTTP 404 response. Invalid request shapes return HTTP 400.

Shared PostgreSQL counters limit both endpoints to 20 attempts/IP/minute and manual lookup to 5 attempts/business/reference/IP/15 minutes. HTTP 429 includes `Retry-After`. Expired counters are cleaned in bounded batches during successful requests. Responses are not cached; raw lookup bodies and link secrets are excluded from audit logging.

## Staff API and links

- `POST /shipments/:id/tracking-links`: returns `{ "token": "..." }` once. Requires parcel read/update permissions and shipment business access. Tokens contain 256 random bits and only SHA-256 hashes are stored. Multiple links can remain active.
- `POST /shipments/:id/tracking-links/revoke`: returns `{ "revokedCount": 2 }`; revokes every active link for the shipment. Uses the same access rules.

The tablet copies `<tracking-base>/track#<token>`. The future page must read the fragment, clear it from the visible address with `history.replaceState`, and send it only in the resolve request body. Fragments are never sent to web/proxy access logs. Do not add request-body logging or analytics that capture the token, postcode, or complete tracking URL. Links open directly and remain valid until revoked. Each copy issues a fresh link, so copying after another staff member revokes links does not reuse a revoked token. Older links remain active until explicitly revoked.

Parcel responses add `shipmentId` and `tracking: { manualLookupAvailable, postcodeSource }`; the stored verification postcode is never added to staff tracking metadata. Manual lookup and secure links reveal the entire shipment, so references within a shipment have the same limited viewing scope.

## Retry-safe creation

Both parcel creation endpoints accept an optional `Idempotency-Key` (8–128 ASCII letters, digits, underscores or hyphens). Existing clients without a key continue to work. The tablet generates UUID keys and keeps the same key for an identical unresolved submission, including automatic and manual retries while the form remains mounted. Changed payloads receive separate keys; successful submissions clear their key. Closing the form or restarting the app ends this in-memory retry context.

Keys are scoped to business and requesting user. Canonical payload fingerprints include whether creation was single or bulk. An advisory transaction lock serializes matching keys; the record and parcel IDs commit with the shipment. Identical retries return the original parcels in their original order, while different payloads return HTTP 409. Records are retained so old retries cannot create duplicates. Audit writes occur after the creation transaction and contain no tracking tokens.
