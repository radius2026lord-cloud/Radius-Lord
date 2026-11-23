"""Runtime regressions without network access or production changes.

The bridge test uses lightweight Qt stubs to exercise Python event/lifecycle logic;
it does not claim Windows/Qt rendering coverage.
"""
import importlib.util
import json
import pathlib
import sys
import tempfile
import threading
import time
import types
import unittest

HERE = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
from bounded_process import capture_readonly
from operation_history import History


class SignalStub:
    def __init__(self, *args):
        self.values = []
    def __get__(self, instance, owner):
        if instance is None:
            return self
        return instance.__dict__.setdefault('_signal', SignalStub())
    def emit(self, value):
        self.values.append(json.loads(value))
    def connect(self, callback):
        pass


class QObjectStub:
    def __init__(self, *args):
        pass
    def event(self, value):
        return True


class TimerStub:
    pending = []
    def __init__(self, *args):
        self.timeout = SignalStub()
    def start(self, *args):
        pass
    @staticmethod
    def singleShot(ms, callback):
        TimerStub.pending.append(callback)


def load_bridge():
    core = types.ModuleType('PySide6.QtCore')
    core.QObject, core.QTimer, core.Signal = QObjectStub, TimerStub, SignalStub
    core.Slot = lambda *args: lambda function: function
    core.QUrl, core.QEvent = object, object
    widgets = types.ModuleType('PySide6.QtWidgets')
    for name in ['QApplication','QFileDialog','QInputDialog','QLineEdit','QMainWindow','QMessageBox','QToolTip']:
        setattr(widgets, name, QObjectStub)
    engine = types.ModuleType('PySide6.QtWebEngineCore')
    for name in ['QWebEnginePage','QWebEngineSettings','QWebEngineUrlRequestInterceptor','QWebEngineProfile']:
        setattr(engine, name, QObjectStub)
    channel = types.ModuleType('PySide6.QtWebChannel')
    channel.QWebChannel = QObjectStub
    view = types.ModuleType('PySide6.QtWebEngineWidgets')
    view.QWebEngineView = QObjectStub
    for module in [core, widgets, engine, channel, view]:
        sys.modules[module.__name__] = module
    sys.modules['PySide6'] = types.ModuleType('PySide6')
    spec = importlib.util.spec_from_file_location('modern_test', HERE / 'modern-console.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class RuntimeTests(unittest.TestCase):
    def test_captured_output_and_deadline(self):
        result = capture_readonly([sys.executable, '-c', "print('ok')"], 2)
        self.assertEqual(result.stdout.strip(), b'ok')
        start = time.monotonic()
        with self.assertRaises(TimeoutError):
            capture_readonly([sys.executable, '-c', 'import time; time.sleep(10)'], .15)
        self.assertLess(time.monotonic()-start, 2)

    def test_cancelled_inspection_does_not_start_child(self):
        cancel = threading.Event()
        cancel.set()
        with tempfile.TemporaryDirectory() as temp:
            marker = pathlib.Path(temp) / 'unexpected'
            with self.assertRaises(TimeoutError):
                capture_readonly([sys.executable, '-c', 'from pathlib import Path; Path(' + repr(str(marker)) + ').touch()'], 2, cancel_event=cancel)
            self.assertFalse(marker.exists())

    def test_inherited_output_handle_does_not_extend_wait(self):
        script = "import subprocess,sys; subprocess.Popen([sys.executable,'-c','import time;time.sleep(.7)']);print('done')"
        started = time.monotonic()
        result = capture_readonly([sys.executable, '-c', script], 2)
        self.assertIn(b'done', result.stdout)
        self.assertLess(time.monotonic()-started, .6)

    def test_history_batched_log_flush_and_redaction(self):
        with tempfile.TemporaryDirectory() as temp:
            history = History(temp)
            identifier = history.begin('inspect')
            for _ in range(500):
                history.append(identifier, 'password=example-private-value')
            history.finish(identifier, 'succeeded')
            text = history.log(identifier)
            self.assertNotIn('example-private-value', text)
            self.assertEqual(text.count('[REDACTED]'), 500)

    def test_broken_local_history_cannot_block_readonly_startup(self):
        module = load_bridge()
        with tempfile.TemporaryDirectory() as temp:
            module.legacy.PREFERENCES = pathlib.Path(temp) / 'preferences.json'
            bridge = module.Bridge(None)
            bridge.followup_after_connect = False
            def broken(*args, **kwargs):
                raise RuntimeError('unavailable local history')
            bridge.history.rows = broken
            bridge.history.begin = broken
            bridge.ready()  # init/access must be delivered even with a bad history DB.
            called = threading.Event()
            bridge.start('inspect', called.set)
            deadline = time.monotonic()+2
            while bridge.busy and time.monotonic()<deadline:
                bridge.drain()
                time.sleep(.01)
            self.assertTrue(called.is_set())
            self.assertFalse(bridge.busy)
            self.assertTrue(any(v['kind']=='init' for v in bridge.message.values))
            mutated = threading.Event()
            bridge.start('backup-restore', mutated.set)
            while bridge.busy and time.monotonic()<deadline:
                bridge.drain()
                time.sleep(.01)
            self.assertFalse(mutated.is_set())  # A write still requires durable tracking.
            bridge.history.flush()

    def test_bridge_success_failure_timeout_and_stale_events(self):
        module = load_bridge()
        with tempfile.TemporaryDirectory() as temp:
            module.legacy.PREFERENCES = pathlib.Path(temp) / 'preferences.json'
            bridge = module.Bridge(None)
            self.assertTrue(callable(bridge.event))  # QObject.event must remain a method.
            bridge.followup_after_connect = False
            def success():
                bridge.core.events.put(('access', True))
                bridge.core.events.put(('services', ({'mysql':'active'}, 'now')))
            bridge.start('inspect', success)
            deadline = time.monotonic()+3
            while bridge.busy and time.monotonic()<deadline:
                bridge.drain()
                time.sleep(.01)
            self.assertFalse(bridge.busy)
            self.assertTrue(bridge.connection_ready)
            def fail():
                bridge.core.events.put(('access', False))
                raise TimeoutError('test timeout')
            bridge.start('inspect', fail)
            while bridge.busy and time.monotonic()<deadline:
                bridge.drain()
                time.sleep(.01)
            self.assertFalse(bridge.busy)
            self.assertFalse(bridge.connection_ready)
            blocked = threading.Event()
            bridge.start('inspect', lambda: blocked.wait(1))
            old = bridge.active_job_id
            bridge.inspection_deadline = time.monotonic()-1
            bridge.drain()
            self.assertFalse(bridge.busy)
            bridge.core.events.put(('access', True,))
            # Replace the queued identifier with the abandoned check's ID.
            bridge.core.events.get_nowait()
            import queue
            queue.Queue.put(bridge.core.events, ('access', True, old))
            bridge.drain()
            self.assertFalse(bridge.connection_ready)
            blocked.set()
            time.sleep(.1)
            bridge.drain()
            bridge.history.flush()


if __name__ == '__main__':
    unittest.main()
