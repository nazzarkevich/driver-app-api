# Address search

The API exposes authenticated, rate-limited `GET /address-search`,
`GET /address-search/:id`, and `GET /postcodes/:postcode` endpoints. Consumers
only receive normalized application types; the Ideal Postcodes key and raw
provider payloads remain server-side.

Configuration:

```env
IDEAL_POSTCODES_API_KEY=
IDEAL_POSTCODES_BASE_URL=https://api.ideal-postcodes.co.uk/v1
ADDRESS_LOOKUP_PROVIDER=ideal-postcodes
ADDRESS_LOOKUP_TIMEOUT_MS=5000
POSTCODES_IO_BASE_URL=https://api.postcodes.io
POSTCODES_IO_ENABLED=true
```

Saved addresses retain all selected structured fields and still support manual
entries without provider metadata. Parcel creation copies both origin and
destination into JSON snapshots. `ParcelDto` reads those snapshots back through
the legacy address response fields so customer address edits cannot change
historical parcel output.

## Google Places in the admin panel

Both `GET /address-search` and `GET /address-search/:id` accept
`countryCode=GB|UA`, `provider=google-places`, and a UUID v4 `sessionToken`.
The admin customer-creation form explicitly uses Google for both countries.
Omitting `provider` keeps existing UK callers on Ideal Postcodes and Ukrainian
callers on Google. No tablet migration or database migration is required.

Enable Places API (New), billing, and server-side configuration:

```env
GOOGLE_PLACES_ENABLED=true
GOOGLE_PLACES_API_KEY=
ADDRESS_LOOKUP_TIMEOUT_MS=5000
```

Restrict the key to Places API and the server's outbound IPs where supported.
Never place the key in browser environment variables. Search results are
country-restricted; UK uses Google's `uk` region code and English results,
while Ukraine uses `ua` and Ukrainian results. Resolved country mismatches fail.
Returned addresses include normalized postal fields, a Place ID in `providerRef`,
and safe attribution links. Google lookup results bypass the application cache
and use `Cache-Control: no-store`. Logging retains operational status/timing,
not address search text, session tokens, or prediction data.

Deploy backend support before the admin frontend. If lookup is unavailable,
manual address creation stays available. Predictions and raw provider payloads
must not be persisted; selected address usage and retention remain subject to
Google's applicable Places terms. Display Google Maps and returned third-party
attributions wherever lookup content is shown.
