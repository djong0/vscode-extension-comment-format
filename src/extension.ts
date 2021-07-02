import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.debug("comment format activate");
    let commentFormatWithoutAdd = vscode.commands.registerCommand('comment.format.without.add', function () {
        updateSelection(false);
    });

    let commentFormatAdd = vscode.commands.registerCommand('comment.format.add', function () {
        updateSelection(true);
    });

    let commentFormatChange = vscode.commands.registerCommand('comment.format.change', function () {
        changeSelection();
    });

    context.subscriptions.push(commentFormatAdd);
    context.subscriptions.push(commentFormatWithoutAdd);
    context.subscriptions.push(commentFormatChange);
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

enum TextAndCommentType {
    HEAD_TO_TAIL, //move the previous line of comment to the end of this line
    TAIL_TO_HEAD, //move the comment at the end of this line to the previous line 
    OTHER         //don't work
}

function changeSelection() {
    const activeTextEditor = vscode.window.activeTextEditor;
    if (!activeTextEditor) {
        return;
    }
    //got line text array
    let lineTextArray = getOriginTextArray(activeTextEditor);
    //check type is HEAD_TO_TAIL
    let [isH2T, textArray] = getHeadToTailTextArray(lineTextArray);
    console.debug(`isH2T:${isH2T}`);
    // printTextArray(textArray);
    let finalSelectionStr = "";
    if (isH2T) {
        finalSelectionStr = getUpdateFinalStr(false, textArray);
    } else {
        //check type is TAIL_TO_HEAD
        finalSelectionStr = getTailToHeadTextArray(lineTextArray);
    }
    textEditorReplace(activeTextEditor, finalSelectionStr);
}

function printTextArray(textArray:string[]) {
    for (let i = 0; i < textArray.length; i++) {
        console.debug(`line:${i}, text :[${textArray[i]}]`);
    }
}

function getTailToHeadTextArray(checkTextArray: string[]): string {
    let textArr: string = "";
    for (let index = 0; index < checkTextArray.length; index++) {
        //换行
        if (textArr != "") {
            textArr += "\n";
        }
        let text = checkTextArray[index];
        //全注释行。检测以//开头
        let commentPos = text.search(/\/\//i);
        if (commentPos != -1) {//是注释行
            let forepart = text.substring(0, commentPos);
            let endPart = text.substring(commentPos + 2);

            let wordStartPos = text.search(/\S/i);
            let whiteStr = forepart.substring(0, wordStartPos);

            textArr += (whiteStr + "//" + endPart.trim() + "\n");
            textArr += (forepart);
        } else {
            textArr += (text);
        }
    }
    return textArr;
}

function getHeadToTailTextArray(checkTextArray: string[]): [boolean, string[]] {
    let isH2T = false;
    let textArr: string[] = [];

    for (let index = 0; index < checkTextArray.length;) {
        let isHandle = false;
        let tmText = "";
        let text = checkTextArray[index];    
        //全注释行。检测以//开头
        let commentPos = text.search(/^[\s]*\/\//i);
        if (commentPos != -1) {//是注释行
            if ((index + 1) < checkTextArray.length) {
                let nextText = checkTextArray[index + 1];
                let nextCommentPos = nextText.search(/\/\//i);
                if (nextCommentPos == -1) {//
                    nextText = nextText.replace(/[\s]*$/g, "");
                    tmText = (nextText + text);
                    isHandle = true;
                    isH2T = true;
                }
            }
        }

        if (isHandle) {
            index += 2;
            textArr.push(tmText);
        } else {
            index += 1;
            textArr.push(text);
        }  
    }
    return [isH2T, textArr];
}

function updateSelection(isAddCommand : boolean) {
    const activeTextEditor = vscode.window.activeTextEditor;
    if (!activeTextEditor) {
        return;
    }

    //got line text array
    let lineTextArray = getOriginTextArray(activeTextEditor);
    let finalSelectionStr = getUpdateFinalStr(isAddCommand, lineTextArray);
    textEditorReplace(activeTextEditor, finalSelectionStr)
}

function getOriginTextArray(activeTextEditor: vscode.TextEditor): string[] {
    const document = activeTextEditor.document;
    //selected lines
    const { start: selectionStart, end: selectionEnd } = activeTextEditor.selection;
    //got line text array
    let lineTextArray = [];
    //遍历每行内容
    for (let lineIndex = selectionStart.line; lineIndex <= selectionEnd.line; lineIndex++) {
        let line = document.lineAt(lineIndex);
        let text = line.text;
        lineTextArray.push(text);
    }
    return lineTextArray;
}

function getUpdateFinalStr(isAddCommand: boolean, lineStr: string[]) : string {
    //注释前方非空字符串最大长度
    let nonemptyStrMaxLen = 0;
    //前段字符串长度
    let commentPosArr = [];
    let forepartStrArr = [];
    let forepartStrLenArr = [];
    //遍历每行内容
    for (let index = 0; index < lineStr.length; index++) {
        let text = lineStr[index];
        //查看是否包含//
        let commentPos = text.search(/\/\//i);
        commentPosArr[index] = commentPos;
        //不包含//使用整行字符串
        commentPos = commentPos == -1 ? text.length : commentPos;
        //前段字符串
        text = text.substring(0, commentPos);
        console.debug(`line:${index}, text forepart:[${text}]`);
        //清除末尾空格
        text = text.replace(/[\s]*$/g, "");
        console.debug(`line:${index}, forepart del white:[${text}]`);
        forepartStrArr[index] = text;
        let textLen = getTextMaxLength(text);
        console.debug(`line:${index}, textLen:${textLen}`);
        forepartStrLenArr[index] = textLen;
        if (nonemptyStrMaxLen < textLen) {
            nonemptyStrMaxLen = textLen;
        }
    }

    //最终替换文本
    let finalSelectionStr = "";
    for (let index = 0; index < lineStr.length; index++) {
        let text = lineStr[index];
        //第一段文本
        let forepartText = forepartStrArr[index];
        //第一段文本长度
        let forepartTextLen = forepartStrLenArr[index];
        //差距，补空格
        if (forepartTextLen < nonemptyStrMaxLen) {
            forepartText += (" ".repeat(nonemptyStrMaxLen - forepartTextLen));
        }
        console.debug(`line:${index}, forepartText:[${forepartText}]`);
        //换行
        if (finalSelectionStr != "") {
            finalSelectionStr += "\n";
        }
        //拼接文本
        finalSelectionStr += forepartText;
        //后段有内容
        if (commentPosArr[index] != -1) {
            let endPartText = text.substring(commentPosArr[index] + 2);
            console.debug(`line:${index}, endPartText:[${endPartText}]`);
            endPartText = endPartText.trim();
            console.debug(`line:${index}, endPartText.trim:[${endPartText}]`);
            finalSelectionStr += " //" + endPartText;
        } else if (isAddCommand) {
            finalSelectionStr += " //";
        }
    }
    return finalSelectionStr;
}

function textEditorReplace(activeTextEditor: vscode.TextEditor, finalSelectionStr:string) {
    activeTextEditor.edit((textEditorEdit) => {
        textEditorEdit.replace(activeTextEditor.selection, finalSelectionStr);
    });
}
