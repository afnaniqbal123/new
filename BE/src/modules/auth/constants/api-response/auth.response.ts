export enum AUTH_SUCCESS {
  ACCOUNT_CREATION = 'Your account has been successfully created. Please check your email address for the otp.',
  GOOGLE_ACCOUNT_CREATION = 'Your account has been successfully created.',
  APPLE_ACCOUNT_CREATION = 'Your account has been successfully created with Apple.',
  ACCOUNT_LOGIN = 'Your account has been logged in successfully.',
  FORGOT_PASSWORD = 'The password reset email has been sent successfully.',
  FORGOT_PASSWORD_LINK = 'The password reset link has been sent successfully.',
  RESET_PASSWORD = 'The password has been successfully reset.',
  PASSWORD_CHANGED = 'Your password has been successfully changed.',
  TOKEN_REFRESHED = 'Access token refreshed successfully.',
  LOGGED_OUT = 'You have been logged out successfully.',
  LOGGED_OUT_ALL_DEVICES = 'You have been logged out from all devices successfully.',
  ACTIVE_SESSIONS = 'Active sessions retrieved successfully.',
}

export enum AUTH_ERRORS {
  INCORRECT_CREDENTIALS = 'Incorrect email or password.',
  USER_NOT_FOUND = 'Unable to find the user.',
  DUPLICATE_EMAIL = 'User with same email already exist.',
  ACCOUNT_CREATION = 'An error occurred while creating new user.',
  ACCOUNT_LOGIN = 'An error occurred while logging the account.',
  UNAUTHORIZED = 'You are not authorized to access this operation.',
  FORGOT_PASSWORD = 'An error occurred while resetting user password.',
  INVALID_TOKEN = 'Your token is not validate.',
  INVALID_APPLE_TOKEN = 'Invalid Apple token.',
  INCORRECT_CURRENT_PASSWORD = 'Incorrect current password.',
  SIGNUP_ALREADY_VERIFIED = 'Your account is already verified.',

  // --- Authorization (403) ---------------------------------------------
  // Distinct from UNAUTHORIZED (401): the caller proved who they are, they
  // are simply not allowed to do this. Collapsing the two tells a client to
  // re-authenticate when re-authenticating cannot possibly help.
  FORBIDDEN_ROLE = 'You do not have permission to perform this action.',
  ORGANIZATION_ACCESS_DENIED = 'You do not have access to this organization.',
  ORGANIZATION_REQUIRED = 'An organization must be specified for this operation.',

  // --- Refresh sessions -------------------------------------------------
  REFRESH_TOKEN_INVALID = 'Your session is no longer valid. Please sign in again.',
  REFRESH_TOKEN_REVOKED = 'Your session has been revoked. Please sign in again.',
  REFRESH_TOKEN_EXPIRED = 'Your session has expired. Please sign in again.',
  REFRESH_TOKEN_FAILED = 'An error occurred while refreshing the session.',
  LOGOUT_FAILED = 'An error occurred while logging out.',
  ACTIVE_SESSIONS_FAILED = 'An error occurred while fetching active sessions.',
}
