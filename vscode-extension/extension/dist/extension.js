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
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline' https://cdn.jsdelivr.net; connect-src ws://localhost:8001;">
            <title>Pi Assistant</title>
            <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-editor-foreground);
                    background-color: var(--vscode-editor-background);
                    padding: 0;
                    margin: 0;
                    display: flex;
                    flex-direction: column;
                    height: 100vh;
                }
                #chat-box {
                    flex: 1;
                    overflow-y: auto;
                    padding: 15px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .message {
                    max-width: 85%;
                    padding: 8px 12px;
                    border-radius: 8px;
                    word-wrap: break-word;
                    line-height: 1.4;
                }
                .message-user {
                    align-self: flex-end;
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                }
                .message-pi {
                    align-self: flex-start;
                    background-color: var(--vscode-editorWidget-background);
                    border: 1px solid var(--vscode-editorWidget-border);
                }
                .message-system {
                    align-self: center;
                    font-size: 0.85em;
                    color: var(--vscode-descriptionForeground);
                    background: transparent;
                    padding: 2px 8px;
                }
                .tool-details {
                    margin-top: 5px;
                    background: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 4px;
                    padding: 5px;
                    font-family: var(--vscode-editor-font-family);
                    font-size: 0.9em;
                }
                .tool-details summary {
                    cursor: pointer;
                    color: var(--vscode-textLink-foreground);
                    font-weight: bold;
                    user-select: none;
                }
                .tool-details pre {
                    margin: 5px 0 0 0;
                    white-space: pre-wrap;
                    overflow-x: auto;
                    color: var(--vscode-editor-foreground);
                }
                .input-container {
                    padding: 10px;
                    background: var(--vscode-editor-background);
                    border-top: 1px solid var(--vscode-panel-border);
                }
                #message-input {
                    width: 100%;
                    box-sizing: border-box;
                    padding: 10px;
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                }
                
                /* Markdown specific styles */
                .message-pi p { margin: 0 0 8px 0; }
                .message-pi p:last-child { margin: 0; }
                .message-pi pre { 
                    background: var(--vscode-textCodeBlock-background); 
                    padding: 8px; 
                    border-radius: 4px;
                    overflow-x: auto;
                }
                .message-pi code {
                    background: var(--vscode-textCodeBlock-background);
                    padding: 2px 4px;
                    border-radius: 3px;
                    font-family: var(--vscode-editor-font-family);
                }
                
                /* Image specific styles */
                #attachments-container {
                    display: flex;
                    gap: 10px;
                    padding: 0 10px;
                    overflow-x: auto;
                    background: var(--vscode-editor-background);
                }
                .attachment-preview {
                    position: relative;
                    display: inline-block;
                    margin-bottom: 5px;
                }
                .attachment-preview img {
                    height: 60px;
                    border-radius: 4px;
                    border: 1px solid var(--vscode-panel-border);
                }
                .remove-attachment {
                    position: absolute;
                    top: -5px;
                    right: -5px;
                    background: var(--vscode-badge-background);
                    color: var(--vscode-badge-foreground);
                    border: none;
                    border-radius: 50%;
                    width: 20px;
                    height: 20px;
                    font-size: 12px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .message-image {
                    max-width: 100%;
                    border-radius: 4px;
                    margin-top: 5px;
                }
            </style>
        </head>
        <body>
            <div id="chat-box"></div>
            <div id="attachments-container"></div>
            <div class="input-container">
                <input type="text" id="message-input" placeholder="Ask Pi something... (Paste images with Ctrl+V)" />
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                const chatBox = document.getElementById('chat-box');
                const messageInput = document.getElementById('message-input');
                let ws = null;
                
                // Track active tool UI elements
                const activeTools = {};

                function connectWebSocket() {
                    appendSystemMessage('Connecting to Pi backend...');
                    ws = new WebSocket('ws://localhost:8001/ws/chat');
                    
                    ws.onopen = () => {
                        appendSystemMessage('Connected!');
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
                            appendPiMessage(data.content, false);
                        } else if (data.type === 'tool_start') {
                            handleToolStart(data.id, data.name, data.args);
                        } else if (data.type === 'tool_end') {
                            handleToolEnd(data.id, data.result);
                        } else if (data.type === 'ask_user') {
                            appendPiMessage('<strong>Question:</strong> ' + data.question, true);
                            window.awaitingAnswer = true;
                        } else if (data.type === 'done') {
                            // Turn finished
                        } else if (data.type === 'error') {
                            appendSystemMessage('Error: ' + data.message);
                        }
                        
                        scrollToBottom();
                    };

                    ws.onclose = () => {
                        appendSystemMessage('Disconnected from backend.');
                        ws = null;
                    };
                }

                function scrollToBottom() {
                    chatBox.scrollTop = chatBox.scrollHeight;
                }

                let pendingImages = [];
                const attachmentsContainer = document.getElementById('attachments-container');

                // Handle pasting images
                window.addEventListener('paste', (e) => {
                    const items = e.clipboardData.items;
                    for (let i = 0; i < items.length; i++) {
                        if (items[i].type.indexOf('image') !== -1) {
                            const blob = items[i].getAsFile();
                            const reader = new FileReader();
                            reader.onload = (event) => {
                                const base64data = event.target.result;
                                addImageToPending(base64data);
                            };
                            reader.readAsDataURL(blob);
                        }
                    }
                });

                function addImageToPending(base64data) {
                    pendingImages.push(base64data);
                    
                    const previewDiv = document.createElement('div');
                    previewDiv.className = 'attachment-preview';
                    
                    const img = document.createElement('img');
                    img.src = base64data;
                    
                    const removeBtn = document.createElement('button');
                    removeBtn.className = 'remove-attachment';
                    removeBtn.textContent = 'x';
                    removeBtn.onclick = () => {
                        const index = pendingImages.indexOf(base64data);
                        if (index > -1) {
                            pendingImages.splice(index, 1);
                        }
                        previewDiv.remove();
                    };
                    
                    previewDiv.appendChild(img);
                    previewDiv.appendChild(removeBtn);
                    attachmentsContainer.appendChild(previewDiv);
                }

                function appendUserMessage(text, images = []) {
                    const msg = document.createElement('div');
                    msg.className = 'message message-user';
                    
                    if (text) {
                        const textNode = document.createElement('div');
                        textNode.textContent = text;
                        msg.appendChild(textNode);
                    }

                    images.forEach(imgData => {
                        const img = document.createElement('img');
                        img.src = imgData;
                        img.className = 'message-image';
                        msg.appendChild(img);
                    });

                    chatBox.appendChild(msg);
                    scrollToBottom();
                }

                // We keep track of the last Pi message div so we can stream text into it
                let currentPiMessageDiv = null;
                let currentPiTextBuffer = "";

                function appendPiMessage(chunk, isHtml = false) {
                    if (!currentPiMessageDiv) {
                        currentPiMessageDiv = document.createElement('div');
                        currentPiMessageDiv.className = 'message message-pi';
                        chatBox.appendChild(currentPiMessageDiv);
                    }
                    
                    if (isHtml) {
                        currentPiMessageDiv.innerHTML += chunk;
                    } else {
                        currentPiTextBuffer += chunk;
                        // Use marked to parse the accumulated text
                        if (window.marked) {
                            currentPiMessageDiv.innerHTML = marked.parse(currentPiTextBuffer);
                        } else {
                            currentPiMessageDiv.textContent = currentPiTextBuffer;
                        }
                    }
                    scrollToBottom();
                }
                
                // When Pi starts using tools, we close the current text bubble
                function breakPiMessage() {
                    currentPiMessageDiv = null;
                    currentPiTextBuffer = "";
                }

                function appendSystemMessage(text) {
                    breakPiMessage();
                    const msg = document.createElement('div');
                    msg.className = 'message message-system';
                    msg.textContent = text;
                    chatBox.appendChild(msg);
                    scrollToBottom();
                }

                function handleToolStart(id, name, args) {
                    breakPiMessage();
                    const container = document.createElement('div');
                    container.className = 'message message-pi';
                    
                    const details = document.createElement('details');
                    details.className = 'tool-details';
                    // Open by default while running
                    details.open = true; 
                    
                    const summary = document.createElement('summary');
                    summary.innerHTML = \`⚙️ Executing <strong>\${name}</strong>\`;
                    
                    const argsPre = document.createElement('pre');
                    argsPre.textContent = "Args: " + JSON.stringify(args, null, 2);
                    argsPre.style.color = "var(--vscode-descriptionForeground)";
                    
                    const resultPre = document.createElement('pre');
                    resultPre.className = 'tool-result';
                    resultPre.innerHTML = '<em>Running...</em>';
                    
                    details.appendChild(summary);
                    details.appendChild(argsPre);
                    details.appendChild(resultPre);
                    container.appendChild(details);
                    
                    chatBox.appendChild(container);
                    activeTools[id] = resultPre;
                    scrollToBottom();
                }

                function handleToolEnd(id, result) {
                    if (activeTools[id]) {
                        activeTools[id].textContent = "Output:\\n" + result;
                        activeTools[id].parentElement.open = false; 
                        delete activeTools[id];
                    }
                    scrollToBottom();
                }

                messageInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter' && (messageInput.value.trim() !== '' || pendingImages.length > 0)) {
                        const text = messageInput.value.trim();
                        const imagesToSend = [...pendingImages];
                        
                        appendUserMessage(text, imagesToSend);
                        messageInput.value = '';
                        
                        // Clear pending images UI
                        pendingImages = [];
                        attachmentsContainer.innerHTML = '';
                        
                        breakPiMessage(); // Break Pi bubble so new response gets a new bubble

                        if (ws && ws.readyState === WebSocket.OPEN) {
                            if (window.awaitingAnswer) {
                                ws.send(JSON.stringify({ answer: text, message: text, images: imagesToSend }));
                                window.awaitingAnswer = false;
                            } else {
                                ws.send(JSON.stringify({ message: text, images: imagesToSend }));
                            }
                        } else if (!ws || ws.readyState === WebSocket.CLOSED) {
                            connectWebSocket();
                            // In a real app we'd queue the message. Here we'll just force a reconnect.
                        }
                    }
                });

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