import { Router } from 'express';
import { authenticate,requireAccountType } from '../../middleware/auth.middleware';
import { createPaymentOrderController,getPaymentSettingsController,getPublicPaymentSettingsController,updatePaymentSettingsController } from '../../controllers/billing.controller';
const router=Router();
router.get('/settings/public',authenticate,requireAccountType('customer'),getPublicPaymentSettingsController);
router.post('/orders',authenticate,requireAccountType('customer'),createPaymentOrderController);
router.get('/settings',authenticate,requireAccountType('master_admin'),getPaymentSettingsController);
router.patch('/settings',authenticate,requireAccountType('master_admin'),updatePaymentSettingsController);
export default router;
