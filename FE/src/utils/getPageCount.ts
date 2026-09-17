/**
 * Pure helper: number of pages needed for `total` items at `pageSize` per page.
 * Utilities are side-effect-free and 100% unit-testable.
 */
export function getPageCount(total: number, pageSize: number): number {
  if (pageSize <= 0) return 0;
  return Math.max(1, Math.ceil(total / pageSize));
}
