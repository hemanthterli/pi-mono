/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/PiSidebarProvider.ts"
/*!**********************************!*\
  !*** ./src/PiSidebarProvider.ts ***!
  \**********************************/
(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.PiSidebarProvider = void 0;
const vscode = __importStar(__webpack_require__(/*! vscode */ "vscode"));
class PiSidebarProvider {
    _extensionUri;
    _view;
    _doc;
    constructor(_extensionUri) {
        this._extensionUri = _extensionUri;
    }
    resolveWebviewView(webviewView) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case "onInfo": {
                    if (!data.value) {
                        return;
                    }
                    vscode.window.showInformationMessage(data.value);
                    break;
                }
                case "onError": {
                    if (!data.value) {
                        return;
                    }
                    vscode.window.showErrorMessage(data.value);
                    break;
                }
            }
        });
    }
    _getHtmlForWebview(webview) {
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
exports.PiSidebarProvider = PiSidebarProvider;


/***/ },

/***/ "./src/extension.ts"
/*!**************************!*\
  !*** ./src/extension.ts ***!
  \**************************/
(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(__webpack_require__(/*! vscode */ "vscode"));
const PiSidebarProvider_1 = __webpack_require__(/*! ./PiSidebarProvider */ "./src/PiSidebarProvider.ts");
function activate(context) {
    console.log('Pi Assistant extension is now active!');
    const sidebarProvider = new PiSidebarProvider_1.PiSidebarProvider(context.extensionUri);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider("pi.sidebar", sidebarProvider));
    context.subscriptions.push(vscode.commands.registerCommand('pi.start', () => {
        vscode.commands.executeCommand('workbench.view.extension.pi-sidebar-view');
    }));
}
function deactivate() { }


/***/ },

/***/ "vscode"
/*!*************************!*\
  !*** external "vscode" ***!
  \*************************/
(module) {

module.exports = require("vscode");

/***/ }

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		if (!(moduleId in __webpack_modules__)) {
/******/ 			delete __webpack_module_cache__[moduleId];
/******/ 			var e = new Error("Cannot find module '" + moduleId + "'");
/******/ 			e.code = 'MODULE_NOT_FOUND';
/******/ 			throw e;
/******/ 		}
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__("./src/extension.ts");
/******/ 	var __webpack_export_target__ = exports;
/******/ 	for(var __webpack_i__ in __webpack_exports__) __webpack_export_target__[__webpack_i__] = __webpack_exports__[__webpack_i__];
/******/ 	if(__webpack_exports__.__esModule) Object.defineProperty(__webpack_export_target__, "__esModule", { value: true });
/******/ 	
/******/ })()
;
//# sourceMappingURL=extension.js.map