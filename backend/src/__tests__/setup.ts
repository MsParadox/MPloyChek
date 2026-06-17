// ============================================================
// MPloyChek v4.0 — Global Jest Setup
// ============================================================
process.env['NODE_ENV']    = 'test';
process.env['JWT_SECRET']  = 'test_jwt_secret_for_unit_tests_min_32_chars!!';
process.env['JWT_EXPIRES_IN']  = '28800';
process.env['RT_EXPIRES_DAYS'] = '7';

// Silence console.warn from auth middleware JWT_SECRET check in tests
beforeAll(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});
