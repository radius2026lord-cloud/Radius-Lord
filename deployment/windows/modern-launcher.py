#!/usr/bin/env python3
"""Isolated desktop dependencies. Does not install into the project's Python/npm."""
import os
import pathlib
import subprocess
import sys
import venv

here = pathlib.Path(__file__).resolve().parent
home = pathlib.Path(os.environ.get('LOCALAPPDATA', str(pathlib.Path.home()))) / 'RadiusLord' / 'desktop-python'
python = home / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
if not python.exists():
    print('Preparing the local Radius Lord desktop environment...')
    venv.EnvBuilder(with_pip=True).create(home)
probe = subprocess.run([str(python), '-c', 'import PySide6; from PySide6.QtWebEngineWidgets import QWebEngineView'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
if probe.returncode:
    print('Installing PySide6 / Qt WebEngine once. This download may take a few minutes...')
    subprocess.run([str(python), '-m', 'pip', 'install', 'PySide6>=6.8,<7'], check=True)
raise SystemExit(subprocess.call([str(python), str(here / 'modern-console.py')]))
