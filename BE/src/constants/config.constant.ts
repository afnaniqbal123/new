export enum CONFIG {
  NODE_ENV = 'NODE_ENV',
  OTP_SECRET = 'OTP_SECRET',
  JWT_SECRET = 'JWT_SECRET',
  MONGODB_URI = 'MONGODB_URI',
  FRONTEND_URL = 'FRONTEND_URL',
  TEMPLATES_PATH = 'TEMPLATES_PATH',

  EMAIL_SENDER = 'EMAIL_SENDER',
  EMAIL_SENDER_NAME = 'EMAIL_SENDER_NAME',

  EMAIL_LOGO_URL = 'EMAIL_LOGO_URL',

  GOOGLE_CLIENT_ID = 'GOOGLE_CLIENT_ID',
  GOOGLE_CLIENT_SECRET = 'GOOGLE_CLIENT_SECRET',

  AWS_ACCESS_KEY_ID = 'AWS_ACCESS_KEY_ID',
  AWS_REGION = 'AWS_REGION',
  AWS_SECRET_ACCESS_KEY = 'AWS_SECRET_ACCESS_KEY',
  AWS_BUCKET_NAME = 'AWS_BUCKET_NAME',
  AWS_EXPIRES_IN = 'AWS_EXPIRES_IN',

  // #region module:stripe
  STRIPE_SECRET_KEY = 'STRIPE_SECRET_KEY',
  STRIPE_WEBHOOK_SECRET = 'STRIPE_WEBHOOK_SECRET',
  // Needed by mobile clients (stripe-react-native PaymentSheet) — the mobile
  // SDK init call needs the publishable key returned from the backend rather
  // than baked into the app bundle.
  STRIPE_PUBLISHABLE_KEY = 'STRIPE_PUBLISHABLE_KEY',
  // #endregion module:stripe

  // --- Media storage -----------------------------------------------------
  // Selects which provider MediaService talks to. Both are implemented; the
  // deployer picks whichever account they actually have. See CONTEXT.md D11.
  MEDIA_PROVIDER = 'MEDIA_PROVIDER',
  CLOUDINARY_CLOUD_NAME = 'CLOUDINARY_CLOUD_NAME',
  CLOUDINARY_API_KEY = 'CLOUDINARY_API_KEY',
  CLOUDINARY_API_SECRET = 'CLOUDINARY_API_SECRET',
  CLOUDINARY_FOLDER = 'CLOUDINARY_FOLDER',

  // --- AI (Gemini) -------------------------------------------------------
  // The clerk degrades to an explicit "AI is not configured" response when the
  // key is absent, rather than failing a request. CONTEXT.md D8.
  AI_PROVIDER = 'AI_PROVIDER',
  GEMINI_API_KEY = 'GEMINI_API_KEY',
  GEMINI_MODEL = 'GEMINI_MODEL',

  // --- Queue -------------------------------------------------------------
  // Absent REDIS_URL, the queue module runs jobs in-process. Fine for local
  // development, not for more than one instance. CONTEXT.md D13.
  REDIS_URL = 'REDIS_URL',

  // --- WhatsApp Cloud API ------------------------------------------------
  // All optional: with none of them set, the ingestion pipeline still runs
  // end to end against the built-in simulator. CONTEXT.md D10.
  WHATSAPP_ACCESS_TOKEN = 'WHATSAPP_ACCESS_TOKEN',
  WHATSAPP_PHONE_NUMBER_ID = 'WHATSAPP_PHONE_NUMBER_ID',
  WHATSAPP_VERIFY_TOKEN = 'WHATSAPP_VERIFY_TOKEN',
  WHATSAPP_APP_SECRET = 'WHATSAPP_APP_SECRET',
  WHATSAPP_API_VERSION = 'WHATSAPP_API_VERSION',
}

// --- Access token (stateless JWT) ---------------------------------------
// Short by design: the access token carries authorization claims and is
// validated without a database read (ADR 0001), so a revoked or demoted
// account stays usable until it expires. Anything longer than ~15m makes
// that window a real risk. Long-lived continuity is the refresh session's
// job, not this token's.
export const ACCESS_TOKEN_VALIDITY = '15m';

// The trust-boundary claims every access token is signed with and verified
// against. Pinning the algorithm is what stops an `alg: none` / algorithm
// confusion attack; pinning issuer and audience stops a token minted for a
// different service from authenticating here.
export const JWT_ALGORITHM = 'HS256';
export const JWT_ISSUER = 'nestjs-backend';
export const JWT_AUDIENCE = 'nestjs-api';

// HS256 gives at most as much security as the secret has entropy. Anything
// shorter than this is brute-forceable offline, so the app refuses to boot.
export const JWT_SECRET_MIN_LENGTH = 32;

// --- Refresh session (stateful, opaque) ---------------------------------
// One source of truth: the string form is derived, so the lifetime advertised
// to clients cannot drift from the expiry actually written to the record.
export const REFRESH_TOKEN_VALIDITY_DAYS = 60;
export const REFRESH_TOKEN_VALIDITY = `${REFRESH_TOKEN_VALIDITY_DAYS}d`;
export const REFRESH_TOKEN_BYTES = 64;

// --- Password reset (stateful, opaque, single-use) ----------------------
export const PASSWORD_RESET_TOKEN_VALIDITY_MINUTES = 30;
export const PASSWORD_RESET_TOKEN_BYTES = 32;

// OTP Configuration
export const OTP_EXPIRY_MINUTES = 5; // OTP validity in minutes
export const OTP_LENGTH = 6; // OTP length
export const OTP_MAX_ATTEMPTS = 5; // Maximum OTP verification attempts
export const OTP_RESEND_COOLDOWN_SECONDS = 60; // Cooldown between OTP resend requests

// Feature Flags
export const USE_TOTP = true; // Set to true to use TOTP, false for simple secure OTP
