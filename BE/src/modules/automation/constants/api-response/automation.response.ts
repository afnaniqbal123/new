export enum AUTOMATION_RESPONSE {
  RUNS_FETCHED = 'Automation history fetched successfully',
  TRIGGERED = 'Automation queued successfully',
  RUN_COMPLETED = 'Automation completed successfully',
  DIGEST_FETCHED = 'Digest fetched successfully',
  REMINDERS_SENT = 'Payment reminders sent successfully',
  NOT_ENABLED = 'Automations are not enabled for this organization',
  PLAN_REQUIRED = 'Your plan does not include automations',
  UNKNOWN_AUTOMATION = 'That automation does not exist',
}
