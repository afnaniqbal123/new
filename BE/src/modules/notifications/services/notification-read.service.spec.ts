import { HttpStatus } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { NotificationReadStatus } from 'src/modules/notifications/schemas/notification-read-status.schema';
import { NOTIFICATION_SUCCESS } from '../constants/success';
import { NotificationReadService } from './notification-read.service';

const USER_ID = new Types.ObjectId();
const NOTIFICATION_ID = new Types.ObjectId();

describe('NotificationReadService', () => {
  let service: NotificationReadService;
  let model: {
    updateOne: jest.Mock;
    updateMany: jest.Mock;
    findOneAndUpdate: jest.Mock;
    countDocuments: jest.Mock;
    find: jest.Mock;
  };

  beforeEach(async () => {
    model = {
      updateOne: jest.fn().mockResolvedValue({}),
      updateMany: jest
        .fn()
        .mockResolvedValue({ modifiedCount: 3, matchedCount: 3 }),
      findOneAndUpdate: jest.fn(),
      countDocuments: jest.fn().mockResolvedValue(7),
      find: jest
        .fn()
        .mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationReadService,
        {
          provide: getModelToken(NotificationReadStatus.name),
          useValue: model,
        },
      ],
    }).compile();

    service = module.get(NotificationReadService);
  });

  describe('ensureUnread', () => {
    /**
     * Re-delivering a notification must not un-read it. `$setOnInsert` is
     * what makes the seeding idempotent.
     */
    it('seeds an unread marker without disturbing an existing one', async () => {
      await service.ensureUnread(USER_ID, NOTIFICATION_ID);

      expect(model.updateOne).toHaveBeenCalledWith(
        { userId: USER_ID, notificationId: NOTIFICATION_ID },
        { $setOnInsert: { isRead: false, readAt: null } },
        { upsert: true },
      );
    });
  });

  describe('markAsRead', () => {
    it('records the read and the moment it happened', async () => {
      model.findOneAndUpdate.mockResolvedValue({
        notificationId: NOTIFICATION_ID,
        isRead: true,
        readAt: new Date(),
      });

      const result = await service.markAsRead(
        USER_ID.toString(),
        NOTIFICATION_ID.toString(),
      );

      expect(result.status).toBe(HttpStatus.OK);
      expect(result.message).toBe(
        NOTIFICATION_SUCCESS.NOTIFICATION_MARKED_AS_READ,
      );
      const [, update] = model.findOneAndUpdate.mock.calls[0] as [
        unknown,
        { isRead: boolean; readAt: Date },
      ];
      expect(update.isRead).toBe(true);
      expect(update.readAt).toBeInstanceOf(Date);
    });
  });

  describe('markAllAsRead', () => {
    it('touches only the notifications still unread', async () => {
      const result = await service.markAllAsRead(USER_ID.toString());

      expect(result.status).toBe(HttpStatus.OK);
      expect(model.updateMany).toHaveBeenCalledWith(
        { userId: USER_ID, isRead: false },
        expect.objectContaining({ isRead: true }),
      );
      expect(result.data).toEqual({ modifiedCount: 3, matchedCount: 3 });
    });
  });

  describe('getUnreadCount', () => {
    it('counts only unread rows for that user', async () => {
      const result = await service.getUnreadCount(USER_ID.toString());

      expect(model.countDocuments).toHaveBeenCalledWith({
        userId: USER_ID,
        isRead: false,
      });
      expect(result.data).toEqual({
        userId: USER_ID.toString(),
        unreadCount: 7,
      });
    });
  });

  describe('findStates', () => {
    it('maps read state by notification id', async () => {
      const readAt = new Date();
      model.find.mockReturnValue({
        lean: jest
          .fn()
          .mockResolvedValue([
            { notificationId: NOTIFICATION_ID, isRead: true, readAt },
          ]),
      });

      const states = await service.findStates(USER_ID, [NOTIFICATION_ID]);

      expect(states.get(NOTIFICATION_ID.toString())).toEqual({
        isRead: true,
        readAt,
      });
    });

    it('returns an empty map when nothing has been read', async () => {
      const states = await service.findStates(USER_ID, [NOTIFICATION_ID]);

      expect(states.size).toBe(0);
    });
  });
});
