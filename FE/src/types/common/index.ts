/**
 * Shared, domain-agnostic TypeScript contracts used across multiple concerns.
 * Types (unlike components) MAY be barrel-exported from this file.
 */

/** Success envelope every `/auth/*` (and other module) response wraps its payload in. */
export interface ApiResponse<TData> {
  data: TData;
  status: number;
  message: string;
}

/** Generic cursor/offset pagination metadata. */
export interface Paginated<TItem> {
  items: TItem[];
  page: number;
  pageSize: number;
  total: number;
}
