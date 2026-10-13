const rateLimit = require('express-rate-limit');

/**
 * Authentication Rate Limiter
 * Step 9B: Protect sensitive authentication endpoints against brute force & credential stuffing
 */
const authRateLimiter = rateLimit({
  windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes default
  max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 50, // 50 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test', // Bypass in test environment to preserve test suite isolation
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP, please try again after 15 minutes.'
  },
  handler: (req, res, next, options) => {
    return res.status(options.statusCode).json(options.message);
  }
});

module.exports = {
  authRateLimiter
};
