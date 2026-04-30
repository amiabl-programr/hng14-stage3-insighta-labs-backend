import { Router } from 'express';
import {
  createProfile,
  getProfile,
  getProfiles,
  deleteProfile,
  searchProfiles,
} from '../controllers/profile.controller.js';

const router = Router();

router.get('/search', searchProfiles);
router.get('/', getProfiles);
router.post('/', createProfile);
router.get('/:id', getProfile);
router.delete('/:id', deleteProfile);

export default router;
