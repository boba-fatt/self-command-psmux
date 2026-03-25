/**
 * @license
 * Copyright 2026 Steven A. Thompson
 * SPDX-License-Identifier: MIT
 */

import { spawnSync } from 'child_process';
import { SESSION_NAME, waitForStability, sendNotification } from './tmux_utils.js';
import { FileLock } from './file_lock.js';

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) process.exit(1);

  const encodedCommand = args[0];
  const command = Buffer.from(encodedCommand, 'base64').toString('utf-8');
  const id = args[1] || '????';

  const lock = new FileLock('gemini_psmux_input', 500, 1200);
  if (!await lock.acquire()) process.exit(1);

  try {
    const target = `${SESSION_NAME}:0.0`;
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    await delay(1000);
    await waitForStability(target, 2000, 500, 10000);

    // 1. Reset state (Escape, Clear Line)
    spawnSync('psmux', ['send-keys', '-t', target, 'Escape', 'C-u'], { windowsHide: true });
    await delay(200);

    // 2. Type literally
    spawnSync('psmux', ['send-keys', '-t', target, '-l', command], { windowsHide: true });
    await delay(200);

    // 3. Submit
    spawnSync('psmux', ['send-keys', '-t', target, 'Enter'], { windowsHide: true });
    await delay(500);
    
    // 4. Monitor completion
    await waitForStability(target, 2000, 500, 30000); 

    // 5. Notify
    await sendNotification(target, `[${id}] Self Command Complete`, true);
    
  } catch (error: any) {
    // Silent fail to avoid loops
  } finally {
    try { lock.release(); } catch (e) {}
    process.exit(0);
  }
}

main();
