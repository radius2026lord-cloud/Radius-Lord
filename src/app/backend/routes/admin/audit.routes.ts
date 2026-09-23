import { Router } from 'express';
import { listAuditLogsController } from '../../controllers/audit.controller';
import { authenticate, requireAccountType } from '../../middleware/auth.middleware';

const router = Router();
router.use(authenticate, requireAccountType('master_admin'));
router.get('/', listAuditLogsController);
export default router;
