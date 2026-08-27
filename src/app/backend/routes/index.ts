import { Router } from 'express';

//Auth
import authRoutes from './auth/auth.routes'; // Login
import authLogoutRoutes from './auth/logout.route'; //Logout

// NAS
import nasRoutes from './nas/nas.routes';

const router = Router();

// تجميع الروتات
//Auth
router.use('/auth', authRoutes); // Login
router.use('/auth', authLogoutRoutes);
//Logout

// NAS
router.use('/nas', nasRoutes);

export default router;
