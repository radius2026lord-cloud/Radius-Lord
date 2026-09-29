import { Router } from 'express';
import { getPublicContactPaymentSettingsController } from '../../controllers/platform-settings.controller';
import { authenticate, requireAccountType } from '../../middleware/auth.middleware';
const router=Router();
router.get('/contact',authenticate,requireAccountType('customer'),getPublicContactPaymentSettingsController);
export default router;
