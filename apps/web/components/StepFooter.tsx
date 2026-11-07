"use client";
import type { ReactNode } from "react";

/** Back / Continue buttons at the bottom of each step. */
export function StepFooter({ back, onContinue, continueLabel = "Continue", continueDisabled, busy, extra }: {
  back?: string; onContinue?: () => void; continueLabel?: string; continueDisabled?: boolean; busy?: boolean; extra?: ReactNode;
}) {
  return (
    <div className="step-footer">
      <div className="row">{back ? <a className="btn secondary" href={back}>Back</a> : <span />}</div>
      <div className="row">
        {extra}
        {onContinue && (
          <button className="btn" onClick={onContinue} disabled={continueDisabled || busy}>{busy ? "Please wait…" : continueLabel}</button>
        )}
      </div>
    </div>
  );
}
