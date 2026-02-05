import DOMPurify from "dompurify";

const ALLOWED_TAGS = ["p", "br", "b", "strong", "i", "em", "ul", "ol", "li"];

export function sanitizeRichText(input: string): string {
  if (!input) return "";
  if (typeof window === "undefined") return input;
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: [],
  });
}
