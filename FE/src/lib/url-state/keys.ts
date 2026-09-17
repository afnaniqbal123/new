/**
 * Standard URL query-param keys for page-level view state (AGENTS.md § Data & State,
 * docs/adr/url-page-state.md). Closed set of named string values → real `enum`
 * (AGENTS.md § Constant Registries), same shape as `Role`/`QueryKey`. A page that
 * needs a filter these six don't cover (e.g. a status dropdown) adds its own plain
 * string key alongside these rather than forcing every possible filter into this
 * shared registry — this file only owns the keys that repeat across pages.
 */
export enum UrlStateKey {
  PAGE = 'page',
  LIMIT = 'limit',
  Q = 'q',
  SORT = 'sort',
  TAB = 'tab',
  MODAL = 'modal',
}
