#!/usr/bin/env python3
"""Local Windows release console. No passwords or private keys are stored here."""
import base64
import json
import os
import pathlib
import queue
import re
import shutil
import shlex
import time
import subprocess
import tempfile
import threading
import sys
import datetime as dt
import hashlib
import uuid
import tkinter as tk
from tkinter import filedialog, messagebox, simpledialog, ttk

BRANCH = 'work/subscriptions-customer-details'
HOST = '78.155.66.122'
PORT = '3001'
USER = 'root'
REMOTE = f'ssh://{USER}@{HOST}:{PORT}/srv/radius-lord/repository.git'
BACKUP_HELPER = '/usr/local/lib/radius-lord/environment-backup.py'
PREFERENCES = pathlib.Path(os.environ.get('LOCALAPPDATA', str(pathlib.Path.home()))) / 'RadiusLord' / 'deploy-console.json'
HELPER = '/srv/radius-lord/repository.git/hooks/radius-deploy.py'
ORIGINS = {'https://github.com/radius2026lord-cloud/Radius-Lord.git', 'https://github.com/radius2026lord-cloud/Radius-Lord', 'git@github.com:radius2026lord-cloud/Radius-Lord.git'}
NO_WINDOW = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
NEW_CONSOLE = getattr(subprocess, 'CREATE_NEW_CONSOLE', 0)


class Console:
    def __init__(self, root):
        self.root = root
        self.events = queue.Queue()
        self.busy = False
        self.validated = None
        self.process = None
        self.tasks = []
        self.terminal_process = None
        self.backup_rows = {}
        self.available_databases = []
        self.reviewed = None
        self.reset_reviewed = None
        self.connected = tk.StringVar(value='⚪ لم يُفحص الاتصال')
        self.summary = tk.StringVar(value='الخادم: لم يُفحص')
        try:
            preferences = json.loads(PREFERENCES.read_text(encoding='utf-8'))
        except (OSError, ValueError):
            preferences = {}
        root.title('Radius Lord — النشر المحلي')
        root.geometry('1180x900')
        root.minsize(820, 620)
        style = ttk.Style()
        style.theme_use('clam')
        style.configure('TButton', padding=9)
        style.configure('TLabel', font=('Segoe UI', 11))
        outer = ttk.Frame(root, padding=18)
        outer.pack(fill='both', expand=True)
        ttk.Label(outer, text='Radius Lord | إدارة النشر المحلي', font=('Segoe UI', 19, 'bold')).pack(anchor='e')
        ttk.Label(outer, text=f'Ubuntu {HOST}:{PORT} • {USER} • الفرع: {BRANCH}').pack(anchor='e', pady=7)
        self.project = tk.StringVar(value=str(pathlib.Path(__file__).resolve().parents[2]))
        self.key = tk.StringVar(value=str(pathlib.Path.home() / '.ssh/id_ed25519_radius_lord'))
        self.project.set(preferences.get('project', self.project.get()))
        self.key.set(preferences.get('key', self.key.get()))
        self.version = tk.StringVar(value='v1.0.4')
        self.version.set(preferences.get('version', self.version.get()))
        self.changes = tk.StringVar(value='')
        self.state = tk.StringVar(value='جاهز — افحص اتصال SSH ثم اجلب التحديثات وابنِ المشروع')
        form = ttk.Frame(outer)
        form.pack(fill='x', pady=9)
        for row, (label, variable) in enumerate([('مجلد المشروع', self.project), ('مسار مفتاح SSH الخاص', self.key), ('رقم الإصدار', self.version), ('وصف التغييرات', self.changes)]):
            ttk.Label(form, text=label).grid(row=row, column=2, sticky='e', padx=8, pady=5)
            ttk.Entry(form, textvariable=variable, justify='right').grid(row=row, column=1, sticky='ew', pady=5)
        form.columnconfigure(1, weight=1)
        ttk.Button(form, text='اختيار', command=self.choose_project).grid(row=0, column=0, padx=5)
        ttk.Button(form, text='اختيار', command=self.choose_key).grid(row=1, column=0, padx=5)
        ttk.Label(outer, textvariable=self.connected).pack(anchor='e')
        notebook = ttk.Notebook(outer)
        notebook.pack(fill='x', pady=5)
        deploy_tab = ttk.Frame(notebook, padding=6)
        backup_tab = ttk.Frame(notebook, padding=6)
        notebook.add(deploy_tab, text='النشر والاتصال')
        notebook.add(backup_tab, text='نسخ البيئة واستعادتها')
        maintenance_tab = ttk.Frame(notebook, padding=8)
        notebook.add(maintenance_tab, text='تنظيف البيانات القديمة')
        self.maintenance_ui(maintenance_tab)
        setup = ttk.LabelFrame(deploy_tab, text='تجهيز SSH مرة واحدة', padding=8)
        setup.pack(fill='x', pady=7)
        self.button(setup, 'إنشاء مفتاح محمي', self.create_key)
        self.button(setup, 'تثبيت المفتاح على الخادم', self.install_key)
        self.button(setup, 'تحميل المفتاح في SSH Agent', self.add_agent)
        self.button(setup, 'فحص الاتصال', self.inspect_host)
        actions = ttk.Frame(deploy_tab)
        actions.pack(fill='x', pady=9)
        self.button(actions, 'جلب تحديثات GitHub', self.pull)
        self.button(actions, 'بناء وفحص المشروع', self.build)
        self.button(actions, 'رفع الإصدار', self.publish)
        self.button(actions, 'تحديث حالة الإصدار', self.status)
        self.button(actions, '🖥 فتح طرفية SSH', self.terminal)
        self.button(actions, '📋 سجل النشر الأخير', self.latest_log)
        ttk.Label(deploy_tab, textvariable=self.summary, wraplength=1080).pack(anchor='e')
        self.backup_ui(backup_tab)
        toolbar = ttk.Frame(outer)
        toolbar.pack(fill='x')
        for title, command in [('نسخ المحدد', self.copy_selected), ('نسخ الكل', self.copy_all), ('حفظ السجل', self.save_log), ('مسح السجل', self.clear_log)]:
            ttk.Button(toolbar, text=title, command=command).pack(side='right', padx=3)
        self.follow = tk.BooleanVar(value=True)
        ttk.Checkbutton(toolbar, text='متابعة السجل', variable=self.follow).pack(side='right')
        ttk.Label(outer, textvariable=self.state, wraplength=950).pack(anchor='e', pady=7)
        self.progress = ttk.Progressbar(outer, mode='indeterminate')
        self.progress.pack(fill='x')
        logs = ttk.Frame(outer)
        logs.pack(fill='both', expand=True, pady=10)
        self.log = tk.Text(logs, bg='#101b2c', fg='#d9e8ff', font=('Consolas', 10), wrap='word', state='disabled', exportselection=False)
        scroll = ttk.Scrollbar(logs, command=self.log.yview)
        self.log.configure(yscrollcommand=scroll.set)
        scroll.pack(side='right', fill='y')
        self.log.pack(fill='both', expand=True)
        self.log.bind('<Control-c>', self.copy_selected)
        self.log.bind('<Control-C>', self.copy_selected)
        self.log.bind('<Control-a>', self.select_all)
        menu = tk.Menu(self.log, tearoff=False)
        menu.add_command(label='نسخ المحدد', command=self.copy_selected)
        menu.add_command(label='نسخ الكل', command=self.copy_all)
        menu.add_command(label='تحديد الكل', command=self.select_all)
        menu.add_separator()
        menu.add_command(label='مسح السجل', command=self.clear_log)
        self.log.bind('<Button-3>', lambda event: menu.tk_popup(event.x_root, event.y_root))
        root.after(100, self.drain)
        root.protocol('WM_DELETE_WINDOW', self.close)

    def button(self, parent, label, action):
        button = ttk.Button(parent, text=label, command=lambda: self.start(action))
        button.pack(side='right', padx=3, pady=3)
        self.tasks.append(button)

    def choose_project(self):
        if not self.busy:
            value = filedialog.askdirectory()
            if value:
                self.project.set(value)
                self.validated = None

    def choose_key(self):
        if not self.busy:
            value = filedialog.askopenfilename(title='اختر المفتاح الخاص، وليس ملف .pub')
            if value:
                self.key.set(value)

    def start(self, action):
        if self.busy:
            return
        self.save_preferences()
        dialog_actions = {self.configure_key: 'key', self.create_backup: 'create', self.download_backup: 'download', self.upload_backup: 'upload', self.review_backup: 'review', self.restore_backup: 'restore', self.delete_backup: 'delete', self.configure_schedule: 'schedule', self.reset_plan: 'reset-plan', self.reset_apply: 'reset-apply'}
        if action in dialog_actions:
            self.backup_dialog(dialog_actions[action])
            return
        values = (self.project.get(), self.key.get(), self.version.get().strip(), self.changes.get().strip())
        if action == self.publish and not messagebox.askyesno('رفع إصدار', f'نشر {values[2]} على {HOST}؟\nسيأخذ الخادم نسخة احتياطية ويبني الإصدار ثم يعيد تشغيل التطبيق.'):
            return
        self.busy = True
        for button in self.tasks:
            button.configure(state='disabled')
        self.progress.configure(mode='indeterminate')
        self.progress.start()
        self.state.set('جارٍ تنفيذ العملية…')
        def work():
            try:
                action(*values)
                self.events.put(('state', 'اكتملت العملية — راجع النتيجة في السجل'))
            except Exception as error:
                self.events.put(('state', 'توقفت العملية: ' + str(error)))
                self.events.put(('log', '\nERROR: ' + str(error) + '\n'))
            finally:
                self.events.put(('done', None))
        threading.Thread(target=work, daemon=True).start()

    def drain(self):
        while True:
            try:
                kind, value = self.events.get_nowait()
            except queue.Empty:
                break
            if kind == 'log':
                self.log.configure(state='normal')
                self.log.insert('end', value)
                if self.follow.get() and not self.log.tag_ranges('sel'):
                    self.log.see('end')
                self.log.configure(state='disabled')
            elif kind == 'transfer':
                count, total = value
                self.progress.stop()
                self.progress.configure(mode='determinate', maximum=max(total, 1), value=count)
                self.state.set('جارٍ النقل: %.1f / %.1f MiB (%d%%)' % (count / 1024**2, total / 1024**2, min(100, count * 100 // max(total, 1))))
            elif kind == 'connected':
                self.connected.set(value)
            elif kind == 'summary':
                self.summary.set(value)
            elif kind == 'backups':
                self.populate_backups(value)
            elif kind == 'reset-review':
                self.reset_reviewed = value
                messagebox.showinfo('خطة تنظيف المركزية', json.dumps(value, ensure_ascii=False, indent=2))
            elif kind == 'review':
                self.reviewed = value
                messagebox.showinfo('مراجعة الاستعادة', json.dumps(value, ensure_ascii=False, indent=2))
            elif kind == 'state':
                self.state.set(value)
            else:
                self.busy = False
                self.progress.stop()
                for button in self.tasks:
                    button.configure(state='normal')
        self.root.after(100, self.drain)

    def run(self, args, cwd=None, timeout=60, stream=False, env=None, console=False):
        if console:
            process = self.console_process(args)
            self.process = process
            try:
                result = process.wait()
            finally:
                self.process = None
            if result:
                raise RuntimeError('فشلت العملية؛ راجع رسالة النافذة المنفصلة')
            return ''
        executable = shutil.which(args[0])
        if not executable:
            raise RuntimeError('الأداة غير موجودة: ' + args[0])
        chunks = []
        process = subprocess.Popen([executable, *args[1:]], cwd=cwd, stdout=subprocess.PIPE,
                                   stderr=subprocess.STDOUT, env=env, creationflags=NO_WINDOW)
        self.process = process
        def read_output():
            for raw in iter(process.stdout.readline, b''):
                line = raw.decode('utf-8', errors='replace')
                chunks.append(line)
                if stream:
                    self.events.put(('log', line))
            process.stdout.close()
        reader = threading.Thread(target=read_output, daemon=True)
        reader.start()
        try:
            code = process.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            # Avoid orphan Git/build processes; never repeat an uncertain push.
            self.events.put(('state', 'العملية تجاوزت الوقت المتوقع؛ ننتظر انتهاءها دون تكرارها'))
            code = process.wait()
        finally:
            self.process = None
        reader.join()
        text = ''.join(chunks)
        if code and not stream:
            self.events.put(('log', text + '\n'))
        if code:
            raise RuntimeError('فشل الأمر: ' + args[0] + ' (exit ' + str(code) + ')')
        return text.strip()

    def repository(self, project):
        project = str(pathlib.Path(project).resolve())
        if self.run(['git', 'rev-parse', '--show-toplevel'], project).replace('\\', '/').casefold() != project.replace('\\', '/').casefold():
            raise RuntimeError('اختر جذر مستودع المشروع')
        if self.run(['git', 'branch', '--show-current'], project) != BRANCH:
            raise RuntimeError('الفرع المحلي ليس الفرع المعتمد')
        if self.run(['git', 'remote', 'get-url', 'origin'], project) not in ORIGINS:
            raise RuntimeError('origin ليس مستودع Radius Lord المعتمد')
        if self.run(['git', 'status', '--porcelain', '--untracked-files=normal'], project):
            raise RuntimeError('احفظ تعديلات المشروع في Git أولًا؛ لن نحذفها أو نخزنها تلقائيًا')
        return project

    def ssh(self, key):
        if not pathlib.Path(key).is_file() or key.endswith('.pub'):
            raise RuntimeError('اختر مفتاح SSH الخاص الموجود على جهازك')
        return ['ssh', '-p', PORT, '-i', key, '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=10', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=3', f'{USER}@{HOST}']

    def create_key(self, project, key, version, changes):
        if pathlib.Path(key).exists() or pathlib.Path(key + '.pub').exists():
            raise RuntimeError('المفتاح موجود؛ لن نستبدله')
        pathlib.Path(key).parent.mkdir(parents=True, exist_ok=True)
        self.events.put(('log', 'ستفتح نافذة: اختر عبارة مرور للمفتاح وأكدها.\n'))
        self.run(['ssh-keygen', '-t', 'ed25519', '-f', key, '-C', 'Radius-Lord-local-deploy'], console=True, timeout=600)

    def install_key(self, project, key, version, changes):
        parts = pathlib.Path(key + '.pub').read_text().strip().split()
        if len(parts) < 2 or parts[0] != 'ssh-ed25519' or not re.fullmatch(r'[A-Za-z0-9+/=]+', parts[1]):
            raise RuntimeError('ملف المفتاح العام غير صالح')
        base64.b64decode(parts[1], validate=True)
        public = parts[0] + ' ' + parts[1] + ' Radius-Lord-local-deploy'
        command = "umask 077; mkdir -p ~/.ssh && touch ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys && (grep -qxF '" + public + "' ~/.ssh/authorized_keys || printf '%s\\n' '" + public + "' >> ~/.ssh/authorized_keys)"
        self.events.put(('log', 'ستفتح نافذة SSH لإدخال كلمة مرور root مرة واحدة. تحقق من البصمة عند أول اتصال.\n'))
        self.run(['ssh', '-p', PORT, '-o', 'PubkeyAuthentication=no', f'{USER}@{HOST}', command], console=True, timeout=600)

    def add_agent(self, project, key, version, changes):
        self.events.put(('log', 'ستفتح نافذة لإدخال عبارة مرور المفتاح. يجب تشغيل خدمة Windows OpenSSH Authentication Agent مسبقًا.\n'))
        self.run(['ssh-add', key], console=True, timeout=600)

    def inspect_host(self, project, key, version, changes):
        self.events.put(('connected', '🟡 جارٍ فحص الاتصال'))
        try:
            text = self.run([*self.ssh(key), 'sudo -n -u radiusdeploy python3 ' + HELPER + ' inspect'])
            data = json.loads(text)
            self.events.put(('log', text + '\n'))
            command = "for unit in radius-lord-backend radius-lord-frontend mysql freeradius; do printf '%s: ' \"$unit\"; systemctl is-active \"$unit\" || true; done"
            services = self.run([*self.ssh(key), command])
            self.events.put(('summary', 'الإصدار: ' + str(data.get('currentVersion')) + ' | ' + services.replace('\n', ' | ')))
            self.events.put(('connected', '🟢 اتصال SSH ناجح — آخر فحص ' + dt.datetime.now().strftime('%H:%M:%S')))
        except Exception as error:
            self.events.put(('connected', '🔴 تعذر الاتصال: ' + str(error)))
            raise


    def pull(self, project, key, version, changes):
        project = self.repository(project)
        self.validated = None
        self.run(['git', 'pull', '--ff-only', 'origin', BRANCH], project, stream=True, timeout=300)
        self.run(['git', 'log', '-1', '--oneline'], project, stream=True)

    def build(self, project, key, version, changes):
        project = self.repository(project)
        self.validated = None
        commit = self.run(['git', 'rev-parse', 'HEAD'], project)
        npm = 'npm.cmd' if os.name == 'nt' else 'npm'
        for folder in [str(pathlib.Path(project) / 'src/app/backend'), project]:
            self.events.put(('log', 'BUILD: ' + folder + '\n'))
            self.run([npm, 'ci', '--include=dev'], folder, stream=True, timeout=1800)
            self.run([npm, 'run', 'build'], folder, stream=True, timeout=1800)
        self.repository(project)
        if self.run(['git', 'rev-parse', 'HEAD'], project) != commit:
            raise RuntimeError('تغير الإصدار أثناء البناء؛ أعد الفحص')
        self.validated = (project, commit)
        self.events.put(('log', 'نجح بناء الباك إند والواجهة للإصدار: ' + commit + '\n'))

    def publish(self, project, key, version, changes):
        project = self.repository(project)
        commit = self.run(['git', 'rev-parse', 'HEAD'], project)
        if self.validated != (project, commit):
            raise RuntimeError('ابنِ هذا الإصدار بنجاح من الأداة أولًا')
        if not re.fullmatch(r'v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)', version) or not 0 < len(changes) <= 4000:
            raise RuntimeError('أدخل رقمًا مثل v1.0.4 ووصفًا من 1 إلى 4000 حرف')
        if self.run(['git', 'remote', 'get-url', '--push', 'production'], project) != REMOTE:
            raise RuntimeError('وجهة production لا تطابق الخادم المعتمد')
        self.run([*self.ssh(key), 'test ! -e /srv/radius-lord/maintenance-recovery.json'])
        info = json.loads(self.run([*self.ssh(key), 'sudo -n -u radiusdeploy python3 ' + HELPER + ' inspect']))
        if not info.get('ready'):
            raise RuntimeError('فحص الخادم غير جاهز؛ راجع زر فحص الاتصال')
        current = info.get('currentVersion')
        if current and tuple(map(int, version[1:].split('.'))) <= tuple(map(int, current[1:].split('.'))):
            raise RuntimeError('رقم الإصدار يجب أن يكون أحدث من: ' + current)
        manifest = {'version': version, 'commit': commit, 'changes': changes}
        tag = 'refs/tags/radius-release/' + version
        ssh_command = ' '.join(shlex.quote(arg.replace('\\', '/')) for arg in self.ssh(key)[:-1])
        # Git supplies its own host; keep key authentication and strict host verification.
        env = {**os.environ, 'GIT_SSH_COMMAND': ssh_command, 'GIT_SSH_VARIANT': 'ssh'}
        existing = self.run(['git', 'ls-remote', '--upload-pack=sudo -n -u radiusdeploy git-upload-pack', '--tags', 'production', tag], project, env=env)
        if existing:
            raise RuntimeError('الوسم موجود على الخادم؛ استخدم تحديث الحالة ولا تعِد نشره')
        local = self.run(['git', 'tag', '--list', 'radius-release/' + version], project)
        if local:
            stored = json.loads(self.run(['git', 'for-each-ref', '--format=%(contents)', tag], project))
            target = self.run(['git', 'rev-parse', tag + '^{commit}'], project)
            if stored != manifest or target != commit:
                raise RuntimeError('وسم محلي مختلف موجود؛ اختر رقمًا جديدًا')
        else:
            handle, file = tempfile.mkstemp(suffix='.json')
            try:
                with os.fdopen(handle, 'w', encoding='utf-8', newline='\n') as stream:
                    json.dump(manifest, stream, ensure_ascii=False)
                self.run(['git', 'tag', '-a', 'radius-release/' + version, '-F', file], project)
            finally:
                os.unlink(file)
        self.run(['git', 'push', '--receive-pack=sudo -n -u radiusdeploy git-receive-pack', 'production', tag], project, env=env, stream=True, timeout=1800)
        self.events.put(('log', 'استلم الخادم الإصدار. الرفع لا يعني اكتمال النشر؛ استخدم تحديث حالة الإصدار.\n'))
        last = None
        failures = 0
        deadline = time.monotonic() + 10800
        terminal = {'succeeded', 'failed', 'failed_rolled_back', 'recovery_required'}
        while time.monotonic() < deadline:
            try:
                data = json.loads(self.run([*self.ssh(key), 'sudo -n -u radiusdeploy python3 ' + HELPER + ' status ' + version]))
                failures = 0
            except Exception:
                failures += 1
                self.events.put(('log', 'تعذر قراءة الحالة؛ النشر قد يستمر على الخادم. سنعيد فحص الحالة فقط.\n'))
                if failures >= 5:
                    raise RuntimeError('تعذر متابعة الاتصال؛ لا تعِد الرفع. استخدم تحديث الحالة لاحقًا')
                time.sleep(10)
                continue
            state = data.get('status')
            if state != last:
                self.events.put(('log', 'DEPLOY: ' + str(state) + '\n'))
                self.events.put(('state', 'مرحلة الخادم: ' + str(state)))
                last = state
            if state in terminal:
                self.status(project, key, version, changes)
                if state != 'succeeded':
                    raise RuntimeError('حالة النشر: ' + state + ' — راجع السجل قبل أي إصدار آخر')
                return
            time.sleep(10)
        raise RuntimeError('انتهت مدة المتابعة؛ لا تعِد الرفع، تحقق من الحالة لاحقًا')

    def status(self, project, key, version, changes):
        if not re.fullmatch(r'v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)', version):
            raise RuntimeError('رقم الإصدار غير صالح')
        text = self.run([*self.ssh(key), 'sudo -n -u radiusdeploy python3 ' + HELPER + ' status ' + version])
        data = json.loads(text)
        self.events.put(('log', json.dumps(data, ensure_ascii=False, indent=2) + '\n'))
        if data.get('status') not in {'not_received', 'queued'}:
            self.run([*self.ssh(key), 'tail -n 60 /srv/radius-lord/logs/' + version + '.log'], stream=True)

    def save_preferences(self):
        PREFERENCES.parent.mkdir(parents=True, exist_ok=True)
        value = {'host': HOST, 'port': PORT, 'user': USER, 'project': self.project.get(),
                 'key': self.key.get(), 'version': self.version.get()}
        temporary = PREFERENCES.with_suffix('.tmp')
        temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')
        os.replace(temporary, PREFERENCES)

    def copy_selected(self, event=None):
        try:
            text = self.log.get('sel.first', 'sel.last')
        except tk.TclError:
            return 'break'
        self.root.clipboard_clear()
        self.root.clipboard_append(text)
        return 'break'

    def select_all(self, event=None):
        self.log.tag_add('sel', '1.0', 'end-1c')
        self.log.focus_set()
        return 'break'

    def copy_all(self):
        self.root.clipboard_clear()
        self.root.clipboard_append(self.log.get('1.0', 'end-1c'))

    def clear_log(self):
        self.log.configure(state='normal')
        self.log.delete('1.0', 'end')
        self.log.configure(state='disabled')

    def save_log(self):
        path = filedialog.asksaveasfilename(defaultextension='.log', filetypes=[('Log', '*.log')])
        if path:
            pathlib.Path(path).write_text(self.log.get('1.0', 'end-1c'), encoding='utf-8')

    def console_process(self, args):
        payload = base64.urlsafe_b64encode(json.dumps(args).encode('utf-8')).decode('ascii')
        return subprocess.Popen([sys.executable, str(pathlib.Path(__file__).with_name('console-session.py')), payload],
                                creationflags=NEW_CONSOLE)

    def terminal(self, project, key, version, changes):
        if self.terminal_process and self.terminal_process.poll() is None:
            raise RuntimeError('طرفية SSH مفتوحة بالفعل')
        args = self.ssh(key)
        args.insert(1, '-tt')
        self.terminal_process = self.console_process(args)
        self.events.put(('log', 'فُتحت طرفية OpenSSH مستقلة؛ حالة الجلسة تظهر داخل نافذتها.\n'))

    def latest_log(self, project, key, version, changes):
        info = json.loads(self.run([*self.ssh(key), 'sudo -n -u radiusdeploy python3 ' + HELPER + ' inspect']))
        current = info.get('currentVersion')
        if not current:
            raise RuntimeError('لا يوجد إصدار جارٍ')
        self.status(project, key, current, changes)

    def backup_ui(self, parent):
        row = ttk.Frame(parent)
        row.pack(fill='x')
        self.backup_kind = tk.StringVar(value='full')
        ttk.Label(row, text='نوع النسخة:').pack(side='right')
        ttk.Combobox(row, textvariable=self.backup_kind, values=['full', 'project', 'databases'], state='readonly', width=12).pack(side='right', padx=5)
        ttk.Label(row, text='full: كاملة | project: المشروع | databases: القواعد').pack(side='right')
        self.button(row, '🔧 تجهيز إدارة النسخ', self.install_backup)
        self.button(row, '🔐 ضبط تشفير النسخ', self.configure_key)
        self.button(row, '🔄 تحديث القائمة', self.list_backups)
        self.db_list = tk.Listbox(parent, selectmode='multiple', height=3, exportselection=False)
        self.db_list.pack(fill='x', pady=3)
        ttk.Label(parent, text='اختر القواعد من القائمة؛ لا تحديد = جميع القواعد المحلية المدعومة. النسخ يتوقف بالخدمات مؤقتًا.').pack(anchor='e')
        tree_frame = ttk.Frame(parent)
        tree_frame.pack(fill='x', pady=4)
        self.backup_tree = ttk.Treeview(tree_frame, columns=('kind', 'date', 'size', 'version', 'verified'), show='tree headings', height=4)
        self.backup_tree.heading('#0', text='معرّف النسخة')
        for column, title in [('kind', 'النوع'), ('date', 'التاريخ UTC'), ('size', 'الحجم MiB'), ('version', 'الإصدار'), ('verified', 'السلامة')]:
            self.backup_tree.heading(column, text=title)
            self.backup_tree.column(column, width=110)
        self.backup_tree.column('#0', width=280)
        backup_scroll = ttk.Scrollbar(tree_frame, orient='vertical', command=self.backup_tree.yview)
        self.backup_tree.configure(yscrollcommand=backup_scroll.set)
        backup_scroll.pack(side='right', fill='y')
        self.backup_tree.pack(side='left', fill='both', expand=True)
        actions = ttk.Frame(parent)
        actions.pack(fill='x')
        for label, action in [('➕ إنشاء نسخة', self.create_backup), ('⬇ تنزيل', self.download_backup), ('⬆ رفع نسخة', self.upload_backup),
                              ('🔎 فحص ومراجعة', self.review_backup), ('↩ استعادة', self.restore_backup), ('🗑 حذف', self.delete_backup), ('🕒 الجدولة', self.configure_schedule)]:
            self.button(actions, label, action)

    def backup_request(self, action, **data):
        if self.busy:
            return
        project, key = self.project.get(), self.key.get()
        version, changes = self.version.get(), self.changes.get()
        self.start(lambda *_: self.backup_operation(action, key, data))

    def rpc(self, action, key, data=None):
        args = [*self.ssh(key), 'python3 ' + BACKUP_HELPER + ' ' + action]
        result = subprocess.run(args, input=json.dumps(data or {}).encode('utf-8'), stdout=subprocess.PIPE,
                                stderr=subprocess.PIPE, creationflags=NO_WINDOW)
        if result.returncode:
            error = result.stderr.decode('utf-8', errors='replace').strip()
            raise RuntimeError(error or 'فشلت عملية إدارة النسخ')
        value = json.loads(result.stdout)
        return value

    def install_backup(self, project, key, version, changes):
        source = pathlib.Path(project) / 'deployment/ubuntu/environment-backup.py'
        # Validate the canonical worktree before installing privileged maintenance code.
        self.repository(project)
        self.transfer(key, str(source), '/usr/local/lib/radius-lord/environment-backup.py', upload=True, install=True)
        self.run([*self.ssh(key), 'if ! command -v gpg >/dev/null; then apt-get update && apt-get install -y gnupg; fi; command -v gpg && command -v mysqldump && python3 -m py_compile ' + BACKUP_HELPER], stream=True)
        self.transfer(key, str(pathlib.Path(project) / 'deployment/ubuntu/reset-central-operational.py'), '/usr/local/lib/radius-lord/reset-central-operational.py', upload=True, install=True)
        self.list_backups(project, key, version, changes)

    def configure_key(self, *args):
        # Dialogs must run on Tk's main thread, before the worker starts.
        raise RuntimeError('استخدم زر ضبط التشفير من الواجهة')

    def selected_backup(self):
        selected = self.backup_tree.selection()
        if not selected:
            messagebox.showinfo('النسخ', 'اختر نسخة من القائمة أولًا')
            return None
        return selected[0]

    def populate_backups(self, data):
        self.backup_tree.delete(*self.backup_tree.get_children())
        self.backup_rows = {row['id']: row for row in data['backups']}
        for row in data['backups']:
            self.backup_tree.insert('', 'end', iid=row['id'], text=row['id'], values=(row['kind'], row['createdAt'],
                round(row.get('bytes', 0) / 1024**2, 2), row.get('release', {}).get('version', '—'), '✓' if row.get('verified') else 'لم يُفحص'))
        self.available_databases = data['databases']
        self.db_list.delete(0, 'end')
        for name in data['databases']:
            self.db_list.insert('end', name)
        if data.get('maintenanceRecovery'):
            self.events.put(('log', '⚠ صيانة تحتاج استعادة: ' + json.dumps(data['maintenanceRecovery'], ensure_ascii=False) + '\n'))
        for receipt in data.get('restoreReceipts', []):
            if receipt.get('status') in ('recovery_required', 'restoring'):
                self.events.put(('log', '⚠ استعادة تحتاج مراجعة: ' + json.dumps(receipt, ensure_ascii=False) + '\n'))
        self.events.put(('log', 'سياسة النسخ: ' + json.dumps(data.get('policy'), ensure_ascii=False) + '\n'))

    def list_backups(self, project, key, version, changes):
        self.events.put(('backups', self.rpc('list', key)))

    def backup_operation(self, action, key, data):
        if action in ('create', 'restore', 'reset-apply'):
            self.events.put(('state', 'جارٍ تنفيذ العملية على الخادم؛ قد تتوقف الخدمات مؤقتًا. انتظر ولا تكرر الطلب عند انقطاع الاتصال.'))
        result = self.rpc(action, key, data)
        self.events.put(('log', json.dumps(result, ensure_ascii=False, indent=2) + '\n'))
        if action == 'reset-plan':
            self.events.put(('reset-review', result))
        if action == 'review':
            self.events.put(('review', result))
        self.events.put(('backups', self.rpc('list', key)))

    def create_backup(self, *args):
        raise RuntimeError('استخدم زر إنشاء النسخة من الواجهة')

    def download_backup(self, *args):
        raise RuntimeError('استخدم زر التنزيل من الواجهة')

    def upload_backup(self, *args):
        raise RuntimeError('استخدم زر الرفع من الواجهة')

    def review_backup(self, *args):
        raise RuntimeError('استخدم زر المراجعة من الواجهة')

    def restore_backup(self, *args):
        raise RuntimeError('استخدم زر الاستعادة من الواجهة')

    def delete_backup(self, *args):
        raise RuntimeError('استخدم زر الحذف من الواجهة')

    def configure_schedule(self, *args):
        raise RuntimeError('استخدم زر الجدولة من الواجهة')

    def transfer(self, key, local, remote, upload=False, install=False):
        # Binary SSH stream; local paths never appear in remote shell commands.
        # stderr goes to a private temporary stream so it cannot deadlock the pipe.
        source = pathlib.Path(local)
        if install:
            if remote not in (BACKUP_HELPER, '/usr/local/lib/radius-lord/reset-central-operational.py'):
                raise ValueError('Unsupported helper path')
            command = ('install -d -m 755 /usr/local/lib/radius-lord && umask 077 && cat > ' + remote + '.part'
                       + ' && python3 -m py_compile ' + remote + '.part && chmod 700 ' + remote + '.part && mv '
                       + remote + '.part ' + remote)
        else:
            if not re.fullmatch(r'b-[0-9]{8}T[0-9]{6}Z-[a-f0-9]{12}', remote):
                raise ValueError('معرّف النسخة غير صالح')
            command = 'python3 ' + BACKUP_HELPER + (' receive ' if upload else ' send ') + remote
        total = source.stat().st_size if upload else next(row['bytes'] for row in self.rpc('list', key)['backups'] if row['id'] == remote)
        checksum = hashlib.sha256()
        count = 0
        last = 0
        target = source.with_name(source.name + '.part')
        with tempfile.TemporaryFile() as errors:
            process = subprocess.Popen([*self.ssh(key), command], stdin=subprocess.PIPE if upload else subprocess.DEVNULL,
                        stdout=subprocess.DEVNULL if upload else subprocess.PIPE, stderr=errors, creationflags=NO_WINDOW)
            self.process = process
            try:
                with source.open('rb') if upload else target.open('xb') as file:
                    while True:
                        chunk = file.read(1024 * 1024) if upload else process.stdout.read(1024 * 1024)
                        if not chunk:
                            break
                        if upload:
                            process.stdin.write(chunk)
                        else:
                            file.write(chunk)
                        checksum.update(chunk)
                        count += len(chunk)
                        if time.monotonic() - last >= 0.3:
                            self.events.put(('transfer', (count, total)))
                            last = time.monotonic()
                if upload:
                    process.stdin.close()
                else:
                    process.stdout.close()
                code = process.wait()
                if code:
                    errors.seek(0)
                    raise RuntimeError(errors.read().decode('utf-8', errors='replace'))
                if not install:
                    rows = self.rpc('list', key)['backups']
                    expected = next(row for row in rows if row['id'] == remote)
                    if checksum.hexdigest() != expected['sha256']:
                        raise RuntimeError('فشل فحص SHA256 للنقل')
                if not upload:
                    os.replace(target, source)
                self.events.put(('transfer', (count, total)))
                self.events.put(('log', 'نجح النقل والتحقق: %.1f MiB\n' % (count / 1024**2)))
            finally:
                if process.poll() is None:
                    process.terminate()
                    process.wait()
                self.process = None
                if not upload:
                    target.unlink(missing_ok=True)

    def maintenance_ui(self, parent):
        ttk.Label(parent, text='تنظيف السجلات التشغيلية من القاعدة المركزية مع الاحتفاظ بالإضافة الحالية. راجع الخطة قبل التنفيذ.', wraplength=1000).pack(anchor='e', pady=8)
        row = ttk.Frame(parent)
        row.pack(fill='x')
        self.keep_server = tk.StringVar(value='2')
        self.keep_radius = tk.StringVar(value='24557')
        for title, value in [('معرّف MySQL المحتفظ به', self.keep_server), ('معرّف FreeRADIUS المحتفظ به', self.keep_radius)]:
            ttk.Label(row, text=title).pack(side='right', padx=4)
            ttk.Entry(row, textvariable=value, width=12).pack(side='right', padx=4)
        actions = ttk.Frame(parent)
        actions.pack(fill='x', pady=10)
        self.button(actions, '🔎 عرض خطة التنظيف', self.reset_plan)
        self.button(actions, '🗑 تنفيذ الخطة بعد المراجعة', self.reset_apply)
        ttk.Label(parent, text='تُحفظ الإدارة والخطط المرجعية وخادم MySQL المحدد وSSH وخادم FreeRADIUS المحدد وإعدادات الاستضافة. لا يحذف قواعد الشبكات الفعلية أو ملفات FreeRADIUS أو موارد CHR أو الملفات المرفوعة.', wraplength=1000).pack(anchor='e')

    def reset_plan(self, *args):
        raise RuntimeError('استخدم زر عرض الخطة من الواجهة')

    def reset_apply(self, *args):
        raise RuntimeError('استخدم زر تنفيذ الخطة من الواجهة')

    def backup_dialog(self, action):
        if self.busy:
            return
        key = self.key.get()
        data = {}
        if action in ('reset-plan', 'reset-apply'):
            server, radius = self.keep_server.get().strip(), self.keep_radius.get().strip()
            if not server.isdigit() or not radius.isdigit():
                messagebox.showerror('التنظيف', 'أدخل معرّفات الخوادم الصحيحة')
                return
            data = {'keepServer': int(server), 'keepRadius': int(radius)}
            if action == 'reset-apply':
                if not self.reset_reviewed or any(self.reset_reviewed.get(k) != data[k] for k in data):
                    messagebox.showinfo('التنظيف', 'راجع خطة التنظيف لهذه المعرّفات أولًا')
                    return
                text = simpledialog.askstring('تأكيد تنظيف البيانات', 'ستُحذف بيانات العملاء والشبكات والاشتراكات القديمة من المركزية. اكتب RESET لتنفيذ الخطة المعروضة؛ تؤخذ نسخة كاملة قبل الحذف:')
                if text != 'RESET':
                    return
                data['planSha256'] = self.reset_reviewed['planSha256']
        elif action == 'key':
            password = simpledialog.askstring('تشفير النسخ', 'عبارة تشفير النسخ (16 حرفًا على الأقل)؛ احتفظ بها خارج الخادم:', show='*')
            if not password:
                return
            confirmation = simpledialog.askstring('تأكيد التشفير', 'أعد كتابة عبارة التشفير:', show='*')
            if password != confirmation:
                messagebox.showerror('التشفير', 'العبارتان غير متطابقتين')
                return
            data = {'passphrase': password}
        elif action == 'create':
            if not self.available_databases:
                messagebox.showinfo('النسخ', 'جهّز إدارة النسخ وحدّث القائمة أولًا')
                return
            data = {'kind': self.backup_kind.get()}
            selection = [self.db_list.get(i) for i in self.db_list.curselection()]
            names = selection or self.available_databases
            detail = 'النوع: ' + data['kind'] + '\n'
            if data['kind'] != 'project':
                detail += 'القواعد المحلية: ' + ', '.join(names) + '\n'
            if data['kind'] != 'databases':
                detail += 'الباك إند والفرونت إند للإصدار الجاري + ملفات shared + مواد الاستعادة.\n'
            detail += 'ستتوقف خدمات المشروع وFreeRADIUS مؤقتًا لضمان تناسق النسخة. متابعة؟'
            if not messagebox.askyesno('مراجعة محتويات النسخة', detail):
                return
            if selection:
                data['databases'] = selection
        elif action == 'upload':
            path = filedialog.askopenfilename(filetypes=[('Encrypted environment backup', '*.tar.gpg')])
            if not path:
                return
            backup_id = 'b-' + dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid.uuid4().hex[:12]
            self.start(lambda *_: (self.transfer(key, path, backup_id, upload=True), self.list_backups('', key, '', '')))
            return
        elif action == 'schedule':
            enabled = messagebox.askyesnocancel('الجدولة', 'تفعيل نسخة كاملة يوميًا؟ نعم للتفعيل، لا لتعطيل الجدولة.')
            if enabled is None:
                return
            hour = simpledialog.askinteger('الجدولة UTC', 'ساعة النسخ بتوقيت UTC (0–23):', initialvalue=2, minvalue=0, maxvalue=23) if enabled else 2
            if hour is None:
                return
            daily = simpledialog.askinteger('الاحتفاظ', 'عدد النسخ اليومية المحفوظة:', initialvalue=7, minvalue=1, maxvalue=90) if enabled else 7
            weekly = simpledialog.askinteger('الاحتفاظ', 'عدد الأسابيع المحفوظة (نسخة لكل أسبوع):', initialvalue=4, minvalue=1, maxvalue=52) if enabled else 4
            if daily is None or weekly is None:
                return
            data = {'enabled': enabled, 'hour': hour, 'daily': daily, 'weekly': weekly}
            if enabled and not messagebox.askyesno('تأكيد سياسة النسخ', 'تتوقف الخدمات مؤقتًا أثناء النسخ. تُحذف النسخ المجدولة الأقدم تلقائيًا بعد نجاح نسخة جديدة وفق السياسة المختارة. النسخ اليدوية والمرفوعة محفوظة. متابعة؟'):
                return
        else:
            backup_id = self.selected_backup()
            if not backup_id:
                return
            data = {'id': backup_id}
            if action == 'download':
                path = filedialog.asksaveasfilename(initialfile=backup_id + '.tar.gpg', defaultextension='.tar.gpg')
                if path:
                    self.start(lambda *_: self.transfer(key, path, backup_id))
                return
            if action == 'delete' and not messagebox.askyesno('حذف النسخة', 'حذف نهائي للنسخة: ' + backup_id + '؟'):
                return
            if action == 'review':
                phrase = simpledialog.askstring('فحص النسخة', 'عبارة تشفير النسخة؛ اتركها فارغة لاستخدام مفتاح الخادم:', show='*')
                if phrase is None:
                    return
                if phrase:
                    data['passphrase'] = phrase
            if action == 'restore':
                if not self.reviewed or self.reviewed['id'] != backup_id:
                    messagebox.showinfo('الاستعادة', 'افحص وراجع النسخة المحددة أولًا')
                    return
                if not self.reviewed.get('sameHost'):
                    messagebox.showerror('الاستعادة', 'الاستعادة الآلية مخصصة للخادم نفسه. نقل البيئة لخادم آخر يحتاج ضبطًا منفصلًا.')
                    return
                if not messagebox.askyesno('تأكيد الاستعادة', 'ستُستبدل قواعد البيانات وملفات المشروع المحددة في المراجعة. تؤخذ نسخة كاملة قبل التنفيذ. استعد فقط نسخة من مصدر موثوق. إعدادات الخدمات وحسابات MySQL تُجهّز للمراجعة دون تفعيل تلقائي. متابعة؟'):
                    return
                phrase = simpledialog.askstring('تشفير الاستعادة', 'عبارة تشفير النسخة؛ فارغ = مفتاح الخادم:', show='*')
                if phrase is None:
                    return
                data.update(sha256=self.reviewed['sha256'], trusted=True, passphrase=phrase)
        self.backup_request(action, **data)

    def close(self):
        if self.busy:
            messagebox.showinfo('عملية جارية', 'انتظر انتهاء العملية قبل إغلاق الأداة. إغلاق النافذة لا يلغي النشر على الخادم.')
            return
        self.save_preferences()
        self.root.destroy()


if __name__ == '__main__':
    root = tk.Tk()
    Console(root)
    root.mainloop()
