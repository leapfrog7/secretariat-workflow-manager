function escapeRtf(value) {
  return Array.from(String(value || '')).map((character) => {
    if (character === '\\' || character === '{' || character === '}') return `\\${character}`;
    if (character === '\n') return '\\par\n';
    if (character === '\r') return '';
    const code = character.charCodeAt(0);
    if (code > 127) return `\\u${code > 32767 ? code - 65536 : code}?`;
    return character;
  }).join('');
}

function safeFilename(value) {
  return String(value || 'official-draft').trim().replace(/[<>:"/\\|?*]+/g, '-').replace(/\s+/g, '-').slice(0, 80) || 'official-draft';
}

export function buildDraftRtf(content) {
  if (!String(content || '').trim()) throw new Error('There is no draft to export.');
  return `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Times New Roman;}}\\viewkind4\\uc1\\pard\\sa180\\sl360\\slmult1\\f0\\fs24 ${escapeRtf(content)}\\par}`;
}

export function downloadDraftAsRtf({ content, title, version }) {
  const rtf = buildDraftRtf(content);
  const blob = new Blob([rtf], { type: 'application/rtf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeFilename(title)}${version ? `-v${version}` : ''}.rtf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
