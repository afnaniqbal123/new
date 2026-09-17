import { Model, Types } from 'mongoose';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Serialized, SerializeHttpResponse } from 'src/utils/serializer';
import {
  NotificationReadStatus,
  NotificationReadStatusDocument,
} from 'src/modules/notifications/schemas/notification-read-status.schema';
import { NOTIFICATION_SUCCESS } from '../constants/success';
import { NOTIFICATION_ERRORS } from '../constants/errors';

/** Whether a user has seen a notification, and when. */
export type ReadState = { isRead: boolean; readAt: Date | null };

/**
 * The outcome of marking one notification read. `_id` is the *notification's*
 * id, not the read row's — the wire shape predates the split and is kept as
 * clients already read it.
 */
export type MarkedReadResult = {
  _id: Types.ObjectId;
  isRead: boolean;
  readAt: Date | null;
};

/** How many read rows a bulk mark touched. */
export type MarkAllReadResult = {
  modifiedCount: number;
  matchedCount: number;
};

/** A user's outstanding notification count. */
export type UnreadCountResult = { userId: string; unreadCount: number };

/**
 * Per-user read state.
 *
 * Kept separate from the notification records themselves because read state
 * is per *recipient*: one notification can be read by one user and unread by
 * another, and the two collections are updated on completely different
 * triggers.
 */
@Injectable()
export class NotificationReadService {
  private readonly logger = new Logger(NotificationReadService.name);

  constructor(
    @InjectModel(NotificationReadStatus.name)
    private readonly readStatusModel: Model<NotificationReadStatusDocument>,
  ) {}

  /**
   * Create the unread marker for a freshly-delivered notification.
   *
   * Idempotent: re-delivering the same notification must not reset a status
   * the user has already read.
   */
  async ensureUnread(
    userId: Types.ObjectId,
    notificationId: Types.ObjectId,
  ): Promise<void> {
    await this.readStatusModel.updateOne(
      { userId, notificationId },
      { $setOnInsert: { isRead: false, readAt: null } },
      { upsert: true },
    );
  }

  /** Read state for a batch of notifications, keyed by notification id. */
  async findStates(
    userId: Types.ObjectId,
    notificationIds: Types.ObjectId[],
  ): Promise<Map<string, ReadState>> {
    const statuses = await this.readStatusModel
      .find({ userId, notificationId: { $in: notificationIds } })
      .lean();

    return new Map(
      statuses.map((status) => [
        String(status.notificationId),
        { isRead: status.isRead, readAt: status.readAt },
      ]),
    );
  }

  async markAsRead(
    userId: string,
    notificationId: string,
  ): Promise<Serialized<MarkedReadResult | null, HttpStatus>> {
    try {
      const readStatus = await this.readStatusModel.findOneAndUpdate(
        {
          userId: new Types.ObjectId(userId),
          notificationId: new Types.ObjectId(notificationId),
        },
        { isRead: true, readAt: new Date() },
        { new: true, upsert: true },
      );

      return SerializeHttpResponse(
        {
          _id: readStatus.notificationId,
          isRead: readStatus.isRead,
          readAt: readStatus.readAt,
        },
        HttpStatus.OK,
        NOTIFICATION_SUCCESS.NOTIFICATION_MARKED_AS_READ,
      );
    } catch (error) {
      this.logger.error('markAsRead failed', error);
      // Envelope, not a thrown error: this module's HTTP contract is
      // unchanged by the refactor (issue #13 keeps behaviour stable). The
      // wider move to real status codes is tracked as debt in
      // docs/architecture/module-architecture.md.
      return SerializeHttpResponse(
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
        NOTIFICATION_ERRORS.MARK_AS_READ_FAILED,
      );
    }
  }

  async markAllAsRead(
    userId: string,
  ): Promise<Serialized<MarkAllReadResult | null, HttpStatus>> {
    try {
      const result = await this.readStatusModel.updateMany(
        { userId: new Types.ObjectId(userId), isRead: false },
        { isRead: true, readAt: new Date() },
      );

      return SerializeHttpResponse(
        {
          modifiedCount: result.modifiedCount,
          matchedCount: result.matchedCount,
        },
        HttpStatus.OK,
        NOTIFICATION_SUCCESS.ALL_NOTIFICATIONS_MARKED_AS_READ,
      );
    } catch (error) {
      this.logger.error('markAllAsRead failed', error);
      // Envelope, not a thrown error: this module's HTTP contract is
      // unchanged by the refactor (issue #13 keeps behaviour stable). The
      // wider move to real status codes is tracked as debt in
      // docs/architecture/module-architecture.md.
      return SerializeHttpResponse(
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
        NOTIFICATION_ERRORS.MARK_AS_READ_FAILED,
      );
    }
  }

  async getUnreadCount(
    userId: string,
  ): Promise<Serialized<UnreadCountResult | null, HttpStatus>> {
    try {
      const unreadCount = await this.readStatusModel.countDocuments({
        userId: new Types.ObjectId(userId),
        isRead: false,
      });

      return SerializeHttpResponse(
        { userId, unreadCount },
        HttpStatus.OK,
        NOTIFICATION_SUCCESS.UNREAD_COUNT_RETRIEVED,
      );
    } catch (error) {
      this.logger.error('getUnreadCount failed', error);
      // Envelope, not a thrown error: this module's HTTP contract is
      // unchanged by the refactor (issue #13 keeps behaviour stable). The
      // wider move to real status codes is tracked as debt in
      // docs/architecture/module-architecture.md.
      return SerializeHttpResponse(
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
        NOTIFICATION_ERRORS.UNREAD_COUNT_FAILED,
      );
    }
  }
}
