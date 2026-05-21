"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { sanitizeRichText } from "@/lib/sanitize";

type Props = {
  id?: string;
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  rows?: number;
};

const BUTTON_BASE =
  "inline-flex items-center justify-center rounded-full border px-3 py-1 text-[11px] font-semibold shadow-sm transition";

export function RichTextArea({
  id,
  label,
  placeholder,
  value,
  onChange,
  className,
  rows = 4,
}: Props) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [formatState, setFormatState] = React.useState<{
    bold: boolean;
    italic: boolean;
    bullet: boolean;
  }>({ bold: false, italic: false, bullet: false });

  const refreshFormatState = React.useCallback(() => {
    if (typeof document === "undefined") return;
    if (!ref.current) return;

    const selection = document.getSelection();
    if (!selection || !selection.anchorNode) {
      setFormatState({ bold: false, italic: false, bullet: false });
      return;
    }

    let node: Node | null = selection.anchorNode;
    let inside = false;
    while (node) {
      if (node === ref.current) {
        inside = true;
        break;
      }
      node = node.parentNode;
    }
    if (!inside) {
      setFormatState({ bold: false, italic: false, bullet: false });
      return;
    }

    try {
      const bold = document.queryCommandState("bold");
      const italic = document.queryCommandState("italic");
      const bullet = document.queryCommandState("insertUnorderedList");
      setFormatState({
        bold: Boolean(bold),
        italic: Boolean(italic),
        bullet: Boolean(bullet),
      });
    } catch {
      // ignore unsupported command state queries
    }
  }, []);

  React.useEffect(() => {
    if (!ref.current) return;
    const clean = sanitizeRichText(value || "");
    if (ref.current.innerHTML === clean) return;
    ref.current.innerHTML = clean;
  }, [value]);

  React.useEffect(() => {
    if (typeof document === "undefined") return;

    const handler = () => {
      refreshFormatState();
    };

    document.addEventListener("selectionchange", handler);
    return () => {
      document.removeEventListener("selectionchange", handler);
    };
  }, [refreshFormatState]);

  const exec = (command: string, arg?: string) => {
    if (typeof document === "undefined") return;
    if (ref.current) {
      ref.current.focus();
    }
    if (arg != null) {
      document.execCommand(command, false, arg);
    } else {
      document.execCommand(command, false);
    }
    refreshFormatState();
    if (ref.current) {
      onChange(ref.current.innerHTML);
    }
  };

  const handleInput = () => {
    if (!ref.current) return;
    onChange(ref.current.innerHTML);
    refreshFormatState();
  };

  const minHeight = rows * 24;

  return (
    <div className="space-y-2">
      {label && (
        <label
          htmlFor={id}
          className="text-sm font-semibold text-slate-500"
        >
          {label}
        </label>
      )}
      <div className="rounded-2xl border border-slate-200 bg-white/90 shadow-inner">
        <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 px-2 py-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-300 mr-1">
            Format
          </span>
          <button
            type="button"
            className={cn(
              BUTTON_BASE,
              "border-slate-200 bg-white text-slate-600 hover:border-[#00674F] hover:bg-[#00674F]/5 hover:text-[#00674F]",
              formatState.bold &&
                "border-[#00674F] bg-[#00674F]/10 text-[#00674F]"
            )}
            onClick={() => exec("bold")}
          >
            <span className="font-bold">B</span>
          </button>
          <button
            type="button"
            className={cn(
              BUTTON_BASE,
              "border-slate-200 bg-white text-slate-600 hover:border-[#00674F] hover:bg-[#00674F]/5 hover:text-[#00674F]",
              formatState.italic &&
                "border-[#00674F] bg-[#00674F]/10 text-[#00674F]"
            )}
            onClick={() => exec("italic")}
          >
            <span className="italic">I</span>
          </button>
          <button
            type="button"
            className={cn(
              BUTTON_BASE,
              "border-slate-200 bg-white text-slate-600 hover:border-[#00674F] hover:bg-[#00674F]/5 hover:text-[#00674F]",
              formatState.bullet &&
                "border-[#00674F] bg-[#00674F]/10 text-[#00674F]"
            )}
            onClick={() => exec("insertUnorderedList")}
          >
            • List
          </button>
          <button
            type="button"
            className={cn(
              BUTTON_BASE,
              "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50"
            )}
            onClick={() => {
              if (ref.current) {
                ref.current.innerHTML = "";
                onChange("");
              }
            }}
          >
            Clear
          </button>
        </div>
        <div
          id={id}
          ref={ref}
          contentEditable
          className={cn(
            "w-full rounded-b-2xl bg-white px-4 py-2 text-sm font-medium text-slate-700 outline-none",
            "prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:list-inside [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:list-inside [&_ol]:pl-5 [&_li]:list-item",
            className
          )}
          style={{ minHeight }}
          data-placeholder={placeholder}
          onInput={handleInput}
          onBlur={handleInput}
          suppressContentEditableWarning
        />
      </div>
    </div>
  );
}
