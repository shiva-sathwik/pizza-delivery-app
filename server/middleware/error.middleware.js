/**
 * Centralized Error & 404 Middleware
 * Step 9C: Robust error handling, safe client responses, and production sanitization
 */

/**
 * JSON 404 Handler for undefined API routes
 */
const notFoundHandler = (req, res) => {
  return res.status(404).json({
    success: false,
    message: 'Resource not found'
  });
};

/**
 * Centralized Express Error-Handling Middleware
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = err.status || err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // 1. Handle Express body-parser JSON syntax error (malformed JSON)
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    message = 'Malformed JSON in request body';
  }

  // 2. Handle Mongoose CastError (e.g. malformed ObjectId)
  else if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid format for '${err.path || 'id'}'`;
  }

  // 3. Handle Mongoose ValidationError
  else if (err.name === 'ValidationError') {
    statusCode = 400;
    const messages = Object.values(err.errors || {}).map((e) => e.message);
    message = messages.length > 0 ? messages.join(', ') : 'Validation error';
  }

  // 4. Handle MongoDB Duplicate Key Error (code 11000)
  else if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `Duplicate value entered for ${field}`;
  }

  // Log 500-level internal server errors safely
  if (statusCode >= 500) {
    console.error('[ServerError]', err);
  }

  // In production only, mask unexpected HTTP 500-level messages to avoid leaking internal driver/system details
  if (process.env.NODE_ENV === 'production' && statusCode >= 500) {
    message = 'Internal Server Error';
  }

  // Safe client response (stack trace omitted in production)
  return res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
};

module.exports = {
  notFoundHandler,
  errorHandler
};
