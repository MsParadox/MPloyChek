// MPloyChek — UserService Tests (v3.0 — Prisma-backed)
// Author: Mohit Sharma

jest.mock('../lib/prisma', () => ({ __esModule: true, default: { user: { findMany:jest.fn().mockResolvedValue([]), findUnique:jest.fn(), create:jest.fn(), update:jest.fn(), delete:jest.fn(), count:jest.fn().mockResolvedValue(0) }, record: { count:jest.fn().mockResolvedValue(0) }, candidate: { count:jest.fn().mockResolvedValue(0) }, refreshToken: { create:jest.fn(), findUnique:jest.fn(), updateMany:jest.fn(), deleteMany:jest.fn() }, notification: { findMany:jest.fn().mockResolvedValue([]), count:jest.fn().mockResolvedValue(0), create:jest.fn() }, auditLog: { create:jest.fn(), findMany:jest.fn().mockResolvedValue([]) } } }));

import { UserService } from '../services/user.service';

describe('UserService', () => {
  let service: UserService;
  beforeEach(() => { service = new UserService(); jest.clearAllMocks(); });

  it('should be created', () => expect(service).toBeTruthy());

  it('getAllUsers() should return array', async () => {
    const result = await service.getAllUsers();
    expect(Array.isArray(result)).toBe(true);
  });

  it('getUserById() returns null for non-existent user', async () => {
    const result = await service.getUserById('non-existent-id');
    expect(result).toBeNull();
  });

  it('getStats() returns stats with correct shape', async () => {
    const stats = await service.getStats();
    expect(stats).toHaveProperty('totalUsers');
    expect(stats).toHaveProperty('activeUsers');
    expect(stats).toHaveProperty('adminUsers');
    expect(stats).toHaveProperty('totalRecords');
    expect(stats).toHaveProperty('totalCandidates');
  });

  it('deleteUser() returns false for non-existent user', async () => {
    const prisma = require('../lib/prisma').default;
    prisma.user.delete.mockRejectedValue(new Error('Not found'));
    const result = await service.deleteUser('non-existent');
    expect(result).toBe(false);
  });
});
