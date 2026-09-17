import { HttpException } from '@nestjs/common';

export interface Serialized<T, K extends number = number> {
  data: T;
  status: K;
  message: string;
}

export function SerializeHttpResponse<T, K extends number = number>(
  data: T,
  status: K,
  message: string,
): Serialized<T, K> {
  return { data, status, message };
}

export function SerializeHttpError<T, K extends number = number>(
  data: T,
  status: K,
  message: string,
): never {
  throw new HttpException({ status, data, message }, status);
}

// Type aliases for common response types
export type SuccessResponse<T> = Serialized<T, 200 | 201 | 202>;
export type ErrorResponse = Serialized<null, 400 | 401 | 403 | 404 | 500>;
