import { Global, Module } from '@nestjs/common';
import { AbilityFactory } from 'src/modules/authorization/ability.factory';
import { AuthorizationService } from 'src/modules/authorization/authorization.service';
import { PermissionsGuard } from 'src/modules/authorization/guards/permissions.guard';
import { PolicyRegistry } from 'src/modules/authorization/policy.registry';

/**
 * The authorization mechanism: ability construction, the route guard, and
 * resource-level assertions.
 *
 * It owns *how* permissions are asked, never *what* they are. Rules live in
 * the module that owns the data — see `src/modules/user/policies/`.
 *
 * `@Global` because `PermissionsGuard` is applied by controllers throughout
 * the application, and a guard has to be resolvable in every module that uses
 * it. The alternative is importing this module in each of them, which is
 * ceremony with no boundary value: nothing here holds state, and nothing here
 * imports a domain module.
 */
@Global()
@Module({
  providers: [
    PolicyRegistry,
    AbilityFactory,
    AuthorizationService,
    PermissionsGuard,
  ],
  exports: [
    PolicyRegistry,
    AbilityFactory,
    AuthorizationService,
    PermissionsGuard,
  ],
})
export class AuthorizationModule {}
