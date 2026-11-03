import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Markdown } from '../src/features/assistant/Markdown';

const html = (t: string) => renderToStaticMarkup(<Markdown text={t} />);

describe('Markdown das respostas', () => {
  it('formata listas, negrito, código e tabela', () => {
    const h = html('**Passos:**\n- um\n- dois\n\n1. a\n2. b\n\n`x = 1`\n\n```js\nconst a = 1;\n```\n\n| A | B |\n|---|---|\n| 1 | 2 |');
    expect(h).toContain('<strong>Passos:</strong>');
    expect(h).toMatch(/<ul><li>um<\/li><li>dois<\/li><\/ul>/);
    expect(h).toMatch(/<ol><li>a<\/li><li>b<\/li><\/ol>/);
    expect(h).toContain('<code>x = 1</code>');
    expect(h).toContain('<pre><code>const a = 1;</code></pre>');
    expect(h).toContain('<td>2</td>');
  });
  it('nunca injeta HTML vindo da IA', () => {
    const h = html('<img src=x onerror=alert(1)> e <script>alert(1)</script>');
    expect(h).not.toContain('<img');
    expect(h).not.toContain('<script');
    expect(h).toContain('&lt;img');
  });
  it('só cria links http(s)', () => {
    expect(html('[ok](https://exemplo.com) [ruim](javascript:alert(1))')).toMatch(/href="https:\/\/exemplo.com"[^>]*rel="noopener noreferrer"/);
    expect(html('[ruim](javascript:alert(1))')).not.toContain('href="javascript');
  });
});
