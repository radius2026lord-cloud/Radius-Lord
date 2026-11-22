#!/usr/bin/env python3
"""Local-only Qt WebEngine shell sharing the existing deployment operations."""
import datetime as dt
import importlib.util
import json
import os
import pathlib
import queue
import sys
import threading
import uuid

from PySide6.QtCore import QObject, QTimer, QUrl, Signal, Slot
from PySide6.QtWidgets import QApplication, QFileDialog, QInputDialog, QLineEdit, QMainWindow, QMessageBox
from PySide6.QtWebChannel import QWebChannel
from PySide6.QtWebEngineCore import QWebEnginePage, QWebEngineSettings, QWebEngineUrlRequestInterceptor
from PySide6.QtWebEngineWidgets import QWebEngineView

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
        self.events = queue.Queue()
        self.validated = None
        self.process = None
        self.terminal_process = None


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
        self.busy = False
        self.review = None
        self.reset_review = None
        self.backups = {}
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
            if self.busy:
                self.emit('error', 'انتظر اكتمال العملية الجارية')
                return
            for name in ('project', 'key', 'version', 'changes'):
                if name in data:
                    if not isinstance(data[name], str) or len(data[name]) > 4096:
                        raise ValueError('Invalid field: ' + name)
                    getattr(self.core, name).set(data[name].strip())
            self.core.save_preferences()
            if action in ('choose-project', 'choose-key'):
                path = QFileDialog.getExistingDirectory(self.window, 'مجلد المشروع', self.core.project.get()) if action == 'choose-project' else QFileDialog.getOpenFileName(self.window, 'مفتاح SSH الخاص', str(pathlib.Path.home() / '.ssh'))[0]
                if path:
                    getattr(self.core, 'project' if action == 'choose-project' else 'key').set(path)
                    self.core.validated = None
                    self.core.save_preferences()
                    self.ready()
                return
            if action == 'save-settings':
                self.emit('notice', 'تم حفظ إعدادات الاتصال')
                return
            args = (self.core.project.get(), self.core.key.get(), self.core.version.get(), self.core.changes.get())
            actions = {'inspect': self.core.inspect_host, 'terminal': self.core.terminal,
                       'pull': self.core.pull, 'build': self.core.build, 'publish': self.core.publish,
                       'status': self.core.status, 'latest-log': self.core.latest_log,
                       'create-key': self.core.create_key, 'install-key': self.core.install_key,
                       'agent': self.core.add_agent, 'backup-install': self.core.install_backup,
                       'backup-list': self.core.list_backups}
            if action in actions:
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

    def start(self, label, function):
        self.busy = True
        self.emit('busy', {'active': True, 'action': label})
        def work():
            try:
                function()
                self.core.events.put(('notice', 'اكتملت العملية'))
            except Exception as error:
                self.core.events.put(('log', 'ERROR: ' + str(error) + '\n'))
                self.core.events.put(('error', str(error)))
            finally:
                self.core.events.put(('done', None))
        threading.Thread(target=work, daemon=True).start()

    def drain(self):
        for _ in range(150):
            try:
                kind, value = self.core.events.get_nowait()
            except queue.Empty:
                return
            if kind == 'done':
                self.busy = False
                self.emit('busy', {'active': False})
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
            self.start(action, lambda: (self.core.transfer(key, path, backup_id, upload=True), self.core.list_backups('', key, '', '')))
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
        self.start(action, lambda: self.core.backup_operation(operation, key, request))


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
    window = Window()
    window.show()
    sys.exit(app.exec())
