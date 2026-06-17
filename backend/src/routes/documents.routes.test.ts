// ============================================================
// MPloyChek v4.0 — Documents Routes Integration Tests
// Approach: mock '../lib/storage' entirely so upload.single() is
//           a simple pass-through middleware that sets req.file.
//           Use JSON body (express.json parses it; no real multipart needed).
// ============================================================

// ── Hoist mocks before any imports ───────────────────────────
jest.mock('../repositories/index');
jest.mock('../repositories/user.repository');
jest.mock('../lib/logger', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// Mock the entire storage module so upload.single is a controllable middleware
jest.mock('../lib/storage', () => {
  const mockMiddleware = (_req: any, _res: any, next: any) => next();
  return {
    upload: {
      single: jest.fn(() => (req: any, _res: any, next: any) => {
        // Simulate multer: attach a fake file object to req
        req.file = {
          fieldname:    'file',
          originalname: 'test_resume.pdf',
          encoding:     '7bit',
          mimetype:     'application/pdf',
          path:         '/tmp/test_abc123.pdf',
          filename:     'test_abc123.pdf',
          size:         102400,
        };
        next();
      }),
    },
    saveFile:        jest.fn(),
    deleteFile:      jest.fn(),
    UPLOAD_DIR:      '/tmp/test-uploads',
    ensureUploadDir: jest.fn(),
    ALLOWED_MIME_TYPES: ['application/pdf', 'image/jpeg', 'image/png'],
    MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024,
    // suppress "unused" warning
    _middleware: mockMiddleware,
  };
});

import express      from 'express';
import supertest    from 'supertest';
import docsRouter   from './documents.routes';
import { documentRepo, candidateRepo, auditRepo } from '../repositories/index';
import { saveFile, deleteFile }                    from '../lib/storage';
import {
  ADMIN_TOKEN, USER_TOKEN,
  makeDocument, makeSerializedCandidate,
} from '../__tests__/helpers/factories';

const app = express();
app.use(express.json());                 // parse JSON bodies
app.use('/api/documents', docsRouter);
const request = supertest(app);

const mockDocRepo  = documentRepo  as jest.Mocked<typeof documentRepo>;
const mockCandRepo = candidateRepo as jest.Mocked<typeof candidateRepo>;
const mockAudit    = auditRepo     as jest.Mocked<typeof auditRepo>;
const mockSave     = saveFile      as jest.MockedFunction<typeof saveFile>;
const mockDel      = deleteFile    as jest.MockedFunction<typeof deleteFile>;

// ── Upload tests ──────────────────────────────────────────────
describe('POST /api/documents/upload/:candidateId', () => {
  const CAND_ID = 'cand-uuid-arjun-001';

  beforeEach(() => {
    (mockCandRepo.findById as jest.Mock).mockResolvedValue(makeSerializedCandidate());
    mockSave.mockResolvedValue({
      storagePath: `uploads/candidates/${CAND_ID}/abc123.pdf`,
      storageUrl:  `/api/documents/file/abc123.pdf?candidateId=${CAND_ID}`,
      provider:    'local',
    });
    (mockDocRepo.create as jest.Mock).mockResolvedValue(makeDocument());
    (mockAudit.create   as jest.Mock).mockResolvedValue({});
  });

  it('201 — uploads successfully with type=Resume', async () => {
    const res = await request
      .post(`/api/documents/upload/${CAND_ID}`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ type: 'Resume', name: 'Arjun_CV.pdf' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id');
  });

  it('201 — defaults type to "General" when omitted', async () => {
    await request
      .post(`/api/documents/upload/${CAND_ID}`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({});
    expect(mockDocRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'General' })
    );
  });

  it('400 — rejects an invalid document type', async () => {
    const res = await request
      .post(`/api/documents/upload/${CAND_ID}`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ type: 'DriverLicense' });      // not in enum
    expect(res.status).toBe(400);
    expect(mockDocRepo.create).not.toHaveBeenCalled();
  });

  it('404 — returns 404 when candidate does not exist', async () => {
    (mockCandRepo.findById as jest.Mock).mockResolvedValue(null);
    const res = await request
      .post(`/api/documents/upload/${CAND_ID}`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ type: 'PAN' });
    expect(res.status).toBe(404);
    expect(mockDocRepo.create).not.toHaveBeenCalled();
  });

  it('401 — rejects unauthenticated requests', async () => {
    const res = await request
      .post(`/api/documents/upload/${CAND_ID}`)
      .send({ type: 'Resume' });
    expect(res.status).toBe(401);
  });

  it('writes DOCUMENT_UPLOADED audit event on success', async () => {
    await request
      .post(`/api/documents/upload/${CAND_ID}`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ type: 'Aadhaar', name: 'aadhaar.pdf' });
    expect(mockAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DOCUMENT_UPLOADED', success: true })
    );
  });

  it('calls saveFile with correct candidateId and docType', async () => {
    await request
      .post(`/api/documents/upload/${CAND_ID}`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ type: 'PAN' });
    expect(mockSave).toHaveBeenCalledWith(
      expect.stringContaining('tmp'),  // local path from multer mock
      expect.any(String),
      CAND_ID,
      'PAN',
    );
  });

  it('persists document with correct metadata in DB', async () => {
    await request
      .post(`/api/documents/upload/${CAND_ID}`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ type: 'Passport', name: 'passport_scan.pdf' });
    expect(mockDocRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateId: CAND_ID,
        mimeType:    'application/pdf',
        sizeBytes:   102400,
      })
    );
  });
});

// ── List tests ────────────────────────────────────────────────
describe('GET /api/documents/candidate/:candidateId', () => {
  it('200 — lists all documents for a candidate', async () => {
    (mockDocRepo.findByCandidateId as jest.Mock).mockResolvedValue([
      makeDocument(), makeDocument({ id: 'doc-uuid-002', name: 'Pan_Card.pdf', type: 'PAN' }),
    ]);
    const res = await request
      .get('/api/documents/candidate/cand-uuid-arjun-001')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.data).toHaveLength(2);
  });

  it('200 — returns empty array when no documents exist', async () => {
    (mockDocRepo.findByCandidateId as jest.Mock).mockResolvedValue([]);
    const res = await request
      .get('/api/documents/candidate/cand-uuid-arjun-001')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
  });

  it('401 — rejects unauthenticated list request', async () => {
    const res = await request.get('/api/documents/candidate/any-id');
    expect(res.status).toBe(401);
  });
});

// ── Single document tests ─────────────────────────────────────
describe('GET /api/documents/:id', () => {
  it('200 — returns document metadata', async () => {
    (mockDocRepo.findById as jest.Mock).mockResolvedValue(makeDocument());
    const res = await request
      .get('/api/documents/doc-uuid-001')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Arjun_Resume.pdf');
  });

  it('404 — returns 404 for non-existent document', async () => {
    (mockDocRepo.findById as jest.Mock).mockResolvedValue(null);
    const res = await request
      .get('/api/documents/ghost-id')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(res.status).toBe(404);
  });
});

// ── Delete tests ──────────────────────────────────────────────
describe('DELETE /api/documents/:id', () => {
  beforeEach(() => {
    (mockDocRepo.findById as jest.Mock).mockResolvedValue(
      makeDocument({ uploadedBy: 'user-uuid-admin-0001' })
    );
    (mockDocRepo.delete as jest.Mock).mockResolvedValue(true);
    mockDel.mockResolvedValue(true);
    (mockAudit.create   as jest.Mock).mockResolvedValue({});
  });

  it('200 — admin can delete any document', async () => {
    const res = await request
      .delete('/api/documents/doc-uuid-001')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(res.status).toBe(200);
    expect(mockDocRepo.delete).toHaveBeenCalledWith('doc-uuid-001');
  });

  it('200 — the uploader can delete their own document', async () => {
    (mockDocRepo.findById as jest.Mock).mockResolvedValue(
      makeDocument({ uploadedBy: 'user-uuid-usr-000001' })
    );
    const res = await request
      .delete('/api/documents/doc-uuid-001')
      .set('Authorization', `Bearer ${USER_TOKEN}`);
    expect(res.status).toBe(200);
  });

  it('403 — non-uploader general user cannot delete', async () => {
    (mockDocRepo.findById as jest.Mock).mockResolvedValue(
      makeDocument({ uploadedBy: 'some-other-user-id' })
    );
    const res = await request
      .delete('/api/documents/doc-uuid-001')
      .set('Authorization', `Bearer ${USER_TOKEN}`);
    expect(res.status).toBe(403);
    expect(mockDocRepo.delete).not.toHaveBeenCalled();
  });

  it('404 — returns 404 for a non-existent document', async () => {
    (mockDocRepo.findById as jest.Mock).mockResolvedValue(null);
    const res = await request
      .delete('/api/documents/ghost-id')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(res.status).toBe(404);
  });

  it('writes DOCUMENT_DELETED audit event with correct details', async () => {
    await request
      .delete('/api/documents/doc-uuid-001')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(mockAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action:     'DOCUMENT_DELETED',
        targetId:   'doc-uuid-001',
        targetType: 'Document',
        success:    true,
      })
    );
  });

  it('calls deleteFile with the document storagePath', async () => {
    const doc = makeDocument({ storagePath: 'uploads/candidates/cand1/abc.pdf' });
    (mockDocRepo.findById as jest.Mock).mockResolvedValue(doc);
    await request
      .delete('/api/documents/doc-uuid-001')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(mockDel).toHaveBeenCalledWith(
      'uploads/candidates/cand1/abc.pdf',
      expect.any(String)
    );
  });
});
