export enum OTP_SUCCESS {
  GENERATE_OTP = 'OTP has been sent to your email.',
  VERIFIED_OTP = 'OTP has been verified successfully.',
  RESEND_SIGNUP_OTP = 'OTP has been resent to your email.',
}

export enum OTP_ERROR {
  OTP_NOT_VERIFIED = 'OTP verification failed.',
  OTP_EXPIRED = 'This OTP has expired.',
  OTP_NOT_FOUND = 'OTP not found.',
  OTP_INVALID = 'The OTP you entered is incorrect.',
  OTP_ATTEMPTS_EXCEEDED = 'Maximum OTP verification attempts exceeded. Please request a new OTP.',
  OTP_RESEND_TOO_SOON = 'Please wait before requesting a new OTP.',
}
