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


def mysql_failure(message):
    text = message.lower()
    unsupported = re.search(r"""unknown (?:variable|option) ['"]?(?:--)?([a-z][a-z0-9_-]{0,60})""", text)
    if unsupported:
        return "MYSQL_OPTION_" + unsupported.group(1).replace("-", "_").upper()
    for clues, code in [
        (["1045", "1698", "access denied"], "MYSQL_BACKUP_ACCESS_DENIED"),
        (["1130", "not allowed to connect"], "MYSQL_BACKUP_HOST_DENIED"),
        (["2026", "certificate", "ssl connection"], "MYSQL_BACKUP_TLS_FAILED"),
        (["2002", "2003", "2005"], "MYSQL_BACKUP_CONNECT_FAILED"),
        (["unknown variable", "unknown option"], "MYSQL_BACKUP_CLIENT_OPTIONS"),
        (["1227", "privilege"], "MYSQL_BACKUP_PRIVILEGES"),
    ]:
        if any(clue in text for clue in clues):
            return code
    return "MYSQL_SOURCE_CHECK_FAILED"


def source_options(data, defaults):
    # Accept a local root socket only when its instance UUID matches the source.
    local = ["--no-defaults", "--protocol=SOCKET", "--user=root", "--connect-timeout=5"]
    probe = ["--batch", "--skip-column-names", "-e", "SELECT @@server_uuid"]
    try:
        result = subprocess.run(["mysql", *local, *probe], capture_output=True, timeout=8)
        if result.returncode == 0 and result.stdout.decode().strip() == data["serverUuid"]:
            return [value for value in local if not value.startswith("--connect-timeout=")], "local_socket"
    except (subprocess.TimeoutExpired, OSError):
        pass
    tls = ["--ssl-mode=VERIFY_IDENTITY", "--ssl-ca=/etc/ssl/certs/ca-certificates.crt"] if data["tls"] else ["--ssl-mode=DISABLED"]
    remote = ["--defaults-file=" + str(defaults), *tls, "--connect-timeout=15"]
    try:
        result = subprocess.run(["mysql", *remote, *probe], capture_output=True, timeout=20)
    except subprocess.TimeoutExpired:
        raise RuntimeError("MYSQL_SOURCE_CHECK_TIMEOUT") from None
    if result.returncode:
        raise RuntimeError(mysql_failure(result.stderr.decode(errors="replace"))) from None
    if result.stdout.decode().strip() != data["serverUuid"]:
        raise RuntimeError("BACKUP_ENGINE_MISMATCH")
    return [value for value in remote if not value.startswith("--connect-timeout=")], "configured_tcp"


def dump_options():
    # Probe mysqldump itself: mysql and mysqldump do not share all options.
    try:
        result = subprocess.run(["mysqldump", "--no-defaults", "--help"],
                                capture_output=True, timeout=10)
    except subprocess.TimeoutExpired:
        raise RuntimeError("MYSQL_DUMP_HELP_FAILED") from None
    if result.returncode:
        raise RuntimeError("MYSQL_DUMP_HELP_FAILED")
    help_text = result.stdout.decode(errors="replace")
    options = ["--single-transaction", "--quick", "--default-character-set=utf8mb4",
               "--routines", "--events", "--triggers", "--hex-blob", "--tz-utc"]
    for name, value in [("no-tablespaces", "--no-tablespaces"),
                        ("set-gtid-purged", "--set-gtid-purged=OFF"),
                        ("column-statistics", "--column-statistics=0")]:
        if re.search(r"(?<![a-z-])" + re.escape(name) + r"(?![a-z-])", help_text):
            options.append(value)
    return options


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
            connection_options, transport = source_options(data, defaults)
            state["transport"] = transport
            args = ["mysqldump", *connection_options, *dump_options(),
                    "--databases", data["database"]]
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
                    raise RuntimeError(mysql_failure((root / "error.log").read_bytes()[:16384].decode(errors="replace")))
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



def verification_paths(identifier, check_id):
    if not IDENTIFIER.fullmatch(check_id):
        raise ValueError("Invalid verification identifier")
    folder = directory(identifier) / "verification" / check_id
    return folder, folder / "state.json"


def verification_status(identifier, check_id):
    folder, state_path = verification_paths(identifier, check_id)
    if not state_path.exists():
        return {"status": "not_found"}
    with (folder / "lock").open("a") as lock:
        state = json.loads(state_path.read_text())
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return state
        if state["status"] == "queued" and time.time() - state_path.stat().st_mtime < 120:
            return state
        if state["status"] not in ("succeeded", "failed"):
            state.update(status="failed", error="RESTORE_WORKER_INTERRUPTED", completedAt=now())
            sandbox = pathlib.Path("/var/tmp/radius-lord-restore-checks") / check_id
            try:
                if sandbox.exists():
                    shutil.rmtree(sandbox)
                state["cleanupComplete"] = True
            except OSError:
                state["cleanupComplete"] = False
            write(state_path, state)
        return state


def verification_start(identifier, data):
    check_id = data["checkId"]
    folder, state_path = verification_paths(identifier, check_id)
    folder.mkdir(parents=True, mode=0o700, exist_ok=True)
    with (folder / "lock").open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return json.loads(state_path.read_text())
        if state_path.exists():
            return json.loads(state_path.read_text())
        backup = status(identifier)
        if backup.get("status") != "verified" or backup.get("sha256") != data["sha256"]:
            raise RuntimeError("RESTORE_SOURCE_NOT_VERIFIED")
        if not re.fullmatch(r"[a-zA-Z0-9_]{1,64}", data["database"]):
            raise RuntimeError("RESTORE_DATABASE_NAME")
        write(folder / "input.json", data)
        write(state_path, {"status": "queued", "checkId": check_id, "startedAt": now()})
        subprocess.Popen([sys.executable, __file__, "verify-run", identifier, check_id],
                         start_new_session=True, stdin=subprocess.DEVNULL,
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return {"status": "queued"}


def verification_run(identifier, check_id):
    import pwd
    import signal
    import ctypes
    folder, state_path = verification_paths(identifier, check_id)
    # Data is owned by mysql; the private backup and result files remain root-only.
    base = pathlib.Path("/var/tmp/radius-lord-restore-checks")
    sandbox = base / check_id
    daemon = None
    importer = None
    timer = None
    expired = threading.Event()
    state = json.loads(state_path.read_text())
    parent_pid = os.getpid()
    def as_mysql(command):
        # Drop the OS identity before setting the parent-death guard, without
        # preexec_fn (the supervisor also has a timeout thread).
        launcher = "import os,pwd,ctypes,signal,sys; p=pwd.getpwnam('mysql'); os.setgroups([]); os.setgid(p.pw_gid); os.setuid(p.pw_uid); lib=ctypes.CDLL(None); ok=lib.prctl(1,signal.SIGKILL,0,0,0); os._exit(126) if ok or os.getppid()!=int(sys.argv[1]) else None; os.execv(sys.argv[2],sys.argv[2:])"
        return [sys.executable, "-c", launcher, str(parent_pid), *command]
    def stop():
        expired.set()
        for process in (importer, daemon):
            if process and process.poll() is None:
                process.kill()
    with (folder / "lock").open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return
        try:
            os.nice(5)
            timer = threading.Timer(3600, stop)
            timer.start()
            data = json.loads((folder / "input.json").read_text())
            for tool in ("mysqld", "mysql"):
                if not shutil.which(tool):
                    raise RuntimeError("RESTORE_SERVER_TOOLS_REQUIRED")
            version = subprocess.run(["mysqld", "--no-defaults", "--version"], capture_output=True, timeout=10)
            if version.returncode or not re.search(rb"Ver 8\.", version.stdout) or b"MariaDB" in version.stdout:
                raise RuntimeError("RESTORE_MYSQL8_REQUIRED")
            backup_file = directory(identifier) / "database.sql.gz"
            digest = hashlib.sha256()
            with backup_file.open("rb") as source:
                for block in iter(lambda: source.read(1024 * 1024), b""):
                    if expired.is_set():
                        raise RuntimeError("RESTORE_TIMEOUT")
                    digest.update(block)
            if digest.hexdigest() != data["sha256"]:
                raise RuntimeError("RESTORE_SOURCE_CHECKSUM")
            sql_bytes = 0
            with gzip.open(backup_file, "rb") as source:
                for block in iter(lambda: source.read(1024 * 1024), b""):
                    if expired.is_set():
                        raise RuntimeError("RESTORE_TIMEOUT")
                    sql_bytes += len(block)
            if shutil.disk_usage("/var/tmp").free < sql_bytes * 2 + 1024**3:
                raise RuntimeError("RESTORE_DISK_SPACE")
            account = pwd.getpwnam("mysql")
            base.mkdir(mode=0o711, exist_ok=True)
            if base.is_symlink() or base.stat().st_uid != 0:
                raise RuntimeError("RESTORE_SANDBOX_PATH")
            base.chmod(0o711)
            sandbox.mkdir(mode=0o700)
            os.chown(sandbox, account.pw_uid, account.pw_gid)
            state.update(status="initializing", sqlBytes=sql_bytes)
            write(state_path, state)
            datadir = sandbox / "data"
            initialized = subprocess.run(as_mysql([shutil.which("mysqld"), "--no-defaults", "--initialize-insecure",
                                          "--datadir=" + str(datadir)]), stdout=subprocess.DEVNULL,
                                         stderr=subprocess.DEVNULL, timeout=180)
            if initialized.returncode:
                raise RuntimeError("RESTORE_INITIALIZE_FAILED")
            if expired.is_set():
                raise RuntimeError("RESTORE_TIMEOUT")
            sock = sandbox / "mysql.sock"
            daemon = subprocess.Popen(as_mysql([shutil.which("mysqld"), "--no-defaults", "--datadir=" + str(datadir),
                                       "--socket=" + str(sock), "--pid-file=" + str(sandbox / "mysql.pid"),
                                       "--log-error=" + str(sandbox / "mysql.log"), "--skip-networking",
                                       "--mysqlx=OFF", "--skip-log-bin", "--event-scheduler=OFF",
                                       "--secure-file-priv=NULL", "--local-infile=OFF",
                                       "--innodb-buffer-pool-size=64M", "--max-connections=4",
                                       "--performance-schema=OFF"]), stdout=subprocess.DEVNULL,
                                      stderr=subprocess.DEVNULL)
            client = ["mysql", "--no-defaults", "--protocol=SOCKET", "--socket=" + str(sock),
                      "--user=root", "--connect-timeout=5", "--batch", "--skip-column-names", "--binary-mode"]
            def query(sql, timeout=20):
                result = subprocess.run(client, input=sql.encode(), capture_output=True, timeout=timeout)
                if result.returncode:
                    raise RuntimeError("RESTORE_QUERY_FAILED")
                return result.stdout.decode(errors="replace").strip()
            for attempt in range(120):
                if expired.is_set() or daemon.poll() is not None:
                    raise RuntimeError("RESTORE_SANDBOX_START_FAILED")
                if sock.exists():
                    result = subprocess.run(client, input=b"SELECT 1;", stdout=subprocess.DEVNULL,
                                            stderr=subprocess.DEVNULL, timeout=6)
                    if result.returncode == 0:
                        break
                time.sleep(0.5)
            else:
                raise RuntimeError("RESTORE_SANDBOX_START_FAILED")
            proof = query("SELECT @@datadir,@@socket,@@skip_networking,@@event_scheduler;").split("\t")
            if len(proof) != 4 or pathlib.Path(proof[0]).resolve() != datadir.resolve() or pathlib.Path(proof[1]).resolve() != sock.resolve() or proof[2] != "1" or proof[3] != "OFF":
                raise RuntimeError("RESTORE_ISOLATION_FAILED")
            state.update(status="importing")
            write(state_path, state)
            with (folder / "import-error.log").open("wb") as errors:
                importer = subprocess.Popen(client, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=errors)
                with gzip.open(backup_file, "rb") as source:
                    while True:
                        if expired.is_set():
                            raise RuntimeError("RESTORE_TIMEOUT")
                        block = source.read(1024 * 1024)
                        if not block:
                            break
                        if shutil.disk_usage(sandbox).free < 128 * 1024**2:
                            raise RuntimeError("RESTORE_DISK_SPACE")
                        importer.stdin.write(block)
                importer.stdin.close()
                if importer.wait(timeout=120):
                    raise RuntimeError("RESTORE_IMPORT_FAILED")
            if query("SELECT @@event_scheduler;") != "OFF":
                raise RuntimeError("RESTORE_ISOLATION_FAILED")
            state.update(status="checking")
            write(state_path, state)
            database = data["database"]
            objects = query("SELECT TABLE_NAME,TABLE_TYPE FROM information_schema.TABLES WHERE TABLE_SCHEMA='" + database + "' ORDER BY TABLE_NAME;")
            tables, views = 0, 0
            for line in objects.splitlines():
                if not line:
                    continue
                name, kind = line.split("\t")
                if kind != "BASE TABLE":
                    views += 1
                    continue
                target = "`" + database + "`.`" + name.replace("`", "``") + "`"
                check = query("CHECK TABLE " + target + ";", timeout=60)
                if not check.splitlines() or not check.splitlines()[-1].endswith("\tstatus\tOK"):
                    raise RuntimeError("RESTORE_TABLE_CHECK_FAILED")
                tables += 1
                if expired.is_set():
                    raise RuntimeError("RESTORE_TIMEOUT")
                time.sleep(0.05)
            if not tables:
                raise RuntimeError("RESTORE_NO_TABLES")
            state.update(status="cleaning", tables=tables, views=views)
            write(state_path, state)
        except Exception as error:
            code = "RESTORE_IMPORT_FAILED" if isinstance(error, BrokenPipeError) else str(error) if isinstance(error, RuntimeError) else "RESTORE_OPERATION_FAILED"
            state.update(status="failed", error=code, completedAt=now())
        finally:
            stop()
            for process in (importer, daemon):
                if process:
                    try:
                        process.wait(timeout=15)
                    except subprocess.TimeoutExpired:
                        process.kill()
                        process.wait()
            if timer:
                timer.cancel()
            try:
                if sandbox.exists():
                    shutil.rmtree(sandbox)
                state["cleanupComplete"] = True
            except OSError:
                state.update(status="failed", error="RESTORE_CLEANUP_FAILED", cleanupComplete=False)
            (folder / "input.json").unlink(missing_ok=True)
            if state["status"] == "cleaning":
                state.update(status="succeeded", completedAt=now())
            write(state_path, state)


if __name__ == "__main__":
    os.umask(0o077)
    action, identifier = sys.argv[1:3]
    if action == "verify-start":
        print(json.dumps(verification_start(identifier, json.load(sys.stdin))))
    elif action == "verify-status":
        print(json.dumps(verification_status(identifier, json.load(sys.stdin)["checkId"])))
    elif action == "verify-run":
        verification_run(identifier, sys.argv[3])
    elif action == "run":
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
