import multer from 'multer';
import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 8 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.has(file.mimetype)) cb(null, true);
    else cb(AppError.badRequest(`Unsupported file type: ${file.mimetype}`));
  },
});
