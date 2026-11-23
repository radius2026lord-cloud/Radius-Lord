#!/usr/bin/env python3
"""Local-only Qt WebEngine shell sharing the existing deployment operations."""
import datetime as dt
import importlib.util
import json
import os
import pathlib
import queue
import re
import shlex
import subprocess
import shutil
import sys
import threading
import time
import uuid

from PySide6.QtCore import QObject, QTimer, QUrl, Signal, Slot, QEvent
from PySide6.QtWidgets import QApplication, QFileDialog, QInputDialog, QLineEdit, QMainWindow, QMessageBox, QToolTip
from PySide6.QtWebChannel import QWebChannel
from PySide6.QtWebEngineCore import QWebEnginePage, QWebEngineSettings, QWebEngineUrlRequestInterceptor, QWebEngineProfile
from PySide6.QtWebEngineWidgets import QWebEngineView

from deployment_checks import diagnose, HOST_PROBE
from operation_history import History, WRITE_ACTIONS, redact
from bounded_process import capture_readonly

HERE = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('radius_legacy_console', HERE / 'deploy-console.py')
legacy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(legacy)


class Value:
    def __init__(self, value):
        self.value = value
    def get(self):
        return self.value
    def set(self, value):
        self.value = value


class TrackedQueue(queue.Queue):
    def __init__(self, owner):
        super().__init__()
        self.owner = owner
    def put(self, item, *args, **kwargs):
        identifier = getattr(self.owner.worker_context, 'identifier', self.owner.current_job_id)
        return super().put((*item, identifier), *args, **kwargs)


class Operations(legacy.Console):
    """No Tk window: inherit only the established SSH/Git/backup operations."""
    def __init__(self):
        try:
            prefs = json.loads(legacy.PREFERENCES.read_text(encoding='utf-8'))
        except (OSError, ValueError):
            prefs = {}
        self.project = Value(prefs.get('project', str(HERE.parents[1])))
        self.key = Value(prefs.get('key', str(pathlib.Path.home() / '.ssh/id_ed25519_radius_lord')))
        self.version = Value(prefs.get('version', 'v1.0.4'))
        self.changes = Value('')
        self.dark = prefs.get('dark', True)
        self.current_job_id = None
        self.worker_context = threading.local()
        self.events = TrackedQueue(self)
        self.validated = None
        self.process = None
        self.terminal_process = None
        self.write_started = False


    def rpc(self, action, key, data=None):
        request = dict(data or {})
        if self.current_job_id and action in ('create', 'restore', 'delete', 'schedule', 'reset-apply'):
            request['operationId'] = self.current_job_id
            self.write_started = True
        if action in ('list','operation-status'):
            result = capture_readonly([*self.ssh(key), 'python3 ' + legacy.BACKUP_HELPER + ' ' + action],
                                      timeout=25, input_bytes=json.dumps(request).encode('utf-8'), creationflags=legacy.NO_WINDOW, cancel_event=getattr(self.worker_context, 'cancel', None))
            if result.returncode:
                output = result.stderr.decode('utf-8', errors='replace')
                diagnostic = diagnose(output, result.returncode if result.returncode == 255 else None)
                if diagnostic:
                    self.events.put(('diagnostic', diagnostic))
                raise RuntimeError(output or 'تعذر قراءة حالة الخادم')
            return json.loads(result.stdout)
        return super().rpc(action, key, request)

    def run(self, args, *values, **options):
        program_name = pathlib.Path(args[0]).name.lower()
        command = args[-1] if args else ''
        if program_name in ('ssh', 'ssh.exe') and (command.endswith(' inspect') or command.startswith('python3 -c ')):
            options.setdefault('timeout', 30)
            options.setdefault('wait_on_timeout', False)
        if pathlib.Path(args[0]).name.lower() in ('git', 'git.exe') and 'push' in args:
            self.write_started = True
        try:
            if options.get('wait_on_timeout') is False:
                result = capture_readonly(args, options.get('timeout',30), cwd=options.get('cwd'),
                                          env=options.get('env'), creationflags=legacy.NO_WINDOW, cancel_event=getattr(self.worker_context, 'cancel', None))
                output = result.stdout.decode('utf-8', errors='replace')
                error = result.stderr.decode('utf-8', errors='replace')
                if options.get('stream') or result.returncode:
                    self.events.put(('log', output + error))
                if result.returncode:
                    raise legacy.CommandFailure(args[0], result.returncode, output + error)
                return output.strip()
            return super().run(args, *values, **options)
        except legacy.CommandFailure as error:
            program = pathlib.Path(error.program).name.lower()
            diagnostic = diagnose(error.output, error.code if program in ('ssh', 'ssh.exe') else None)
            if diagnostic and (program in ('ssh', 'ssh.exe') or 'ssh' in error.output.lower()):
                error.diagnostic = diagnostic
                self.events.put(('diagnostic', diagnostic))
                raise RuntimeError(diagnostic['title'] + ' — ' + diagnostic['action']) from error
            raise

    def inspect_host(self, project, key, version, changes):
        names = ['radius-lord-backend', 'radius-lord-frontend', 'mysql', 'freeradius']
        self.events.put(('connected', '🟡 جارٍ فحص SSH والخدمات'))
        self.events.put(('services', ({name: 'checking' for name in names}, 'جارٍ الفحص')))
        self.events.put(('state', 'فحص SSH وعامل النشر والخدمات — مهلة النتيجة 30 ثانية'))
        self.events.put(('log', 'بدء أمر SSH لفحص الخادم؛ الحد الأقصى للانتظار 30 ثانية.\n'))
        # One SSH connection, bounded subprocesses, no service changes.
        code = """import subprocess,json
r=subprocess.run(['sudo','-n','-u','radiusdeploy','python3','/srv/radius-lord/repository.git/hooks/radius-deploy.py','inspect'],capture_output=True,text=True,timeout=15)
if r.returncode: raise RuntimeError('Receiver inspection failed: exit '+str(r.returncode))
info=json.loads(r.stdout)
states={}
for name in ['radius-lord-backend','radius-lord-frontend','mysql','freeradius']:
 try:
  r=subprocess.run(['systemctl','is-active',name],capture_output=True,text=True,timeout=2)
  states[name]=r.stdout.strip() or 'unknown'
 except subprocess.TimeoutExpired: states[name]='unknown'
print(json.dumps({'receiver':info,'services':states}))
"""
        try:
            result = json.loads(self.run([*self.ssh(key), 'python3 -c ' + shlex.quote(code)], timeout=30, wait_on_timeout=False))
            info = result['receiver']
            self.events.put(('log', json.dumps(info, ensure_ascii=False) + '\n'))
            self.events.put(('services', (result['services'], dt.datetime.now().strftime('%Y-%m-%d %H:%M:%S'))))
            self.events.put(('summary', 'الإصدار الجاري: ' + str(info.get('currentVersion'))))
            self.events.put(('connected', '🟢 نجح اتصال SSH وفحص الخدمات'))
        except Exception as error:
            self.events.put(('services', ({}, 'تعذر الفحص')))
            self.events.put(('connected', '🔴 تعذر الفحص: ' + str(error)))
            raise

    def transfer(self, key, local, remote, upload=False, install=False):
        if upload:
            self.write_started = True
        return super().transfer(key, local, remote, upload=upload, install=install)

    def readiness(self, project, key, version, changes):
        result = {'ready': False, 'checks': [], 'targetVersion': version, 'targetCommit': None,
                  'currentVersion': None, 'currentCommit': None, 'host': None}
        def check(name, ok, detail=''):
            result['checks'].append({'name': name, 'ok': bool(ok), 'detail': detail})
        try:
            project = self.repository(project)
            commit = self.run(['git', 'rev-parse', 'HEAD'], project)
            result['targetCommit'] = commit
            check('المستودع والفرع ونظافة الملفات', True)
            check('نجاح بناء هذا التعديل', self.validated == (project, commit), 'يجب بناء الباك إند والفرونت إند في جلسة الأداة الحالية')
            remote = self.run(['git', 'remote', 'get-url', '--push', 'production'], project)
            check('وجهة النشر المعتمدة', remote == legacy.REMOTE)
        except Exception as error:
            commit = None
            check('المشروع المحلي', False, str(error))
        valid_version = bool(re.fullmatch(r'v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)', version))
        check('رقم الإصدار ووصف التغييرات', valid_version and 0 < len(changes) <= 4000, 'مثل v1.0.4 مع وصف للتغيير')
        try:
            info = json.loads(self.run([*self.ssh(key), 'sudo -n -u radiusdeploy python3 ' + legacy.HELPER + ' inspect']))
            result.update(currentVersion=info.get('currentVersion'), currentCommit=info.get('currentCommit'))
            for item in info.get('checks', []):
                check(item['name'], item['ok'])
            check('عامل النشر جاهز', info.get('ready') is True)
            host = json.loads(self.run([*self.ssh(key), 'python3 -c ' + shlex.quote(HOST_PROBE)], timeout=30))
            result['host'] = host
            self.events.put(('connected', '🟢 نجح اتصال SSH أثناء فحص الجاهزية'))
            check('المساحة الحرة', host['freeBytes'] >= 2 * 1024**3, '%.1f GiB متاحة' % (host['freeBytes'] / 1024**3))
            check('لا توجد عملية نشر جارية', not host['deploymentBusy'])
            check('لا توجد استعادة تحتاج معالجة', not host['recoveryRequired'])
            check('إعداد النسخ قبل النشر', host['backupHook'] and host['backupCredentials'], 'تهيئة العامل فقط؛ النسخة الجديدة تؤخذ وتُفحص أثناء النشر')
            if valid_version and info.get('currentVersion'):
                current = info['currentVersion']
                try:
                    newer = tuple(map(int, version[1:].split('.'))) > tuple(map(int, current[1:].split('.')))
                except (ValueError, AttributeError):
                    newer = False
                check('الإصدار الجديد أحدث من الجاري', newer)
            if commit:
                previous = info.get('currentCommit')
                paths = self.run(['git', 'diff', '--name-only', previous, commit], project).splitlines() if previous else self.run(['git', 'ls-tree', '-r', '--name-only', commit], project).splitlines()
                sql = [path for path in paths if path.endswith('.sql') or '/migrations/' in path]
                check('متطلبات ترحيل قواعد البيانات', not sql or info.get('migrationReady') is True,
                      'لا توجد تغييرات SQL' if not sql else 'تغييرات SQL: %d؛ يجب أن يراجعها عامل الترحيل المعتمد' % len(sql))
        except Exception as error:
            check('الاتصال وفحوص الخادم', False, str(error))
        result['ready'] = bool(result['checks']) and all(item['ok'] for item in result['checks'])
        result['checkedAt'] = dt.datetime.now().isoformat(timespec='seconds')
        self.events.put(('readiness', result))
        return result


class LocalRequests(QWebEngineUrlRequestInterceptor):
    def interceptRequest(self, info):
        url = info.requestUrl()
        if url.scheme() in ('qrc', 'data', 'about'):
            return
        if url.isLocalFile():
            path = pathlib.Path(url.toLocalFile()).resolve()
            if path.is_relative_to(HERE / 'web'):
                return
        info.block(True)


class LocalPage(QWebEnginePage):
    def acceptNavigationRequest(self, url, navigation_type, is_main_frame):
        return url.isLocalFile() and pathlib.Path(url.toLocalFile()).resolve() == HERE / 'web/index.html'


class Bridge(QObject):
    message = Signal(str)

    def __init__(self, window):
        super().__init__(window)
        self.window = window
        self.core = Operations()
        self.history = History(legacy.PREFERENCES.parent / 'history')
        self.startup_checked = False
        self.followup_after_connect = True
        self.busy = False
        self.review = None
        self.reset_review = None
        self.backups = {}
        self.setup_state = {}
        self.installed_for = None
        self.connected_for = None
        self.last_readiness = None
        self.connection_ready = False
        self.active_job_id = None
        self.active_cancel = None
        self.inspection_deadline = None
        self.timer = QTimer(self)
        self.timer.timeout.connect(self.drain)
        self.timer.start(80)

    def send_event(self, kind, value):
        self.message.emit(json.dumps({'kind': kind, 'value': value}, ensure_ascii=False))

    @Slot()
    def ready(self):
        # Deliver init independently of local database access. The frontend then
        # requests the normal guarded inspection slot; startup errors stay visible.
        self.send_event('init', {'host': legacy.HOST, 'port': legacy.PORT, 'user': legacy.USER,
                          'branch': legacy.BRANCH, 'project': self.core.project.get(), 'key': self.core.key.get(),
                          'version': self.core.version.get(), 'dark': self.core.dark, 'desktopRevision': 'review-6'})
        self.send_event('access', self.connection_ready)
        if not self.startup_checked:
            self.startup_checked = True
            self.send_event('log', 'المحرك المحلي متصل؛ تهيئة فحص الاتصال التلقائي.\n')
            self.refresh_history()

    def refresh_history(self):
        def read():
            try:
                self.core.events.put(('history', self.history.rows()))
            except Exception as error:
                self.core.events.put(('log', 'تعذر تحميل سجل العمليات المحلي: ' + type(error).__name__ + '\n'))
        threading.Thread(target=read, daemon=True).start()

    def connect_startup(self):
        # Retained for compatibility with older desktop callbacks.
        if not self.busy:
            self.request('inspect', '{}')

    def confirm(self, title, text):
        return QMessageBox.question(self.window, title, text, QMessageBox.Yes | QMessageBox.No, QMessageBox.No) == QMessageBox.Yes

    def password(self, label):
        text, ok = QInputDialog.getText(self.window, 'تشفير النسخ', label, QLineEdit.Password)
        return text if ok else None

    @Slot(str, str)
    def request(self, action, raw):
        try:
            data = json.loads(raw or '{}')
            if not isinstance(data, dict):
                raise ValueError('Invalid request')
            if action not in ('copy','theme','save-log','history-list','history-log'):
                self.send_event('log', 'استلم المحرك الأمر: ' + action + '\n')
            if action == 'copy':
                QApplication.clipboard().setText(str(data.get('text', '')))
                self.send_event('notice', 'تم النسخ')
                return
            if action == 'save-log':
                path, _ = QFileDialog.getSaveFileName(self.window, 'حفظ السجل', 'radius-lord.log', 'Log (*.log)')
                if path:
                    pathlib.Path(path).write_text(str(data.get('text', '')), encoding='utf-8')
                return
            if action == 'theme':
                self.core.dark = data.get('dark') is True
                self.core.save_preferences()
                return
            if action == 'history-list':
                self.send_event('history', self.history.rows())
                return
            if action == 'history-log':
                identifier = data.get('id')
                if not self.history.get(identifier):
                    raise ValueError('العملية غير موجودة')
                def read_log():
                    try:
                        self.core.events.put(('history-log', {'id': identifier, 'text': self.history.log(identifier)}))
                    except Exception as error:
                        self.core.events.put(('error', str(error)))
                threading.Thread(target=read_log, daemon=True).start()
                return
            if self.busy:
                self.send_event('log', 'لم يبدأ الأمر '+action+': انتظر اكتمال العملية الجارية\n')
                self.send_event('error', 'انتظر اكتمال العملية الجارية')
                return
            local_actions = {'inspect','setup-scan','setup-agent-service','create-key','install-key','agent','choose-project','choose-key','save-settings'}
            if not self.connection_ready and action not in local_actions:
                raise ValueError('نفّذ فحص الاتصال بنجاح أولًا لإتاحة العمليات')
            if action == 'resume-pending':
                self.start(action, self.resume_pending)
                return
            for name in ('project', 'key', 'version', 'changes'):
                if name in data:
                    if not isinstance(data[name], str) or len(data[name]) > 4096:
                        raise ValueError('Invalid field: ' + name)
                    if getattr(self.core, name).get() != data[name].strip():
                        self.last_readiness = None
                        if name in ('project','key'):
                            self.connection_ready = False
                            self.send_event('access', False)
                    getattr(self.core, name).set(data[name].strip())
            if action != 'inspect':
                self.core.save_preferences()
            if action == 'setup-scan':
                self.start(action, self.scan_setup)
                return
            if action == 'setup-agent-service':
                self.start(action, self.start_agent_service)
                return
            if action in ('choose-project', 'choose-key'):
                path = QFileDialog.getExistingDirectory(self.window, 'مجلد المشروع', self.core.project.get()) if action == 'choose-project' else QFileDialog.getOpenFileName(self.window, 'مفتاح SSH الخاص', str(pathlib.Path.home() / '.ssh'))[0]
                if path:
                    getattr(self.core, 'project' if action == 'choose-project' else 'key').set(path)
                    self.core.validated = None
                    self.connection_ready = False
                    self.send_event('access', False)
                    self.core.save_preferences()
                    self.ready()
                    self.start('setup-scan', self.scan_setup)
                return
            if action == 'save-settings':
                self.send_event('notice', 'تم حفظ إعدادات الاتصال')
                self.start('setup-scan', self.scan_setup)
                return
            if not self.connection_ready and action not in local_actions:
                raise ValueError('تغيّر إعداد الاتصال؛ أعد فحص الاتصال أولًا')
            args = (self.core.project.get(), self.core.key.get(), self.core.version.get(), self.core.changes.get())
            actions = {'inspect': self.inspect_setup, 'terminal': self.core.terminal,
                       'pull': self.core.pull, 'build': self.core.build, 'publish': self.publish_checked, 'readiness': self.core.readiness,
                       'status': self.core.status, 'latest-log': self.core.latest_log,
                       'create-key': self.create_setup_key, 'install-key': self.install_setup_key,
                       'agent': self.load_setup_agent, 'backup-install': self.core.install_backup,
                       'backup-list': self.core.list_backups}
            if action in actions:
                if action == 'publish' and (not self.last_readiness or not self.last_readiness.get('ready') or self.last_readiness.get('targetVersion') != args[2]):
                    self.start('readiness', lambda: self.core.readiness(*args))
                    return
                if action == 'publish' and not self.confirm('نشر الإصدار', 'نشر ' + self.core.version.get() + ' على ' + legacy.HOST + '؟ سيأخذ الخادم نسخة احتياطية ويبني الإصدار ويعيد تشغيل التطبيق.'):
                    return
                self.start(action, lambda: actions[action](*args))
                return
            if action == 'restart':
                unit = data.get('unit')
                if unit not in ('radius-lord-backend', 'radius-lord-frontend', 'mysql', 'freeradius'):
                    raise ValueError('Unknown service')
                if self.confirm('إعادة تشغيل الخدمة', 'إعادة تشغيل ' + unit + '؟ ستنقطع اتصالات الخدمة مؤقتًا.'):
                    self.start(action, lambda: self.core.restart_service(unit, self.core.key.get()))
                return
            if action.startswith('backup-') or action.startswith('reset-'):
                self.backup(action, data)
                return
            raise ValueError('Unknown action')
        except Exception as error:
            self.send_event('log', 'تعذر تنفيذ الأمر ' + action + ': ' + str(error) + '\n')
            self.send_event('error', str(error))

    def publish_checked(self, *args):
        # Re-run immediately before the existing immutable-tag publish flow.
        result = self.core.readiness(*args)
        if not result['ready']:
            raise RuntimeError('فحص الجاهزية منع النشر؛ راجع البنود غير المكتملة')
        self.core.publish(*args)

    def scan_setup(self):
        key = pathlib.Path(self.core.key.get())
        public = pathlib.Path(str(key) + '.pub')
        project = pathlib.Path(self.core.project.get())
        state = {'paths': project.is_dir() and (project / 'package.json').is_file(),
                 'keyExists': key.is_file() and not str(key).endswith('.pub'),
                 'publicExists': public.is_file(), 'fingerprint': '', 'agentRunning': False,
                 'agentLoaded': False, 'installed': False, 'connected': False}
        if public.is_file() and shutil.which('ssh-keygen'):
            result = capture_readonly(['ssh-keygen', '-lf', str(public)],
                                    creationflags=legacy.NO_WINDOW, timeout=5)
            if result.returncode == 0:
                fields = result.stdout.decode(errors='replace').split()
                state['fingerprint'] = fields[1] if len(fields) > 1 else ''
        if shutil.which('ssh-add'):
            result = capture_readonly(['ssh-add', '-l'], creationflags=legacy.NO_WINDOW, timeout=5)
            if result.returncode in (0, 1):
                state['agentRunning'] = True
            state['agentLoaded'] = bool(state['fingerprint']) and result.returncode == 0 and state['fingerprint'] in result.stdout.decode(errors='replace').split()
        if os.name == 'nt' and not state['agentRunning']:
            result = capture_readonly(['powershell.exe', '-NoProfile', '-NonInteractive', '-Command',
                                     "(Get-Service -Name ssh-agent -ErrorAction SilentlyContinue).Status.ToString()"],
                                    creationflags=legacy.NO_WINDOW, timeout=5)
            state['agentRunning'] = result.returncode == 0 and result.stdout.decode(errors='replace').strip() == 'Running'
        identity = (str(key.resolve()), state['fingerprint'])
        state['installed'] = bool(state['fingerprint']) and self.installed_for == identity
        state['connected'] = bool(state['fingerprint']) and self.connected_for == identity
        self.setup_state = state
        self.core.events.put(('setup', state))
        return state

    def create_setup_key(self, *args):
        state = self.scan_setup()
        if not state['paths']:
            raise ValueError('الخطوة 1: اختر مجلد المشروع أولًا ثم افحص الإعدادات')
        if state['keyExists']:
            self.core.events.put(('notice', 'المفتاح موجود؛ سنستخدمه دون إنشاء مفتاح جديد'))
            return
        self.core.create_key(*args)
        self.scan_setup()

    def start_agent_service(self):
        if os.name != 'nt':
            raise ValueError('تشغيل خدمة SSH Agent بهذه الطريقة مخصص لـ Windows')
        state = self.scan_setup()
        if not state['keyExists']:
            raise ValueError('أنشئ أو اختر المفتاح أولًا')
        if state['agentRunning']:
            self.core.events.put(('notice', 'خدمة SSH Agent تعمل بالفعل'))
            return
        self.core.events.put(('log', 'ستظهر مطالبة Windows بصلاحية المسؤول لتشغيل خدمة SSH Agent.\n'))
        script = "$p = Start-Process -FilePath powershell.exe -Verb RunAs -Wait -PassThru -ArgumentList '-NoProfile -Command Set-Service -Name ssh-agent -StartupType Automatic; Start-Service -Name ssh-agent'; exit $p.ExitCode"
        self.core.run(['powershell.exe', '-NoProfile', '-Command', script], stream=True, timeout=180)
        if not self.scan_setup()['agentRunning']:
            raise RuntimeError('لم تعمل خدمة SSH Agent؛ تحقق من قبول مطالبة مسؤول Windows')

    def load_setup_agent(self, *args):
        state = self.scan_setup()
        if not state['keyExists'] or not state['publicExists']:
            raise ValueError('الخطوة 2: اختر زوج المفتاح الخاص والعام أولًا')
        if state['agentLoaded']:
            self.core.events.put(('notice', 'المفتاح الصحيح محمّل بالفعل في SSH Agent'))
            return
        if not state['agentRunning']:
            raise ValueError('شغّل خدمة SSH Agent من الخطوة 3 أولًا')
        self.core.add_agent(*args)
        if not self.scan_setup()['agentLoaded']:
            raise RuntimeError('المفتاح المحدد لم يُحمّل في Agent؛ راجع نافذة عبارة المرور')

    def install_setup_key(self, *args):
        state = self.scan_setup()
        if not state['agentLoaded']:
            raise ValueError('أكمل تحميل المفتاح في الخطوة 3 أولًا')
        if state['installed'] or state['connected']:
            self.core.events.put(('notice', 'تم التحقق من تثبيت هذا المفتاح في هذه الجلسة'))
            return
        self.core.install_key(*args)
        self.installed_for = (str(pathlib.Path(self.core.key.get()).resolve()), state['fingerprint'])
        self.scan_setup()

    def inspect_setup(self, *args):
        self.core.events.put(('access', False))
        self.core.events.put(('log', 'بدء فحص إعداد المفتاح وSSH Agent محليًا (مهلة كل أداة 5 ثوانٍ).\n'))
        self.core.events.put(('state', 'التحقق من مسار المفتاح وSSH Agent محليًا'))
        state = self.scan_setup()
        self.connected_for = None
        try:
            self.core.events.put(('log', 'اكتمل الفحص المحلي؛ بدء فحص SSH والخدمات بمهلة 30 ثانية.\n'))
            self.core.inspect_host(*args)
            identity = (str(pathlib.Path(self.core.key.get()).resolve()), state['fingerprint'])
            if state['fingerprint']:
                self.connected_for = identity
                self.installed_for = identity
            self.core.events.put(('access', True))
        finally:
            identity = (str(pathlib.Path(self.core.key.get()).resolve()), state.get('fingerprint',''))
            state['connected'] = bool(state.get('fingerprint')) and self.connected_for == identity
            state['installed'] = bool(state.get('fingerprint')) and self.installed_for == identity
            self.setup_state = state
            self.core.events.put(('setup', state))

    def resume_startup(self):
        if not self.busy:
            reader = Operations()
            reader.key.set(self.core.key.get())
            threading.Thread(target=lambda: self.resume_pending(reader), daemon=True).start()

    def resume_pending(self, reader=None):
        reader = reader or self.core
        background = reader is not self.core
        key = reader.key.get()
        for row in self.history.pending():
            if not background:
                self.core.events.put(('state', 'قراءة حالة العملية السابقة: ' + row['action']))
            self.core.events.put(('log', 'متابعة للقراءة فقط: ' + row['action'] + ' / ' + row['id'] + '\n'))
            try:
                if row['action'] == 'publish':
                    version = row['version']
                    if not re.fullmatch(r'v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)', version):
                        raise ValueError('رقم الإصدار المسجل غير صالح')
                    # Direct status-file read only. The receiver status command can enqueue a missing release.
                    code = "import json,pathlib; p=pathlib.Path('/srv/radius-lord/status') / " + repr(version + '.json') + "; print(p.read_text() if p.exists() else json.dumps({'status':'not_recorded'}))"
                    result = json.loads(reader.run([*reader.ssh(key), 'python3 -c ' + shlex.quote(code)]))
                    remote = result.get('status')
                    status = 'succeeded' if remote == 'succeeded' else 'failed' if remote in ('failed', 'failed_rolled_back', 'recovery_required') else 'pending' if remote in ('queued', 'preflight', 'build', 'backup', 'migrate', 'activate', 'verify') else 'unknown'
                    note = 'حالة الإصدار على الخادم: ' + str(remote)
                elif row['action'] == 'backup-upload' and row.get('backup_id'):
                    result = reader.rpc('list', key)
                    match = next((r for r in result['backups'] if r['id'] == row['backup_id']), None)
                    status, note = ('unknown', 'الملف موجود؛ فحص النقل المحلي لم يُحسم، افحص النسخة قبل استخدامها') if match else ('unknown', 'لم يُعثر على سجل النسخة المرفوعة؛ لا نفترض نجاح النقل')
                else:
                    result = reader.rpc('operation-status', key, {'operationId': row['id']})
                    remote = result.get('status')
                    status = 'succeeded' if remote == 'succeeded' else 'failed' if remote == 'failed' else 'pending' if remote == 'running' else 'unknown'
                    note = 'سجل عملية الخادم: ' + str(remote) + '. ' + str(result.get('note', ''))
                self.history.finish(row['id'], status, note)
                self.history.append(row['id'], note)
                self.core.events.put(('log', row['action'] + ': ' + note + '\n'))
            except Exception as error:
                self.history.finish(row['id'], 'unknown', 'تعذر تأكيد النتيجة؛ يلزم الفحص لاحقًا')
                self.history.append(row['id'], str(error))
                self.core.events.put(('log', 'تعذر استكمال فحص العملية ' + row['id'] + ': ' + str(error) + '\n'))
                break
        self.core.events.put(('history', self.history.rows()))

    def start(self, label, function, backup_id=None):
        identifier = uuid.uuid4().hex
        self.busy = True
        self.core.current_job_id = identifier
        self.active_job_id = identifier
        self.active_cancel = threading.Event()
        cancel = self.active_cancel
        self.inspection_deadline = time.monotonic() + 55 if label == 'inspect' else None
        self.core.write_started = False
        self.send_event('busy', {'active': True, 'action': label})
        self.send_event('log', 'بدأت العملية: ' + label + '\n')
        def save_result(status, note):
            try:
                self.history.finish(identifier, status, note)
            except Exception as error:
                self.core.events.put(('log', 'تعذر حفظ نتيجة العملية محليًا: ' + type(error).__name__ + '\n'))
        def work():
            self.core.worker_context.identifier = identifier
            self.core.worker_context.cancel = cancel
            try:
                try:
                    self.history.begin(label, self.core.version.get(), backup_id, identifier=identifier)
                except Exception as error:
                    if label in WRITE_ACTIONS:
                        raise RuntimeError('تعذر تسجيل عملية الكتابة محليًا؛ تحقق من السجل قبل التنفيذ') from error
                    self.core.events.put(('log', 'تعذر بدء سجل محلي؛ يستمر الفحص للقراءة فقط: ' + type(error).__name__ + '\n'))
                function()
                if cancel.is_set():
                    raise TimeoutError('تجاوز الفحص مدته الكلية')
                save_result('succeeded', 'اكتمل الإجراء في الأداة')
                message = 'راجع نتيجة الجاهزية، ثم اضغط رفع الإصدار عندما تكون جاهزًا' if label == 'readiness' else 'اكتملت العملية'
                self.core.events.put(('notice', message))
            except Exception as error:
                save_result('unknown' if label in WRITE_ACTIONS and self.core.write_started else 'failed', str(error))
                diagnostic = diagnose(str(error))
                if diagnostic:
                    self.core.events.put(('diagnostic', diagnostic))
                self.core.events.put(('log', 'ERROR: ' + str(error) + '\n'))
                self.core.events.put(('error', str(error)))
            finally:
                try:
                    self.core.events.put(('history', self.history.rows()))
                except Exception:
                    self.core.events.put(('log', 'تعذر تحديث سجل العمليات المحلي\n'))
                self.core.events.put(('done', None))
        threading.Thread(target=work, daemon=True).start()

    def check_inspection_deadline(self):
        if not self.inspection_deadline or time.monotonic() < self.inspection_deadline:
            return
        identifier = self.active_job_id
        self.inspection_deadline = None
        self.active_cancel.set()
        self.active_job_id = None
        self.core.current_job_id = None
        self.busy = False
        self.connection_ready = False
        self.send_event('access', False)
        self.send_event('services', ({}, 'انتهت مهلة الفحص'))
        self.send_event('connected', '🔴 انتهت المهلة الكلية للفحص؛ يمكنك المحاولة مجددًا')
        self.send_event('busy', {'active': False})
        self.send_event('error', 'توقف انتظار الفحص بعد 55 ثانية؛ لم تُكرّر أي عملية على الخادم')
        def record_timeout():
            try:
                self.history.finish(identifier, 'failed', 'تجاوز الفحص مهلة 55 ثانية')
                self.core.events.put(('history', self.history.rows()))
            except Exception:
                pass
        threading.Thread(target=record_timeout, daemon=True).start()

    @Slot()
    def drain(self):
        self.check_inspection_deadline()
        for _ in range(150):
            try:
                kind, value, identifier = self.core.events.get_nowait()
            except queue.Empty:
                return
            if identifier and identifier != self.active_job_id:
                continue
            if kind == 'log':
                value = redact(value)
                try:
                    self.history.append(identifier, value)
                except Exception:
                    self.send_event('error', 'تعذر حفظ جزء من السجل المحلي؛ تحقق من مساحة القرص')
            if kind == 'done':
                self.inspection_deadline = None
                self.active_job_id = None
                self.core.current_job_id = None
                self.busy = False
                self.send_event('busy', {'active': False})
                self.send_event('access', self.connection_ready)
                if self.connection_ready and self.followup_after_connect:
                    self.followup_after_connect = False
                    if self.history.pending():
                        QTimer.singleShot(300, self.resume_startup)
            elif kind == 'access':
                self.connection_ready = bool(value)
                self.send_event(kind, self.connection_ready)
            elif kind == 'diagnostic':
                self.connection_ready = False
                self.send_event('access', False)
                self.send_event(kind, value)
            elif kind == 'connected':
                if value.startswith('🔴'):
                    self.connection_ready = False
                    self.send_event('access', False)
                self.send_event(kind, value)
            elif kind == 'readiness':
                self.last_readiness = value
                self.send_event(kind, value)
            elif kind == 'backups':
                self.backups = {row['id']: row for row in value['backups']}
                self.send_event(kind, value)
            elif kind == 'review':
                self.review = value
                self.send_event(kind, value)
            elif kind == 'reset-review':
                self.reset_review = value
                self.send_event(kind, value)
            else:
                self.send_event(kind, value)

    def backup(self, action, data):
        key = self.core.key.get()
        request = {}
        operation = action.removeprefix('backup-')
        if action in ('reset-plan', 'reset-apply'):
            request = {'keepServer': int(data.get('keepServer', 0)), 'keepRadius': int(data.get('keepRadius', 0))}
            operation = action
            if operation == 'reset-apply':
                if not self.reset_review or any(request[k] != self.reset_review[k] for k in request):
                    raise ValueError('راجع خطة التنظيف أولًا')
                typed, ok = QInputDialog.getText(self.window, 'تنظيف المركزية', 'اكتب RESET لحذف البيانات التشغيلية وفق الخطة المعروضة؛ تؤخذ نسخة كاملة قبل التنفيذ:')
                if not ok or typed != 'RESET':
                    return
                request['planSha256'] = self.reset_review['planSha256']
        elif operation == 'key':
            phrase = self.password('عبارة تشفير النسخ (16 حرفًا على الأقل). احتفظ بها خارج الخادم:')
            if phrase is None:
                return
            if phrase != self.password('أعد كتابة عبارة تشفير النسخ:'):
                raise ValueError('عبارتا التشفير غير متطابقتين')
            request['passphrase'] = phrase
        elif operation == 'create':
            request['kind'] = data.get('kind', 'full')
            if request['kind'] not in ('full', 'project', 'databases'):
                raise ValueError('Invalid kind')
            names = data.get('databases')
            if names:
                if not isinstance(names, list) or not all(isinstance(n, str) for n in names):
                    raise ValueError('Invalid database selection')
                request['databases'] = names
            self.send_event('log', 'بانتظار تأكيد إنشاء النسخة في نافذة التأكيد\n')
            if not self.confirm('إنشاء نسخة مشفّرة', 'النوع: ' + request['kind'] + '\nالقواعد: ' + (', '.join(names) if names else 'جميع القواعد المحلية المدعومة') + '\nتتوقف خدمات المشروع وFreeRADIUS مؤقتًا أثناء النسخ. متابعة؟'):
                self.send_event('log', 'أُلغي إنشاء النسخة قبل التنفيذ\n')
                return
        elif operation == 'upload':
            path, _ = QFileDialog.getOpenFileName(self.window, 'رفع نسخة مشفّرة', '', 'Environment backup (*.tar.gpg)')
            if not path:
                return
            backup_id = 'b-' + dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid.uuid4().hex[:12]
            self.start(action, lambda: (self.core.transfer(key, path, backup_id, upload=True), self.core.list_backups('', key, '', '')), backup_id=backup_id)
            return
        elif operation == 'schedule':
            request = {'enabled': data.get('enabled') is True, 'hour': int(data.get('hour', 2)),
                       'daily': int(data.get('daily', 7)), 'weekly': int(data.get('weekly', 4))}
            if not self.confirm('سياسة النسخ', 'حفظ الجدولة؟ الساعة بتوقيت UTC. تتوقف الخدمات مؤقتًا أثناء النسخ، وتُحذف النسخ المجدولة القديمة بعد نجاح نسخة جديدة وفق سياسة الاحتفاظ. النسخ اليدوية والمرفوعة لا تُحذف تلقائيًا.'):
                return
        elif operation in ('review', 'restore', 'delete', 'download'):
            backup_id = data.get('id')
            if backup_id not in self.backups:
                raise ValueError('اختر نسخة من القائمة أولًا')
            request['id'] = backup_id
            if operation == 'download':
                path, _ = QFileDialog.getSaveFileName(self.window, 'تنزيل النسخة', backup_id + '.tar.gpg', 'Environment backup (*.tar.gpg)')
                if path:
                    self.start(action, lambda: self.core.transfer(key, path, backup_id))
                return
            if operation == 'delete' and not self.confirm('حذف النسخة', 'حذف نهائي: ' + backup_id + '؟'):
                return
            if operation == 'restore':
                if not self.review or self.review['id'] != backup_id or not self.review.get('sameHost'):
                    raise ValueError('راجع نسخة خاصة بالخادم نفسه أولًا')
                if not self.confirm('استعادة البيئة', 'ستُستبدل القواعد والملفات المبينة في المراجعة. تؤخذ نسخة كاملة قبل التنفيذ. استعد نسخة موثوقة فقط. إعدادات الخدمات وحسابات MySQL تُجهّز للمراجعة اليدوية، دون تفعيل تلقائي. متابعة؟'):
                    return
                request.update(sha256=self.review['sha256'], trusted=True)
            if operation in ('review', 'restore'):
                phrase = self.password('عبارة تشفير النسخة؛ فارغ لاستخدام مفتاح الخادم:')
                if phrase is None:
                    return
                if phrase:
                    request['passphrase'] = phrase
        else:
            raise ValueError('Unknown backup action')
        self.start(action, lambda: self.core.backup_operation(operation, key, request), backup_id=request.get('id'))


class NoNativeTooltips(QObject):
    def eventFilter(self, watched, event):
        if event.type() == QEvent.Type.ToolTip:
            QToolTip.hideText()
            return True
        return False


class Window(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle('Radius Lord | إدارة الخادم')
        self.resize(1380, 900)
        self.setMinimumSize(1000, 720)
        self.view = QWebEngineView(self)
        self.setCentralWidget(self.view)
        self.profile = QWebEngineProfile(self)
        self.profile.setHttpCacheType(QWebEngineProfile.HttpCacheType.NoCache)
        self.page = LocalPage(self.profile, self.view)
        self.view.setPage(self.page)
        self.interceptor = LocalRequests(self.page)
        self.page.profile().setUrlRequestInterceptor(self.interceptor)
        settings = self.page.settings()
        settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessRemoteUrls, False)
        settings.setAttribute(QWebEngineSettings.WebAttribute.JavascriptCanOpenWindows, False)
        self.bridge = Bridge(self)
        self.channel = QWebChannel(self.page)
        self.channel.registerObject('host', self.bridge)
        self.page.setWebChannel(self.channel)
        url = QUrl.fromLocalFile(str(HERE / 'web/index.html'))
        url.setQuery('revision=review-6')
        self.view.load(url)

    def closeEvent(self, event):
        if self.bridge.busy:
            QMessageBox.information(self, 'عملية جارية', 'انتظر اكتمال العملية. إغلاق الأداة لا يلغي النشر على الخادم.')
            event.ignore()
        else:
            self.bridge.core.save_preferences()
            try:
                self.bridge.history.flush(timeout=2)
            except Exception:
                pass
            event.accept()


if __name__ == '__main__':
    app = QApplication(sys.argv)
    tooltip_filter = NoNativeTooltips(app)
    app.installEventFilter(tooltip_filter)
    window = Window()
    window.show()
    sys.exit(app.exec())
