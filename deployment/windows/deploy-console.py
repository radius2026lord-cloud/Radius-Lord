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
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

BRANCH = 'work/subscriptions-customer-details'
HOST = '78.155.66.122'
PORT = '3001'
USER = 'root'
REMOTE = f'ssh://{USER}@{HOST}:{PORT}/srv/radius-lord/repository.git'
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
        root.title('Radius Lord — النشر المحلي')
        root.geometry('1040x760')
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
        self.version = tk.StringVar(value='v1.0.4')
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
        setup = ttk.LabelFrame(outer, text='تجهيز SSH مرة واحدة', padding=8)
        setup.pack(fill='x', pady=7)
        self.button(setup, 'إنشاء مفتاح محمي', self.create_key)
        self.button(setup, 'تثبيت المفتاح على الخادم', self.install_key)
        self.button(setup, 'تحميل المفتاح في SSH Agent', self.add_agent)
        self.button(setup, 'فحص الاتصال', self.inspect_host)
        actions = ttk.Frame(outer)
        actions.pack(fill='x', pady=9)
        self.button(actions, 'جلب تحديثات GitHub', self.pull)
        self.button(actions, 'بناء وفحص المشروع', self.build)
        self.button(actions, 'رفع الإصدار', self.publish)
        self.button(actions, 'تحديث حالة الإصدار', self.status)
        ttk.Label(outer, textvariable=self.state, wraplength=950).pack(anchor='e', pady=7)
        self.progress = ttk.Progressbar(outer, mode='indeterminate')
        self.progress.pack(fill='x')
        logs = ttk.Frame(outer)
        logs.pack(fill='both', expand=True, pady=10)
        self.log = tk.Text(logs, bg='#101b2c', fg='#d9e8ff', font=('Consolas', 10), wrap='word', state='disabled')
        scroll = ttk.Scrollbar(logs, command=self.log.yview)
        self.log.configure(yscrollcommand=scroll.set)
        scroll.pack(side='right', fill='y')
        self.log.pack(fill='both', expand=True)
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
        values = (self.project.get(), self.key.get(), self.version.get().strip(), self.changes.get().strip())
        if action == self.publish and not messagebox.askyesno('رفع إصدار', f'نشر {values[2]} على {HOST}؟\nسيأخذ الخادم نسخة احتياطية ويبني الإصدار ثم يعيد تشغيل التطبيق.'):
            return
        self.busy = True
        for button in self.tasks:
            button.configure(state='disabled')
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
                self.log.see('end')
                self.log.configure(state='disabled')
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
            process = subprocess.Popen(args, cwd=cwd, creationflags=NEW_CONSOLE)
            self.process = process
            try:
                result = process.wait(timeout=timeout)
            finally:
                self.process = None
            if result:
                raise RuntimeError('فشلت عملية SSH؛ راجع النافذة التي فُتحت')
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
        return ['ssh', '-p', PORT, '-i', key, '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=10', f'{USER}@{HOST}']

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
        self.run([*self.ssh(key), 'sudo -n -u radiusdeploy python3 ' + HELPER + ' inspect'], stream=True)

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

    def close(self):
        if self.busy:
            messagebox.showinfo('عملية جارية', 'انتظر انتهاء العملية قبل إغلاق الأداة. إغلاق النافذة لا يلغي النشر على الخادم.')
            return
        self.root.destroy()


if __name__ == '__main__':
    root = tk.Tk()
    Console(root)
    root.mainloop()
