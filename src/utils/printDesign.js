export function buildTable(headers = [], rows = []) {
  const thead = `<thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>`;
  const tbody = `<tbody>${rows.map(r => `<tr>${r.map(c => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody>`;
  return `<table class="prt-table">${thead}${tbody}</table>`;
}

export function printContent({ title, subtitle = '', bodyHtml = '' }) {
  const w = window.open('', '_blank');
  if (!w) return;
  const styles = `
    * { box-sizing: border-box; }
    html, body { height: 100%; }
    body { font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 0; padding: 0; color: #0a0a0a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .inst-hero { position: relative; background: url('/bg.jpg') center/cover no-repeat; min-height: 180px; padding: 24px 32px; display: flex; align-items: center; }
    /* Overlay sits BEHIND content so logo/text stay crisp */
    .inst-hero::after { content: ''; position: absolute; inset: 0; background: rgba(255,255,255,0.90); z-index: 0; }
    .inst-wrap { position: relative; z-index: 1; display: flex; align-items: center; gap: 24px; width: 100%; }
    .inst-logo { width: 96px; height: 96px; border-radius: 12px; object-fit: cover; box-shadow: 0 3px 10px rgba(0,0,0,0.20); }
    .inst-lines { line-height: 1.2; }
    .inst-name { margin: 0; font-size: 26px; font-weight: 900; letter-spacing: 0.2px; color: #0a0a0a; }
    .inst-office { margin: 6px 0 0 0; font-size: 16px; color: #111; font-weight: 800; }
    .inst-app { margin: 8px 0 0 0; font-size: 14px; color: #333; font-weight: 700; }
    .prt-header { padding: 0 32px; margin-top: 16px; }
    .prt-title { font-weight: 900; font-size: 22px; margin: 0; }
    .prt-sub { color: #333; margin: 6px 0 0 0; font-size: 14px; font-weight: 600; }
    .prt-meta { color: #666; font-size: 12px; margin: 8px 0 0 0; }
    .prt-body { padding: 16px 24px 24px; }
    .prt-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    .prt-table th, .prt-table td { border: 1px solid #ddd; padding: 8px 10px; font-size: 12px; }
    .prt-table th { background: #f6f9fc; text-align: left; font-weight: 700; }
    .prt-footer { padding: 0 24px 24px; margin-top: 12px; font-size: 13px; }
    .prt-verify { margin-top: 40px; }
    .prt-sign { margin-top: 28px; display: inline-block; border-top: 1px solid #333; padding-top: 6px; font-weight: 700; }
    .prt-role { color: #444; font-size: 12px; }
  `;
  const now = new Date().toLocaleString();
  const doc = `<!doctype html><html><head><meta charset='utf-8'><title>${escapeHtml(title)}</title><style>${styles}</style></head>
  <body>
    <div class='inst-hero'>
      <div class='inst-wrap'>
        <img class='inst-logo' src='/logo.png' alt='Logo' />
        <div class='inst-lines'>
          <p class='inst-name'>Kolehiyo ng Pantukan</p>
          <p class='inst-office'>Office of the Vice President of Academic Affairs</p>
          <p class='inst-app'>Faculty Loading SY 2025-2026, 1st Semester</p>
        </div>
      </div>
    </div>
    <div class='prt-header'>
      <p class='prt-title'>${escapeHtml(title)}</p>
      ${subtitle ? `<p class='prt-sub'>${escapeHtml(subtitle)}</p>` : ''}
      <p class='prt-meta'>Printed: ${escapeHtml(now)}</p>
    </div>
    <div class='prt-body'>
      ${bodyHtml}
    </div>
    <div class='prt-footer'>
      <div class='prt-verify'>Verified by:</div>
      <div class='prt-sign'>Dr. Mharfe M. Micaroz</div>
      <div class='prt-role'>Vice President of Academic Affairs</div>
    </div>
    <script>window.onload = () => { window.print(); setTimeout(()=>window.close(), 300); };</script>
  </body></html>`;
  w.document.open();
  w.document.write(doc);
  w.document.close();
}

function escapeHtml(val) {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
