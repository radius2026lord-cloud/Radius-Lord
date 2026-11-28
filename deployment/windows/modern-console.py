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

from PySide6.QtCore import QObject, QTimer, QUrl, Signal, Slot, QEvent, Qt
from PySide6.QtWidgets import QApplication, QFileDialog, QInputDialog, QLineEdit, QMainWindow, QMessageBox, QToolTip, QDockWidget, QPlainTextEdit
from PySide6.QtWebChannel import QWebChannel
from PySide6.QtWebEngineCore import QWebEnginePage, QWebEngineSettings, QWebEngineUrlRequestInterceptor, QWebEngineProfile
from PySide6.QtWebEngineWidgets import QWebEngineView

from deployment_checks import diagnose, HOST_PROBE
from operation_history import History, WRITE_ACTIONS, redact
from bounded_process import capture_readonly
from ssh_session import ServerSession

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
        identifier = getattr(self.owner.worker_context, 'identifier', None)
        return super().put((*item, identifier), *args, **kwargs)


def readiness_failures(result):
    return '، '.join(item['name'] for item in result['checks'] if not item['ok']) or 'لم تكتمل الفحوص'


class Operations(legacy.Console):
    """No Tk window: inherit only the established SSH/Git/backup operations."""
    def __init__(self):
        try:
            prefs = json.loads(legacy.PREFERENCES.read_text(encoding='utf-8'))
        except (OSError, ValueError):
            prefs = {}
        self.project = Value(prefs.get('project', str(HERE.parents[1])))
        self.key = Value(prefs.get('key', str(pathlib.Path.home() / '.ssh/id_ed25519_radius_lord')))
        self.version = Value('')
        self.changes = Value('')
        self.dark = prefs.get('dark', True)
        self.current_job_id = None
        self.worker_context = threading.local()
        self.events = TrackedQueue(self)
        self.validated = None
        self.process = None
        self.terminal_process = None
        self.write_started = False
        self.server_session = ServerSession(legacy.NO_WINDOW)


    def ssh(self, key):
        direct = super().ssh(key)
        try:
            return self.server_session.command(
                direct, key, legacy.HOST, legacy.PORT, legacy.USER,
                lambda message: self.events.put(('log', message)))
        except RuntimeError as error:
            diagnostic = diagnose(str(error), 255)
            if diagnostic:
                self.events.put(('diagnostic', diagnostic))
            raise

    def rpc(self, action, key, data=None):
        request = dict(data or {})
        if self.current_job_id and action in ('create', 'restore', 'delete', 'schedule', 'reset-apply'):
            request['operationId'] = self.current_job_id
            self.write_started = True
        if action in ('list','operation-status'):
            command = 'python3 ' + legacy.BACKUP_HELPER + ' ' + action
            def read():
                return capture_readonly([*self.ssh(key), command], timeout=25,
                    input_bytes=json.dumps(request).encode('utf-8'), creationflags=legacy.NO_WINDOW,
                    cancel_event=getattr(self.worker_context, 'cancel', None))
            result = read()
            if self.server_session.interrupted(result.returncode, result.stderr.decode('utf-8', errors='replace')):
                result = read()
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
        if (program_name in ('git', 'git.exe') and 'push' in args) or (
                program_name in ('ssh', 'ssh.exe') and command.startswith('sudo -n -H -u radiusdeploy bash -c ')):
            self.write_started = True
        def execute(command_args):
            if options.get('wait_on_timeout') is False:
                result = capture_readonly(command_args, options.get('timeout',30), cwd=options.get('cwd'),
                                          env=options.get('env'), creationflags=legacy.NO_WINDOW, cancel_event=getattr(self.worker_context, 'cancel', None))
                output = result.stdout.decode('utf-8', errors='replace')
                error = result.stderr.decode('utf-8', errors='replace')
                if options.get('stream') or result.returncode:
                    self.events.put(('log', output + error))
                if result.returncode:
                    raise legacy.CommandFailure(command_args[0], result.returncode, output + error)
                return output.strip()
            return super(Operations, self).run(command_args, *values, **options)
        readonly = program_name in ('ssh', 'ssh.exe') and (
            options.get('wait_on_timeout') is False or command.startswith((
                'curl -fsS --max-time 10 http://127.0.0.1:4001/release-health',
                'tail -n 60 /srv/radius-lord/logs/')))
        try:
            try:
                return execute(args)
            except legacy.CommandFailure as error:
                key = self.server_session.key
                if not readonly or not key or not self.server_session.interrupted(error.code, error.output):
                    raise
                return execute([*self.ssh(key), command])
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
try:
 tags=subprocess.run(['sudo','-n','-H','-u','radiusdeploy','git','--git-dir=/srv/radius-lord/repository.git','tag','--list','radius-release/*'],capture_output=True,text=True,timeout=4,cwd='/tmp')
 info['releaseTags']=tags.stdout.splitlines() if tags.returncode==0 else None
except subprocess.TimeoutExpired: info['releaseTags']=None
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
            if info.get('releaseTags') is not None:
                suggestion = self.next_release_version(info.get('currentVersion'), info['releaseTags'])
                self.events.put(('release-version', {'version': suggestion, 'replace': False}))
            else:
                self.events.put(('log', 'تعذر قراءة وسوم النشر لاقتراح رقم الإصدار.\n'))
            self.events.put(('connected', '🟢 نجح اتصال SSH وفحص الخدمات'))
        except Exception as error:
            self.events.put(('services', ({}, 'تعذر الفحص')))
            self.events.put(('connected', '🔴 تعذر الفحص: ' + str(error)))
            raise

    @staticmethod
    def next_release_version(current, tags):
        versions = []
        for candidate in [current or '', *[tag.removeprefix('radius-release/') for tag in tags]]:
            match = re.fullmatch(r'v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)', candidate)
            if match:
                versions.append(tuple(map(int, match.groups())))
        if not versions:
            return 'v1.0.0'
        major, minor, patch = max(versions)
        return f'v{major}.{minor}.{patch + 1}'

    def suggest_release_version(self, project, key, version, changes):
        inspect = 'sudo -n -u radiusdeploy python3 ' + legacy.HELPER + ' inspect'
        info = json.loads(self.run([*self.ssh(key), inspect]))
        command = "cd /tmp && sudo -n -H -u radiusdeploy git --git-dir=/srv/radius-lord/repository.git tag --list 'radius-release/*'"
        tags = self.run([*self.ssh(key), command], timeout=15).splitlines()
        self.events.put(('release-version', {'version': self.next_release_version(info.get('currentVersion'), tags), 'replace': True}))

    def transfer(self, key, local, remote, upload=False, install=False):
        if upload:
            self.write_started = True
        return super().transfer(key, local, remote, upload=upload, install=install)

    def readiness(self, project, key, version, changes):
        result = {'ready': False, 'checks': [], 'targetVersion': version, 'targetCommit': None,
                  'currentVersion': None, 'currentCommit': None, 'host': None, 'preview': None}
        def check(name, ok, detail=''):
            result['checks'].append({'name': name, 'ok': bool(ok), 'detail': detail})
        try:
            project = self.repository(project)
            commit = self.synchronized_commit(project, report=True)
            result['targetCommit'] = commit
            check('المستودع والفرع ونظافة الملفات', True)
        except Exception as error:
            commit = None
            check('المشروع المحلي', False, str(error))
        valid_version = bool(re.fullmatch(r'v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)', version))
        try:
            info = json.loads(self.run([*self.ssh(key), 'sudo -n -u radiusdeploy python3 ' + legacy.HELPER + ' inspect']))
            result.update(currentVersion=info.get('currentVersion'), currentCommit=info.get('currentCommit'))
            if commit:
                previous = result['currentCommit']
                paths = self.run(['git', 'diff', '--name-only', '--no-renames', previous, commit, '--'], project).splitlines() if previous else self.run(['git', 'ls-tree', '-r', '--name-only', commit], project).splitlines()
                sql = [path for path in paths if path.endswith('.sql') or '/migrations/' in path]
                scope = ('initial' if not previous else 'unchanged' if not paths else
                         'desktop' if all(path.startswith('deployment/windows/') for path in paths) else 'application')
                result['preview'] = {'scope': scope, 'count': len(paths), 'sqlCount': len(sql), 'paths': paths[:60]}
                if scope in ('desktop', 'unchanged'):
                    message = ('تحديث أداة Windows فقط. لا يلزم نشر على Ubuntu.' if scope == 'desktop'
                               else 'ملفات التطبيق مطابقة لما يعمل على Ubuntu.')
                    self.events.put(('log', message + '\n'))
                    result['checkedAt'] = dt.datetime.now().isoformat(timespec='seconds')
                    self.events.put(('readiness', result))
                    return result
            check('رقم الإصدار ووصف التغييرات', valid_version and 0 < len(changes) <= 4000, 'مثل v1.0.4 مع وصف للتغيير')
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
            if result['preview']:
                check('متطلبات ترحيل قواعد البيانات', not sql or info.get('migrationReady') is True,
                      'لا توجد تغييرات SQL' if not sql else 'تغييرات SQL: %d؛ يجب أن يراجعها عامل الترحيل المعتمد' % len(sql))
        except Exception as error:
            check('الاتصال وفحوص الخادم', False, str(error))
        for item in result['checks']:
            if not item['ok']:
                detail = ' — ' + item['detail'] if item['detail'] else ''
                self.events.put(('log', 'تعذر اجتياز الجاهزية: ' + item['name'] + detail + '\n'))
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
        self.busy = False
        self.review = None
        self.reset_review = None
        self.backups = {}
        self.setup_state = {}
        self.installed_for = None
        self.connected_for = None
        self.connection_ready = False
        self.active_job_id = None
        self.active_cancel = None
        self.inspection_deadline = None
        self.request_pending = False
        self.last_progress_at = None
        self.active_label = None
        self.processing_events = False
        self.timer = QTimer(self)
        self.timer.timeout.connect(self.processEvents)
        self.timer.start(150)

    def send_event(self, kind, value):
        self.message.emit(json.dumps({'kind': kind, 'value': value}, ensure_ascii=False))

    @Slot()
    def ready(self):
        # Deliver init independently of local database access. The frontend then
        # requests the normal guarded inspection slot; startup errors stay visible.
        self.send_event('init', {'host': legacy.HOST, 'port': legacy.PORT, 'user': legacy.USER,
                          'branch': legacy.BRANCH, 'project': self.core.project.get(), 'key': self.core.key.get(),
                          'version': self.core.version.get(), 'dark': self.core.dark, 'desktopRevision': 'review-16'})
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
            self.submitAction('inspect', '{}')

    def confirm(self, title, text):
        return QMessageBox.question(self.window, title, text, QMessageBox.Yes | QMessageBox.No, QMessageBox.No) == QMessageBox.Yes

    def password(self, label):
        text, ok = QInputDialog.getText(self.window, 'تشفير النسخ', label, QLineEdit.Password)
        return text if ok else None

    @Slot(str, str, result=bool)
    def submitAction(self, action, raw):
        if self.request_pending:
            return False
        self.request_pending = True
        try:
            self.send_event('dispatch', action)
            self.handle_request(action, raw)
            return True
        finally:
            self.request_pending = False

    def handle_request(self, action, raw):
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
                self.refresh_history()
                return
            if action == 'history-log':
                identifier = data.get('id')
                def read_log():
                    try:
                        if not self.history.get(identifier):
                            raise ValueError('العملية غير موجودة')
                        self.core.events.put(('history-log', {'id': identifier, 'text': self.history.log(identifier)}))
                    except Exception as error:
                        self.core.events.put(('error', str(error)))
                threading.Thread(target=read_log, daemon=True).start()
                return
            if self.busy:
                self.send_event('log', 'لم يبدأ الأمر '+action+': انتظر اكتمال العملية الجارية\n')
                self.send_event('error', 'انتظر اكتمال العملية الجارية')
                return
            local_actions = {'inspect','setup-scan','setup-agent-service','create-key','install-key','agent','choose-project','choose-key','save-settings','push-github','pull','build','terminal','copy-deploy-command','github-login','github-check'}
            if not self.connection_ready and action not in local_actions:
                raise ValueError('نفّذ فحص الاتصال بنجاح أولًا لإتاحة العمليات')
            if action == 'resume-pending':
                self.start(action, self.resume_pending)
                return
            settings_changed = False
            for name in ('project', 'key', 'version', 'changes'):
                if name in data:
                    if not isinstance(data[name], str) or len(data[name]) > 4096:
                        raise ValueError('Invalid field: ' + name)
                    if getattr(self.core, name).get() != data[name].strip():
                        settings_changed = True
                        if name in ('project','key'):
                            self.connection_ready = False
                            self.send_event('access', False)
                    getattr(self.core, name).set(data[name].strip())
            if settings_changed or action == 'save-settings':
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
            if action == 'copy-deploy-command':
                def prepare_command():
                    _, command = self.core.deploy_command(args[0], args[2], args[3])
                    self.core.events.put(('deploy-command', command))
                self.start(action, prepare_command)
                return
            if action == 'push-github' and not self.confirm('الرفع إلى GitHub', 'رفع التعديلات المجهزة في Git إلى الفرع المعتمد؟'):
                self.send_event('log', 'أُلغي الرفع إلى GitHub.\n')
                return
            actions = {'github-login': self.core.login_github, 'github-check': self.core.check_github, 'inspect': self.inspect_setup, 'terminal': self.core.terminal,
                       'next-release-version': self.core.suggest_release_version, 'push-github': self.core.push_github, 'verify-release': self.core.verify_deployed_application, 'pull': self.core.pull, 'build': self.core.build, 'publish': self.publish_checked, 'readiness': self.core.readiness,
                       'status': self.core.status, 'latest-log': self.core.latest_log,
                       'create-key': self.create_setup_key, 'install-key': self.install_setup_key,
                       'agent': self.load_setup_agent, 'backup-install': self.core.install_backup,
                       'backup-list': self.core.list_backups}
            if action in actions:
                if action == 'publish' and not self.confirm('نشر الإصدار', 'نشر ' + self.core.version.get() + ' على ' + legacy.HOST + '؟ سيأخذ الخادم نسخة احتياطية ويبني الإصدار ويعيد تشغيل التطبيق.'):
                    self.send_event('log', 'أُلغي النشر من نافذة التأكيد.\n')
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
        self.core.events.put(('log', 'النشر على Ubuntu · فحص الجاهزية قبل إرسال الإصدار.\n'))
        result = self.core.readiness(*args)
        if (result.get('preview') or {}).get('scope') in ('desktop', 'unchanged'):
            return 'لا يلزم نشر إصدار على Ubuntu'
        if not result['ready']:
            raise RuntimeError('فحص الجاهزية منع النشر: ' + readiness_failures(result))
        self.core.publish(*args, expected_commit=result['targetCommit'])
        return 'تم النشر والتحقق من الإصدار المشغّل على Ubuntu'

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

    def resume_pending(self):
        reader = self.core
        key = reader.key.get()
        for row in self.history.pending():
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
                    if remote == 'succeeded':
                        reader.verify_release_commit(self.core.project.get(), key, version, '')
                        note = 'نجح النشر وتطابق commit على Windows وGitHub وUbuntu'
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
        self.last_progress_at = time.monotonic()
        self.active_label = label
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
                result = function()
                if (label == 'readiness' and not result.get('ready')
                        and (result.get('preview') or {}).get('scope') not in ('desktop', 'unchanged')):
                    raise RuntimeError('فشل فحص الجاهزية: ' + readiness_failures(result))
                if cancel.is_set():
                    raise TimeoutError('تجاوز الفحص مدته الكلية')
                message = ('اكتملت معاينة النشر؛ راجع تفاصيل الجاهزية' if label == 'readiness'
                           else result if label == 'publish' and isinstance(result, str) else 'اكتملت العملية')
                save_result('succeeded', message)
                self.core.events.put(('log', label + ' — ' + message + '\n' if label == 'publish' else 'نجحت العملية: ' + label + '\n'))
                self.core.events.put(('done', {'ok': True, 'message': message}))
            except Exception as error:
                uncertain = label in WRITE_ACTIONS and self.core.write_started
                save_result('unknown' if uncertain else 'failed', str(error))
                diagnostic = diagnose(str(error))
                if diagnostic:
                    self.core.events.put(('diagnostic', diagnostic))
                message = redact(str(error))
                self.core.events.put(('log', 'فشلت العملية: ' + label + ' — ' + message + '\n'))
                self.core.events.put(('done', {'ok': False, 'message': message, 'uncertain': uncertain}))
        try:
            threading.Thread(target=work, daemon=True).start()
        except RuntimeError as error:
            self.finish_operation({'ok': False, 'message': redact(str(error))})

    def finish_operation(self, result):
        self.inspection_deadline = None
        self.active_job_id = None
        self.active_cancel = None
        self.core.current_job_id = None
        self.active_label = None
        self.last_progress_at = None
        self.busy = False
        self.send_event('operation-finished', result)
        self.refresh_history()

    def check_inspection_deadline(self):
        if not self.inspection_deadline or time.monotonic() < self.inspection_deadline:
            return
        identifier = self.active_job_id
        self.active_cancel.set()
        self.connection_ready = False
        self.send_event('access', False)
        self.send_event('services', ({}, 'انتهت مهلة الفحص'))
        self.send_event('connected', '🔴 انتهت المهلة الكلية للفحص؛ يمكنك المحاولة مجددًا')
        self.send_event('log', 'فشلت العملية: inspect — تجاوز الفحص مهلة 55 ثانية.\n')
        self.finish_operation({'ok': False, 'message': 'تجاوز فحص الاتصال مهلة 55 ثانية.'})
        def record_timeout():
            try:
                self.history.finish(identifier, 'failed', 'تجاوز الفحص مهلة 55 ثانية')
                self.core.events.put(('history', self.history.rows()))
            except Exception:
                pass
        threading.Thread(target=record_timeout, daemon=True).start()

    @Slot(result=bool)
    def processEvents(self):
        if self.processing_events:
            return False
        self.processing_events = True
        try:
            self.drain()
        except Exception as error:
            self.send_event('log', 'فشلت معالجة أحداث الأداة: ' + redact(str(error)) + '\n')
            self.send_event('error', 'تعذر تحديث سجل الأداة؛ راجع آخر رسالة.')
            return False
        finally:
            self.processing_events = False
        return True

    def drain(self):
        self.check_inspection_deadline()
        if self.busy and self.last_progress_at and time.monotonic() - self.last_progress_at >= 15:
            self.last_progress_at = time.monotonic()
            self.send_event('log', 'ما زالت العملية قيد الانتظار: ' + str(self.active_label) + '؛ لم تُكرر الأداة الطلب.\n')
        for _ in range(150):
            try:
                kind, value, identifier = self.core.events.get_nowait()
            except queue.Empty:
                return
            if identifier and identifier != self.active_job_id:
                continue
            if kind == 'log':
                self.last_progress_at = time.monotonic()
                value = redact(value)
                try:
                    self.history.append(identifier, value)
                except Exception:
                    self.send_event('error', 'تعذر حفظ جزء من السجل المحلي؛ تحقق من مساحة القرص')
            if kind == 'done':
                self.finish_operation(value)
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
            elif kind == 'deploy-command':
                QApplication.clipboard().setText(value)
                self.send_event('notice', 'نُسخ أمر النشر. الصقه في الطرفية بحساب radiusdeploy.')
            elif kind == 'release-version':
                if value['replace'] or not self.core.version.get():
                    self.core.version.set(value['version'])
                self.send_event(kind, value)
            elif kind == 'readiness':
                self.send_event(kind, value)
            elif kind == 'backup-created':
                self.backups[value['id']] = value
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
        toolbar = self.addToolBar('GitHub')
        toolbar.setMovable(False)
        operations = (
            ('جلب التحديثات', 'pull', self.bridge.core.pull),
        )
        for title, label, operation in operations:
            action = toolbar.addAction(title)
            action.triggered.connect(
                lambda checked=False, name=label, run=operation: self.run_github_action(name, run))
        self.native_log = QPlainTextEdit(self)
        self.native_log.setReadOnly(True)
        self.native_log.setMaximumBlockCount(1500)
        dock = QDockWidget('سجل عمليات GitHub · review-16', self)
        dock.setWidget(self.native_log)
        self.addDockWidget(Qt.DockWidgetArea.BottomDockWidgetArea, dock)
        self.native_log_dock = dock
        dock.hide()
        self.bridge.message.connect(self.show_native_event)
        self.channel = QWebChannel(self.page)
        self.channel.registerObject('host', self.bridge)
        self.page.setWebChannel(self.channel)
        url = QUrl.fromLocalFile(str(HERE / 'web/index.html'))
        url.setQuery('revision=review-16')
        self.view.load(url)

    def run_github_action(self, action, operation):
        self.native_log_dock.show()
        if self.bridge.busy:
            self.native_log.appendPlainText('انتظر انتهاء العملية الجارية.')
            return
        core = self.bridge.core
        project = core.project.get()
        self.native_log.appendPlainText(f'[{dt.datetime.now():%H:%M:%S}] {action} · {project}')
        try:
            self.bridge.start(action, lambda: operation(project, '', '', ''))
        except Exception as error:
            self.native_log.appendPlainText('تعذر بدء العملية: ' + redact(str(error)))

    @Slot(str)
    def show_native_event(self, raw):
        event = json.loads(raw)
        if event['kind'] in ('log', 'error', 'notice', 'operation-finished'):
            value = event['value']
            if event['kind'] == 'operation-finished':
                value = ('نجحت العملية · ' if value['ok'] else 'فشلت العملية · ') + value['message']
            value = str(value).strip()
            if value:
                self.native_log.appendPlainText(f'[{dt.datetime.now():%H:%M:%S}] {value}')

    def closeEvent(self, event):
        if self.bridge.busy:
            QMessageBox.information(self, 'عملية جارية', 'انتظر اكتمال العملية. إغلاق الأداة لا يلغي النشر على الخادم.')
            event.ignore()
        else:
            self.bridge.core.save_preferences()
            self.bridge.core.server_session.close()
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
