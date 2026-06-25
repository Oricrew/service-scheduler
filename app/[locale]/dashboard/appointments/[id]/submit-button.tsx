"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";

type SubmitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingChildren?: ReactNode;
};

export function SubmitButton({
  children,
  className,
  disabled,
  pendingChildren,
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;

  return (
    <button
      {...props}
      aria-busy={pending}
      className={className}
      disabled={isDisabled}
      type="submit"
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden="true"
            className="size-3 animate-spin rounded-full border-2 border-current border-r-transparent"
          />
          {pendingChildren ?? children}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
