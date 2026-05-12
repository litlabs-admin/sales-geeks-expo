"use client";

import { useMemo, useState } from "react";
import Fuse from "fuse.js";

type Faq = {
  id: string;
  question: string;
  answer: string;
};

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
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-base"
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search FAQs"
        value={query}
      />
      <div className="mt-4 grid gap-3">
        {results.map((faq) => (
          <article className="rounded-md border border-slate-200 bg-white p-4" key={faq.id}>
            <h2 className="text-base font-semibold">{faq.question}</h2>
            <p className="mt-2 text-sm text-slate-700">{faq.answer}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
