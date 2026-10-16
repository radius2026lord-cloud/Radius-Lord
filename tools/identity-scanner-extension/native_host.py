#!/usr/bin/env python3
"""Chrome Native Messaging entry point for temporary Z-3052 image capture."""

import base64
from io import BytesIO
import json
import struct
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from identity_barcode_processor import scanner_connection, scanner_ids_and_models, scanner_status_value


def scanner_image_data_bytes(image_data, size):
    if isinstance(image_data, bytes):
        payload = image_data
    elif isinstance(image_data, (bytearray, memoryview)):
        payload = bytes(image_data)
    elif isinstance(image_data, str):
        payload = image_data.encode("latin-1", errors="ignore")
    else:
        try:
            payload = bytes(image_data)
        except (TypeError, ValueError):
            try:
                payload = bytes(int(value) & 0xFF for value in image_data)
            except (TypeError, ValueError):
                return b""
    return payload[:size] if size and len(payload) >= size else payload


def prepare_transport_image(image_bytes):
    from PIL import Image

    with Image.open(BytesIO(image_bytes)) as source:
        image = source.convert("RGB")
        image.thumbnail((1800, 1800), Image.Resampling.LANCZOS)
        for quality in (82, 74, 66, 58):
            output = BytesIO()
            image.save(output, format="JPEG", quality=quality, optimize=True)
            payload = output.getvalue()
            if len(payload) <= 600 * 1024:
                return payload
    raise RuntimeError("scanner_image_transport_too_large")


def capture_scanner_image(timeout_seconds=55):
    pythoncom = None
    scanner = None
    scanner_id = None
    trigger_pulled = False
    try:
        if sys.platform != "win32":
            raise RuntimeError("scanner_windows_only")
        try:
            import pythoncom
            import win32com.client
        except ImportError as exc:
            raise RuntimeError("scanner_sdk_python_missing") from exc
        pythoncom.CoInitialize()

        class ImageEvents:
            image_bytes = b""
            image_format = 1

            def OnImageEvent(self, event_type, size, image_format, image_data, scanner_data):
                if int(event_type) == 1:
                    self.image_bytes = scanner_image_data_bytes(image_data, int(size))
                    self.image_format = int(image_format)

        scanner = win32com.client.DispatchWithEvents("CoreScanner.CoreScanner", ImageEvents)
        events = scanner
        if scanner_status_value(scanner.Open(0, [1], 1)) != 0:
            return {"ok": False, "error": "scanner_sdk_open_failed"}

        scanner_ids = [0] * 255
        result = scanner.GetScanners(0, scanner_ids)
        xml_text = next((item for item in result if isinstance(item, str) and "<scanners" in item), "") if isinstance(result, (tuple, list)) else str(result)
        devices = scanner_ids_and_models(xml_text)
        if not devices:
            return {"ok": False, "error": "scanner_not_found"}
        scanner_id = devices[0]["scannerId"] or "1"

        subscribe_xml = "<inArgs><cmdArgs><arg-int>1</arg-int><arg-int>2</arg-int></cmdArgs></inArgs>"
        if scanner_status_value(scanner.ExecCommand(1001, subscribe_xml)) != 0:
            return {"ok": False, "error": "scanner_image_event_registration_failed"}
        capture_xml = f"<inArgs><scannerID>{scanner_id}</scannerID></inArgs>"
        if scanner_status_value(scanner.ExecCommand(3000, capture_xml)) != 0:
            return {"ok": False, "error": "scanner_image_capture_failed"}
        if scanner_status_value(scanner.ExecCommand(2011, capture_xml)) != 0:
            return {"ok": False, "error": "scanner_image_trigger_failed"}
        trigger_pulled = True

        deadline = time.monotonic() + timeout_seconds
        while time.monotonic() < deadline and not events.image_bytes:
            pythoncom.PumpWaitingMessages()
            time.sleep(0.01)
        if not events.image_bytes:
            return {"ok": False, "error": "scanner_image_capture_timeout"}

        image_bytes = prepare_transport_image(events.image_bytes)
        return {
            "ok": True,
            "format": "jpg",
            "mimeType": "image/jpeg",
            "imageBase64": base64.b64encode(image_bytes).decode("ascii"),
            "byteCount": len(image_bytes),
            "scannerModels": [item["model"] for item in devices],
            "storage": "memory-only",
        }
    except RuntimeError as exc:
        return {"ok": False, "error": str(exc)}
    except Exception:
        return {"ok": False, "error": "scanner_sdk_unavailable"}
    finally:
        if scanner is not None:
            if trigger_pulled and scanner_id:
                try:
                    release_xml = f"<inArgs><scannerID>{scanner_id}</scannerID></inArgs>"
                    scanner.ExecCommand(2012, release_xml)
                except Exception:
                    pass
            try:
                scanner.Close(0)
            except Exception:
                pass
        if pythoncom is not None:
            pythoncom.CoUninitialize()


def read_message():
    header = sys.stdin.buffer.read(4)
    if not header:
        return None
    if len(header) != 4:
        raise ValueError("native_message_header_invalid")
    length = struct.unpack("<I", header)[0]
    if length > 1024 * 1024:
        raise ValueError("native_message_too_large")
    payload = sys.stdin.buffer.read(length)
    if len(payload) != length:
        raise ValueError("native_message_truncated")
    return json.loads(payload.decode("utf-8"))


def write_message(result):
    payload = json.dumps(result, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    sys.stdout.buffer.write(struct.pack("<I", len(payload)))
    sys.stdout.buffer.write(payload)
    sys.stdout.buffer.flush()


def handle(message):
    if not isinstance(message, dict):
        return {"ok": False, "error": "native_message_invalid"}
    action = message.get("action")
    if action == "scanner-status":
        return scanner_connection()
    if action == "scanner-capture-image":
        return capture_scanner_image(timeout_seconds=55)
    return {"ok": False, "error": "native_action_unsupported"}


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    while True:
        try:
            message = read_message()
            if message is None:
                return
            write_message(handle(message))
        except Exception:
            write_message({"ok": False, "error": "native_host_request_failed"})


if __name__ == "__main__":
    main()
