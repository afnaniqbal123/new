export enum AI_RESPONSE {
  ANSWERED = 'Question answered successfully',
  PARSED = 'Message parsed successfully',
  NOT_CONFIGURED = 'The AI assistant is not configured. Add a GEMINI_API_KEY to enable it.',
  NOT_ANSWERABLE = 'I can’t answer that from the reports available',
  STATUS_FETCHED = 'Assistant status fetched successfully',
}
