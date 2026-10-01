import { Router } from 'express';

//Auth
import authRoutes from './auth/auth.routes'; // Login
import authLogoutRoutes from './auth/logout.route'; //Logout
import adminCustomersRoutes from './admin/customers.routes';
import adminAuditRoutes from './admin/audit.routes';
import adminPaymentPlansRoutes from './admin/payment-plans.routes';
import billingRoutes from './admin/billing.routes';
import adminPlatformSettingsRoutes from './admin/platform-settings.routes';
import customerPaymentSettingsRoutes from './customer/payment-settings.routes';

import homepageRoutes from './homepage.routes';

const router = Router();
router.use('/homepage', homepageRoutes);

// تجميع الروتات
//Auth
router.use('/auth', authRoutes); // Login
router.use('/auth', authLogoutRoutes);
router.use('/admin/customers', adminCustomersRoutes);
router.use('/admin/audit-logs', adminAuditRoutes);
router.use('/admin/payment-plans', adminPaymentPlansRoutes);
router.use('/billing', billingRoutes);
router.use('/admin/platform-settings', adminPlatformSettingsRoutes);
router.use('/customer/payment-settings', customerPaymentSettingsRoutes);
//Logout
export default router;
