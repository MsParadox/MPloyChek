// ============================================================
// MPloyChek v4.0 — Notifications Routes Integration Tests
// Verifies route ordering (/mark-all-read before /:id/read).
// ============================================================
jest.mock('../repositories/index');
jest.mock('../lib/logger', () => ({ __esModule: true, default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import express from 'express';
import supertest from 'supertest';
import notifRouter from './notifications.routes';
import { notifRepo } from '../repositories/index';
import { USER_TOKEN } from '../__tests__/helpers/factories';

const app = express();
app.use(express.json());
app.use('/api/notifications', notifRouter);
const request = supertest(app);

const mockNotif = notifRepo as jest.Mocked<typeof notifRepo>;
const USER_ID = 'user-uuid-usr-000001';

describe('GET /api/notifications', () => {
  it('200 — returns notifications and unread count', async () => {
    (mockNotif.findByUserId as jest.Mock).mockResolvedValue([{ id: 'n1', read: false }, { id: 'n2', read: true }]);
    (mockNotif.getUnreadCount as jest.Mock).mockResolvedValue(1);
    const res = await request.get('/api/notifications').set('Authorization', `Bearer ${USER_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.unread).toBe(1);
    expect(mockNotif.findByUserId).toHaveBeenCalledWith(USER_ID);
  });

  it('401 — rejects missing token', async () => {
    const res = await request.get('/api/notifications');
    expect(res.status).toBe(401);
  });

  it('500 — surfaces repository failures', async () => {
    (mockNotif.findByUserId as jest.Mock).mockRejectedValue(new Error('db down'));
    const res = await request.get('/api/notifications').set('Authorization', `Bearer ${USER_TOKEN}`);
    expect(res.status).toBe(500);
  });
});

describe('PATCH /api/notifications/mark-all-read', () => {
  it('200 — marks all of the user\'s notifications read', async () => {
    (mockNotif.markAllRead as jest.Mock).mockResolvedValue({ count: 3 });
    const res = await request.patch('/api/notifications/mark-all-read').set('Authorization', `Bearer ${USER_TOKEN}`);
    expect(res.status).toBe(200);
    expect(mockNotif.markAllRead).toHaveBeenCalledWith(USER_ID);
    // Critical: must NOT be interpreted as /:id/read with id='mark-all-read'
    expect(mockNotif.markRead).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/notifications/:id/read', () => {
  it('200 — marks a single notification read', async () => {
    (mockNotif.markRead as jest.Mock).mockResolvedValue({ id: 'n1', read: true });
    const res = await request.patch('/api/notifications/n1/read').set('Authorization', `Bearer ${USER_TOKEN}`);
    expect(res.status).toBe(200);
    expect(mockNotif.markRead).toHaveBeenCalledWith('n1');
  });
});
