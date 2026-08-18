# TAU Recycling Map

A static Vite + React map of recycling points at Tel Aviv University. The app
uses the public Esri World Imagery tile layer, stores all locations in a local
JSON file, and opens walking directions in Google Maps without an API key.

## Development

Prerequisites: a Node.js version supported by Vite 8, pnpm 10, and `unzip`
when refreshing the source KMZ.

```sh
pnpm install
pnpm dev
```

## Validation

```sh
pnpm check
```

`pnpm check` verifies formatting, lint rules, tests, strict TypeScript, and the
production build. The individual commands remain available as `pnpm
format:check`, `pnpm lint`, `pnpm test`, `pnpm typecheck`, and `pnpm build`.

## Refresh the source data

Pass the KMZ file to the importer. It validates all six categories before
atomically replacing the normalized JSON file. Original PNG assets are
extracted separately; the custom SVG icons used by the interface are preserved.

```sh
pnpm data:import /absolute/path/to/map.kmz
```

The shipped application still imports the bundled local JSON directly, so this
refactor does not change the live data-loading behavior. A provider-backed path
is implemented behind `recyclingLocationsSourceEnabled = false` in
`src/config/recycling-data.ts`; it remains dormant until a remote point source is
ready. Its tests enable the path explicitly and cover loading, validation,
failure, retry, cancellation, and React Strict Mode behavior.

## Data source boundary

The map components consume only the normalized `RecyclingCatalog` model from
`src/data/types.ts`. UI metadata and point storage are separate:

- `src/config/recycling-categories.json` is the local source of truth for labels,
  colors, and icons. The KMZ importer also reads this file.
- `src/data/sources/recycling-locations-source.ts` defines the asynchronous point
  source contract.
- `src/data/sources/local-json-recycling-locations-source.ts` adapts the current
  JSON and returns only normalized locations plus source metadata.
- `src/data/validation/recycling-catalog.ts` validates data from any provider.
- `src/config/recycling-data.ts` contains the default-off switch and lazily
  creates the provider configuration only when that path is enabled.
- `src/hooks/useRecyclingLocations.ts` owns loading, failure, retry, and request
  cancellation.

To move the points to ArcGIS later, add an adapter that queries the Feature
Layer, maps its features into a `RecyclingLocationsSnapshot`, switch the
concrete source in `src/config/recycling-data.ts`, verify it, and only then set
`recyclingLocationsSourceEnabled` to `true`. The categories stay local, the
bundled point JSON can then be removed from the runtime, and
`RecyclingMapApp`, Leaflet, filters, navigation, and location details should not
need provider-specific changes.

The ArcGIS adapter should use an immutable ID field such as GlobalID, explicitly
request WGS84 coordinates (`outSR=4326`, mapping `x` to `lng` and `y` to `lat`),
map category values to the existing category IDs, handle pagination and ArcGIS
error payloads, and support `AbortSignal`. This static frontend must not contain
a private ArcGIS token; direct browser access requires a public, CORS-enabled
Feature Layer or a separately secured backend. The Esri imagery URL in
`src/config/basemap.ts` is only the basemap and is independent of the point data
source.

## Bin photos

Each location can optionally include an `imageUrl` in
`src/data/recycling-locations.json`. Local images belong in `public/images` and
use a relative `./images/...` URL so the production build can be hosted at a
domain root or inside any subdirectory. Future externally hosted images should
use HTTPS.

```json
{
  "id": "cardboard-321144828-348068464",
  "categoryId": "cardboard",
  "lat": 32.1144828,
  "lng": 34.8068464,
  "descriptionHe": null,
  "imageUrl": "./images/cardboard-bin-demo.webp"
}
```

Locations without `imageUrl` keep the original details layout. Images that fail
to load are hidden, and the browser sends no referrer when requesting external
images. External hosts still receive the visitor's image request and IP, so do
not store secrets or durable credentials in these public JSON URLs. Refreshing
the KMZ preserves existing `imageUrl` values by stable location ID.

## Static deployment

Build the production files with pnpm:

```sh
pnpm install --frozen-lockfile
pnpm check
```

Upload the complete contents of `dist` to a static file server. The Vite build
and all local public assets use relative URLs, so the same build can be served
from a domain root such as `https://recycling.example.edu/` or a nested path
such as `https://www.example.edu/sustainability/recycling/`. Keep the directory
URL's trailing slash (static servers normally add it with a redirect), preserve
the generated directory structure, and serve the site over HTTPS for browser
location and orientation permissions.

## Live navigation

The nearest-bin action keeps a geolocation watch active so distance and bearing
continue to update while the user moves. On supported phones, the same user
gesture requests compass access and rotates the on-screen arrow relative to the
device heading. If compass data is unavailable, the UI hides the arrow and shows
distance only instead of presenting misleading guidance.
