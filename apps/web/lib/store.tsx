"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { ClassificationResult, QuestionnaireAnswers, ReadinessReport } from "@permit/schema";
import type { ReviewState } from "./merge";

export interface UploadedFile { name: string; bytes: Uint8Array; type: string }

export interface AppState {
  answers: QuestionnaireAnswers;
  classification: ClassificationResult | null;
  review: ReviewState | null;
  report: ReadinessReport | null;
  demoId?: string;
}

const INITIAL: AppState = { answers: {}, classification: null, review: null, report: null };
const KEY = "permitready-state-v1";

interface Ctx {
  state: AppState;
  set: (patch: Partial<AppState>) => void;
  reset: () => void;
  /** Uploaded files live in memory only — never persisted. */
  files: UploadedFile[];
  setFiles: (f: UploadedFile[]) => void;
}

const StoreContext = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(INITIAL);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) setState(JSON.parse(raw));
    } catch {
      /* storage unavailable */
    }
  }, []);
  const set = (patch: Partial<AppState>) =>
    setState((s) => {
      const next = { ...s, ...patch };
      try {
        // previews are large; keep them out of storage
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
    setFiles([]);
    try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
  };
  return <StoreContext.Provider value={{ state, set, reset, files, setFiles }}>{children}</StoreContext.Provider>;
}

export function useStore(): Ctx {
  const c = useContext(StoreContext);
  if (!c) throw new Error("StoreProvider missing");
  return c;
}
