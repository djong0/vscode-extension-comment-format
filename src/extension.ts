import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.debug("comment format activate");
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

//tabSize default 4
function getTabSize() {
    return parseInt(vscode.window.activeTextEditor?.options.tabSize?.toString() || "4");
}

function getTextMaxLength(text: string) {
    let temp = text.match(/[\t]/g);
    if (temp && temp?.length > 0) {
        let tabSize = getTabSize();
        if (tabSize > 2) {
            return text.length + (temp.length * (tabSize - 1));
        }
    }
    return text.length;
}

function updateChangeSelection(isAddCommand: boolean) {
    const activeTextEditor = vscode.window.activeTextEditor;
    if (!activeTextEditor) {
        return;
    }
    const document = activeTextEditor.document;
    //selected lines
    const { start: selectionStart, end: selectionEnd } = activeTextEditor.selection;
    //注释前方非空字符串最大长度
    let nonemptyStrMaxLen = 0;
    //前段字符串长度
    let commentPosArr = [];
    let forepartStrArr = [];
    let forepartStrLenArr = [];
    //遍历每行内容
    for (let lineIndex = selectionStart.line; lineIndex <= selectionEnd.line; lineIndex++) {
        let line = document.lineAt(lineIndex);
        let text = line.text;
        //查看是否包含//
        let commentPos = text.search(/\/\//i);
        commentPosArr[lineIndex] = commentPos;
        //不包含//使用整行字符串
        commentPos = commentPos == -1 ? text.length : commentPos;
        //前段字符串
        text = text.substring(0, commentPos);
        console.debug(`line:${lineIndex}, text forepart:[${text}]`);
        //清除末尾空格
        text = text.replace(/[\s]*$/g, "");
        console.debug(`line:${lineIndex}, forepart del white:[${text}]`);
        forepartStrArr[lineIndex] = text;
        let textLen = getTextMaxLength(text);
        console.debug(`line:${lineIndex}, textLen:${textLen}`);
        forepartStrLenArr[lineIndex] = textLen;
        if (nonemptyStrMaxLen < textLen) {
            nonemptyStrMaxLen = textLen;
        }
    }

    //最终替换文本
    let finalSelectionStr = "";
    for (let lineIndex = selectionStart.line; lineIndex <= selectionEnd.line; lineIndex++) {
        let text = document.lineAt(lineIndex).text;
        //第一段文本
        let forepartText = forepartStrArr[lineIndex];
        //第一段文本长度
        let forepartTextLen = forepartStrLenArr[lineIndex];
        //差距，补空格
        if (forepartTextLen < nonemptyStrMaxLen) {
            forepartText += (" ".repeat(nonemptyStrMaxLen - forepartTextLen));
        }
        console.debug(`line:${lineIndex}, forepartText:[${forepartText}]`);
        //换行
        if (finalSelectionStr != "") {
            finalSelectionStr += "\n";
        }
        //拼接文本
        finalSelectionStr += forepartText;
        //后段有内容
        if (commentPosArr[lineIndex] != -1) {
            let endPartText = text.substring(commentPosArr[lineIndex] + 2);
            console.debug(`line:${lineIndex}, endPartText:[${endPartText}]`);
            endPartText = endPartText.trim();
            console.debug(`line:${lineIndex}, endPartText.trim:[${endPartText}]`);
            finalSelectionStr += " //" + endPartText;
        } else if (isAddCommand) {
            finalSelectionStr += " //";
        }
    }
    activeTextEditor.edit((TextEditorEdit) => {
        TextEditorEdit.replace(activeTextEditor.selection, finalSelectionStr);
    });
}
