# Ukrainian customer address lookup

The tablet enables Google autocomplete only on customer creation. UK requests default to Ideal Postcodes; parcel and customer-edit screens are unchanged.

## Configuration

- `GOOGLE_PLACES_ENABLED=false` (default). Set true only after the requirements below are met.
- `GOOGLE_PLACES_API_KEY`: server secret; never an EXPO_PUBLIC variable.
- `ADDRESS_LOOKUP_TIMEOUT_MS=5000`.

Enable Places API (New) and billing. Restrict the key to that API and static server egress IPs where available. Configure quotas and budget alerts. Google requests use only Autocomplete and Place Details address fields. No database migration is needed.

Before production, confirm the account agreement permits reusable customer address storage: the standard autocomplete street-address exception is transaction-specific. Publish the application's public terms/privacy policies incorporating the required Google terms/privacy references. The UI includes Google terms/privacy links and Google Maps attribution; those do not substitute for the application's own public policies. Review https://developers.google.com/maps/documentation/places/web-service/policies for the billing account's applicable terms, including EEA differences.

## Contract

`GET /address-search?query=...&countryCode=UA&sessionToken=<UUID-v4>` returns `{ results: [{ id, label }] }`.
`GET /address-search/:id?countryCode=UA&sessionToken=<same-token>` returns countryCode, street, building, city, village, region, postcode, provider, providerRef, and attributions. Address components can be null. Details verifies country UA.

GB is the default and retains its existing response and server cache. Google lookup is never server-cached; global HTTP middleware sends no-store. Frontend sessions are temporary, independent per address, and end on a details attempt or abandonment. Requests are not automatically retried. The provider logs operation, status and duration only; the global exception filter redacts lookup URLs. Configure upstream proxy/APM access logs to omit lookup query strings and IDs too.

Save only reviewed customer address fields and the Place ID; never store prediction lists, raw provider data, or Google coordinates. Customer-create now preserves building and flat. Physical address edits clear provenance in the new editor.

## Rollout and manual checks

Deploy backend before frontend. Enable staging first. Check Cyrillic and transliterated queries, rural settlements, duplicate street names, partial results, missing house numbers, country switching, rapid typing, removing address cards, and separate sessions for multiple addresses. Verify building/flat round trips, manual entry during outages/429s, and that Google data never enters the persisted lookup cache. Check UK lookup, customer editing, parcel flow, and Nova Post regression scenarios. Run builds and existing tests only; do not add test cases. Disable GOOGLE_PLACES_ENABLED to stop Google requests while leaving manual entry working.
