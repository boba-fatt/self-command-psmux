/**
 * @license
 * Copyright 2026 Steven A. Thompson
 * SPDX-License-Identifier: MIT
 */

import { execSync, spawnSync } from 'child_process';
import { FileLock } from './file_lock.js';

export const SESSION_NAME = process.env.GEMINI_TMUX_SESSION_NAME || 'gemini-cli';

/**
 * Checks if the current environment is running inside the 'gemini-cli' psmux session.
 */
export function isInsideTmuxSession(): boolean {
  if (!process.env.TMUX) {
    return false;
  }

  try {
    const currentSessionName = execSync('psmux display-message -p "#S"', { encoding: 'utf-8' }).trim();
    return currentSessionName === SESSION_NAME;
  } catch (error) {
    return false;
  }
}

/**
 * Waits for the psmux pane to become stable.
 */
export async function waitForStability(target: string, stableDurationMs: number = 2000, pollingIntervalMs: number = 500, timeoutMs: number = 30000): Promise<boolean> {
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    const requiredChecks = Math.ceil(stableDurationMs / pollingIntervalMs);
    
    let lastContent = '';
    let stableChecks = 0;
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
        await delay(pollingIntervalMs);
        
        let currentContent = '';
        try {
            const textContent = execSync(`psmux capture-pane -p -t ${target}`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
            const cursorPosition = execSync(`psmux display-message -p -t ${target} "#{cursor_x},#{cursor_y}"`, { encoding: 'utf-8' }).trim();
            currentContent = `${textContent}\n__CURSOR__:${cursorPosition}`;
        } catch (e) {
            continue;
        }

        if (currentContent === lastContent) {
            stableChecks++;
        } else {
            stableChecks = 0;
            lastContent = currentContent;
        }

        if (stableChecks >= requiredChecks) {
            return true;
        }
    }
    return false;
}

/**
 * Sends a notification to the psmux pane.
 */
export async function sendNotification(target: string, message: string, skipStabilityCheck: boolean = false) {
    const lock = new FileLock('gemini-tmux-notification', 500, 1200); 
    
    if (await lock.acquire()) {
        try {
            const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
            if (!skipStabilityCheck) {
                await waitForStability(target, 2000, 500, 10000);
            }

            // Clear line and type notification
            spawnSync('psmux', ['send-keys', '-t', target, 'Escape', 'C-u']);
            await delay(200);

            // Send message literally to avoid quoting issues
            spawnSync('psmux', ['send-keys', '-t', target, '-l', message]);
            await delay(100);
            spawnSync('psmux', ['send-keys', '-t', target, 'Enter']);
            
        } finally {
            lock.release();
        }
    }
}

/**
 * Sends keys to a specific psmux target.
 */
export function sendKeys(target: string, keys: string) {
    // Use spawnSync with array to avoid shell quoting issues on Windows
    // We split keys by space to handle things like "ls Enter"
    const keyParts = keys.split(' ');
    spawnSync('psmux', ['send-keys', '-t', target, ...keyParts]);
}

/**
 * Captures the content of a psmux pane.
 */
export function capturePane(target: string, lines?: number): string {
    let args = ['capture-pane', '-p', '-t', target];
    if (lines) {
        args.push('-S', `-${lines}`);
    }
    const result = spawnSync('psmux', args, { encoding: 'utf-8' });
    return result.stdout;
}

/**
 * Splits the window.
 */
export function splitWindow(command?: string, direction: 'vertical' | 'horizontal' = 'vertical'): string {
    let args = ['split-window', '-P', '-F', '#{pane_id}'];
    if (direction === 'horizontal') {
        args.push('-h');
    } else {
        args.push('-v');
    }
    
    if (command) {
        args.push(command);
    }

    const result = spawnSync('psmux', args, { encoding: 'utf-8' });
    return result.stdout.trim();
}

/**
 * Kills a specific psmux pane.
 */
export function killPane(target: string) {
    spawnSync('psmux', ['kill-pane', '-t', target]);
}
