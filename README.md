# self-command-psmux

This is a Windows-native fork of the self-command project originally created by Steven A. Thompson. The original was built for Linux environments using Bash and tmux; I have refactored the core logic to work seamlessly in PowerShell using psmux.

The goal of this extension is to give the Gemini CLI the ability to interact with its own terminal session. It allows the agent to programmatically type commands, manage background tasks, and monitor logs without leaving the current session.

## Why this fork exists

Running the original project on Windows through WSL or standard tmux is often buggy and results in encoding issues or constant terminal popups. This version is built specifically for the Windows/PowerShell stack and uses psmux to handle session multiplexing.

### Key Changes
- Multiplexer: Uses psmux instead of tmux.
- Environment: Built for PowerShell (pwsh) instead of Bash.
- Stability: Uses a windowless Python worker (pythonw.exe) to handle background keystrokes. This prevents the "terminal flash" or "disco seizure" effect when the agent is typing to itself.
- Portability: Dynamic path discovery via a batch wrapper.

## Setup

### Requirements
- Gemini CLI installed and configured.
- psmux installed (cargo install psmux).
- Python installed in your system PATH.

### Installation
Clone the repo and install it as a Gemini extension:
```powershell
gemini extensions install C:\path\to\self-command-psmux --consent
```

### Build
Standard TypeScript build process:
```powershell
cd self-command-psmux
npm install
npm run build
```

## Usage

### Starting a Session
Always launch using the provided batch file. It automatically discovers your Gemini path, Python executable, and psmux socket to ensure everything is mapped correctly:
```powershell
.\gemini_psmux.bat
```
This command starts Gemini in YOLO mode inside a psmux session named "gemini-cli".

### Core Tools
- self_command: Physically types a command into your prompt after you yield your turn.
- yield_turn: Required call after using self_command to allow the worker to take over the keyboard.
- capture_pane: Returns the current text content of the terminal window.
- gemini_sleep: Pauses execution for a set duration.             
- watch_log: Wakes Gemini when a specific log pattern is matched.
- run_long_command: Runs a task in the background and sends a notification to the psmux status bar when finished.

## The Logic

Unlike the original which used shell scripts, this fork uses a background Python worker (worker.py). When a command is queued:
1. Gemini yields its turn.
2. A windowless Python process (pythonw.exe) starts.
3. It waits for the prompt to be ready, clears any partial input, and types your command literally into the terminal.
4. It uses the psmux "display-message" function to notify you of completion, which prevents the AI from getting stuck in a response loop.

## Credits
*   **Original Creator:** [Steven A. Thompson](https://github.com/stevenAthompson) for the brilliant "Self-Command" architecture and original TypeScript logic.
*   **Refactor:** [boba-fatt](https://github.com/boba-fatt) for the Windows/psmux implementation.                                                              
