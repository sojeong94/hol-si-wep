"""
Holsi Silo Launcher
"""
import subprocess
import time

NAVER_DIR = r"C:\Users\회의실용1\OneDrive\바탕 화면\naver (2)\naver"
SNS_DIR   = r"C:\user1\2.hol-si-web-ver"

print("==========================================")
print("  Holsi Silo Launch!")
print("==========================================")
print()

print("[1/2] Naver Bot starting...")
subprocess.Popen(
    ["cmd", "/k", "chcp 65001 > nul && python main.py"],
    cwd=NAVER_DIR,
    creationflags=subprocess.CREATE_NEW_CONSOLE,
)

time.sleep(3)

print("[2/2] SNS automation starting...")
subprocess.Popen(
    ["cmd", "/k", "chcp 65001 > nul && npm run automate schedule"],
    cwd=SNS_DIR,
    creationflags=subprocess.CREATE_NEW_CONSOLE,
)

print()
print("Done! Check the two new windows.")
time.sleep(3)
