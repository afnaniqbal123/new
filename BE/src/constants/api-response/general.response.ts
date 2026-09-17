export enum GENERAL_SUCCESS {
  OPERATION_SUCCESSFUL = 'Operation completed successfully',
  DATA_RETRIEVED = 'Data retrieved successfully',
  DATA_UPDATED = 'Data updated successfully',
  DATA_DELETED = 'Data deleted successfully',
  DATA_CREATED = 'Data created successfully',
}

export enum GENERAL_ERRORS {
  INTERNAL_SERVER_ERROR = 'Internal server error occurred',
  BAD_REQUEST = 'Bad request',
  VALIDATION_ERROR = 'Validation error',
  NOT_FOUND = 'Resource not found',
  UNAUTHORIZED = 'Unauthorized access',
  FORBIDDEN = 'Forbidden access',
  CONFLICT = 'Resource conflict',
  UNPROCESSABLE_ENTITY = 'Unprocessable entity',
  TOO_MANY_REQUESTS = 'Too many requests',
  SERVICE_UNAVAILABLE = 'Service unavailable',
}
