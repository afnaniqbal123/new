import { SetMetadata } from '@nestjs/common';

export const TENANT_SCOPED_KEY = 'tenantScoped';

/**
 * Marks a route as operating inside one organization.
 *
 * `OrganizationAccessGuard` ignores every route without this marker, which is
 * what lets it sit at controller level *before* `PermissionsGuard` while still
 * only demanding an organization on the routes that need one.
 *
 * That ordering is the whole point. Nest runs controller-level guards before
 * route-level ones, so a tenant guard applied per route runs *after* the
 * permissions guard — and the ability gets built with no tenant context at
 * all. Declaring both at the same level, in order, is the only way to make
 * `context.organizationId` mean anything to a policy.
 */
export const TenantScoped = () => SetMetadata(TENANT_SCOPED_KEY, true);
