import {
    EditSuggestion,
    EditSuggestionsParams,
    EditSuggestionsResult,
    LogEditSuggestionsParams,
    TextDocument,
} from '@aws/language-server-runtimes/server-interface'
import { v4 as uuidv4 } from 'uuid'
import { svgGenerator } from './svgGenerator'

/**
 * Interface for CodeWhisperer service request
 */
interface GenerateCompletionsRequest {
    fileContext: {
        filename: string
        content: string
        programmingLanguage: string
    }
    editorState?: any
    maxResults?: number
    predictionTypes?: string[]
    nextToken?: string
    supplementalContexts?: SupplementalContext[]
}

/**
 * Interface for supplemental context
 */
interface SupplementalContext {
    filePath: string
    content: string
    type: string
    metadata?: {
        temporalContextMetadata?: {
            timeOffset: number
        }
    }
}

/**
 * Handler for edit suggestions
 */
export class EditSuggestionsHandler {
    /**
     * Handles edit suggestion requests
     */
    public async handleEditSuggestionsRequest(
        params: EditSuggestionsParams,
        document: TextDocument
    ): Promise<EditSuggestionsResult> {
        // In a real implementation, this would call the CodeWhisperer API
        // Here we're preparing the request according to the updated API format

        // Build the service request
        const serviceRequest = this.buildServiceRequest(params, document)

        // For now, we'll mock the service response
        // In a real implementation, this would be the result of calling the CodeWhisperer API
        const mockServiceResponse = this.mockServiceResponse(params, document)

        // Process the response
        return this.processServiceResponse(mockServiceResponse, document)
    }

    /**
     * Builds a request for the CodeWhisperer service
     */
    private buildServiceRequest(params: EditSuggestionsParams, document: TextDocument): GenerateCompletionsRequest {
        // Extract filename from URI
        const filename = this.getFileNameFromUri(params.textDocument.uri)

        // Determine programming language
        const programmingLanguage = this.getLanguageIdFromUri(params.textDocument.uri)

        // Basic request structure
        const request: GenerateCompletionsRequest = {
            fileContext: {
                filename,
                content: document.getText(),
                programmingLanguage,
            },
            predictionTypes: ['EDITS'], // Request edit predictions
            maxResults: 5,
        }

        // Add edit history as temporal supplemental context
        if (params.editHistory && params.editHistory.length > 0) {
            const currentTime = Date.now()
            request.supplementalContexts = params.editHistory.map(edit => ({
                filePath: filename,
                content: JSON.stringify(edit),
                type: 'TEMPORAL',
                metadata: {
                    temporalContextMetadata: {
                        timeOffset: currentTime - edit.timestamp,
                    },
                },
            }))
        }

        return request
    }

    /**
     * Mocks a service response for testing
     */
    private mockServiceResponse(params: EditSuggestionsParams, document: TextDocument): any {
        // Get the current line
        const position = params.position || { line: 0, character: 0 }
        const lines = document.getText().split('\n')
        const line = lines[position.line] || ''

        // Create a mock response following the new API format
        return {
            predictions: [
                {
                    edits: {
                        content: line + ';',
                        references: [],
                    },
                },
            ],
            completions: [],
        }
    }

    /**
     * Processes the service response into EditSuggestionsResult
     */
    private processServiceResponse(response: any, document: TextDocument): EditSuggestionsResult {
        const suggestions: EditSuggestion[] = []
        const sessionId = uuidv4()

        // Extract edits from predictions
        if (response.predictions) {
            for (const prediction of response.predictions) {
                if (prediction.edits) {
                    // Get edit content
                    const edit = prediction.edits

                    // For this mock implementation, we'll use a simple range
                    // In a real implementation, the range would come from the service or be calculated
                    const position = { line: 0, character: 0 }
                    const lines = document.getText().split('\n')
                    const line = lines[position.line] || ''

                    // Create suggestion
                    const suggestion: EditSuggestion = {
                        itemId: uuidv4(),
                        range: {
                            start: { line: position.line, character: 0 },
                            end: { line: position.line, character: line.length },
                        },
                        newText: edit.content,
                        references: edit.references,
                    }

                    // Generate SVG for the suggestion using the SVG generator service
                    suggestion.svgImage = svgGenerator.generateSimpleDiffSvg(line, suggestion.newText)

                    suggestions.push(suggestion)
                }
            }
        }

        return {
            sessionId,
            suggestions,
        }
    }

    /**
     * Handles logging edit suggestion results
     */
    public handleLogResults(params: LogEditSuggestionsParams): void {
        // In a real implementation, this would log telemetry data
        console.log(`Edit suggestion session ${params.sessionId} results logged`)
    }

    /**
     * Extracts filename from URI
     */
    private getFileNameFromUri(uri: string): string {
        try {
            // Remove protocol and get path
            const path = uri.replace(/^file:\/\//, '')

            // Extract filename from path
            const parts = path.split(/[\/\\]/)
            return parts[parts.length - 1] || path
        } catch (error) {
            return uri
        }
    }

    /**
     * Determines language ID from URI
     */
    private getLanguageIdFromUri(uri: string): string {
        try {
            // Extract extension
            const extension = uri.split('.').pop()?.toLowerCase()

            // Map extension to language ID
            const extensionMap: Record<string, string> = {
                js: 'javascript',
                ts: 'typescript',
                py: 'python',
                java: 'java',
                cs: 'csharp',
                go: 'go',
                rb: 'ruby',
                php: 'php',
                html: 'html',
                css: 'css',
                json: 'json',
                md: 'markdown',
                xml: 'xml',
                yaml: 'yaml',
                yml: 'yaml',
                sh: 'shellscript',
                c: 'c',
                cpp: 'cpp',
                h: 'c',
                hpp: 'cpp',
            }

            return extension ? extensionMap[extension] || 'plaintext' : 'plaintext'
        } catch (error) {
            return 'plaintext'
        }
    }
}
