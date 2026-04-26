import { Router } from "express";
import {getRefreshToken, getGithubAuthCode, handleCallbackController, handleLogout} from '../controllers/auth.controller.js'

const router = Router();

router.get('/github', getGithubAuthCode);
router.get('/github/callback', handleCallbackController);
router.post('/refresh', getRefreshToken);
router.post('/logout', handleLogout);

export default router;