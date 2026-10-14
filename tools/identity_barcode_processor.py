#!/usr/bin/env python3
"""Decode text emitted by a keyboard-wedge PDF417 reader for the identity demo."""

import json
import re
import sys


ARABIC_RE = re.compile(r"[\u0600-\u06ff]")
FIELD_PATTERNS = {
    "firstName": [r"^DAC([^\r\n]+)", r"(?:الاسم الأول|الاسم|given\s*name|first\s*name)\s*[:：=\-]\s*([^\r\n,;|]+)"],
    "lastName": [r"^DCS([^\r\n]+)", r"(?:الكنية|اسم العائلة|surname|family\s*name|last\s*name)\s*[:：=\-]\s*([^\r\n,;|]+)"],
    "phone": [r"(?:رقم الهاتف|الهاتف|الجوال|الموبايل|phone|mobile)\s*[:：=\-]\s*([+\d٠-٩۰-۹()\- ]{5,24})"],
    "address": [r"^DAG([^\r\n]+)", r"^DAH([^\r\n]+)", r"^DAI([^\r\n]+)", r"(?:العنوان|address)\s*[:：=\-]\s*([^\r\n;|]+)"],
}


def decode_windows_1256_segment(value):
    """Reverse the Latin-1 display layer produced by many PDF417 APIs."""
    if not value or ARABIC_RE.search(value) or any(ord(char) > 0xFF for char in value):
        return value
    try:
        raw = value.encode("latin-1")
        if not any(byte >= 0xC0 for byte in raw):
            return value
        decoded = raw.decode("cp1256", errors="replace")
    except (UnicodeEncodeError, LookupError):
        return value

    arabic_count = len(ARABIC_RE.findall(decoded))
    visible_count = sum(not char.isspace() for char in decoded)
    if arabic_count and arabic_count / max(visible_count, 1) >= 0.25:
        return decoded
    return value


def normalize_digit(value):
    output = []
    for char in value:
        code = ord(char)
        if 0x0660 <= code <= 0x0669:
            output.append(chr(code - 0x0660 + ord("0")))
        elif 0x06F0 <= code <= 0x06F9:
            output.append(chr(code - 0x06F0 + ord("0")))
        else:
            output.append(char)
    return re.sub(r"\s+", " ", "".join(output)).strip()


def is_name(value):
    value = value.strip()
    if not (1 < len(value) <= 80) or re.search(r"\d", value):
        return False
    letters = re.findall(r"[A-Za-z\u0600-\u06ff]", value)
    return len(letters) >= 2 and len(letters) / len(value) >= 0.5


def extract_fields(decoded_text, segments):
    fields = {}
    for key, patterns in FIELD_PATTERNS.items():
        matches = []
        for pattern in patterns:
            match = re.search(pattern, decoded_text, flags=re.IGNORECASE | re.MULTILINE)
            if match and match.group(1).strip():
                matches.append(normalize_digit(match.group(1).strip(" |;")))
        if matches:
            if key == "address":
                fields[key] = "، ".join(dict.fromkeys(matches))
            else:
                fields[key] = matches[0]

    if fields:
        return fields

    # This national card layout exposes given and family names as its first two
    # hash-delimited segments. Leave all later fields for visual/manual review.
    if len(segments) >= 5 and is_name(segments[0]) and is_name(segments[1]):
        fields["firstName"] = normalize_digit(segments[0])
        fields["lastName"] = normalize_digit(segments[1])
    return fields


def process(text):
    segments = [decode_windows_1256_segment(segment.strip()) for segment in text.split("#")]
    decoded_text = "#".join(segments)
    return {
        "ok": True,
        "decodedText": decoded_text,
        "segments": segments,
        "fields": extract_fields(decoded_text, segments),
        "storage": "memory-only",
    }


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    if "--health" in sys.argv[1:]:
        print(json.dumps({"ok": True, "engine": "python-windows-1256", "storage": "memory-only"}, ensure_ascii=False))
        return

    try:
        payload = json.loads(sys.stdin.buffer.read().decode("utf-8"))
        text = payload.get("text", "") if isinstance(payload, dict) else ""
        if not isinstance(text, str):
            raise ValueError("text must be a string")
        print(json.dumps(process(text), ensure_ascii=False))
    except Exception:
        print(json.dumps({"ok": False, "error": "invalid_payload"}))
        sys.exit(1)


if __name__ == "__main__":
    main()
