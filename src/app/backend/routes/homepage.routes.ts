import { Router } from 'express';
import { authenticate, requireAccountType } from '../middleware/auth.middleware';
import { getHomepageController, getHomepageSettingsController, updateHomepageSettingsController } from '../controllers/homepage.controller';

const router = Router();
router.use(authenticate);
router.get('/', getHomepageController);
router.get('/settings', requireAccountType('master_admin'), getHomepageSettingsController);
router.put('/settings', requireAccountType('master_admin'), updateHomepageSettingsController);
export default router;
