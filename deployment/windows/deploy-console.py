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
from tkinter import filedialog, messagebox, simpledialog, ttk, font as tkfont

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


class CommandFailure(RuntimeError):
    def __init__(self, program, code, output):
        super().__init__('فشل الأمر: ' + program + ' (exit ' + str(code) + ')')
        self.program = program
        self.code = code
        self.output = output


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
        self.action_containers = {}
        self.service_states = {}
        self.service_buttons = {}
        self.service_time = 'لم يُفحص'
        self.expanded_log = False
        self.tooltip = None
        self.connected = tk.StringVar(value='⚪ لم يُفحص الاتصال')
        self.summary = tk.StringVar(value='الخادم: لم يُفحص')
        try:
            preferences = json.loads(PREFERENCES.read_text(encoding='utf-8'))
        except (OSError, ValueError):
            preferences = {}
        root.title('Radius Lord — إدارة الخادم والنشر')
        root.geometry('%dx%d' % (min(1260, root.winfo_screenwidth() - 60), max(700, min(940, root.winfo_screenheight() - 90))))
        root.minsize(900, 700)
        self.dark = bool(preferences.get('dark', True))
        self.project = tk.StringVar(value=preferences.get('project', str(pathlib.Path(__file__).resolve().parents[2])))
        self.key = tk.StringVar(value=preferences.get('key', str(pathlib.Path.home() / '.ssh/id_ed25519_radius_lord')))
        self.version = tk.StringVar(value=preferences.get('version', 'v1.0.4'))
        self.changes = tk.StringVar(value='')
        self.state = tk.StringVar(value='جاهز — افحص الاتصال ثم اختر العملية')
        self.phase = tk.StringVar(value='جاهز')
        available_fonts = set(tkfont.families(root))
        self.ui_font = next((name for name in ['LBC', 'LBC Regular', 'Segoe UI'] if name in available_fonts), 'Arial')
        self.style = ttk.Style()
        self.style.theme_use('clam')
        outer = ttk.Frame(root, padding=14)
        outer.pack(fill='both', expand=True)
        header = ttk.Frame(outer)
        header.pack(fill='x', pady=(0, 8))
        ttk.Label(header, text='Radius Lord', style='Title.TLabel').pack(side='right')
        ttk.Label(header, text=f'{USER}@{HOST}:{PORT}', style='Muted.TLabel').pack(side='right', padx=18)
        ttk.Button(header, text='◐ المظهر', command=self.toggle_theme).pack(side='left', padx=4)
        terminal_button = ttk.Button(header, text='▣ طرفية SSH', command=lambda: self.start(self.terminal))
        terminal_button.pack(side='left', padx=4)
        self.tasks.append(terminal_button)
        check_button = ttk.Button(header, text='↻ فحص الخدمات', command=lambda: self.start(self.inspect_host))
        check_button.pack(side='left', padx=4)
        self.tasks.append(check_button)
        connection = ttk.Frame(outer)
        connection.pack(fill='x', pady=(0, 7))
        ttk.Label(connection, textvariable=self.connected).pack(side='right')
        ttk.Label(connection, textvariable=self.summary, style='Muted.TLabel').pack(side='left')
        cards = ttk.Frame(outer)
        cards.pack(fill='x', pady=(0, 10))
        for index, (unit, label, icon) in enumerate([
            ('radius-lord-backend', 'الباك إند', '⚙'), ('radius-lord-frontend', 'الفرونت إند', '▣'),
            ('mysql', 'MySQL', '▤'), ('freeradius', 'FreeRADIUS', '◉')]):
            cards.columnconfigure(index, weight=1, uniform='services')
            button = tk.Button(cards, text=icon + '  ' + label + '\n● لم يُفحص', relief='flat', bd=0,
                               font=(self.ui_font, 10, 'bold'), padx=10, pady=8,
                               command=lambda name=unit: self.service_details(name))
            button.grid(row=0, column=index, sticky='nsew', padx=5)
            self.service_buttons[unit] = (button, label, icon)
        # Controls use natural height; no scrolling canvas hides actions.
        self.panes = tk.PanedWindow(outer, orient='vertical', sashwidth=6, bd=0, opaqueresize=True)
        self.panes.pack(fill='both', expand=True)
        self.workspace = ttk.Frame(self.panes)
        self.panes.add(self.workspace, minsize=180, stretch='never')
        content = ttk.Frame(self.workspace, padding=(0, 0, 0, 5))
        content.pack(fill='both', expand=True)
        settings_button = ttk.Button(header, text='⚙ إعدادات الاتصال', command=self.toggle_settings)
        settings_button.pack(side='left', padx=4)
        self.settings_window = tk.Toplevel(root)
        self.settings_window.title('Radius Lord — إعدادات الاتصال')
        self.settings_window.geometry('850x240')
        self.settings_window.transient(root)
        self.settings_window.protocol('WM_DELETE_WINDOW', self.settings_window.withdraw)
        self.settings_window.withdraw()
        self.settings_frame = ttk.Frame(self.settings_window, padding=18)
        self.settings_frame.pack(fill='both', expand=True)
        for row, (label, variable, chooser) in enumerate([
            ('مجلد المشروع', self.project, self.choose_project), ('مسار مفتاح SSH الخاص', self.key, self.choose_key)]):
            ttk.Label(self.settings_frame, text=label).grid(row=row, column=2, sticky='e', padx=8, pady=4)
            ttk.Entry(self.settings_frame, textvariable=variable, justify='left').grid(row=row, column=1, sticky='ew', pady=4)
            ttk.Button(self.settings_frame, text='اختيار', command=chooser).grid(row=row, column=0, padx=5)
        self.settings_frame.columnconfigure(1, weight=1)
        setup = ttk.Frame(self.settings_frame)
        setup.grid(row=2, column=0, columnspan=3, sticky='ew')
        self.button(setup, '🔑 إنشاء مفتاح محمي', self.create_key)
        self.button(setup, '⬆ تثبيت المفتاح', self.install_key)
        self.button(setup, '🔓 تحميل المفتاح في Agent', self.add_agent)
        self.notebook = ttk.Notebook(content)
        self.notebook.pack(fill='both', expand=True, pady=5)
        deploy_tab = ttk.Frame(self.notebook, padding=10)
        backup_tab = ttk.Frame(self.notebook, padding=10)
        maintenance_tab = ttk.Frame(self.notebook, padding=10)
        self.notebook.add(deploy_tab, text='  النشر  ')
        self.notebook.add(backup_tab, text='  النسخ والاستعادة  ')
        self.notebook.add(maintenance_tab, text='  الصيانة  ')
        self.maintenance_ui(maintenance_tab)
        form = ttk.Frame(deploy_tab)
        form.pack(fill='x', pady=5)
        for row, (label, variable) in enumerate([('رقم الإصدار', self.version), ('وصف التغييرات', self.changes)]):
            ttk.Label(form, text=label).grid(row=row, column=1, sticky='e', padx=8, pady=4)
            ttk.Entry(form, textvariable=variable, justify='right').grid(row=row, column=0, sticky='ew', pady=4)
        form.columnconfigure(0, weight=1)
        actions = ttk.Frame(deploy_tab)
        actions.pack(fill='x', pady=8)
        self.button(actions, '↓ جلب تحديثات GitHub', self.pull)
        self.button(actions, '⚙ بناء وفحص المشروع', self.build)
        self.button(actions, '↑ رفع الإصدار', self.publish)
        self.button(actions, '↻ حالة الإصدار', self.status)
        self.button(actions, '☰ سجل النشر الأخير', self.latest_log)
        ttk.Label(deploy_tab, text='الفرع: ' + BRANCH, style='Muted.TLabel').pack(anchor='e', pady=4)
        self.backup_ui(backup_tab)
        self.log_panel = ttk.Frame(self.panes, padding=(0, 6, 0, 0))
        self.panes.add(self.log_panel, minsize=160, stretch='always')
        toolbar = ttk.Frame(self.log_panel)
        toolbar.pack(fill='x', pady=(0, 6))
        ttk.Label(toolbar, text='سجل العمليات', style='Heading.TLabel').pack(side='right', padx=6)
        self.expand_button = ttk.Button(toolbar, text='⛶ توسيع', command=self.toggle_log)
        self.expand_button.pack(side='left', padx=3)
        for title, command in [('نسخ المحدد', self.copy_selected), ('نسخ الكل', self.copy_all), ('حفظ', self.save_log), ('مسح', self.clear_log)]:
            ttk.Button(toolbar, text=title, command=command).pack(side='right', padx=3)
        self.follow = tk.BooleanVar(value=True)
        ttk.Checkbutton(toolbar, text='متابعة', variable=self.follow).pack(side='right', padx=6)
        phase_bar = ttk.Frame(self.log_panel)
        phase_bar.pack(fill='x', pady=(0, 5))
        self.phase_labels = {}
        for title in ['فحص', 'بناء', 'رفع', 'تحقق']:
            label = tk.Label(phase_bar, text=title, padx=16, pady=4, font=(self.ui_font, 10))
            label.pack(side='right', padx=3)
            self.phase_labels[title] = label
        ttk.Label(phase_bar, textvariable=self.phase, style='Muted.TLabel').pack(side='left', padx=5)
        logs = ttk.Frame(self.log_panel)
        logs.pack(fill='both', expand=True)
        self.log = tk.Text(logs, font=('Consolas', 11), wrap='word', state='disabled', exportselection=False,
                           relief='flat', bd=0, padx=12, pady=10, height=20)
        scroll = ttk.Scrollbar(logs, command=self.log.yview)
        self.log.configure(yscrollcommand=scroll.set)
        scroll.pack(side='right', fill='y')
        self.log.pack(fill='both', expand=True)
        footer = ttk.Frame(outer)
        footer.pack(fill='x', pady=(8, 0))
        ttk.Label(footer, textvariable=self.state, wraplength=1050).pack(anchor='e')
        self.progress = ttk.Progressbar(footer, mode='indeterminate')
        self.progress.pack(fill='x', pady=(5, 0))
        self.apply_theme()
        self.notebook.bind('<<NotebookTabChanged>>', lambda event: self.root.after_idle(self.fit_workspace))
        root.after(200, self.fit_workspace)
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
        if parent not in self.action_containers:
            frame = ttk.Frame(parent)
            frame.pack(fill='x', pady=3)
            self.action_containers[parent] = (frame, [])
        frame, buttons = self.action_containers[parent]
        button = ttk.Button(frame, text=label, command=lambda: self.start(action))
        index = len(buttons)
        button.grid(row=index // 3, column=2 - index % 3, sticky='ew', padx=4, pady=4)
        for column in range(3):
            frame.columnconfigure(column, weight=1, uniform='actions')
        buttons.append(button)
        self.tasks.append(button)
        button.bind('<Enter>', lambda event: self.show_tooltip(button, 'انتظر اكتمال العملية الجارية' if self.busy else label))
        button.bind('<Leave>', lambda event: self.hide_tooltip())

    def show_tooltip(self, widget, text):
        self.hide_tooltip()
        self.tooltip = tk.Toplevel(self.root)
        self.tooltip.wm_overrideredirect(True)
        self.tooltip.geometry('+%d+%d' % (widget.winfo_rootx(), widget.winfo_rooty() + widget.winfo_height() + 4))
        tk.Label(self.tooltip, text=text, bg='#24344c', fg='#ffffff', padx=9, pady=5, font=(self.ui_font, 10)).pack()

    def hide_tooltip(self):
        if self.tooltip:
            self.tooltip.destroy()
            self.tooltip = None

    def toggle_settings(self):
        self.settings_window.deiconify()
        self.settings_window.lift()
        self.settings_window.focus_set()

    def fit_workspace(self):
        if self.expanded_log:
            return
        selected = self.root.nametowidget(self.notebook.select())
        self.notebook.configure(height=selected.winfo_reqheight())
        self.root.update_idletasks()
        height = selected.winfo_reqheight() + 52
        self.panes.paneconfigure(self.workspace, minsize=height)
        self.panes.sash_place(0, 0, height)

    def toggle_log(self):
        if not self.expanded_log:
            self.previous_sash = self.panes.sash_coord(0)[1]
            self.panes.forget(self.workspace)
            self.expand_button.configure(text='↙ استعادة الحجم')
        else:
            self.panes.add(self.workspace, before=self.log_panel, minsize=160, stretch='never')
            self.root.after_idle(self.fit_workspace)
            self.expand_button.configure(text='⛶ توسيع')
        self.expanded_log = not self.expanded_log

    def toggle_theme(self):
        self.dark = not self.dark
        self.apply_theme()
        self.save_preferences()

    def apply_theme(self):
        self.colors = ({'bg': '#111b2b', 'panel': '#1b2940', 'text': '#edf3ff', 'muted': '#a8bad5',
                        'entry': '#111e32', 'border': '#30425f', 'accent': '#2563eb', 'log': '#0b1422'} if self.dark else
                       {'bg': '#edf2f8', 'panel': '#ffffff', 'text': '#18345c', 'muted': '#5e7392',
                        'entry': '#f6f9fd', 'border': '#c9d6e8', 'accent': '#1764e9', 'log': '#f9fbff'})
        c = self.colors
        self.root.configure(bg=c['bg'])
        self.style.configure('.', background=c['bg'], foreground=c['text'], font=(self.ui_font, 10))
        self.style.configure('TFrame', background=c['bg'])
        self.style.configure('TLabel', background=c['bg'], foreground=c['text'])
        self.style.configure('Title.TLabel', font=(self.ui_font, 20, 'bold'))
        self.style.configure('Heading.TLabel', font=(self.ui_font, 12, 'bold'))
        self.style.configure('Muted.TLabel', foreground=c['muted'])
        self.style.configure('TButton', background=c['panel'], foreground=c['text'], bordercolor=c['border'], borderwidth=0, relief='flat', padding=(12, 7))
        self.style.map('TButton', background=[('active', c['accent']), ('disabled', c['entry'])], foreground=[('active', '#ffffff'), ('disabled', c['muted'])])
        for name in ['TEntry', 'TCombobox']:
            self.style.configure(name, fieldbackground=c['entry'], foreground=c['text'], bordercolor=c['border'], padding=5)
            self.style.map(name, fieldbackground=[('readonly', c['entry'])], foreground=[('readonly', c['text'])])
        self.style.configure('TNotebook', background=c['bg'], borderwidth=0)
        self.style.configure('TNotebook.Tab', background=c['panel'], foreground=c['muted'], borderwidth=0, padding=(22, 8))
        self.style.map('TNotebook.Tab', background=[('selected', c['accent'])], foreground=[('selected', '#ffffff')])
        self.style.configure('Treeview', background=c['panel'], fieldbackground=c['panel'], foreground=c['text'], rowheight=25, borderwidth=0)
        self.style.configure('Treeview.Heading', background=c['entry'], foreground=c['text'], padding=6)
        self.style.map('Treeview', background=[('selected', c['accent'])], foreground=[('selected', '#ffffff')])
        self.style.configure('TCheckbutton', background=c['bg'], foreground=c['text'])
        self.style.map('TCheckbutton', background=[('active', c['panel'])])
        self.style.configure('Horizontal.TProgressbar', background=c['accent'], troughcolor=c['entry'])
        self.panes.configure(bg=c['border'])
        self.settings_window.configure(bg=c['bg'])
        self.database_window.configure(bg=c['bg'])
        self.db_list.configure(bg=c['entry'], fg=c['text'], selectbackground=c['accent'], selectforeground='#ffffff', relief='flat', highlightthickness=0)
        self.log.configure(bg=c['log'], fg=c['text'], selectbackground=c['accent'], selectforeground='#ffffff', insertbackground=c['text'])
        for tag, color in {'normal': c['text'], 'time': c['muted'], 'error': '#ff858f' if self.dark else '#b42338',
                           'warning': '#f5c36e' if self.dark else '#895700', 'success': '#69d9b0' if self.dark else '#08784f'}.items():
            self.log.tag_configure(tag, foreground=color)
        self.render_services()
        self.render_phase(self.phase.get())

    def render_services(self):
        c = self.colors
        for unit, (button, title, icon) in self.service_buttons.items():
            state = self.service_states.get(unit, 'unknown')
            label, color = {'active': ('يعمل', '#61d9ac' if self.dark else '#08784f'),
                            'inactive': ('متوقف', '#ff858f' if self.dark else '#b42338'),
                            'failed': ('فشل', '#ff858f' if self.dark else '#b42338'),
                            'checking': ('جارٍ الفحص', '#f5c36e' if self.dark else '#895700'),
                            'unknown': ('لم يُفحص', c['muted'])}.get(state, (state, c['muted']))
            button.configure(text=icon + '  ' + title + '\n● ' + label, bg=c['panel'], fg=color,
                             activebackground=c['entry'], activeforeground=color, cursor='hand2')

    def service_details(self, unit):
        if unit not in self.service_buttons:
            return
        _, title, _ = self.service_buttons[unit]
        dialog = tk.Toplevel(self.root)
        dialog.title(title)
        dialog.configure(bg=self.colors['bg'])
        dialog.transient(self.root)
        body = ttk.Frame(dialog, padding=20)
        body.pack(fill='both', expand=True)
        ttk.Label(body, text=title, style='Heading.TLabel').pack(anchor='e', pady=5)
        status = self.service_states.get(unit, 'لم يُفحص')
        ttk.Label(body, text='الخدمة: ' + unit + '\nالحالة: ' + status + '\nآخر فحص: ' + self.service_time, justify='right').pack(anchor='e', pady=8)
        ttk.Label(body, text='هذه حالة تشغيل الخدمة. فحص RADIUS الفعلي متاح من المنصة.', wraplength=400).pack(anchor='e', pady=5)
        def restart():
            if self.busy:
                messagebox.showinfo('عملية جارية', 'انتظر اكتمال العملية الجارية', parent=dialog)
                return
            if messagebox.askyesno('إعادة تشغيل الخدمة', 'إعادة تشغيل ' + title + '؟ ستنقطع اتصالات الخدمة مؤقتًا.', parent=dialog):
                dialog.destroy()
                self.start(lambda project, key, version, changes: self.restart_service(unit, key))
        ttk.Button(body, text='↻ إعادة تشغيل هذه الخدمة', command=restart).pack(fill='x', pady=8)
        ttk.Button(body, text='إغلاق', command=dialog.destroy).pack(anchor='w')

    def restart_service(self, unit, key):
        if unit not in ('radius-lord-backend', 'radius-lord-frontend', 'mysql', 'freeradius'):
            raise ValueError('Unknown service')
        self.events.put(('log', 'إعادة تشغيل الخدمة: ' + unit + '\n'))
        self.run([*self.ssh(key), 'systemctl restart ' + unit + '.service'], stream=True, timeout=180)
        self.inspect_host('', key, '', '')

    def render_phase(self, phase):
        self.phase.set(phase)
        for title, label in self.phase_labels.items():
            label.configure(bg=self.colors['accent'] if title == phase else self.colors['panel'],
                            fg='#ffffff' if title == phase else self.colors['muted'])

    def append_log(self, value):
        self.log.configure(state='normal')
        self.log.insert('end', '[' + dt.datetime.now().strftime('%H:%M:%S') + '] ', 'time')
        for line in value.splitlines(keepends=True):
            lower = line.lower()
            tag = ('error' if any(word in lower for word in ['error', 'failed', 'فشل', 'recovery_required']) else
                   'warning' if any(word in lower for word in ['warn', 'تحذير', 'تعذر', '⚠']) else
                   'success' if any(word in lower for word in ['success', 'succeeded', 'نجح', 'اكتملت']) else 'normal')
            self.log.insert('end', line, tag)
        if value and not value.endswith('\n'):
            self.log.insert('end', '\n')
        if self.follow.get() and not self.log.tag_ranges('sel'):
            self.log.see('end')
        self.log.configure(state='disabled')

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
        names = {self.inspect_host: 'فحص', self.build: 'بناء', self.publish: 'فحص', self.pull: 'جلب التحديثات', self.status: 'تحقق'}
        self.render_phase(names.get(action, 'جارٍ التنفيذ'))
        self.hide_tooltip()
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
                self.append_log(value)
            elif kind == 'services':
                self.service_states, self.service_time = value
                self.render_services()
            elif kind == 'phase':
                self.render_phase(value)
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
                self.render_phase('جاهز' if not self.state.get().startswith('توقفت') else 'توقفت العملية')
                for button in self.tasks:
                    button.configure(state='normal')
        self.root.after(100, self.drain)

    def run(self, args, cwd=None, timeout=60, stream=False, env=None, console=False, wait_on_timeout=True):
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
        worker_context = getattr(self, 'worker_context', None)
        operation_id = getattr(worker_context, 'identifier', None)
        def read_output():
            if worker_context is not None:
                worker_context.identifier = operation_id
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
            if not wait_on_timeout:
                process.terminate()
                try:
                    process.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
                reader.join(timeout=3)
                raise TimeoutError('انتهت مهلة انتظار نتيجة الفحص؛ يمكنك إعادة الفحص. لم تُكرّر أي عملية كتابة')
            # Avoid orphan Git/build processes; never repeat an uncertain push.
            self.events.put(('state', 'العملية تجاوزت الوقت المتوقع؛ ننتظر انتهاءها دون تكرارها'))
            code = process.wait()
        finally:
            self.process = None
        reader.join(timeout=3)
        if reader.is_alive():
            self.events.put(('log', 'انتهى الأمر؛ بعض قنوات الإخراج لم تُغلق بعد.\n'))
        text = ''.join(chunks)
        if code and not stream:
            self.events.put(('log', text + '\n'))
        if code:
            raise CommandFailure(args[0], code, text)
        return text.strip()

    def repository(self, project, require_clean=True):
        project = str(pathlib.Path(project).resolve())
        if self.run(['git', 'rev-parse', '--show-toplevel'], project).replace('\\', '/').casefold() != project.replace('\\', '/').casefold():
            raise RuntimeError('اختر جذر مستودع المشروع')
        if self.run(['git', 'branch', '--show-current'], project) != BRANCH:
            raise RuntimeError('الفرع المحلي ليس الفرع المعتمد')
        if self.run(['git', 'remote', 'get-url', 'origin'], project) not in ORIGINS:
            raise RuntimeError('origin ليس مستودع Radius Lord المعتمد')
        if require_clean and self.run(['git', 'status', '--porcelain', '--untracked-files=normal'], project):
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
        self.events.put(('services', ({name: 'checking' for name in ['radius-lord-backend', 'radius-lord-frontend', 'mysql', 'freeradius']}, 'جارٍ الفحص')))
        try:
            text = self.run([*self.ssh(key), 'sudo -n -u radiusdeploy python3 ' + HELPER + ' inspect'])
            data = json.loads(text)
            self.events.put(('log', text + '\n'))
            command = "for unit in radius-lord-backend radius-lord-frontend mysql freeradius; do printf '%s: ' \"$unit\"; systemctl is-active \"$unit\" || true; done"
            services = self.run([*self.ssh(key), command])
            states = dict(line.split(': ', 1) for line in services.splitlines() if ': ' in line)
            self.events.put(('services', (states, dt.datetime.now().strftime('%Y-%m-%d %H:%M:%S'))))
            self.events.put(('summary', 'الإصدار الجاري: ' + str(data.get('currentVersion'))))
            self.events.put(('connected', '🟢 اتصال SSH ناجح — آخر فحص ' + dt.datetime.now().strftime('%H:%M:%S')))
        except Exception as error:
            self.events.put(('services', ({}, 'تعذر الفحص')))
            self.events.put(('connected', '🔴 تعذر الاتصال: ' + str(error)))
            raise


    @staticmethod
    def github_cli():
        executable = shutil.which('gh')
        if executable or os.name != 'nt':
            return executable
        locations = (
            ('ProgramW6432', 'GitHub CLI', 'gh.exe'),
            ('ProgramFiles', 'GitHub CLI', 'gh.exe'),
            ('ProgramFiles(x86)', 'GitHub CLI', 'gh.exe'),
            ('LOCALAPPDATA', 'Programs', 'GitHub CLI', 'gh.exe'),
            ('LOCALAPPDATA', 'Microsoft', 'WinGet', 'Links', 'gh.exe'),
        )
        for variable, *parts in locations:
            base = os.environ.get(variable)
            if base:
                path = pathlib.Path(base).joinpath(*parts)
                if path.is_file():
                    return str(path)
        return None

    def github_environment(self):
        return {**os.environ, 'GIT_TERMINAL_PROMPT': '0', 'GCM_INTERACTIVE': 'Never'}

    def check_github(self, project, key, version, changes):
        project = self.repository(project, require_clean=False)
        self.events.put(('log', 'GitHub · فحص قراءة الفرع المعتمد.\n'))
        self.events.put(('log', 'GitHub · commit الفرع: ' + self.github_head(project) + '\n'))
        cli = self.github_cli()
        if not cli:
            self.events.put(('log', 'القراءة متاحة. ثبّت GitHub CLI لتسجيل الدخول وفحص صلاحية الكتابة.\n'))
            return
        auth = subprocess.run([cli, 'auth', 'status', '--hostname', 'github.com'],
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                              timeout=20, creationflags=NO_WINDOW)
        if auth.returncode:
            self.events.put(('log', 'القراءة متاحة. صلاحية الكتابة غير مؤكدة؛ استخدم تسجيل دخول GitHub.\n'))
            return
        account = self.run([cli, 'api', '--hostname', 'github.com', 'user', '--jq', '.login'], timeout=30)
        permission = self.run([cli, 'api', '--hostname', 'github.com', 'repos/radius2026lord-cloud/Radius-Lord',
                               '--jq', '.permissions.push // false'], timeout=30)
        self.events.put(('log', 'GitHub · الحساب: ' + account + ' · صلاحية كتابة المستودع: '
                         + ('متاحة' if permission == 'true' else 'غير متاحة') + '\n'))
        if self.run(['git', 'remote', 'get-url', '--push', 'origin'], project).startswith('git@'):
            self.events.put(('log', 'وجهة الرفع الحالية تستخدم SSH؛ تعتمد على مفتاح GitHub المهيأ في Windows.\n'))

    def login_github(self, project, key, version, changes):
        project = self.repository(project, require_clean=False)
        cli = self.github_cli()
        if not cli:
            raise RuntimeError('لم يُعثر على gh.exe في PATH أو مسارات التثبيت المعتادة. تحقق من مساره في PowerShell')
        self.events.put(('log', 'GitHub CLI · ' + cli + '\n'))
        self.events.put(('log', 'GitHub · أكمل الدخول في المتصفح ثم اضغط Enter في نافذة GitHub CLI بعد اكتمال الدخول.\n'))
        self.run([cli, 'auth', 'login', '--hostname', 'github.com', '--git-protocol', 'https', '--web', '--clipboard'],
                 console=True)
        self.events.put(('log', 'GitHub · ربط مصادقة Git عبر HTTPS بالحساب.\n'))
        self.run([cli, 'auth', 'setup-git', '--hostname', 'github.com'], timeout=30)
        self.check_github(project, key, version, changes)

    def github_head(self, project):
        ref = 'refs/heads/' + BRANCH
        fields = self.run(['git', 'ls-remote', '--exit-code', 'origin', ref], project, timeout=60, env=self.github_environment()).split()
        if len(fields) != 2 or fields[1] != ref or not re.fullmatch(r'[a-f0-9]{40}', fields[0]):
            raise RuntimeError('تعذر تحديد commit الفرع على GitHub')
        return fields[0]

    def synchronized_commit(self, project, report=False):
        local = self.run(['git', 'rev-parse', 'HEAD'], project)
        remote = self.github_head(project)
        if report or local != remote:
            self.events.put(('log', f'Windows المحلي · {local}\n'))
            self.events.put(('log', f'GitHub · {remote}\n'))
        if local != remote:
            raise RuntimeError('توقف التحقق: نسخة Windows تختلف عن الفرع المعتمد على GitHub')
        return local

    def push_github(self, project, key, version, changes):
        project = self.repository(project, require_clean=False)
        if self.run(['git', 'remote', 'get-url', '--push', 'origin'], project) not in ORIGINS:
            raise RuntimeError('وجهة رفع origin تختلف عن المستودع المعتمد')
        if (self.run(['git', 'diff', '--name-only'], project)
                or self.run(['git', 'ls-files', '--others', '--exclude-standard'], project)):
            raise RuntimeError('راجع الملفات ثم أضف التعديلات المقصودة إلى Git قبل الرفع')
        if self.run(['git', 'diff', '--cached', '--name-only'], project):
            if not changes.strip():
                raise RuntimeError('أدخل وصف التغييرات قبل إنشاء commit')
            self.run(['git', 'diff', '--cached', '--check'], project)
            self.run(['git', 'commit', '-m', changes], project, stream=True)
        self.repository(project)
        self.validated = None
        self.run(['git', 'push', 'origin', 'HEAD:refs/heads/' + BRANCH], project, stream=True, timeout=300, env=self.github_environment())
        commit = self.synchronized_commit(project)
        self.events.put(('log', 'تطابق Windows وGitHub عند ' + commit + '\n'))

    def pull(self, project, key, version, changes):
        self.events.put(('log', 'جلب GitHub · التحقق من الفرع ونظافة مجلد العمل.\n'))
        project = self.repository(project)
        self.validated = None
        self.events.put(('log', 'جلب GitHub · تنزيل التغييرات وتحديث الفرع.\n'))
        self.run(['git', 'pull', '--ff-only', 'origin', BRANCH], project, stream=True, timeout=300, env=self.github_environment())
        self.events.put(('log', 'جلب GitHub · مقارنة معرّف commit المحلي بالفرع البعيد.\n'))
        self.events.put(('log', 'تطابق Windows وGitHub عند ' + self.synchronized_commit(project) + '\n'))

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

    def deploy_command(self, project, version, changes):
        project = self.repository(project)
        commit = self.synchronized_commit(project, report=True)
        if not re.fullmatch(r'v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)', version) or not 0 < len(changes.strip()) <= 4000:
            raise RuntimeError('أدخل رقم الإصدار ووصف التغييرات')
        manifest = json.dumps({'version': version, 'commit': commit, 'changes': changes})
        script = """set -eu
cd /tmp
test "$(id -un)" = radiusdeploy
root=/srv/radius-lord
repo=$root/repository.git
ref=refs/tags/radius-release/$1
commit=$2
if git --git-dir="$repo" show-ref --verify --quiet "$ref"; then
    actual=$(git --git-dir="$repo" rev-parse "$ref^{commit}")
    test "$actual" = "$commit" || { echo "Expected $commit; existing tag points to $actual" >&2; exit 1; }
    printf 'Ubuntu (existing release tag): %s\\n' "$actual"
    echo 'Release already received'
    exit 0
fi
test ! -e "$root/maintenance-recovery.json"
stage=$(mktemp -d /tmp/radius-release.XXXXXX)
trap 'rm -rf -- "$stage"' EXIT
git clone --bare --shared "$repo" "$stage"
GIT_TERMINAL_PROMPT=0 git -C "$stage" fetch --no-tags https://github.com/radius2026lord-cloud/Radius-Lord.git "$4"
actual=$(git -C "$stage" rev-parse FETCH_HEAD)
printf 'Ubuntu (fetched commit): %s\\n' "$actual"
test "$actual" = "$commit" || { echo "Deployment blocked: expected $commit, fetched $actual" >&2; exit 1; }
if test -f "$root/current/release.json"; then
    running=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["commit"])' "$root/current/release.json")
    if git -C "$stage" diff --quiet --no-renames "$running" "$commit" -- . ':(exclude)deployment/windows/**'; then
        echo 'Deployment blocked: application files already match Ubuntu.' >&2
        exit 1
    else
        test "$?" -eq 1
    fi
fi
printf 'Commit match confirmed: Windows, GitHub, Ubuntu\\n'
git -C "$stage" -c user.name='Lord Radius Deploy' -c user.email=radiusdeploy@localhost tag -a "${ref#refs/tags/}" "$commit" -m "$3"
git -C "$stage" push "$repo" "$ref"
"""
        payload = base64.b64encode(script.encode('utf-8')).decode('ascii')
        return commit, 'bash -c "$(printf %s ' + payload + ' | base64 -d)" -- ' + ' '.join(
            shlex.quote(value) for value in (version, commit, manifest, 'refs/heads/' + BRANCH))

    def publish(self, project, key, version, changes):
        commit, command = self.deploy_command(project, version, changes)
        self.events.put(('phase', 'رفع'))
        self.run([*self.ssh(key), 'sudo -n -H -u radiusdeploy ' + command], stream=True, timeout=1800)
        self.events.put(('log', 'وصل الوسم إلى الخادم. جارٍ انتظار التفعيل.\n'))
        self.events.put(('phase', 'تحقق'))
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
                self.events.put(('phase', {'preflight': 'فحص', 'build': 'بناء', 'verify': 'تحقق'}.get(state, 'الخادم: ' + str(state))))
                self.events.put(('log', 'DEPLOY: ' + str(state) + '\n'))
                self.events.put(('state', 'مرحلة الخادم: ' + str(state)))
                last = state
            if state in terminal:
                if state != 'succeeded':
                    self.status(project, key, version, changes)
                    raise RuntimeError('حالة النشر: ' + state + ' — راجع السجل قبل أي إصدار آخر')
                if data.get('commit') != commit:
                    raise RuntimeError('سجل النشر يشير إلى commit مختلف')
                self.verify_release_commit(project, key, version, changes)
                return
            time.sleep(10)
        raise RuntimeError('انتهت مدة المتابعة؛ لا تعِد الرفع، تحقق من الحالة لاحقًا')

    def verify_deployed_application(self, project, key, version, changes):
        return self.verify_release_commit(project, key, version, changes, allow_desktop_difference=True)

    def verify_release_commit(self, project, key, version, changes, allow_desktop_difference=False):
        if not re.fullmatch(r'v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)', version):
            raise RuntimeError('رقم الإصدار غير صالح')
        project = self.repository(project)
        commit = self.synchronized_commit(project, report=True)
        health = json.loads(self.run([*self.ssh(key), 'curl -fsS --max-time 10 http://127.0.0.1:4001/release-health']))
        running = health.get('commit')
        self.events.put(('log', f'Ubuntu · الإصدار المشغّل {health.get("version")} · {running}\n'))
        if (allow_desktop_difference and health.get('ok') is True
                and isinstance(running, str) and re.fullmatch(r'[a-f0-9]{40}', running)
                and running != commit):
            differences = self.run(['git', 'diff', '--name-only', '--no-renames', running, commit, '--'], project)
            if differences and all(path.startswith('deployment/windows/') for path in differences.splitlines()):
                self.events.put(('log', 'ملفات التطبيق متطابقة. الفرق يخص أداة النشر على Windows فقط. لا يلزم إصدار جديد للخادم.\n'))
                return
        if health.get('ok') is not True or health.get('version') != version or health.get('commit') != commit:
            raise RuntimeError(f'المتوقع {version} / {commit} — الخادم {health.get("version")} / {health.get("commit")}')
        status = json.loads(self.run([*self.ssh(key), 'sudo -n -u radiusdeploy python3 ' + HELPER + ' status ' + version]))
        if status.get('status') != 'succeeded' or status.get('commit') != commit:
            raise RuntimeError('لم يؤكد عامل النشر نجاح هذا الإصدار')
        self.events.put(('log', 'نجح التحقق من الإصدار المشغّل: الـ commit متطابق على الجهات الثلاث.\n'))

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
                 'key': self.key.get(), 'version': self.version.get(), 'dark': self.dark}
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
        self.events.put(('log', 'فُتحت طرفية OpenSSH؛ حالة الطرفية تظهر داخل نافذتها.\n'))

    def latest_log(self, project, key, version, changes):
        info = json.loads(self.run([*self.ssh(key), 'sudo -n -u radiusdeploy python3 ' + HELPER + ' inspect']))
        current = info.get('currentVersion')
        if not current:
            raise RuntimeError('لا يوجد إصدار جارٍ')
        self.status(project, key, current, changes)

    def backup_ui(self, parent):
        row = ttk.Frame(parent)
        row.pack(fill='x')
        self.backup_kind = tk.StringVar(value='كاملة')
        ttk.Label(row, text='نوع النسخة:').pack(side='right')
        ttk.Combobox(row, textvariable=self.backup_kind, values=['كاملة', 'المشروع فقط', 'قواعد البيانات فقط'], state='readonly', width=20).pack(side='right', padx=5)
        ttk.Button(row, text='▤ اختيار قواعد البيانات', command=self.show_databases).pack(side='right', padx=5)
        ttk.Label(row, text='تُشفّر النسخة قبل حفظها', style='Muted.TLabel').pack(side='left')
        setup_actions = ttk.Frame(parent)
        setup_actions.pack(fill='x', pady=3)
        self.button(setup_actions, '🔧 تجهيز إدارة النسخ', self.install_backup)
        self.button(setup_actions, '🔐 ضبط تشفير النسخ', self.configure_key)
        self.button(setup_actions, '🔄 تحديث القائمة', self.list_backups)
        self.database_window = tk.Toplevel(self.root)
        self.database_window.title('اختيار قواعد البيانات')
        self.database_window.geometry('600x360')
        self.database_window.transient(self.root)
        self.database_window.protocol('WM_DELETE_WINDOW', self.database_window.withdraw)
        ttk.Label(self.database_window, text='لا تحديد = جميع القواعد المحلية المدعومة', padding=10).pack(anchor='e')
        self.db_list = tk.Listbox(self.database_window, selectmode='multiple', height=9, exportselection=False)
        self.db_list.pack(fill='both', expand=True, padx=12, pady=8)
        ttk.Button(self.database_window, text='اعتماد الاختيار', command=self.database_window.withdraw).pack(pady=8)
        self.database_window.withdraw()
        body = ttk.Frame(parent)
        body.pack(fill='x', pady=4)
        body.columnconfigure(0, weight=3)
        body.columnconfigure(1, weight=2)
        tree_frame = ttk.Frame(body)
        tree_frame.grid(row=0, column=0, sticky='nsew', padx=(0, 10))
        self.backup_tree = ttk.Treeview(tree_frame, columns=('kind', 'date', 'size', 'version', 'verified'), show='tree headings', height=3)
        self.backup_tree.heading('#0', text='معرّف النسخة')
        for column, title in [('kind', 'النوع'), ('date', 'التاريخ UTC'), ('size', 'الحجم MiB'), ('version', 'الإصدار'), ('verified', 'السلامة')]:
            self.backup_tree.heading(column, text=title)
            self.backup_tree.column(column, width=70, minwidth=45)
        self.backup_tree.column('#0', width=170, minwidth=100)
        backup_scroll = ttk.Scrollbar(tree_frame, orient='vertical', command=self.backup_tree.yview)
        self.backup_tree.configure(yscrollcommand=backup_scroll.set)
        backup_scroll.pack(side='right', fill='y')
        self.backup_tree.pack(side='left', fill='both', expand=True)
        actions = ttk.Frame(body)
        actions.grid(row=0, column=1, sticky='new')
        for label, action in [('➕ إنشاء نسخة', self.create_backup), ('⬇ تنزيل', self.download_backup), ('⬆ رفع نسخة', self.upload_backup),
                              ('🔎 فحص ومراجعة', self.review_backup), ('↩ استعادة', self.restore_backup), ('🗑 حذف', self.delete_backup), ('🕒 الجدولة', self.configure_schedule)]:
            self.button(actions, label, action)

    def show_databases(self):
        self.database_window.deiconify()
        self.database_window.lift()

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
        if action == 'create':
            self.events.put(('backup-created', result))
        if action == 'reset-plan':
            self.events.put(('reset-review', result))
        if action == 'review':
            self.events.put(('review', result))
        # A completed server operation must not become 'failed/unknown' solely
        # because the subsequent read-only refresh lost its connection.
        try:
            self.events.put(('backups', self.rpc('list', key)))
        except Exception as error:
            self.events.put(('log', 'اكتمل الإجراء، لكن تعذر تحديث قائمة النسخ: ' + str(error) + '\n'))

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
            kind = {'كاملة': 'full', 'المشروع فقط': 'project', 'قواعد البيانات فقط': 'databases'}[self.backup_kind.get()]
            data = {'kind': kind}
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
