import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { notifRepo } from '../repositories/index';
import logger from '../lib/logger';

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notifs = await notifRepo.findByUserId(req.user!.sub);
    const unread = await notifRepo.getUnreadCount(req.user!.sub);
    res.json({ success: true, data: notifs, total: notifs.length, unread, timestamp: new Date().toISOString() });
  } catch (err) {
    logger.error('GET /notifications', { error: err });
    res.status(500).json({ success: false, error: 'Failed to fetch notifications', timestamp: new Date().toISOString() });
  }
});

// FIX: Define /mark-all-read BEFORE /:id/read to prevent routing ambiguity
router.patch('/mark-all-read', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await notifRepo.markAllRead(req.user!.sub);
    res.json({ success: true, message: 'All marked as read', timestamp: new Date().toISOString() });
  } catch (err) {
    logger.error('PATCH /notifications/mark-all-read', { error: err });
    res.status(500).json({ success: false, error: 'Failed to mark notifications as read', timestamp: new Date().toISOString() });
  }
});

router.patch('/:id/read', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const n = await notifRepo.markRead(req.params['id']);
    res.json({ success: true, data: n, timestamp: new Date().toISOString() });
  } catch (err) {
    logger.error('PATCH /notifications/:id/read', { error: err });
    res.status(500).json({ success: false, error: 'Failed to mark notification as read', timestamp: new Date().toISOString() });
  }
});

export default router;
