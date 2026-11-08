"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { factsFromAnswers } from "@permit/engine";
import { clearSaved, listSaved, removeSaved, saveFile } from "@permit/files";
import type { ApplicationInfo, DocumentType, Finding, ProjectType, QuestionAnswer, SessionFiles, StoredFile } from "@permit/schema";
import type { PageReview } from "./review";

/** A saved upload. The file itself is stored by the review service; the browser keeps only this. */
export type UploadedFile = StoredFile;
/** A file picked in the browser, before it is saved. */
export interface NewFile { name: string; type: string; bytes: Uint8Array }

/** Declaration of applicant (Ontario form, Section I) and related declarations, confirmed at the end. */
export interface Declaration {
  /** Name as printed in the declaration ("I, ____, declare that…"). */
  name: string;
  /** "The information … is true to the best of my knowledge." */
  declared: boolean;
  /** Section I signed and dated on the application form PDF. */
  signed: boolean;
  /** Authority to bind the corporation or partnership (only when applying for an organisation). */
  authority: boolean;
  /** Schedule 1 (Designer information) completed and signed by the designer (ICI). */
  designer: boolean;
}

export interface AppState {
  projectType: ProjectType | null;
  projectQuery: string;
  /** Preview answers (permit threshold questions) keyed by question id. */
  answers: Record<string, QuestionAnswer>;
  application: ApplicationInfo | null;
  declaration: Declaration;
  /** Step paths the applicant has visited; only these are clickable in the step bar. */
  visited: string[];
  demoId?: string;
}

export const EMPTY_DECLARATION: Declaration = { name: "", declared: false, signed: false, authority: false, designer: false };
export const INITIAL: AppState = { projectType: null, projectQuery: "", answers: {}, application: null, declaration: EMPTY_DECLARATION, visited: [] };
const KEY = "permitready-state-v4";

interface Ctx {
  state: AppState;
  set: (patch: Partial<AppState>) => void;
  /** Clear everything, including the saved files on the server. */
  reset: () => Promise<void>;
  hydrated: boolean;
  markVisited: (path: string) => void;
  /** The saved PDF of each document page (from the server; survives reloads and going back). */
  files: Partial<Record<DocumentType, UploadedFile>>;
  /** The review of each page's saved PDF ("checking" while it is being saved). */
  reviews: Partial<Record<DocumentType, PageReview>>;
  /** Save (or replace) a page's PDF on the server, then review it. */
  upload: (page: DocumentType, f: NewFile, ctx?: { application: ApplicationInfo; projectType: ProjectType; answers: Record<string, QuestionAnswer> }) => Promise<void>;
  /** Remove a page's saved PDF. */
  remove: (page: DocumentType) => Promise<void>;
}

const StoreContext = createContext<Ctx | null>(null);

function saveFailed(name: string, reason: string): Finding {
  return {
    id: `file:SAVE_FAILED:${name}`, category: "wrong", severity: "blocker",
    message: `This file was not saved (${reason}). Upload it again.`,
    evidence: [{ filename: name, page: 1, expectedRegion: false, confidence: 1, source: "rule" }],
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(INITIAL);
  const [hydrated, setHydrated] = useState(false);
  const [files, setFilesState] = useState<Partial<Record<DocumentType, UploadedFile>>>({});
  const [reviews, setReviews] = useState<Partial<Record<DocumentType, PageReview>>>({});
  const stateRef = useRef(state);
  stateRef.current = state;
  // latest list from the server, plus local overlays: uploads in progress and uploads that failed
  const saved = useRef<SessionFiles["files"]>([]);
  const pending = useRef(new Map<DocumentType, UploadedFile>());
  const failed = useRef(new Map<DocumentType, { file: UploadedFile; reason: string }>());
  const inflight = useRef(0);

  const render = useCallback(() => {
    const f: Partial<Record<DocumentType, UploadedFile>> = {};
    const r: Partial<Record<DocumentType, PageReview>> = {};
    for (const s of saved.current) { f[s.page] = s.file; r[s.page] = { status: "done", result: s.review, file: s.file }; }
    for (const [page, file] of failed.current) { f[page] = file.file; r[page] = { status: "error", reason: file.reason, findings: [saveFailed(file.file.name, file.reason)], file: file.file }; }
    for (const [page, file] of pending.current) { f[page] = file; r[page] = { status: "checking", file }; }
    setFilesState(f);
    setReviews(r);
  }, []);

  /** Run one change against the server, then show the server's list (re-read once nothing else is in flight). */
  const mutate = useCallback(async (op: () => Promise<SessionFiles>, page?: DocumentType, file?: UploadedFile) => {
    inflight.current++;
    try {
      const res = await op();
      saved.current = res.files;
      if (page) failed.current.delete(page);
    } catch (e) {
      if (page && file) failed.current.set(page, { file, reason: e instanceof Error ? e.message : String(e) });
    } finally {
      if (page && pending.current.get(page) === file) pending.current.delete(page);
      inflight.current--;
    }
    if (inflight.current === 0 && page) {
      try { saved.current = (await listSaved()).files; } catch { /* keep what we have */ }
    }
    render();
  }, [render]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setState({ ...INITIAL, ...JSON.parse(raw) });
    } catch {
      /* storage unavailable */
    }
    // ready once the saved files are known too (or the service could not be reached)
    void mutate(() => listSaved()).finally(() => setHydrated(true));
  }, [mutate]);

  const persist = (next: AppState) => { try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ } };
  const set = useCallback((patch: Partial<AppState>) =>
    setState((s) => { const next = { ...s, ...patch }; persist(next); stateRef.current = next; return next; }), []);
  const markVisited = useCallback((path: string) =>
    setState((s) => {
      if (s.visited.includes(path)) return s;
      const next = { ...s, visited: [...s.visited, path] };
      persist(next);
      return next;
    }), []);

  const upload = useCallback<Ctx["upload"]>(async (page, f, ctx) => {
    const st = ctx ?? stateRef.current;
    const meta: UploadedFile = { id: `pending-${Date.now()}-${Math.random()}`, name: f.name, type: f.type, size: f.bytes.byteLength, uploaded_at: Date.now() * 1e6 };
    pending.current.set(page, meta);
    failed.current.delete(page);
    render();
    if (!st.application || !st.projectType) return;
    const application = st.application;
    const facts = factsFromAnswers(st.projectType, st.answers) as Record<string, number | boolean | string>;
    await mutate(() => saveFile(page, f, { application, project_attributes: facts, document_hints: { [f.name]: page } }), page, meta);
  }, [mutate, render]);

  const remove = useCallback(async (page: DocumentType) => {
    pending.current.delete(page);
    failed.current.delete(page);
    saved.current = saved.current.filter((s) => s.page !== page);
    render();
    await mutate(() => removeSaved(page), page);
  }, [mutate, render]);

  const reset = useCallback(async () => {
    setState(INITIAL);
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
    pending.current.clear();
    failed.current.clear();
    saved.current = [];
    render();
    try { await clearSaved(); } catch { /* service down: nothing to clear */ }
  }, [render]);

  return (
    <StoreContext.Provider value={{ state, set, reset, hydrated, markVisited, files, reviews, upload, remove }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): Ctx {
  const c = useContext(StoreContext);
  if (!c) throw new Error("StoreProvider missing");
  return c;
}

/** Mark a step as visited when its page is shown. */
export function useVisit(path: string) {
  const { markVisited, hydrated } = useStore();
  useEffect(() => { if (hydrated) markVisited(path); }, [hydrated, markVisited, path]);
}
