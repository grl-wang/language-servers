import { EditSuggestionsParams, editSuggestionsRequestType } from '@aws/language-server-runtimes/server-interface'
import { commands, window } from 'vscode'
import { LanguageClient } from 'vscode-languageclient/node'

export function registerEditSuggestions(languageClient: LanguageClient) {
    commands.registerCommand('aws.sample-vscode-ext-amazonq.invokeEditSuggestions', async (...args: any) => {
        try {
            const editor = window.activeTextEditor
            if (!editor) {
                window.showErrorMessage('Must have an active document tab open to invoke edit suggestions.')
                return
            }
            const document = editor.document

            const params: EditSuggestionsParams = {
                textDocument: {
                    uri: document.uri.toString(),
                },
                position: editor.selection.active,
            }

            await languageClient.sendRequest(editSuggestionsRequestType, params)
        } catch (err) {
            console.error(err)
        }
    })
}
