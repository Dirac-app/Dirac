"use client";

import { useMemo, useRef, useState } from "react";

/**
 * Renders email HTML in a sandboxed iframe — completely isolated from the
 * app's CSS and dark-mode styles so inline colors render exactly as intended.
 * Links always open in a new tab; scripts are blocked.
 */

const BASE_CSS = `
html,body {
  margin: 0;
  padding: 0;
  background: #ffffff;
  color: #1a1a1a;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  word-break: break-word;
  -webkit-text-size-adjust: 100%;
}
img { max-width: 100%; height: auto; }
a { color: #1a6edb; }
* { box-sizing: border-box; }
table { max-width: 100%; border-collapse: collapse; }
`.trim();

interface EmailFrameProps {
  html: string;
}

export function EmailFrame({ html }: EmailFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(300);

  const srcdoc = useMemo(
    () =>
      `<!DOCTYPE html><html lang="en"><head>` +
      `<meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<base target="_blank" rel="noopener noreferrer">` +
      `<style>${BASE_CSS}</style>` +
      `</head><body>${html}</body></html>`,
    [html],
  );

  function handleLoad() {
    try {
      const doc = iframeRef.current?.contentDocument;
      if (!doc) return;
      // Read the rendered height and resize the iframe to fit without scrollbars
      const h = Math.max(
        doc.documentElement.scrollHeight,
        doc.body?.scrollHeight ?? 0,
      );
      setHeight(h + 4);
    } catch {
      // Cross-origin fallback (shouldn't happen with allow-same-origin)
      setHeight(600);
    }
  }

  return (
    <iframe
      ref={iframeRef}
      srcDoc={srcdoc}
      // allow-same-origin: needed to read scrollHeight for auto-resize (no scripts allowed)
      // allow-popups: lets links open in new tabs
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      onLoad={handleLoad}
      style={{ width: "100%", height: `${height}px`, border: "none", display: "block" }}
      title="Email content"
    />
  );
}
