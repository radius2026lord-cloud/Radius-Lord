#!/usr/bin/env python3
"""Git receiver and serial release worker for Radius Lord."""
import fcntl
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request

REPO = pathlib.Path(__file__).resolve().parent.parent
CONFIG = REPO.parent / "host-config.json"
VERSION = re.compile(r"v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)")
ZERO = "0" * 40


def config():
    return json.loads(CONFIG.read_text())


def atomic(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary = tempfile.mkstemp(prefix=".incoming-", dir=path.parent)
    try:
        with os.fdopen(handle, "w") as stream:
            json.dump(value, stream, ensure_ascii=False, indent=2)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def command(args, cwd=None, timeout=30, capture=True):
    return subprocess.run(args, cwd=cwd, check=True, timeout=timeout,
                          stdout=subprocess.PIPE if capture else None,
                          stderr=subprocess.PIPE if capture else None, text=True).stdout


def git(*args):
    return command(["git", "--git-dir=" + str(REPO), *args]).strip()


def manifest(object_id, reference):
    match = re.fullmatch(r"refs/tags/radius-release/(v\d+\.\d+\.\d+)", reference)
    if not match or not VERSION.fullmatch(match[1]):
        raise ValueError("Only immutable radius-release version tags are accepted.")
    if git("cat-file", "-t", object_id) != "tag":
        raise ValueError("Release metadata must be an annotated tag.")
    raw = git("cat-file", "tag", object_id)
    headers, message = raw.split("\n\n", 1)
    data = json.loads(message)
    commit = git("rev-parse", object_id + "^{commit}")
    if data.get("version") != match[1] or data.get("commit") != commit:
        raise ValueError("Release metadata and commit differ.")
    if not isinstance(data.get("changes"), str) or not 0 < len(data["changes"]) <= 4000:
        raise ValueError("Release changes are required.")
    if "type commit" not in headers.splitlines():
        raise ValueError("The tag must refer directly to a commit.")
    return data


def root_path():
    return pathlib.Path(config()["root"])


def enqueue(data):
    root = root_path()
    with (root / "receipt.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        path = root / "status" / (data["version"] + ".json")
        if not path.exists():
            atomic(path, {**data, "status": "queued", "stages": [], "networkResults": [],
                          "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())})
        current = json.loads(path.read_text())
        queue = root / "queue" / (data["version"] + ".json")
        if current["status"] == "queued" and not queue.exists():
            atomic(queue, data)


def read_status(version):
    if not VERSION.fullmatch(version):
        raise ValueError("Invalid version.")
    path = root_path() / "status" / (version + ".json")
    if not path.exists() or json.loads(path.read_text()).get("status") == "queued":
        reference = "refs/tags/radius-release/" + version
        try:
            object_id = git("rev-parse", "--verify", reference)
        except subprocess.CalledProcessError:
            return {"status": "not_received"}
        enqueue(manifest(object_id, reference))
    return json.loads(path.read_text())


def inspect():
    cfg = config()
    root = pathlib.Path(cfg["root"])
    checks = []
    for name in ("git", "node", "npm", "tar"):
        checks.append({"name": name, "ok": bool(shutil.which(name))})
    if cfg.get("requireBootstrapReceipt") and not (root / "current").exists():
        try:
            receipt = json.loads((root / "shared/central-import-receipt.json").read_text())
            central_ready = receipt.get("centralTablesVerified") is True
        except (OSError, ValueError):
            central_ready = False
        checks.append({"name":"استيراد القاعدة المركزية المعتمدة", "ok":central_ready})
    checks.extend([
        {"name": "ملف إعدادات الواجهة", "ok": (root / "shared/root.env").is_file()},
        {"name": "ملف إعدادات الباك إند", "ok": (root / "shared/backend.env").is_file()},
        {"name": "عامل النسخ الاحتياطي", "ok": os.access(root / "shared/hooks/backup", os.X_OK)},
        {"name": "مساحة حرة لا تقل عن 2 GiB", "ok": shutil.disk_usage(root).free >= 2 * 1024**3},
    ])
    sudo = subprocess.run(["sudo", "-n", "-l", "systemctl", "restart", *cfg["services"]],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10)
    checks.append({"name": "صلاحية إعادة تشغيل الخدمات", "ok": sudo.returncode == 0})
    current = root / "current/release.json"
    running = json.loads(current.read_text()) if current.is_file() else {}
    return {"ready": all(check["ok"] for check in checks), "checks": checks,
            "currentVersion": running.get("version"), "currentCommit": running.get("commit"),
            "migrationReady": os.access(root / "shared/hooks/migrate", os.X_OK)}


def sql_changes(commit, previous):
    if previous:
        paths = git("diff", "--name-only", previous, commit).splitlines()
    else:
        paths = git("ls-tree", "-r", "--name-only", commit).splitlines()
    return [path for path in paths if path.endswith(".sql") or "/migrations/" in path]


def service(action):
    return command(["sudo", "-n", "systemctl", action, *config()["services"]], timeout=90)


def switch(root, directory):
    temporary = root / ("current-" + str(os.getpid()))
    temporary.unlink(missing_ok=True)
    temporary.symlink_to(directory, target_is_directory=True)
    os.replace(temporary, root / "current")


def runtime(root, data):
    path = root / "shared/runtime.env"
    text = "\n".join([
        "RADIUS_RELEASE_VERSION=" + data["version"],
        "RADIUS_RELEASE_COMMIT=" + data["commit"],
        "RADIUS_HOST_RELEASE_ROOT=" + str(root),
        "",
    ])
    if data.get("tenantSchemaVersion"):
        text += "RADIUS_RELEASE_TENANT_SCHEMA_VERSION=" + data["tenantSchemaVersion"] + "\n"
    if data.get("tenantSchemaFingerprint"):
        text += "TENANT_SCHEMA_REFERENCE_SHA256=" + data["tenantSchemaFingerprint"] + "\n"
    path.write_text(text)
    path.chmod(0o600)


def hook(path, manifest_path, log, timeout, collect_failure=False):
    result_path = manifest_path.parent / (path.name + "-result.json")
    result_path.unlink(missing_ok=True)
    environment = {**os.environ, "RADIUS_RELEASE_MANIFEST": str(manifest_path),
                   "RADIUS_RELEASE_RESULT": str(result_path)}
    with log.open("a") as output:
        completed = subprocess.run([str(path)], env=environment, timeout=timeout,
                                   stdout=output, stderr=subprocess.STDOUT)
    if completed.returncode and not collect_failure:
        raise RuntimeError("Deployment hook failed.")
    result = json.loads(result_path.read_text())
    if completed.returncode:
        result["status"] = "failed"
    return result


def verify_release(cfg, data):
    deadline = time.monotonic() + 90
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(cfg["backendHealth"], timeout=5) as response:
                health = json.load(response)
            with urllib.request.urlopen(cfg["frontendHealth"], timeout=5) as response:
                frontend_ok = response.status == 200
            if health.get("commit") == data["commit"] and health.get("version") == data["version"] and health.get("ok") is True and frontend_ok:
                return True
        except Exception:
            pass
        time.sleep(3)
    return False


def deploy(data):
    cfg = config()
    root = pathlib.Path(cfg["root"])
    version = data["version"]
    status_path = root / "status" / (version + ".json")
    state = {**data, "status": "queued", "stages": [], "networkResults": []}
    directory = root / "releases" / version
    previous = (root / "current").resolve() if (root / "current").is_symlink() else None
    previous_data = json.loads((previous / "release.json").read_text()) if previous else {}
    log = root / "logs" / (version + ".log")
    activated = False
    migration_started = False
    backward_compatible = False
    services_stopped = False

    def stage(name):
        now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        state.update(status=name, updatedAt=now)
        state["stages"].append({"name": name, "at": now})
        atomic(status_path, state)

    try:
        stage("preflight")
        if not inspect()["ready"]:
            raise RuntimeError("Host preflight failed.")
        if previous_data and tuple(map(int, VERSION.fullmatch(version).groups())) <= tuple(map(int, VERSION.fullmatch(previous_data["version"]).groups())):
            raise RuntimeError("The version must be newer than the running version.")
        state["schemaChanges"] = sql_changes(data["commit"], previous_data.get("commit"))
        if state["schemaChanges"] and not os.access(root / "shared/hooks/migrate", os.X_OK):
            raise RuntimeError("A database migration hook is required.")
        if directory.exists():
            raise RuntimeError("Release directory already exists.")
        directory.mkdir(parents=True)
        archive = subprocess.Popen(["git", "--git-dir=" + str(REPO), "archive", data["commit"]], stdout=subprocess.PIPE)
        try:
            subprocess.run(["tar", "-x", "-C", str(directory)], stdin=archive.stdout, check=True, timeout=90)
        finally:
            archive.stdout.close()
            archive.wait(timeout=10)
        if archive.returncode:
            raise RuntimeError("Git archive failed.")
        manifest_path = directory / "release.json"
        atomic(manifest_path, {**data, "schemaChanges": state["schemaChanges"]})
        for relative, shared in [(".env", "root.env"), ("src/app/backend/.env", "backend.env"),
                                 ("src/app/backend/uploads", "uploads")]:
            destination = directory / relative
            if destination.is_symlink() or destination.is_file():
                destination.unlink()
            elif destination.is_dir():
                shutil.rmtree(destination)
            destination.symlink_to(root / "shared" / shared, target_is_directory=shared == "uploads")
        stage("build")
        with log.open("a") as output:
            for cwd, args in [
                (directory, ["npm", "ci", "--include=dev"]),
                (directory / "src/app/backend", ["npm", "ci", "--include=dev"]),
                (directory / "src/app/backend", ["npm", "run", "build"]),
                (directory, ["npm", "run", "build"]),
            ]:
                subprocess.run(args, cwd=cwd, check=True, timeout=1200, stdout=output, stderr=subprocess.STDOUT)
        stage("backup")
        if state["schemaChanges"]:
            services_stopped = True
            service("stop")
        backup = hook(root / "shared/hooks/backup", manifest_path, log, 1800)
        if backup.get("verified") is not True or not backup.get("backupId"):
            raise RuntimeError("A verified backup receipt is required.")
        state["backupId"] = backup["backupId"]
        if state["schemaChanges"]:
            stage("migrate")
            migration_started = True
            result = hook(root / "shared/hooks/migrate", manifest_path, log, 3600, collect_failure=True)
            network_results = result.get("networks", [])
            state["networkResults"] = network_results if isinstance(network_results, list) and all(isinstance(row, dict) for row in network_results) else []
            state["centralMigration"] = result.get("central")
            backward_compatible = result.get("backwardCompatible") is True
            if result.get("status") != "succeeded" or not isinstance(network_results, list) or not all(isinstance(row, dict) for row in network_results):
                raise RuntimeError("Migration did not complete.")
            if type(result.get("expectedNetworkCount")) is not int or result["expectedNetworkCount"] != len(state["networkResults"]) or len({row.get("tenantId") for row in state["networkResults"]}) != len(state["networkResults"]):
                raise RuntimeError("Migration did not complete.")
            if not isinstance(state["centralMigration"], dict) or state["centralMigration"].get("status") != "succeeded":
                raise RuntimeError("Central migration did not complete.")
            if any(row.get("status") != "succeeded" for row in state["networkResults"]):
                raise RuntimeError("Some tenant migrations did not complete.")
            schema_version = result.get("tenantSchemaVersion", "")
            fingerprint = result.get("tenantSchemaFingerprint", "")
            if not re.fullmatch(r"[a-zA-Z0-9._-]{1,64}", schema_version) or not re.fullmatch(r"[a-f0-9]{64}", fingerprint):
                raise RuntimeError("Tenant schema version and fingerprint are required.")
            if any(row.get("schemaVersion") != schema_version for row in state["networkResults"]):
                raise RuntimeError("Tenant schema results differ from the target version.")
            state["tenantSchemaVersion"] = schema_version
            state["tenantSchemaFingerprint"] = fingerprint
        stage("activate")
        activated = True
        if state.get("tenantSchemaVersion"):
            data["tenantSchemaVersion"] = state["tenantSchemaVersion"]
            data["tenantSchemaFingerprint"] = state["tenantSchemaFingerprint"]
        elif previous_data.get("tenantSchemaVersion"):
            data["tenantSchemaVersion"] = previous_data["tenantSchemaVersion"]
            data["tenantSchemaFingerprint"] = previous_data.get("tenantSchemaFingerprint")
        atomic(directory / "release.json", {**data, "schemaChanges": state["schemaChanges"]})
        switch(root, directory)
        runtime(root, data)
        service("restart")
        stage("verify")
        if not verify_release(cfg, data):
            raise RuntimeError("Release verification failed.")
        stage("succeeded")
    except Exception as error:
        state["error"] = type(error).__name__
        if previous and (activated or services_stopped) and (not migration_started or backward_compatible):
            try:
                stage("rollback")
                switch(root, previous)
                runtime(root, previous_data)
                service("restart")
                if not verify_release(cfg, previous_data):
                    raise RuntimeError("Rollback verification failed.")
                stage("failed_rolled_back")
            except Exception:
                stage("recovery_required")
        elif migration_started or services_stopped or activated:
            try:
                service("stop")
            except Exception:
                pass
            stage("recovery_required")
        else:
            stage("failed")


def worker():
    root = root_path()
    with (root / "deployment.lock").open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return
        # An interrupted deployment needs review before another job can start.
        terminal = {"succeeded", "failed", "failed_rolled_back", "recovery_required", "queued"}
        for path in (root / "status").glob("*.json"):
            current = json.loads(path.read_text())
            if current.get("status") not in terminal:
                current.update(status="recovery_required", error="WorkerInterrupted",
                               updatedAt=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))
                atomic(path, current)
        if any(json.loads(path.read_text()).get("status") == "recovery_required"
               for path in (root / "status").glob("*.json")):
            return
        for queued in sorted((root / "queue").glob("*.json"), key=lambda path: tuple(map(int, VERSION.fullmatch(path.stem).groups()))):
            data = json.loads(queued.read_text())
            if read_status(data["version"]).get("status") != "queued":
                queued.unlink()
                continue
            deploy(data)
            queued.unlink()
            if read_status(data["version"])["status"] == "recovery_required":
                break


def receive(preflight):
    for line in sys.stdin:
        old, new, reference = line.strip().split()
        if preflight and old != ZERO:
            raise ValueError("Release tags are immutable.")
        if new == ZERO:
            raise ValueError("Release tag deletion is not supported.")
        data = manifest(new, reference)
        if not preflight:
            enqueue(data)


if __name__ == "__main__":
    try:
        action = sys.argv[1]
        if action == "pre-receive":
            receive(True)
        elif action == "post-receive":
            receive(False)
        elif action == "worker":
            worker()
        elif action == "inspect":
            print(json.dumps(inspect(), ensure_ascii=False))
        elif action == "status":
            print(json.dumps(read_status(sys.argv[2]), ensure_ascii=False))
        else:
            raise ValueError("Unknown operation.")
    except Exception as error:
        print(type(error).__name__ + ": " + str(error), file=sys.stderr)
        sys.exit(1)
