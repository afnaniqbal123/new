import { http, HttpResponse } from 'msw';
import { AuthRoutes } from 'src/constants/auth';
import { CommonRoutes } from 'src/constants/common';
import { Role } from 'src/routes/roles';
import type { AuthTokens, AuthUser } from 'src/types/auth';

/**
 * A mock API good enough to boot the app with no backend running.
 *
 * Deliberately **not** a second implementation of the domain. Auth is
 * simulated faithfully because the app's session handling depends on its
 * shape; the business endpoints return fixed, obviously-fake figures.
 *
 * Nothing here computes tax, prices a basket, or checks a credit limit — a
 * mock that did would be a second engine to keep in step with the real one,
 * and the moment they drifted the tests would be proving the mock correct.
 * That arithmetic is verified against the real backend instead.
 */

/**
 * No real backend to assign roles in dev, so mock it by email: an address
 * containing a role's own name (case-insensitive — e.g. admin@geeks.dev logs in
 * as Role.ADMIN) logs in as that role; anything else falls back to Role.OWNER.
 * Derived generically from `Role`'s actual members, not a hardcoded email
 * pattern per role — adding a role to `roles.ts` makes it reachable here for
 * free, with no matching edit required in this file (AGENTS.md's "adding a role
 * touches exactly three places" promise would otherwise have a silent fourth
 * place: this was previously a hardcoded admin-or-member binary with no path to
 * a third role in local dev). Lets a developer exercise every role locally with
 * zero setup.
 */
function demoUserFor(email: string): AuthUser {
  const lowerEmail = email.toLowerCase();
  const matchedRole = Object.values(Role).find((role) => lowerEmail.includes(role.toLowerCase()));
  return {
    _id: 'user-1',
    name: 'Demo User',
    email,
    phone: '+15555550100',
    role: matchedRole ?? Role.OWNER,
    status: 'ACTIVE',
  };
}

const DEMO_USER = demoUserFor('demo@geeks.dev');

let refreshCounter = 0;
function demoTokens(): AuthTokens {
  refreshCounter += 1;
  return {
    accessToken: `demo-access-token-${refreshCounter}`,
    refreshToken: `demo-refresh-token-${refreshCounter}`,
    expiresIn: '15m',
    refreshExpiresIn: '60d',
  };
}

/** Wraps a payload in the real backend's success envelope: `{ data, status, message }`. */
function envelope(data: unknown, message = 'Success.') {
  return HttpResponse.json({ data, status: 200, message });
}

const DEMO_ORGANIZATION = {
  _id: 'org-1',
  name: 'Kolachi Traders',
  slug: 'kolachi-traders',
  country: 'PK',
  currency: 'PKR',
  timezone: 'Asia/Karachi',
  status: 'ACTIVE',
  plan: 'BUSINESS',
  tax: {
    defaultRatePercent: 18,
    pricesIncludeTax: false,
    furtherTaxPercent: 3,
    withholdingPercent: 0,
  },
  invoice: { prefix: 'KT', nextNumber: 1, padding: 6 },
  settings: {
    allowNegativeStock: false,
    automationsEnabled: true,
    morningDigestHour: 9,
    eveningDigestHour: 20,
  },
  whatsapp: { connected: false, autoDraftOrders: true },
};

export const handlers = [
  // ---- Auth ----
  http.post(AuthRoutes.SIGNUP, async ({ request }) => {
    const { email } = (await request.json()) as { email: string };
    // Reserved address for the "email already registered" workflow-test scenario
    // — never a real signup a developer would type while running the app in dev.
    if (email === 'taken@example.com') {
      return HttpResponse.json(
        { message: 'An account with this email already exists.' },
        { status: 409 }
      );
    }
    return envelope(true, 'Account created.');
  }),
  http.post(AuthRoutes.VERIFY_SIGNUP_OTP, async ({ request }) => {
    const { email, otp } = (await request.json()) as { email: string; otp: string };
    // Reserved code for the "invalid/expired OTP" workflow-test scenario — never
    // a real code the backend would actually issue.
    if (otp === '000000') {
      return HttpResponse.json({ message: 'Invalid or expired code.' }, { status: 400 });
    }
    return envelope({ ...demoTokens(), user: demoUserFor(email) }, 'Account verified.');
  }),
  http.post(AuthRoutes.RESEND_SIGNUP_OTP, () => envelope(true, 'Code resent.')),
  http.post(AuthRoutes.LOGIN, async ({ request }) => {
    const { email, password } = (await request.json()) as { email: string; password: string };
    // Reserved password for the "invalid credentials" workflow-test scenario —
    // never a real password a developer would type while running the app in dev.
    if (password === 'wrongpassword') {
      return HttpResponse.json({ message: 'Invalid email or password.' }, { status: 401 });
    }
    return envelope(
      { ...demoTokens(), user: demoUserFor(email) },
      'Your account has been logged in successfully.'
    );
  }),
  // Rotates on every call, mirroring the real backend's refresh-token behavior.
  http.post(AuthRoutes.REFRESH_TOKEN, () => envelope(demoTokens())),
  http.post(AuthRoutes.FORGOT_PASSWORD, async ({ request }) => {
    const { email } = (await request.json()) as { email: string };
    // Reserved address for the "server error" workflow-test scenario — same
    // convention as SIGNUP's 'taken@example.com' above.
    if (email === 'error@example.com') {
      return HttpResponse.json({ message: 'Internal server error.' }, { status: 500 });
    }
    return envelope(true, 'Code sent.');
  }),
  http.post(AuthRoutes.VERIFY_FORGOT_PASSWORD_OTP, () =>
    envelope({ resetToken: 'demo-reset-token' })
  ),
  http.post(AuthRoutes.FORGOT_PASSWORD_LINK, () => envelope(true, 'Link sent.')),
  http.post(AuthRoutes.VERIFY_RESET_PASSWORD, async ({ request }) => {
    const { token } = (await request.json()) as { token: string };
    // Reserved token for the "invalid/expired reset token" workflow-test scenario.
    if (token === 'invalid-token') {
      return HttpResponse.json({ message: 'Invalid or expired token.' }, { status: 400 });
    }
    return envelope(true, 'Password reset.');
  }),
  http.post(AuthRoutes.APPLE_CALLBACK, () => envelope({ ...demoTokens(), user: DEMO_USER })),
  http.get(AuthRoutes.ME, () => envelope(DEMO_USER)),
  http.post(AuthRoutes.CHANGE_PASSWORD, () => envelope(true, 'Password changed.')),
  http.post(AuthRoutes.LOGOUT, () => new HttpResponse(null, { status: 204 })),
  http.post(AuthRoutes.LOGOUT_ALL_DEVICES, () => new HttpResponse(null, { status: 204 })),
  http.get(AuthRoutes.ACTIVE_SESSIONS, () =>
    envelope([
      {
        _id: 'session-1',
        deviceInfo: 'Chrome on macOS',
        ipAddress: '127.0.0.1',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ])
  ),

  // ---- BusinessOS ----------------------------------------------------
  //
  // Enough of the real API to let the app boot, render, and pass its browser
  // smoke test with no backend running. Deliberately *not* a second
  // implementation of the domain: these return fixed, obviously-fake figures.
  // Anything that needs real arithmetic — pricing, tax, credit — is tested
  // against the real backend, because a mock that computed tax would be a
  // second tax engine to keep in step with the first.
  http.get(CommonRoutes.ORGANIZATION_CURRENT, () => envelope(DEMO_ORGANIZATION)),
  // The real endpoint returns the whole updated organization, not just the
  // patched fields — a workflow test asserting on what the screen shows after
  // a save depends on that, so the mock merges rather than echoing the body.
  http.patch(CommonRoutes.ORGANIZATION_CURRENT, async ({ request }) => {
    const patch = (await request.json()) as {
      tax?: Record<string, unknown>;
      invoice?: Record<string, unknown>;
      settings?: Record<string, unknown>;
    };

    return envelope({
      ...DEMO_ORGANIZATION,
      ...patch,
      tax: { ...DEMO_ORGANIZATION.tax, ...patch.tax },
      invoice: { ...DEMO_ORGANIZATION.invoice, ...patch.invoice },
      settings: { ...DEMO_ORGANIZATION.settings, ...patch.settings },
    });
  }),
  http.post(CommonRoutes.ORGANIZATION_LOCATIONS, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;

    return envelope({ _id: 'loc-2', isDefault: false, isActive: true, ...body }, 'Location added.');
  }),
  http.get(CommonRoutes.DASHBOARD, () =>
    envelope({
      today: { revenue: 43_20_00, count: 12, profit: 12_30_00, collected: 40_00_00 },
      month: { revenue: 5_26_74_809, count: 104, profit: 1_60_54_609 },
      receivables: 1_27_46_572,
      payables: 6_65_09_400,
      stockValue: 2_13_39_200,
      lowStockCount: 4,
      currency: 'PKR',
      lowStock: [
        {
          id: 'p-1',
          name: 'Dalda Cooking Oil 5L',
          sku: 'DALDA-5L',
          stockOnHand: 6,
          reorderLevel: 12,
        },
      ],
      recentSales: [],
      salesByDay: Array.from({ length: 30 }, (_, index) => ({
        date: new Date(Date.now() - (29 - index) * 86_400_000).toISOString().slice(0, 10),
        revenue: 1_00_000 + index * 7_000,
        count: 2 + (index % 5),
      })),
    })
  ),
  http.get(CommonRoutes.PRODUCTS, () =>
    envelope({
      items: [
        {
          _id: 'p-1',
          name: 'Coca-Cola 1.5L',
          sku: 'COKE-1500',
          unit: 'btl',
          packSize: 12,
          sellingPrice: 15_000,
          taxTreatment: 'STANDARD',
          taxRatePercent: null,
          stockOnHand: 144,
          reorderLevel: 48,
          reorderQuantity: 96,
          trackStock: true,
          trackBatches: false,
          status: 'ACTIVE',
        },
      ],
      total: 1,
      page: 1,
      limit: 25,
    })
  ),
  http.get(CommonRoutes.CUSTOMERS, () => envelope({ items: [], total: 0, page: 1, limit: 25 })),
  http.get(CommonRoutes.SALES, () => envelope({ items: [], total: 0, page: 1, limit: 25 })),
  http.get(CommonRoutes.SUPPLIERS, () => envelope({ items: [], total: 0, page: 1, limit: 25 })),
  http.get(CommonRoutes.CATEGORIES, () => envelope([])),
  http.get(CommonRoutes.ORGANIZATION_LOCATIONS, () =>
    envelope([
      {
        _id: 'loc-1',
        name: 'Main',
        code: 'MAIN',
        type: 'WAREHOUSE',
        isDefault: true,
        isActive: true,
      },
    ])
  ),
  http.get(CommonRoutes.ORGANIZATION_MEMBERS, () => envelope([])),
  http.get(CommonRoutes.CUSTOMERS_AGING, () => envelope([])),
  http.get(CommonRoutes.PRODUCTS_LOW_STOCK, () => envelope([])),
  http.get(CommonRoutes.STOCK_LEDGER, () => envelope({ items: [], total: 0 })),
  http.get(CommonRoutes.PURCHASE_ORDERS, () => envelope([])),
  http.get(CommonRoutes.PURCHASE_SUGGESTIONS, () => envelope([])),
  http.get(CommonRoutes.CONVERSATIONS, () => envelope([])),
  http.get(CommonRoutes.DRAFT_ORDERS, () => envelope([])),
  http.get(CommonRoutes.WHATSAPP_BADGES, () => envelope({ unread: 0, pendingDrafts: 0 })),
  http.get(CommonRoutes.CLERK_STATUS, () => envelope({ configured: false })),
  http.get(CommonRoutes.REPORT_KINDS, () => envelope(['SALES_SUMMARY', 'LOW_STOCK'])),
  http.get(CommonRoutes.AUTOMATIONS, () => envelope([])),
  http.get(CommonRoutes.BILLING_PLANS, () => envelope([])),
  http.get(CommonRoutes.BILLING_SUBSCRIPTION, () =>
    envelope({
      plan: 'BUSINESS',
      renewsAt: null,
      hasStripeSubscription: false,
      billingConfigured: false,
      limits: {
        users: 10,
        products: null,
        locations: null,
        salesPerMonth: null,
        whatsapp: true,
        aiClerk: true,
        automations: true,
      },
    })
  ),
];
