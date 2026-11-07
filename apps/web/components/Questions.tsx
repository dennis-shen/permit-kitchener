"use client";
import type { QuestionAnswer, ThresholdQuestion } from "@permit/schema";

/** Threshold questions from data/requirements/*.json. Answers decide whether a permit is needed and which items apply. */
export function Questions({ questions, answers, onChange }: {
  questions: ThresholdQuestion[]; answers: Record<string, QuestionAnswer>; onChange: (id: string, a: QuestionAnswer | undefined) => void;
}) {
  return (
    <div className="card">
      {questions.map((q) => (
        <fieldset className="question" key={q.id}>
          <legend className="q">{q.text}</legend>
          {q.help && <span className="help">{q.help}</span>}
          {q.kind === "yes_no" ? (
            <div className="choices">
              {(["yes", "no", "unsure"] as const).map((v) => (
                <label className="choice" key={v}>
                  <input type="radio" name={q.id} value={v} checked={answers[q.id] === v} onChange={() => onChange(q.id, v)} />
                  {v === "yes" ? "Yes" : v === "no" ? "No" : "Not sure"}
                </label>
              ))}
            </div>
          ) : (
            <div className="number-input">
              <input type="number" inputMode="decimal" min={q.min} step={q.step} aria-label={`${q.text} (${q.unit})`}
                value={typeof answers[q.id] === "number" ? String(answers[q.id]) : ""}
                disabled={answers[q.id] === "unsure"}
                onChange={(e) => onChange(q.id, e.target.value === "" ? undefined : Number(e.target.value))} />
              <span>{q.unit}</span>
              <label className="check" style={{ marginLeft: 12 }}>
                <input type="checkbox" checked={answers[q.id] === "unsure"} onChange={(e) => onChange(q.id, e.target.checked ? "unsure" : undefined)} />
                I don&apos;t know yet
              </label>
            </div>
          )}
        </fieldset>
      ))}
    </div>
  );
}
