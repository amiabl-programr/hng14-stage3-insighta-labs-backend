import { Router } from 'express';
import {
  initiateAuth,
  handleOAuthCallback,
  refreshToken,
  handleLogout,
} from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/github', initiateAuth);
router.get('/github/callback', handleOAuthCallback);
router.post('/refresh', refreshToken);
router.post('/logout', authenticate, handleLogout);

export default router;
