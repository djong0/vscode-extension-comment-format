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
        //??????
        if (textArr != "") {
            textArr += "\n";
        }
        let text = checkTextArray[index];
        //????????????????????????//??????
        let commentPos = text.search(/\/\//i);
        if (commentPos != -1) {//????????????
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
        //????????????????????????//??????
        let commentPos = text.search(/^[\s]*\/\//i);
        if (commentPos != -1) {//????????????
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
    //??????????????????
    for (let lineIndex = selectionStart.line; lineIndex <= selectionEnd.line; lineIndex++) {
        let line = document.lineAt(lineIndex);
        let text = line.text;
        lineTextArray.push(text);
    }
    return lineTextArray;
}

function getUpdateFinalStr(isAddCommand: boolean, lineStr: string[]) : string {
    //???????????????????????????????????????
    let nonemptyStrMaxLen = 0;
    //?????????????????????
    let commentPosArr = [];
    let forepartStrArr = [];
    let forepartStrLenArr = [];
    //??????????????????
    for (let index = 0; index < lineStr.length; index++) {
        let text = lineStr[index];
        //??????????????????//
        let commentPos = text.search(/\/\//i);
        commentPosArr[index] = commentPos;
        //?????????//?????????????????????
        commentPos = commentPos == -1 ? text.length : commentPos;
        //???????????????
        text = text.substring(0, commentPos);
        console.debug(`line:${index}, text forepart:[${text}]`);
        //??????????????????
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

    //??????????????????
    let finalSelectionStr = "";
    for (let index = 0; index < lineStr.length; index++) {
        let text = lineStr[index];
        //???????????????
        let forepartText = forepartStrArr[index];
        //?????????????????????
        let forepartTextLen = forepartStrLenArr[index];
        //??????????????????
        if (forepartTextLen < nonemptyStrMaxLen) {
            forepartText += (" ".repeat(nonemptyStrMaxLen - forepartTextLen));
        }
        console.debug(`line:${index}, forepartText:[${forepartText}]`);
        //??????
        if (finalSelectionStr != "") {
            finalSelectionStr += "\n";
        }
        //????????????
        finalSelectionStr += forepartText;
        //???????????????
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
