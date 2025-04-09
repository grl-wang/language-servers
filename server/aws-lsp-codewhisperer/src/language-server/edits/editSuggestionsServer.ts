import {
    InitializeParams,
    Server,
    DidChangeTextDocumentParams,
    DidCloseTextDocumentParams,
    EditSuggestionsParams,
    LogEditSuggestionsParams,
} from '@aws/language-server-runtimes/server-interface'
import { TextDocumentContentChangeEvent } from 'vscode-languageserver-protocol'
import { EditHistoryTracker, DocumentEdit } from './editHistoryTracker'
import { EditSuggestionsHandler } from './editSuggestionsHandler'

/**
 * Server implementation for edit suggestions
 */
export const EditSuggestionsServer =
    (): Server =>
    ({ workspace, logging, lsp, telemetry, credentialsProvider }) => {
        const editHistoryTracker = new EditHistoryTracker()
        const editSuggestionHandler = new EditSuggestionsHandler()

        lsp.addInitializer((params: InitializeParams) => {
            return {
                capabilities: {},
            }
        })

        lsp.onInitialized(() => {
            logging.log('Edit Suggestion server has been initialized')

            // Register handler for edit suggestions request
            lsp.extensions.onEditSuggestions(async (params: EditSuggestionsParams) => {
                try {
                    const document = await workspace.getTextDocument(params.textDocument.uri)
                    if (!document) {
                        logging.error(`Document not found: ${params.textDocument.uri}`)
                        return { sessionId: '', suggestions: [] }
                    }

                    // Include edit history in the request
                    const editHistory = editHistoryTracker.getEdits(params.textDocument.uri)
                    const paramsWithHistory = {
                        ...params,
                        editHistory,
                    }

                    return await editSuggestionHandler.handleEditSuggestionsRequest(paramsWithHistory, document)
                } catch (error) {
                    logging.error(`Error handling edit suggestion request: ${error}`)
                    return { sessionId: '', suggestions: [] }
                }
            })

            // Register handler for logging edit suggestion results
            lsp.extensions.onLogEditSuggestionsResults((params: LogEditSuggestionsParams) => {
                try {
                    editSuggestionHandler.handleLogResults(params)
                } catch (error) {
                    logging.error(`Error handling log results: ${error}`)
                }
            })
        })

        // Track document changes
        lsp.onDidChangeTextDocument(async (p: DidChangeTextDocumentParams) => {
            try {
                const document = await workspace.getTextDocument(p.textDocument.uri)
                if (!document) {
                    return
                }

                // Process each content change
                const edits: DocumentEdit[] = p.contentChanges.map((change: TextDocumentContentChangeEvent) => {
                    // Handle both full and incremental text document content changes
                    const range =
                        'range' in change
                            ? change.range
                            : {
                                  start: { line: 0, character: 0 },
                                  end: { line: 0, character: 0 },
                              }

                    const rangeLength = 'rangeLength' in change ? change.rangeLength || 0 : 0

                    return {
                        timestamp: Date.now(),
                        version: document.version,
                        range: range,
                        text: change.text,
                        rangeLength: rangeLength,
                    }
                })

                editHistoryTracker.trackEdits(document.uri, edits)
            } catch (error) {
                logging.error(`Error tracking document changes: ${error}`)
            }
        })

        // Clean up when documents are closed
        lsp.onDidCloseTextDocument((event: DidCloseTextDocumentParams) => {
            editHistoryTracker.clearEdits(event.textDocument.uri)
        })

        return () => {
            // Cleanup function
        }
    }
