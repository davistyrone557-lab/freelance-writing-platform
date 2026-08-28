import rateLimit from 'express-rate-limit';

// General-purpose rate limiter: 200 requests per minute per IP
export const generalRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' }
});

// Strict rate limiter for sensitive endpoints: 10 requests per minute
export const strictRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' }
});

export default generalRateLimit;
