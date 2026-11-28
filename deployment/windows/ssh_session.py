"""Keep one OpenSSH transport to Ubuntu for this desktop process."""
import socket
import subprocess
import tempfile
import threading
import time


class ServerSession:
    def __init__(self, creationflags):
        self.creationflags = creationflags
        self.lock = threading.RLock()
        self.process = None
        self.errors = None
        self.port = None
        self.key = None

    def close(self):
        with self.lock:
            if self.process is not None and self.process.poll() is None:
                self.process.kill()
                try:
                    self.process.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    pass
            self.process = None
            if self.errors is not None:
                self.errors.close()
                self.errors = None

    def interrupted(self, code, output):
        with self.lock:
            if code != 255 or self.process is None:
                return False
            lost = self.process.poll() is not None or any(
                message in output.lower() for message in (
                    'connection refused', 'connection reset', 'connection closed',
                    'connection timed out', 'broken pipe'))
            if lost:
                # Keep the closed process marker so the next command logs a reconnect.
                if self.process.poll() is None:
                    self.process.kill()
                    try:
                        self.process.wait(timeout=3)
                    except subprocess.TimeoutExpired:
                        self.close()
            return lost

    def command(self, direct, key, host, port, user, log):
        with self.lock:
            if self.process is None or self.process.poll() is not None or self.key != key:
                reconnecting = self.process is not None
                self.close()
                log('جارٍ إعادة اتصال SSH بالخادم.\n' if reconnecting else 'جارٍ فتح جلسة SSH مشتركة مع الخادم.\n')
                with socket.socket() as listener:
                    listener.bind(('127.0.0.1', 0))
                    self.port = listener.getsockname()[1]
                self.key = key
                self.errors = tempfile.TemporaryFile()
                try:
                    self.process = subprocess.Popen(
                        [*direct[:-1], '-N', '-o', 'ExitOnForwardFailure=yes',
                         '-L', f'127.0.0.1:{self.port}:127.0.0.1:{port}', direct[-1]],
                        stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                        stderr=self.errors, creationflags=self.creationflags)
                    deadline = time.monotonic() + 12
                    while self.process.poll() is None and time.monotonic() < deadline:
                        try:
                            with socket.create_connection(('127.0.0.1', self.port), timeout=.2):
                                break
                        except OSError:
                            time.sleep(.1)
                    else:
                        self.errors.seek(0)
                        detail = self.errors.read().decode('utf-8', errors='replace').strip()
                        raise RuntimeError(detail or 'انتهت مهلة فتح جلسة SSH المشتركة.')
                except BaseException:
                    self.close()
                    raise
                log('اتصال SSH المشترك جاهز للأوامر.\n')
            # Verify the same known_hosts entry as a direct connection.
            return [direct[0], '-o', f'HostKeyAlias=[{host}]:{port}',
                    '-o', 'CheckHostIP=no', '-o', 'ProxyCommand=none',
                    '-p', str(self.port),
                    *direct[3:-1], f'{user}@127.0.0.1']
