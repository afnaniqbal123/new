import * as crypto from 'crypto';
import { HttpException, HttpStatus } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { AUTH_ERRORS } from 'src/modules/auth/constants/api-response/auth.response';
import {
  USER_ROLES,
  USER_STATUS,
} from 'src/modules/user/constants/user.constant';
import { User } from 'src/modules/user/user.schema';
import { RefreshToken } from './refresh-token.schema';
import { RefreshTokenService } from './refresh-token.service';
import { TokenService } from './services/token.service';

const sha256 = (value: string) =>
  crypto.createHash('sha256').update(value).digest('hex');

const USER_ID = new Types.ObjectId();
const SESSION_ID = new Types.ObjectId();

/**
 * A refusal is an HTTP error, not a 200 carrying an error code. Asserting the
 * thrown envelope is what pins that down.
 */
async function expectRefusal(
  run: () => Promise<unknown>,
  status: HttpStatus,
  message: string,
): Promise<void> {
  await expect(run()).rejects.toBeInstanceOf(HttpException);
  try {
    await run();
  } catch (error) {
    const body = (error as HttpException).getResponse() as {
      status: number;
      message: string;
    };
    expect(body.status).toBe(status);
    expect(body.message).toBe(message);
  }
}

describe('RefreshTokenService', () => {
  let service: RefreshTokenService;
  let refreshTokenModel: {
    create: jest.Mock;
    findOne: jest.Mock;
    findOneAndUpdate: jest.Mock;
    updateOne: jest.Mock;
    updateMany: jest.Mock;
    find: jest.Mock;
    deleteMany: jest.Mock;
  };
  let userModel: { findById: jest.Mock };
  let tokenService: { signAccessToken: jest.Mock };

  const activeUser = {
    _id: USER_ID,
    email: 'user@example.com',
    role: USER_ROLES.CASHIER,
    status: USER_STATUS.ACTIVE,
    toJSON: () => ({ _id: USER_ID, email: 'user@example.com' }),
  };

  beforeEach(async () => {
    refreshTokenModel = {
      create: jest.fn().mockResolvedValue({ _id: SESSION_ID }),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      updateOne: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({}),
      find: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
    };
    userModel = { findById: jest.fn().mockResolvedValue(activeUser) };
    tokenService = { signAccessToken: jest.fn().mockReturnValue('access.jwt') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshTokenService,
        {
          provide: getModelToken(RefreshToken.name),
          useValue: refreshTokenModel,
        },
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: TokenService, useValue: tokenService },
      ],
    }).compile();

    service = module.get(RefreshTokenService);
  });

  describe('issueSession', () => {
    it('stores only the hash of the refresh token it hands out', async () => {
      const { refreshToken } = await service.issueSession(activeUser);

      const stored = refreshTokenModel.create.mock.calls[0][0] as {
        tokenHash: string;
      };
      expect(stored.tokenHash).toBe(sha256(refreshToken));
      expect(JSON.stringify(stored)).not.toContain(refreshToken);
    });

    it('names the session in the access token so logout can target it', async () => {
      await service.issueSession(activeUser);

      expect(tokenService.signAccessToken).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: SESSION_ID.toString() }),
      );
    });

    it('mints the access token through the one signing boundary', async () => {
      const result = await service.issueSession(activeUser);

      expect(result.accessToken).toBe('access.jwt');
      expect(tokenService.signAccessToken).toHaveBeenCalledWith({
        id: USER_ID.toString(),
        email: 'user@example.com',
        role: USER_ROLES.CASHIER,
        sessionId: SESSION_ID.toString(),
      });
    });
  });

  describe('refreshAccessToken', () => {
    const claimable = {
      userId: USER_ID,
      deviceInfo: 'iPhone',
      ipAddress: '203.0.113.1',
    };

    it('rotates: the presented token is retired and a new pair issued', async () => {
      refreshTokenModel.findOneAndUpdate.mockResolvedValue(claimable);

      const result = await service.refreshAccessToken('raw-refresh');

      expect(result.status).toBe(HttpStatus.OK);
      const [filter, update] = refreshTokenModel.findOneAndUpdate.mock
        .calls[0] as [Record<string, unknown>, Record<string, unknown>];
      expect(filter).toMatchObject({
        tokenHash: sha256('raw-refresh'),
        isRevoked: false,
        rotatedAt: null,
      });
      expect(update).toEqual({
        $set: { rotatedAt: expect.any(Date), isRevoked: true },
      });
      // A brand-new session record, i.e. a new refresh token for the client.
      expect(refreshTokenModel.create).toHaveBeenCalledTimes(1);
    });

    it('returns a refresh token that differs from the one spent', async () => {
      refreshTokenModel.findOneAndUpdate.mockResolvedValue(claimable);

      const result = await service.refreshAccessToken('raw-refresh');
      const data = result.data as { refreshToken: string };

      expect(data.refreshToken).not.toBe('raw-refresh');
    });

    it('rejects a token it has never seen', async () => {
      refreshTokenModel.findOneAndUpdate.mockResolvedValue(null);
      refreshTokenModel.findOne.mockResolvedValue(null);

      await expectRefusal(
        () => service.refreshAccessToken('unknown'),
        HttpStatus.UNAUTHORIZED,
        AUTH_ERRORS.REFRESH_TOKEN_INVALID,
      );
    });

    /**
     * A legitimate client throws its refresh token away the instant it trades
     * it in. Seeing a rotated one again means a second copy exists, so the
     * safe reading is theft and the whole family is dropped.
     */
    it('treats reuse of a rotated token as theft and revokes every session', async () => {
      refreshTokenModel.findOneAndUpdate.mockResolvedValue(null);
      refreshTokenModel.findOne.mockResolvedValue({
        userId: USER_ID,
        rotatedAt: new Date(),
        isRevoked: true,
      });

      await expectRefusal(
        () => service.refreshAccessToken('already-rotated'),
        HttpStatus.UNAUTHORIZED,
        AUTH_ERRORS.REFRESH_TOKEN_REVOKED,
      );

      expect(refreshTokenModel.updateMany).toHaveBeenCalledWith(
        { userId: USER_ID, isRevoked: false },
        { $set: { isRevoked: true } },
      );
    });

    it('rejects a revoked session without touching the others', async () => {
      refreshTokenModel.findOneAndUpdate.mockResolvedValue(null);
      refreshTokenModel.findOne.mockResolvedValue({
        userId: USER_ID,
        rotatedAt: null,
        isRevoked: true,
      });

      await expectRefusal(
        () => service.refreshAccessToken('revoked'),
        HttpStatus.UNAUTHORIZED,
        AUTH_ERRORS.REFRESH_TOKEN_REVOKED,
      );

      expect(refreshTokenModel.updateMany).not.toHaveBeenCalled();
    });

    it('rejects an expired session', async () => {
      refreshTokenModel.findOneAndUpdate.mockResolvedValue(null);
      refreshTokenModel.findOne.mockResolvedValue({
        userId: USER_ID,
        rotatedAt: null,
        isRevoked: false,
      });

      await expectRefusal(
        () => service.refreshAccessToken('expired'),
        HttpStatus.UNAUTHORIZED,
        AUTH_ERRORS.REFRESH_TOKEN_EXPIRED,
      );
    });

    /**
     * The access path never reads the user, so this is the moment a
     * suspension actually takes hold — the point at which credentials would
     * otherwise be renewed.
     */
    it('stops renewing credentials for a suspended account', async () => {
      refreshTokenModel.findOneAndUpdate.mockResolvedValue(claimable);
      userModel.findById.mockResolvedValue({
        ...activeUser,
        status: USER_STATUS.INACTIVE,
      });

      await expectRefusal(
        () => service.refreshAccessToken('raw-refresh'),
        HttpStatus.UNAUTHORIZED,
        AUTH_ERRORS.REFRESH_TOKEN_REVOKED,
      );

      expect(refreshTokenModel.updateMany).toHaveBeenCalled();
    });

    it('reports a deleted account rather than minting a token for it', async () => {
      refreshTokenModel.findOneAndUpdate.mockResolvedValue(claimable);
      userModel.findById.mockResolvedValue(null);

      await expectRefusal(
        () => service.refreshAccessToken('raw-refresh'),
        HttpStatus.NOT_FOUND,
        AUTH_ERRORS.USER_NOT_FOUND,
      );
    });

    it('carries the device fingerprint across the rotation', async () => {
      refreshTokenModel.findOneAndUpdate.mockResolvedValue(claimable);

      await service.refreshAccessToken('raw-refresh');

      expect(refreshTokenModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceInfo: 'iPhone',
          ipAddress: '203.0.113.1',
        }),
      );
    });
  });

  describe('revocation', () => {
    it('logout ends the session named by the caller access token', async () => {
      const result = await service.revokeSession(
        USER_ID.toString(),
        SESSION_ID.toString(),
      );

      expect(result.status).toBe(HttpStatus.OK);
      expect(refreshTokenModel.updateOne).toHaveBeenCalledWith(
        { _id: SESSION_ID, isRevoked: false },
        { $set: { isRevoked: true } },
      );
    });

    /**
     * A token carrying no usable session id cannot name what to revoke, and
     * answering "logged out" while leaving every session alive would be the
     * dangerous kind of wrong. Logout falls back to revoking all of them.
     */
    it('logout revokes everything when the token names no session', async () => {
      const result = await service.revokeSession(USER_ID.toString(), undefined);

      expect(result.status).toBe(HttpStatus.OK);
      expect(refreshTokenModel.updateOne).not.toHaveBeenCalled();
      expect(refreshTokenModel.updateMany).toHaveBeenCalledWith(
        { userId: USER_ID, isRevoked: false },
        { $set: { isRevoked: true } },
      );
    });

    it('logout treats a malformed session id the same fail-safe way', async () => {
      const result = await service.revokeSession(
        USER_ID.toString(),
        'not-an-object-id',
      );

      expect(result.status).toBe(HttpStatus.OK);
      expect(refreshTokenModel.updateOne).not.toHaveBeenCalled();
      expect(refreshTokenModel.updateMany).toHaveBeenCalled();
    });

    it('logout-all-devices drops every live session for the user', async () => {
      const result = await service.revokeAllUserTokens(USER_ID.toString());

      expect(result.status).toBe(HttpStatus.OK);
      expect(refreshTokenModel.updateMany).toHaveBeenCalledWith(
        { userId: USER_ID, isRevoked: false },
        { $set: { isRevoked: true } },
      );
    });
  });
});
