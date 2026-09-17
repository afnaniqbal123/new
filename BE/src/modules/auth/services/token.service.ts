import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import {
  ACCESS_TOKEN_VALIDITY,
  CONFIG,
  JWT_ALGORITHM,
  JWT_AUDIENCE,
  JWT_ISSUER,
} from 'src/constants/config.constant';
import { TOKEN_TYPES } from 'src/modules/auth/constants/auth.constant';
import { AuthenticatedPrincipal } from 'src/modules/auth/types/authenticated-principal.type';

/**
 * The verification half of the trust boundary, named so it can be referred to
 * as one thing. `JwtStrategy` consumes exactly this and nothing else.
 */
export type AccessTokenVerifyOptions = {
  secretOrKey: string;
  algorithms: [typeof JWT_ALGORITHM];
  issuer: string;
  audience: string;
};

/**
 * The one place access JWTs are minted, and the one place the parameters they
 * are minted with are defined.
 *
 * Signing and verification have to agree on algorithm, issuer and audience or
 * every token is rejected — and worse, if they drift apart in the *lenient*
 * direction, tokens this service would never issue start being accepted. Both
 * sides therefore read from here: this service signs, and `JwtStrategy`
 * verifies using `getVerifyOptions()`. No other file calls `JwtService.sign`
 * or `JwtService.verify` (enforced by the `nestjs/no-direct-jwt-verify` and
 * `nestjs/no-direct-jwt-sign` lint rules).
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Mint an access token carrying everything the request path needs to
   * authenticate *and* authorize the caller without touching MongoDB.
   *
   * Only claims the authorization boundary actually consumes go in. The
   * payload is signed, not encrypted — anyone holding the token can read it —
   * so nothing sensitive belongs here.
   */
  signAccessToken(principal: AuthenticatedPrincipal): string {
    const payload = {
      sub: principal.id,
      email: principal.email,
      role: principal.role,
      type: TOKEN_TYPES.SIGNIN_TOKEN,
      ...(principal.sessionId ? { sid: principal.sessionId } : {}),
    };

    return this.jwtService.sign(payload, this.getSignOptions());
  }

  private getSignOptions(): JwtSignOptions {
    return {
      secret: this.getSecret(),
      algorithm: JWT_ALGORITHM,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      expiresIn: ACCESS_TOKEN_VALIDITY,
    };
  }

  /**
   * Verification parameters for `JwtStrategy`. Kept here so they cannot drift
   * from what `signAccessToken` produces.
   */
  getVerifyOptions(): AccessTokenVerifyOptions {
    return {
      secretOrKey: this.getSecret(),
      // An allow-list of exactly one algorithm. Without it a token could name
      // its own `alg` and be verified under something weaker.
      algorithms: [JWT_ALGORITHM],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    };
  }

  private getSecret(): string {
    // Non-null by construction: `validateAuthEnv` runs at ConfigModule load
    // and refuses to boot without an acceptable secret, so reaching here
    // without one is impossible.
    return this.configService.get<string>(CONFIG.JWT_SECRET) as string;
  }
}
