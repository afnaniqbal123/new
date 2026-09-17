export enum EMAIL_ERRORS {
  RECIPIENT_REQUIRED = 'A valid recipient email is required',
  TEMPLATE_LOAD_FAILED = 'Failed to load email template',
  SEND_FAILED = 'Failed to send the email',
  PROVIDER_UNREACHABLE = 'Email sending failed: the provider could not be reached',
  PROVIDER_NOT_CONFIGURED = 'The configured email provider is not available in this build',
  SENDER_NOT_CONFIGURED = 'No sender address is configured for the email provider',
}
