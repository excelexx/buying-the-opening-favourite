# Opening Favourite

An animated, presenter-controlled explanation of the opening-favourite election-market strategy, with a dated 3D order replay.

## Run & Operate

- Start the managed `artifacts/opening-favourite: web` workflow for the presentation.
- `pnpm --filter @workspace/opening-favourite run typecheck` — check the presentation.
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- The presentation is frontend-only. No database, authentication or live market connection is required.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/opening-favourite/src/deck.ts` — presentation narrative and saved reported figures.
- `artifacts/opening-favourite/src/lib/simulation.ts` — deterministic synthetic replay and compressed date milestones.
- `artifacts/opening-favourite/src/components/Scene.tsx` — continuous 3D exhibition.
- `artifacts/opening-favourite/public/source/strategy.pdf` — original source deck.

## Architecture decisions

- The playable experience is a web app rather than a linear video, because the audience must be able to inspect attempts, pause and scrub orders.
- Saved strategy results and synthetic teaching replay are separate; replay activity must never be labelled as historical fills.
- The replay's calendar dates compress a fictional election period; order expiry still uses a separate 30-second order age.

## Product

- Navigate chapters with arrows or Space, autoplay the presentation, enter fullscreen, and inspect source materials.
- Compare normal and stressed execution, replay order attempts and settlements, and scrub through dated events.

## User preferences

- Use the uploaded 3D presentation as a visual reference.
- Make the timeline more complex, with more dates and explicit explanations of attempts, fills and unfilled orders, including a “trying” animation.
- Keep the original presentation's slides, order and text unchanged. Add explanations only in the timeline.
- Show exactly three timeline markets with different starts and endings, and play from the initial state through every final settlement.
- Keep slide text separate from the 3D graphics so they never overlap. Keep the timeline large, with opening bids, animated order attempts, short popups and just one small slider.
- Animate the popup text box itself with a quick standard rejection “bzzzt”: a sharp side-to-side shake and red flash/outline, not an expanding bulge. Do not use a sphere or a separate 3D attempt effect.
- Show a separate short reason above an order popup only while it buzzes. Spread illustrative trades across the buying windows rather than clustering them at the start.
- Omit the timeline slide's heading and moving red date label; enlarge the timeline and its blocks to use more of the screen.

## Gotchas

- The source GitHub repository may require access; do not call it publicly available.
- Synthetic demonstration fees use an illustrative rounded taker curve, not the source replay's dated historical schedule.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
