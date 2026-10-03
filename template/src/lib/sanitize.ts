import sanitizeHtmlLib from "sanitize-html";

// isomorphic-dompurify pulls in jsdom on the server, which can crash under
// some serverless/edge runtimes (ESM require() issues). sanitize-html
// (htmlparser2-based) is deterministic on both server and client — no crash,
// no hydration mismatch.

const RICH_TEXT_OPTIONS: sanitizeHtmlLib.IOptions = {
  allowedTags: [
    ...sanitizeHtmlLib.defaults.allowedTags,
    "img", "h1", "h2", "figure", "figcaption", "iframe", "span",
  ],
  allowedAttributes: {
    ...sanitizeHtmlLib.defaults.allowedAttributes,
    "*": ["class", "id", "style"],
    a: ["href", "name", "target", "rel"],
    img: ["src", "srcset", "alt", "title", "width", "height", "loading"],
    iframe: ["src", "width", "height", "frameborder", "allow", "allowfullscreen"],
  },
  allowedIframeHostnames: ["www.youtube.com", "www.youtube-nocookie.com", "player.vimeo.com"],
};

/** Sanitizes rich HTML (e.g. blog posts): keeps formatting, strips scripts/handlers. */
export function sanitizeRichHtml(html: string): string {
  return sanitizeHtmlLib(html || "", RICH_TEXT_OPTIONS);
}

/** Strips ALL HTML (plain text only). */
export function sanitizeToPlainText(html: string): string {
  return sanitizeHtmlLib(html || "", { allowedTags: [], allowedAttributes: {} });
}
