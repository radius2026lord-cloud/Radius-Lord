import { Router } from 'express';

const router = Router();

router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
  });
  return res.json({ success: true, message: 'تم تسجيل الخروج بنجاح' });
});

export default router; //
