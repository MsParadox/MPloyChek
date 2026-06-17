// ============================================================
// MPloyChek v4.0 — AuthService Unit Tests
// Mocks: bcrypt (slow), userRepo, refreshTokenRepo
// ============================================================
jest.mock('../repositories/user.repository');
jest.mock('../repositories/index');
jest.mock('bcryptjs');

import * as bcrypt from 'bcryptjs';
import { authService } from './auth.service';
import { userRepo } from '../repositories/user.repository';
import { refreshTokenRepo } from '../repositories/index';
import { makeDbUser } from '../__tests__/helpers/factories';

const mockBcrypt      = bcrypt as jest.Mocked<typeof bcrypt>;
const mockUserRepo    = userRepo as jest.Mocked<typeof userRepo>;
const mockRTRepo      = refreshTokenRepo as jest.Mocked<typeof refreshTokenRepo>;

describe('AuthService.hashPassword', () => {
  it('calls bcrypt.hash with 10 salt rounds', async () => {
    (mockBcrypt.hash as jest.Mock).mockResolvedValue('hashed_pw' as never);
    const result = await authService.hashPassword('plain');
    expect(mockBcrypt.hash).toHaveBeenCalledWith('plain', 10);
    expect(result).toBe('hashed_pw');
  });
});

describe('AuthService.verifyPassword', () => {
  it('returns true when bcrypt.compare succeeds', async () => {
    (mockBcrypt.compare as jest.Mock).mockResolvedValue(true as never);
    expect(await authService.verifyPassword('plain', 'hash')).toBe(true);
  });

  it('returns false when bcrypt.compare fails', async () => {
    (mockBcrypt.compare as jest.Mock).mockResolvedValue(false as never);
    expect(await authService.verifyPassword('wrong', 'hash')).toBe(false);
  });
});

describe('AuthService.registerUser', () => {
  const payload = {
    userId: 'new001', firstName: 'New', lastName: 'User',
    email: 'new@test.com', password: 'NewPass@1',
    role: 'General User', department: 'IT', phone: '+91-0000000000',
  };

  beforeEach(() => {
    (mockUserRepo.findByEmail    as jest.Mock).mockResolvedValue(null);
    (mockUserRepo.findByUserId   as jest.Mock).mockResolvedValue(null);
    (mockBcrypt.hash             as jest.Mock).mockResolvedValue('hashed' as never);
    (mockUserRepo.create         as jest.Mock).mockResolvedValue({ ...payload, id: 'new-uuid', joinDate: '2024-01-01', status: 'Active', preferences: {} });
  });

  it('creates user after hashing password', async () => {
    await authService.registerUser(payload);
    expect(mockBcrypt.hash).toHaveBeenCalledWith(payload.password, 10);
    expect(mockUserRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ passwordHash: 'hashed', email: 'new@test.com' })
    );
  });

  it('throws if email already registered', async () => {
    (mockUserRepo.findByEmail as jest.Mock).mockResolvedValue(makeDbUser({ email: 'new@test.com' }));
    await expect(authService.registerUser(payload)).rejects.toThrow('Email is already registered');
  });

  it('throws if userId already taken', async () => {
    (mockUserRepo.findByUserId as jest.Mock).mockResolvedValue(makeDbUser({ userId: 'new001' }));
    await expect(authService.registerUser(payload)).rejects.toThrow('User ID is already taken');
  });

  it('never passes plaintext password to the repository', async () => {
    await authService.registerUser(payload);
    const callArgs = (mockUserRepo.create as jest.Mock).mock.calls[0][0];
    expect(callArgs).not.toHaveProperty('password');
    expect(callArgs.passwordHash).toBe('hashed');
  });
});

describe('AuthService.verifyCredentials', () => {
  const dbUser = makeDbUser();

  it('returns user when credentials are correct', async () => {
    (mockUserRepo.findByUserId as jest.Mock).mockResolvedValue(dbUser);
    (mockBcrypt.compare as jest.Mock).mockResolvedValue(true as never);
    const result = await authService.verifyCredentials('admin001', 'Admin@123');
    expect(result).toEqual(dbUser);
  });

  it('returns null when user not found', async () => {
    (mockUserRepo.findByUserId as jest.Mock).mockResolvedValue(null);
    const result = await authService.verifyCredentials('ghost', 'pass');
    expect(result).toBeNull();
  });

  it('returns null when password is wrong', async () => {
    (mockUserRepo.findByUserId as jest.Mock).mockResolvedValue(dbUser);
    (mockBcrypt.compare as jest.Mock).mockResolvedValue(false as never);
    const result = await authService.verifyCredentials('admin001', 'WrongPass');
    expect(result).toBeNull();
  });
});

describe('AuthService.changePassword', () => {
  const dbUser = makeDbUser({ id: 'user-db-id', userId: 'admin001' });

  beforeEach(() => {
    (mockUserRepo.findByUserId as jest.Mock).mockResolvedValue(dbUser);
    (mockBcrypt.compare         as jest.Mock).mockResolvedValue(true as never);
    (mockBcrypt.hash            as jest.Mock).mockResolvedValue('new_hash' as never);
    (mockUserRepo.update        as jest.Mock).mockResolvedValue({});
    (mockRTRepo.revokeAllForUser as jest.Mock).mockResolvedValue({});
  });

  it('updates password hash in the database', async () => {
    await authService.changePassword('user-db-id', 'admin001', 'Admin@123', 'NewPass@1');
    expect(mockUserRepo.update).toHaveBeenCalledWith('user-db-id', { passwordHash: 'new_hash' });
  });

  it('revokes ALL refresh tokens to force re-login', async () => {
    await authService.changePassword('user-db-id', 'admin001', 'Admin@123', 'NewPass@1');
    expect(mockRTRepo.revokeAllForUser).toHaveBeenCalledWith('user-db-id');
  });

  it('throws when current password is incorrect', async () => {
    (mockBcrypt.compare as jest.Mock).mockResolvedValue(false as never);
    await expect(
      authService.changePassword('user-db-id', 'admin001', 'WrongOld', 'NewPass@1')
    ).rejects.toThrow('Current password is incorrect');
    expect(mockUserRepo.update).not.toHaveBeenCalled();
  });

  it('throws when user not found', async () => {
    (mockUserRepo.findByUserId as jest.Mock).mockResolvedValue(null);
    await expect(
      authService.changePassword('user-db-id', 'ghost', 'any', 'NewPass@1')
    ).rejects.toThrow('User not found');
  });
});
