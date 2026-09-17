import { JwtModule, JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import {
  CONFIG,
  JWT_ALGORITHM,
  JWT_AUDIENCE,
  JWT_ISSUER,
} from 'src/constants/config.constant';
import { TOKEN_TYPES } from 'src/modules/auth/constants/auth.constant';
import { USER_ROLES } from 'src/modules/user/constants/user.constant';
import { TokenService } from './token.service';

const SECRET = 'test-secret-that-is-long-enough-for-hs256';

describe('TokenService', () => {
  let tokenService: TokenService;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      providers: [
        TokenService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: CONFIG) =>
              key === CONFIG.JWT_SECRET ? SECRET : undefined,
          },
        },
      ],
    }).compile();

    tokenService = module.get(TokenService);
    jwtService = module.get(JwtService);
  });

  const principal = {
    id: 'user-1',
    email: 'user@example.com',
    role: USER_ROLES.ADMIN,
  };

  it('signs a token carrying exactly the claims authorization needs', () => {
    const token = tokenService.signAccessToken(principal);

    const decoded = jwtService.verify(token, {
      secret: SECRET,
      algorithms: [JWT_ALGORITHM],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    expect(decoded).toMatchObject({
      sub: 'user-1',
      email: 'user@example.com',
      role: USER_ROLES.ADMIN,
      type: TOKEN_TYPES.SIGNIN_TOKEN,
      iss: JWT_ISSUER,
      aud: JWT_AUDIENCE,
    });
  });

  it('includes the session id only when there is one', () => {
    const withSession = jwtService.decode(
      tokenService.signAccessToken({ ...principal, sessionId: 'session-1' }),
    );
    const withoutSession = jwtService.decode(
      tokenService.signAccessToken(principal),
    );

    expect(withSession).toMatchObject({ sid: 'session-1' });
    expect(withoutSession).not.toHaveProperty('sid');
  });

  it('issues short-lived tokens', () => {
    const decoded: { exp: number; iat: number } = jwtService.decode(
      tokenService.signAccessToken(principal),
    );

    // 15 minutes. The whole stateless-authentication argument rests on this
    // window being small, so it is asserted rather than assumed.
    expect(decoded.exp - decoded.iat).toBe(15 * 60);
  });

  it('hands the strategy verification options that match how it signs', () => {
    expect(tokenService.getVerifyOptions()).toEqual({
      secretOrKey: SECRET,
      algorithms: [JWT_ALGORITHM],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
  });
});
