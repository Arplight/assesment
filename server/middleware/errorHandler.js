/**
 * Centralized error handler — unexpected failures return 500 without crashing.
 */
function errorHandler(err, req, res, next) {
  // eslint-disable-next-line no-console
  console.error('[api]', err);

  if (res.headersSent) {
    return next(err);
  }

  const status = err.status && Number.isInteger(err.status) ? err.status : 500;
  const message =
    status === 500
      ? 'Internal Server Error'
      : err.message || 'Request failed';

  return res.status(status).json({
    success: false,
    message,
  });
}

module.exports = errorHandler;
