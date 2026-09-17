import * as jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { Model } from 'mongoose';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User } from '../user/user.schema';
import {
  SerializeHttpError,
  SerializeHttpResponse,
} from 'src/utils/serializer';
import {
  AUTH_ERRORS,
  AUTH_SUCCESS,
} from 'src/modules/auth/constants/api-response/auth.response';
import { AUTH_PROVIDER } from 'src/modules/auth/constants/auth.constant';
import {
  NOT_ALLOWED_USERS,
  USER_ROLES,
  USER_STATUS,
} from 'src/modules/user/constants/user.constant';
import { createHashPassword } from 'src/modules/auth/utils/auth.util';
import { RefreshTokenService } from './refresh-token.service';

interface CreateUserData {
  email: string;
  name: string;
  provider: AUTH_PROVIDER;
}

@Injectable()
export class SocialAuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  async verifyAppleToken(idToken: string) {
    try {
      console.log('Apple Auth: Starting verification');

      const decodedHeader = jwt.decode(idToken, { complete: true });
      if (!decodedHeader || typeof decodedHeader === 'string') {
        return SerializeHttpError(
          null,
          HttpStatus.BAD_REQUEST,
          AUTH_ERRORS.INVALID_APPLE_TOKEN,
        );
      }
      const kid = decodedHeader.header.kid;
      const alg = decodedHeader.header.alg;

      const client = jwksClient({
        jwksUri: 'https://appleid.apple.com/auth/keys',
        cache: true,
        cacheMaxEntries: 5,
        cacheMaxAge: 600000, // 10 min
      });

      const key = await client.getSigningKey(kid);
      const publicKey = key.getPublicKey();

      let payload: any;
      try {
        payload = jwt.verify(idToken, publicKey, { algorithms: ['RS256'] });
      } catch (error) {
        console.error('Apple Auth: JWT verification failed', error);
        return SerializeHttpError(
          null,
          HttpStatus.BAD_REQUEST,
          AUTH_ERRORS.INVALID_APPLE_TOKEN,
        );
      }

      // Claims validation
      if (
        payload.iss !== 'https://appleid.apple.com' ||
        payload.aud !== 'org.reactjs.native.example.Zetreen'
      ) {
        console.error('Apple Auth: Invalid issuer or audience', payload);
        return SerializeHttpError(
          null,
          HttpStatus.BAD_REQUEST,
          AUTH_ERRORS.INVALID_APPLE_TOKEN,
        );
      }

      if (!payload.email || !payload.email_verified) {
        console.error('Apple Auth: Missing or unverified email', payload);
        return SerializeHttpError(
          null,
          HttpStatus.BAD_REQUEST,
          AUTH_ERRORS.INVALID_APPLE_TOKEN,
        );
      }

      const user = await this.userModel.findOne({
        email: payload.email.toLowerCase(),
      });
      if (user) {
        // The same gate password login applies. Authenticating through a
        // provider proves who you are; it does not decide whether this
        // account is allowed a session.
        if (NOT_ALLOWED_USERS.includes(user.status)) {
          return SerializeHttpError(
            null,
            HttpStatus.UNAUTHORIZED,
            AUTH_ERRORS.INCORRECT_CREDENTIALS,
          );
        }

        const loggedData = await this.loginUser(user);
        return SerializeHttpResponse(
          loggedData,
          HttpStatus.OK,
          AUTH_SUCCESS.ACCOUNT_LOGIN,
        );
      }

      const name = payload.name || payload.email.split('@')[0];

      // TODO: Create new user according to your requirements
      const newUser = await this.userModel.create({
        email: payload.email.toLowerCase(),
        name,
        // `role` is required by the schema and is a claim in the access token
        // this account is about to be issued. Omitting it failed schema
        // validation outright, and would now also produce a token the access
        // path rejects. OWNER matches what `AuthService.signup` assigns.
        role: USER_ROLES.OWNER,
        provider: AUTH_PROVIDER.APPLE,
        status: USER_STATUS.ACTIVE,
        emailVerified: true,
      });

      const loggedData = await this.loginUser(newUser);

      return SerializeHttpResponse(
        loggedData,
        HttpStatus.CREATED,
        AUTH_SUCCESS.APPLE_ACCOUNT_CREATION,
      );
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      console.error('Apple Auth Error:', error);
      return SerializeHttpError(
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
        AUTH_ERRORS.ACCOUNT_LOGIN,
      );
    }
  }

  private async loginUser(user: any) {
    const tokens = await this.refreshTokenService.issueSession(user);

    return {
      ...tokens,
      user: user.toJSON(),
    };
  }
}
