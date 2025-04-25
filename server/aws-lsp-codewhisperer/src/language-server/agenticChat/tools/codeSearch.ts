/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import { CommandValidation, InvokeOutput, requiresPathAcceptance, validatePath } from './toolShared'
import { Features } from '@aws/language-server-runtimes/server-interface/server'
import { getWorkspaceFolderPaths } from '@aws/lsp-core/out/util/workspaceUtils'
import { CancellationToken } from '@aws/language-server-runtimes/protocol'
import { LocalProjectContextController } from '../../../shared/localProjectContextController'
import { Chunk } from 'local-indexing'

export interface CodeSearchParams {
    query: string
    path?: string
}

export class CodeSearch {
    private readonly logging: Features['logging']
    private readonly workspace: Features['workspace']
    private readonly lsp: Features['lsp']
    constructor(features: Pick<Features, 'logging' | 'workspace' | 'lsp'>) {
        this.logging = features.logging
        this.workspace = features.workspace
        this.lsp = features.lsp
    }

    public async validate(params: CodeSearchParams): Promise<void> {
        if (!params.query || params.query.trim().length === 0) {
            throw new Error('Code search query cannot be empty.')
        }
        const searchPath = this.getOrSetSearchPath(params.path)

        if (searchPath) {
            await validatePath(searchPath, this.workspace.fs.exists)
        }
    }

    public async queueDescription(params: CodeSearchParams, updates: WritableStream, requiresAcceptance: boolean) {
        const writer = updates.getWriter()
        const closeWriter = async (w: WritableStreamDefaultWriter) => {
            await w.close()
            w.releaseLock()
        }
        if (!requiresAcceptance) {
            await writer.write('')
            await closeWriter(writer)
            return
        }

        const path = this.getOrSetSearchPath(params.path)
        await writer.write(`Performing code search for "${params.query}" in ${path}`)
        await closeWriter(writer)
    }

    public async requiresAcceptance(params: CodeSearchParams): Promise<CommandValidation> {
        if (!params.path) {
            return { requiresAcceptance: false }
        }
        return requiresPathAcceptance(params.path, this.lsp, this.logging)
    }

    public async invoke(params: CodeSearchParams, token?: CancellationToken): Promise<InvokeOutput> {
        const path = this.getOrSetSearchPath(params.path)

        try {
            const results = await this.executeCodeSearch(params.query, path)
            return this.createOutput(
                !results || results.length === 0 ? 'No code matches found for code search.' : results
            )
        } catch (error: any) {
            this.logging.error(
                `Failed to perform code search for "${params.query}" in "${path}": ${error.message || error}`
            )
            throw new Error(
                `Failed to perform code search for "${params.query}" in "${path}": ${error.message || error}`
            )
        }
    }

    private getOrSetSearchPath(path?: string): string {
        let searchPath = ''
        if (path && path.trim().length !== 0) {
            searchPath = path
        } else {
            // Handle optional path parameter
            // Use current workspace folder as default if path is not provided
            const workspaceFolders = getWorkspaceFolderPaths(this.lsp)
            if (workspaceFolders && workspaceFolders.length !== 0) {
                this.logging.debug(`Using default workspace folder: ${workspaceFolders[0]}`)
                searchPath = workspaceFolders[0]
            }
        }
        return searchPath
    }

    private async executeCodeSearch(query: string, path: string): Promise<Chunk[]> {
        this.logging.info(`Executing code search for "${query}" in "${path}"`)
        const localProjectContextController = await LocalProjectContextController.getInstance()

        if (!localProjectContextController.isEnabled) {
            this.logging.error(`Error during code search: local project context controller is disable`)
            throw new Error(`Local project context controller is disable`)
        }
        try {
            // Use the localProjectContextController to query the vector index
            const searchResults = await localProjectContextController.queryVectorIndex({ query: query })
            const searchResultsString = JSON.stringify(searchResults)
            this.logging.info(`Code searched succeed with: "${searchResults.length}", "${searchResultsString}"`)
            return searchResults
        } catch (error: any) {
            this.logging.error(`Error during code search: ${error.message || error}`)
            throw error
        }
    }

    private createOutput(content: string | any[]): InvokeOutput {
        if (typeof content === 'string') {
            return {
                output: {
                    kind: 'text',
                    content: content,
                },
            }
        } else {
            return {
                output: {
                    kind: 'json',
                    content: content,
                },
            }
        }
    }

    public getSpec() {
        return {
            name: 'codeSearch',
            description:
                "Find snippets of code from the codebase most relevant to the search query.\nThis is a semantic search tool, so the query should ask for something semantically matching what is needed.\nIf it makes sense to only search in particular directories, please specify them in the target_directories field.\nUnless there is a clear reason to use your own search query, please just reuse the user's exact query with their wording.\nTheir exact wording/phrasing can often be helpful for the semantic search query. Keeping the same exact question format can also be helpful.",
            inputSchema: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description:
                            "The code pattern, concept, or functionality to search for. This can be a natural language description of what you're looking for.",
                    },
                    path: {
                        type: 'string',
                        description:
                            'Absolute path to a directory to search in, e.g., `/repo`. If not provided, the current workspace folder will be used.',
                    },
                    explanatio: {
                        type: 'string',
                        description:
                            'One sentence explanation as to why this tool is being used, and how it contributes to the goal',
                    },
                },
                required: ['query'],
            },
        } as const
    }
}
