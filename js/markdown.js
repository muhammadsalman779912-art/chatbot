/**
 * Markdown & Code Syntax Highlighting Processor
 * Configures Marked, Highlight.js, and KaTeX for elegant rendering.
 */

export const Markdown = {
  initialized: false,

  init() {
    if (this.initialized) return;

    if (window.marked) {
      const renderer = new window.marked.Renderer();

      // Custom code block renderer with language badge and copy button
      renderer.code = function(code, language) {
        const lang = (language || 'plaintext').toLowerCase();
        let highlighted = '';

        if (window.hljs && window.hljs.getLanguage(lang)) {
          try {
            highlighted = window.hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
          } catch (e) {
            highlighted = escapeHtml(code);
          }
        } else if (window.hljs) {
          try {
            highlighted = window.hljs.highlightAuto(code).value;
          } catch (e) {
            highlighted = escapeHtml(code);
          }
        } else {
          highlighted = escapeHtml(code);
        }

        const encodedCode = encodeURIComponent(code);

        return `
          <div class="code-block-wrapper my-3">
            <div class="code-header flex items-center justify-between px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-700">
              <span class="text-xs font-mono font-medium tracking-wide uppercase">${escapeHtml(lang)}</span>
              <button type="button" class="copy-code-btn inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors" data-code="${encodedCode}">
                <svg class="w-3.5 h-3.5 copy-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                <span class="copy-text">Copy</span>
              </button>
            </div>
            <pre class="m-0 p-0 overflow-x-auto"><code class="hljs language-${lang}">${highlighted}</code></pre>
          </div>
        `;
      };

      // Custom link renderer to open in new tab securely
      renderer.link = function(href, title, text) {
        return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" class="text-indigo-600 dark:text-indigo-400 underline hover:opacity-80 transition-opacity">${text}</a>`;
      };

      window.marked.setOptions({
        renderer: renderer,
        gfm: true,
        breaks: true,
        pedantic: false,
        sanitize: false,
        smartLists: true,
        smartypants: false
      });

      this.initialized = true;
    }
  },

  render(markdownText) {
    if (!markdownText) return '';
    this.init();

    let text = markdownText;

    // Render KaTeX math if available ($...$ or $$...$$)
    if (window.katex) {
      try {
        // Block math $$ ... $$
        text = text.replace(/\$\$([\s\S]+?)\$\$/g, (match, formula) => {
          try {
            return `<div class="katex-block my-2 overflow-x-auto">${window.katex.renderToString(formula, { displayMode: true, throwOnError: false })}</div>`;
          } catch (e) {
            return match;
          }
        });
        // Inline math $ ... $
        text = text.replace(/\$([^\$\n]+?)\$/g, (match, formula) => {
          try {
            return window.katex.renderToString(formula, { displayMode: false, throwOnError: false });
          } catch (e) {
            return match;
          }
        });
      } catch (err) {
        console.warn('KaTeX rendering error:', err);
      }
    }

    let html = '';
    if (window.marked) {
      html = window.marked.parse(text);
    } else {
      html = escapeHtml(text).replace(/\n/g, '<br/>');
    }

    // Sanitize with DOMPurify if available
    if (window.DOMPurify) {
      return window.DOMPurify.sanitize(html, {
        ADD_ATTR: ['target', 'rel', 'data-code'],
        ADD_TAGS: ['iframe']
      });
    }

    return html;
  }
};

function escapeHtml(string) {
  if (!string) return '';
  return String(string)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

