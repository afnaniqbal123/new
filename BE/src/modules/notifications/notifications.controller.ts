import {
  Controller,
  Sse,
  MessageEvent,
  Param,
  Get,
  Query,
  Res,
  Patch,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { NotificationService } from './services/notification.service';
import { NotificationReadService } from './services/notification-read.service';
import { NotificationStreamService } from './services/notification-stream.service';
import { Public } from 'src/modules/auth/decorator/public.decorator';
import { GetNotificationsDto } from './dto/get-notifications.dto';
import { NOTIFICATION_ROUTES } from './constants/routes';
import { GetUser } from 'src/modules/auth/decorator/user.decorator';

@Controller(NOTIFICATION_ROUTES.BASE)
export class NotificationsController {
  // Three narrow collaborators rather than one broad service: this is the
  // smallest surface each endpoint needs, so a change to stream handling
  // cannot quietly alter how notifications are stored.
  constructor(
    private readonly notificationService: NotificationService,
    private readonly readService: NotificationReadService,
    private readonly streamService: NotificationStreamService,
  ) {}

  // Each client connects here with their userId. Native EventSource cannot
  // send an Authorization header, so this endpoint stays outside the global
  // access guard and identifies the subscriber from the route param instead.
  //
  // SECURITY: that makes the stream readable by anyone who can guess a user
  // id — the param is an assertion, not proof. Pre-existing behaviour, now
  // at least stated out loud rather than implied by a missing decorator. The
  // fix is a short-lived stream ticket minted by an authenticated endpoint
  // and passed as a query parameter; tracked separately from the M1 auth work.
  @Public()
  @Sse(NOTIFICATION_ROUTES.STREAM)
  stream(@Param('userId') userId: string): Observable<MessageEvent> {
    return this.streamService.subscribe(userId);
  }

  @Get(NOTIFICATION_ROUTES.USER)
  @ApiBearerAuth()
  async getUserNotifications(
    @GetUser('id') userId: string,
    @Query() getNotificationsDto: GetNotificationsDto,
    @Res() res: Response,
  ) {
    const { page = 1, limit = 10 } = getNotificationsDto;
    const response = await this.notificationService.getUserNotifications(
      userId,
      page,
      limit,
    );
    return res.status(response.status).json(response);
  }

  @Patch(NOTIFICATION_ROUTES.MARK_ALL_AS_READ)
  @ApiBearerAuth()
  async markAllNotificationsAsRead(
    @GetUser('id') userId: string,
    @Res() res: Response,
  ) {
    const response = await this.readService.markAllAsRead(userId);
    return res.status(response.status).json(response);
  }

  @Patch(NOTIFICATION_ROUTES.MARK_AS_READ)
  @ApiBearerAuth()
  async markNotificationAsRead(
    @GetUser('id') userId: string,
    @Param('notificationId') notificationId: string,
    @Res() res: Response,
  ) {
    const response = await this.readService.markAsRead(userId, notificationId);
    return res.status(response.status).json(response);
  }

  @Get(NOTIFICATION_ROUTES.UNREAD_COUNT)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get unread notifications count',
    description:
      'Returns the count of all unread notifications for the authenticated user',
  })
  async getUnreadCount(@GetUser('id') userId: string, @Res() res: Response) {
    const response = await this.readService.getUnreadCount(userId);
    return res.status(response.status).json(response);
  }
}
