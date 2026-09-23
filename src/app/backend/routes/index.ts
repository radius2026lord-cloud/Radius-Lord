import { Router } from 'express';

//Auth
import authRoutes from './auth/auth.routes'; // Login
import authLogoutRoutes from './auth/logout.route'; //Logout
import adminCustomersRoutes from './admin/customers.routes';
import adminAuditRoutes from './admin/audit.routes';

const router = Router();

// تجميع الروتات
//Auth
router.use('/auth', authRoutes); // Login
router.use('/auth', authLogoutRoutes);
router.use('/admin/customers', adminCustomersRoutes);
router.use('/admin/audit-logs', adminAuditRoutes);
//Logout
export default router;
