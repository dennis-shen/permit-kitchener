"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { ApplicationInfo, ProjectType, QuestionAnswer } from "@permit/schema";
import type { ReviewState } from "./merge";

export interface UploadedFile { name: string; bytes: Uint8Array; type: string }

/** Upload slot id for files that don't belong to a specific requirement. */
export const OTHER_SLOT = "other";

export interface AppState {
  projectType: ProjectType | null;
  projectQuery: string;
  application: ApplicationInfo | null;
  /** Threshold-question answers keyed by question id (data/requirements/*.json). */
  answers: Record<string, QuestionAnswer>;
  /** Detail checkboxes ticked by the applicant ("my documents show this"). */
  checks: Record<string, boolean>;
  review: ReviewState | null;
  demoId?: string;
}

export const INITIAL: AppState = { projectType: null, projectQuery: "", application: null, answers: {}, checks: {}, review: null };
const KEY = "permitready-state-v2";

interface Ctx {
  state: AppState;
  set: (patch: Partial<AppState>) => void;
  reset: () => void;
  hydrated: boolean;
  /** Uploaded files by requirement slot. Kept in memory only, never persisted. */
  files: Record<string, UploadedFile[]>;
  setFiles: (f: Record<string, UploadedFile[]>) => void;
}

const StoreContext = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(INITIAL);
  const [hydrated, setHydrated] = useState(false);
  const [files, setFiles] = useState<Record<string, UploadedFile[]>>({});
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) setState({ ...INITIAL, ...JSON.parse(raw) });
    } catch {
      /* storage unavailable */
    }
    setHydrated(true);
  }, []);
  const set = (patch: Partial<AppState>) =>
    setState((s) => {
      const next = { ...s, ...patch };
      try {
        // page previews are large; keep them out of storage
        const slim = next.review?.vision
          ? { ...next, review: { ...next.review, vision: { ...next.review.vision, documents: next.review.vision.documents.map((d) => ({ ...d, previews: [] })) } } }
          : next;
        sessionStorage.setItem(KEY, JSON.stringify(slim));
      } catch {
        /* ignore */
      }
      return next;
    });
  const reset = () => {
    setState(INITIAL);
    setFiles({});
    try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
  };
  return <StoreContext.Provider value={{ state, set, reset, hydrated, files, setFiles }}>{children}</StoreContext.Provider>;
}

export function useStore(): Ctx {
  const c = useContext(StoreContext);
  if (!c) throw new Error("StoreProvider missing");
  return c;
}
