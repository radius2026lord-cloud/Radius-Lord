import { Router } from 'express';
import { getCustomerController, listCustomersController } from '../../controllers/customers.controller';
import { authenticate, requireAccountType } from '../../middleware/auth.middleware';

const router = Router();

router.use(authenticate, requireAccountType('master_admin'));
router.get('/', listCustomersController);
router.get('/:id', getCustomerController);

export default router;
