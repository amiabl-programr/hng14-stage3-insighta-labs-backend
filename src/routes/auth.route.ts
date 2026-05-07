import { Router } from 'express';
import {
  initiateAuth,
  handleOAuthCallback,
  refreshToken,
  handleLogout,
} from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { doubleCsrfProtection } from '../lib/csrf.js';

const router = Router();

router.get('/github', initiateAuth);
router.get('/github/callback', handleOAuthCallback);
router.post('/refresh', doubleCsrfProtection, refreshToken);
router.post('/logout', doubleCsrfProtection, authenticate, handleLogout);

export default router;
