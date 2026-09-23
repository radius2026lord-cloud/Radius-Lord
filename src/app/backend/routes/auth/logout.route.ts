import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth.middleware';
import { writeAuditLog } from '../../services/audit.service';

const router = Router();

router.post('/logout', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    if (req.auth?.accountType === 'master_admin') {
      await writeAuditLog(req, {
        actionCode: 'LOGOUT',
        entityTypeCode: 'MASTER_ADMIN',
        entityId: req.auth.accountId,
        description: 'تسجيل خروج مدير النظام',
      });
    }
  } catch (err) {
    console.error('Logout audit error:', err);
  }

  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
  return res.json({ success: true, message: 'تم تسجيل الخروج بنجاح' });
});

export default router;
