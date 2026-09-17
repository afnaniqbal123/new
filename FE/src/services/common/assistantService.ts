import { z } from 'zod';
import { apiClient } from 'src/services/api-client';
import { CommonRoutes } from 'src/constants/common';

/**
 * The marketing-page assistant's API client.
 *
 * Separate from `businessService` because it is the one call in the app that
 * is **deliberately unauthenticated** — it answers questions about the product
 * for a visitor who has no account. Keeping it in its own file means nobody
 * adds a tenant-scoped method next to it by habit.
 */

const envelopeShape = z.object({ data: z.unknown() }).loose();

const answerSchema = z.object({
  answer: z.string(),
  /** True when a model wrote the prose; false when it is the curated sentence. */
  generated: z.boolean(),
  suggestions: z.array(z.string()),
});

const statusSchema = z.object({
  configured: z.boolean(),
  suggestions: z.array(z.string()),
});

export type AssistantAnswer = z.infer<typeof answerSchema>;
export type AssistantStatus = z.infer<typeof statusSchema>;

export const assistantService = {
  async status(): Promise<AssistantStatus> {
    // Typed `unknown` at the boundary rather than letting axios' default
    // `any` through — the Zod parse below is what actually establishes the
    // shape, and an `any` sliding past it would defeat the point of parsing.
    const response = await apiClient.get<unknown>(CommonRoutes.ASSISTANT_STATUS);

    return statusSchema.parse(envelopeShape.parse(response.data).data);
  },

  async ask(question: string): Promise<AssistantAnswer> {
    const response = await apiClient.post<unknown>(CommonRoutes.ASSISTANT_ASK, { question });

    return answerSchema.parse(envelopeShape.parse(response.data).data);
  },
};
