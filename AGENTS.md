## Learned User Preferences

- For larger map and data changes, plan-first work may include explicit confirmations (for example prefetch behavior, tooltip number style, and whether the sidebar year tracks playback).
- Map time controls are expected together in one bottom floating card (year scrubber, play or pause, loop, speed), visually consistent with other map overlays.
- Map playback speed is preferred as step up and down controls rather than a dropdown.
- Random dataset selection is placed in the sidebar rather than only on the map or plot surface.
- Toolbar dataset search is separate from the sidebar dataset selector: search finds and applies a dataset for the current view; the sidebar dropdown shows the active dataset and lists only datasets compatible with that view.
- Province and district tags are capitalized in the search UI and in the sidebar where those labels appear.
- When the sidebar is collapsed, it stays a narrow right rail with expand, random dataset, and map layer toggles—reopening does not rely on a bottom-right FAB that would overlap Leaflet zoom.
- Sidebar width changes use a tweened layout transition rather than a spring so expand/collapse feels less bouncy.

## Learned Workspace Facts

- lanka-mapper is a Next.js TypeScript app that combines LDFLK datasets with a live nuuuwan-derived catalog; temporal datasets can preload series when `hasTime`, and map playback advances years via `applyMapYearFromSeries` using in-memory `seriesData` without refetching each tick.
- Leaflet zoom is positioned explicitly (for example bottom-right) so default top-left controls do not cover the Top Regions rankings panel.
- Dataset search can include manifest `searchHints` for nuuuwan sub-series; nuuuwan grouping normalizes empty or `()` categories for display and grouping.
- The Plots tab uses store-driven `plotYearRange`, `plotSeriesSelection`, and scale mode; catalog sync is available from the sidebar near last-sync text.
- Province choropleth uses `public/data/sri-lanka-provinces.geojson`, built from districts via `scripts/build-province-geojson.mjs` (`npm run build-provinces`); expanded province rows carry `originalName` for province keys during playback and coloring.
- On provincial datasets, province polygon tooltips show province-level values only; district names appear on centroid tooltips when centroids are enabled. Rankings dedupe to one row per province when `currentDatasetLevel === 'province'`.
- Leaflet needs `invalidateSize()` when the shell resizes (sidebar open/close); combining a ResizeObserver on the map wrapper with staggered invalidates after toggle avoids blank untiled strips.
- `formatMetricValue` takes `compact` for map tooltips and `comfortable` for sidebar/charts; units that already imply magnitude (e.g. Mn., Bn.) must not get an extra K/M suffix on the number; grouping uses `en-US` for consistent display.
- Sidebar map stats order: highest-value region card first, then max/average, then the aggregate total with a level-based caption (`Total, all districts` / `Total, all provinces` / `Total, national`).
