import { Router } from 'express';

//Auth
import authRoutes from './auth/auth.routes'; // Login
import authLogoutRoutes from './auth/logout.route'; //Logout

const router = Router();

// تجميع الروتات
//Auth
router.use('/auth', authRoutes); // Login
router.use('/auth', authLogoutRoutes);
//Logout
export default router;
