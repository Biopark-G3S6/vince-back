import { ApiFailure } from '@shared/errors/api-failure';
import { isKnownResponseCode } from '@shared/http/response-code';

import type { CourseResult } from '../contracts/result.dto';

export function unwrap<T>(result: CourseResult<T>): T {
  if (result.ok) {
    return result.value;
  }

  throw new ApiFailure(
    isKnownResponseCode(result.failure.code) ? result.failure.code : 'INTERNAL_ERROR',
    result.failure.fields?.map((field) => ({ field: field.field, code: field.code })),
  );
}
