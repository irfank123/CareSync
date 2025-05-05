/**
 * Utility function to wrap asynchronous route handlers.
 * Catches errors and passes them to the next() function for global error handling.
 * @param {Function} fn - The asynchronous function to wrap.
 * @returns {Function} - A function that executes the async handler and catches errors.
 */
export const catchAsync = fn => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}; 