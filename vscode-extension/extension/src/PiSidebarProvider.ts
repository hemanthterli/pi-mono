import * as vscode from 'vscode';

export class PiSidebarProvider implements vscode.WebviewViewProvider {
    _view?: vscode.WebviewView;
    _doc?: vscode.TextDocument;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(webviewView: vscode.WebviewView) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case "onInfo": {
                    if (!data.value) { return; }
                    vscode.window.showInformationMessage(data.value);
                    break;
                }
                case "onError": {
                    if (!data.value) { return; }
                    vscode.window.showErrorMessage(data.value);
                    break;
                }
            }
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        // Simple HTML for now. Later we will build a React/Svelte/Vanilla JS frontend
        // that connects to the Python WebSocket server.
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Pi Assistant</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-editor-foreground);
                    background-color: var(--vscode-editor-background);
                    padding: 10px;
                }
                #chat-box {
                    height: 80vh;
                    overflow-y: auto;
                    margin-bottom: 10px;
                    border: 1px solid var(--vscode-panel-border);
                    padding: 5px;
                }
                #message-input {
                    width: 100%;
                    box-sizing: border-box;
                    padding: 8px;
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                }
            </style>
        </head>
        <body>
            <h3>Pi Assistant</h3>
            <div id="chat-box"></div>
            <input type="text" id="message-input" placeholder="Type a message..." />

            <script>
                const vscode = acquireVsCodeApi();
                const chatBox = document.getElementById('chat-box');
                const messageInput = document.getElementById('message-input');
                let ws = null;

                function connectWebSocket() {
                    appendMessage('System', 'Connecting to Pi backend...');
                    ws = new WebSocket('ws://localhost:8001/ws/chat');
                    
                    ws.onopen = () => {
                        appendMessage('System', 'Connected!');
                        // Send initial message to configure session
                        ws.send(JSON.stringify({
                            session_id: "vscode_session",
                            provider: "gemini",
                            model: "gemini-2.5-pro",
                            message: ""
                        }));
                    };
                    
                    ws.onmessage = (event) => {
                        const data = JSON.parse(event.data);
                        if (data.type === 'text') {
                            appendMessage('Pi', data.content);
                        } else if (data.type === 'tool_start') {
                            appendMessage('System', \`Executing \${data.name}...\`);
                        } else if (data.type === 'ask_user') {
                            appendMessage('Pi (Question)', data.question);
                            // We will handle routing the next input as an answer
                            window.awaitingAnswer = true;
                        } else if (data.type === 'error') {
                            appendMessage('Error', data.message);
                        }
                    };

                    ws.onclose = () => {
                        appendMessage('System', 'Disconnected from backend.');
                        ws = null;
                    };
                }

                function appendMessage(sender, text) {
                    const msg = document.createElement('div');
                    msg.innerHTML = \`<strong>\${sender}:</strong> \${text.replace(/\\n/g, '<br>')}\`;
                    msg.style.marginBottom = '8px';
                    chatBox.appendChild(msg);
                    chatBox.scrollTop = chatBox.scrollHeight;
                }

                messageInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter' && messageInput.value.trim() !== '') {
                        const text = messageInput.value.trim();
                        appendMessage('You', text);
                        messageInput.value = '';

                        if (ws && ws.readyState === WebSocket.OPEN) {
                            if (window.awaitingAnswer) {
                                ws.send(JSON.stringify({ answer: text, message: text }));
                                window.awaitingAnswer = false;
                            } else {
                                ws.send(JSON.stringify({ message: text }));
                            }
                        } else if (!ws || ws.readyState === WebSocket.CLOSED) {
                            // If sending a new message while disconnected, connect and send
                            connectWebSocket();
                            // Note: for this simple prototype, the message won't be sent immediately 
                            // after reconnect. A robust frontend will queue it.
                        }
                    }
                });

                // Auto-connect on load
                connectWebSocket();
            </script>
        </body>
        </html>`;
    }
}