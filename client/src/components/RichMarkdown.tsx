import { useState, useEffect, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import yaml from 'highlight.js/lib/languages/yaml';
import css from 'highlight.js/lib/languages/css';
import xml from 'highlight.js/lib/languages/xml';
import markdown from 'highlight.js/lib/languages/markdown';
import sql from 'highlight.js/lib/languages/sql';
import cpp from 'highlight.js/lib/languages/cpp';
import mermaid from 'mermaid';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('py', python);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sh', bash);
hljs.registerLanguage('shell', bash);
hljs.registerLanguage('json', json);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('yml', yaml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('md', markdown);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('c', cpp);

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  themeVariables: {
    primaryColor: '#0070f3',
    primaryTextColor: '#ededed',
    primaryBorderColor: '#1a1a1a',
    lineColor: '#555555',
    secondaryColor: '#111111',
    tertiaryColor: '#0a0a0a',
    background: '#0a0a0a',
    mainBkg: '#111111',
    nodeBorder: '#1a1a1a',
    clusterBkg: '#0a0a0a',
    titleColor: '#ededed',
    edgeLabelBackground: '#111111',
  },
  securityLevel: 'loose',
});

function MermaidBlock({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!code) return;
    let cancelled = false;

    (async () => {
      try {
        const id = `mermaid-${Math.random().toString(36).slice(2, 11)}`;
        const { svg: rendered } = await mermaid.render(id, code);
        if (!cancelled) {
          setSvg(rendered);
          setError('');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to render diagram');
          setSvg('');
        }
      }
    })();

    return () => { cancelled = true; };
  }, [code]);

  if (error) {
    return (
      <div className="bg-red/10 border border-red/30 rounded-lg p-4 my-4">
        <p className="text-red text-sm font-medium mb-2">Diagram Error</p>
        <pre className="text-red/70 text-xs overflow-auto whitespace-pre-wrap">{error}</pre>
        <details className="mt-2">
          <summary className="text-text-tertiary text-xs cursor-pointer">Show source</summary>
          <pre className="text-text-secondary text-xs mt-2 overflow-auto whitespace-pre-wrap">{code}</pre>
        </details>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="bg-bg-elevated rounded-lg p-4 my-4 animate-pulse">
        <div className="h-32 bg-bg-card rounded flex items-center justify-center">
          <span className="text-text-tertiary text-sm">Loading diagram...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="my-4 overflow-auto bg-bg-elevated rounded-lg p-4 border border-border"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

const HLJS_COLORS: Record<string, string> = {
  'hljs-comment': '#5c6370',
  'hljs-quote': '#5c6370',
  'hljs-keyword': '#c678dd',
  'hljs-selector-tag': '#c678dd',
  'hljs-built_in': '#c678dd',
  'hljs-string': '#98c379',
  'hljs-attr': '#98c379',
  'hljs-template-tag': '#98c379',
  'hljs-number': '#d19a66',
  'hljs-literal': '#d19a66',
  'hljs-variable': '#d19a66',
  'hljs-template-variable': '#d19a66',
  'hljs-type': '#e5c07b',
  'hljs-title': '#61afef',
  'hljs-function': '#61afef',
  'hljs-tag': '#e06c75',
  'hljs-name': '#e06c75',
  'hljs-attribute': '#d19a66',
  'hljs-symbol': '#56b6c2',
  'hljs-bullet': '#56b6c2',
  'hljs-meta': '#888888',
  'hljs-params': '#abb2bf',
  'hljs-property': '#e06c75',
};

function inlineHljsColors(html: string): string {
  return html.replace(/class="([^"]+)"/g, (match, classes: string) => {
    const cls = classes.split(' ').find(c => HLJS_COLORS[c]);
    if (cls) {
      return `style="color:${HLJS_COLORS[cls]}" ${match}`;
    }
    return match;
  });
}

function HighlightedCode({ code, language }: { code: string; language?: string }) {
  const html = useMemo(() => {
    let highlighted: string | null = null;
    if (language && hljs.getLanguage(language)) {
      try {
        highlighted = hljs.highlight(code, { language }).value;
      } catch { /* fall through */ }
    }
    if (!highlighted) {
      try {
        highlighted = hljs.highlightAuto(code).value;
      } catch {
        return null;
      }
    }
    return inlineHljsColors(highlighted);
  }, [code, language]);

  if (html) {
    return (
      <>
        {language && (
          <span className="absolute top-2 right-3 text-[0.65rem] uppercase tracking-wider text-text-tertiary select-none">
            {language}
          </span>
        )}
        <code
          className={`hljs${language ? ` language-${language}` : ''}`}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </>
    );
  }
  return <code>{code}</code>;
}

interface RichMarkdownProps {
  children: string;
  className?: string;
  showSourceToggle?: boolean;
  maxHeight?: string;
}

export function RichMarkdown({
  children,
  className = '',
  showSourceToggle = false,
  maxHeight,
}: RichMarkdownProps) {
  const [showSource, setShowSource] = useState(false);

  const components: Components = useMemo(() => ({
    code({ className: codeClassName, children: codeChildren, ...props }) {
      const match = /language-(\w+)/.exec(codeClassName || '');
      const lang = match?.[1];
      const codeStr = String(codeChildren).replace(/\n$/, '');
      const isInline = !codeClassName && !codeStr.includes('\n');

      if (isInline) {
        return <code className={codeClassName} {...props}>{codeChildren}</code>;
      }

      if (lang === 'mermaid') {
        return <MermaidBlock code={codeStr} />;
      }

      return <HighlightedCode code={codeStr} language={lang} />;
    },
    pre({ children: preChildren }) {
      return <pre className="relative">{preChildren}</pre>;
    },
    table({ children: tableChildren }) {
      return (
        <div className="overflow-x-auto my-4">
          <table className="w-full border-collapse border border-border text-sm">
            {tableChildren}
          </table>
        </div>
      );
    },
    th({ children: thChildren }) {
      return (
        <th className="border border-border bg-bg-elevated px-3 py-2 text-left text-text-primary font-medium">
          {thChildren}
        </th>
      );
    },
    td({ children: tdChildren }) {
      return (
        <td className="border border-border px-3 py-2 text-text-secondary">
          {tdChildren}
        </td>
      );
    },
  }), []);

  const containerStyle = maxHeight ? { maxHeight, overflow: 'auto' as const } : undefined;

  if (showSource) {
    return (
      <div>
        {showSourceToggle && (
          <div className="flex justify-end mb-2">
            <button
              onClick={() => setShowSource(false)}
              className="text-xs text-text-tertiary hover:text-text-secondary transition-colors px-2 py-1 rounded border border-border hover:border-border-hover"
            >
              Rendered
            </button>
          </div>
        )}
        <pre
          className="bg-bg-elevated border border-border rounded-lg p-4 text-sm font-mono text-text-secondary overflow-auto"
          style={containerStyle}
        >
          {children}
        </pre>
      </div>
    );
  }

  return (
    <div>
      {showSourceToggle && (
        <div className="flex justify-end mb-2">
          <button
            onClick={() => setShowSource(true)}
            className="text-xs text-text-tertiary hover:text-text-secondary transition-colors px-2 py-1 rounded border border-border hover:border-border-hover"
          >
            Source
          </button>
        </div>
      )}
      <div className={`prose max-w-none ${className}`} style={containerStyle}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {children}
        </ReactMarkdown>
      </div>
    </div>
  );
}
