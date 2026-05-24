import * as vscode from 'vscode';
import * as fs from 'fs';
import * as nodePath from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function executeTool(name: string, args: Record<string, any>, cwd: string): Promise<string> {
    switch (name) {
        case 'bash': {
            const { command } = args;
            try {
                const { stdout, stderr } = await execAsync(command, { cwd, timeout: 30000 });
                let out = stdout;
                if (stderr) { out += (out ? '\n' : '') + stderr; }
                return out || '(no output)';
            } catch (e: any) {
                let out = e.stdout || '';
                if (e.stderr) { out += (out ? '\n' : '') + e.stderr; }
                return out || e.message;
            }
        }

        case 'read': {
            const { path: filePath, offset = 0, limit = 2000 } = args;
            const resolved = nodePath.isAbsolute(filePath) ? filePath : nodePath.join(cwd, filePath);
            const content = fs.readFileSync(resolved, 'utf-8');
            const lines = content.split('\n');
            const slice = lines.slice(offset, offset + limit);
            return slice.map((line: string, i: number) => `${offset + i + 1}\t${line}`).join('\n');
        }

        case 'write': {
            const { path: filePath, content } = args;
            const resolved = nodePath.isAbsolute(filePath) ? filePath : nodePath.join(cwd, filePath);
            fs.mkdirSync(nodePath.dirname(resolved), { recursive: true });
            fs.writeFileSync(resolved, content, 'utf-8');
            return `Written: ${resolved}`;
        }

        case 'edit': {
            const { path: filePath, old_string, new_string, replace_all = false } = args;
            const resolved = nodePath.isAbsolute(filePath) ? filePath : nodePath.join(cwd, filePath);
            let content = fs.readFileSync(resolved, 'utf-8');
            if (!content.includes(old_string)) { return `Error: string not found in ${resolved}`; }
            content = replace_all ? content.split(old_string).join(new_string) : content.replace(old_string, new_string);
            fs.writeFileSync(resolved, content, 'utf-8');
            return `Edited: ${resolved}`;
        }

        case 'grep': {
            const { pattern, path: searchPath, recursive = true, case_sensitive = true } = args;
            const resolved = nodePath.isAbsolute(searchPath) ? searchPath : nodePath.join(cwd, searchPath);
            let regex: RegExp;
            try { regex = new RegExp(pattern, case_sensitive ? 'g' : 'gi'); }
            catch { return `Error: invalid regex pattern: ${pattern}`; }
            const results: string[] = [];
            const searchFile = (fp: string) => {
                try {
                    fs.readFileSync(fp, 'utf-8').split('\n').forEach((line: string, i: number) => {
                        if (regex.test(line)) { results.push(`${fp}:${i + 1}:${line.trim()}`); }
                    });
                } catch {}
            };
            const searchDir = (dir: string) => {
                try {
                    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                        if (entry.name.startsWith('.') || ['node_modules', '__pycache__', '.git'].includes(entry.name)) { continue; }
                        const full = nodePath.join(dir, entry.name);
                        if (entry.isDirectory() && recursive) { searchDir(full); }
                        else if (entry.isFile()) { searchFile(full); }
                    }
                } catch {}
            };
            try { fs.statSync(resolved).isDirectory() ? searchDir(resolved) : searchFile(resolved); }
            catch (e: any) { return `Error: ${e.message}`; }
            return results.length ? results.slice(0, 500).join('\n') : 'No matches found';
        }

        case 'ls': {
            const { path: dirPath, recursive = false } = args;
            const resolved = nodePath.isAbsolute(dirPath) ? dirPath : nodePath.join(cwd, dirPath);
            const results: string[] = [];
            const listDir = (dir: string, depth: number) => {
                try {
                    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                        if (entry.name.startsWith('.') || ['node_modules', '__pycache__', '.git'].includes(entry.name)) { continue; }
                        results.push(`${'  '.repeat(depth)}${entry.isDirectory() ? '[dir] ' : '      '}${entry.name}`);
                        if (entry.isDirectory() && recursive) { listDir(nodePath.join(dir, entry.name), depth + 1); }
                    }
                } catch {}
            };
            listDir(resolved, 0);
            return results.length ? results.join('\n') : '(empty)';
        }

        case 'find': {
            const { path: searchPath, pattern, recursive = true } = args;
            const resolved = nodePath.isAbsolute(searchPath) ? searchPath : nodePath.join(cwd, searchPath);
            const rx = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
            const results: string[] = [];
            const walk = (dir: string) => {
                try {
                    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                        if (entry.name.startsWith('.') || ['node_modules', '__pycache__', '.git'].includes(entry.name)) { continue; }
                        const full = nodePath.join(dir, entry.name);
                        if (entry.isDirectory() && recursive) { walk(full); }
                        else if (entry.isFile() && rx.test(entry.name)) { results.push(full); }
                    }
                } catch {}
            };
            walk(resolved);
            results.sort();
            return results.length
                ? results.slice(0, 200).join('\n') + (results.length > 200 ? `\n... (${results.length - 200} more)` : '')
                : `No files matching '${pattern}' found`;
        }

        case 'ask_user': {
            const answer = await vscode.window.showInputBox({
                prompt: args.question,
                placeHolder: 'Your answer…',
                ignoreFocusOut: true,
            });
            return answer ?? 'User cancelled';
        }

        default:
            return `Error: unknown tool '${name}'`;
    }
}

export class PiSidebarProvider implements vscode.WebviewViewProvider {
    _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(webviewView: vscode.WebviewView) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };
        const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview, cwd);

        webviewView.webview.onDidReceiveMessage(async (data) => {
            if (data.type === 'execute_tool') {
                const { id, name, args, cwd: toolCwd } = data;
                try {
                    const result = await executeTool(name, args, toolCwd || cwd);
                    webviewView.webview.postMessage({ type: 'tool_done', id, result });
                } catch (e: any) {
                    webviewView.webview.postMessage({ type: 'tool_done', id, result: `Error: ${e.message}` });
                }
            }
        });
    }

    private _getHtmlForWebview(_webview: vscode.Webview, cwd: string = ''): string {
        return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline' https://cdn.jsdelivr.net; connect-src ws://localhost:8001;">
<title>Pi</title>
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
    font-family: var(--vscode-font-family);
    font-size: 13px;
    color: var(--vscode-editor-foreground);
    background: var(--vscode-editor-background);
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
}

/* ── Status bar ── */
#status-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-bottom: 1px solid var(--vscode-panel-border);
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    min-height: 24px;
    flex-shrink: 0;
}
#status-dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    background: #777;
    flex-shrink: 0;
    transition: background 0.3s;
}
#status-dot.connected { background: #4ec94e; }
#status-dot.error     { background: #e05252; }

/* ── Chat area ── */
#chat-box {
    flex: 1;
    overflow-y: auto;
    padding: 14px 10px 6px;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

/* ── Message rows ── */
.msg-row { display: flex; flex-direction: column; }
.msg-row.user { align-items: flex-end; }
.msg-row.pi   { align-items: flex-start; }

.bubble {
    max-width: 88%;
    padding: 9px 13px;
    border-radius: 14px;
    line-height: 1.55;
    word-break: break-word;
    font-size: 13px;
}
.bubble.user {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border-bottom-right-radius: 4px;
}
.bubble.pi {
    background: var(--vscode-editorWidget-background);
    border: 1px solid var(--vscode-panel-border);
    border-bottom-left-radius: 4px;
}

/* Markdown inside Pi bubble */
.bubble.pi p { margin: 0 0 6px; }
.bubble.pi p:last-child { margin: 0; }
.bubble.pi pre {
    background: var(--vscode-textCodeBlock-background);
    padding: 8px 10px;
    border-radius: 5px;
    overflow-x: auto;
    margin: 6px 0;
    font-size: 11.5px;
    font-family: var(--vscode-editor-font-family);
}
.bubble.pi code {
    background: var(--vscode-textCodeBlock-background);
    padding: 1px 5px;
    border-radius: 3px;
    font-size: 11.5px;
    font-family: var(--vscode-editor-font-family);
}
.bubble.pi ul, .bubble.pi ol { padding-left: 18px; margin: 4px 0; }
.bubble.pi h1, .bubble.pi h2, .bubble.pi h3 { margin: 8px 0 4px; font-size: 1em; }
.bubble.pi table { border-collapse: collapse; margin: 6px 0; font-size: 12px; }
.bubble.pi th, .bubble.pi td { border: 1px solid var(--vscode-panel-border); padding: 4px 8px; }

/* Typing dots */
.pi-dots {
    display: inline-flex;
    gap: 4px;
    padding: 10px 14px;
    background: var(--vscode-editorWidget-background);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 14px;
    border-bottom-left-radius: 4px;
    align-self: flex-start;
}
.pi-dots span {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--vscode-descriptionForeground);
    animation: dotbounce 1.3s infinite;
}
.pi-dots span:nth-child(2) { animation-delay: 0.18s; }
.pi-dots span:nth-child(3) { animation-delay: 0.36s; }
@keyframes dotbounce {
    0%, 80%, 100% { transform: scale(0.55); opacity: 0.35; }
    40%            { transform: scale(1);    opacity: 1;    }
}

/* ── Working block (Codex-style collapsible) ── */
.working-block {
    align-self: flex-start;
    max-width: 96%;
    border: 1px solid var(--vscode-panel-border);
    border-radius: 10px;
    overflow: hidden;
    font-size: 12px;
}
.working-header {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 7px 11px;
    background: var(--vscode-editorGroupHeader-tabsBackground);
    cursor: pointer;
    user-select: none;
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
}
.working-header:hover { background: var(--vscode-list-hoverBackground); }
.w-spin {
    display: inline-block;
    animation: wspin 0.9s linear infinite;
    font-size: 13px;
}
@keyframes wspin { to { transform: rotate(360deg); } }
.w-elapsed { flex: 1; }
.w-chevron { font-size: 10px; transition: transform 0.15s; }
.w-chevron.open { transform: rotate(180deg); }

.working-steps {
    display: none;
    flex-direction: column;
    background: var(--vscode-editor-background);
}
.working-steps.open { display: flex; }

.step-item {
    display: flex;
    align-items: baseline;
    gap: 7px;
    padding: 5px 12px;
    border-top: 1px solid var(--vscode-panel-border);
    font-size: 11.5px;
    color: var(--vscode-editor-foreground);
}
.step-icon {
    flex-shrink: 0;
    width: 14px;
    text-align: center;
    font-size: 12px;
}
.step-icon.running { animation: wspin 0.9s linear infinite; }
.step-name {
    font-weight: 600;
    color: var(--vscode-textLink-foreground);
    margin-right: 3px;
}
.step-label {
    color: var(--vscode-descriptionForeground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 220px;
}
.step-time {
    font-size: 10.5px;
    color: var(--vscode-descriptionForeground);
    margin-left: auto;
    flex-shrink: 0;
    opacity: 0.7;
}
.step-output {
    padding: 3px 12px 5px 33px;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    font-family: var(--vscode-editor-font-family);
    white-space: pre-wrap;
    word-break: break-all;
    border-top: 1px solid var(--vscode-panel-border);
    max-height: 80px;
    overflow-y: auto;
    opacity: 0.75;
}

/* ── Images ── */
.msg-image {
    max-width: 100%;
    max-height: 220px;
    border-radius: 7px;
    margin-top: 6px;
    display: block;
    cursor: pointer;
}
.img-thumb {
    height: 60px;
    border-radius: 5px;
    border: 1px solid var(--vscode-panel-border);
    cursor: pointer;
}
.attachment-wrap { position: relative; display: inline-block; }
.attachment-remove {
    position: absolute; top: -5px; right: -5px;
    width: 15px; height: 15px;
    border-radius: 50%;
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
    border: none; cursor: pointer;
    font-size: 9px;
    display: flex; align-items: center; justify-content: center;
    line-height: 1;
}

/* Image modal */
#img-modal {
    display: none; position: fixed; inset: 0;
    background: rgba(0,0,0,0.82);
    z-index: 9999;
    justify-content: center; align-items: center;
}
#img-modal.open { display: flex; }
#img-modal img { max-width: 92%; max-height: 92%; border-radius: 8px; object-fit: contain; }

/* ── Command dropdown ── */
#cmd-dropdown {
    display: none;
    position: absolute;
    bottom: calc(100% + 4px);
    left: 0; right: 0;
    background: var(--vscode-dropdown-background);
    border: 1px solid var(--vscode-dropdown-border);
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 -6px 16px rgba(0,0,0,0.35);
    z-index: 150;
    max-height: 240px;
    overflow-y: auto;
}
#cmd-dropdown.open { display: block; }
.cmd-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    cursor: pointer;
    border-bottom: 1px solid var(--vscode-panel-border);
}
.cmd-item:last-child { border-bottom: none; }
.cmd-item:hover, .cmd-item.active { background: var(--vscode-list-hoverBackground); }
.cmd-item-name {
    font-weight: 600;
    color: var(--vscode-textLink-foreground);
    min-width: 88px;
    font-size: 12.5px;
}
.cmd-item-desc {
    font-size: 11.5px;
    color: var(--vscode-descriptionForeground);
}

/* ── System note (slash command response in chat) ── */
.system-note {
    align-self: center;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    padding: 1px 6px;
    text-align: center;
}

/* ── Input area ── */
.input-area {
    border-top: 1px solid var(--vscode-panel-border);
    padding: 8px;
    position: relative;
    flex-shrink: 0;
}
#attachments-bar {
    display: flex; flex-wrap: wrap; gap: 6px; padding: 0 0 6px;
}
#msg-input {
    width: 100%;
    padding: 8px 11px;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent);
    border-radius: 7px;
    font-family: inherit;
    font-size: 13px;
    outline: none;
    resize: none;
    min-height: 36px;
    max-height: 130px;
    overflow-y: auto;
    line-height: 1.4;
}
#msg-input:focus { border-color: var(--vscode-focusBorder); }
#msg-input::placeholder { color: var(--vscode-input-placeholderForeground); }

/* Toast */
#toast {
    position: absolute;
    bottom: calc(100% + 5px);
    left: 8px; right: 8px;
    background: var(--vscode-editorWidget-background);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 6px;
    padding: 6px 12px;
    font-size: 12px;
    color: var(--vscode-editor-foreground);
    text-align: center;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease;
    z-index: 200;
}
#toast.visible { opacity: 1; }
</style>
</head>
<body>

<div id="status-bar">
    <div id="status-dot"></div>
    <span id="status-text">Connecting…</span>
</div>

<div id="chat-box"></div>

<div id="img-modal">
    <img id="modal-img" src="" alt="">
</div>

<div class="input-area">
    <div id="attachments-bar"></div>
    <div id="cmd-dropdown"></div>
    <textarea id="msg-input" rows="1" placeholder="Ask Pi… (type / for commands)"></textarea>
    <div id="toast"></div>
</div>

<script>
const WORKSPACE_CWD = ${JSON.stringify(cwd)};
const vscode = acquireVsCodeApi();
const chatBox    = document.getElementById('chat-box');
const msgInput   = document.getElementById('msg-input');
const attBar     = document.getElementById('attachments-bar');
const statusDot  = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const imgModal   = document.getElementById('img-modal');
const modalImg   = document.getElementById('modal-img');
const toastEl    = document.getElementById('toast');

let ws            = null;
let pendingImages = [];

// ── Toast ────────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
    if (toastTimer) clearTimeout(toastTimer);
    toastEl.textContent = msg;
    toastEl.classList.add('visible');
    toastTimer = setTimeout(() => toastEl.classList.remove('visible'), 3500);
}

// ── Status bar ────────────────────────────────────────────────────────
function setStatus(cls, txt) {
    statusDot.className = cls;
    statusText.textContent = txt;
}

// ── Image modal ───────────────────────────────────────────────────────
imgModal.addEventListener('click', () => imgModal.classList.remove('open'));
function openModal(src) { modalImg.src = src; imgModal.classList.add('open'); }


// ── Message helpers ───────────────────────────────────────────────────
function appendUserMessage(text, images = []) {
    const row = document.createElement('div');
    row.className = 'msg-row user';
    const bubble = document.createElement('div');
    bubble.className = 'bubble user';
    if (text) {
        const d = document.createElement('div');
        d.textContent = text;
        bubble.appendChild(d);
    }
    images.forEach(src => {
        const img = document.createElement('img');
        img.src = src; img.className = 'msg-image';
        img.onclick = e => { e.stopPropagation(); openModal(src); };
        bubble.appendChild(img);
    });
    row.appendChild(bubble);
    chatBox.appendChild(row);
    scrollBottom();
}

let piRow = null, piBubble = null, piBuffer = '';
function ensurePiBubble() {
    if (!piBubble) {
        piRow = document.createElement('div');
        piRow.className = 'msg-row pi';
        piBubble = document.createElement('div');
        piBubble.className = 'bubble pi';
        piRow.appendChild(piBubble);
        chatBox.appendChild(piRow);
    }
}
function appendPiText(chunk) {
    removeDotsSpinner();
    ensurePiBubble();
    piBuffer += chunk;
    piBubble.innerHTML = (window.marked?.parse ?? (s => s))(piBuffer);
    scrollBottom();
}
function breakPiBubble() { piRow = piBubble = null; piBuffer = ''; }

function appendSystemNote(text) {
    const el = document.createElement('div');
    el.className = 'system-note';
    el.textContent = text;
    chatBox.appendChild(el);
    scrollBottom();
}

// ── Typing dots ───────────────────────────────────────────────────────
let dotsEl = null;
function showDotsSpinner() {
    if (dotsEl) return;
    dotsEl = document.createElement('div');
    dotsEl.className = 'pi-dots';
    dotsEl.innerHTML = '<span></span><span></span><span></span>';
    chatBox.appendChild(dotsEl);
    scrollBottom();
}
function removeDotsSpinner() {
    if (dotsEl) { dotsEl.remove(); dotsEl = null; }
}

// ── Working block (Codex-style) ───────────────────────────────────────
let wBlock = null, wSteps = null, wStart = null, wOpen = false;
const stepEls = {};
const stepTimes = {};

function ensureWorkingBlock() {
    if (wBlock) return;
    breakPiBubble();
    removeDotsSpinner();
    wStart = Date.now();
    wOpen = false;

    wBlock = document.createElement('div');
    wBlock.className = 'working-block';

    const hdr = document.createElement('div');
    hdr.className = 'working-header';
    hdr.innerHTML =
        '<span class="w-spin">↻</span>' +
        '<span class="w-elapsed">Working…</span>' +
        '<span class="w-chevron">▾</span>';
    hdr.addEventListener('click', () => {
        wOpen = !wOpen;
        wSteps.classList.toggle('open', wOpen);
        hdr.querySelector('.w-chevron').classList.toggle('open', wOpen);
    });

    wSteps = document.createElement('div');
    wSteps.className = 'working-steps';

    wBlock.appendChild(hdr);
    wBlock.appendChild(wSteps);
    chatBox.appendChild(wBlock);
}

function handleToolStart(id, name, args) {
    ensureWorkingBlock();
    const label = args.command || args.path || args.pattern || args.question || name;
    stepTimes[id] = Date.now();
    const item = document.createElement('div');
    item.className = 'step-item';
    item.innerHTML =
        \`<span class="step-icon running" id="si-\${id}">↻</span>\` +
        \`<span><span class="step-name">\${name}</span>\` +
        \`<span class="step-label">\${String(label).substring(0, 60)}</span></span>\` +
        \`<span class="step-time" id="st-\${id}"></span>\`;
    wSteps.appendChild(item);
    stepEls[id] = item;
    scrollBottom();
}

function handleToolEnd(id, result) {
    const item = stepEls[id];
    if (!item) return;
    const icon = document.getElementById('si-' + id);
    if (icon) { icon.textContent = '✓'; icon.classList.remove('running'); icon.style.color = '#4ec94e'; }
    const timeEl = document.getElementById('st-' + id);
    if (timeEl && stepTimes[id]) {
        const ms = Date.now() - stepTimes[id];
        timeEl.textContent = ms < 1000 ? ms + 'ms' : (ms / 1000).toFixed(1) + 's';
    }
    if (result) {
        const out = document.createElement('div');
        out.className = 'step-output';
        out.textContent = result.length > 300 ? result.substring(0, 300) + '…' : result;
        item.insertAdjacentElement('afterend', out);
    }
    delete stepEls[id];
    delete stepTimes[id];
    scrollBottom();
}

function finalizeWorkingBlock() {
    if (!wBlock || !wStart) return;
    const secs = ((Date.now() - wStart) / 1000).toFixed(1);
    const hdr = wBlock.querySelector('.working-header');
    if (hdr) {
        const spin = hdr.querySelector('.w-spin');
        if (spin) { spin.textContent = '✓'; spin.classList.remove('w-spin'); spin.style.color = '#4ec94e'; }
        const el = hdr.querySelector('.w-elapsed');
        if (el) el.textContent = 'Worked for ' + secs + 's';
    }
    wBlock = wSteps = wStart = null;
    breakPiBubble();
}

// ── WebSocket ─────────────────────────────────────────────────────────
function connect() {
    setStatus('', 'Connecting…');
    ws = new WebSocket('ws://localhost:8001/ws/chat');

    ws.onopen = () => {
        setStatus('connected', 'Pi · gemini-2.5-flash');
        ws.send(JSON.stringify({
            session_id: 'vscode_session',
            provider: 'gemini',
            model: 'gemini-2.5-flash',
            message: '',
            cwd: WORKSPACE_CWD
        }));
    };

    ws.onmessage = ev => {
        const d = JSON.parse(ev.data);
        switch (d.type) {
            case 'text':
                removeDotsSpinner();
                appendPiText(d.content);
                break;
            case 'tool_call':
                handleToolStart(d.id, d.name, d.args ?? {});
                vscode.postMessage({ type: 'execute_tool', id: d.id, name: d.name, args: d.args ?? {}, cwd: WORKSPACE_CWD });
                break;
            case 'system_notification':
                appendSystemNote(d.message);
                break;
            case 'done':
                finalizeWorkingBlock();
                removeDotsSpinner();
                break;
            case 'error':
                removeDotsSpinner();
                setStatus('error', 'Error');
                showToast('⚠ ' + d.message);
                break;
        }
        scrollBottom();
    };

    ws.onclose = () => {
        setStatus('error', 'Disconnected — retrying in 3s…');
        ws = null;
        wBlock = wSteps = wStart = null;
        setTimeout(connect, 3000);
    };
}

// ── Send message ──────────────────────────────────────────────────────
function sendMessage() {
    const text   = msgInput.value.trim();
    const images = [...pendingImages];
    if (!text && images.length === 0) return;
    if (!ws || ws.readyState !== WebSocket.OPEN) { showToast('Not connected'); return; }

    appendUserMessage(text, images);
    hideCmdDropdown();
    msgInput.value = '';
    msgInput.style.height = 'auto';
    pendingImages = [];
    attBar.innerHTML = '';
    breakPiBubble();
    showDotsSpinner();

    ws.send(JSON.stringify({ message: text, images }));
}

// ── Command dropdown (in-webview) ─────────────────────────────────────
const COMMANDS = [
    { cmd: '/clear',      desc: 'Wipe current session history' },
    { cmd: '/compact',    desc: 'Summarize and compress session history' },
    { cmd: '/config',     desc: 'Show current config' },
    { cmd: '/config set', desc: 'Set a config value  (e.g. /config set provider gemini)' },
    { cmd: '/delete',     desc: 'Delete a session' },
    { cmd: '/help',       desc: 'Show all available commands' },
    { cmd: '/model',      desc: 'Switch model  (e.g. /model gemini-2.5-flash)' },
    { cmd: '/provider',   desc: 'Switch provider  (gemini or openai)' },
    { cmd: '/session',    desc: 'Switch to a named session' },
    { cmd: '/sessions',   desc: 'List all saved sessions' },
];
let cmdIdx = 0;
const cmdDropdown = document.getElementById('cmd-dropdown');

function renderCmdDropdown(filter) {
    const filtered = COMMANDS.filter(c => c.cmd.startsWith(filter));
    if (!filtered.length || !filter.startsWith('/')) { hideCmdDropdown(); return; }
    cmdIdx = Math.min(cmdIdx, filtered.length - 1);
    cmdDropdown.innerHTML = '';
    filtered.forEach((c, i) => {
        const item = document.createElement('div');
        item.className = 'cmd-item' + (i === cmdIdx ? ' active' : '');
        item.innerHTML = \`<span class="cmd-item-name">\${c.cmd}</span><span class="cmd-item-desc">\${c.desc}</span>\`;
        item.onmousedown = e => {
            e.preventDefault();
            msgInput.value = c.cmd + ' ';
            hideCmdDropdown();
            msgInput.focus();
        };
        cmdDropdown.appendChild(item);
    });
    cmdDropdown.classList.add('open');
}
function hideCmdDropdown() { cmdDropdown.classList.remove('open'); cmdIdx = 0; }

// ── Input events ──────────────────────────────────────────────────────
msgInput.addEventListener('keydown', e => {
    if (cmdDropdown.classList.contains('open')) {
        const filtered = COMMANDS.filter(c => c.cmd.startsWith(msgInput.value.split(' ')[0]));
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            cmdIdx = (cmdIdx + 1) % filtered.length;
            renderCmdDropdown(msgInput.value.split(' ')[0]);
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            cmdIdx = (cmdIdx - 1 + filtered.length) % filtered.length;
            renderCmdDropdown(msgInput.value.split(' ')[0]);
            return;
        }
        if (e.key === 'Tab' || e.key === 'Enter') {
            if (filtered[cmdIdx]) {
                e.preventDefault();
                msgInput.value = filtered[cmdIdx].cmd + ' ';
                hideCmdDropdown();
                return;
            }
        }
        if (e.key === 'Escape') { hideCmdDropdown(); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

msgInput.addEventListener('input', () => {
    msgInput.style.height = 'auto';
    msgInput.style.height = Math.min(msgInput.scrollHeight, 130) + 'px';
    const val = msgInput.value;
    if (val.startsWith('/') && !val.includes(' ')) {
        cmdIdx = 0;
        renderCmdDropdown(val);
    } else {
        hideCmdDropdown();
    }
});

// ── Image paste ───────────────────────────────────────────────────────
window.addEventListener('paste', e => {
    for (const item of e.clipboardData.items) {
        if (item.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = ev => addPendingImage(ev.target.result);
            reader.readAsDataURL(item.getAsFile());
        }
    }
});

function addPendingImage(src) {
    pendingImages.push(src);
    const wrap = document.createElement('div');
    wrap.className = 'attachment-wrap';
    const img = document.createElement('img');
    img.src = src; img.className = 'img-thumb';
    img.onclick = e => { e.stopPropagation(); openModal(src); };
    const btn = document.createElement('button');
    btn.className = 'attachment-remove'; btn.textContent = '×';
    btn.onclick = () => { pendingImages = pendingImages.filter(x => x !== src); wrap.remove(); };
    wrap.appendChild(img); wrap.appendChild(btn);
    attBar.appendChild(wrap);
}

// ── Helpers ───────────────────────────────────────────────────────────
function scrollBottom() { chatBox.scrollTop = chatBox.scrollHeight; }

// ── Extension host → Webview (tool results) ───────────────────────────
window.addEventListener('message', event => {
    const msg = event.data;
    if (msg.type === 'tool_done') {
        handleToolEnd(msg.id, msg.result ?? '');
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'tool_result', id: msg.id, result: msg.result ?? '' }));
        }
    }
});

connect();
</script>
</body>
</html>`;
    }
}
