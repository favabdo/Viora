"use client";

import {
  forwardRef,
  useEffect,
  useRef,
  type InputHTMLAttributes,
  type MutableRefObject,
  type Ref,
  type TextareaHTMLAttributes,
} from "react";

export const fieldClass =
  "w-full rounded-[1.75rem] border border-line bg-surfaceSunken px-4 py-2.5 text-sm text-ink placeholder:text-inkFaint outline-none transition-[border-color,box-shadow] duration-150 focus:border-[#8C3AED] focus:ring-2 focus:ring-[#8C3AED]/20";

function mergeRefs<T>(...refs: Array<Ref<T> | undefined>) {
  return (node: T) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === "function") ref(node);
      else (ref as MutableRefObject<T | null>).current = node;
    }
  };
}

function resizeTextarea(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...props }, ref) => (
    <input ref={ref} className={`${fieldClass} ${className}`} {...props} />
  )
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className = "", onInput, value, rows = 1, ...props }, ref) => {
    const innerRef = useRef<HTMLTextAreaElement | null>(null);

    useEffect(() => {
      resizeTextarea(innerRef.current);
    }, [value]);

    return (
      <textarea
        {...props}
        ref={mergeRefs(innerRef, ref)}
        value={value}
        rows={rows}
        className={`${fieldClass} resize-none overflow-hidden min-h-[2.75rem] leading-relaxed ${className}`}
        onInput={(e) => {
          resizeTextarea(e.currentTarget);
          onInput?.(e);
        }}
      />
    );
  }
);
Textarea.displayName = "Textarea";
