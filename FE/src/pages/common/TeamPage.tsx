import { useState, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { MEMBER_STATUS_LABEL, ROLE_HELP_LABEL, ROLE_LABEL } from 'src/constants/labels';
import { PageHeader } from 'src/components/common/PageHeader';
import { Panel } from 'src/components/common/Panel';
import { Badge } from 'src/components/common/Badge';
import { Button } from 'src/components/common/Button';
import { Input } from 'src/components/common/Input';
import { ConfirmDialog } from 'src/components/common/ConfirmDialog';
import { Seo } from 'src/components/common/Seo';
import { DataTable, type DataTableColumn } from 'src/components/common/DataTable';
import { useTeam } from 'src/hooks/common/useBusinessData';
import { useInviteMember, useUpdateMember } from 'src/hooks/common/useBusinessMutations';
import { ROLES_IN_ORDER, Role } from 'src/routes/roles';
import { useAuthStore } from 'src/stores/authStore';
import type { TeamMember } from 'src/schemas/common/business.schema';

/** Roles the API's `ORGANIZATION_SUBJECT` manage permission actually grants —
 *  same boundary `SettingsPage.tsx` enforces for the same subject. */
const EDITOR_ROLES: readonly string[] = [Role.OWNER, Role.ADMIN];

/**
 * Who works here, and what each of them may do.
 *
 * The role list below the table is not filler: "why can't the cashier see
 * purchase prices?" is the single most common question a new BusinessOS
 * owner asks, and answering it in place beats answering it in support.
 */
export function TeamPage() {
  const { t } = useTranslation();
  const { data, isPending } = useTeam();
  const role = useAuthStore((state) => state.user?.role);
  const canManage = Boolean(role && EDITOR_ROLES.includes(role));

  const updateMember = useUpdateMember();

  const columns: DataTableColumn<TeamMember>[] = [
    {
      id: 'name',
      header: t('CUSTOMERS_NAME'),
      cell: (member) => (
        <div className="min-w-0">
          <p className="text-foreground truncate font-medium">{member.name}</p>
          <p className="text-foreground-subtle truncate text-xs">{member.email}</p>
        </div>
      ),
    },
    {
      id: 'role',
      header: t('TEAM_ROLE'),
      cell: (member) => <Badge tone="brand">{t(ROLE_LABEL[member.role] ?? 'ROLE_VIEWER')}</Badge>,
    },
    {
      id: 'status',
      header: t('TEAM_STATUS'),
      cell: (member) => (
        <Badge tone={member.status === 'ACTIVE' ? 'success' : 'neutral'}>
          {t(MEMBER_STATUS_LABEL[member.status] ?? 'STATUS_ACTIVE')}
        </Badge>
      ),
    },
    ...(canManage
      ? [
          {
            id: 'actions',
            header: t('TEAM_ACTIONS'),
            cell: (member: TeamMember) =>
              member.status === 'ACTIVE' ? (
                <ConfirmDialog
                  trigger={
                    <Button type="button" variant="danger" size="sm">
                      {t('TEAM_DEACTIVATE')}
                    </Button>
                  }
                  title={t('TEAM_DEACTIVATE_CONFIRM_TITLE', { name: member.name })}
                  description={t('TEAM_DEACTIVATE_CONFIRM_BODY')}
                  onConfirm={() => {
                    updateMember.mutate({ id: member._id, isActive: false });
                  }}
                />
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={updateMember.isPending}
                  onClick={() => {
                    updateMember.mutate({ id: member._id, isActive: true });
                  }}
                >
                  {t('TEAM_REACTIVATE')}
                </Button>
              ),
          } satisfies DataTableColumn<TeamMember>,
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <Seo title={t('TEAM_TITLE')} />
      <PageHeader title={t('TEAM_TITLE')} />

      <Panel flush>
        <DataTable
          columns={columns}
          rows={data ?? []}
          getRowId={(member) => member._id}
          isLoading={isPending}
          emptyMessage={t('TEAM_EMPTY')}
          caption={t('TEAM_TITLE')}
        />
      </Panel>

      {canManage ? <InviteMemberPanel /> : null}

      <Panel title={t('TEAM_ROLE')}>
        <dl className="grid gap-3 sm:grid-cols-2">
          {ROLES_IN_ORDER.map((teamRole) => (
            <div key={teamRole} className="flex flex-col gap-1">
              <dt>
                <Badge tone="neutral">{t(ROLE_LABEL[teamRole] ?? 'ROLE_VIEWER')}</Badge>
              </dt>
              <dd className="text-foreground-muted text-sm">
                {t(ROLE_HELP_LABEL[teamRole] ?? 'ROLE_VIEWER_HELP')}
              </dd>
            </div>
          ))}
        </dl>
      </Panel>
    </div>
  );
}

/**
 * The invite form.
 *
 * Kept as its own component so its local `useState` fields don't sit beside
 * `TeamPage`'s table/permission concerns — same split `LocationsPanel.tsx`
 * uses for its own inline "add one" form.
 */
function InviteMemberPanel() {
  const { t } = useTranslation();
  const invite = useInviteMember();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [inviteRole, setInviteRole] = useState<string>(Role.VIEWER);

  function submit(event: SyntheticEvent) {
    event.preventDefault();

    invite.mutate(
      { name, email, phone, role: inviteRole },
      {
        onSuccess: () => {
          setName('');
          setEmail('');
          setPhone('');
          setInviteRole(Role.VIEWER);
        },
      }
    );
  }

  return (
    <Panel title={t('TEAM_INVITE_TITLE')}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <p className="text-foreground-subtle text-sm">{t('TEAM_INVITE_HINT')}</p>

        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            label={t('CUSTOMERS_NAME')}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
            required
          />
          <Input
            label={t('SETTINGS_EMAIL')}
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
            required
          />
          <Input
            label={t('SETTINGS_PHONE')}
            value={phone}
            onChange={(event) => {
              setPhone(event.target.value);
            }}
            inputMode="tel"
            required
          />
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex w-48 flex-col gap-1">
            <label htmlFor="invite-role" className="text-foreground text-sm font-medium">
              {t('TEAM_ROLE')}
            </label>
            <select
              id="invite-role"
              value={inviteRole}
              onChange={(event) => {
                setInviteRole(event.target.value);
              }}
              className="border-border bg-surface text-foreground rounded-md border px-3 py-2 text-sm"
            >
              {ROLES_IN_ORDER.map((option) => (
                <option key={option} value={option}>
                  {t(ROLE_LABEL[option] ?? 'ROLE_VIEWER')}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={invite.isPending}>
            {invite.isPending ? t('LOADING') : t('TEAM_INVITE_SUBMIT')}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
