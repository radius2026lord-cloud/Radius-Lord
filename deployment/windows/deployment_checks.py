"""Evidence-based SSH errors and read-only host readiness probe."""

def diagnose(text, ssh_exit=None):
    message = str(text).lower()
    rules = [
        (('remote host identification has changed', 'host key has changed'), 'HOST_KEY_CHANGED', 'تغيّرت بصمة الخادم', 'تحقق من بصمة الخادم عبر جلسة موثوقة قبل تحديث known_hosts. لا تتجاوز التحقق من الهوية.'),
        (('host key verification failed',), 'HOST_KEY_UNTRUSTED', 'لم تُعتمد بصمة الخادم', 'افتح جلسة SSH تفاعلية، وقارن البصمة بالخادم ثم اعتمدها إذا تطابقت.'),
        (('could not resolve hostname', 'name or service not known', 'no such host is known'), 'DNS_ERROR', 'تعذر تحديد عنوان الخادم', 'تحقق من اسم المضيف وDNS قبل إعادة الفحص.'),
        (('connection timed out', 'operation timed out', 'connect timeout'), 'TCP_TIMEOUT', 'انتهت مهلة الوصول إلى الخادم', 'أعد فحص الوصول إلى 78.155.66.122:3001 من شبكة أخرى، وراجع المسار والجدار الناري. هذه النتيجة لا تستدعي إنشاء مفتاح جديد.'),
        (('connection refused',), 'TCP_REFUSED', 'رُفض الاتصال على منفذ SSH', 'تحقق من خدمة SSH ومنفذ 3001 وتحويل المنفذ على جهة الاستضافة.'),
        (('no route to host', 'network is unreachable'), 'NO_ROUTE', 'لا يوجد مسار متاح إلى الخادم', 'تحقق من اتصال الإنترنت ومسار الوصول إلى الاستضافة.'),
        (('agent refused operation', 'could not open a connection to your authentication agent'), 'AGENT_ERROR', 'تعذر استخدام مفتاح SSH Agent', 'راجع الخطوة 3: شغّل الخدمة ثم حمّل المفتاح المحدد بعبارة مروره.'),
        (('bad permissions', 'unprotected private key file'), 'KEY_PERMISSIONS', 'صلاحيات ملف المفتاح غير مقبولة', 'راجع صلاحيات المفتاح الخاص على Windows واجعله متاحًا لحسابك فقط.'),
        (('invalid format', 'no such identity', 'identity file', 'error in libcrypto'), 'KEY_FILE_ERROR', 'تعذر قراءة ملف المفتاح', 'اختر ملف المفتاح الخاص الصحيح وراجع وجود ملفه العام .pub في إعداد الاتصال.'),
        (('permission denied (publickey', 'permission denied, please try again', 'authentication failed'), 'AUTH_REJECTED', 'الخادم رفض المصادقة', 'تم الوصول إلى الخادم. تحقق من المستخدم root، والمفتاح المحمّل، وتثبيت مفتاحه العام. الرفض وحده لا يثبت أن كلمة المرور خاطئة.'),
        (('connection reset', 'connection closed', 'kex_exchange_identification', 'banner exchange'), 'SSH_INTERRUPTED', 'انقطع الاتصال أثناء تفاوض SSH', 'راجع السجل وخدمة SSH والمسار الشبكي؛ لا تفترض اكتمال أي عملية كتابة قبل قراءة حالتها.'),
    ]
    for markers, code, title, action in rules:
        if any(marker in message for marker in markers):
            # Avoid treating an ordinary debug identity-file line as a key failure.
            if code == 'KEY_FILE_ERROR' and 'identity file' in message and not any(s in message for s in ('not accessible', 'no such file', 'invalid format', 'no such identity', 'error in libcrypto')):
                continue
            return {'code': code, 'title': title, 'action': action}
    if ssh_exit == 255:
        return {'code': 'SSH_UNCLASSIFIED', 'title': 'تعذر إكمال اتصال SSH',
                'action': 'راجع رسالة SSH في السجل؛ الرمز 255 وحده لا يحدد إن كان السبب من الشبكة أو الهوية أو المصادقة.'}
    return None


HOST_PROBE = r'''
import pathlib,json,shutil,fcntl,os
root=pathlib.Path('/srv/radius-lord')
space=shutil.disk_usage(root)
busy=False
lock=root/'deployment.lock'
if lock.exists():
 with lock.open('r+') as stream:
  try: fcntl.flock(stream,fcntl.LOCK_EX|fcntl.LOCK_NB)
  except BlockingIOError: busy=True
receipts=[]
recovery=(root/'maintenance-recovery.json').exists()
for path in (root/'status').glob('*.json'):
 try:
  data=json.loads(path.read_text())
  recovery=recovery or data.get('status')=='recovery_required'
  bid=data.get('backupId')
  if isinstance(bid,str) and '/' not in bid and (root/'shared/backups'/(bid+'.sql.gz')).is_file():
   receipts.append({'id':bid,'at':data.get('updatedAt',''),'source':'deployment'})
 except (OSError,ValueError): pass
vault=pathlib.Path('/var/backups/radius-lord-environment')
for path in vault.glob('b-*.json'):
 try:
  data=json.loads(path.read_text())
  bid=data.get('id')
  if data.get('verified') is True and isinstance(bid,str) and '/' not in bid and (vault/(bid+'.tar.gpg')).is_file():
   receipts.append({'id':bid,'at':data.get('createdAt',''),'source':'environment'})
 except (OSError,ValueError): pass
print(json.dumps({'freeBytes':space.free,'totalBytes':space.total,'deploymentBusy':busy,'recoveryRequired':recovery,
 'backupHook':os.access(root/'shared/hooks/backup',os.X_OK),
 'backupCredentials':(root/'shared/mysql-backup.cnf').is_file(),
 'latestVerifiedRecord':max(receipts,key=lambda r:r['at']) if receipts else None}))
'''
