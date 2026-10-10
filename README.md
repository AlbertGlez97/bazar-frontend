# La Marchanta frontend

Vue 3 + TypeScript + Vite PWA for the La Marchanta bazar: sales, debts, product management and the Finanzas module, with offline-first queues where the design requires them.

## Commands

- `npm run dev`: development server.
- `npx vitest run`: unit tests.
- `npm run lint`, `npx vue-tsc -b`, `npm run build`: lint, typecheck and production build.

## Documentation

- `doc/finance-architecture.md`: Finanzas phases, routes, stores, offline behavior, IndexedDB, PDF and limitations (start here).
- `doc/finance-*.md`: per-feature contracts (contributions, expenses, work shifts, distribution agreements and their closing evidence).
- `doc/api-contract-for-frontend.md`: copy of the backend contract used by the app.
- `odd/tasks/`: task trackers and verification evidence per feature (historical record).
