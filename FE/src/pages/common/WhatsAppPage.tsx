import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CONFIDENCE_LABEL, CONFIDENCE_TONE } from 'src/constants/labels';
import { PageHeader } from 'src/components/common/PageHeader';
import { Panel } from 'src/components/common/Panel';
import { Badge } from 'src/components/common/Badge';
import { Button } from 'src/components/common/Button';
import { Input } from 'src/components/common/Input';
import { EmptyState } from 'src/components/common/EmptyState';
import { Seo } from 'src/components/common/Seo';
import {
  useConversationMessages,
  useConversations,
  useDraftOrders,
  useOrganization,
} from 'src/hooks/common/useBusinessData';
import {
  useConfirmDraftOrder,
  useRejectDraftOrder,
  useSendWhatsAppMessage,
  useSimulateInbound,
} from 'src/hooks/common/useBusinessMutations';
import { formatQuantity } from 'src/utils/money';
import { refName } from 'src/schemas/common/business.schema';

/**
 * The WhatsApp inbox, and the orders it produces.
 *
 * ## Why the simulator is a first-class part of this screen
 *
 * Connecting a real WhatsApp number needs a Meta Business account, a verified
 * business and template approval — days of waiting that have nothing to do
 * with whether the feature works. The simulator posts through the *real*
 * ingestion pipeline server-side, so a business can see their own orders being
 * read and confirmed before they have a number at all. CONTEXT.md D10.
 *
 * ## Why every draft needs a human
 *
 * The AI's reading of a message is a proposal with no prices on it. Confirming
 * hands the lines to the same sale path the counter uses, which prices, taxes
 * and credit-checks them. The confirm screen's job is to make a wrong match
 * obvious — hence showing what the customer *wrote* next to what was matched,
 * and flagging low-confidence lines rather than hiding the uncertainty.
 */
export function WhatsAppPage() {
  const { t } = useTranslation();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [simPhone, setSimPhone] = useState('+92 300 1234567');
  const [simText, setSimText] = useState('');

  const { data: organization } = useOrganization();
  const { data: conversations } = useConversations();
  const { data: drafts } = useDraftOrders('PENDING');
  const { data: messages } = useConversationMessages(activeId ?? undefined);

  const sendMessage = useSendWhatsAppMessage();
  const simulate = useSimulateInbound();
  const confirmDraft = useConfirmDraftOrder();
  const rejectDraft = useRejectDraftOrder();

  const connected = organization?.whatsapp.connected ?? false;
  const active = conversations?.find((conversation) => conversation._id === activeId);

  return (
    <div className="flex flex-col gap-4">
      <Seo title={t('WHATSAPP_TITLE')} />
      <PageHeader
        title={t('WHATSAPP_TITLE')}
        actions={
          <Badge tone={connected ? 'success' : 'warning'}>
            {connected ? t('STATUS_ACTIVE') : t('WHATSAPP_NOT_CONNECTED')}
          </Badge>
        }
      />

      {!connected ? (
        <Panel>
          <p className="text-foreground-muted text-sm">{t('WHATSAPP_NOT_CONNECTED_HELP')}</p>
        </Panel>
      ) : null}

      {/* --- Orders waiting for a human ------------------------------- */}
      {drafts && drafts.length > 0 ? (
        <Panel title={t('WHATSAPP_DRAFTS')}>
          <ul className="flex flex-col gap-4">
            {drafts.map((draft) => (
              <li key={draft._id} className="border-border rounded-lg border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-foreground text-sm font-medium">
                      {t('DRAFT_FROM', {
                        name: refName(draft.customer) || t('WHATSAPP_UNKNOWN_NUMBER'),
                      })}
                    </p>
                    {draft.summary ? (
                      <p className="text-foreground-muted text-xs">{draft.summary}</p>
                    ) : null}
                  </div>
                  <Badge tone="info">{t('DRAFT_AI_NOTE')}</Badge>
                </div>

                <ul className="mt-3 flex flex-col gap-2">
                  {draft.lines.map((line, index) => (
                    <li
                      key={`${line.requestedText}-${String(index)}`}
                      className="bg-surface-muted flex flex-wrap items-center justify-between gap-2 rounded-md px-3 py-2"
                    >
                      <div className="min-w-0">
                        {/* What they wrote, verbatim — never paraphrased. */}
                        <p className="text-foreground-muted text-xs italic">
                          “{line.requestedText}”
                        </p>
                        <p className="text-foreground text-sm font-medium">
                          {line.productName || t('DRAFT_UNMATCHED')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="tabular text-sm">×{formatQuantity(line.quantity)}</span>
                        <Badge tone={CONFIDENCE_TONE[line.confidence] ?? 'neutral'}>
                          {t(CONFIDENCE_LABEL[line.confidence] ?? 'CONFIDENCE_LOW')}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>

                {draft.unmatched.length > 0 ? (
                  <p role="alert" className="text-warning mt-2 text-xs">
                    {t('DRAFT_UNMATCHED')}: {draft.unmatched.join(', ')}
                  </p>
                ) : null}

                <div className="mt-3 flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      confirmDraft.mutate({ id: draft._id });
                    }}
                    disabled={confirmDraft.isPending}
                  >
                    {t('DRAFT_CONFIRM')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      rejectDraft.mutate({ id: draft._id });
                    }}
                    disabled={rejectDraft.isPending}
                  >
                    {t('DRAFT_REJECT')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <div className="lg:grid-cols-inbox grid gap-4">
        {/* --- Conversation list --- */}
        <Panel title={t('WHATSAPP_INBOX')} flush>
          {!conversations || conversations.length === 0 ? (
            <div className="p-4">
              <EmptyState title={t('WHATSAPP_NO_CONVERSATIONS')} />
            </div>
          ) : (
            <ul className="divide-border divide-y">
              {conversations.map((conversation) => (
                <li key={conversation._id}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveId(conversation._id);
                    }}
                    aria-current={conversation._id === activeId}
                    className={`hover:bg-surface-muted flex w-full flex-col gap-1 px-4 py-3 text-left ${
                      conversation._id === activeId ? 'bg-surface-muted' : ''
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-foreground truncate text-sm font-medium">
                        {refName(conversation.customer) ||
                          conversation.contactName ||
                          conversation.phone}
                      </span>
                      {conversation.unreadCount > 0 ? (
                        <Badge tone="brand">{conversation.unreadCount}</Badge>
                      ) : null}
                    </span>
                    <span className="text-foreground-subtle truncate text-xs">
                      {conversation.lastMessagePreview ?? ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* --- Thread --- */}
        <div className="flex flex-col gap-4">
          <Panel
            title={
              active
                ? refName(active.customer) || active.contactName || active.phone
                : t('WHATSAPP_SELECT_CONVERSATION')
            }
            flush
          >
            {!activeId ? (
              <div className="p-4">
                <EmptyState title={t('WHATSAPP_SELECT_CONVERSATION')} />
              </div>
            ) : (
              <>
                <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto p-4">
                  {(messages ?? []).map((message) => (
                    <li
                      key={message._id}
                      className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                        message.direction === 'INBOUND'
                          ? 'bg-surface-muted text-foreground self-start'
                          : 'bg-brand-600 self-end text-white'
                      }`}
                    >
                      <p>{message.text}</p>
                      <p
                        className={`mt-1 text-[0.65rem] ${
                          message.direction === 'INBOUND'
                            ? 'text-foreground-subtle'
                            : 'text-brand-100'
                        }`}
                      >
                        {new Date(message.createdAt).toLocaleTimeString()}
                        {message.simulated ? ' · sim' : ''}
                      </p>
                    </li>
                  ))}
                </ul>

                <form
                  className="border-border flex gap-2 border-t p-3"
                  onSubmit={(event) => {
                    event.preventDefault();

                    if (!reply.trim()) return;

                    sendMessage.mutate(
                      { id: activeId, text: reply },
                      {
                        onSuccess: () => {
                          setReply('');
                        },
                      }
                    );
                  }}
                >
                  <input
                    value={reply}
                    onChange={(event) => {
                      setReply(event.target.value);
                    }}
                    aria-label={t('WHATSAPP_REPLY_PLACEHOLDER')}
                    placeholder={t('WHATSAPP_REPLY_PLACEHOLDER')}
                    className="border-border bg-surface text-foreground flex-1 rounded-md border px-3 py-2 text-sm"
                  />
                  <Button type="submit" disabled={sendMessage.isPending}>
                    {t('WHATSAPP_SEND')}
                  </Button>
                </form>
              </>
            )}
          </Panel>

          {/* --- Simulator --- */}
          <Panel title={t('WHATSAPP_SIMULATE')}>
            <p className="text-foreground-muted mb-3 text-sm">{t('WHATSAPP_SIMULATE_HELP')}</p>
            <form
              className="flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault();

                if (!simText.trim()) return;

                simulate.mutate(
                  { phone: simPhone, text: simText },
                  {
                    onSuccess: () => {
                      setSimText('');
                    },
                  }
                );
              }}
            >
              <Input
                label={t('WHATSAPP_SIMULATE_PHONE')}
                value={simPhone}
                onChange={(event) => {
                  setSimPhone(event.target.value);
                }}
              />
              <Input
                label={t('WHATSAPP_SIMULATE_TEXT')}
                value={simText}
                onChange={(event) => {
                  setSimText(event.target.value);
                }}
                placeholder="Need 20 boxes of A4 paper and 10 blue pens"
              />
              <div>
                <Button type="submit" disabled={simulate.isPending}>
                  {simulate.isPending ? t('LOADING') : t('WHATSAPP_SIMULATE')}
                </Button>
              </div>
            </form>
          </Panel>
        </div>
      </div>
    </div>
  );
}
