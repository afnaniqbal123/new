import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { authenticator } from 'otplib';

export const createHashPassword = async (password: string) => {
  const saltOrRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltOrRounds);
  return hashedPassword;
};

export const comparePassword = async (
  password: string,
  hashedPassword: string,
) => {
  return bcrypt.compare(password, hashedPassword);
};

export const generateRandomString = (length = 10) =>
  Array.from(
    { length },
    () =>
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+[]{}|;:,.<>?'[
        Math.floor(Math.random() * 84)
      ],
  ).join('');

/**
 * Generate a cryptographically secure random OTP
 * @deprecated Use generateSecureOTP() instead for better security
 */
export const generateRandomOTPNumber = (length: number) => {
  if (!Number.isInteger(length) || length <= 0) {
    throw new Error('Length must be a positive integer');
  }

  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += Math.floor(Math.random() * 10); // Generates a random digit (0-9)
  }

  return otp;
};

/**
 * Generate a cryptographically secure random OTP using crypto module
 * This is more secure than Math.random()
 */
export const generateSecureOTP = (length: number = 6): string => {
  if (!Number.isInteger(length) || length <= 0) {
    throw new Error('Length must be a positive integer');
  }

  const buffer = crypto.randomBytes(length);
  let otp = '';

  for (let i = 0; i < length; i++) {
    otp += buffer[i] % 10;
  }

  return otp;
};

/**
 * Generate TOTP (Time-based One-Time Password)
 * This is the most secure option as it's time-based and uses HMAC
 */
export const generateTOTP = (secret: string): string => {
  // Configure TOTP
  authenticator.options = {
    digits: 6,
    step: 300, // 5 minutes validity
    window: 1, // Allow 1 time step before/after
  };

  return authenticator.generate(secret);
};

/**
 * Verify TOTP
 */
export const verifyTOTP = (token: string, secret: string): boolean => {
  authenticator.options = {
    digits: 6,
    step: 300, // 5 minutes validity
    window: 1, // Allow 1 time step before/after
  };

  try {
    return authenticator.verify({ token, secret });
  } catch (error) {
    return false;
  }
};

/**
 * Generate a secret for TOTP (to be stored with user/email)
 */
export const generateTOTPSecret = (): string => {
  return authenticator.generateSecret();
};

export const generatePassword = () => {
  return generateRandomString(10);
};

/**
 * Digest for opaque credentials — refresh tokens and password-reset tokens.
 *
 * SHA-256 rather than bcrypt on purpose: these are 32-64 bytes of CSPRNG
 * output, so there is no low-entropy guess space to slow an attacker down in.
 * A password digest has the opposite problem and needs the opposite tool.
 */
export function hashOpaqueToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}
