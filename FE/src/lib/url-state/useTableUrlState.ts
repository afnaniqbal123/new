import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { UrlStateKey } from './keys';

interface TableUrlState {
  /** Search text. Defaults to `''` when the param is missing or unparseable. */
  query: string;
  /** 1-based page number. Defaults to `1` when the param is missing or unparseable
   *  (e.g. `?page=abc` or `?page=-5`) — AGENTS.md's "bad value in the URL must not
   *  break the page" rule. */
  page: number;
  /** Sets `q` and resets `page` back to `1` in a single history entry, same
   *  behavior as the old exampleWidgetStore's `setQuery`. */
  setQuery: (query: string) => void;
  setPage: (page: number) => void;
}

/**
 * Shared URL-addressable state for a paginated/searchable list page — the
 * reference hook every new list page copies (docs/adr/url-page-state.md). Backs
 * `ExampleWidget`; a page that also needs `sort`/`tab` composes its own
 * `useQueryStates` call with `UrlStateKey.SORT`/`UrlStateKey.TAB` the same way.
 */
export function useTableUrlState(): TableUrlState {
  const [state, setState] = useQueryStates({
    [UrlStateKey.Q]: parseAsString.withDefault(''),
    [UrlStateKey.PAGE]: parseAsInteger.withDefault(1),
  });

  return {
    query: state[UrlStateKey.Q],
    page: state[UrlStateKey.PAGE],
    setQuery: (query) => {
      void setState({ [UrlStateKey.Q]: query || null, [UrlStateKey.PAGE]: null });
    },
    setPage: (page) => {
      void setState({ [UrlStateKey.PAGE]: page > 1 ? page : null });
    },
  };
}
