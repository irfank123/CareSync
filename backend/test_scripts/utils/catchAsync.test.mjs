import { catchAsync } from '@src/utils/catchAsync.mjs';

describe('catchAsync', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockReq = {};
    mockRes = {};
    mockNext = jest.fn(); // Mock the next function
  });

  test('should call the passed function with req, res, and next', async () => {
    const mockFn = jest.fn().mockResolvedValue(undefined);
    const wrappedFn = catchAsync(mockFn);
    await wrappedFn(mockReq, mockRes, mockNext);
    expect(mockFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
    expect(mockNext).not.toHaveBeenCalledWith(expect.any(Error));
  });

  test('should call next with the error if the passed function rejects', async () => {
    const mockError = new Error('Test error');
    const mockAsyncFn = jest.fn().mockRejectedValue(mockError);
    const wrappedFn = catchAsync(mockAsyncFn);

    await wrappedFn(mockReq, mockRes, mockNext);

    expect(mockAsyncFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledWith(mockError);
  });

  test('should not call next with an error if the passed function resolves', async () => {
    const mockAsyncFn = jest.fn().mockResolvedValue('Success');
    const wrappedFn = catchAsync(mockAsyncFn);

    await wrappedFn(mockReq, mockRes, mockNext);

    expect(mockAsyncFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
    expect(mockNext).not.toHaveBeenCalledWith(expect.any(Error));
  });
}); 