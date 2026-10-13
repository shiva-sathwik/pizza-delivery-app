/**
 * Step 4I: Comprehensive Authentication Testing Suite
 * Tests User Registration, Email Verification, Login/JWT, Forgot/Reset Password,
 * Admin Authentication, and Middleware Authorization.
 */

const assert = require('assert');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Set test environment variables
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_12345';
process.env.JWT_EXPIRES_IN = '1h';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.NODE_ENV = 'test';

const { authenticate, requireAdmin } = require('../middleware/auth.middleware');
const {
  register,
  verifyEmail,
  login,
  getCurrentUser,
  logout,
  forgotPassword,
  resetPassword
} = require('../controllers/auth.controller');
const { adminLogin, adminTest } = require('../controllers/admin.controller');
const User = require('../models/User');
const emailService = require('../services/email.service');

// Helper to simulate Express req/res
const createMockReqRes = ({ body = {}, query = {}, headers = {}, cookies = {}, user = null } = {}) => {
  const req = {
    body,
    query,
    headers,
    cookies,
    user
  };

  const res = {
    statusCode: 200,
    cookiesSet: {},
    cookiesCleared: {},
    jsonData: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.jsonData = data;
      return this;
    },
    cookie(name, val, opts) {
      this.cookiesSet[name] = { val, opts };
      return this;
    },
    clearCookie(name, opts) {
      this.cookiesCleared[name] = opts;
      return this;
    }
  };

  return { req, res };
};

// In-Memory Store
const inMemoryDB = new Map();

// Helper to store in memory
const saveToDB = (doc) => {
  const idStr = (doc._id || 'user-123').toString();
  doc._id = idStr;
  doc.save = async function() {
    inMemoryDB.set(idStr, this);
    return this;
  };
  inMemoryDB.set(idStr, doc);
  return doc;
};

// Hook into User model methods for unit testing
const originalFindOne = User.findOne;
const originalFindById = User.findById;
const originalSave = User.prototype.save;

User.findOne = async function(filter) {
  for (const doc of inMemoryDB.values()) {
    let match = true;
    for (const [key, val] of Object.entries(filter)) {
      if (key === 'resetTokenExpiry') {
        if (val.$gt && !(doc.resetTokenExpiry > val.$gt)) match = false;
      } else if (doc[key] !== val) {
        match = false;
      }
    }
    if (match) return doc;
  }
  return null;
};

User.findById = function(id) {
  const idStr = id ? id.toString() : '';
  const doc = inMemoryDB.get(idStr);
  return {
    select: async (fields) => {
      if (!doc) return null;
      const copy = doc.toObject ? doc.toObject() : { ...doc };
      copy._id = doc._id || copy._id;
      if (fields && fields.includes('-password')) delete copy.password;
      return copy;
    }
  };
};

User.prototype.save = async function() {
  return saveToDB(this);
};

const runTests = async () => {
  console.log('====================================================');
  console.log('🧪 RUNNING STEP 4 COMPLETE AUTHENTICATION TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  const test = async (name, fn) => {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(`    Error: ${err.message}`);
      failed++;
    }
  };

  // ----------------------------------------------------
  // SECTION 1: USER REGISTRATION (Step 4B)
  // ----------------------------------------------------
  console.log('--- 1. USER REGISTRATION TESTS ---');

  await test('Registration rejects missing name with 400', async () => {
    const { req, res } = createMockReqRes({
      body: { email: 'test@example.com', password: 'password123' }
    });
    await register(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.jsonData.success, false);
    assert.match(res.jsonData.message, /name is required/i);
  });

  await test('Registration rejects invalid email format with 400', async () => {
    const { req, res } = createMockReqRes({
      body: { name: 'John Doe', email: 'invalid-email', password: 'password123' }
    });
    await register(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.jsonData.success, false);
    assert.match(res.jsonData.message, /valid email/i);
  });

  await test('Registration rejects short password (< 6 chars) with 400', async () => {
    const { req, res } = createMockReqRes({
      body: { name: 'John Doe', email: 'john@example.com', password: '123' }
    });
    await register(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.jsonData.success, false);
    assert.match(res.jsonData.message, /at least 6 characters/i);
  });

  let createdUser = null;

  await test('Registration strictly enforces role="user" even if "admin" is passed', async () => {
    const { req, res } = createMockReqRes({
      body: {
        name: 'Normal User',
        email: 'USER@EXAMPLE.COM ',
        password: 'password123',
        role: 'admin' // Attempted privilege escalation
      }
    });

    await register(req, res);

    assert.strictEqual(res.statusCode, 201);
    createdUser = await User.findOne({ email: 'user@example.com' });
    assert.ok(createdUser, 'User must exist in store');
    assert.strictEqual(createdUser.role, 'user', 'Role must remain "user"');
    assert.strictEqual(createdUser.email, 'user@example.com', 'Email must be normalized');
    assert.strictEqual(createdUser.isEmailVerified, false, 'Initial isEmailVerified must be false');
    assert.ok(createdUser.verificationToken, 'Verification token must be generated');
    assert.notStrictEqual(createdUser.password, 'password123', 'Password must be hashed');
    assert.strictEqual(res.jsonData.user.password, undefined, 'Password must never be returned in response');
  });

  await test('Registration rejects duplicate email with 400', async () => {
    const { req, res } = createMockReqRes({
      body: { name: 'Duplicate User', email: 'user@example.com', password: 'password123' }
    });
    await register(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.jsonData.success, false);
    assert.match(res.jsonData.message, /already exists/i);
  });

  // ----------------------------------------------------
  // SECTION 2: EMAIL VERIFICATION (Step 4C)
  // ----------------------------------------------------
  console.log('\n--- 2. EMAIL VERIFICATION TESTS ---');

  let verificationTokenHolder = null;

  await test('Verification token generated securely and present on user', async () => {
    assert.ok(createdUser.verificationToken);
    assert.strictEqual(createdUser.verificationToken.length, 64); // 32 bytes hex = 64 chars
    verificationTokenHolder = createdUser.verificationToken;
  });

  await test('Email verification rejects missing token with 400', async () => {
    const { req, res } = createMockReqRes({ query: {} });
    await verifyEmail(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.match(res.jsonData.message, /token is required/i);
  });

  await test('Email verification rejects invalid token with 400', async () => {
    const { req, res } = createMockReqRes({ query: { token: 'invalid-fake-token-123' } });
    await verifyEmail(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.match(res.jsonData.message, /invalid or expired/i);
  });

  await test('Valid token successfully verifies user and clears token', async () => {
    const { req, res } = createMockReqRes({ query: { token: verificationTokenHolder } });
    await verifyEmail(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(createdUser.isEmailVerified, true);
    assert.strictEqual(createdUser.verificationToken, null, 'Token must be invalidated after use');
  });

  await test('Already-used verification token is rejected', async () => {
    const { req, res } = createMockReqRes({ query: { token: verificationTokenHolder } });
    await verifyEmail(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.match(res.jsonData.message, /invalid or expired/i);
  });

  // --- SUBSECTION: EMAIL-VERIFICATION DEV SIMULATION TESTS ---
  await test('Development mode logs generated verification URL when mock transporter is used', async () => {
    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => {
      logs.push(args.join(' '));
    };

    try {
      const { req, res } = createMockReqRes({
        body: {
          name: 'Dev Verify User',
          email: 'devverify@example.com',
          password: 'password123'
        }
      });
      await register(req, res);

      // Verify safe API response does NOT leak verification token or url
      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.jsonData.success, true);
      assert.strictEqual(res.jsonData.token, undefined);
      assert.strictEqual(res.jsonData.verificationToken, undefined);
      assert.strictEqual(res.jsonData.verificationUrl, undefined);
      assert.strictEqual(res.jsonData.user.verificationToken, undefined);
      assert.strictEqual(res.jsonData.user.password, undefined);

      // Verify verification URL is logged to terminal in development mode
      const devVerifyUser = await User.findOne({ email: 'devverify@example.com' });
      assert.ok(devVerifyUser, 'Registered user must exist');
      const verifyUrlLog = logs.find((l) => l.includes('Verification URL:'));
      assert.ok(verifyUrlLog, 'Verification URL must be logged in dev mode');
      assert.ok(
        verifyUrlLog.includes(`http://localhost:5173/verify-email?token=${devVerifyUser.verificationToken}`),
        'Logged URL must match frontend client URL and generated verification token'
      );

      // Verify token is NOT logged separately outside the URL
      const separateTokenLog = logs.find((l) => l.trim() === devVerifyUser.verificationToken);
      assert.strictEqual(separateTokenLog, undefined, 'Verification token must not be logged separately');
    } finally {
      console.log = originalLog;
    }
  });

  await test('Production mode (NODE_ENV=production) NEVER logs verification URL even with mock transporter', async () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => {
      logs.push(args.join(' '));
    };

    try {
      const { req, res } = createMockReqRes({
        body: {
          name: 'Prod Verify User',
          email: 'prodverify@example.com',
          password: 'password123'
        }
      });
      await register(req, res);

      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.jsonData.success, true);
      assert.strictEqual(res.jsonData.token, undefined);
      assert.strictEqual(res.jsonData.verificationToken, undefined);
      assert.strictEqual(res.jsonData.user.verificationToken, undefined);

      const verifyUrlLog = logs.find((l) => l.includes('Verification URL:'));
      assert.strictEqual(verifyUrlLog, undefined, 'Verification URL must NEVER be logged in production');
    } finally {
      process.env.NODE_ENV = prevEnv;
      console.log = originalLog;
    }
  });

  await test('Configured/real SMTP transporter NEVER logs verification URL even in development mode', async () => {
    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => {
      logs.push(args.join(' '));
    };

    // Simulate real/custom configured transporter
    emailService.setCustomTransporter({
      sendMail: async () => ({ messageId: 'real-smtp-message-verify-123' })
    });

    try {
      const { req, res } = createMockReqRes({
        body: {
          name: 'SMTP Verify User',
          email: 'smtpverify@example.com',
          password: 'password123'
        }
      });
      await register(req, res);

      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.jsonData.success, true);

      const verifyUrlLog = logs.find((l) => l.includes('Verification URL:'));
      assert.strictEqual(verifyUrlLog, undefined, 'Verification URL must not be logged when real/custom SMTP is configured');
    } finally {
      emailService.setCustomTransporter(null); // Restore default mock transporter
      console.log = originalLog;
    }
  });

  // ----------------------------------------------------
  // SECTION 3: LOGIN & JWT AUTHENTICATION (Step 4D)
  // ----------------------------------------------------
  console.log('\n--- 3. LOGIN & JWT AUTHENTICATION TESTS ---');

  await test('Login rejects unknown email with 401', async () => {
    const { req, res } = createMockReqRes({
      body: { email: 'unknown@example.com', password: 'password123' }
    });
    await login(req, res);
    assert.strictEqual(res.statusCode, 401);
    assert.match(res.jsonData.message, /invalid email or password/i);
  });

  await test('Login rejects incorrect password with 401', async () => {
    const { req, res } = createMockReqRes({
      body: { email: 'user@example.com', password: 'wrongpassword' }
    });
    await login(req, res);
    assert.strictEqual(res.statusCode, 401);
    assert.match(res.jsonData.message, /invalid email or password/i);
  });

  await test('Login rejects unverified user with 403', async () => {
    const unverifiedUser = saveToDB({
      _id: 'unverified-1',
      email: 'unverified@example.com',
      password: await bcrypt.hash('pass12345', 10),
      role: 'user',
      isEmailVerified: false
    });

    const { req, res } = createMockReqRes({
      body: { email: 'unverified@example.com', password: 'pass12345' }
    });
    await login(req, res);
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.jsonData.requiresVerification, true);
  });

  let userAuthToken = null;

  await test('Verified user logs in successfully and receives HTTP-only JWT cookie', async () => {
    const { req, res } = createMockReqRes({
      body: { email: 'user@example.com', password: 'password123' }
    });
    await login(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.cookiesSet.token, 'Token cookie must be set');
    assert.strictEqual(res.cookiesSet.token.opts.httpOnly, true, 'Cookie must be HTTP-only');

    userAuthToken = res.cookiesSet.token.val;
    const decoded = jwt.verify(userAuthToken, process.env.JWT_SECRET);
    assert.strictEqual(decoded.userId, createdUser._id.toString());
    assert.strictEqual(decoded.role, 'user');
    assert.strictEqual(decoded.password, undefined, 'JWT must not contain password');
  });

  await test('GET /api/auth/me returns current user profile using JWT', async () => {
    const { req, res } = createMockReqRes({
      cookies: { token: userAuthToken }
    });

    let nextCalled = false;
    await authenticate(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, true, 'Authenticate middleware must pass');
    assert.strictEqual(req.user._id.toString(), createdUser._id.toString());

    const meRes = createMockReqRes({ user: req.user });
    await getCurrentUser(meRes.req, meRes.res);

    assert.strictEqual(meRes.res.statusCode, 200);
    assert.strictEqual(meRes.res.jsonData.user.email, 'user@example.com');
    assert.strictEqual(meRes.res.jsonData.user.password, undefined);
  });

  await test('POST /api/auth/logout clears token cookie', async () => {
    const { req, res } = createMockReqRes();
    logout(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.cookiesCleared.token);
  });

  // ----------------------------------------------------
  // SECTION 4: FORGOT PASSWORD & RESET (Step 4E)
  // ----------------------------------------------------
  console.log('\n--- 4. FORGOT & RESET PASSWORD TESTS ---');

  let resetTokenHolder = null;

  await test('Forgot password returns generic message for existing email & generates token', async () => {
    const { req, res } = createMockReqRes({
      body: { email: 'user@example.com' }
    });
    await forgotPassword(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.match(res.jsonData.message, /if an account with that email exists/i);
    assert.ok(createdUser.resetToken);
    assert.ok(createdUser.resetTokenExpiry > new Date());
    resetTokenHolder = createdUser.resetToken;
  });

  await test('Forgot password returns identical generic message for non-existent email', async () => {
    const { req, res } = createMockReqRes({
      body: { email: 'nonexistent_account_404@example.com' }
    });
    await forgotPassword(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.match(res.jsonData.message, /if an account with that email exists/i);
  });

  await test('Reset password rejects invalid token with 400', async () => {
    const { req, res } = createMockReqRes({
      body: { token: 'invalid-reset-token-xyz', password: 'newPassword123' }
    });
    await resetPassword(req, res);
    assert.strictEqual(res.statusCode, 400);
  });

  await test('Reset password successfully updates password and invalidates reset token', async () => {
    const { req, res } = createMockReqRes({
      body: { token: resetTokenHolder, password: 'BrandNewSecurePassword123' }
    });
    await resetPassword(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(createdUser.resetToken, null, 'Reset token must be cleared');
    assert.strictEqual(createdUser.resetTokenExpiry, null, 'Reset token expiry must be cleared');

    const matchesNew = await bcrypt.compare('BrandNewSecurePassword123', createdUser.password);
    assert.strictEqual(matchesNew, true, 'New password must match');
  });

  // --- SUBSECTION: FORGOT-PASSWORD DEV SIMULATION TESTS ---
  const simUser = saveToDB({
    _id: 'sim-user-1',
    name: 'Dev Sim User',
    email: 'devsim@example.com',
    password: await bcrypt.hash('simpassword123', 10),
    role: 'user',
    isEmailVerified: true
  });

  await test('Development mode logs generated reset URL when mock transporter is used', async () => {
    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => {
      logs.push(args.join(' '));
    };

    try {
      const { req, res } = createMockReqRes({
        body: { email: 'devsim@example.com' }
      });
      await forgotPassword(req, res);

      // Verify generic API response is unchanged and exposes no sensitive details
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.jsonData.success, true);
      assert.strictEqual(
        res.jsonData.message,
        'If an account with that email exists, a password reset link has been sent to your inbox.'
      );
      assert.strictEqual(res.jsonData.token, undefined);
      assert.strictEqual(res.jsonData.resetToken, undefined);
      assert.strictEqual(res.jsonData.resetUrl, undefined);

      // Verify reset URL is logged to terminal in development mode
      const resetUrlLog = logs.find((l) => l.includes('Reset URL:'));
      assert.ok(resetUrlLog, 'Reset URL must be logged in dev mode');
      assert.ok(
        resetUrlLog.includes(`http://localhost:5173/reset-password?token=${simUser.resetToken}`),
        'Logged URL must match frontend client URL and generated token'
      );

      // Verify token is NOT logged separately outside the URL
      const separateTokenLog = logs.find((l) => l.trim() === simUser.resetToken);
      assert.strictEqual(separateTokenLog, undefined, 'Reset token must not be logged separately');
    } finally {
      console.log = originalLog;
    }
  });

  await test('Production mode (NODE_ENV=production) NEVER logs reset URL even with mock transporter', async () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => {
      logs.push(args.join(' '));
    };

    try {
      const { req, res } = createMockReqRes({
        body: { email: 'devsim@example.com' }
      });
      await forgotPassword(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.jsonData.success, true);
      assert.strictEqual(
        res.jsonData.message,
        'If an account with that email exists, a password reset link has been sent to your inbox.'
      );

      const resetUrlLog = logs.find((l) => l.includes('Reset URL:'));
      assert.strictEqual(resetUrlLog, undefined, 'Reset URL must NEVER be logged in production');
    } finally {
      process.env.NODE_ENV = prevEnv;
      console.log = originalLog;
    }
  });

  await test('Configured/real SMTP transporter NEVER logs reset URL even in development mode', async () => {
    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => {
      logs.push(args.join(' '));
    };

    // Simulate real/custom configured transporter
    emailService.setCustomTransporter({
      sendMail: async () => ({ messageId: 'real-smtp-message-123' })
    });

    try {
      const { req, res } = createMockReqRes({
        body: { email: 'devsim@example.com' }
      });
      await forgotPassword(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.jsonData.success, true);
      assert.strictEqual(
        res.jsonData.message,
        'If an account with that email exists, a password reset link has been sent to your inbox.'
      );

      const resetUrlLog = logs.find((l) => l.includes('Reset URL:'));
      assert.strictEqual(resetUrlLog, undefined, 'Reset URL must not be logged when real/custom SMTP is configured');
    } finally {
      emailService.setCustomTransporter(null); // Restore default mock transporter
      console.log = originalLog;
    }
  });

  // ----------------------------------------------------
  // SECTION 5: ADMIN AUTHENTICATION & AUTHORIZATION (Step 4F & 4G)
  // ----------------------------------------------------
  console.log('\n--- 5. ADMIN AUTHENTICATION & AUTHORIZATION TESTS ---');

  // Seed admin into in-memory DB
  const adminUser = saveToDB({
    _id: 'admin-999',
    name: 'Super Admin',
    email: 'admin@pizzaflow.com',
    password: await bcrypt.hash('AdminSecret2026!', 10),
    role: 'admin',
    isEmailVerified: true
  });

  await test('Normal user is rejected from admin login with 403', async () => {
    const { req, res } = createMockReqRes({
      body: { email: 'user@example.com', password: 'BrandNewSecurePassword123' }
    });
    await adminLogin(req, res);
    assert.strictEqual(res.statusCode, 403);
    assert.match(res.jsonData.message, /administrator permissions/i);
  });

  let adminAuthToken = null;

  await test('Admin logs in through admin login endpoint successfully', async () => {
    const { req, res } = createMockReqRes({
      body: { email: 'admin@pizzaflow.com', password: 'AdminSecret2026!' }
    });
    await adminLogin(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.user.role, 'admin');
    assert.ok(res.cookiesSet.token);
    adminAuthToken = res.cookiesSet.token.val;
  });

  await test('Admin authorization test endpoint allows verified admin (200 OK)', async () => {
    const { req, res } = createMockReqRes({
      cookies: { token: adminAuthToken }
    });

    await authenticate(req, res, () => {
      requireAdmin(req, res, () => {
        adminTest(req, res);
      });
    });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.success, true);
    assert.strictEqual(res.jsonData.admin.role, 'admin');
  });

  await test('Admin authorization test endpoint rejects normal user with 403 Forbidden', async () => {
    const { req, res } = createMockReqRes({
      cookies: { token: userAuthToken }
    });

    await authenticate(req, res, () => {
      requireAdmin(req, res, () => {
        adminTest(req, res);
      });
    });

    assert.strictEqual(res.statusCode, 403);
    assert.match(res.jsonData.message, /administrator privileges required/i);
  });

  await test('Admin authorization test endpoint rejects unauthenticated request with 401', async () => {
    const { req, res } = createMockReqRes();

    await authenticate(req, res, () => {
      requireAdmin(req, res, () => {
        adminTest(req, res);
      });
    });

    assert.strictEqual(res.statusCode, 401);
    assert.match(res.jsonData.message, /no token provided/i);
  });

  // Restore mocks
  User.findOne = originalFindOne;
  User.findById = originalFindById;
  User.prototype.save = originalSave;

  console.log('\n====================================================');
  console.log(`TOTAL TESTS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
};

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
