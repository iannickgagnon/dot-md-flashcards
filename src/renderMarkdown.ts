import DOMPurify from "dompurify";
import { marked } from "marked";

marked.setOptions({ gfm: true, breaks: false });

/** Full GFM body → safe HTML for the answer face. */
export function renderAnswerHtml(markdown: string): string {
  const raw = marked.parse(markdown, { async: false }) as string;
  return DOMPurify.sanitize(raw);
}

/** Inline-only markdown (code, emphasis, links) for the `##` title line. */
export function renderTitleHtml(markdown: string): string {
  const raw = marked.parseInline(markdown, { async: false }) as string;
  return DOMPurify.sanitize(raw);
}
