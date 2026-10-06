/**
 * The home page's public explanation: what the tool is, how it works, and the questions people (and
 * answer engines) ask. This visible text mirrors the FAQPage / HowTo structured data in index.html,
 * so what a search or AI engine reads is what a visitor sees. Keep the two in step.
 */
export const HOME_FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'What is Release check-up?',
    a: 'Release check-up is a pre-release QA tool that scans a web app, drafts a test plan, runs real-browser tests and reports problems with functionality, accessibility, performance, security and search readiness in plain language.',
  },
  {
    q: 'Does it check SEO, AEO and GEO?',
    a: 'Yes. It checks classic SEO (titles, descriptions, canonicals, structured data), answer-engine optimization (AEO: question-style headings, FAQ and HowTo markup, concise answers) and generative-engine optimization (GEO: entity clarity, llms.txt, AI-crawler access and citable facts).',
  },
  {
    q: 'Will it change or break my site?',
    a: "Not unless you allow it. In 'only look' mode nothing is filled in, sent or changed. Full testing is meant for your own test copy.",
  },
  {
    q: 'Where does my data go?',
    a: 'Release check-up runs on your own machine. Reports and evidence are stored locally, and AI features use only the API key you provide.',
  },
  {
    q: 'Do I need to write tests?',
    a: 'No. The tool discovers your pages and proposes the tests; you only review and approve the plan.',
  },
];

const STEPS: Array<{ name: string; text: string }> = [
  { name: 'Enter your site address', text: 'Paste the URL of the site or staging copy you want checked and choose how much the tool may interact with it.' },
  { name: 'Review the scan and plan', text: 'The tool maps your pages and drafts a test plan of the journeys that matter. Edit it, then approve it.' },
  { name: 'Run the tests', text: 'Real-browser tests run the approved plan and watch for functional, accessibility, performance, security and search-readiness problems.' },
  { name: 'Read the report', text: 'Get a plain-language verdict, prioritised fixes and evidence such as screenshots, and re-run to confirm fixes.' },
];

export function HomeInfo() {
  return (
    <>
      <section aria-labelledby="how-title" className="mt-14">
        <h2 id="how-title" className="mb-3 text-lg font-bold">
          How does a release check-up work?
        </h2>
        <ol className="list-decimal space-y-2 pl-6">
          {STEPS.map((s) => (
            <li key={s.name}>
              <strong>{s.name}.</strong> <span className="text-ink-soft">{s.text}</span>
            </li>
          ))}
        </ol>
      </section>
      <section aria-labelledby="faq-title" className="mt-10">
        <h2 id="faq-title" className="mb-3 text-lg font-bold">
          Frequently asked questions
        </h2>
        <div className="divide-y divide-rule rounded-lg border border-rule bg-surface/60">
          {HOME_FAQ.map((item) => (
            <details key={item.q} className="px-4 py-3">
              <summary className="cursor-pointer font-bold">{item.q}</summary>
              <p className="mt-2 text-ink-soft">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
