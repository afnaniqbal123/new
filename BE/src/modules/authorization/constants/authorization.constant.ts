/**
 * What a caller can attempt. Deliberately small: five verbs cover CRUD, and a
 * vocabulary that grows per feature stops being a vocabulary.
 *
 * `Manage` is CASL's wildcard — it matches every other action. Granting it is
 * granting everything on that subject, so it belongs to genuinely
 * unrestricted roles and nowhere else.
 */
export enum Action {
  Manage = 'manage',
  Create = 'create',
  Read = 'read',
  Update = 'update',
  Delete = 'delete',
  /**
   * Listing a collection, as distinct from reading one record.
   *
   * They separate because callers who may browse a directory often may not
   * open an arbitrary entry in it — which is exactly the split this codebase
   * already had between `GET /users/all` and `GET /users/:id`.
   */
  List = 'list',
}

/** Metadata key for `@RequirePermissions()`. */
export const REQUIRED_PERMISSIONS_KEY = 'requiredPermissions';
