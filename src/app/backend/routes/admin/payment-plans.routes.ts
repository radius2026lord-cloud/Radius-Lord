import { Router } from 'express';
import { createPaymentPlanController, listPaymentPlansController, updatePaymentPlanController } from '../../controllers/payment-plans.controller';
import { authenticate, requireAccountType } from '../../middleware/auth.middleware';
const router=Router();
router.use(authenticate,requireAccountType('master_admin'));
router.get('/',listPaymentPlansController);
router.post('/',createPaymentPlanController);
router.patch('/:id',updatePaymentPlanController);
export default router;
