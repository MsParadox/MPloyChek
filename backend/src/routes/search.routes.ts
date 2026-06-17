import { Router, Response } from 'express';
import { authenticate, AuthRequest, withDelay } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { searchSchema } from '../schemas/index';
import { recordRepo, candidateRepo } from '../repositories/index';
import { userRepo } from '../repositories/user.repository';

const router = Router();
router.use(authenticate);

router.get('/', withDelay, validate(searchSchema, 'query'), async (req: AuthRequest, res: Response): Promise<void> => {
  const { q, limit } = req.query as any;
  const isPriv = ['Admin','Manager'].includes(req.user?.role||'');
  const lower = q.toLowerCase();

  const [allRecords, allCandidates] = await Promise.all([
    recordRepo.findAll(isPriv ? undefined : { ownerId: req.user!.sub }),
    candidateRepo.findAll(isPriv ? undefined : { createdById: req.user!.sub }),
  ]);

  const records = allRecords
    .filter((r:any) => `${r.candidateName} ${r.type} ${r.status} ${r.billingCode} ${r.remarks}`.toLowerCase().includes(lower))
    .slice(0, limit)
    .map((r:any) => ({ id:r.id, title:r.candidateName, subtitle:r.type, meta:r.status, type:'record', link:`/records/${r.id}` }));

  const candidates = allCandidates
    .filter((c:any) => `${c.firstName} ${c.lastName} ${c.email} ${c.nationality}`.toLowerCase().includes(lower))
    .slice(0, limit)
    .map((c:any) => ({ id:c.id, title:`${c.firstName} ${c.lastName}`, subtitle:c.email, meta:`${c.riskLevel} Risk`, type:'candidate', link:`/candidates/${c.id}` }));

  const users = isPriv
    ? (await userRepo.findAll())
        .filter((u:any) => `${u.firstName} ${u.lastName} ${u.userId} ${u.email} ${u.department}`.toLowerCase().includes(lower))
        .slice(0, 3)
        .map((u:any) => ({ id:u.id, title:`${u.firstName} ${u.lastName}`, subtitle:u.email, meta:u.role, type:'user', link:'/admin/users' }))
    : [];

  const total = records.length + candidates.length + users.length;
  res.json({ success:true, data:{ records, candidates, users }, total, query:q, timestamp:new Date().toISOString() });
});

export default router;
