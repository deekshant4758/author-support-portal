import clsx from 'clsx';

interface IconProps {
  name: string;
  className?: string;
  filled?: boolean;
  title?: string;
}

export const Icon = ({ name, className, filled = false, title }: IconProps) => (
  <span
    aria-hidden={title ? undefined : true}
    aria-label={title}
    role={title ? 'img' : undefined}
    className={clsx('material-symbols-outlined', className)}
    style={filled ? { fontVariationSettings: "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24" } : undefined}
  >
    {name}
  </span>
);
