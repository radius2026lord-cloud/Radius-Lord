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
import uuid

from PySide6.QtCore import QObject, QTimer, QUrl, Signal, Slot, QEvent
from PySide6.QtWidgets import QApplication, QFileDialog, QInputDialog, QLineEdit, QMainWindow, QMessageBox, QToolTip
from PySide6.QtWebChannel import QWebChannel
from PySide6.QtWebEngineCore import QWebEnginePage, QWebEngineSettings, QWebEngineUrlRequestInterceptor
from PySide6.QtWebEngineWidgets import QWebEngineView

from deployment_checks import diagnose, HOST_PROBE
from operation_history import History, WRITE_ACTIONS, redact

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
        return super().put((*item, self.owner.current_job_id), *args, **kwargs)


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
        return super().rpc(action, key, request)

    def run(self, args, *values, **options):
        if pathlib.Path(args[0]).name.lower() in ('git', 'git.exe') and 'push' in args:
            self.write_started = True
        try:
            return super().run(args, *values, **options)
        except legacy.CommandFailure as error:
            program = pathlib.Path(error.program).name.lower()
            diagnostic = diagnose(error.output, error.code if program in ('ssh', 'ssh.exe') else None)
            if diagnostic and (program in ('ssh', 'ssh.exe') or 'ssh' in error.output.lower()):
                error.diagnostic = diagnostic
                self.events.put(('diagnostic', diagnostic))
                raise RuntimeError(diagnostic['title'] + ' — ' + diagnostic['action']) from error
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
    event = Signal(str)

    def __init__(self, window):
        super().__init__(window)
        self.window = window
        self.core = Operations()
        self.history = History(legacy.PREFERENCES.parent / 'history')
        self.startup_checked = False
        self.busy = False
        self.review = None
        self.reset_review = None
        self.backups = {}
        self.setup_state = {}
        self.installed_for = None
        self.connected_for = None
        self.last_readiness = None
        self.timer = QTimer(self)
        self.timer.timeout.connect(self.drain)
        self.timer.start(80)

    def emit(self, kind, value):
        self.event.emit(json.dumps({'kind': kind, 'value': value}, ensure_ascii=False))

    @Slot()
    def ready(self):
        self.emit('init', {'host': legacy.HOST, 'port': legacy.PORT, 'user': legacy.USER,
                          'branch': legacy.BRANCH, 'project': self.core.project.get(), 'key': self.core.key.get(),
                          'version': self.core.version.get(), 'dark': self.core.dark})
        self.emit('history', self.history.rows())
        if not self.startup_checked:
            self.startup_checked = True
            if self.history.pending():
                self.emit('notice', 'توجد عمليات غير محسومة؛ سنفحص حالتها للقراءة فقط')
                QTimer.singleShot(400, self.resume_startup)

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
            if action == 'copy':
                QApplication.clipboard().setText(str(data.get('text', '')))
                self.emit('notice', 'تم النسخ')
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
                self.emit('history', self.history.rows())
                return
            if action == 'history-log':
                identifier = data.get('id')
                if not self.history.get(identifier):
                    raise ValueError('العملية غير موجودة')
                self.emit('history-log', {'id': identifier, 'text': self.history.log(identifier)})
                return
            if self.busy:
                self.emit('error', 'انتظر اكتمال العملية الجارية')
                return
            if action == 'resume-pending':
                self.start(action, self.resume_pending)
                return
            for name in ('project', 'key', 'version', 'changes'):
                if name in data:
                    if not isinstance(data[name], str) or len(data[name]) > 4096:
                        raise ValueError('Invalid field: ' + name)
                    if getattr(self.core, name).get() != data[name].strip():
                        self.last_readiness = None
                    getattr(self.core, name).set(data[name].strip())
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
                    self.core.save_preferences()
                    self.ready()
                    self.start('setup-scan', self.scan_setup)
                return
            if action == 'save-settings':
                self.emit('notice', 'تم حفظ إعدادات الاتصال')
                self.start('setup-scan', self.scan_setup)
                return
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
            self.emit('error', str(error))

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
            result = subprocess.run(['ssh-keygen', '-lf', str(public)], capture_output=True,
                                    creationflags=legacy.NO_WINDOW, timeout=15)
            if result.returncode == 0:
                fields = result.stdout.decode(errors='replace').split()
                state['fingerprint'] = fields[1] if len(fields) > 1 else ''
        if os.name == 'nt':
            result = subprocess.run(['powershell.exe', '-NoProfile', '-NonInteractive', '-Command',
                                     "(Get-Service -Name ssh-agent -ErrorAction SilentlyContinue).Status.ToString()"],
                                    capture_output=True, creationflags=legacy.NO_WINDOW, timeout=15)
            state['agentRunning'] = result.returncode == 0 and result.stdout.decode(errors='replace').strip() == 'Running'
        if shutil.which('ssh-add'):
            result = subprocess.run(['ssh-add', '-l'], capture_output=True, creationflags=legacy.NO_WINDOW, timeout=15)
            if result.returncode in (0, 1):
                state['agentRunning'] = True
            state['agentLoaded'] = bool(state['fingerprint']) and result.returncode == 0 and state['fingerprint'] in result.stdout.decode(errors='replace').split()
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
        state = self.scan_setup()
        self.connected_for = None
        try:
            self.core.inspect_host(*args)
            identity = (str(pathlib.Path(self.core.key.get()).resolve()), state['fingerprint'])
            if state['fingerprint']:
                self.connected_for = identity
                self.installed_for = identity
        finally:
            self.scan_setup()

    def resume_startup(self):
        if not self.busy:
            self.start('resume-pending', self.resume_pending)

    def resume_pending(self):
        key = self.core.key.get()
        for row in self.history.pending():
            try:
                if row['action'] == 'publish':
                    version = row['version']
                    if not re.fullmatch(r'v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)', version):
                        raise ValueError('رقم الإصدار المسجل غير صالح')
                    # Direct status-file read only. The receiver status command can enqueue a missing release.
                    code = "import json,pathlib; p=pathlib.Path('/srv/radius-lord/status') / " + repr(version + '.json') + "; print(p.read_text() if p.exists() else json.dumps({'status':'not_recorded'}))"
                    result = json.loads(self.core.run([*self.core.ssh(key), 'python3 -c ' + shlex.quote(code)]))
                    remote = result.get('status')
                    status = 'succeeded' if remote == 'succeeded' else 'failed' if remote in ('failed', 'failed_rolled_back', 'recovery_required') else 'pending' if remote in ('queued', 'preflight', 'build', 'backup', 'migrate', 'activate', 'verify') else 'unknown'
                    note = 'حالة الإصدار على الخادم: ' + str(remote)
                elif row['action'] == 'backup-upload' and row.get('backup_id'):
                    result = self.core.rpc('list', key)
                    match = next((r for r in result['backups'] if r['id'] == row['backup_id']), None)
                    status, note = ('unknown', 'الملف موجود؛ فحص النقل المحلي لم يُحسم، افحص النسخة قبل استخدامها') if match else ('unknown', 'لم يُعثر على سجل النسخة المرفوعة؛ لا نفترض نجاح النقل')
                else:
                    result = self.core.rpc('operation-status', key, {'operationId': row['id']})
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
        self.core.events.put(('history', self.history.rows()))

    def start(self, label, function, backup_id=None):
        identifier = self.history.begin(label, self.core.version.get(), backup_id)
        self.busy = True
        self.core.current_job_id = identifier
        self.core.write_started = False
        self.emit('history', self.history.rows())
        self.emit('busy', {'active': True, 'action': label})
        def work():
            try:
                function()
                self.history.finish(identifier, 'succeeded', 'اكتمل الإجراء في الأداة')
                message = 'راجع نتيجة الجاهزية، ثم اضغط رفع الإصدار عندما تكون جاهزًا' if label == 'readiness' else 'اكتملت العملية'
                self.core.events.put(('notice', message))
            except Exception as error:
                self.history.finish(identifier, 'unknown' if label in WRITE_ACTIONS and self.core.write_started else 'failed', str(error))
                diagnostic = diagnose(str(error))
                if diagnostic:
                    self.core.events.put(('diagnostic', diagnostic))
                self.core.events.put(('log', 'ERROR: ' + str(error) + '\n'))
                self.core.events.put(('error', str(error)))
            finally:
                try:
                    self.core.events.put(('history', self.history.rows()))
                except Exception:
                    self.core.events.put(('error', 'تعذر تحديث سجل العمليات المحلي'))
                self.core.events.put(('done', None))
        threading.Thread(target=work, daemon=True).start()

    def drain(self):
        for _ in range(150):
            try:
                kind, value, identifier = self.core.events.get_nowait()
            except queue.Empty:
                return
            if kind == 'log':
                value = redact(value)
                try:
                    self.history.append(identifier, value)
                except Exception:
                    self.emit('error', 'تعذر حفظ جزء من السجل المحلي؛ تحقق من مساحة القرص')
            if kind == 'done':
                self.core.current_job_id = None
                self.busy = False
                self.emit('busy', {'active': False})
            elif kind == 'readiness':
                self.last_readiness = value
                self.emit(kind, value)
            elif kind == 'backups':
                self.backups = {row['id']: row for row in value['backups']}
                self.emit(kind, value)
            elif kind == 'review':
                self.review = value
                self.emit(kind, value)
            elif kind == 'reset-review':
                self.reset_review = value
                self.emit(kind, value)
            else:
                self.emit(kind, value)

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
            if not self.confirm('إنشاء نسخة مشفّرة', 'النوع: ' + request['kind'] + '\nالقواعد: ' + (', '.join(names) if names else 'جميع القواعد المحلية المدعومة') + '\nتتوقف خدمات المشروع وFreeRADIUS مؤقتًا أثناء النسخ. متابعة؟'):
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
        self.page = LocalPage(self.view)
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
        self.view.load(QUrl.fromLocalFile(str(HERE / 'web/index.html')))

    def closeEvent(self, event):
        if self.bridge.busy:
            QMessageBox.information(self, 'عملية جارية', 'انتظر اكتمال العملية. إغلاق الأداة لا يلغي النشر على الخادم.')
            event.ignore()
        else:
            self.bridge.core.save_preferences()
            event.accept()


if __name__ == '__main__':
    app = QApplication(sys.argv)
    tooltip_filter = NoNativeTooltips(app)
    app.installEventFilter(tooltip_filter)
    window = Window()
    window.show()
    sys.exit(app.exec())
