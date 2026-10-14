#!/usr/bin/env python3
"""Read identity PDF417 images and parse their bytes for the local demo."""

import base64
from io import BytesIO
import json
import re
import sys


ARABIC_RE = re.compile(r"[\u0600-\u06ff]")
FIELD_LABELS = ["الحقل 1", "الحقل 2", "الحقل 3", "الحقل 4", "الحقل 5", "الحقل 6"]
FIELD_PATTERNS = {
    "firstName": [r"^DAC([^\r\n]+)", r"(?:الاسم الأول|الاسم|given\s*name|first\s*name)\s*[:：=\-]\s*([^\r\n,;|]+)"],
    "lastName": [r"^DCS([^\r\n]+)", r"(?:الكنية|اسم العائلة|surname|family\s*name|last\s*name)\s*[:：=\-]\s*([^\r\n,;|]+)"],
    "phone": [r"(?:رقم الهاتف|الهاتف|الجوال|الموبايل|phone|mobile)\s*[:：=\-]\s*([+\d٠-٩۰-۹()\- ]{5,24})"],
    "address": [r"^DAG([^\r\n]+)", r"^DAH([^\r\n]+)", r"^DAI([^\r\n]+)", r"(?:العنوان|address)\s*[:：=\-]\s*([^\r\n;|]+)"],
}


def import_image_dependencies():
    import zxingcpp
    from PIL import Image, ImageOps

    try:
        from pillow_heif import register_heif_opener
        register_heif_opener()
    except ImportError:
        pass
    return zxingcpp, Image, ImageOps


def decode_bytes(raw):
    segments = [part.decode("cp1256", errors="replace").strip("\x00\r\n\t ") for part in raw.split(b"#")]
    fields = [{"label": label, "value": value} for label, value in zip(FIELD_LABELS, segments[:6]) if value]
    values = {}
    if len(segments) >= 2:
        if is_name(segments[0]):
            values["firstName"] = segments[0]
        if is_name(segments[1]):
            values["lastName"] = segments[1]
    decoded_text = "#".join(segments[:6])
    return decoded_text, fields, values, len(raw)


def decode_text_segment(value):
    if not value:
        return b""
    if ARABIC_RE.search(value):
        return value.encode("cp1256", errors="replace")
    if all(ord(char) <= 0xFF for char in value):
        return value.encode("latin-1")
    return value.encode("utf-8")


def text_to_bytes(text):
    return b"#".join(decode_text_segment(segment) for segment in text.split("#"))


def is_name(value):
    value = value.strip()
    if not (1 < len(value) <= 80) or re.search(r"\d", value):
        return False
    letters = re.findall(r"[A-Za-z\u0600-\u06ff]", value)
    return len(letters) >= 2 and len(letters) / len(value) >= 0.5


def extract_labeled_fields(text):
    fields = {}
    for key, patterns in FIELD_PATTERNS.items():
        matches = []
        for pattern in patterns:
            match = re.search(pattern, text, flags=re.IGNORECASE | re.MULTILINE)
            if match and match.group(1).strip():
                matches.append(re.sub(r"\s+", " ", match.group(1).strip(" |;")))
        if matches:
            fields[key] = "، ".join(dict.fromkeys(matches)) if key == "address" else matches[0]
    return fields


def decode_images(images):
    try:
        zxingcpp, image_module, image_ops = import_image_dependencies()
    except ImportError:
        return {"ok": False, "error": "python_dependencies_missing"}

    for image_data in images:
        try:
            raw_image = base64.b64decode(image_data, validate=True)
            with image_module.open(BytesIO(raw_image)) as source_image:
                image = image_ops.exif_transpose(source_image).convert("RGB")
                barcodes = zxingcpp.read_barcodes(
                    image,
                    formats=zxingcpp.BarcodeFormat.PDF417,
                    try_rotate=True,
                    try_downscale=True,
                    try_invert=True,
                )
                for barcode in barcodes:
                    payload = bytes(barcode.bytes)
                    if payload:
                        decoded, identity_fields, fields, byte_count = decode_bytes(payload)
                        return {
                            "ok": True,
                            "found": True,
                            "format": "PDF417",
                            "byteCount": byte_count,
                            "decodedText": decoded,
                            "identityFields": identity_fields,
                            "fields": fields,
                            "storage": "memory-only",
                        }
        except Exception:
            continue

    return {
        "ok": True,
        "found": False,
        "format": "PDF417",
        "decodedText": "",
        "identityFields": [],
        "fields": {},
        "storage": "memory-only",
    }


def process_text(text):
    payload = text_to_bytes(text)
    decoded, identity_fields, fields, byte_count = decode_bytes(payload)
    if not fields:
        fields = extract_labeled_fields(decoded)
    return {
        "ok": True,
        "found": bool(decoded),
        "format": "keyboard-wedge",
        "byteCount": byte_count,
        "decodedText": decoded,
        "identityFields": identity_fields,
        "fields": fields,
        "storage": "memory-only",
    }


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    if "--health" in sys.argv[1:]:
        try:
            import_image_dependencies()
            print(json.dumps({"ok": True, "engine": "python-zxing-cpp-pdf417", "storage": "memory-only"}, ensure_ascii=False))
        except ImportError:
            print(json.dumps({"ok": False, "error": "python_dependencies_missing"}, ensure_ascii=False))
        return

    try:
        payload = json.loads(sys.stdin.buffer.read().decode("utf-8"))
        if not isinstance(payload, dict):
            raise ValueError("request must be an object")
        images = payload.get("images") or []
        if images:
            if not isinstance(images, list) or len(images) > 2 or not all(isinstance(item, str) for item in images):
                raise ValueError("images must contain at most two encoded images")
            result = decode_images(images)
            print(json.dumps(result, ensure_ascii=False))
            return

        text = payload.get("text", "")
        if not isinstance(text, str):
            raise ValueError("text must be a string")
        print(json.dumps(process_text(text), ensure_ascii=False))
    except Exception:
        print(json.dumps({"ok": False, "error": "invalid_payload"}))
        sys.exit(1)


if __name__ == "__main__":
    main()
