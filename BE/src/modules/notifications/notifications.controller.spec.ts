import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationService } from './services/notification.service';
import { NotificationReadService } from './services/notification-read.service';
import { NotificationStreamService } from './services/notification-stream.service';

/**
 * The controller in isolation. It now depends on three narrow services rather
 * than one broad one, so each can be stubbed independently — which is the
 * point of the split, and why this needs neither a database nor a signing key.
 */
describe('NotificationsController', () => {
  let controller: NotificationsController;
  let notificationService: { getUserNotifications: jest.Mock };
  let readService: {
    markAsRead: jest.Mock;
    markAllAsRead: jest.Mock;
    getUnreadCount: jest.Mock;
  };
  let streamService: { subscribe: jest.Mock };

  beforeEach(async () => {
    notificationService = { getUserNotifications: jest.fn() };
    readService = {
      markAsRead: jest.fn(),
      markAllAsRead: jest.fn(),
      getUnreadCount: jest.fn(),
    };
    streamService = { subscribe: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: NotificationService, useValue: notificationService },
        { provide: NotificationReadService, useValue: readService },
        { provide: NotificationStreamService, useValue: streamService },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
  });

  const ok = (data: unknown = null) => ({
    data,
    status: HttpStatus.OK,
    message: 'ok',
  });

  const res = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  });

  it('serves the stream from the stream service alone', () => {
    controller.stream('user-1');

    expect(streamService.subscribe).toHaveBeenCalledWith('user-1');
    // Reading the stream must not touch storage.
    expect(notificationService.getUserNotifications).not.toHaveBeenCalled();
  });

  it('lists notifications through the notification service', async () => {
    notificationService.getUserNotifications.mockResolvedValue(ok());

    await controller.getUserNotifications(
      'user-1',
      { page: 3, limit: 5 },
      res() as never,
    );

    expect(notificationService.getUserNotifications).toHaveBeenCalledWith(
      'user-1',
      3,
      5,
    );
  });

  it('defaults paging when the query omits it', async () => {
    notificationService.getUserNotifications.mockResolvedValue(ok());

    await controller.getUserNotifications('user-1', {}, res() as never);

    expect(notificationService.getUserNotifications).toHaveBeenCalledWith(
      'user-1',
      1,
      10,
    );
  });

  it('routes mark-all-read to the read service, not to storage', async () => {
    readService.markAllAsRead.mockResolvedValue(ok());

    await controller.markAllNotificationsAsRead('user-1', res() as never);

    expect(readService.markAllAsRead).toHaveBeenCalledWith('user-1');
    // Read state and records are separate collaborators now; marking read
    // must not go anywhere near notification storage.
    expect(notificationService.getUserNotifications).not.toHaveBeenCalled();
  });

  it('routes mark-one-read to the read service with both ids', async () => {
    readService.markAsRead.mockResolvedValue(ok());

    await controller.markNotificationAsRead(
      'user-1',
      'notification-9',
      res() as never,
    );

    expect(readService.markAsRead).toHaveBeenCalledWith(
      'user-1',
      'notification-9',
    );
    // The caller's id comes from the verified principal, the notification id
    // from the URL — never both from the request.
    expect(readService.markAllAsRead).not.toHaveBeenCalled();
  });

  it('routes the unread count to the read service', async () => {
    readService.getUnreadCount.mockResolvedValue(ok());

    await controller.getUnreadCount('user-1', res() as never);

    expect(readService.getUnreadCount).toHaveBeenCalledWith('user-1');
  });

  it('mirrors the envelope status onto the HTTP response', async () => {
    const response = res();
    readService.getUnreadCount.mockResolvedValue({
      data: null,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'boom',
    });

    await controller.getUnreadCount('user-1', response as never);

    expect(response.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  });
});
