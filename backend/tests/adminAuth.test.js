import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import protect from '../middleware/authMiddleware.js';
import requireAdmin from '../middleware/adminMiddleware.js';
import User from '../models/User.js';
import { adminLogin, login, register } from '../controllers/authController.js';

const mockResponse = () => {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
  return res;
};

test('legacy and new users default to the user role', () => {
  const legacyUser = new User({ name: 'Legacy User', email: 'legacy@example.com', password: 'password1' });
  assert.equal(legacyUser.role, 'user');
});

test('admin middleware denies normal users and allows administrators', () => {
  const deniedResponse = mockResponse();
  let deniedNextCalled = false;

  requireAdmin({ authRole: 'user' }, deniedResponse, () => {
    deniedNextCalled = true;
  });

  assert.equal(deniedResponse.statusCode, 403);
  assert.equal(deniedResponse.body.success, false);
  assert.equal(deniedNextCalled, false);

  const allowedResponse = mockResponse();
  let allowedNextCalled = false;
  requireAdmin({ authRole: 'admin' }, allowedResponse, () => {
    allowedNextCalled = true;
  });

  assert.equal(allowedNextCalled, true);
});

test('JWT role gates admin access without a user database role', async () => {
  const originalFindById = User.findById;
  const previousJwtSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'test-only-jwt-secret-12345678901234567890';
  User.findById = async () => ({ _id: 'normal-user', role: 'user' });

  try {
    const normalRequest = {
      headers: {
        authorization: `Bearer ${jwt.sign({ id: 'normal-user', role: 'user' }, process.env.JWT_SECRET)}`
      }
    };
    const normalResponse = mockResponse();
    await protect(normalRequest, normalResponse, () => {
      requireAdmin(normalRequest, normalResponse, () => assert.fail('Normal user passed admin authorization'));
    });
    assert.equal(normalResponse.statusCode, 403);

    const adminRequest = {
      headers: {
        authorization: `Bearer ${jwt.sign({ role: 'admin' }, process.env.JWT_SECRET)}`
      }
    };
    const adminResponse = mockResponse();
    let authorized = false;
    await protect(adminRequest, adminResponse, () => {
      requireAdmin(adminRequest, adminResponse, () => { authorized = true; });
    });
    assert.equal(authorized, true);
  } finally {
    User.findById = originalFindById;
    if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousJwtSecret;
  }
});

test('admin login refuses with one warning when credentials are missing', async () => {
  const previousId = process.env.ADMIN_ID;
  const previousPassword = process.env.ADMIN_PASSWORD;
  const previousWarn = console.warn;
  const warnings = [];
  delete process.env.ADMIN_ID;
  delete process.env.ADMIN_PASSWORD;
  console.warn = (message) => warnings.push(message);

  try {
    const response = mockResponse();
    await adminLogin({ body: { id: 'test-id', password: 'test-password' } }, response, (error) => { throw error; });
    assert.equal(response.statusCode, 401);
    assert.equal(response.body.message, 'Invalid admin credentials');
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /ADMIN_ID or ADMIN_PASSWORD is missing/);
  } finally {
    console.warn = previousWarn;
    if (previousId === undefined) delete process.env.ADMIN_ID;
    else process.env.ADMIN_ID = previousId;
    if (previousPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = previousPassword;
  }
});

test('admin login rejects wrong credentials and returns an admin-role token on success', async () => {
  const previousId = process.env.ADMIN_ID;
  const previousPassword = process.env.ADMIN_PASSWORD;
  const previousJwtSecret = process.env.JWT_SECRET;
  process.env.ADMIN_ID = '  "Configured-Admin-ID"  ';
  process.env.ADMIN_PASSWORD = " 'configured-admin-password' ";
  process.env.JWT_SECRET = 'test-only-jwt-secret-12345678901234567890';

  try {
    const wrongResponse = mockResponse();
    await adminLogin({
      body: { id: ' CONFIGURED-ADMIN-ID ', password: 'wrong-password' }
    }, wrongResponse, (error) => { throw error; });
    assert.equal(wrongResponse.statusCode, 401);
    assert.equal(wrongResponse.body.message, 'Invalid admin credentials');

    const successResponse = mockResponse();
    await adminLogin({
      body: { id: ' configured-admin-id ', password: ' configured-admin-password ' }
    }, successResponse, (error) => { throw error; });

    assert.equal(successResponse.statusCode, 200);
    assert.equal(jwt.verify(successResponse.body.data.token, process.env.JWT_SECRET).role, 'admin');
    assert.equal(successResponse.body.data.user.role, 'admin');
    assert.equal(JSON.stringify(successResponse.body).includes('Configured-Admin-ID'), false);
    assert.equal(JSON.stringify(successResponse.body).includes('configured-admin-password'), false);
  } finally {
    if (previousId === undefined) delete process.env.ADMIN_ID;
    else process.env.ADMIN_ID = previousId;
    if (previousPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = previousPassword;
    if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousJwtSecret;
  }
});

test('signup remains a normal user and login returns the persisted role', async () => {
  const originalFindOne = User.findOne;
  const originalCreate = User.create;
  const originalJwtSecret = process.env.JWT_SECRET;
  const password = 'test-password-123';
  const userId = '507f1f77bcf86cd799439011';
  const responses = [];

  User.findOne = async () => null;
  User.create = async (account) => ({
    _id: userId,
    ...account,
    role: account.role || 'user',
    createdAt: new Date()
  });
  process.env.JWT_SECRET = 'test-only-jwt-secret-12345678901234567890';

  const response = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      responses.push({ statusCode: this.statusCode, body });
      return this;
    }
  };

  try {
    await register({
      body: {
        name: 'Normal User',
        email: 'normal@example.com',
        password,
        role: 'admin'
      }
    }, response, (error) => { throw error; });

    const signupResult = responses.at(-1);
    assert.equal(signupResult.statusCode, 201);
    assert.equal(signupResult.body.data.user.role, 'user');

    const hashedPassword = await bcrypt.hash(password, 4);
    const authenticatedUser = {
      _id: userId,
      name: 'Normal User',
      email: 'normal@example.com',
      password: hashedPassword,
      role: 'user'
    };
    User.findOne = () => ({ select: async () => authenticatedUser });

    await login({
      body: { email: authenticatedUser.email, password }
    }, response, (error) => { throw error; });

    const loginResult = responses.at(-1);
    assert.equal(loginResult.statusCode, 200);
    assert.equal(loginResult.body.data.user.role, 'user');
  } finally {
    User.findOne = originalFindOne;
    User.create = originalCreate;
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
  }
});
