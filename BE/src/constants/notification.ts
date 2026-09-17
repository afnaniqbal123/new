export enum NotificationType {
  PROJECT_CREATED = 'project_created',
  PROJECT_UPDATED = 'project_updated',
  PROJECT_DELETED = 'project_deleted',
  PROJECT_APPROVED = 'project_approved',
  PROJECT_REJECTED = 'project_rejected',
  PROJECT_COMPLETED = 'project_completed',
  CHAT_MESSAGE = 'chat_message',
  NEW_MESSAGE = 'new_message',
  USER_MENTIONED = 'user_mentioned',
  PAYMENT_RECEIVED = 'payment_received',
  PAYMENT_FAILED = 'payment_failed',
  SUBSCRIPTION_CREATED = 'subscription_created',
  SUBSCRIPTION_CANCELED = 'subscription_canceled',
  SUBSCRIPTION_RENEWED = 'subscription_renewed',
  WELCOME = 'welcome',
  SYSTEM_ANNOUNCEMENT = 'system_announcement',
  REMINDER = 'reminder',
  INVITATION = 'invitation',
  COLLABORATION_REQUEST = 'collaboration_request',
  COLLABORATION_ACCEPTED = 'collaboration_accepted',
  COLLABORATION_REJECTED = 'collaboration_rejected',
}

export const NotificationTypeToMessageMap: Record<NotificationType, string> = {
  [NotificationType.PROJECT_CREATED]:
    '{senderName} created a new project: {projectName}',
  [NotificationType.PROJECT_UPDATED]:
    '{senderName} updated the project: {projectName}',
  [NotificationType.PROJECT_DELETED]:
    '{senderName} deleted the project: {projectName}',
  [NotificationType.PROJECT_APPROVED]:
    'Your project "{projectName}" has been approved',
  [NotificationType.PROJECT_REJECTED]:
    'Your project "{projectName}" has been rejected',
  [NotificationType.PROJECT_COMPLETED]:
    'The project "{projectName}" has been completed',
  [NotificationType.CHAT_MESSAGE]: '{senderName} sent you a message',
  [NotificationType.NEW_MESSAGE]: 'You have a new message from {senderName}',
  [NotificationType.USER_MENTIONED]: '{senderName} mentioned you in a message',
  [NotificationType.PAYMENT_RECEIVED]:
    'Payment received for project: {projectName}',
  [NotificationType.PAYMENT_FAILED]:
    'Payment failed for project: {projectName}',
  [NotificationType.SUBSCRIPTION_CREATED]:
    'Your subscription has been activated',
  [NotificationType.SUBSCRIPTION_CANCELED]:
    'Your subscription has been canceled',
  [NotificationType.SUBSCRIPTION_RENEWED]: 'Your subscription has been renewed',
  [NotificationType.WELCOME]: 'Welcome to our platform!',
  [NotificationType.SYSTEM_ANNOUNCEMENT]: 'System announcement: {message}',
  [NotificationType.REMINDER]: 'Reminder: {message}',
  [NotificationType.INVITATION]: '{senderName} invited you to collaborate',
  [NotificationType.COLLABORATION_REQUEST]:
    '{senderName} requested to collaborate on {projectName}',
  [NotificationType.COLLABORATION_ACCEPTED]:
    '{senderName} accepted your collaboration request',
  [NotificationType.COLLABORATION_REJECTED]:
    '{senderName} rejected your collaboration request',
};
