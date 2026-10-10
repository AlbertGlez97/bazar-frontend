# Contextual Help 2.0

## Objective
Replace the single long help page (index plus anchors plus scroll) with a contextual Help Center: category -> topic -> article navigation that REPLACES the visible content, a route-aware `?` that opens a quick-help drawer, a search that navigates to the right topic/article, mobile level navigation, discreet motion that respects `prefers-reduced-motion`, and accessible behavior. Frontend only. Existing article content and meaning are preserved.

## Scope
- Branch `feat/contextual-help-v2` from main f56e859. Frontend only. No backend, no deploy, no Cloudflare.

## Audit summary (explorer, read-only)
- One view `src/views/help/HelpView.vue` (229 lines) at `/app/ayuda`; scroll/anchor navigation; `?from=` back link with a route whitelist that omits all Finanzas routes; `routeTitles` in AppLayout omits 5 finance routes.
- `?` is a RouterLink in `AppLayout.vue` (aria-label Ayuda, Lucide CircleHelp) with only `?from=<fullPath>`.
- `src/config/help-content.ts`: 40 articles (11 audience all, 29 socio), category free string, `HELP_EVIDENCE` map required by tests; `help-search.ts` is an unranked AND-substring matcher over accent-normalized text.
- No accordion, drawer, breadcrumb components; AppModal has focus trap/return only with `manage-focus`; no `prefers-reduced-motion` anywhere; tokens in `src/assets/main.css`.
- Tests that must be migrated: `HelpView` tests (two read the .vue source via regex), `help-content.test.ts` (exact copy strings, evidence files), `AppLayout.help.test.ts` (expects a link with `from=`), `router.help.test.ts`.

## Design decisions
1. Content model: `HelpCategory` -> `HelpTopic` -> `HelpArticle`. Article ids and copy are preserved; each article gets a `topic` id; categories/topics live in `src/config/help-structure.ts`. No empty sections. Aportaciones gets a short article grounded in `doc/finance-contributions.md` (new `HELP_EVIDENCE` entry with real files).
2. Selection state lives in the router query: `/app/ayuda?topic=finanzas.jornadas&article=jornadas&from=...` (query chosen over nested paths because `from` and the back whitelist already use query, and it gives refresh and deep links). No Pinia.
3. One central map `HELP_ROUTE_CONTEXT` (route name -> topic id) and a composable `useHelp()` with `openHelp(topicOrArticleId)`; architecture ready for `openHelp('finanzas.jornadas.corregir')`.
4. `?` becomes a button that opens a right drawer (full-screen sheet on phones) with the topic of the current route; its CTA "Ver toda la ayuda" navigates to the Center with the same topic.
5. Desktop Center: sticky sidebar tree plus topic panel (accordion of articles); mobile: category -> topic -> content levels with a back control, all encoded in the URL.
6. Search: keeps the local normalized AND matcher, indexes category/topic titles too, ranks title hits first, results show "Category > Topic", click navigates to topic and opens the article; empty state with suggestions.
7. Motion: drawer slide+fade ~220 ms, topic change fade/translate ~150 ms, accordion via grid-rows transition, all disabled under `prefers-reduced-motion: reduce`.
8. Audience: current behavior preserved (all articles visible, "Solo socios" badge); not weakened.
9. Back navigation whitelist extended to the finance routes; missing `routeTitles` filled in.

## Tasks
- [x] CH1 Content structure (categories/topics/articles), HELP_ROUTE_CONTEXT, search upgrade, useHelp composable, router/back-whitelist/routeTitles fixes, data-layer tests
- [x] CH2 AppAccordion, AppDrawer, HelpCenter (desktop sidebar, mobile levels, breadcrumb), search results UI, `?` button and drawer integration in AppLayout, motion and reduced-motion, a11y, UI tests
- [ ] CH3 Real browser validation (context per route, drawer, Center, search, refresh, responsive 320/390/768/1280, animations, reduced motion, keyboard)
- [ ] CH4 Docs (`doc/help-system.md`, README/finance docs), full suites, merge to main, push

## Route
Delegated direct: two sequential writers (CH1 data layer, CH2 UI); parent runs real browser validation and final verification.

## Progress / evidence
CH1 (data layer) done by writer 1, route: delegated direct.
- Commits: b719f61 content structure + aportaciones article; 4376801 finance route titles; a9085b2 safe return util; f8d2a27 ranked search; d90b4c6 lint cleanup; 9a4c98b route context + useHelp.
- Structure: 8 categories, 24 topics, 41 articles (40 original ids and copy untouched, plus `aportaciones`). Category id `offline` (title Sin conexión) avoids clashing with the `sin-conexion` article id.
- Test-first: route-context, help-return, search index and useHelp tests were written and failed (module or export missing) before their implementation; help-structure and content tests were written after the content edit.
- Migrated assertion: AppLayout.work-shifts titles Jornadas as "Jornadas" (was "Finanzas"), as the plan requires.
- Verification: npx vitest run 236 files / 4385 tests passed; npm run lint clean; npx vue-tsc -b clean; npm run build ok; git diff --check clean.
- Router: Help route and scrollBehavior unchanged (query-only selection needs no change; a topic/article change scrolls to top).

CH2 (UI) done by writer 2, route: delegated direct.
- Commits: c33ccc3 accordion, drawer, motion tokens and composables; f94948e Help Center redesign; 0e30e5b contextual help drawer and AppLayout `?` button; 94d41b0 motion contract test; docs(help) commit for doc/help-system.md.
- Components: AppAccordion, AppDrawer (ui); HelpCenter, HelpSidebar, HelpBreadcrumb, HelpHome, HelpCategoryOverview, HelpTopicPanel, HelpArticleList, HelpArticleContent, HelpSearch, HelpSearchResults, HelpLinkList, HelpLink, HelpDrawer (help); useMediaQuery, usePrefersReducedMotion (composables).
- Decisions: two columns from 900 px; `?` is a button and is not rendered on the Help route; accordion state is local (the URL carries topic/article/q/from); the stock RouterLink was replaced by HelpLink because it marks every link to the single Help route as aria-current=page; AppModal untouched (focus trap duplicated in AppDrawer on purpose).
- Test-first: AppAccordion and AppDrawer tests failed (component missing) before the components; the Center, layout and motion tests were written after the implementation (no RED claimed); the composable test was written after its implementation.
- Verification: npx vitest run 241 files / 4528 tests passed; npm run lint clean; npx vue-tsc -b clean; npm run build ok; git diff --check clean.
- Covered only by jsdom (CH3 must validate in real Chrome): responsive layout at 320/390/768/900/1280, drawer and accordion animation, reduced motion, real keyboard and focus order, sticky sidebar, safe scroll after navigation (router scrollBehavior still resets to top on every query change, including each search keystroke).
