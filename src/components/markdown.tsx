import ReactMarkdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

/**
 * Renders staff-authored post bodies as sanitized Markdown. Raw HTML is NOT
 * enabled (no rehype-raw / dangerouslySetInnerHTML), and only a small tag set is
 * allowed — everything else is unwrapped to its text — so a post body can format
 * (bold, italic, links, lists) but cannot inject markup. Existing plain-text
 * posts render identically: plain text is valid Markdown, and remark-breaks turns
 * single newlines into <br> so line breaks survive as they did before.
 */
const ALLOWED = ["p", "strong", "em", "a", "ul", "ol", "li", "br"];

/** Only http(s) and mailto links are rendered as anchors. */
function isSafeHref(href?: string): boolean {
  if (!href) return false;
  try {
    const url = new URL(href, "https://invalid.example");
    return ["http:", "https:", "mailto:"].includes(url.protocol);
  } catch {
    return false;
  }
}

const COMPONENTS: Components = {
  a({ href, children }) {
    // Drop unsafe protocols (javascript:, data:, …) to plain text.
    return isSafeHref(href) ? (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ) : (
      <>{children}</>
    );
  },
};

export function Markdown({ children }: { children: string }) {
  return (
    <div className="space-y-2 break-words text-body text-foreground/90 [&_a]:text-primary [&_a]:underline [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        allowedElements={ALLOWED}
        unwrapDisallowed
        components={COMPONENTS}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
