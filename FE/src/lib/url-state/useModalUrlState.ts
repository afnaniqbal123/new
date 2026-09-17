import { parseAsString, parseAsStringEnum, useQueryStates } from 'nuqs';
import { UrlStateKey } from './keys';

/**
 * D1 from docs/adr/url-page-state.md: a small dialog's open/context state as a
 * query param — `?modal=edit&id=42` — rather than a child route (D2, reserved for
 * a dialog large/complex enough to deserve its own URL segment). `name` is one of
 * the caller's own modal names (e.g. `'edit'`); `id` is deliberately a plain string
 * param, not part of the shared `UrlStateKey` registry, since it's feature-specific
 * (an ExampleWidget row id today, something else on another page) rather than a
 * key that repeats across every page's URL state.
 */
export function useModalUrlState<TName extends string>(names: readonly TName[]) {
  const [state, setState] = useQueryStates({
    [UrlStateKey.MODAL]: parseAsStringEnum<TName>([...names]),
    id: parseAsString,
  });

  return {
    modal: state[UrlStateKey.MODAL],
    id: state.id,
    open: (name: TName, id: string) => {
      void setState({ [UrlStateKey.MODAL]: name, id });
    },
    close: () => {
      void setState({ [UrlStateKey.MODAL]: null, id: null });
    },
  };
}
