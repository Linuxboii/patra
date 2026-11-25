import { merge, extract, rotate, pageCount, parseRanges, chunks } from './lib.js';
import { $, bindDropzone, download, fmtBytes, toast } from './ui.js';

const kindOf = (f) => (f.type === 'application/pdf' || /\.pdf$/i.test(f.name) ? 'pdf' : f.type === 'image/png' ? 'png' : /jpe?g/.test(f.type) ? 'jpg' : null);
const base = (name) => name.replace(/\.[^.]+$/, '');

function tab(which) {
  $('#tabMerge').setAttribute('aria-selected', which === 'merge');
  $('#tabPages').setAttribute('aria-selected', which === 'pages');
  $('#merge').hidden = which !== 'merge';
  $('#pages').hidden = which !== 'pages';
}
$('#tabMerge').onclick = () => tab('merge');
$('#tabPages').onclick = () => tab('pages');

/* Merge */
let files = [];
function btn(label, fn, aria) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  if (aria) b.setAttribute('aria-label', aria);
  b.onclick = fn;
  return b;
}
function renderList() {
  const list = $('#mList');
  $('#mGo').disabled = !files.length;
  if (!files.length) { list.innerHTML = '<p class="empty">Files you add show up here. Move them into the order you want.</p>'; return; }
  list.replaceChildren(...files.map((f, i) => {
    const row = document.createElement('div');
    row.className = 'file';
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = `${i + 1}. ${f.file.name}`;
    const meta = document.createElement('div');
    meta.className = 'muted small';
    meta.textContent = `${f.kind.toUpperCase()}, ${fmtBytes(f.file.size)}`;
    name.append(document.createElement('br'), meta);
    const ctl = document.createElement('div');
    ctl.className = 'row';
    const move = (d) => () => { const j = i + d; if (j < 0 || j >= files.length) return; [files[i], files[j]] = [files[j], files[i]]; renderList(); };
    ctl.append(btn('Up', move(-1), `Move ${f.file.name} up`), btn('Down', move(1), `Move ${f.file.name} down`), btn('Remove', () => { files.splice(i, 1); renderList(); }, `Remove ${f.file.name}`));
    row.append(name, ctl);
    return row;
  }));
}
bindDropzone($('#mDrop'), $('#mFile'), (list) => {
  const ok = list.filter((f) => kindOf(f));
  if (ok.length < list.length) toast('Skipped files that are not PDF, JPG or PNG');
  files.push(...ok.map((file) => ({ file, kind: kindOf(file) })));
  renderList();
});
$('#mGo').onclick = async () => {
  const err = $('#mErr');
  const b = $('#mGo');
  b.disabled = true;
  b.textContent = 'Working';
  try {
    const items = await Promise.all(files.map(async (f) => ({ kind: f.kind, bytes: new Uint8Array(await f.file.arrayBuffer()) })));
    const out = await merge(items, { a4Images: $('#a4').checked });
    download(new Blob([out], { type: 'application/pdf' }), files.length === 1 ? base(files[0].file.name) + '.pdf' : 'merged.pdf');
    err.textContent = '';
  } catch (e) {
    err.textContent = /encrypt|password/i.test(e.message) ? 'One of the PDFs is password protected. Remove the password first.' : 'Could not read one of the files. It may be damaged.';
  } finally {
    b.disabled = !files.length;
    b.textContent = 'Merge and download';
  }
};

/* Pages */
let doc = null; // { name, bytes, count }
bindDropzone($('#pDrop'), $('#pFile'), async (list) => {
  const f = list.find((x) => kindOf(x) === 'pdf');
  if (!f) { $('#pErr').textContent = 'Choose a PDF file.'; return; }
  try {
    const bytes = new Uint8Array(await f.arrayBuffer());
    doc = { name: base(f.name), bytes, count: await pageCount(bytes) };
    $('#pInfo').textContent = `${f.name}: ${doc.count} page${doc.count > 1 ? 's' : ''}, ${fmtBytes(f.size)}`;
    $('#pErr').textContent = '';
    $('#pGo').disabled = false;
  } catch {
    doc = null;
    $('#pGo').disabled = true;
    $('#pErr').textContent = 'This PDF could not be opened. It may be damaged or password protected.';
  }
});
$('#pAction').addEventListener('change', () => {
  const split = $('#pAction').value === 'split';
  $('#specField').hidden = split;
  $('#nField').hidden = !split;
});
$('#pGo').onclick = async () => {
  if (!doc) return;
  const err = $('#pErr');
  const act = $('#pAction').value;
  const pdf = (bytes, name) => download(new Blob([bytes], { type: 'application/pdf' }), name);
  try {
    if (act === 'split') {
      const n = Math.max(1, Math.floor(+$('#pN').value || 1));
      const groups = chunks(doc.count, n);
      if (groups.length > 50) { err.textContent = `That makes ${groups.length} files. Pick a bigger number, 50 files at most.`; return; }
      for (const [k, g] of groups.entries()) {
        pdf(await extract(doc.bytes, g), `${doc.name}-part${k + 1}.pdf`);
        await new Promise((r) => setTimeout(r, 250));
      }
      toast(`${groups.length} files saved`);
    } else {
      const idx = parseRanges($('#pSpec').value, doc.count);
      if (act === 'extract') pdf(await extract(doc.bytes, idx), `${doc.name}-pages.pdf`);
      else if (act === 'remove') {
        const drop = new Set(idx);
        const keep = [...Array(doc.count).keys()].filter((i) => !drop.has(i));
        if (!keep.length) { err.textContent = 'That would delete every page.'; return; }
        pdf(await extract(doc.bytes, keep), `${doc.name}-edited.pdf`);
      } else pdf(await rotate(doc.bytes, [...new Set(idx)], act === 'rotate' ? 90 : -90), `${doc.name}-rotated.pdf`);
    }
    err.textContent = '';
  } catch (e) {
    err.textContent = e.message || 'Something went wrong with this PDF.';
  }
};
