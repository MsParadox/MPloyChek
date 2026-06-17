// ============================================================
// MPloyChek v4.0 — Document Storage (ZERO COST)
// FIX: Changed 'import * as multer' to 'import multer from multer'
//      (esModuleInterop:true in tsconfig means default import works)
//
// Storage strategy:
//   - Cloudinary (if env vars set): free 25 GB CDN, persists across deploys
//   - Local disk (fallback): ephemeral on Render free tier
//
// Author: Mohit Sharma
// ============================================================
import multer from 'multer';              // FIX 8: default import, not namespace import
import * as path from 'path';
import * as fs   from 'fs';
import { v4 as uuidv4 } from 'uuid';
import logger from './logger';

// ── Constants ─────────────────────────────────────────────────
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// ── Upload directory ───────────────────────────────────────────
export const UPLOAD_DIR = process.env['UPLOAD_DIR'] || path.join(process.cwd(), 'uploads');

export function ensureUploadDir(subDir: string): string {
  const dir = path.join(UPLOAD_DIR, subDir);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ── Multer disk storage ────────────────────────────────────────
const diskStorage = multer.diskStorage({          // FIX: multer.diskStorage (not multer.default.diskStorage)
  destination: (req, _file, cb) => {
    const candidateId = (req as any).params?.candidateId || 'misc';
    const dir = ensureUploadDir(`candidates/${candidateId}`);
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uid = uuidv4().replace(/-/g, '').slice(0, 12);
    cb(null, `${uid}${ext}`);
  },
});

const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type "${file.mimetype}" not allowed. Accepted: PDF, JPEG, PNG, WEBP, DOC, DOCX`));
  }
};

// FIX: multer({...}) directly — not multer.default({...})
export const upload = multer({
  storage:   diskStorage,
  fileFilter,
  limits:    { fileSize: MAX_FILE_SIZE_BYTES },
});

// ── Storage result ─────────────────────────────────────────────
export interface StorageResult {
  storagePath: string;
  storageUrl:  string;
  provider:    'local' | 'cloudinary';
}

// ── Save to Cloudinary (if configured) or keep local ──────────
export async function saveFile(
  localPath: string,
  originalName: string,
  candidateId: string,
  docType: string,
): Promise<StorageResult> {
  const hasCloudinary =
    process.env['CLOUDINARY_CLOUD_NAME'] &&
    process.env['CLOUDINARY_API_KEY']    &&
    process.env['CLOUDINARY_API_SECRET'];

  if (hasCloudinary) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const cloudinary = require('cloudinary').v2;
      cloudinary.config({
        cloud_name: process.env['CLOUDINARY_CLOUD_NAME'],
        api_key:    process.env['CLOUDINARY_API_KEY'],
        api_secret: process.env['CLOUDINARY_API_SECRET'],
      });

      const folder   = `mploychek/candidates/${candidateId}`;
      const publicId = `${folder}/${docType}_${uuidv4().slice(0, 8)}`;

      const result = await cloudinary.uploader.upload(localPath, {
        resource_type: 'raw',
        public_id:     publicId,
        use_filename:  false,
      });

      fs.unlink(localPath, () => {}); // clean up local temp file
      logger.info('📁 Uploaded to Cloudinary', { publicId: result.public_id });

      return {
        storagePath: result.public_id,
        storageUrl:  result.secure_url,
        provider:    'cloudinary',
      };
    } catch (err) {
      logger.warn('⚠️  Cloudinary upload failed, keeping local file', { error: err });
    }
  }

  // Local fallback
  const relativePath = path.relative(process.cwd(), localPath);
  const fileUrl = `/api/documents/file/${path.basename(localPath)}?candidateId=${candidateId}`;

  logger.info('📁 Saved locally', { path: relativePath, originalName });
  return { storagePath: relativePath, storageUrl: fileUrl, provider: 'local' };
}

// ── Delete file ───────────────────────────────────────────────
export async function deleteFile(storagePath: string, provider: 'local' | 'cloudinary' = 'local'): Promise<boolean> {
  try {
    if (provider === 'cloudinary' && process.env['CLOUDINARY_CLOUD_NAME']) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const cloudinary = require('cloudinary').v2;
      await cloudinary.uploader.destroy(storagePath, { resource_type: 'raw' });
      logger.info('🗑️  Deleted from Cloudinary', { publicId: storagePath });
    } else {
      const fullPath = path.isAbsolute(storagePath)
        ? storagePath
        : path.join(process.cwd(), storagePath);
      if (fs.existsSync(fullPath)) { fs.unlinkSync(fullPath); }
      logger.info('🗑️  Deleted local file', { path: fullPath });
    }
    return true;
  } catch (err) {
    logger.error('❌ File delete failed', { storagePath, error: err });
    return false;
  }
}
