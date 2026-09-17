import {
  createParamDecorator,
  ExecutionContext,
  HttpStatus,
} from '@nestjs/common';
import { SerializeHttpError } from 'src/utils/serializer';
import { GENERAL_ERRORS } from 'src/constants/api-response/general.response';

/**
 * Reads authorized tenant context.
 *
 * `request.organizationId` is written in exactly one place —
 * `OrganizationAccessGuard`, after it has confirmed the caller belongs to the
 * organization they named. Absence therefore means the guard did not run, and
 * the honest answer is a refusal: returning `undefined` would hand a
 * tenant-scoped query an empty filter, which is how "scoped to my org"
 * quietly becomes "scoped to everything".
 */
export const GetOrganizationId = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ organizationId?: string }>();
    const organizationId = request.organizationId;

    if (!organizationId) {
      return SerializeHttpError(
        null,
        HttpStatus.FORBIDDEN,
        GENERAL_ERRORS.FORBIDDEN,
      );
    }

    return organizationId;
  },
);
