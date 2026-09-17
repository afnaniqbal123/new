import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsController } from './notifications.controller';
import {
  Notification,
  NotificationSchema,
} from 'src/modules/notifications/schemas/notification.schema';
import {
  NotificationReadStatus,
  NotificationReadStatusSchema,
} from 'src/modules/notifications/schemas/notification-read-status.schema';
import { NotificationService } from './services/notification.service';
import { NotificationReadService } from './services/notification-read.service';
import { NotificationStreamService } from './services/notification-stream.service';

/**
 * In-app notifications: storage, per-recipient read state, and live delivery.
 *
 * Three services rather than one, split by what makes each change: records,
 * read state, and connections. See docs/architecture/module-architecture.md.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      {
        name: NotificationReadStatus.name,
        schema: NotificationReadStatusSchema,
      },
    ]),
  ],
  providers: [
    NotificationService,
    NotificationReadService,
    NotificationStreamService,
  ],
  controllers: [NotificationsController],
  exports: [
    NotificationService,
    NotificationReadService,
    NotificationStreamService,
  ],
})
export class NotificationsModule {}
