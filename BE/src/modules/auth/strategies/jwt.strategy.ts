import { HttpStatus, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { SerializeHttpError } from 'src/utils/serializer';
import { AUTH_ERRORS } from 'src/modules/auth/constants/api-response/auth.response';
import { JWT_ACCESS_STRATEGY } from 'src/modules/auth/constants/auth.constant';
import { TokenService } from 'src/modules/auth/services/token.service';
import {
  AuthenticatedPrincipal,
  isAccessTokenClaims,
  toAuthenticatedPrincipal,
} from 'src/modules/auth/types/authenticated-principal.type';

/**
 * The single access-JWT verification path.
 *
 * passport-jwt handles the cryptographic half of the trust boundary from the
 * options below — signature, expiry, allowed algorithm, issuer, audience —
 * and `validate()` handles the semantic half: is this claim set actually an
 * access credential, and does it carry everything authorization will trust?
 *
 * Deliberately stateless. No user document is loaded here (ADR 0001): the
 * claims are the authority for the token's short lifetime, so a MongoDB
 * outage cannot invalidate an otherwise-valid token and normal traffic costs
 * the database nothing.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(
  Strategy,
  JWT_ACCESS_STRATEGY,
) {
  constructor(tokenService: TokenService) {
    const { secretOrKey, algorithms, issuer, audience } =
      tokenService.getVerifyOptions();

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey,
      algorithms,
      issuer,
      audience,
    });
  }

  /**
   * Runs only after the signature, expiry, algorithm, issuer and audience have
   * already passed. What is left is the part cryptography cannot answer: a
   * password-reset credential is signed with the same key and would clear
   * every check above, so the purpose and claim shape are validated here and
   * anything else is refused.
   */
  validate(payload: unknown): AuthenticatedPrincipal {
    if (!isAccessTokenClaims(payload)) {
      return SerializeHttpError(
        null,
        HttpStatus.UNAUTHORIZED,
        AUTH_ERRORS.UNAUTHORIZED,
      );
    }

    return toAuthenticatedPrincipal(payload);
  }
}
