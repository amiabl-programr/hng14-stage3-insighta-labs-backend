import { Router } from 'express';
import {
  createProfile,
  getProfile,
  getProfiles,
  deleteProfile,
  searchProfiles,
  exportProfiles,
} from '../controllers/profile.controller.js';
import { uploadCSV } from '../controllers/csvupload.controller.js';
import { getJobStatus } from '../controllers/job.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/authorize.middleware.js';
import { requireApiVersion } from '../middlewares/apiversion.middleware.js';
import upload from '../middlewares/upload.middleware.js';

const router = Router();

router.use(requireApiVersion);
router.use(authenticate);

router.get('/search', searchProfiles);
router.get('/export', exportProfiles);
router.get('/', getProfiles);
router.post('/', requireRole('ADMIN'), createProfile);
router.get('/:id', getProfile);
router.delete('/:id', requireRole('ADMIN'), deleteProfile);
router.post('/upload', requireRole('ADMIN'), upload.single('file'), uploadCSV);
router.get('/upload/:jobId', getJobStatus);

export default router;
