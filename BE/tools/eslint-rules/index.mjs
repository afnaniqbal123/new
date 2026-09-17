/**
 * Local ESLint plugin — `nestjs`.
 *
 * Encodes the conventions documented in `.claude/skills/best-practices/` as
 * lint rules so they are enforced automatically instead of caught in review.
 * Because they are ESLint rules (not a bespoke script) they also surface live
 * in the editor while you type, not only when you try to commit.
 */
import {
  noHardcodedMessage,
  noRawHttpException,
  returnSerializeHttpError,
} from './rules/responses.mjs';
import {
  dtoClassSuffix,
  requireApiProperty,
  requireDtoValidation,
} from './rules/dto.mjs';
import {
  noDbInController,
  noRawRequestDecorator,
  requireApiBearerAuth,
  requireApiTags,
} from './rules/controller.mjs';
import {
  requireSchemaExports,
  requireSchemaTimestamps,
} from './rules/schema.mjs';
import { noCrossModuleRelativeImport, noProcessEnv } from './rules/config.mjs';
import { noBarrelFile, noFocusedTests } from './rules/hygiene.mjs';
import {
  noDbInAccessAuth,
  noDirectJwtSign,
  noDirectJwtVerify,
  noLegacyAuthGuard,
  noManualBearerParsing,
  noParallelAuthorization,
  noRawOrganizationHeader,
  oneAccessStrategy,
} from './rules/auth.mjs';

export const rules = {
  // Responses
  'no-raw-http-exception': noRawHttpException,
  'no-hardcoded-message': noHardcodedMessage,
  'return-serialize-http-error': returnSerializeHttpError,
  // DTOs
  'require-api-property': requireApiProperty,
  'require-dto-validation': requireDtoValidation,
  'dto-class-suffix': dtoClassSuffix,
  // Controllers
  'require-api-tags': requireApiTags,
  'require-api-bearer-auth': requireApiBearerAuth,
  'no-db-in-controller': noDbInController,
  'no-raw-request-decorator': noRawRequestDecorator,
  // Schemas
  'require-schema-timestamps': requireSchemaTimestamps,
  'require-schema-exports': requireSchemaExports,
  // Config & imports
  'no-process-env': noProcessEnv,
  'no-cross-module-relative-import': noCrossModuleRelativeImport,
  // Hygiene
  'no-barrel-file': noBarrelFile,
  'no-focused-tests': noFocusedTests,
  // Auth architecture — see docs/architecture/security/authentication.md
  'no-direct-jwt-verify': noDirectJwtVerify,
  'no-direct-jwt-sign': noDirectJwtSign,
  'no-db-in-access-auth': noDbInAccessAuth,
  'no-legacy-auth-guard': noLegacyAuthGuard,
  'no-raw-organization-header': noRawOrganizationHeader,
  'no-manual-bearer-parsing': noManualBearerParsing,
  'no-parallel-authorization': noParallelAuthorization,
  'one-access-strategy': oneAccessStrategy,
};

export default { rules };
