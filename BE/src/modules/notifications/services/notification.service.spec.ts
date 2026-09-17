import { HttpStatus } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { Notification } from 'src/modules/notifications/schemas/notification.schema';
import { NotificationReadService } from './notification-read.service';
import { NotificationStreamService } from './notification-stream.service';
import { NotificationService } from './notification.service';

const USER_ID = new Types.ObjectId();
const NOTIFICATION_ID = new Types.ObjectId();

describe('NotificationService', () => {
  let service: NotificationService;
  let model: { create: jest.Mock; find: jest.Mock; countDocuments: jest.Mock };
  let readService: { ensureUnread: jest.Mock; findStates: jest.Mock };
  let streamService: { emitTo: jest.Mock };

  const query = (rows: unknown[]) => ({
    sort: () => ({
      skip: () => ({
        limit: () => ({ lean: () => Promise.resolve(rows) }),
      }),
    }),
  });

  beforeEach(async () => {
    model = {
      create: jest.fn().mockResolvedValue({
        _id: NOTIFICATION_ID,
        createdAt: new Date('2026-01-01'),
      }),
      find: jest.fn().mockReturnValue(query([])),
      countDocuments: jest.fn().mockResolvedValue(0),
    };
    readService = {
      ensureUnread: jest.fn().mockResolvedValue(undefined),
      findStates: jest.fn().mockResolvedValue(new Map()),
    };
    streamService = { emitTo: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: getModelToken(Notification.name), useValue: model },
        { provide: NotificationReadService, useValue: readService },
        { provide: NotificationStreamService, useValue: streamService },
      ],
    }).compile();

    service = module.get(NotificationService);
  });

  describe('sendToUser', () => {
    const input = { type: 'booking_confirmed', message: 'You are booked.' };

    it('stores the notification, seeds read state, then delivers it', async () => {
      await service.sendToUser(USER_ID.toString(), input);

      expect(model.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: USER_ID, type: 'booking_confirmed' }),
      );
      expect(readService.ensureUnread).toHaveBeenCalledWith(
        USER_ID,
        NOTIFICATION_ID,
      );
      expect(streamService.emitTo).toHaveBeenCalledWith(
        USER_ID.toString(),
        expect.objectContaining({ notificationId: NOTIFICATION_ID.toString() }),
      );
    });

    it('falls back to a default title for a known type', async () => {
      await service.sendToUser(USER_ID.toString(), input);

      expect(model.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Booking Confirmed' }),
      );
    });

    it('keeps a caller-supplied title', async () => {
      await service.sendToUser(USER_ID.toString(), {
        ...input,
        title: 'Custom',
      });

      expect(model.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Custom' }),
      );
    });

    /**
     * Storage is what makes a notification durable, but a UI waiting on the
     * stream should not hang because the write failed. Preserved behaviour.
     */
    it('still nudges the client when storage fails', async () => {
      model.create.mockRejectedValue(new Error('mongo down'));

      const result = await service.sendToUser(USER_ID.toString(), input);

      expect(result).toBeUndefined();
      expect(streamService.emitTo).toHaveBeenCalledWith(
        USER_ID.toString(),
        input,
      );
    });

    it('does not seed read state when storage fails', async () => {
      model.create.mockRejectedValue(new Error('mongo down'));

      await service.sendToUser(USER_ID.toString(), input);

      expect(readService.ensureUnread).not.toHaveBeenCalled();
    });
  });

  describe('getUserNotifications', () => {
    it('annotates each notification with its read state', async () => {
      const readAt = new Date();
      model.find.mockReturnValue(
        query([{ _id: NOTIFICATION_ID, message: 'a' }]),
      );
      model.countDocuments.mockResolvedValue(1);
      readService.findStates.mockResolvedValue(
        new Map([[NOTIFICATION_ID.toString(), { isRead: true, readAt }]]),
      );

      const result = await service.getUserNotifications(USER_ID.toString());
      const data = result.data as { notifications: Record<string, unknown>[] };

      expect(result.status).toBe(HttpStatus.OK);
      expect(data.notifications[0]).toMatchObject({ isRead: true, readAt });
    });

    it('treats a notification with no read row as unread', async () => {
      model.find.mockReturnValue(
        query([{ _id: NOTIFICATION_ID, message: 'a' }]),
      );
      model.countDocuments.mockResolvedValue(1);

      const result = await service.getUserNotifications(USER_ID.toString());
      const data = result.data as { notifications: Record<string, unknown>[] };

      expect(data.notifications[0]).toMatchObject({
        isRead: false,
        readAt: null,
      });
    });

    it('excludes deleted notifications and reports pagination', async () => {
      model.countDocuments.mockResolvedValue(25);

      const result = await service.getUserNotifications(
        USER_ID.toString(),
        2,
        10,
      );
      const data = result.data as { pagination: Record<string, unknown> };

      expect(model.find).toHaveBeenCalledWith({
        userId: USER_ID,
        isDeleted: false,
      });
      expect(data.pagination).toMatchObject({
        currentPage: 2,
        totalPages: 3,
        totalItems: 25,
        hasNextPage: true,
        hasPrevPage: true,
      });
    });
  });
});
