// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';

let statusBarItem: vscode.StatusBarItem;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Create a status bar item that runs the display command
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'ehrql-vscode.display';
	statusBarItem.text = "Display dataset";
	statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');

	// Implement the display command defined in the package.json file
	const disposable = vscode.commands.registerCommand('ehrql-vscode.display', () => {
	
		const editor = vscode.window.activeTextEditor;

		// ensure it's a python file; this could probably do more to check that it's
		// a file with a dataset definition in it 
		if (!editor || editor.document.languageId !== 'python') {
			vscode.window.showErrorMessage('Please open or select a python dataset definition file to run');
			return;
		}

		// Get the workspace folder
		const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
		if (!workspaceFolder) {
			vscode.window.showErrorMessage('No workspace folder found');
			return;
		}

		// Check that the dummy tables path exists
		const dummyTablesDir = vscode.workspace.getConfiguration("ehrql-vscode").get("DummyTablesDir", "dummy_tables");
		const dummyTablesPath = path.join(workspaceFolder.uri.fsPath, dummyTablesDir);
		if (fs.existsSync(dummyTablesPath)) {
			statusBarItem.tooltip = `Debug dataset using dummy tables in ${dummyTablesDir}/`;
		} else {
			vscode.window.showErrorMessage(`Dummy table path ${dummyTablesDir}/ not found`);
			return;
		}

		// Try to get the opensafely executable from extension config
		let opensafelyPath = vscode.workspace.getConfiguration("ehrql-vscode").get("opensafelyPath");
		// If nothing is configured, look for it in the workspace venv and fall back
		// to system install
		if (!opensafelyPath) {
			// Find possible virtual environments in this workspace folder, where an
			// opensafely executable may be found
			const venvPaths = [
				path.join(workspaceFolder.uri.fsPath, 'venv'),
				path.join(workspaceFolder.uri.fsPath, '.venv'),
				path.join(workspaceFolder.uri.fsPath, 'env')
			];

			// Check for virtual environment
			for (const venvPath of venvPaths) {
				const windowsOpensafelyPath = path.join(venvPath, 'Scripts', 'opensafely.exe');
				const unixOpenSafelyPath = path.join(venvPath, 'bin', 'opensafely');

				if (fs.existsSync(windowsOpensafelyPath)) {
					opensafelyPath = windowsOpensafelyPath;
					break;
				} else if (fs.existsSync(unixOpenSafelyPath)) {
					opensafelyPath = unixOpenSafelyPath;
					break;
				}
			}

			if (!opensafelyPath) {
				// Fallback to system-installed opensafely
				opensafelyPath = 'opensafely';
			}
		}


		const panel = vscode.window.createWebviewPanel(
			'ehrql_html_display',
			'ehrQL Dataset Output',
			vscode.ViewColumn.Beside,
			{ 
				enableScripts: true,
			}
		);
		const logging_panel = vscode.window.createWebviewPanel(
			'ehrql_html_display',
			'ehrQL Logging',
			vscode.ViewColumn.Beside,
			{
				enableScripts: true,
			}
		);

		// Get the filename relative to the workspace folder
        const fileName = editor.document.fileName.replace(workspaceFolder.uri.fsPath + "/", "");

		// Define the command
		const command = `"${opensafelyPath}" exec ehrql:v1 display "${fileName}" ${dummyTableArg}`;

		// Execute the command at the workspace root so we have access to the file and
		// the dummy tables folder
		exec(command, { cwd: workspaceFolder.uri.fsPath }, (error, stdout, stderr) => {
			if (error) {
				console.error(`Error executing Python script: ${command}`);
				console.error(error);
				panel.webview.html = stderr.trim();
			} else {
			panel.webview.html = stdout.trim();
			logging_panel.webview.html = stderr.trim().replace("\n", "<br/>");
		}
		});
	});

	// Watch for active editor changes to update status bar visibility
	context.subscriptions.push(disposable, statusBarItem);
	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(updateStatusBarVisibility));
	context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(updateStatusBarVisibility));

    // Initialize visibility based on current editor
    updateStatusBarVisibility();
}


function updateStatusBarVisibility() {
	const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.languageId === 'python') {
        statusBarItem.show();
    } else {
        statusBarItem.hide();
    }
}


export function deactivate() {
	if (statusBarItem) {
		statusBarItem.dispose();
	}
}
