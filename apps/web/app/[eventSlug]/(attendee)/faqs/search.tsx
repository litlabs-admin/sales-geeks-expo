"use client";

import { useMemo, useState } from "react";
import Fuse from "fuse.js";

type Faq = {
  id: string;
  question: string;
  answer: string;
};

/* ── Light theme palette ── */
const INK           = "#0A0E14";
const INK_BODY      = "#1F2937";
const BG            = "#FFFFFF";
const BORDER        = "#E5E7EB";
const BORDER_STRONG = "#CBD5E1";

const SHADOW_CARD = "0 1px 2px rgba(15,18,23,0.06), 0 1px 3px rgba(15,18,23,0.06)";

export default function FaqSearch({ faqs }: { faqs: Faq[] }) {
  const [query, setQuery] = useState("");
  const fuse = useMemo(
    () => new Fuse(faqs, { keys: ["question", "answer"], threshold: 0.35 }),
    [faqs]
  );
  const results = query.trim() ? fuse.search(query).map((result) => result.item) : faqs;

  return (
    <div className="mt-5">
      <input
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search FAQs"
        value={query}
        style={{
          width: "100%",
          background: BG, border: `1.5px solid ${BORDER_STRONG}`, borderRadius: 10,
          color: INK, fontSize: 15, padding: "12px 14px", outline: "none",
          fontFamily: "inherit",
        }}
      />
      <div className="mt-4 grid gap-3">
        {results.map((faq) => (
          <article
            key={faq.id}
            style={{
              borderRadius: 12, padding: "14px 16px",
              background: BG, border: `1px solid ${BORDER}`,
              boxShadow: SHADOW_CARD,
            }}
          >
            <h2 style={{ fontSize: 14, fontWeight: 700, color: INK, margin: 0 }}>{faq.question}</h2>
            <p style={{ marginTop: 6, fontSize: 13, color: INK_BODY, lineHeight: 1.6 }}>{faq.answer}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
