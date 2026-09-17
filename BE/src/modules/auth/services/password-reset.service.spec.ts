import * as crypto from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { PasswordResetToken } from 'src/modules/auth/password-reset-token.schema';
import { PasswordResetService } from './password-reset.service';

const sha256 = (value: string) =>
  crypto.createHash('sha256').update(value).digest('hex');

describe('PasswordResetService', () => {
  let service: PasswordResetService;
  let model: {
    create: jest.Mock;
    findOneAndUpdate: jest.Mock;
    updateMany: jest.Mock;
  };

  beforeEach(async () => {
    model = {
      create: jest.fn().mockResolvedValue({}),
      findOneAndUpdate: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordResetService,
        { provide: getModelToken(PasswordResetToken.name), useValue: model },
      ],
    }).compile();

    service = module.get(PasswordResetService);
  });

  describe('issue', () => {
    it('persists only a hash, never the token it returns', async () => {
      const userId = new Types.ObjectId().toString();

      const rawToken = await service.issue(userId);

      const stored = model.create.mock.calls[0][0] as {
        tokenHash: string;
        userId: Types.ObjectId;
      };
      expect(stored.tokenHash).toBe(sha256(rawToken));
      expect(JSON.stringify(stored)).not.toContain(rawToken);
      expect(stored.userId.toString()).toBe(userId);
    });

    it('binds the credential to the account at the moment it is issued', async () => {
      const userId = new Types.ObjectId().toString();

      await service.issue(userId);

      const stored = model.create.mock.calls[0][0] as {
        userId: Types.ObjectId;
      };
      expect(stored.userId.toString()).toBe(userId);
    });

    it('produces a high-entropy token and a fresh one each time', async () => {
      const first = await service.issue(new Types.ObjectId().toString());
      const second = await service.issue(new Types.ObjectId().toString());

      expect(first).toHaveLength(64); // 32 bytes, hex
      expect(second).not.toBe(first);
    });

    it('retires any reset still outstanding for the same user', async () => {
      const userId = new Types.ObjectId().toString();

      await service.issue(userId);

      expect(model.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ usedAt: null }),
        { $set: { usedAt: expect.any(Date) } },
      );
    });

    it('sets an expiry 30 minutes out', async () => {
      const before = Date.now();
      await service.issue(new Types.ObjectId().toString());

      const { expiresAt } = model.create.mock.calls[0][0] as {
        expiresAt: Date;
      };
      const ttl = expiresAt.getTime() - before;
      expect(ttl).toBeGreaterThan(29 * 60 * 1000);
      expect(ttl).toBeLessThanOrEqual(30 * 60 * 1000 + 1000);
    });
  });

  describe('consume', () => {
    it('claims an unused, unexpired token and returns the bound user', async () => {
      const userId = new Types.ObjectId();
      model.findOneAndUpdate.mockResolvedValue({ userId });

      await expect(service.consume('raw-token')).resolves.toBe(
        userId.toString(),
      );
    });

    // The whole single-use property rests on this being one query rather than
    // a read followed by a write.
    it('matches and marks consumed in a single conditional update', async () => {
      model.findOneAndUpdate.mockResolvedValue({
        userId: new Types.ObjectId(),
      });

      await service.consume('raw-token');

      expect(model.findOneAndUpdate).toHaveBeenCalledTimes(1);
      const [filter, update] = model.findOneAndUpdate.mock.calls[0] as [
        Record<string, unknown>,
        Record<string, unknown>,
      ];
      expect(filter).toMatchObject({
        tokenHash: sha256('raw-token'),
        usedAt: null,
      });
      expect(filter.expiresAt).toEqual({ $gt: expect.any(Date) });
      expect(update).toEqual({ $set: { usedAt: expect.any(Date) } });
    });

    it('looks the token up by hash, never by the raw value', async () => {
      model.findOneAndUpdate.mockResolvedValue(null);

      await service.consume('raw-token');

      const [filter] = model.findOneAndUpdate.mock.calls[0] as [
        Record<string, unknown>,
      ];
      expect(filter.tokenHash).toBe(sha256('raw-token'));
      expect(JSON.stringify(filter)).not.toContain('raw-token');
    });

    it('rejects a token that no longer matches (spent, expired, or unknown)', async () => {
      model.findOneAndUpdate.mockResolvedValue(null);

      await expect(service.consume('raw-token')).resolves.toBeNull();
    });

    it('succeeds once and refuses the replay', async () => {
      const userId = new Types.ObjectId();
      model.findOneAndUpdate
        .mockResolvedValueOnce({ userId })
        .mockResolvedValueOnce(null);

      await expect(service.consume('raw-token')).resolves.toBe(
        userId.toString(),
      );
      await expect(service.consume('raw-token')).resolves.toBeNull();
    });

    it('lets only one of two concurrent submissions through', async () => {
      const userId = new Types.ObjectId();
      // Mirrors what the database does: the first conditional update matches,
      // the second finds nothing left with `usedAt: null`.
      let claimed = false;
      model.findOneAndUpdate.mockImplementation(() => {
        if (claimed) return Promise.resolve(null);
        claimed = true;
        return Promise.resolve({ userId });
      });

      const results = await Promise.all([
        service.consume('raw-token'),
        service.consume('raw-token'),
      ]);

      expect(results.filter((r) => r !== null)).toHaveLength(1);
    });
  });
});
