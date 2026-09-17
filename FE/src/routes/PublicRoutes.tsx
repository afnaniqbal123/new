import { lazy, type ComponentType } from 'react';

export interface PublicRoute {
  /** Relative path under the guest-only `AuthLayout` group, e.g. 'login'. */
  path: string;
  Component: ComponentType;
}

// Lazy per-page — code-split every page > 50KB (AGENTS.md § Performance Budget).
// AppRouters.tsx wraps every one of these in <Suspense>.
const LoginPage = lazy(() =>
  import('src/pages/auth/LoginPage').then((m) => ({ default: m.LoginPage }))
);
const SignupPage = lazy(() =>
  import('src/pages/auth/SignupPage').then((m) => ({ default: m.SignupPage }))
);
const ForgotPasswordPage = lazy(() =>
  import('src/pages/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage }))
);
const VerifySignupOtpPage = lazy(() =>
  import('src/pages/auth/VerifySignupOtpPage').then((m) => ({ default: m.VerifySignupOtpPage }))
);
const VerifyForgotPasswordOtpPage = lazy(() =>
  import('src/pages/auth/VerifyForgotPasswordOtpPage').then((m) => ({
    default: m.VerifyForgotPasswordOtpPage,
  }))
);
const ResetPasswordPage = lazy(() =>
  import('src/pages/auth/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage }))
);

/**
 * Every guest-only auth screen — `AppRouters.tsx` maps this into `<Route>`s
 * wrapped by `AuthRedirectRoute` (src/routes/AuthRedirectRoute.tsx), which
 * bounces an already-authenticated user off to their own role's home route.
 * Add a new auth-flow page by adding it here; no other file needs to change.
 */
export const PUBLIC_ROUTES: readonly PublicRoute[] = [
  { path: 'login', Component: LoginPage },
  { path: 'signup', Component: SignupPage },
  { path: 'forgot-password', Component: ForgotPasswordPage },
  { path: 'verify-signup-otp', Component: VerifySignupOtpPage },
  { path: 'verify-forgot-password-otp', Component: VerifyForgotPasswordOtpPage },
  { path: 'reset-password', Component: ResetPasswordPage },
];
