// services/auth.ts
export const handleLogout = async () => {
  try {
    const res = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });

    const data = await res.json();
    console.log('📥 [Frontend] الرد:', data);

    if (res.ok && data.success) {
      console.log('✅ [Frontend] تسجيل الخروج ناجح');
      window.location.href = '/login'; // إعادة توجيه لصفحة تسجيل الدخول
    } else {
      alert(data.message || 'فشل تسجيل الخروج');
    }
  } catch (err) {
    console.error('💥 [Frontend] خطأ في الاتصال:', err);
  }
};
