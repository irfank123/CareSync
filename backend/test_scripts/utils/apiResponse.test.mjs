import { ApiResponse, ApiError } from '@src/utils/apiResponse.mjs';

describe('ApiResponse', () => {
  test('should create an ApiResponse object with success, message, data, and timestamp', () => {
    const success = true;
    const message = 'Operation successful';
    const data = { id: 1, name: 'Test Data' };
    const response = new ApiResponse(success, message, data);

    expect(response.success).toBe(success);
    expect(response.message).toBe(message);
    expect(response.data).toEqual(data);
    expect(response.timestamp).toBeInstanceOf(Date);
  });

  test('should create an ApiResponse object with null data if not provided', () => {
    const success = false;
    const message = 'Operation failed';
    const response = new ApiResponse(success, message);

    expect(response.success).toBe(success);
    expect(response.message).toBe(message);
    expect(response.data).toBeNull();
    expect(response.timestamp).toBeInstanceOf(Date);
  });
});

describe('ApiError', () => {
  test('should create an ApiError object with message, statusCode, errors, name, and be an instance of Error', () => {
    const message = 'Resource not found';
    const statusCode = 404;
    const errors = [{ field: 'id', message: 'Not found' }];
    const apiError = new ApiError(message, statusCode, errors);

    expect(apiError).toBeInstanceOf(Error);
    expect(apiError.message).toBe(message);
    expect(apiError.statusCode).toBe(statusCode);
    expect(apiError.errors).toEqual(errors);
    expect(apiError.name).toBe('ApiError');
  });

  test('should create an ApiError with default statusCode 500 and empty errors if not provided', () => {
    const message = 'Internal server error';
    const apiError = new ApiError(message);

    expect(apiError).toBeInstanceOf(Error);
    expect(apiError.message).toBe(message);
    expect(apiError.statusCode).toBe(500);
    expect(apiError.errors).toEqual([]);
    expect(apiError.name).toBe('ApiError');
  });

  test('should capture stack trace', () => {
    const message = 'Test stack trace';
    const apiError = new ApiError(message);
    expect(apiError.stack).toBeDefined();
  });
}); 