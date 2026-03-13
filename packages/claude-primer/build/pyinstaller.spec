# build/pyinstaller.spec — PyInstaller spec for claude-primer standalone binary
# Build: pyinstaller build/pyinstaller.spec --distpath build/dist --workpath build/work

import sys

a = Analysis(
    ['../python/claude_primer.py'],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=[],
    hookspath=[],
    excludes=['tkinter', 'unittest', 'email', 'html', 'http', 'xml', 'pydoc', 'doctest'],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='claude-primer',
    debug=False,
    strip=sys.platform != 'win32',
    upx=sys.platform != 'win32',
    console=True,
)
