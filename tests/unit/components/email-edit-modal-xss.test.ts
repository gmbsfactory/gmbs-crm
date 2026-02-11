import DOMPurify from 'dompurify';

describe('SEC-009: DOMPurify XSS sanitization for EmailEditModal', () => {
  describe('Malicious HTML stripping', () => {
    it('should strip <script> tags', () => {
      const dirty = '<p>Hello</p><script>alert("xss")</script>';
      const clean = DOMPurify.sanitize(dirty);
      expect(clean).not.toContain('<script>');
      expect(clean).toContain('<p>Hello</p>');
    });

    it('should strip inline event handlers (onerror, onclick, onload)', () => {
      const dirty = '<img src="x" onerror="alert(\'xss\')" />';
      const clean = DOMPurify.sanitize(dirty);
      expect(clean).not.toContain('onerror');
      expect(clean).not.toContain('alert');
    });

    it('should strip javascript: protocol in href', () => {
      const dirty = '<a href="javascript:alert(\'xss\')">Click me</a>';
      const clean = DOMPurify.sanitize(dirty);
      expect(clean).not.toContain('javascript:');
    });

    it('should strip <iframe> tags', () => {
      const dirty = '<p>Content</p><iframe src="https://evil.com"></iframe>';
      const clean = DOMPurify.sanitize(dirty);
      expect(clean).not.toContain('<iframe');
      expect(clean).toContain('<p>Content</p>');
    });

    it('should strip <object> and <embed> tags', () => {
      const dirty = '<object data="evil.swf"></object><embed src="evil.swf">';
      const clean = DOMPurify.sanitize(dirty);
      expect(clean).not.toContain('<object');
      expect(clean).not.toContain('<embed');
    });

    it('should strip SVG-based XSS payloads', () => {
      const dirty = '<svg onload="alert(\'xss\')"><circle r="50"/></svg>';
      const clean = DOMPurify.sanitize(dirty);
      expect(clean).not.toContain('onload');
      expect(clean).not.toContain('alert');
    });

    it('should strip style tags with expressions', () => {
      const dirty = '<style>body { background: url("javascript:alert(1)") }</style><p>Safe</p>';
      const clean = DOMPurify.sanitize(dirty);
      expect(clean).not.toContain('javascript:');
      expect(clean).toContain('<p>Safe</p>');
    });
  });

  describe('Legitimate HTML preservation', () => {
    it('should preserve <p> tags', () => {
      const html = '<p>Paragraph content</p>';
      const clean = DOMPurify.sanitize(html);
      expect(clean).toBe('<p>Paragraph content</p>');
    });

    it('should preserve text formatting tags (<b>, <i>, <strong>, <em>)', () => {
      const html = '<b>Bold</b> <i>Italic</i> <strong>Strong</strong> <em>Emphasis</em>';
      const clean = DOMPurify.sanitize(html);
      expect(clean).toContain('<b>Bold</b>');
      expect(clean).toContain('<i>Italic</i>');
      expect(clean).toContain('<strong>Strong</strong>');
      expect(clean).toContain('<em>Emphasis</em>');
    });

    it('should preserve <table> structure', () => {
      const html = '<table><thead><tr><th>Header</th></tr></thead><tbody><tr><td>Cell</td></tr></tbody></table>';
      const clean = DOMPurify.sanitize(html);
      expect(clean).toContain('<table>');
      expect(clean).toContain('<th>Header</th>');
      expect(clean).toContain('<td>Cell</td>');
    });

    it('should preserve <br> and <hr> tags', () => {
      const html = '<p>Line 1</p><br><hr><p>Line 2</p>';
      const clean = DOMPurify.sanitize(html);
      expect(clean).toContain('<br>');
      expect(clean).toContain('<hr>');
    });

    it('should preserve <a> with safe href', () => {
      const html = '<a href="https://example.com">Link</a>';
      const clean = DOMPurify.sanitize(html);
      expect(clean).toContain('href="https://example.com"');
      expect(clean).toContain('>Link</a>');
    });

    it('should preserve <img> with safe src', () => {
      const html = '<img src="https://example.com/logo.png" alt="Logo">';
      const clean = DOMPurify.sanitize(html);
      expect(clean).toContain('src="https://example.com/logo.png"');
      expect(clean).toContain('alt="Logo"');
    });

    it('should preserve heading tags', () => {
      const html = '<h1>Title</h1><h2>Subtitle</h2><h3>Section</h3>';
      const clean = DOMPurify.sanitize(html);
      expect(clean).toContain('<h1>Title</h1>');
      expect(clean).toContain('<h2>Subtitle</h2>');
      expect(clean).toContain('<h3>Section</h3>');
    });

    it('should preserve list tags', () => {
      const html = '<ul><li>Item 1</li><li>Item 2</li></ul><ol><li>First</li></ol>';
      const clean = DOMPurify.sanitize(html);
      expect(clean).toContain('<ul><li>Item 1</li>');
      expect(clean).toContain('<ol><li>First</li></ol>');
    });
  });

  describe('Mixed content (malicious + legitimate)', () => {
    it('should strip malicious parts while keeping legitimate content', () => {
      const dirty = '<h1>Email Subject</h1><p>Dear client,</p><script>document.cookie</script><table><tr><td>Info</td></tr></table>';
      const clean = DOMPurify.sanitize(dirty);
      expect(clean).toContain('<h1>Email Subject</h1>');
      expect(clean).toContain('<p>Dear client,</p>');
      expect(clean).toContain('<table><tbody><tr><td>Info</td></tr></tbody></table>');
      expect(clean).not.toContain('<script>');
      expect(clean).not.toContain('document.cookie');
    });
  });
});
