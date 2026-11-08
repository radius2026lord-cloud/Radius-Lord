#!/usr/bin/env python3
import fcntl
import gzip
import hashlib
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time

ROOT = pathlib.Path("/var/lib/radius-lord/database-backups")
IDENTIFIER = re.compile(r"[a-f0-9-]{36}")


def directory(identifier):
    if not IDENTIFIER.fullmatch(identifier):
        raise ValueError("Invalid backup identifier")
    return ROOT / identifier


def write(path, value):
    handle, temporary = tempfile.mkstemp(dir=path.parent, prefix=".state-")
    with os.fdopen(handle, "w") as stream:
        json.dump(value, stream)
    os.replace(temporary, path)


def now():
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def status(identifier):
    root = directory(identifier)
    if not (root / "status.json").exists():
        return {"status": "not_found"}
    with (root / "lock").open("a") as lock:
        state = json.loads((root / "status.json").read_text())
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return state
        if state["status"] in ("running", "verifying"):
            state.update(status="failed", error="WORKER_INTERRUPTED", completedAt=now())
            write(root / "status.json", state)
        return state


def start(identifier, data):
    ROOT.mkdir(mode=0o700, parents=True, exist_ok=True)
    root = directory(identifier)
    root.mkdir(mode=0o700, exist_ok=True)
    with (root / "lock").open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return json.loads((root / "status.json").read_text())
        previous = root / "status.json"
        if previous.exists():
            state = json.loads(previous.read_text())
            if state["status"] != "queued":
                if state["status"] in ("running", "verifying"):
                    state.update(status="failed", error="WORKER_INTERRUPTED", completedAt=now())
                    write(previous, state)
                return state
        if not re.fullmatch(r"[a-zA-Z0-9_]{1,64}", data["database"]):
            raise ValueError("Invalid database name")
        write(root / "credentials.json", data)
        write(previous, {"status": "queued", "id": identifier, "database": data["database"], "startedAt": now()})
        subprocess.Popen([sys.executable, __file__, "run", identifier], start_new_session=True,
                         stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return {"status": "queued", "id": identifier}


def option(value):
    return '"' + str(value).replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n").replace("\r", "\\r") + '"'


def run(identifier):
    root = directory(identifier)
    with (root / "lock").open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return
        state = json.loads((root / "status.json").read_text())
        if state["status"] != "queued":
            return
        config_path = root / "credentials.json"
        defaults = root / "client.cnf"
        partial = root / "database.sql.gz.partial"
        process = None
        timer = None
        try:
            data = json.loads(config_path.read_text())
            config_path.unlink()
            state.update(status="running", startedAt=now())
            write(root / "status.json", state)
            if not shutil.which("mysqldump") or not shutil.which("mysql"):
                raise RuntimeError("MYSQL_TOOLS_REQUIRED")
            if shutil.disk_usage(ROOT).free < max(256 * 1024**2, int(data.get("estimatedBytes", 0))):
                raise RuntimeError("BACKUP_DISK_SPACE")
            defaults.write_text("[client]\n" + "\n".join(key + "=" + option(data[key]) for key in ("host", "port", "user", "password")) + "\nprotocol=tcp\n")
            defaults.chmod(0o600)
            ssl = ["--ssl-mode=VERIFY_IDENTITY", "--ssl-ca=/etc/ssl/certs/ca-certificates.crt"] if data["tls"] else ["--ssl-mode=DISABLED"]
            engine = subprocess.check_output(["mysql", "--defaults-extra-file=" + str(defaults), *ssl, "--batch", "--skip-column-names", "-e", "SELECT @@server_uuid"], timeout=20, stderr=subprocess.DEVNULL).decode().strip()
            if engine != data["serverUuid"]:
                raise RuntimeError("BACKUP_ENGINE_MISMATCH")
            args = ["mysqldump", "--defaults-extra-file=" + str(defaults), *ssl, "--single-transaction", "--quick",
                    "--default-character-set=utf8mb4", "--routines", "--events", "--triggers", "--hex-blob", "--no-tablespaces",
                    "--tz-utc", "--set-gtid-purged=OFF", "--column-statistics=0", "--databases", data["database"]]
            with (root / "error.log").open("wb") as errors:
                process = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=errors)
                timer = threading.Timer(1800, process.kill)
                timer.start()
                with gzip.open(partial, "wb", compresslevel=3) as output:
                    count = 0
                    while True:
                        block = process.stdout.read(1024 * 1024)
                        if not block:
                            break
                        output.write(block)
                        count += 1
                        if count % 32 == 0 and shutil.disk_usage(ROOT).free < 64 * 1024**2:
                            raise RuntimeError("BACKUP_DISK_SPACE")
                if process.wait(timeout=20):
                    raise RuntimeError("MYSQL_DUMP_FAILED")
            state["status"] = "verifying"
            write(root / "status.json", state)
            total = 0
            with gzip.open(partial, "rb") as stream:
                for block in iter(lambda: stream.read(1024 * 1024), b""):
                    total += len(block)
            if total == 0:
                raise RuntimeError("BACKUP_EMPTY")
            sha, md5 = hashlib.sha256(), hashlib.md5()
            with partial.open("rb") as stream:
                for block in iter(lambda: stream.read(1024 * 1024), b""):
                    sha.update(block)
                    md5.update(block)
            os.replace(partial, root / "database.sql.gz")
            state.update(status="verified", verified=True, bytes=(root / "database.sql.gz").stat().st_size,
                         sha256=sha.hexdigest(), md5=md5.hexdigest(), completedAt=now())
        except Exception as error:
            if process and process.poll() is None:
                process.kill()
                process.wait()
            code = str(error) if isinstance(error, RuntimeError) else type(error).__name__
            state.update(status="failed", error=code[:80], completedAt=now())
        finally:
            if timer:
                timer.cancel()
            for path in (config_path, defaults, partial):
                path.unlink(missing_ok=True)
            write(root / "status.json", state)


def download(identifier):
    state = status(identifier)
    if state.get("status") != "verified":
        raise RuntimeError("BACKUP_NOT_VERIFIED")
    with (directory(identifier) / "database.sql.gz").open("rb") as stream:
        digest = hashlib.sha256()
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
        if digest.hexdigest() != state["sha256"]:
            raise RuntimeError("BACKUP_CHECKSUM_MISMATCH")
        stream.seek(0)
        shutil.copyfileobj(stream, sys.stdout.buffer, 1024 * 1024)


def remove(identifier):
    root = directory(identifier)
    with (root / "lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        state = json.loads((root / "status.json").read_text())
        if state["status"] not in ("verified", "removed"):
            raise RuntimeError("BACKUP_NOT_VERIFIED")
        (root / "database.sql.gz").unlink(missing_ok=True)
        state.update(status="removed", removedAt=now())
        write(root / "status.json", state)
    return {"status": "removed"}


if __name__ == "__main__":
    os.umask(0o077)
    action, identifier = sys.argv[1:3]
    if action == "run":
        run(identifier)
    elif action == "download":
        download(identifier)
    elif action == "start":
        print(json.dumps(start(identifier, json.load(sys.stdin))))
    elif action == "inspect":
        ROOT.mkdir(mode=0o700, parents=True, exist_ok=True)
        print(json.dumps({"mysql": bool(shutil.which("mysql")), "mysqldump": bool(shutil.which("mysqldump")), "freeBytes": shutil.disk_usage(ROOT).free}))
    elif action == "status":
        print(json.dumps(status(identifier)))
    elif action == "remove":
        print(json.dumps(remove(identifier)))
    else:
        raise ValueError("Unknown operation")
