import { Router } from 'express';
import { getContactPaymentSettingsController, updateContactPaymentSettingsController } from '../../controllers/platform-settings.controller';
import { authenticate, requireAccountType } from '../../middleware/auth.middleware';
const router=Router();
router.use(authenticate,requireAccountType('master_admin'));
router.get('/contact-payment',getContactPaymentSettingsController);
router.put('/contact-payment',updateContactPaymentSettingsController);
export default router;
