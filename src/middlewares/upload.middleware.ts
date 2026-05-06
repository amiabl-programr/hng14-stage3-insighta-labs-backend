import multer from 'multer';
import crypto from 'crypto';
import os from 'os';
import path from 'path';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, os.tmpdir());
  },
  filename: (_req, file, cb) => {
    cb(
      null,
      `profiles-${crypto.randomUUID()}${path.extname(file.originalname)}`,
    );
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
  limits: {
    fileSize: 100 * 1024 * 1024,
  },
});

export default upload;
