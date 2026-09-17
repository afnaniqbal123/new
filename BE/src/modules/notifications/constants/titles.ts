/**
 * Fallback headings for notifications raised without an explicit title.
 * Extracted from the service so adding a notification type is a one-line
 * change to data rather than an edit to delivery logic.
 */
export const NOTIFICATION_TITLES: Record<string, string> = {
  booking_cancelled: 'Booking Cancelled',
  booking_confirmed: 'Booking Confirmed',
  booking_reminder: 'Booking Reminder',
  default: 'Notification',
};
