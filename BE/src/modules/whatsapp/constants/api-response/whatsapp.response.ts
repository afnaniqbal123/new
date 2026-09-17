export enum WHATSAPP_RESPONSE {
  WEBHOOK_VERIFIED = 'Webhook verified successfully',
  MESSAGE_RECEIVED = 'Message received',
  MESSAGE_SENT = 'Message sent successfully',
  MESSAGE_QUEUED = 'Message queued for delivery',

  CONVERSATIONS_FETCHED = 'Conversations fetched successfully',
  CONVERSATION_FETCHED = 'Conversation fetched successfully',
  CONVERSATION_NOT_FOUND = 'Conversation not found',
  CONVERSATION_CLOSED = 'Conversation closed successfully',
  MESSAGES_FETCHED = 'Messages fetched successfully',

  DRAFTS_FETCHED = 'Draft orders fetched successfully',
  DRAFT_FETCHED = 'Draft order fetched successfully',
  DRAFT_CREATED = 'Draft order created successfully',
  DRAFT_CONFIRMED = 'Draft order confirmed and sale created',
  DRAFT_REJECTED = 'Draft order rejected',
  DRAFT_NOT_FOUND = 'Draft order not found',
  DRAFT_NOT_PENDING = 'Only a pending draft order can be actioned',
  DRAFT_NEEDS_CUSTOMER = 'Link this conversation to a customer before confirming',
  DRAFT_HAS_UNMATCHED_LINES = 'Resolve the unmatched items before confirming',

  SIMULATED = 'Simulated inbound message processed',
  NOT_CONFIGURED = 'WhatsApp is not connected for this organization',
  INVALID_SIGNATURE = 'Webhook signature verification failed',
  SEND_FAILED = 'WhatsApp refused the message',
  OUTSIDE_SESSION_WINDOW = 'The 24-hour window has closed; send an approved template instead',
}
