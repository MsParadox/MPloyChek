// ============================================================
// MPloyChek v4.0 — Document Routes (Priority 3)
// Zero-cost storage: local disk + optional Cloudinary free tier
// Author: Mohit Sharma
// ============================================================
import { Router, Request, Response } from 'express';
import * as path from 'path';
import * as fs   from 'fs';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { uploadDocumentSchema } from '../schemas/index';
import { upload, saveFile, deleteFile, UPLOAD_DIR } from '../lib/storage';
import { documentRepo, auditRepo, candidateRepo } from '../repositories/index';
import { AUDIT_ACTIONS } from '../repositories/index';
import logger from '../lib/logger';

const router = Router();

// ── GET /api/documents/file/:filename ─────────────────────────
// Serve a locally-stored file (used when Cloudinary is NOT configured).
// This MUST be public (defined before `authenticate`): the browser loads it
// directly via <a>/<img>, which cannot attach the JWT Authorization header.
// Filenames are random UUIDs scoped by candidateId, so they act as a capability.
router.get('/file/:filename', (req: Request, res: Response): void => {
  const filename    = path.basename(req.params['filename']); // prevent path traversal
  const candidateId = path.basename((req.query['candidateId'] as string) || ''); // sanitize
  const filePath    = path.join(UPLOAD_DIR, 'candidates', candidateId, filename);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ success: false, error: 'File not found', timestamp: new Date().toISOString() });
    return;
  }
  res.sendFile(filePath);
});

// Everything below requires a valid JWT.
router.use(authenticate);

// ── POST /api/documents/upload/:candidateId ───────────────────
// Upload a document for a candidate
router.post(
  '/upload/:candidateId',
  upload.single('file'),
  validate(uploadDocumentSchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { candidateId } = req.params;
    const { type = 'General', name } = req.body as { type?: string; name?: string };
    const file = req.file;

    if (!file) {
      res.status(400).json({ success: false, error: 'No file uploaded', timestamp: new Date().toISOString() });
      return;
    }

    try {
      // Verify candidate exists
      const candidate = await candidateRepo.findById(candidateId);
      if (!candidate) {
        // Remove orphaned upload
        fs.unlink(file.path, () => {});
        res.status(404).json({ success: false, error: 'Candidate not found', timestamp: new Date().toISOString() });
        return;
      }

      // Save to Cloudinary (if configured) or keep local
      const storage = await saveFile(file.path, file.originalname, candidateId, type);

      // Persist document record in DB
      const doc = await documentRepo.create({
        candidateId,
        name:        name || file.originalname,
        type,
        storagePath: storage.storagePath,
        storageUrl:  storage.storageUrl,
        mimeType:    file.mimetype,
        sizeBytes:   file.size,
        uploadedBy:  req.user!.sub,
      });

      // Audit log (Priority 6: DOCUMENT_UPLOADED event)
      await auditRepo.create({
        action:          AUDIT_ACTIONS.DOCUMENT_UPLOADED,
        performedById:   req.user!.sub,
        performedByName: req.user!.userId,
        targetId:        doc.id,
        targetType:      'Document',
        details:         `Uploaded ${type} document "${doc.name}" for candidate ${candidateId} (${storage.provider})`,
        ipAddress:       req.ip || '',
        userAgent:       req.headers['user-agent'] || '',
        success:         true,
      });

      res.status(201).json({
        success:   true,
        data:      doc,
        message:   `Document uploaded successfully via ${storage.provider}`,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      logger.error('Document upload error', { error: err });
      // Cleanup on failure
      if (file?.path && fs.existsSync(file.path)) fs.unlink(file.path, () => {});
      res.status(500).json({ success: false, error: 'Upload failed', timestamp: new Date().toISOString() });
    }
  }
);

// ── GET /api/documents/candidate/:candidateId ─────────────────
// List all documents for a candidate
router.get('/candidate/:candidateId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const docs = await documentRepo.findByCandidateId(req.params['candidateId']);
    res.json({ success: true, data: docs, total: docs.length, timestamp: new Date().toISOString() });
  } catch (err) {
    logger.error('GET /documents/candidate/:id', { error: err });
    res.status(500).json({ success: false, error: 'Failed to fetch documents', timestamp: new Date().toISOString() });
  }
});

// ── GET /api/documents/:id ────────────────────────────────────
// Get document metadata
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const doc = await documentRepo.findById(req.params['id']);
  if (!doc) {
    res.status(404).json({ success: false, error: 'Document not found', timestamp: new Date().toISOString() });
    return;
  }
  res.json({ success: true, data: doc, timestamp: new Date().toISOString() });
});

// ── DELETE /api/documents/:id ─────────────────────────────────
// Delete a document
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const doc = await documentRepo.findById(req.params['id']);
    if (!doc) {
      res.status(404).json({ success: false, error: 'Document not found', timestamp: new Date().toISOString() });
      return;
    }

    // Only admin/manager or uploader can delete
    const isPriv = req.user?.role === 'Admin' || req.user?.role === 'Manager';
    if (!isPriv && doc.uploadedBy !== req.user?.sub) {
      res.status(403).json({ success: false, error: 'Forbidden — you can only delete your own documents', timestamp: new Date().toISOString() });
      return;
    }

    // Delete from storage
    const provider = doc.storageUrl.startsWith('https://res.cloudinary') ? 'cloudinary' : 'local';
    await deleteFile(doc.storagePath, provider);

    // Delete DB record
    await documentRepo.delete(doc.id);

    // Audit log (Priority 6: DOCUMENT_DELETED event)
    await auditRepo.create({
      action:          AUDIT_ACTIONS.DOCUMENT_DELETED,
      performedById:   req.user!.sub,
      performedByName: req.user!.userId,
      targetId:        doc.id,
      targetType:      'Document',
      details:         `Deleted document "${doc.name}" (type: ${doc.type}) for candidate ${doc.candidateId}`,
      ipAddress:       req.ip || '',
      userAgent:       req.headers['user-agent'] || '',
      success:         true,
    });

    res.json({ success: true, message: 'Document deleted successfully', timestamp: new Date().toISOString() });
  } catch (err) {
    logger.error('DELETE /documents/:id', { error: err });
    res.status(500).json({ success: false, error: 'Delete failed', timestamp: new Date().toISOString() });
  }
});

export default router;
