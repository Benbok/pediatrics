import subprocess
import sys

result = subprocess.run(
    [sys.executable, "scripts/generate_r05cb06_jsons.py"],
    cwd="C:\\Users\\Arty\\Desktop\\Django\\pediatrics",
    capture_output=True,
    text=True
)

print("STDOUT:", result.stdout)
print("STDERR:", result.stderr)
print("RETURNCODE:", result.returncode)

import os
out_dir = "C:\\Users\\Arty\\Desktop\\Django\\pediatrics\\src\\modules\\medications\\data\\r05cb06"
if os.path.exists(out_dir):
    files = os.listdir(out_dir)
    print(f"Files in {out_dir}: {files}")
else:
    print(f"Directory does not exist: {out_dir}")
