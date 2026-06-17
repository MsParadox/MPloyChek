// ============================================================
// MPloyChek v4.0 — Storage Library Unit Tests
// Mocks: fs (filesystem side effects), logger (avoid winston I/O).
// Uses the REAL `path` module so behaviour is exercised faithfully
// and assertions stay cross-platform (separator-tolerant).
// ============================================================
jest.mock('fs');
jest.mock('./logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import * as fs from 'fs';
import * as path from 'path';
import {
  ensureUploadDir,
  deleteFile,
  saveFile,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
} from './storage';

const mockedFs = fs as jest.Mocked<typeof fs>;

describe('ensureUploadDir', () => {
  it('creates directory when it does not exist', () => {
    mockedFs.existsSync.mockReturnValue(false);
    mockedFs.mkdirSync.mockImplementation(() => undefined);

    ensureUploadDir(path.join('candidates', 'test-id'));

    expect(mockedFs.mkdirSync).toHaveBeenCalledTimes(1);
    const [dirArg, opts] = mockedFs.mkdirSync.mock.calls[0];
    expect(String(dirArg)).toContain('test-id');
    expect(opts).toEqual({ recursive: true });
  });

  it('does not create directory when it already exists', () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.mkdirSync.mockImplementation(() => undefined);

    ensureUploadDir(path.join('candidates', 'existing'));

    expect(mockedFs.mkdirSync).not.toHaveBeenCalled();
  });
});

describe('deleteFile — local provider', () => {
  it('returns true and unlinks an existing file', async () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.unlinkSync.mockImplementation(() => undefined);

    const target = path.join(path.sep, 'app', 'uploads', 'test.pdf');
    const result = await deleteFile(target, 'local');

    expect(result).toBe(true);
    expect(mockedFs.unlinkSync).toHaveBeenCalledWith(target);
  });

  it('returns true gracefully when file does not exist', async () => {
    mockedFs.existsSync.mockReturnValue(false);

    const result = await deleteFile(path.join(path.sep, 'app', 'uploads', 'missing.pdf'), 'local');

    expect(result).toBe(true);
    expect(mockedFs.unlinkSync).not.toHaveBeenCalled();
  });

  it('returns false when an error is thrown', async () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.unlinkSync.mockImplementation(() => { throw new Error('EPERM'); });

    const result = await deleteFile(path.join(path.sep, 'app', 'uploads', 'locked.pdf'), 'local');

    expect(result).toBe(false);
  });
});

describe('saveFile — local fallback (no Cloudinary env vars)', () => {
  beforeEach(() => {
    delete process.env['CLOUDINARY_CLOUD_NAME'];
    delete process.env['CLOUDINARY_API_KEY'];
    delete process.env['CLOUDINARY_API_SECRET'];
  });

  it('returns local provider when Cloudinary is not configured', async () => {
    const result = await saveFile(path.join(path.sep, 'tmp', 'abc.pdf'), 'resume.pdf', 'cid', 'Resume');
    expect(result.provider).toBe('local');
    expect(result.storageUrl).toContain('/api/documents/file/');
    expect(result.storageUrl).toContain('abc.pdf');
  });

  it('storageUrl contains the candidateId for file serving', async () => {
    const result = await saveFile(path.join(path.sep, 'tmp', 'abc.pdf'), 'resume.pdf', 'my-candidate-id', 'Resume');
    expect(result.storageUrl).toContain('my-candidate-id');
  });
});

describe('ALLOWED_MIME_TYPES', () => {
  it('exports the correct allowed types', () => {
    expect(ALLOWED_MIME_TYPES).toContain('application/pdf');
    expect(ALLOWED_MIME_TYPES).toContain('image/jpeg');
    expect(ALLOWED_MIME_TYPES).toContain('image/png');
    expect(ALLOWED_MIME_TYPES).not.toContain('text/html');
    expect(ALLOWED_MIME_TYPES).not.toContain('application/javascript');
  });
});

describe('MAX_FILE_SIZE_BYTES', () => {
  it('is exactly 10 MB', () => {
    expect(MAX_FILE_SIZE_BYTES).toBe(10 * 1024 * 1024);
  });
});
