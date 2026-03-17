# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['api.py'],
    pathex=[],
    binaries=[],
    datas=[('index.html', '.'), ('styles.css', '.'), ('ui-controller.js', '.'), ('geometry-engine.js', '.'), ('rule-engine.js', '.'), ('authorities-data.js', '.'), ('smart-dimension-engine.js', '.'), ('dxf-exporter.js', '.'), ('zoning-engine.js', '.'), ('rules-data.js', '.'), ('residential_zoning_rules.js', '.'), ('Rule_Engine_Implementation.js', '.'), ('residential_zoning_rules.json', '.')],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='ArchitectOS-Dashboard',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
