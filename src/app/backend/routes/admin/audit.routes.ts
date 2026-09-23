import { Router } from 'express';
import { customerAuditLogsController, listAuditLogsController } from '../../controllers/audit.controller';
import { authenticate, requireAccountType } from '../../middleware/auth.middleware';

const router = Router();
router.use(authenticate, requireAccountType('master_admin'));
router.get('/', listAuditLogsController);
router.get('/customer/:customerId', customerAuditLogsController);
export default router;
