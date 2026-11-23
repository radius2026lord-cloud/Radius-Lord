"""Local durable metadata and redacted logs. Never stores operation arguments."""
import datetime as dt
import contextlib
import pathlib
import re
import sqlite3
import time
import uuid
import queue
import threading

WRITE_ACTIONS = {'publish', 'backup-create', 'backup-restore', 'backup-upload', 'backup-delete', 'backup-schedule', 'reset-apply'}


def redact(text):
    text = str(text)
    text = re.sub(r'-----BEGIN [^-]*PRIVATE KEY-----.*?-----END [^-]*PRIVATE KEY-----', '[PRIVATE KEY REDACTED]', text, flags=re.S)
    text = re.sub(r'(?im)([\w-]*(?:password|passphrase|secret|token|encryption_key)[\w-]*["\x27]?\s*[:=]\s*)([^\r\n]+)', r'\1[REDACTED]', text)
    text = re.sub(r'(?i)(mysql://[^:\s/]+:)[^@\s]+@', r'\1[REDACTED]@', text)
    return text


class History:
    def __init__(self, directory):
        self.directory = pathlib.Path(directory)
        self.directory.mkdir(parents=True, exist_ok=True)
        self.database = self.directory / 'operations.sqlite3'
        with self.connect() as db:
            db.execute('PRAGMA journal_mode=WAL')
            db.execute('CREATE TABLE IF NOT EXISTS operations (id TEXT PRIMARY KEY, action TEXT NOT NULL, started REAL NOT NULL, ended REAL, status TEXT NOT NULL, version TEXT, backup_id TEXT, note TEXT NOT NULL DEFAULT "")')
            db.execute('CREATE TABLE IF NOT EXISTS logs (operation_id TEXT NOT NULL, at REAL NOT NULL, content TEXT NOT NULL)')
            db.execute('CREATE INDEX IF NOT EXISTS log_operation ON logs(operation_id)')
            db.execute("UPDATE operations SET status='unknown', ended=?, note='أُغلقت جلسة الأداة قبل حسم النتيجة؛ يلزم فحص الحالة' WHERE status='running'", (time.time(),))

        self.log_queue = queue.Queue()
        self.log_error = None
        threading.Thread(target=self.write_logs, daemon=True).start()

    @contextlib.contextmanager
    def connect(self):
        connection = sqlite3.connect(self.database, timeout=2)
        try:
            connection.execute('PRAGMA synchronous=NORMAL')
            with connection:
                yield connection
        finally:
            connection.close()

    def write_logs(self):
        while True:
            item = self.log_queue.get()
            batch, barriers = [], []
            items = [item]
            for _ in range(199):
                try: items.append(self.log_queue.get_nowait())
                except queue.Empty: break
            for value in items:
                if isinstance(value, threading.Event): barriers.append(value)
                else: batch.append(value)
            try:
                if batch:
                    with self.connect() as db:
                        db.executemany('INSERT INTO logs VALUES (?,?,?)', batch)
            except Exception as error:
                self.log_error = type(error).__name__
            finally:
                for barrier in barriers: barrier.set()
                for _ in items: self.log_queue.task_done()

    def flush(self, timeout=5):
        barrier = threading.Event()
        self.log_queue.put(barrier)
        if not barrier.wait(timeout):
            raise RuntimeError('لم يكتمل حفظ السجل المحلي بعد')
        if self.log_error:
            raise RuntimeError('تعذر حفظ جزء من السجل المحلي: ' + self.log_error)

    def begin(self, action, version='', backup_id=None, identifier=None):
        identifier = identifier or uuid.uuid4().hex
        with self.connect() as db:
            db.execute('INSERT INTO operations(id,action,started,status,version,backup_id) VALUES (?,?,?,?,?,?)',
                       (identifier, action, time.time(), 'running', version, backup_id))
        return identifier

    def finish(self, identifier, status, note=''):
        with self.connect() as db:
            db.execute('UPDATE operations SET status=?, ended=COALESCE(ended,?), note=? WHERE id=?', (status, time.time(), redact(note), identifier))

    def append(self, identifier, text):
        if identifier:
            self.log_queue.put((identifier, time.time(), redact(text)))

    def rows(self):
        with self.connect() as db:
            db.row_factory = sqlite3.Row
            rows = [dict(row) for row in db.execute('SELECT * FROM operations ORDER BY started DESC')]
        for row in rows:
            row['startedAt'] = dt.datetime.fromtimestamp(row['started']).astimezone().isoformat(timespec='seconds')
            row['durationSeconds'] = round((row['ended'] or time.time()) - row['started'], 1)
        return rows

    def get(self, identifier):
        return next((row for row in self.rows() if row['id'] == identifier), None)

    def log(self, identifier):
        self.flush()
        with self.connect() as db:
            return ''.join('[' + dt.datetime.fromtimestamp(at).astimezone().strftime('%H:%M:%S') + '] ' + content + ('\n' if not content.endswith('\n') else '')
                           for at, content in db.execute('SELECT at,content FROM logs WHERE operation_id=? ORDER BY rowid', (identifier,)))

    def pending(self):
        return [row for row in self.rows() if row['status'] in ('unknown', 'pending') and row['action'] in WRITE_ACTIONS]
