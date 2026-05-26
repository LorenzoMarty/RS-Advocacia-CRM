import { cva } from 'class-variance-authority';

import { cn } from '../../../lib/utils';

const buttonVariants = cva('btn', {
  variants: {
    variant: {
      default: '',
      secondary: 'btn-secondary',
      destructive: 'btn-danger',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export function Button({ className = '', variant = 'default', ...props }) {
  return (
    <button
      className={cn(buttonVariants({ variant }), className)}
      {...props}
    />
  );
}
