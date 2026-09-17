import { useState, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from 'src/components/common/PageHeader';
import { Panel } from 'src/components/common/Panel';
import { Money } from 'src/components/common/Money';
import { Button } from 'src/components/common/Button';
import { Badge } from 'src/components/common/Badge';
import { Seo } from 'src/components/common/Seo';
import { useClerkStatus } from 'src/hooks/common/useBusinessData';
import { useAskClerk } from 'src/hooks/common/useBusinessMutations';
import type { ClerkAnswer } from 'src/schemas/common/business.schema';

const SUGGESTIONS = [
  'CLERK_SUGGESTION_1',
  'CLERK_SUGGESTION_2',
  'CLERK_SUGGESTION_3',
  'CLERK_SUGGESTION_4',
] as const;

/**
 * The AI Business Clerk.
 *
 * ## What is deliberately visible here
 *
 * The answer shows **which report it ran** alongside the figures. That is not
 * decoration: the model's only job is routing a question to one of a closed
 * set of reports, and the arithmetic is done by the same code the Reports
 * screen uses. Showing the source makes that checkable by the person reading
 * it — they can open the report and see the same numbers.
 *
 * The prose sits *below* the figures for the same reason. The numbers are the
 * answer; the sentence is a courtesy. Leading with the sentence would invite
 * reading it as the answer, and a model's sentence is the one part of this
 * screen that could be wrong.
 */
export function ClerkPage() {
  const { t } = useTranslation();
  const [question, setQuestion] = useState('');
  const { data: status } = useClerkStatus();
  const ask = useAskClerk();

  const configured = status?.configured ?? false;
  const answer = ask.data;

  function submit(event: SyntheticEvent) {
    event.preventDefault();

    if (!question.trim()) return;

    ask.mutate(question);
  }

  return (
    <div className="flex flex-col gap-4">
      <Seo title={t('CLERK_TITLE')} />
      <PageHeader title={t('CLERK_TITLE')} description={t('CLERK_INTRO')} />

      {!configured ? (
        <Panel title={t('CLERK_NOT_CONFIGURED')}>
          <p className="text-foreground-muted text-sm">{t('CLERK_NOT_CONFIGURED_HELP')}</p>
        </Panel>
      ) : null}

      <Panel>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label htmlFor="clerk-question" className="sr-only">
            {t('CLERK_PLACEHOLDER')}
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="clerk-question"
              value={question}
              onChange={(event) => {
                setQuestion(event.target.value);
              }}
              placeholder={t('CLERK_PLACEHOLDER')}
              disabled={!configured}
              className="border-border bg-surface text-foreground min-w-60 flex-1 rounded-md border px-3 py-2 text-sm"
            />
            <Button type="submit" disabled={!configured || ask.isPending}>
              {ask.isPending ? t('CLERK_THINKING') : t('CLERK_ASK')}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((key) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant="ghost"
                disabled={!configured}
                onClick={() => {
                  const text = t(key);
                  setQuestion(text);
                  ask.mutate(text);
                }}
              >
                {t(key)}
              </Button>
            ))}
          </div>
        </form>
      </Panel>

      {answer ? (
        answer.answerable && answer.report ? (
          <AnswerPanel
            report={answer.report}
            narrative={answer.narrative}
            kind={answer.reportKind}
          />
        ) : (
          <Panel>
            <p role="status" className="text-foreground-muted text-sm">
              {t('CLERK_CANNOT_ANSWER')}
            </p>
            {answer.reasoning ? (
              <p className="text-foreground-subtle mt-1 text-xs">{answer.reasoning}</p>
            ) : null}
          </Panel>
        )
      ) : null}
    </div>
  );
}

interface AnswerPanelProps {
  report: NonNullable<ClerkAnswer['report']>;
  narrative: string;
  kind: string | null;
}

/**
 * The answer.
 *
 * Extracted into its own component so the non-null `report` is narrowed once,
 * at the boundary, rather than re-checked inside every callback that reads it.
 */
function AnswerPanel({ report, narrative, kind }: AnswerPanelProps) {
  const { t } = useTranslation();

  return (
    <Panel
      title={report.period.label}
      action={<Badge tone="info">{t('CLERK_SOURCE', { report: kind ?? '' })}</Badge>}
    >
      {/* Figures first — these are computed, not generated. */}
      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Object.entries(report.summary).map(([key, value]) => (
          <div key={key} className="flex flex-col gap-1">
            <dt className="text-foreground-muted text-xs font-medium tracking-wide uppercase">
              {key.replace(/([A-Z])/g, ' $1')}
            </dt>
            <dd>
              {/count|orders|products|customers|days|percent|batches|suppliers|receipts|transactions/i.test(
                key
              ) ? (
                <span className="tabular text-foreground text-xl font-semibold">{value}</span>
              ) : (
                <Money amount={value} currency={report.currency} size="lg" />
              )}
            </dd>
          </div>
        ))}
      </dl>

      {/* Prose second, and only ever about the figures above. */}
      {narrative ? (
        <p className="border-border text-foreground mt-4 border-t pt-4 text-sm">{narrative}</p>
      ) : null}
    </Panel>
  );
}
