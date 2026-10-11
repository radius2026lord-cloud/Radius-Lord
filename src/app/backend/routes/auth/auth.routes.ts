import {requireAuthOrigin} from '../../middleware/auth-origin.middleware';
import { Router } from 'express';

import {
  loginController,
  signupController,
  meController,
} from '../../controllers/auth.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();
router.use(requireAuthOrigin);

router.post('/login', loginController);
router.post('/signup', signupController);
router.get('/me', authenticate, meController);

export default router;
