export enum AUTHORIZATION_ERRORS {
  // Intentionally the same text whatever the caller lacked. Naming the missing
  // permission tells someone probing the API exactly which door to try next.
  FORBIDDEN = 'You do not have permission to perform this action.',
  UNAUTHENTICATED = 'You are not authorized to access this operation.',
}
