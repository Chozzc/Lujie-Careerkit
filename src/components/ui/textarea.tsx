import * as React from "react"

import { cn } from "@/lib/utils"

function resizeToContent(textarea: HTMLTextAreaElement | null) {
  if (!textarea) return

  // Reset first so the control can shrink again after text is removed.
  textarea.style.height = "auto"
  textarea.style.height = `${textarea.scrollHeight}px`
}

function Textarea({ className, onInput, ref, value, ...props }: React.ComponentProps<"textarea">) {
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null)

  const setRef = React.useCallback((node: HTMLTextAreaElement | null) => {
    textareaRef.current = node
    if (typeof ref === "function") {
      ref(node)
    } else if (ref) {
      ref.current = node
    }
  }, [ref])

  React.useLayoutEffect(() => {
    resizeToContent(textareaRef.current)
  }, [value])

  return (
    <textarea
      ref={setRef}
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full overflow-y-hidden rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      value={value}
      onInput={(event) => {
        resizeToContent(event.currentTarget)
        onInput?.(event)
      }}
      {...props}
    />
  )
}

export { Textarea }
