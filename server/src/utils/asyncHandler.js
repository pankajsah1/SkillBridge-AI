/**
 * Wraps an async route handler so rejected promises reach Express's error
 * pipeline instead of becoming unhandled rejections.
 *
 * Without this, every controller needs its own try/catch:
 *
 *   router.get('/', async (req, res, next) => {
 *     try { ... } catch (err) { next(err); }
 *   });
 *
 * With it:
 *
 *   router.get('/', asyncHandler(async (req, res) => { ... }));
 *
 * The try/catch matters: a handler that is not declared `async` can throw
 * synchronously, which would escape `Promise.resolve(...)` entirely. Catching it
 * here means every handler behaves identically regardless of how it was written.
 *
 * @param {Function} fn  (req, res, next) => any | Promise<any>
 * @returns {Function}   Express-compatible handler.
 */
const asyncHandler = (fn) => (req, res, next) => {
  try {
    Promise.resolve(fn(req, res, next)).catch(next);
  } catch (error) {
    next(error);
  }
};

export default asyncHandler;
export { asyncHandler };
