import os
import subprocess
import sys

def build():
    print("Building ArchitectOS Executable...")
    
    # 1. Install PyInstaller if missing
    try:
        import PyInstaller
    except ImportError:
        print("Installing PyInstaller...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])

    # 2. Build command
    # --onefile: single .exe
    # --add-data: include HTML/JS/CSS files
    # --name: output filename
    # --hidden-import: ensure FastAPI and other dynamic imports are included
    
    cmd = [
        "pyinstaller",
        "--noconfirm",
        "--onefile",
        "--console", 
        "--name", "ArchitectOS-Dashboard",
        "--add-data", "index.html;.",
        "--add-data", "styles.css;.",
        "--add-data", "ui-controller.js;.",
        "--add-data", "geometry-engine.js;.",
        "--add-data", "rule-engine.js;.",
        "--add-data", "authorities-data.js;.",
        "--add-data", "smart-dimension-engine.js;.",
        "--add-data", "dxf-exporter.js;.",
        "--add-data", "zoning-engine.js;.",
        "--add-data", "rules-data.js;.",
        "--add-data", "residential_zoning_rules.js;.",
        "--add-data", "Rule_Engine_Implementation.js;.",
        "--add-data", "residential_zoning_rules.json;.",
        "api.py"
    ]
    
    print(f"Running: {' '.join(cmd)}")
    subprocess.check_call(cmd)
    
    print("\n" + "="*60)
    print("BUILD COMPLETE!")
    print("Your executable is located in the 'dist' folder:")
    print(f"{os.path.join(os.getcwd(), 'dist', 'ArchitectOS-Dashboard.exe')}")
    print("="*60)

if __name__ == "__main__":
    build()
