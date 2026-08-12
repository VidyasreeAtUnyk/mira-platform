import { clsx } from 'clsx';
import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANT_STYLES: Record<Variant, string> = {
  primary: 'bg-brand-gold text-brand-bg hover:bg-brand-gold-light disabled:opacity-40',
  secondary:
    'border border-brand-hairline text-brand-body hover:border-brand-gold hover:text-brand-gold disabled:opacity-40',
  ghost: 'text-brand-body/70 hover:text-brand-gold disabled:opacity-40',
  danger: 'border border-red-500/40 text-red-300 hover:bg-red-500/10 disabled:opacity-40',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = 'secondary', className, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        'rounded px-3 py-1.5 text-sm font-medium tracking-wide transition disabled:cursor-not-allowed',
        VARIANT_STYLES[variant],
        className
      )}
      {...props}
    />
  );
}
