import { useMutation, useQuery, type UseQueryResult } from '@tanstack/react-query';
import { QueryKey } from 'src/constants/queryKeys';
import {
  assistantService,
  type AssistantAnswer,
  type AssistantStatus,
} from 'src/services/common/assistantService';

/**
 * The marketing-page assistant.
 *
 * `meta: { skipErrorToast: true }` on the ask: the widget renders its own
 * failure inside the conversation, and a global toast sliding over a landing
 * page because a model timed out is the wrong register entirely.
 */
export function useAssistantStatus(): UseQueryResult<AssistantStatus> {
  return useQuery({
    queryKey: [QueryKey.ASSISTANT_STATUS],
    queryFn: () => assistantService.status(),
    // Whether a key is configured cannot change while the page is open.
    staleTime: Infinity,
    retry: false,
  });
}

export function useAskAssistant() {
  return useMutation<AssistantAnswer, Error, string>({
    mutationFn: (question: string) => assistantService.ask(question),
    meta: { skipErrorToast: true },
  });
}
