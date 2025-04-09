import { diffChars, Change } from 'diff'

/**
 * Service for generating SVG images representing code diffs
 */
export class SvgGenerationService {
    /**
     * Generates an SVG image representing a code diff
     * @param originalCode The original code
     * @param newCode The new code with edits
     * @param language The programming language
     * @param theme The editor theme information
     */
    public generateDiffSvg(
        originalCode: string,
        newCode: string,
        language: string,
        theme: EditorThemeInfo
    ): { svgImage: string } {
        // Get edit diffs with highlight
        const diffWithHighlight = this.getHighlightEdit(originalCode.split('\n'), newCode.split('\n'))

        // Calculate dimensions based on code content
        const diffLines = this.getEditedLines(originalCode.split('\n'), newCode.split('\n'))
        const { offset } = this.calculateOffset(originalCode.split('\n'), newCode.split('\n'), diffLines, theme)
        const { width, height } = this.calculateDimensions(diffLines, theme)

        // Generate CSS for syntax highlighting based on theme
        const styles = this.generateStyles(theme)

        // Generate HTML content for the SVG
        const htmlContent = this.generateHtmlContent(diffWithHighlight, language, styles, offset)

        // Create the SVG with the HTML content
        const svgImage = `
            <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
                <foreignObject width="100%" height="100%">
                    ${htmlContent}
                </foreignObject>
            </svg>
        `

        // Return the SVG image as a base64 encoded string
        return { svgImage: Buffer.from(svgImage).toString('base64') }
    }

    /**
     * Generates a simple SVG diff visualization
     * @param originalText The original text
     * @param newText The new text
     * @returns Base64 encoded SVG image
     */
    public generateSimpleDiffSvg(originalText: string, newText: string): string {
        // Create a simple SVG showing the diff
        const width = Math.max(originalText.length, newText.length) * 8
        const height = 50

        const svgContent = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
            <style>
                .code { font-family: monospace; font-size: 14px; }
                .removed { fill: #ff6666; }
                .added { fill: #66ff66; }
                .unchanged { fill: #d4d4d4; }
                .background { fill: #1e1e1e; }
            </style>
            <rect width="100%" height="100%" class="background" />
            <text x="10" y="20" class="code removed">${this.escapeHtml(originalText)}</text>
            <text x="10" y="40" class="code added">${this.escapeHtml(newText)}</text>
        </svg>`

        // Convert to base64
        return Buffer.from(svgContent).toString('base64')
    }

    private calculateDimensions(diffLines: string[], theme: EditorThemeInfo): { width: number; height: number } {
        // Calculate width based on the longest line
        let maxLineLength = 0
        for (const line of diffLines) {
            // Strip HTML tags to get actual text length
            const textLength = line.replace(/<[^>]*>/g, '').length
            if (textLength > maxLineLength) {
                maxLineLength = textLength
            }
        }

        // Add some padding to the width
        const width = Math.max(maxLineLength * theme.fontSize * 0.7, 300) + 40

        // Calculate height based on number of lines
        const height = (diffLines.length + 1) * theme.lineHeight + 40

        return { width, height }
    }

    private generateStyles(theme: EditorThemeInfo): string {
        const {
            fontSize,
            lineHeight,
            foreground = '#d4d4d4',
            background = '#1e1e1e',
            diffAdded = 'rgba(231, 245, 231, 0.31)',
            diffRemoved = 'rgba(255, 0, 0, 0.2)',
        } = theme

        return `
            .code-container {
                font-family: 'Consolas', 'Courier New', monospace;
                font-size: ${fontSize}px;
                line-height: ${lineHeight}px;
                color: ${foreground};
                background-color: ${background};
                padding: 10px;
                border-radius: 5px;
                white-space: pre;
            }
            .diff-header {
                font-weight: bold;
                margin-bottom: 10px;
                color: #cccccc;
            }
            .diff-removed {
                white-space: pre-wrap; /* Preserve whitespace */
                background-color: ${diffRemoved};
                text-decoration: line-through;
            }
            .diff-changed {
                white-space: pre-wrap; /* Preserve whitespace */
                background-color: ${diffAdded};
            }
        `
    }

    private generateHtmlContent(diffLines: string[], language: string, styles: string, offSet: number): string {
        return `
            <div xmlns="http://www.w3.org/1999/xhtml">
                <style>${styles}</style>
                <div class="code-container" style="margin-left: ${offSet}px;">
                    <div class="diff-header">Q: Press [Tab] to accept or [Esc] to reject:</div>
                    ${diffLines.map(line => `<div>${line}</div>`).join('')}
                </div>
            </div>
        `
    }

    private getEditedLines(originalLines: string[], newLines: string[]): string[] {
        const editedLines: string[] = []

        const maxLength = Math.max(originalLines.length, newLines.length)
        for (let i = 0; i < maxLength; i++) {
            if (originalLines[i] !== newLines[i]) {
                if (originalLines[i] !== undefined && newLines[i] !== undefined) {
                    // Line was modified
                    editedLines.push(originalLines[i])
                    editedLines.push(newLines[i])
                } else if (originalLines[i] !== undefined) {
                    // Line was removed
                    editedLines.push(originalLines[i])
                } else if (newLines[i] !== undefined) {
                    // Line was added
                    editedLines.push(newLines[i])
                }
            }
        }

        return editedLines
    }

    private getHighlightEdit(originalLines: string[], newLines: string[]): string[] {
        const diffLines: string[] = []

        const maxLength = Math.max(originalLines.length, newLines.length)
        for (let i = 0; i < maxLength; i++) {
            if (originalLines[i] !== newLines[i]) {
                if (originalLines[i] !== undefined && newLines[i] !== undefined) {
                    // Line was modified - show character-level diff
                    const originalLine = originalLines[i]
                    const newLine = newLines[i]

                    // Use diff library to get character-level changes
                    const changes = diffChars(originalLine, newLine)
                    const diffLine = changes
                        .map((part: Change) => {
                            const escapedText = this.escapeHtml(part.value)
                            if (part.added) {
                                return `<span class="diff-changed">${escapedText}</span>`
                            } else if (part.removed) {
                                return `<span class="diff-removed">${escapedText}</span>`
                            } else {
                                return escapedText
                            }
                        })
                        .join('')
                    diffLines.push(diffLine)
                } else if (newLines[i] !== undefined) {
                    // Completely new line
                    diffLines.push(`<span class="diff-changed">${this.escapeHtml(newLines[i])}</span>`)
                }
            }
        }

        return diffLines
    }

    private calculateOffset(
        originalLines: string[],
        newLines: string[],
        diffLines: string[],
        theme: EditorThemeInfo
    ): { offset: number } {
        // Find the starting line of the edit in the original file
        let startLine = 0
        for (let i = 0; i < originalLines.length; i++) {
            if (originalLines[i] !== newLines[i]) {
                startLine = i
                break
            }
        }

        // Calculate the maximum line length
        let maxLineLength = 0
        for (const line of diffLines) {
            const lineLength = line.replace(/<[^>]*>/g, '').length
            if (lineLength > maxLineLength) {
                maxLineLength = lineLength
            }
        }

        // Calculate the offset based on the longest line and the starting line length
        const startLineLength = originalLines[startLine]?.length || 0
        const offset = (maxLineLength - startLineLength) * theme.fontSize * 0.7

        return { offset }
    }

    /**
     * Escapes HTML special characters
     * @param text The text to escape
     * @returns Escaped HTML text
     */
    public escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
    }
}

export interface EditorThemeInfo {
    fontSize: number
    lineHeight: number
    foreground?: string
    background?: string
    diffAdded?: string
    diffRemoved?: string
}

// Create a singleton instance for easy import
export const svgGenerator = new SvgGenerationService()
