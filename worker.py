import sys
import os
import time
import base64
import subprocess

# Modular Configuration
# PSMUX can be overridden via environment variable
PSMUX = os.environ.get("GEMINI_PSMUX_EXE", "psmux")
# SOCKET is now optional; if not provided, psmux will use default
SOCKET = os.environ.get("GEMINI_PSMUX_SOCKET")

# Log in the same directory as the script
EXT_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_FILE = os.path.join(EXT_DIR, "worker_debug.log")
LOCK_FILE = os.path.join(EXT_DIR, "worker.lock")

def log(msg):
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(f"[{time.ctime()}] {msg}\n")
    except: pass

def psmux_run(args):
    """Hidden execution of psmux with environment-aware socket."""
    cmd = [PSMUX]
    if SOCKET:
        cmd.extend(["-S", SOCKET])
    cmd.extend(args)
    
    return subprocess.run(cmd, creationflags=subprocess.CREATE_NO_WINDOW)

def main():
    if len(sys.argv) < 3: return

    # Simple File Lock
    if os.path.exists(LOCK_FILE):
        try:
            if time.time() - os.path.getmtime(LOCK_FILE) < 30:
                return
            os.remove(LOCK_FILE)
        except: pass
    
    try:
        with open(LOCK_FILE, "w") as f:
            f.write(str(os.getpid()))

        encoded_cmd = sys.argv[1]
        job_id = sys.argv[2]
        command = base64.b64decode(encoded_cmd).decode('utf-8')
        target = "gemini-cli:0.0"

        log(f"--- Worker Start: {job_id} ---")

        # 1. Wait for Gemini turn to conclude
        time.sleep(4)

        # 2. Reset the prompt
        psmux_run(["send-keys", "-t", target, "Escape", "Escape", "C-u"])
        time.sleep(0.2)
        
        # 3. Type the command
        psmux_run(["send-keys", "-t", target, "-l", command])
        time.sleep(0.2)
        
        # 4. SUBMIT
        psmux_run(["send-keys", "-t", target, "Enter"])

        # 5. Status bar notification
        time.sleep(2)
        psmux_run(["display-message", "-t", target, f"Self Command {job_id} Executed"])
        
        log(f"Worker Success: {job_id}")

    except Exception as e:
        log(f"Worker Error: {str(e)}")
    finally:
        try:
            if os.path.exists(LOCK_FILE):
                os.remove(LOCK_FILE)
        except: pass

if __name__ == "__main__":
    main()
