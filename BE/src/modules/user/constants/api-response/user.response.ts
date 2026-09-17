export enum UserSuccessMessages {
  CREATED = 'User created successfully',
  RETRIEVED = 'User retrieved successfully',
  RETRIEVED_ALL = 'Users retrieved successfully',
  UPDATED = 'User updated successfully',
  DELETED = 'User deleted successfully',
  EMAIL_UPDATED = 'Email updated successfully',
}

export enum UserErrorMessages {
  NOT_FOUND = 'User not found',
  ALREADY_EXISTS = 'User with this email already exists',
  INVALID_CREDENTIALS = 'Invalid credentials',
  UNAUTHORIZED = 'Unauthorized access',
  INVALID_TOKEN = 'Invalid or expired token',
  INVALID_PASSWORD = 'Invalid password',
  ALREADY_IN_ORGANIZATION = 'This user already belongs to an organization',
  LAST_OWNER = 'An organization must keep at least one owner',
}
