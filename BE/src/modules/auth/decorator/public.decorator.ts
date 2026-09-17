import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Opts a route out of authentication.
 *
 * `JwtAccessGuard` is registered globally (see `AuthModule`), so every route
 * is authenticated unless it carries this marker. That inversion is
 * deliberate: forgetting a decorator now fails closed (a public endpoint
 * returns 401 and someone notices) instead of failing open (a protected
 * endpoint silently accepts anonymous callers).
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
