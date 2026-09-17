import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from 'src/components/common/Icon';
import { useAskAssistant, useAssistantStatus } from 'src/hooks/common/useAssistant';

interface Turn {
  id: number;
  role: 'visitor' | 'assistant';
  text: string;
}

/**
 * The assistant that floats over the marketing page.
 *
 * ## What it will and will not answer
 *
 * Questions about the product, from a fixed knowledge base held on the server
 * (`ProductAssistantService`). It has no account, no organization and no
 * access to anyone's figures — which is what makes it safe to expose to an
 * anonymous visitor. Ask it "how much do I owe?" and it will tell you about
 * the credit feature, because that is all it can see.
 *
 * ## Why it still works without a key
 *
 * With `GEMINI_API_KEY` set, the model rephrases the relevant facts to fit the
 * question asked. Without one, the server returns the best-matching curated
 * answer verbatim. Both are real answers — a public widget that says "AI not
 * configured" is worse than no widget, so that state does not exist here.
 *
 * ## Behaviour worth keeping
 *
 * Escape closes it, focus moves to the input on open, and the transcript
 * scrolls to the newest turn. The panel is a `dialog`-roled region rather than
 * a Radix modal on purpose: it must not trap focus or block the page behind
 * it — a visitor should be able to keep reading while it is open.
 */
export function AssistantWidget() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  const { data: status } = useAssistantStatus();
  const ask = useAskAssistant();

  const suggestions = status?.suggestions ?? [];

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    const node = transcriptRef.current;

    if (node) node.scrollTop = node.scrollHeight;
  }, [turns, ask.isPending]);

  function send(question: string) {
    const trimmed = question.trim();

    if (trimmed.length < 3 || ask.isPending) return;

    setDraft('');
    setTurns((current) => [...current, { id: Date.now(), role: 'visitor', text: trimmed }]);

    ask.mutate(trimmed, {
      onSuccess: (result) => {
        setTurns((current) => [
          ...current,
          { id: Date.now() + 1, role: 'assistant', text: result.answer },
        ]);
      },
      onError: () => {
        setTurns((current) => [
          ...current,
          { id: Date.now() + 1, role: 'assistant', text: t('ASSISTANT_ERROR') },
        ]);
      },
    });
  }

  return (
    <>
      {/* --- Launcher --- */}
      <button
        type="button"
        onClick={() => {
          setOpen((current) => !current);
        }}
        aria-expanded={open}
        aria-label={open ? t('ASSISTANT_CLOSE') : t('ASSISTANT_OPEN')}
        className="bg-brand-600 text-foreground-inverted hover:bg-brand-700 focus-visible:ring-brand-500 shadow-overlay fixed right-4 bottom-4 z-50 flex size-14 items-center justify-center rounded-full transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none sm:right-6 sm:bottom-6"
      >
        <Icon name={open ? 'close' : 'sparkles'} className="size-6" />
      </button>

      {/* --- Panel --- */}
      {open ? (
        <div
          role="dialog"
          aria-label={t('ASSISTANT_TITLE')}
          className="border-border bg-surface-raised shadow-overlay animate-fade-up max-h-assistant-panel fixed inset-x-4 bottom-20 z-50 flex max-w-sm flex-col overflow-hidden rounded-2xl border sm:inset-x-auto sm:right-6 sm:bottom-24 sm:w-full"
        >
          <header className="border-border bg-surface-muted flex items-center gap-3 border-b px-4 py-3">
            <span className="bg-brand-500/15 text-brand-600 flex size-9 shrink-0 items-center justify-center rounded-full">
              <Icon name="sparkles" className="size-4.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-foreground block truncate text-sm font-semibold">
                {t('ASSISTANT_TITLE')}
              </span>
              <span className="text-foreground-subtle block truncate text-xs">
                {t('ASSISTANT_SUBTITLE')}
              </span>
            </span>
          </header>

          <div ref={transcriptRef} className="flex-1 overflow-y-auto px-4 py-4">
            {turns.length === 0 ? (
              <p className="text-foreground-muted text-sm">{t('ASSISTANT_GREETING')}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {turns.map((turn) => (
                  <li
                    key={turn.id}
                    className={turn.role === 'visitor' ? 'flex justify-end' : 'flex justify-start'}
                  >
                    <span
                      className={`max-w-11/12 rounded-2xl px-3.5 py-2.5 text-sm ${
                        turn.role === 'visitor'
                          ? 'bg-brand-600 text-foreground-inverted rounded-br-sm'
                          : 'bg-surface-muted text-foreground rounded-bl-sm'
                      }`}
                    >
                      {turn.text}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {ask.isPending ? (
              <p
                role="status"
                className="text-foreground-subtle mt-3 flex items-center gap-1.5 text-sm"
              >
                <span className="bg-brand-500 animate-typing size-1.5 rounded-full" />
                <span className="bg-brand-500 animate-typing animation-delay-150 size-1.5 rounded-full" />
                <span className="bg-brand-500 animate-typing animation-delay-300 size-1.5 rounded-full" />
              </p>
            ) : null}

            {turns.length === 0 && suggestions.length > 0 ? (
              <ul className="mt-4 flex flex-col gap-2">
                {suggestions.map((suggestion) => (
                  <li key={suggestion}>
                    <button
                      type="button"
                      onClick={() => {
                        send(suggestion);
                      }}
                      className="border-border text-foreground-muted hover:border-brand-500 hover:text-brand-600 w-full rounded-lg border px-3 py-3 text-left text-sm transition-colors"
                    >
                      {suggestion}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <form
            className="border-border flex items-center gap-2 border-t p-3"
            onSubmit={(event: SyntheticEvent) => {
              event.preventDefault();
              send(draft);
            }}
          >
            <input
              ref={inputRef}
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
              }}
              placeholder={t('ASSISTANT_PLACEHOLDER')}
              aria-label={t('ASSISTANT_PLACEHOLDER')}
              maxLength={300}
              className="border-border bg-surface text-foreground placeholder:text-foreground-subtle focus:border-brand-500 min-w-0 flex-1 rounded-lg border px-3 py-3 text-sm focus:outline-none"
            />
            <button
              type="submit"
              disabled={ask.isPending || draft.trim().length < 3}
              aria-label={t('ASSISTANT_SEND')}
              className="bg-brand-600 text-foreground-inverted hover:bg-brand-700 flex size-11 shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-40"
            >
              <Icon name="arrowRight" className="size-4" />
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}
