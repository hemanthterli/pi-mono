import * as vscode from 'vscode';
import { PiSidebarProvider } from './PiSidebarProvider';

export function activate(context: vscode.ExtensionContext) {
    console.log('Pi Assistant extension is now active!');

    const sidebarProvider = new PiSidebarProvider(context.extensionUri);
    
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            "pi.sidebar",
            sidebarProvider
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('pi.start', () => {
            vscode.commands.executeCommand('workbench.view.extension.pi-sidebar-view');
        })
    );
}

export function deactivate() {}
