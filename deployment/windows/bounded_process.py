"""Bounded read-only child processes without pipe-reader threads.

File-backed stdio makes the deadline independent of inherited pipe handles.
Use only for checks, never to time out a potentially mutating server action.
"""
import pathlib
import subprocess
import tempfile


def capture_readonly(args, timeout, *, cwd=None, env=None, creationflags=0, input_bytes=None):
    with tempfile.TemporaryFile() as output, tempfile.TemporaryFile() as errors, tempfile.TemporaryFile() as data:
        if input_bytes is not None:
            data.write(input_bytes)
            data.seek(0)
        process = subprocess.Popen(args, cwd=cwd, env=env, creationflags=creationflags,
                                   stdin=data if input_bytes is not None else subprocess.DEVNULL,
                                   stdout=output, stderr=errors)
        try:
            process.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            process.kill()
            try:
                process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                pass
            raise TimeoutError('انتهت مهلة الفحص المحلي (' + pathlib.Path(args[0]).name + '). يمكنك إعادة الفحص؛ لم يُكرّر أي إجراء') from None
        finally:
            if process.poll() is None:
                process.kill()
        output.seek(0)
        errors.seek(0)
        return subprocess.CompletedProcess(args, process.returncode, output.read(), errors.read())
