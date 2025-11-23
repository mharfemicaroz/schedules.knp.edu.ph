export function buildTable(headers = [], rows = []) {
  const thead = `<thead><tr>${headers
    .map((h) => `<th>${escapeHtml(h)}</th>`)
    .join("")}</tr></thead>`;
  const tbody = `<tbody>${rows
    .map(
      (r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`
    )
    .join("")}</tbody>`;
  return `<table class="prt-table">${thead}${tbody}</table>`;
}

export function printContent(
  { title, subtitle = "", bodyHtml = "" },
  opts = {}
) {
  const pageSize = opts.pageSize || "A4";
  const orientation = opts.orientation || "portrait"; // 'portrait' | 'landscape'
  const compact = !!opts.compact;
  const margin = opts.margin || (compact ? "8mm" : "16mm");
  const w = window.open("", "_blank");
  if (!w) return;
  const styles = `
    @page { size: ${pageSize} ${orientation}; margin: ${margin}; }
    * { box-sizing: border-box; }
    html, body { height: 100%; }
    body { font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 0; padding: 0; color: #0a0a0a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .inst-hero { position: relative; background: url('/bg.jpg') center/cover no-repeat; min-height: ${
      compact ? "72px" : "180px"
    }; padding: ${
    compact ? "10px 14px" : "24px 32px"
  }; display: flex; align-items: center; }
    /* Overlay sits BEHIND content so logo/text stay crisp */
    .inst-hero::after { content: ''; position: absolute; inset: 0; background: rgba(255,255,255,${
      compact ? "0.96" : "0.90"
    }); z-index: 0; }
    .inst-wrap { position: relative; z-index: 1; display: flex; align-items: center; gap: ${
      compact ? "10px" : "24px"
    }; width: 100%; }
    .inst-logo { width: ${compact ? "56px" : "96px"}; height: ${
    compact ? "56px" : "96px"
  }; border-radius: ${
    compact ? "8px" : "12px"
  }; object-fit: cover; box-shadow: 0 3px 10px rgba(0,0,0,0.20); }
    .inst-lines { line-height: ${compact ? "1.1" : "1.2"}; }
    .inst-name { margin: 0; font-size: ${
      compact ? "16px" : "26px"
    }; font-weight: 900; letter-spacing: 0.2px; color: #0a0a0a; }
    .inst-office { margin: ${compact ? "2px 0 0 0" : "6px 0 0 0"}; font-size: ${
    compact ? "11px" : "16px"
  }; color: #111; font-weight: 800; }
    .inst-app { margin: ${compact ? "2px 0 0 0" : "8px 0 0 0"}; font-size: ${
    compact ? "10px" : "14px"
  }; color: #333; font-weight: 700; }
    .prt-header { padding: 0 ${compact ? "14px" : "32px"}; margin-top: ${
    compact ? "8px" : "16px"
  }; }
    .prt-two { display: grid; grid-template-columns: 1fr auto; align-items: start; gap: ${
      compact ? "10px" : "18px"
    }; margin: ${compact ? "6px 14px" : "10px 32px"}; }
    .prt-col-left { min-width: 0; }
    .prt-col-right { }
    .prt-title { font-weight: 900; font-size: ${
      compact ? "14px" : "22px"
    }; margin: 0; }
    .prt-sub { color: #333; margin: ${
      compact ? "2px 0 0 0" : "6px 0 0 0"
    }; font-size: ${compact ? "10px" : "14px"}; font-weight: 600; }
    .prt-meta { color: #666; font-size: ${compact ? "9px" : "12px"}; margin: ${
    compact ? "4px 0 0 0" : "8px 0 0 0"
  }; }
    .prt-qr-card { background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: ${
      compact ? "6px" : "10px"
    }; box-shadow: 0 4px 12px rgba(0,0,0,0.08); display: inline-flex; flex-direction: column; align-items: center; gap: ${
    compact ? "6px" : "8px"
  }; }
    .prt-qr-img { width: ${compact ? "120px" : "160px"}; height: ${
    compact ? "120px" : "160px"
  }; display: block; }
    .prt-qr-cap { font-size: ${
      compact ? "9px" : "11px"
    }; color: #374151; font-weight: 800; text-transform: uppercase; letter-spacing: 0.4px; text-align: center; max-width: ${
    compact ? "160px" : "200px"
  }; }
    .prt-fac-name { font-weight: 900; font-size: ${
      compact ? "16px" : "20px"
    }; margin: 0 0 ${compact ? "4px" : "6px"} 0; }
    .prt-fac-sub { color: #333; font-size: ${
      compact ? "10px" : "12px"
    }; font-weight: 700; margin: 0 0 ${compact ? "4px" : "6px"} 0; }
    .prt-body { padding: ${compact ? "8px 12px 12px" : "16px 24px 24px"}; }
    .prt-table { width: 100%; border-collapse: collapse; margin-top: ${
      compact ? "4px" : "8px"
    }; table-layout: fixed; }
    .prt-table th, .prt-table td { border: 1px solid #ddd; padding: ${
      compact ? "3px 5px" : "8px 10px"
    }; font-size: ${compact ? "10px" : "12px"}; line-height: ${
    compact ? "1.15" : "1.3"
  }; vertical-align: top; }
    .prt-table th { background: #f6f9fc; text-align: left; font-weight: 700; }
    .prt-footer { padding: 0 ${compact ? "12px" : "24px"} ${
    compact ? "8px" : "16px"
  }; margin-top: ${compact ? "8px" : "12px"}; font-size: ${
    compact ? "10px" : "13px"
  }; display: ${compact ? "grid" : "flex"}; grid-template-columns: ${
    compact ? "1fr 1fr" : "none"
  }; gap: ${
    compact ? "12px" : "32px"
  }; justify-content: space-between; flex-wrap: wrap; }
    .prt-block { min-width: ${compact ? "180px" : "260px"}; }
    .prt-verify, .prt-approve { margin-top: ${
      compact ? "8px" : "24px"
    }; font-weight: 800; }
    .prt-sign { margin-top: ${
      compact ? "10px" : "18px"
    }; display: inline-block; border-top: 1px solid #333; padding-top: ${
    compact ? "4px" : "6px"
  }; font-weight: 700; }
    .prt-role { color: #444; font-size: ${compact ? "9px" : "12px"}; }
    .prt-notice { margin: ${compact ? "6px 0 10px" : "12px 0 16px"}; padding: ${
    compact ? "6px 8px" : "10px 12px"
  }; background: #f8fafc; border-left: 3px solid #2563eb; border-radius: 6px; }
    .prt-notice-title { font-weight: 800; text-transform: uppercase; letter-spacing: 0.3px; margin: 0 0 ${
      compact ? "4px" : "6px"
    } 0; font-size: ${compact ? "10px" : "12px"}; color: #0a0a0a; }
    .prt-notice p { margin: ${compact ? "2px 0" : "4px 0"}; font-size: ${
    compact ? "9px" : "12px"
  }; color: #111; }
    .prt-conforme { padding: 0 ${compact ? "12px" : "24px"}; margin: ${
    compact ? "8px 0 4px" : "12px 0 8px"
  }; font-size: ${compact ? "11px" : "13px"}; font-weight: 800; }
    .prt-printed { padding: 0 ${compact ? "12px" : "24px"} ${
    compact ? "12px" : "18px"
  }; text-align: right; color: #666; font-size: ${compact ? "9px" : "12px"}; }
  `;
  const nowDate = new Date();
  const now = nowDate.toLocaleString();
  const isFacultyDetail = /^\s*faculty\s*:/i.test(String(title || ""));
  let conforme = "";
  if (isFacultyDetail) {
    const m = String(title || "").match(/^\s*faculty\s*:\s*(.+)$/i);
    const facName = m && m[1] ? m[1].trim() : "";
    const when = nowDate.toLocaleDateString();
    conforme = `
      <div class='prt-conforme'>
        <div class='prt-approve'>Conforme:</div>
        <div class='prt-sign'>${escapeHtml(facName || "Name")}</div>
        <div class='prt-role'>Date: ${escapeHtml(when)}</div>
      </div>`;
  }
  const headerHtml = isFacultyDetail
    ? ""
    : `
    <div class='prt-header'>
      <p class='prt-title'>${escapeHtml(title)}</p>
      ${subtitle ? `<p class='prt-sub'>${escapeHtml(subtitle)}</p>` : ""}
      <p class='prt-meta'>Printed: ${escapeHtml(now)}</p>
    </div>`;
  const printedBlock = isFacultyDetail
    ? `<div class='prt-printed'>Printed: ${escapeHtml(now)}</div>`
    : "";

  const preparedBy = typeof opts.preparedBy === 'string' ? opts.preparedBy : '';
  const preparedBlock = preparedBy
    ? `
      <div class='prt-block'>
        <div class='prt-verify'>Prepared by:</div>
        <div class='prt-sign'>${escapeHtml(preparedBy)}</div>
        <div class='prt-role'>Generated by the system</div>
      </div>`
    : '';

  const doc = `<!doctype html><html><head><meta charset='utf-8'><title>${escapeHtml(
    title
  )}</title><style>${styles}</style></head>
  <body>
    <div class='inst-hero'>
      <div class='inst-wrap'>
        <img class='inst-logo' src='/logo.png' alt='Logo' />
        <div class='inst-lines'>
          <p class='inst-name'>Kolehiyo ng Pantukan</p>
          <p class='inst-office'>Office of the Vice President of Academic Affairs</p>
          <p class='inst-app'>Smart Academic Scheduler</p>
        </div>
      </div>
    </div>
    ${headerHtml}
    <div class='prt-body'>
      ${bodyHtml}
    </div>
    <div class='prt-footer'>
      ${preparedBlock}
      <div class='prt-block'>
        <div class='prt-verify'>Verified by:</div>
        <div class='prt-sign'>Dr. Mharfe M. Micaroz</div>
        <div class='prt-role'>Vice President of Academic Affairs</div>
      </div>
      <div class='prt-block'>
        <div class='prt-approve'>Approved by:</div>
        <div class='prt-sign'>Dr. Mary Ann R. Araula</div>
        <div class='prt-role'>Acting College President</div>
      </div>
    </div>
    ${conforme}
    ${printedBlock}
    <script>window.onload = () => { window.print(); setTimeout(()=>window.close(), 300); };</script>
  </body></html>`;
  w.document.open();
  w.document.write(doc);
  w.document.close();
}

function escapeHtml(val) {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
