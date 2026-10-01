# UK address search

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
