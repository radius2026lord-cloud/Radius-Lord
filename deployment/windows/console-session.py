#!/usr/bin/env python3
"""Interactive OpenSSH child with real Windows console handles; no secrets in payload."""
import base64
import json
import os
import subprocess
import sys

if __name__ == '__main__':
    args = json.loads(base64.urlsafe_b64decode(sys.argv[1]).decode('utf-8'))
    if not isinstance(args, list) or not args or not all(isinstance(x, str) for x in args):
        raise SystemExit('Invalid command')
    if os.name == 'nt':
        sys.stdin = open('CONIN$', 'r')
        sys.stdout = open('CONOUT$', 'w', buffering=1)
        sys.stderr = sys.stdout
    try:
        code = subprocess.call(args, stdin=sys.stdin, stdout=sys.stdout, stderr=sys.stderr)
        print('\nExit code:', code)
    except Exception as error:
        print(str(error))
        code = 1
    input('Press Enter to close...')
    sys.exit(code)
