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

The application reads the validated static catalog directly. Data parsing and
validation live in the importer, while UI types are defined in
`src/data/types.ts`.

## Live navigation

The nearest-bin action keeps a geolocation watch active so distance and bearing
continue to update while the user moves. On supported phones, the same user
gesture requests compass access and rotates the on-screen arrow relative to the
device heading. If compass data is unavailable, the UI hides the arrow and shows
distance only instead of presenting misleading guidance.
