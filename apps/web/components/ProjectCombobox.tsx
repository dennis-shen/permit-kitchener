"use client";
import { useId, useMemo, useRef, useState } from "react";
import { PROJECT_OPTIONS, searchProjects } from "@permit/engine";
import type { ProjectType } from "@permit/schema";

/** Accessible combobox: a dropdown of project types that also accepts typing (filters by label and keywords). */
export function ProjectCombobox({ value, query, onQuery, onSelect }: {
  value: ProjectType | null; query: string; onQuery: (q: string) => void; onSelect: (t: ProjectType) => void;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const selected = PROJECT_OPTIONS.find((o) => o.type === value);
  const results = useMemo(() => (selected && query === selected.label ? PROJECT_OPTIONS : searchProjects(query)), [query, selected]);

  const choose = (t: ProjectType) => {
    const o = PROJECT_OPTIONS.find((x) => x.type === t)!;
    onSelect(t);
    onQuery(o.label);
    setOpen(false);
  };

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter" && open && results[active]) { e.preventDefault(); choose(results[active]!.type); }
    else if (e.key === "Escape") setOpen(false);
  }

  return (
    <div className="combo">
      <label className="field" htmlFor={`${id}-input`} style={{ marginBottom: 0 }}>
        What are you planning to build or change?
        <span className="help">Choose from the list, or type in your own words (for example “backyard deck” or “turn a store into a café”).</span>
      </label>
      <div className="combo-input">
        <input
          ref={input}
          id={`${id}-input`}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && results[active] ? `${id}-opt-${active}` : undefined}
          autoComplete="off"
          placeholder="Start typing or open the list"
          value={query}
          onChange={(e) => { onQuery(e.target.value); setOpen(true); setActive(0); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
        />
        <button type="button" className="combo-toggle" tabIndex={-1} aria-label="Show all project types"
          onClick={() => { setOpen(!open); input.current?.focus(); }}>▾</button>
      </div>
      {open && (
        <ul id={listId} role="listbox" aria-label="Project types">
          {results.map((o, i) => (
            <li key={o.type} id={`${id}-opt-${i}`} role="option" aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); choose(o.type); }} onMouseEnter={() => setActive(i)}>
              <strong>{o.label}</strong>
              <span>{o.description}</span>
            </li>
          ))}
          {results.length === 0 && <li className="empty">No match. Try another word, or open the list to see every project type.</li>}
        </ul>
      )}
    </div>
  );
}
