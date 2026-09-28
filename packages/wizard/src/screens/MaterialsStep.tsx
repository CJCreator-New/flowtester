import { useRef, useState } from 'react';
import { ErrorMessage, Lead, Question, Spinner } from '../components/Shell';
import { ACCEPTED_EXTENSIONS, rejectReason, type ReferenceFile } from '../lib/context';

export function MaterialsStep({
  files,
  pasted,
  onFilesChange,
  onPastedChange,
  onBack,
  onStart,
  starting,
  startError,
}: {
  files: ReferenceFile[];
  pasted: string;
  onFilesChange: (files: ReferenceFile[]) => void;
  onPastedChange: (text: string) => void;
  onBack: () => void;
  onStart: () => void;
  starting: boolean;
  startError: string | null;
}) {
  const [rejected, setRejected] = useState<string[]>([]);
  const input = useRef<HTMLInputElement>(null);

  const addFiles = async (list: FileList | null) => {
    if (!list) return;
    const accepted: ReferenceFile[] = [];
    const problems: string[] = [];
    for (const file of Array.from(list)) {
      const reason = rejectReason(file.name, file.size);
      if (reason) problems.push(reason);
      else accepted.push({ name: file.name, content: await file.text() });
    }
    // Re-adding a file with the same name replaces the old copy.
    const kept = files.filter((f) => !accepted.some((a) => a.name === f.name));
    onFilesChange([...kept, ...accepted]);
    setRejected(problems);
    if (input.current) input.current.value = '';
  };

  const hasMaterial = files.length > 0 || pasted.trim().length > 0;

  return (
    <section className="max-w-prose">
      <Question>Anything that explains how it should work?</Question>
      <Lead>
        Optional. Product notes, user stories or descriptions of how people use it help the AI decide what to test. Add as
        many as you like, or skip this and start.
      </Lead>

      <p className="label">Add text or Markdown files</p>
      <p id="reference-files-hint" className="hint mb-3">
        Files ending in .txt or .md. For PDFs or Word documents, copy the text into the box below.
      </p>
      {/* The native control is visually hidden (its "No file chosen" text contradicts the list below); the label is the button. */}
      <input
        ref={input}
        id="reference-files"
        type="file"
        multiple
        accept={[...ACCEPTED_EXTENSIONS, 'text/plain', 'text/markdown'].join(',')}
        aria-describedby="reference-files-hint"
        onChange={(e) => addFiles(e.target.files)}
        className="peer sr-only"
      />
      <label
        htmlFor="reference-files"
        className="btn-quiet cursor-pointer peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-[3px] peer-focus-visible:outline-stamp"
      >
        {files.length > 0 ? 'Add more files' : 'Choose files'}
        <span className="sr-only"> to add as text or Markdown files</span>
      </label>

      {rejected.length > 0 && (
        <div role="alert" className="mt-4 rounded-md border-l-4 border-fail bg-fail-tint px-4 py-3 text-fail">
          <p className="font-bold">{rejected.length === 1 ? 'This file wasn’t added:' : 'These files weren’t added:'}</p>
          <ul className="mt-1 list-disc pl-5">
            {rejected.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {files.length > 0 && (
        <ul className="mt-4 divide-y divide-rule rounded-md border-2 border-edge bg-surface" aria-label="Files added">
          {files.map((f) => (
            <li key={f.name} className="flex items-center justify-between gap-4 px-4 py-2">
              <span className="break-all font-bold">{f.name}</span>
              <button
                type="button"
                className="btn-link shrink-0"
                aria-label={`Remove ${f.name}`}
                onClick={() => onFilesChange(files.filter((x) => x.name !== f.name))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <label htmlFor="pasted-notes" className="label mt-8">
        Or paste notes here
      </label>
      <textarea
        id="pasted-notes"
        className="field min-h-[10rem]"
        value={pasted}
        onChange={(e) => onPastedChange(e.target.value)}
        placeholder="For example: Customers can apply one discount code at checkout. Codes are not case-sensitive."
      />

      {startError && <ErrorMessage>{startError}</ErrorMessage>}

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <button type="button" className="btn-primary" onClick={onStart} disabled={starting}>
          {starting ? <Spinner label="Starting the check-up…" /> : hasMaterial ? 'Start the check-up' : 'Skip and start the check-up'}
        </button>
        <button type="button" className="btn-link" onClick={onBack} disabled={starting}>
          Back
        </button>
      </div>
    </section>
  );
}
