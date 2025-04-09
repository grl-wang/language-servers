import { Range } from 'vscode-languageserver-types'

/**
 * Interface for document edit
 */
export interface DocumentEdit {
    timestamp: number
    version: number
    range: Range
    text: string
    rangeLength: number
}

/**
 * Tracks edit history for documents
 */
export class EditHistoryTracker {
    private fileEdits: Map<string, DocumentEdit[]>
    private static readonly MAX_AGE_MS = 30_000 // Keep edits for 30 seconds
    private static readonly MAX_EDITS_PER_FILE = 50 // Maximum number of edits to store per file

    constructor() {
        this.fileEdits = new Map<string, DocumentEdit[]>()
    }

    /**
     * Tracks edits for a document
     */
    public trackEdits(uri: string, edits: DocumentEdit[]): void {
        const currentEdits = this.fileEdits.get(uri) || []

        // Add new edits
        const allEdits = [...currentEdits, ...edits]

        // Remove old edits
        const cutoffTime = Date.now() - EditHistoryTracker.MAX_AGE_MS
        const filteredEdits = allEdits
            .filter(edit => edit.timestamp >= cutoffTime)
            // Limit the number of edits
            .slice(-EditHistoryTracker.MAX_EDITS_PER_FILE)

        this.fileEdits.set(uri, filteredEdits)
    }

    /**
     * Gets edits for a document
     */
    public getEdits(uri: string): DocumentEdit[] {
        return this.fileEdits.get(uri) || []
    }

    /**
     * Clears edits for a document
     */
    public clearEdits(uri: string): void {
        this.fileEdits.delete(uri)
    }
}
