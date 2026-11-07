"use client";
import { useRef, useState } from "react";
import type { Finding } from "@permit/schema";
import type { UploadedFile } from "../lib/store";

/** Upload area for one requirement. Accepts several files (e.g. multiple sheets). */
export function UploadSlot({ id, label, files, onChange, prechecks, note }: {
  id: string; label: string; files: UploadedFile[]; onChange: (f: UploadedFile[]) => void; prechecks: Finding[]; note?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  async function add(list: FileList | null) {
    if (!list?.length) return;
    const added = await Promise.all([...list].map(async (f) => ({ name: f.name, type: f.type, bytes: new Uint8Array(await f.arrayBuffer()) })));
    onChange([...files, ...added]);
  }
  return (
    <div>
      <div className={`drop ${over ? "over" : ""}`} data-slot={id}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); void add(e.dataTransfer.files); }}>
        <p style={{ margin: 0, fontWeight: 700 }}>Upload {label.toLowerCase()}</p>
        <p className="help" style={{ margin: "2px 0 8px" }}>Drag PDF files here, or</p>
        <button type="button" className="btn small secondary" onClick={() => input.current?.click()}>Choose files</button>
        <input ref={input} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.docx" className="sr"
          aria-label={`Upload ${label}`} onChange={(e) => { void add(e.target.files); e.target.value = ""; }} />
      </div>
      {note && <p className="help">{note}</p>}
      {files.length > 0 && (
        <ul className="files" aria-label={`Files for ${label}`}>
          {files.map((f, i) => {
            const issues = prechecks.filter((p) => p.evidence[0]?.filename === f.name);
            return (
              <li key={f.name + i}>
                <span>
                  {f.name} <span className="muted">({Math.max(1, Math.ceil(f.bytes.byteLength / 1024))} KB)</span>
                  {issues.map((p) => <span key={p.id} className={`chip ${p.category}`} style={{ marginLeft: 6 }}>{p.message}</span>)}
                </span>
                <button type="button" className="btn small secondary" onClick={() => onChange(files.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`}>Remove</button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
