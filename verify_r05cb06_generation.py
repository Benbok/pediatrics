#!/usr/bin/env python3
"""
Direct execution of R05CB06 generator with file verification
"""
import os
import sys
import subprocess

# Set working directory
os.chdir(r"C:\Users\Arty\Desktop\Django\pediatrics")

# Execute generator
print("=" * 60)
print("Executing: python scripts/generate_r05cb06_jsons.py")
print("=" * 60)

try:
    result = subprocess.run(
        [sys.executable, "scripts/generate_r05cb06_jsons.py"],
        capture_output=True,
        text=True,
        cwd=r"C:\Users\Arty\Desktop\Django\pediatrics"
    )
    
    print("STDOUT:")
    print(result.stdout if result.stdout else "(empty)")
    print("\nSTDERR:")
    print(result.stderr if result.stderr else "(empty)")
    print(f"\nReturn Code: {result.returncode}")
    
    # Verify output directory
    out_dir = r"C:\Users\Arty\Desktop\Django\pediatrics\src\modules\medications\data\r05cb06"
    print(f"\n{'-'*60}")
    print(f"Directory exists: {out_dir}")
    print(f"Exists: {os.path.exists(out_dir)}")
    
    if os.path.exists(out_dir):
        files = os.listdir(out_dir)
        print(f"Files: {len(files)} total")
        for f in files[:10]:
            print(f"  - {f}")
    else:
        print("Directory NOT created!")
        
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 60)
print("Done!")
