"""Local durable metadata and redacted logs. Never stores operation arguments."""
import datetime as dt
import pathlib
import re
import sqlite3
import time
import uuid

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
            db.execute('CREATE TABLE IF NOT EXISTS operations (id TEXT PRIMARY KEY, action TEXT NOT NULL, started REAL NOT NULL, ended REAL, status TEXT NOT NULL, version TEXT, backup_id TEXT, note TEXT NOT NULL DEFAULT "")')
            db.execute('CREATE TABLE IF NOT EXISTS logs (operation_id TEXT NOT NULL, at REAL NOT NULL, content TEXT NOT NULL)')
            db.execute('CREATE INDEX IF NOT EXISTS log_operation ON logs(operation_id)')
            db.execute("UPDATE operations SET status='unknown', ended=?, note='أُغلقت جلسة الأداة قبل حسم النتيجة؛ يلزم فحص الحالة' WHERE status='running'", (time.time(),))

    def connect(self):
        return sqlite3.connect(self.database, timeout=15)

    def begin(self, action, version='', backup_id=None):
        identifier = uuid.uuid4().hex
        with self.connect() as db:
            db.execute('INSERT INTO operations(id,action,started,status,version,backup_id) VALUES (?,?,?,?,?,?)',
                       (identifier, action, time.time(), 'running', version, backup_id))
        return identifier

    def finish(self, identifier, status, note=''):
        with self.connect() as db:
            db.execute('UPDATE operations SET status=?, ended=COALESCE(ended,?), note=? WHERE id=?', (status, time.time(), redact(note), identifier))

    def append(self, identifier, text):
        if identifier:
            with self.connect() as db:
                db.execute('INSERT INTO logs VALUES (?,?,?)', (identifier, time.time(), redact(text)))

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
        with self.connect() as db:
            return ''.join('[' + dt.datetime.fromtimestamp(at).astimezone().strftime('%H:%M:%S') + '] ' + content + ('\n' if not content.endswith('\n') else '')
                           for at, content in db.execute('SELECT at,content FROM logs WHERE operation_id=? ORDER BY rowid', (identifier,)))

    def pending(self):
        return [row for row in self.rows() if row['status'] in ('unknown', 'pending') and row['action'] in WRITE_ACTIONS]
