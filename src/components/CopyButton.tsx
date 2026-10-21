"use client";

import { useState } from "react";
import { Button } from "./ui";

// Copies a block of text (the alert rule) to the clipboard, and says so.
export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState<"idle" | "copied" | "failed">("idle");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone("copied");
    } catch {
      setDone("failed");
    }
    setTimeout(() => setDone("idle"), 2500);
  };
  return (
    <Button variant="ghost" onClick={copy} aria-live="polite">
      {done === "copied" ? "Copied ✓" : done === "failed" ? "Couldn't copy: select it instead" : label}
    </Button>
  );
}
