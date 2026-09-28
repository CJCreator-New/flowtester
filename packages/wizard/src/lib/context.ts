export interface ReferenceFile {
  name: string;
  content: string;
}

export const ACCEPTED_EXTENSIONS = ['.md', '.markdown', '.txt'];
export const MAX_FILE_BYTES = 1024 * 1024;

const NAMED_FORMATS: Record<string, string> = {
  '.pdf': 'a PDF',
  '.doc': 'a Word document',
  '.docx': 'a Word document',
  '.pages': 'a Pages document',
  '.rtf': 'a rich-text document',
  '.odt': 'an OpenDocument file',
  '.png': 'an image',
  '.jpg': 'an image',
  '.jpeg': 'an image',
};

/** Returns null when the file can be used, otherwise a sentence saying why not and what to do instead. */
export function rejectReason(name: string, sizeBytes: number): string | null {
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')).toLowerCase() : '';
  if (!ACCEPTED_EXTENSIONS.includes(ext)) {
    const kind = NAMED_FORMATS[ext] ?? 'not a text file';
    return `“${name}” is ${kind}. Only text (.txt) and Markdown (.md) files can be added. Copy its text into the box below instead.`;
  }
  if (sizeBytes > MAX_FILE_BYTES) {
    return `“${name}” is larger than 1 MB. Add the parts that describe how the product should work.`;
  }
  return null;
}

/**
 * Joins every file and the pasted notes into one Product Context document. Each source gets its
 * own top-level heading, so the heading-based context parser keeps them apart and still sees each
 * file's own headings as separate requirements. Returns undefined when there is nothing to send.
 */
export function buildProductContext(files: ReferenceFile[], pasted: string): string | undefined {
  const parts = files
    .filter((f) => f.content.trim())
    .map((f) => `# Reference file: ${f.name}\n\n${f.content.trim()}\n`);
  if (pasted.trim()) parts.push(`# Pasted notes\n\n${pasted.trim()}\n`);
  return parts.length > 0 ? parts.join('\n') : undefined;
}
