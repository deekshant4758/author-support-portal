import clsx from 'clsx';
import { Icon } from './Icon';
import { PRODUCTION_STAGES } from '../lib/format';

const SHORT_LABELS = [
  'Manuscript',
  'Editing',
  'Cover',
  'Typeset',
  'Proof',
  'ISBN',
  'Printing',
  'Distribution',
  'Live',
];

export const ProductionStepper = ({ stage }: { stage: number }) => {
  const current = Math.min(Math.max(stage, 1), PRODUCTION_STAGES.length);
  const progress = ((current - 1) / (PRODUCTION_STAGES.length - 1)) * 100;

  return (
    <div className="w-full">
      <div className="relative flex items-start justify-between" aria-label="Production progress" role="list">
        <div className="absolute left-3 right-3 top-3.5 h-[3px] rounded-full bg-[#E5EEFF]" />
        <div
          className="absolute left-3 top-3.5 h-[3px] rounded-full bg-primary transition-all"
          style={{ width: `calc((100% - 24px) * ${progress / 100})` }}
        />
        {SHORT_LABELS.map((label, index) => {
          const step = index + 1;
          const complete = step < current;
          const active = step === current;
          return (
            <div
              key={label}
              role="listitem"
              aria-label={PRODUCTION_STAGES[index]}
              aria-current={active ? 'step' : undefined}
              className="relative z-10 flex min-w-0 flex-1 flex-col items-center gap-1.5"
            >
              <div
                className={clsx(
                  'flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold ring-4',
                  complete && 'bg-primary text-white ring-white',
                  active && 'bg-primary text-white ring-primary/20',
                  !complete && !active && 'bg-[#E5EEFF] text-[#64748b] ring-white',
                )}
                title={PRODUCTION_STAGES[index]}
              >
                {complete ? <Icon name="check" className="text-[15px]" /> : step}
              </div>
              <span
                className={clsx(
                  'hidden max-w-full truncate px-0.5 text-center text-[10px] leading-tight sm:block',
                  active ? 'font-bold text-primary' : complete ? 'font-medium text-ink' : 'text-[#94a3b8]',
                )}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 text-body-sm">
        <span className="text-[#64748b]">
          Stage <span className="font-semibold text-ink tabular">{current}</span> of 9
        </span>
        <span className="font-medium text-primary">{PRODUCTION_STAGES[current - 1]}</span>
      </div>
    </div>
  );
};
