import * as crypto from 'crypto';
import { Model, Types } from 'mongoose';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { RefreshToken } from './refresh-token.schema';
import { User } from '../user/user.schema';
import {
  Serialized,
  SerializeHttpError,
  SerializeHttpResponse,
} from 'src/utils/serializer';
import {
  AUTH_ERRORS,
  AUTH_SUCCESS,
} from 'src/modules/auth/constants/api-response/auth.response';
import {
  ACCESS_TOKEN_VALIDITY,
  REFRESH_TOKEN_BYTES,
  REFRESH_TOKEN_VALIDITY,
  REFRESH_TOKEN_VALIDITY_DAYS,
} from 'src/constants/config.constant';
import { NOT_ALLOWED_USERS } from 'src/modules/user/constants/user.constant';
import { TokenService } from 'src/modules/auth/services/token.service';
import { hashOpaqueToken } from 'src/modules/auth/utils/auth.util';

/** The credential pair a client receives on login and on every refresh. */
export type IssuedSession = {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  refreshExpiresIn: string;
};

@Injectable()
export class RefreshTokenService {
  constructor(
    @InjectModel(RefreshToken.name)
    private readonly refreshTokenModel: Model<RefreshToken>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly tokenService: TokenService,
  ) {}

  private generateSecureToken(): string {
    return crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
  }

  /**
   * Open a session and mint the pair the client uses from here on.
   *
   * The session's id travels in the access token as `sid`, which is what lets
   * logout revoke the exact session a caller is holding without asking them
   * to hand back the refresh token.
   */
  async issueSession(
    user: Pick<User, 'email' | 'role'> & { _id: Types.ObjectId | string },
    deviceInfo?: string,
    ipAddress?: string,
  ): Promise<IssuedSession> {
    const rawToken = this.generateSecureToken();

    const session = await this.refreshTokenModel.create({
      userId: new Types.ObjectId(user._id.toString()),
      tokenHash: hashOpaqueToken(rawToken),
      expiresAt: this.expiryFromNow(),
      isRevoked: false,
      rotatedAt: null,
      deviceInfo,
      ipAddress,
    });

    const accessToken = this.tokenService.signAccessToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      sessionId: session._id.toString(),
    });

    return {
      accessToken,
      refreshToken: rawToken,
      expiresIn: ACCESS_TOKEN_VALIDITY,
      refreshExpiresIn: REFRESH_TOKEN_VALIDITY,
    };
  }

  /**
   * Exchange a refresh token for a fresh pair, rotating the session.
   *
   * This is the one point in the lifecycle where account state is re-read.
   * The access path is stateless by design, so a suspended or deleted account
   * keeps working until its short-lived token expires — and then stops here,
   * because this is where it would otherwise be renewed.
   */
  async refreshAccessToken(refreshToken: string) {
    try {
      const tokenHash = hashOpaqueToken(refreshToken);
      const now = new Date();

      // Claim the token and retire it in one conditional update. Two requests
      // racing with the same token cannot both match `rotatedAt: null`, so
      // exactly one rotation happens and the loser falls through to the reuse
      // check below.
      const claimed = await this.refreshTokenModel.findOneAndUpdate(
        {
          tokenHash,
          isRevoked: false,
          rotatedAt: null,
          expiresAt: { $gt: now },
        },
        { $set: { rotatedAt: now, isRevoked: true } },
        { new: true },
      );

      if (!claimed) {
        return await this.rejectUnclaimableToken(tokenHash);
      }

      const user = await this.userModel.findById(claimed.userId);

      if (!user) {
        return SerializeHttpError(
          null,
          HttpStatus.NOT_FOUND,
          AUTH_ERRORS.USER_NOT_FOUND,
        );
      }

      if (NOT_ALLOWED_USERS.includes(user.status)) {
        await this.revokeAllForUser(claimed.userId.toString());
        return SerializeHttpError(
          null,
          HttpStatus.UNAUTHORIZED,
          AUTH_ERRORS.REFRESH_TOKEN_REVOKED,
        );
      }

      const tokens = await this.issueSession(
        user,
        claimed.deviceInfo,
        claimed.ipAddress,
      );

      return SerializeHttpResponse(
        { ...tokens, user: user.toJSON() },
        HttpStatus.OK,
        AUTH_SUCCESS.TOKEN_REFRESHED,
      );
    } catch (error) {
      // The refusals above are deliberate and already carry the right status.
      // Only genuinely unexpected failures — a dropped connection, a bad
      // query — become a 500; swallowing an intentional 401 into one would
      // turn "your session is gone" into "the server is broken".
      if (error instanceof HttpException) {
        throw error;
      }

      return SerializeHttpError(
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
        AUTH_ERRORS.REFRESH_TOKEN_FAILED,
      );
    }
  }

  /**
   * A token that could not be claimed is either unknown, expired, revoked, or
   * already rotated. The last case is the interesting one: the legitimate
   * client discards a token the moment it trades it in, so seeing it again
   * means someone else has a copy. The safe reading is theft, and the whole
   * family goes.
   */
  private async rejectUnclaimableToken(tokenHash: string) {
    const existing = await this.refreshTokenModel.findOne({ tokenHash });

    if (!existing) {
      return SerializeHttpError(
        null,
        HttpStatus.UNAUTHORIZED,
        AUTH_ERRORS.REFRESH_TOKEN_INVALID,
      );
    }

    if (existing.rotatedAt) {
      await this.revokeAllForUser(existing.userId.toString());
      return SerializeHttpError(
        null,
        HttpStatus.UNAUTHORIZED,
        AUTH_ERRORS.REFRESH_TOKEN_REVOKED,
      );
    }

    if (existing.isRevoked) {
      return SerializeHttpError(
        null,
        HttpStatus.UNAUTHORIZED,
        AUTH_ERRORS.REFRESH_TOKEN_REVOKED,
      );
    }

    return SerializeHttpError(
      null,
      HttpStatus.UNAUTHORIZED,
      AUTH_ERRORS.REFRESH_TOKEN_EXPIRED,
    );
  }

  /**
   * Log out one session — the one whose id the caller's access token names.
   *
   * A token with no `sid` predates the session model (or was minted outside
   * `issueSession`). Reporting "logged out" while revoking nothing would be a
   * lie in the dangerous direction, so the fail-safe for an explicit logout is
   * to revoke everything that user holds.
   */
  async revokeSession(
    userId: string,
    sessionId: string | undefined,
  ): Promise<Serialized<null, HttpStatus.OK>> {
    try {
      if (sessionId && Types.ObjectId.isValid(sessionId)) {
        await this.refreshTokenModel.updateOne(
          { _id: new Types.ObjectId(sessionId), isRevoked: false },
          { $set: { isRevoked: true } },
        );
      } else {
        await this.revokeAllForUser(userId);
      }

      // Reported as success even when nothing matched. Logout is idempotent
      // from the client's point of view, and whether a given session id
      // existed is not something an unauthenticated probe should learn.
      return SerializeHttpResponse(
        null,
        HttpStatus.OK,
        AUTH_SUCCESS.LOGGED_OUT,
      );
    } catch {
      return SerializeHttpError(
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
        AUTH_ERRORS.LOGOUT_FAILED,
      );
    }
  }

  async revokeAllUserTokens(
    userId: string,
  ): Promise<Serialized<null, HttpStatus.OK>> {
    try {
      await this.revokeAllForUser(userId);

      return SerializeHttpResponse(
        null,
        HttpStatus.OK,
        AUTH_SUCCESS.LOGGED_OUT_ALL_DEVICES,
      );
    } catch {
      return SerializeHttpError(
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
        AUTH_ERRORS.LOGOUT_FAILED,
      );
    }
  }

  /**
   * Drop every session for a user. The revocation primitive behind
   * logout-all-devices, password reset, password change, and reuse detection.
   */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.refreshTokenModel.updateMany(
      { userId: new Types.ObjectId(userId), isRevoked: false },
      { $set: { isRevoked: true } },
    );
  }

  async getUserActiveTokens(userId: string) {
    try {
      const tokens = await this.refreshTokenModel
        .find({
          userId: new Types.ObjectId(userId),
          isRevoked: false,
          expiresAt: { $gt: new Date() },
        })
        .select('deviceInfo ipAddress createdAt expiresAt')
        .sort({ createdAt: -1 });

      return SerializeHttpResponse(
        tokens,
        HttpStatus.OK,
        AUTH_SUCCESS.ACTIVE_SESSIONS,
      );
    } catch {
      return SerializeHttpError(
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
        AUTH_ERRORS.ACTIVE_SESSIONS_FAILED,
      );
    }
  }

  /** Housekeeping for a cron job; the TTL index does this too. */
  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.refreshTokenModel.deleteMany({
      expiresAt: { $lt: new Date() },
    });

    return result.deletedCount;
  }

  private expiryFromNow(): Date {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_VALIDITY_DAYS);
    return expiresAt;
  }
}
