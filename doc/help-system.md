# Help system (Contextual Help 2.0)

La Marchanta's in-app help is a Help Center with real navigation (category, topic, article), a route-aware `?` that opens a quick-help drawer, a ranked local search, level navigation on phones, discreet motion and keyboard/screen-reader support. All user-facing copy is Spanish. There is no backend and no store: the URL and one module-level flag hold all state.

## Content model

```
HelpCategory  ->  HelpTopic  ->  HelpArticle
Finanzas          Jornadas       "Registrar una jornada de trabajo"
```

- Articles live in `src/config/help-content.ts` (`HELP_ARTICLES`). Each declares its `topic` id, an optional `slug` (so `finanzas.jornadas.corregir` can preselect it), `audience` (`all` or `socio`), keywords, intro, ordered steps, tips and optional Q&A.
- Categories and topics are named and ordered in `src/config/help-structure.ts`. `articleIds` and the topic `audience` are derived from the articles, so structure and content cannot drift apart.
- Types are in `src/types/help.types.ts`. Today: 8 categories, 24 topics, 41 articles.
- Ids: a category is `ventas`; a topic is `<category>.<slug>` (`finanzas.jornadas`) or, for a category with a single topic, the bare category id (`deudas`). The category `offline` is titled "Sin conexión".
- `resolveHelpTarget(idOrPath)` accepts a category, topic or article id or a `topic.slug` path and returns `{ categoryId, topicId?, articleId? }`, or `null`. An unknown article slug degrades to its topic.

## Route context map

`src/config/help-route-context.ts` is the one place that says which help the `?` opens on each route:

| Route name | Help id |
| --- | --- |
| `AppHome` | `primeros-pasos` |
| `Sale` | `ventas` (category: the drawer lists its articles) |
| `ProductCatalog`, `CodigosQr` | `productos`, `productos.etiquetas-qr` |
| `Deudas` | `deudas` |
| `Reports`, `Incidencias` | `administracion.reportes`, `administracion.incidencias` |
| `Contributions`, `FinanceOverview`, `Expenses`, `WorkShifts`, `FinanceReserves`, `FinanceSimulator` | the matching `finanzas.*` topic |
| `FinanceAgreements`, `FinanceAgreementDetail` | `finanzas.acuerdos` (Pagos is a related topic) |
| `Settings`, `ChangePassword`, `Team`, `DevicesAdmin` | `dispositivos-sesion[.contrasena/.equipo/.dispositivos]` |
| `Help` | `null` (no drawer) |

An unknown route falls back to Primeros pasos, so the drawer is never empty.

## URL contract

`/app/ayuda?topic=<category|topic|article id>&article=<article id>&from=<path>&q=<text>`

- `topic` selects the level: none = home, a category = its topics, a topic = its articles. An unknown value degrades to the home.
- `article` expands that article inside its topic (the first article is expanded otherwise). A topic with one article shows it without an accordion.
- `from` is the screen to return to. `safeHelpReturnTarget` resolves it only to known operational routes and respects role and mode restrictions; anything else falls back to the mode landing.
- `q` is the search text (trimmed, at most 100 characters). While it is set, the results replace the panel. Opening a result drops `q`.
- `parseHelpQuery` and `helpLocation` (both in `src/composables/useHelp.ts`) read and build these locations. Selection uses `router.push`; typing in the search uses `router.replace`. Refresh, deep links and back/forward therefore work without a store.

### Legacy hash links

The first help page used `/app/ayuda#<articleId>`. Those links keep working: when the Help route has a hash and no `topic` query, `HelpCenter` resolves the hash (article id, topic id or category id, via `resolveHelpTarget`) and `router.replace`s to `?topic=<topic>&article=<id>`, keeping a safe `from`. The new location has no hash, so there is no redirect loop. An existing `topic` wins over the hash, and an unknown or malformed hash degrades to the home view without redirecting.

## Help Center

`src/views/help/HelpView.vue` is a thin route component (title plus the "Volver" button, `data-action="return"`). The Center is `src/components/help/HelpCenter.vue`:

- Two columns from 900 px: a sticky `HelpSidebar` (`<nav aria-label="Temas de ayuda">`, the selected category is expanded, `aria-current="page"` on the active topic or category) and the content on the right.
- The content is exactly one of `HelpHome`, `HelpCategoryOverview`, `HelpTopicPanel` or `HelpSearchResults`, swapped with a `<Transition mode="out-in">`. Only the selected topic's articles exist in the DOM.
- `HelpTopicPanel`: title, description, `HelpArticleList` (accordion or a single open article) and related topics. `HelpBreadcrumb` (`<nav aria-label="Ruta de ayuda"><ol>`, `aria-current` on the last item) sits above it.
- `HelpLink` renders real `<a href>` links. It does not use the stock `RouterLink` rendering because that marks every link to the same route as `aria-current="page"`, and the Center is a single route.
- After a navigation, focus moves to the new content heading (`tabindex="-1"`, `preventScroll`); when an article is requested, to its accordion trigger. Typing in the search never steals focus.

## Search

`searchHelpIndex` (`src/utils/help-search.ts`) is a local, accent- and case-insensitive AND matcher that indexes category, topic and article text and ranks title hits first. `HelpSearch` has a labelled `type="search"` input, a "Limpiar búsqueda" button and a `role="status"` live region ("N resultados"). `HelpSearchResults` lists real links "Title, Category › Topic". The empty state says "No encontramos resultados para «…»", offers suggested topics (`suggestHelpTopics`) and a clear button.

## Quick-help drawer

- The `?` in `AppLayout.vue` is a `<button type="button" aria-label="Ayuda" aria-haspopup="dialog" aria-expanded>`. It calls `openHelpDrawer()`, which resolves the target from the current route. `useHelp()` is called once in the layout to bind the route.
- On the Help page itself the button is not rendered (the drawer would duplicate the page) and `openHelpDrawer()` returns `false`.
- `HelpDrawer.vue` (mounted once in the layout) wraps `AppDrawer`: heading "? <topic>", the description, the articles as accordions (first one expanded, or the requested article), related topics and the footer link "Ver toda la ayuda", which closes the drawer and opens the Center on the same topic and article with `from` set to the current screen. A route with only a category (Ventas) shows the articles of all its topics. Any navigation closes the drawer.
- `AppDrawer` (`src/components/ui/organisms/AppDrawer.vue`): teleported to `body`, `role="dialog"`, `aria-modal`, `aria-labelledby`, backdrop click and Escape close, Tab/Shift+Tab trap, initial focus inside, focus returns to the opener (or to the `returnFocus` element, for browsers that do not focus buttons on click), the body scroll is locked and restored. Full-screen sheet below 768 px. The focus trap mirrors `AppModal`'s but is not shared, to leave `AppModal` untouched.
- Future inline help: `openHelpDrawer('finanzas.jornadas.corregir')` opens the drawer on Jornadas with that article expanded.

## `openHelp`

`useHelp().openHelp(idOrPath?)` navigates to the Center (not the drawer) with the same resolution rules; without an argument it uses the current route's topic and passes `from` along. `openHelpDrawer`, `closeHelpDrawer`, `helpDrawerOpen` and `drawerTarget` are the drawer API.

## Phones (< 900 px)

No side-by-side layout and no sidebar. The level is in the URL: home (category list with chevrons), category (its topics), topic (its content). A back control labelled with the parent ("← Finanzas", `aria-label="Volver a Finanzas"`, `data-action="level-back"`) plus the breadcrumb let the reader go up. Long titles wrap (`min-width: 0`, `overflow-wrap: anywhere`).

## Motion and reduced motion

Tokens in `src/assets/main.css`: `--motion-fast` 150 ms, `--motion-base` 180 ms, `--motion-slow` 220 ms, `--motion-ease`, `--motion-shift` 8 px.

- Drawer: slide from the right plus fade (`--motion-slow`).
- Topic change: fade plus 8 px translate (`--motion-fast`).
- Accordion: `grid-template-rows: 0fr -> 1fr` plus opacity (`--motion-base`); heights are never animated. Closed panels are `inert` and `visibility: hidden`.
- Sidebar and link states: color/background transitions.
- `@media (prefers-reduced-motion: reduce)`: the tokens become ~0 and the shift 0, `main.css` zeroes transitions and animations inside the help components, and each component also switches its transitions and transforms off. `usePrefersReducedMotion()` (`src/composables/usePrefersReducedMotion.ts`) exposes the preference and a `scrollBehavior` (`'auto'` or `'smooth'`) for the few places where JavaScript chooses.

## Accessibility

Named landmarks (`Temas de ayuda`, `Ruta de ayuda`); `aria-current` on the active sidebar item and the last crumb only; accordion triggers are real buttons inside headings with `aria-expanded`/`aria-controls`, and panels are `role="region"` labelled by their trigger (Arrow keys, Home and End move between triggers; Enter and Space are native); the drawer traps focus and returns it; the search input has a visible label and a polite live region; the global `:focus-visible` ring is kept; all controls are native links or buttons with at least 44 px targets.

## Audience

All articles are visible to every role. Articles for socios carry the "Solo socios" badge (inside the accordion trigger, or beside the title of a single article); their actions require a socio. Nothing is filtered by role.

## How to add things

- New article: add it to `HELP_ARTICLES` with an existing `topic`, add its `HELP_EVIDENCE` entry (real files), and write the copy in Spanish. Search, the Center and the drawer pick it up.
- New topic: add it to the right category in `help-structure.ts` and give at least one article that references it (no empty topics). Use `related` to link topics.
- New category: add it to `DEFINITIONS` and, optionally, an icon in `src/components/help/help-icons.ts`.
- New route mapping: add the route name to `HELP_ROUTE_CONTEXT` (and its title to `routeTitles` in `AppLayout.vue`, and the route to `HELP_RETURN_ROUTES` if "Volver" may return to it).
- Inline help: call `useHelp().openHelpDrawer('<topic>.<article slug>')` from a screen.

## Tests

`src/components/help/__tests__` (Center, search, phone levels, audience, motion contract), `src/layouts/__tests__/AppLayout.help.test.ts` (button and drawer per route), `AppAccordion` and `AppDrawer` unit tests, `usePrefersReducedMotion.test.ts`, plus the data-layer tests from the first phase. jsdom cannot measure layout or play transitions, so responsive behavior, animation and real keyboard flow are validated in a browser.
