import { Lead, Question } from '../components/Shell';

export type TargetType = 'product' | 'website';

const CHOICES: Array<{ value: TargetType; title: string; body: string }> = [
  {
    value: 'product',
    title: 'A product I work on',
    body: 'You can sign in to it, and you may have notes on how it should work. Everything gets tested, including signing in and filling in forms.',
  },
  {
    value: 'website',
    title: 'A public website',
    body: 'Any site on the internet. It’s only looked at: nothing is signed into, submitted or changed.',
  },
];

export function TargetTypeScreen({ selected, onChoose }: { selected?: TargetType; onChoose: (type: TargetType) => void }) {
  return (
    <section>
      <Question>What would you like to check?</Question>
      <Lead>Pick the one that fits. You can come back and change this.</Lead>
      <ul className="grid max-w-3xl gap-4 sm:grid-cols-2">
        {CHOICES.map((choice) => (
          <li key={choice.value}>
            <button
              type="button"
              onClick={() => onChoose(choice.value)}
              aria-pressed={selected === choice.value}
              className={
                'flex h-full w-full flex-col rounded-lg border-2 bg-surface p-6 text-left transition-colors hover:border-stamp ' +
                (selected === choice.value ? 'border-stamp bg-stamp-tint' : 'border-edge')
              }
            >
              <span className="mb-2 text-xl font-bold">{choice.title}</span>
              <span className="text-ink-soft">{choice.body}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
