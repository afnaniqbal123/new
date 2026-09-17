export enum MESSAGE_DIRECTION {
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND',
}

export enum MESSAGE_TYPE {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  DOCUMENT = 'DOCUMENT',
  AUDIO = 'AUDIO',
  /** A pre-approved template, the only thing Meta lets you send unprompted. */
  TEMPLATE = 'TEMPLATE',
  /** Written by the system, not by a person — a digest or a reminder. */
  SYSTEM = 'SYSTEM',
}

export enum MESSAGE_STATUS {
  PENDING = 'PENDING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  FAILED = 'FAILED',
}

export enum CONVERSATION_STATUS {
  OPEN = 'OPEN',
  /** A draft order is waiting for someone to confirm it. */
  AWAITING_CONFIRMATION = 'AWAITING_CONFIRMATION',
  CLOSED = 'CLOSED',
}

/**
 * What happened to the AI's interpretation of a conversation.
 *
 * `PENDING` is the only state a draft is created in, without exception. The
 * model never produces a sale — a human confirms one. CONTEXT.md D9.
 */
export enum DRAFT_ORDER_STATUS {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  REJECTED = 'REJECTED',
  /** Superseded by a later message in the same conversation. */
  SUPERSEDED = 'SUPERSEDED',
}

/** The subject name for WhatsApp conversations in authorization rules. */
export const CONVERSATION_SUBJECT = 'Conversation';

/** The subject name for AI draft orders in authorization rules. */
export const DRAFT_ORDER_SUBJECT = 'DraftOrder';
