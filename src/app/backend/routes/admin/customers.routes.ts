import { Router } from 'express';
import { listCustomersController } from '../../controllers/customers.controller';
import { authenticate, requireAccountType } from '../../middleware/auth.middleware';

const router = Router();

router.use(authenticate, requireAccountType('master_admin'));
router.get('/', listCustomersController);

export default router;
