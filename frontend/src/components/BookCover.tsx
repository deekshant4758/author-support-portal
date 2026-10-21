import clsx from 'clsx';
import { coverPalette, initials } from '../lib/format';

interface BookCoverProps {
  title: string;
  author: string;
  genre?: string | null;
  className?: string;
  compact?: boolean;
  inProduction?: boolean;
  /** Strips typography for very small thumbnails where text would be unreadable. */
  minimal?: boolean;
}

/**
 * Generated cover artwork. Real catalogue data has no cover images, so we render
 * a deterministic editorial jacket instead of using generic stock photos.
 */
export const BookCover = ({ title, author, genre, className, compact, inProduction, minimal }: BookCoverProps) => {
  const palette = coverPalette(title + author);
  const words = title.split(' ');
  const firstLine = words.slice(0, Math.ceil(words.length / 2)).join(' ');
  const secondLine = words.slice(Math.ceil(words.length / 2)).join(' ');

  return (
    <div
      className={clsx(
        'relative flex aspect-[2/3] w-full flex-col justify-between overflow-hidden rounded-lg border border-black/10 shadow-[0_8px_20px_-8px_rgba(11,28,48,0.45)]',
        className,
      )}
      style={{ background: `linear-gradient(150deg, ${palette.from} 0%, ${palette.via} 55%, ${palette.to} 100%)` }}
      role="img"
      aria-label={`Book cover for ${title} by ${author}`}
    >
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-25 blur-2xl"
        style={{ background: palette.accent }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.13]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(115deg, transparent 0 12px, rgba(255,255,255,0.4) 12px 13px)',
        }}
      />
      <div className="absolute inset-y-0 left-0 w-[7%] bg-black/20" />
      <div className="absolute inset-y-0 left-[7%] w-px bg-white/20" />

      {minimal ? (
        <div className="relative flex h-full flex-col justify-between py-1.5 pl-[22%] pr-1.5">
          <span className="text-[5px] font-bold uppercase tracking-[0.2em] text-white/55">BL</span>
          <span className="font-serif text-[12px] font-semibold leading-none text-white/90">
            {initials(title).slice(0, 1)}
          </span>
          <span className="h-px w-3" style={{ background: palette.accent }} />
        </div>
      ) : (
        <>
      <div className={clsx('relative pl-[13%] pr-4', compact ? 'pt-3' : 'pt-5')}>
        <p className="text-[7px] font-semibold uppercase tracking-[0.3em] text-white/60">BookLeaf</p>
        {genre ? (
          <p className={clsx('mt-1 uppercase tracking-[0.16em] text-white/50', compact ? 'text-[6px]' : 'text-[7px]')}>
            {genre.split('/')[0]}
          </p>
        ) : null}
      </div>

      <div className={clsx('relative pl-[13%] pr-4', compact ? 'py-2' : 'py-4')}>
        <div className="mb-2 h-px w-6" style={{ background: palette.accent }} />
        <h3
          className={clsx(
            'font-serif font-semibold leading-[1.08] text-white/95',
            compact ? 'text-[11px]' : 'text-[clamp(0.85rem,1.4vw,1.2rem)]',
          )}
          style={{ textShadow: '0 1px 12px rgba(0,0,0,0.35)' }}
        >
          {firstLine}
          {secondLine ? (
            <>
              <br />
              {secondLine}
            </>
          ) : null}
        </h3>
      </div>

      <div className={clsx('relative pl-[13%] pr-4', compact ? 'pb-3' : 'pb-5')}>
        <div className="mb-2 h-px w-full bg-white/20" />
        <p className={clsx('font-medium uppercase tracking-[0.14em] text-white/75', compact ? 'text-[6px]' : 'text-[8px]')}>
          {author}
        </p>
      </div>
        </>
      )}

      {inProduction && !minimal ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0B1C30]/35 backdrop-blur-[1px]">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-primary shadow">
            <span className="material-symbols-outlined text-[20px]">draw</span>
          </span>
        </div>
      ) : null}
    </div>
  );
};
