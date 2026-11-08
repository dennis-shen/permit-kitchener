"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { ApplicationInfo, DocumentType, ProjectType, QuestionAnswer } from "@permit/schema";
import type { PageReview } from "./review";

export interface UploadedFile { name: string; bytes: Uint8Array; type: string }

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
const KEY = "permitready-state-v3";

interface Ctx {
  state: AppState;
  set: (patch: Partial<AppState>) => void;
  reset: () => void;
  hydrated: boolean;
  markVisited: (path: string) => void;
  /** One uploaded PDF per document page. In memory only; never persisted. */
  files: Partial<Record<DocumentType, UploadedFile>>;
  setFile: (page: DocumentType, f: UploadedFile | null) => void;
  setFiles: (f: Partial<Record<DocumentType, UploadedFile>>) => void;
  /** Automatic check result per document page (in memory). */
  reviews: Partial<Record<DocumentType, PageReview>>;
  setReview: (page: DocumentType, r: PageReview | null) => void;
}

const StoreContext = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(INITIAL);
  const [hydrated, setHydrated] = useState(false);
  const [files, setFilesState] = useState<Partial<Record<DocumentType, UploadedFile>>>({});
  const [reviews, setReviews] = useState<Partial<Record<DocumentType, PageReview>>>({});
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) setState({ ...INITIAL, ...JSON.parse(raw) });
    } catch {
      /* storage unavailable */
    }
    setHydrated(true);
  }, []);
  const set = useCallback((patch: Partial<AppState>) =>
    setState((s) => {
      const next = { ...s, ...patch };
      try { sessionStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    }), []);
  const markVisited = useCallback((path: string) =>
    setState((s) => {
      if (s.visited.includes(path)) return s;
      const next = { ...s, visited: [...s.visited, path] };
      try { sessionStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    }), []);
  const setFile = useCallback((page: DocumentType, f: UploadedFile | null) => {
    setFilesState((x) => { const n = { ...x }; if (f) n[page] = f; else delete n[page]; return n; });
    setReviews((x) => { const n = { ...x }; delete n[page]; return n; });
  }, []);
  const setReview = useCallback((page: DocumentType, r: PageReview | null) =>
    setReviews((x) => { const n = { ...x }; if (r) n[page] = r; else delete n[page]; return n; }), []);
  const reset = () => {
    setState(INITIAL);
    setFilesState({});
    setReviews({});
    try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
  };
  return (
    <StoreContext.Provider value={{ state, set, reset, hydrated, markVisited, files, setFile, setFiles: (f) => { setFilesState(f); setReviews({}); }, reviews, setReview }}>
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
