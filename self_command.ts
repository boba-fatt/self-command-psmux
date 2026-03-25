/**
 * @license
 * Copyright 2026 Steven A. Thompson
 * SPDX-License-Identifier: MIT
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { spawn, spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs';

// Import shared utilities
import { isInsideTmuxSession, SESSION_NAME } from './tmux_utils.js';

const server = new McpServer({
  name: 'self-command-server',
  version: '1.1.3',
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXT_ROOT = path.dirname(__dirname);
const PYTHON_WORKER = path.join(EXT_ROOT, 'worker.py');
const DEBUG_LOG = path.join(EXT_ROOT, 'node_debug.log');

/**
 * Portable helper to find pythonw or python
 */
function getPythonExecutable(): string {
    // 1. Check if user provided a specific path via environment
    if (process.env.GEMINI_PYTHONW_PATH) return process.env.GEMINI_PYTHONW_PATH;
    
    // 2. Default to standard pythonw or python
    return process.platform === 'win32' ? 'pythonw' : 'python3';
}

function debug(msg: string) {
    try {
        fs.appendFileSync(DEBUG_LOG, `[${new Date().toISOString()}] ${msg}\n`);
    } catch(e) {}
}

function getNextId(): string {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

server.registerTool(
  'self_command',
  {
    description: 'Sends a command to the terminal via psmux.',
    inputSchema: z.object({
      command: z.string().describe('The command to send.'),
    }),
  },
  async ({ command }) => {
    debug(`self_command: ${command}`);
    if (!isInsideTmuxSession()) return { content: [{ type: 'text', text: `Error: Not in psmux.` }], isError: true };
    
    const id = getNextId();
    const encodedCommand = Buffer.from(command).toString('base64');
    const pyExe = getPythonExecutable();
    
    try {
      debug(`Spawning: ${pyExe} ${PYTHON_WORKER}`);
      spawn(pyExe, [PYTHON_WORKER, encodedCommand, id], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
        shell: true // Needed for resolving command aliases/paths
      }).unref();
    } catch (err: any) {
      debug(`Spawn failed: ${err.message}`);
      return { content: [{ type: 'text', text: `Spawn failed: ${err.message}` }], isError: true };
    }

    return { content: [{ type: 'text', text: `[${id}] Queued: "${command}"` }] };
  },
);

server.registerTool(
  'yield_turn',
  {
    description: 'Ends the turn. Required after calling self_command.',
    inputSchema: z.object({}),
  },
  async () => {
    debug('yield_turn called');
    return { content: [{ type: 'text', text: `Turn yielded.` }] };
  },
);

server.registerTool(
  'capture_pane',
  {
    description: 'Captures terminal content.',
    inputSchema: z.object({
      pane_id: z.string().optional(),
      lines: z.number().optional(),
    }),
  },
  async ({ pane_id, lines }) => {
    const target = pane_id || `${SESSION_NAME}:0.0`;
    const args = ['capture-pane', '-p', '-t', target];
    if (lines) args.push('-S', `-${lines}`);
    const res = spawnSync('psmux', args, { encoding: 'utf-8', shell: true });
    return { content: [{ type: 'text', text: res.stdout }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
