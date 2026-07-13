---
target: Lanka Mapper map UX, top command bar, and inspector sidebar
total_score: 23
p0_count: 0
p1_count: 2
timestamp: 2026-07-13T08-55-05Z
slug: src-app-homepage-tsx
---
Method: dual-agent (A: d1f30d8b-2788-49f2-b40f-f0a9bba7b403 · B: dbd4eae5-ce6b-4c30-b85a-ed0eacd42e44)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---:|---|
| 1 | Visibility of System Status | 3 | Loading, sync, selection, and playback are visible; sync appears in too many places. |
| 2 | Match System / Real World | 3 | Map, year, source, and region language work; acronyms and “sets” are insider language. |
| 3 | User Control and Freedom | 2 | Recenter exists, but does not restore the usable padded map frame. |
| 4 | Consistency and Standards | 2 | Strong tokens; duplicated sync and independent floating controls weaken interaction consistency. |
| 5 | Error Prevention | 2 | Layout collisions and numeric wrapping are not prevented. |
| 6 | Recognition Rather Than Recall | 3 | Labels help; global versus compatible dataset selection relies on explanatory copy. |
| 7 | Flexibility and Efficiency | 3 | Fuzzy search, tabs, and playback controls help; keyboard command access is absent. |
| 8 | Aesthetic and Minimalist Design | 2 | Good visual language, but too many equal-weight modules compete with the map. |
| 9 | Error Recovery | 2 | Empty-map guidance exists; geometry/loading failures need clearer recovery. |
| 10 | Help and Documentation | 1 | No lightweight onboarding, keyboard hints, or layer/source explanation. |
| **Total** | | **23/40** | **Capable but structurally overloaded** |

## Anti-Patterns Verdict

**LLM assessment:** Not outright AI slop. The terminal/data-desk token system, numeric typography, vector-first map, and restrained shadows are authored. The weak point is composition: the command bar and inspector read as accumulated component inventory instead of a clear hierarchy. The top bar should establish what is being analysed; the inspector should answer what can be changed or verified.

**Deterministic scan:** Both the full Impeccable detector and layout-scoped detector returned zero findings. The manual utility scan found two arbitrary spacing values and nine numeric z-index roles, showing that the main problem sits above static anti-pattern detection: there is no semantic overlay geometry or layer system.

**Browser evidence:** Desktop and mobile inspection covered 320×640, 390×844, 627×676, 768×900, 1024×768, and 1440×960. The mobile recenter button fully overlapped the collapsed rail Random action at 390px and 627px (1,296px²). Current tests only protect the timeline from the rail, so this collision shipped undetected.

## Overall Impression

The map is a calm, credible public-data workbench, but its surrounding chrome asks users to decode catalog management, dataset context, global preferences, and map controls simultaneously. The largest opportunity is a single spatial and informational hierarchy: one safe viewport for the map, one canonical catalog action, and distinct roles for context, navigation, discovery, inspection, and appearance.

## What’s Working

- Centralized surface, ink, border, accent, radius, and tabular-number tokens establish a coherent data-desk language.
- Sri Lanka remains visually dominant; the blue vector field and restrained data encoding suit the analytical task.
- Accessibility foundations are sound: skip link, focus styles, reduced motion, labelled actions, mobile dialog focus trapping, Escape dismissal, and Leaflet resize invalidation.

## Priority Issues

### P1 — No shared map-safe-area model

Rankings, selection, legend, CEB panel, recenter, zoom, tooltip, and timeline position independently. Initial fitting reserves only fixed bottom padding, while reset uses raw `setView()`.

**Why it matters:** Controls overlap or cover data, and Reset does not restore the actual usable view.

**Fix:** Introduce a measured `MapSafeViewport` contract with semantic top/right/bottom/left insets and an optional focal offset. Use the same padded frame routine for mount, explicit reset, layout-mode changes, and responsive transitions while respecting user pan/zoom.

**Suggested command:** `$impeccable layout`

### P1 — Header and inspector duplicate authority

The command surface combines brand, title, source, leader, catalog count, sync, theme, tabs, and search; sync and catalog state repeat in the inspector.

**Why it matters:** The UI feels assembled rather than authored, and users cannot tell which location is canonical.

**Fix:** Top bar owns analysis context, tabs, global discovery, and one catalog-health action. Inspector owns compatible dataset switching, current snapshot, lineage, and view controls. Appearance becomes a global control rather than data-inspector content.

**Suggested command:** `$impeccable layout`

### P2 — Mobile is a modalized desktop sidebar

The near-full-screen inspector hides the map during routine selection, while its collapsed rail depends on a fixed header-height guess.

**Why it matters:** Spatial context is lost and controls can drift or collide when the header wraps.

**Fix:** Use a map-preserving mobile sheet with a concise dataset/view section and progressive full details. Measure command-surface height or use natural layout placement.

**Suggested command:** `$impeccable adapt`

### P2 — Analytical values can wrap incorrectly

The sidebar uses `break-all` for aggregates and three-column statistics; the screenshot shows `26,815.3333` split over two lines.

**Why it matters:** Broken numbers damage trust in a data product.

**Fix:** Prevent numeric wrapping and use appropriate formatting, responsive column fallback, or horizontal accommodation.

**Suggested command:** `$impeccable polish`

### P3 — Touch targets and state semantics are undersized

Primary controls measure 26–40px and theme/ramp swatches rely on colour/title rather than explicit selected state.

**Why it matters:** Touch use is error-prone and selected appearance is not robust for assistive technology.

**Fix:** Provide 44×44 coarse-pointer hit areas; add accessible names and radio/pressed selection semantics.

**Suggested command:** `$impeccable adapt`

## Persona Red Flags

**Alex (power analyst):** Global search and playback are efficient, but there is no keyboard route to search/reset; top search versus compatible dataset selection must be inferred; Reset does not restore the expected analysis frame.

**Sam (accessibility-dependent analyst):** Source abbreviations and repeated micro-labels add cognitive noise; compact controls fall below preferred touch size; colour controls need programmatic selected state; value wrapping damages scanability.

**Casey (distracted mobile user):** Opening the inspector removes map context; recenter completely covers Random dataset on common narrow widths; the fixed rail offset can diverge from the wrapped header; several controls are too small for one-handed use.

## Minor Observations

- Light mode’s warm-paper neutrals soften the sharper terminal identity.
- Repeated uppercase micro-labels flatten hierarchy even though each label is locally coherent.
- Arbitrary z-index values should become named roles: map control, map overlay, backdrop, inspector, popover, tooltip.
- Existing responsive tests need explicit 320, 768, 1024, and desktop coverage.

## Questions to Consider

- Can the inspector become a quick analytical control surface first and a provenance document only on demand?
- Should “Reset map” mean geographic reset, layout-safe reset, or a full analysis reset? The UI should name the chosen scope.
- Which single catalog health signal genuinely needs to remain visible during map analysis?
