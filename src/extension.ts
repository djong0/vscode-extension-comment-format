import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	console.log("comment format activate");
	let commentFormatWithoutAdd = vscode.commands.registerCommand('comment.format.without.add', function () {
		updateChangeSelection(false);
	});

	let commentFormatAdd = vscode.commands.registerCommand('comment.format.add', function () {
		updateChangeSelection(true);
	});

	context.subscriptions.push(commentFormatAdd);
	context.subscriptions.push(commentFormatWithoutAdd);
}

export function deactivate() { }

function updateChangeSelection(isAddCommand: boolean) {
	const activeTextEditor = vscode.window.activeTextEditor;
	if (!activeTextEditor) {
		return;
	}
	const document = activeTextEditor.document;
	//选中的行
	const { start: selectionStart, end: selectionEnd } = activeTextEditor.selection;
	if (selectionStart.isEqual(selectionEnd)) {
		console.log("Please select multiple lines")
		return;
	}
	//注释前方非空字符串最大长度
	let nonemptyStrMaxLen = 0;
	//前段字符串长度
	let forepartStrLenArr = [];
	//遍历每行内容
	for (let lineIndex = selectionStart.line; lineIndex <= selectionEnd.line; lineIndex++) {
		let text = document.lineAt(lineIndex).text;
		//前段字符串结束位置
		let endPos = text.search(/[\s]*\/\/[\s\S]*/i);
		//无注释计算最大长度
		if (isAddCommand) {
			endPos = endPos == -1 ? text.length : endPos;
		}

		//存储
		forepartStrLenArr[lineIndex] = endPos;
		if (nonemptyStrMaxLen < endPos) {
			nonemptyStrMaxLen = endPos;
		}
	}

	//最终替换文本
	let finalSelectionStr = "";
	for (let lineIndex = selectionStart.line; lineIndex <= selectionEnd.line; lineIndex++) {
		let text = document.lineAt(lineIndex).text;
		//前段字符串结束位置
		let forepartLen = forepartStrLenArr[lineIndex];
		//第一段文本
		let forepartText = text;
		//没有注释，保持原样
		if (forepartLen != -1) {
			forepartText = text.substring(0, forepartLen);
			//差距，补空格
			if (forepartLen < nonemptyStrMaxLen) {
				forepartText += (" ".repeat(nonemptyStrMaxLen - forepartLen));
			}
		}
		//换行
		if (finalSelectionStr != "") {
			finalSelectionStr += "\n";
		}
		//拼接文本
		finalSelectionStr += forepartText;
		//后段内容
		let endPartPos = text.search(/\/\/[\s\S]*/i);
		if (endPartPos != -1) {
			finalSelectionStr += (" " + text.substring(endPartPos)); //多增加一个空格
		} else if (isAddCommand) {
			finalSelectionStr += (" " + "//"); //多增加一个空格
		}
	}
	activeTextEditor.edit((TextEditorEdit) => {
		TextEditorEdit.replace(activeTextEditor.selection, finalSelectionStr);
	});
}
