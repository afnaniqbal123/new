export enum NOTIFICATION_ROUTES {
  BASE = 'notifications',
  USER = 'user',
  STREAM = 'stream/:userId',
  MARK_ALL_AS_READ = 'mark-all-read',
  MARK_AS_READ = ':notificationId/read',
  UNREAD_COUNT = 'unread-count',
}
