import DOMPurify, { type Config } from "dompurify";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import plaintext from "highlight.js/lib/languages/plaintext";
import python from "highlight.js/lib/languages/python";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import { marked } from "marked";
import { markedHighlight } from "marked-highlight";

hljs.registerLanguage("bash", bash);
hljs.registerLanguage("css", css);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("plaintext", plaintext);
hljs.registerLanguage("python", python);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("xml", xml);
hljs.registerAliases(["html", "htm", "xhtml"], { languageName: "xml" });
hljs.registerAliases(["js", "cjs", "mjs"], { languageName: "javascript" });
hljs.registerAliases(["ts", "mts", "cts"], { languageName: "typescript" });
hljs.registerAliases(["py"], { languageName: "python" });
hljs.registerAliases(["sh", "shell", "zsh"], { languageName: "bash" });
hljs.registerAliases(["md", "mkd"], { languageName: "markdown" });
hljs.registerAliases(["text", "txt"], { languageName: "plaintext" });

marked.use(
  markedHighlight({
    langPrefix: "hljs language-",
    highlight(code, lang) {
      const language = lang && hljs.getLanguage(lang) ? lang : "plaintext";
      return hljs.highlight(code, { language }).value;
    },
  }),
);

marked.setOptions({ gfm: true, breaks: false });

const ANSWER_PURIFY: Config = {
  ADD_ATTR: ["class"],
};

/** Full GFM body → safe HTML for the answer face. */
export function renderAnswerHtml(markdown: string): string {
  const raw = marked.parse(markdown, { async: false }) as string;
  return String(DOMPurify.sanitize(raw, ANSWER_PURIFY));
}

/** Inline-only markdown (code, emphasis, links) for the `##` title line. */
export function renderTitleHtml(markdown: string): string {
  const raw = marked.parseInline(markdown, { async: false }) as string;
  return String(DOMPurify.sanitize(raw));
}
