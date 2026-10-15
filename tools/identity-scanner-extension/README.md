# إضافة التقاط الهوية لـ Lord Radius (تجريبية)

تضيف هذه الإضافة اتصالًا محليًا من Chrome إلى قارئ Z-3052 عبر SNAPI. لا تحفظ الصور؛ ترجعها إلى النموذج في الذاكرة المؤقتة للصفحة فقط. تبقى قراءة PDF417 وتعبئة الحقول اليدوية والحفظ كما هي.

## المتطلبات

- Windows على جهاز اللابتوب، مع قارئ Z-3052 وSDK/تعريف يدعم SNAPI وواجهة التصوير.
- Python 3 وChrome.
- تشغيل PowerShell من نسخة المشروع.

## التثبيت

1. على Windows، انقر مرتين على `tools/install-identity-scanner.bat` وأدخل أصل الموقع كاملًا، مثل `https://radius.example.com`. للتطوير المحلي استخدم `http://localhost:3000`. يتطلب المثبّت وجود Python 3 وChrome مسبقًا، ثم يثبت متطلبات جسر الالتقاط ويسجل Native Messaging للمستخدم الحالي.

2. في صفحة Chrome التي يفتحها المثبّت، فعّل **Developer mode** واختر **Load unpacked** وحدد:

   ```text
   %LOCALAPPDATA%\LordRadius\IdentityCapture\extension
   ```

3. أعد تحميل صفحة Lord Radius. تظهر أزرار التقاط الوجه الأمامي والخلفي عند توفر الإضافة والقارئ.

يمكن تشغيل المثبّت مباشرة من PowerShell بدلًا من ملف BAT:

   ```powershell
   .\tools\identity-scanner-extension\install.ps1 -AppOrigin "https://عنوان-الموقع"
   ```

يقيد المثبّت الإضافة بأصل الموقع الذي أدخلته، ويسجل Native Messaging للمستخدم الحالي فقط. لا يحتاج التطبيق المنشور إلى الوصول المباشر إلى USB. تعالج عملية Python المحلية التقاط صورة القارئ فقط؛ الصور تبقى في الصفحة مؤقتًا، بينما تبقى معالجة بيانات الهوية الحالية منفصلة.

لإزالة الربط، احذف قيمة التسجيل `HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.radiuslord.identity_capture` واحذف مجلد `%LOCALAPPDATA%\LordRadius\IdentityCapture`، ثم أزل الإضافة من Chrome.
