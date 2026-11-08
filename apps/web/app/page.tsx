"use client";
import { useRouter } from "next/navigation";
import { useStore } from "../lib/store";

export default function Home() {
  const router = useRouter();
  const { reset } = useStore();
  return (
    <>
      <div className="hero">
        <h1>Check your building permit application before you submit it</h1>
        <p className="lead">
          Find out what your project needs, upload your forms and drawings, and see what is missing and where to add it,
          so you can submit a complete application the first time.
        </p>
        <button type="button" className="btn" onClick={async () => { await reset(); router.push("/project"); }}>Start</button>
      </div>

      <ol className="steps-list" aria-label="How it works">
        <li><strong>Choose your project</strong><br />Pick or type the kind of work you are planning.</li>
        <li><strong>Preview</strong><br />A few questions tell you whether a permit is likely needed.</li>
        <li><strong>Application and documents</strong><br />Enter your details, then upload each PDF on its own page. We check each one automatically.</li>
        <li><strong>Declare, review and download</strong><br />Sign the declaration, see anything unfinished, and download a PDF summary.</li>
      </ol>

    </>
  );
}
