import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from 'src/mocks/server';
import { CommonRoutes } from 'src/constants/common';
import { renderWithProviders } from 'src/test/renderWithProviders';
import { useAuthStore } from 'src/stores/authStore';
import { Role } from 'src/routes/roles';
import { SettingsPage } from 'src/pages/common/SettingsPage';

function signInAs(role: Role) {
  useAuthStore.setState({
    user: {
      _id: 'u-1',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      role,
      status: 'ACTIVE',
      organization: 'org-1',
    },
    accessToken: 'token',
    hasHydrated: true,
  });
}

/**
 * The tax settings flow, which is the one on this page with real consequences:
 * the rate saved here prices every subsequent sale.
 *
 * Two things are worth proving and neither is a rendering detail. First, that
 * what the form sends is the shape the API's `TaxSettingsDto` accepts — a
 * nested `tax` object of whole-number percentages — because a silently-wrong
 * body would be accepted as a no-op patch and the rate would appear to save
 * while nothing changed. Second, that a role without the update permission
 * cannot submit at all: the API enforces that boundary too, but a screen that
 * lets a cashier type a new tax rate and then fails on save is a worse answer
 * than one that never offered.
 */
describe('Tax settings workflow', () => {
  afterEach(() => {
    useAuthStore.setState({ user: null, accessToken: null, refreshToken: null, hasHydrated: true });
  });

  it('sends the changed rate as a nested tax patch of whole percentages', async () => {
    signInAs(Role.OWNER);

    let received: unknown;
    server.use(
      http.patch(CommonRoutes.ORGANIZATION_CURRENT, async ({ request }) => {
        received = await request.json();

        return HttpResponse.json({ data: null, status: 200, message: 'Saved.' }, { status: 200 });
      })
    );

    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);

    const rate = await screen.findByLabelText('Default rate (%)');
    await user.clear(rate);
    await user.type(rate, '17');

    // Each panel saves independently, so the tax panel's own button is the one
    // under test — `within` the form that contains the field just edited.
    const taxForm = rate.closest('form');
    if (!taxForm) throw new Error('expected the rate field to sit inside a form');

    const saveButtons = await screen.findAllByRole('button', { name: 'Save' });
    const taxSave = saveButtons.find((button) => taxForm.contains(button));
    if (!taxSave) throw new Error('expected the tax form to have its own Save button');

    await user.click(taxSave);

    await waitFor(() => {
      expect(received).toEqual({
        tax: {
          registrationNumber: '',
          nationalTaxNumber: '',
          defaultRatePercent: 17,
          furtherTaxPercent: 3,
          withholdingPercent: 0,
          pricesIncludeTax: false,
        },
      });
    });
  });

  it('gives a cashier the figures to read but nothing to submit', async () => {
    signInAs(Role.CASHIER);

    renderWithProviders(<SettingsPage />);

    // The rate is still legible — "what tax are we on?" is a fair question.
    const rate = await screen.findByLabelText('Default rate (%)');
    expect(rate).toBeDisabled();
    expect(rate).toHaveValue('18');

    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(
      screen.getByText('Only an owner or admin can change these settings.')
    ).toBeInTheDocument();
  });
});
