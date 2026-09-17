import { Model, Types } from 'mongoose';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Serialized, SerializeHttpResponse } from 'src/utils/serializer';
import {
  Notification,
  NotificationDocument,
} from 'src/modules/notifications/schemas/notification.schema';
import { NOTIFICATION_SUCCESS } from '../constants/success';
import { NOTIFICATION_ERRORS } from '../constants/errors';
import { NOTIFICATION_TITLES } from '../constants/titles';
import { NotificationReadService } from './notification-read.service';
import { NotificationStreamService } from './notification-stream.service';

/** What a caller supplies to raise a notification. */
export type NotificationInput = {
  type: string;
  title?: string;
  message: string;
  data?: Record<string, unknown>;
};

/**
 * Notification records: raising them, and reading them back.
 *
 * It orchestrates the two collaborators rather than absorbing them — read
 * state belongs to `NotificationReadService` and live delivery to
 * `NotificationStreamService`, both of which change for their own reasons.
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    private readonly readService: NotificationReadService,
    private readonly streamService: NotificationStreamService,
  ) {}

  /**
   * Store a notification, mark it unread for the recipient, and push it to
   * them if they are connected.
   *
   * Storage is what makes it durable; the push is a courtesy. If storage
   * fails the client is still nudged, so a UI waiting on the stream does not
   * hang — deliberately preserved from the original behaviour.
   */
  async sendToUser(
    userId: string,
    input: NotificationInput,
  ): Promise<NotificationDocument | undefined> {
    const recipient = new Types.ObjectId(userId);

    try {
      const notification = await this.notificationModel.create({
        userId: recipient,
        type: input.type,
        // `||` not `??`, matching the original: an empty title is as good as
        // no title and must still fall back.
        title: input.title || this.defaultTitle(input.type),
        message: input.message,
        data: input.data || {},
      });

      const notificationId = new Types.ObjectId(String(notification._id));
      await this.readService.ensureUnread(recipient, notificationId);

      this.streamService.emitTo(userId, {
        ...input,
        notificationId: notificationId.toString(),
        createdAt: notification.createdAt,
      });

      return notification;
    } catch (error) {
      this.logger.error('sendToUser failed to persist', error);
      this.streamService.emitTo(userId, input);
      return undefined;
    }
  }

  /** A page of a user's notifications, each annotated with its read state. */
  /**
   * Returns `unknown` deliberately: the payload is a populated, leaned
   * Mongoose result whose inferred type is too deep for tsc's declaration
   * emit (TS7056). Naming a hand-written shape here would be a guess that
   * drifts from the query.
   */
  async getUserNotifications(
    userId: string,
    page = 1,
    limit = 10,
  ): Promise<Serialized<unknown, HttpStatus>> {
    try {
      const recipient = new Types.ObjectId(userId);
      const filter = { userId: recipient, isDeleted: false };

      const notifications = await this.notificationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

      const readStates = await this.readService.findStates(
        recipient,
        notifications.map((n) => new Types.ObjectId(String(n._id))),
      );

      const totalItems = await this.notificationModel.countDocuments(filter);
      const totalPages = Math.ceil(totalItems / limit);

      return SerializeHttpResponse(
        {
          notifications: notifications.map((notification) => {
            const state = readStates.get(String(notification._id));
            return {
              ...notification,
              isRead: state?.isRead ?? false,
              readAt: state?.readAt ?? null,
            };
          }),
          pagination: {
            currentPage: page,
            totalPages,
            totalItems,
            itemsPerPage: limit,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
          },
        },
        HttpStatus.OK,
        NOTIFICATION_SUCCESS.NOTIFICATIONS_RETRIEVED,
      );
    } catch (error) {
      this.logger.error('getUserNotifications failed', error);
      // Envelope, not a thrown error: this module's HTTP contract is
      // unchanged by the refactor (issue #13 keeps behaviour stable). The
      // wider move to real status codes is tracked as debt in
      // docs/architecture/module-architecture.md.
      return SerializeHttpResponse(
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
        NOTIFICATION_ERRORS.NOTIFICATIONS_RETRIEVE_FAILED,
      );
    }
  }

  private defaultTitle(type: string): string {
    return NOTIFICATION_TITLES[type] ?? NOTIFICATION_TITLES.default;
  }
}
