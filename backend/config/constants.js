export const JWT_EXPIRES_IN = '7d';
export const BCRYPT_SALT_ROUNDS = 12;

export const PASSWORD_REGEX = /^(?=.*\d).{8,}$/;
export const PASSWORD_ERROR_MESSAGE = 'Password must be at least 8 characters long and contain at least one number';

export const RATE_LIMIT_AUTH_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const RATE_LIMIT_AUTH_MAX = 10; // Max 10 attempts per window

export const RATE_LIMIT_GLOBAL_WINDOW_MS = 15 * 60 * 1000;
export const RATE_LIMIT_GLOBAL_MAX = 200;

export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 50;
