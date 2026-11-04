const DEFAULTS = { autoShow: true, ratedOnly: true, zenMode: false, semiZenMode: false, embeddedRiskScore: false, embeddedStats: false, embedTimeInterval: 86400, embedHideOwnStats: false, embedColorHighlight: true, overlayScale: 1, verdictBadges: true, showReport: true, soundOn: false, soundFrom: 'high', soundPick: 'harp', soundVol: 'mid' };

// Inside the in-page settings panel (an iframe) the layout follows the frame instead of the fixed toolbar size.
if (window.parent !== window) document.documentElement.classList.add('in-frame');

async function loadSettings() {
  const s = await chrome.storage.sync.get(DEFAULTS);
  document.getElementById('toggle-auto').checked = s.autoShow;
  document.getElementById('toggle-semizen').checked = s.semiZenMode;
  document.getElementById('toggle-zen').checked = s.zenMode;
  document.getElementById('toggle-embedstats').checked = s.embeddedStats;
  document.getElementById('toggle-embedrisk').checked = s.embeddedRiskScore;
  document.getElementById('toggle-hideown').checked = s.embedHideOwnStats;
  document.getElementById('toggle-colorhl').checked = s.embedColorHighlight;
  document.getElementById('toggle-badges').checked = s.verdictBadges !== false;
  document.getElementById('toggle-report').checked = s.showReport !== false;
  document.getElementById('toggle-sound').checked = s.soundOn === true;
  document.getElementById('snd-opts').classList.toggle('off', s.soundOn !== true);
  paintGroup('from', s.soundFrom); paintGroup('vol', s.soundVol); paintGroup('pick', s.soundPick);
  document.getElementById('select-interval').value = String(s.embedTimeInterval);
  // Migrate legacy overlay-size values (0.85 / 1.15 / 1.3) to Small / Normal / Large
  let sc = s.overlayScale;
  if (![0.8, 1, 1.25].includes(sc)) {
    sc = sc < 0.92 ? 0.8 : sc > 1.12 ? 1.25 : 1;
    chrome.storage.sync.set({ overlayScale: sc });
  }
  document.getElementById('select-scale').value = String(sc);
  paintSizeControl();
  updateZenState(s.autoShow);
}

function updateZenState(overlayOn) {
  const semi = document.getElementById('row-semizen');
  const full = document.getElementById('row-fullzen');
  semi.classList.toggle('disabled', !overlayOn);
  full.classList.toggle('disabled', !overlayOn);
  if (!overlayOn) {
    document.getElementById('toggle-semizen').checked = false;
    document.getElementById('toggle-zen').checked = false;
  }
}

function bindToggle(id, key) {
  document.getElementById(id).addEventListener('change', async (e) => {
    await chrome.storage.sync.set({ [key]: e.target.checked });
  });
}

loadSettings();
bindToggle('toggle-embedstats', 'embeddedStats');
bindToggle('toggle-embedrisk', 'embeddedRiskScore');
bindToggle('toggle-badges', 'verdictBadges');
bindToggle('toggle-report', 'showReport');


// Sound tab: on/off, lowest level that makes a sound, which sound, volume. Changing a choice plays a preview.
const SND_KEYS = { from: 'soundFrom', vol: 'soundVol', pick: 'soundPick' };
function paintGroup(name, value) { document.querySelectorAll(`.sg[data-name="${name}"] [data-v]`).forEach(b => b.setAttribute('aria-checked', String(b.dataset.v === value))); }
function sndState() { const g = n => (document.querySelector(`.sg[data-name="${n}"] [aria-checked="true"]`) || {}).dataset?.v; return { from: g('from') || 'high', vol: g('vol') || 'mid', pick: g('pick') || 'harp' }; }
document.getElementById('toggle-sound').addEventListener('change', async (e) => {
  document.getElementById('snd-opts').classList.toggle('off', !e.target.checked);
  await chrome.storage.sync.set({ soundOn: e.target.checked });
  if (e.target.checked) { const st = sndState(); CRS_SOUND.play(st.pick, st.from, st.vol); }
});
document.querySelectorAll('.sg').forEach(group => group.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-v]'); if (!b) return;
  paintGroup(group.dataset.name, b.dataset.v);
  await chrome.storage.sync.set({ [SND_KEYS[group.dataset.name]]: b.dataset.v });
  const st = sndState(); CRS_SOUND.play(st.pick, st.from, st.vol);          // preview at the lowest level you would hear
}));
document.querySelectorAll('#snd-hear button').forEach(b => b.addEventListener('click', () => { const st = sndState(); CRS_SOUND.play(st.pick, b.dataset.lv, st.vol); gmSay(st.pick === 'gm' && b); }));
// Russian GM: a speech bubble over the dot you tested, so you can read what he says.
let gmSayT = 0;
function gmSay(dot) {
  const box = document.getElementById('snd-hear'); let say = box.querySelector('.gm-say');
  clearTimeout(gmSayT);
  if (!dot) { if (say) say.classList.remove('on'); return; }
  if (!say) { say = document.createElement('div'); say.className = 'gm-say'; say.setAttribute('role', 'status'); box.appendChild(say); }
  say.innerHTML = `<i>Russian GM</i>${CRS_SOUND.GM_LINES[dot.dataset.lv]}`;
  // the bubble ends just past the dot (never past the popup's edge) and its tail points at the dot
  const a = box.getBoundingClientRect(), d = dot.getBoundingClientRect(), mid = d.left + d.width / 2;
  const edge = Math.min(document.documentElement.clientWidth - 6, mid + 16);
  say.style.right = (a.right - edge) + 'px';
  say.style.setProperty('--tail', Math.max(4, edge - mid - 5) + 'px');
  say.classList.remove('on'); void say.offsetWidth; say.classList.add('on');
  gmSayT = setTimeout(() => say.classList.remove('on'), 2800);
}
bindToggle('toggle-hideown', 'embedHideOwnStats');
bindToggle('toggle-colorhl', 'embedColorHighlight');

// Auto-show overlay — grey out zen modes when off
document.getElementById('toggle-auto').addEventListener('change', async (e) => {
  const on = e.target.checked;
  const updates = { autoShow: on };
  if (!on) {
    updates.semiZenMode = false;
    updates.zenMode = false;
  }
  await chrome.storage.sync.set(updates);
  updateZenState(on);
});

// Zen modes — mutually exclusive
const zenToggles = [
  { id: 'toggle-semizen', key: 'semiZenMode' },
  { id: 'toggle-zen', key: 'zenMode' },
];

zenToggles.forEach(({ id, key }) => {
  document.getElementById(id).addEventListener('change', async (e) => {
    const updates = { [key]: e.target.checked };
    if (e.target.checked) {
      zenToggles.forEach(other => {
        if (other.key !== key) {
          document.getElementById(other.id).checked = false;
          updates[other.key] = false;
        }
      });
    }
    await chrome.storage.sync.set(updates);
  });
});

document.getElementById('select-interval').addEventListener('change', async (e) => {
  await chrome.storage.sync.set({ embedTimeInterval: parseInt(e.target.value, 10) });
});

// Overlay size: three buttons (S / M / L) that drive the hidden <select>, so there is one source of truth.
const sizeSelect = document.getElementById('select-scale');
const sizeButtons = [...document.querySelectorAll('#size-seg button')];
function paintSizeControl() { sizeButtons.forEach(b => b.setAttribute('aria-checked', String(b.dataset.v === sizeSelect.value))); }
sizeButtons.forEach(b => b.addEventListener('click', () => { sizeSelect.value = b.dataset.v; sizeSelect.dispatchEvent(new Event('change')); paintSizeControl(); }));
sizeSelect.addEventListener('change', async (e) => {
  await chrome.storage.sync.set({ overlayScale: parseFloat(e.target.value) });
  paintSizeControl();
});

// Cog toggle for embed settings panel
document.getElementById('embed-cog').addEventListener('click', () => {
  const panel = document.getElementById('embed-settings');
  const cog = document.getElementById('embed-cog');
  const open = panel.classList.toggle('open');
  cog.classList.toggle('open', open);
});

// Pages: Settings is the page; the header's Guide (book) and About (question mark) buttons open their own page, and the header becomes a back link.
// The popup keeps one fixed size, so nothing resizes when you switch.
const pages = [...document.querySelectorAll('.page')];
const pageNames = ['Settings', 'Guide', 'About', 'My stats'];
function showPage(i) {
  document.body.dataset.view = i;
  pages.forEach((p, k) => { p.classList.toggle('on', k === i); p.classList.toggle('before', k < i); });
  document.getElementById('nav-t').textContent = pageNames[i];
  pages[i].scrollTop = 0;
}
document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => showPage(+b.dataset.go)));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.dataset.view !== '0') showPage(0); });
showPage(0);

// (i) buttons: hovering (or focusing) one shows what the setting does in a small tooltip.
(function infoTips() {
  const tip = document.getElementById('tip');
  const show = (btn) => {
    const text = btn.closest('.tx').querySelector('.info .t-hint').textContent;
    const vw = document.body.clientWidth;
    tip.style.maxWidth = (vw - 16) + 'px';
    tip.textContent = text; tip.style.left = '8px'; tip.style.top = '0px'; tip.classList.add('on');
    const r = btn.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
    const left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, vw - w - 8));
    // never cover the footer: open above the (i) when there is no room below it
    const floor = Math.min(window.innerHeight, document.querySelector('.ft').getBoundingClientRect().top) - 4;
    const top = r.bottom + 6 + h > floor ? r.top - h - 6 : r.bottom + 6;
    tip.style.left = left + 'px'; tip.style.top = top + 'px';
  };
  // Put every (i) on a whole device pixel (layout offsets, not transforms) so all nine rasterise identically at any screen scale.
  const snap = () => {
    const dpr = window.devicePixelRatio || 1;
    const btns = [...document.querySelectorAll('.ib')];
    btns.forEach(b => { b.style.left = '0px'; b.style.top = '0px'; });
    btns.forEach(b => {
      const r = b.getBoundingClientRect();
      if (!r.width) return;
      b.style.left = (Math.round(r.left * dpr) / dpr - 0.01 - r.left) + 'px';
      b.style.top = (Math.round(r.top * dpr) / dpr - 0.01 - r.top) + 'px';
    });
  };
  window.addEventListener('load', snap);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(snap);
  window.addEventListener('resize', snap);
  const hide = () => tip.classList.remove('on');
  document.querySelectorAll('.ib').forEach(btn => {
    btn.setAttribute('aria-label', btn.closest('.tx').querySelector('.info .t-hint').textContent);
    btn.addEventListener('mouseenter', () => show(btn));
    btn.addEventListener('focus', () => show(btn));
    btn.addEventListener('mouseleave', hide);
    btn.addEventListener('blur', hide);
  });
  document.querySelectorAll('.page').forEach(p => p.addEventListener('scroll', hide));
})();
// Sound cog opens the sound options (the Stats cog is handled above).
document.querySelectorAll('[data-fold]').forEach(b => b.addEventListener('click', () => {
  const open = document.getElementById(b.dataset.fold).classList.toggle('open');
  b.classList.toggle('open', open);
}));
// Sound list rows are radio rows: Enter / Space picks one like a click.
document.querySelectorAll('.srow').forEach(r => r.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); r.click(); } }));
// Guide: New / Established / Lichess switch.
document.querySelectorAll('.st-tabs[data-name="calc"]').forEach(g => g.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  const all = [...g.querySelectorAll('button')]; all.forEach(x => x.setAttribute('aria-checked', String(x === b)));
  g.querySelector('.thumb').style.transform = `translateX(${all.indexOf(b) * 100}%)`;   // the thumb slides, as on the Stats tabs
  document.querySelectorAll('.cpane').forEach(p => p.classList.toggle('on', p.dataset.v === b.dataset.v));
}));
// Version comes from the manifest.
try { const v = chrome.runtime.getManifest().version; document.getElementById('ver').textContent = v; document.getElementById('hdr-ver').textContent = 'v' + v; } catch (e) {}


// When shown inside the in-page settings dropdown (an iframe), report our content
// height to the parent so it can size the panel exactly (no empty space). No-op as
// the normal toolbar popup (where window.parent === window).
(function reportHeightToParent() {
  if (window.parent === window) return;
  const send = () => { try { window.parent.postMessage({ type: 'crs-popup-height', height: Math.ceil(document.body.scrollHeight) }, '*'); } catch (e) {} };
  window.addEventListener('load', send);
  send();
  if (window.ResizeObserver) { try { new ResizeObserver(send).observe(document.body); } catch (e) {} }
})();

// BTTW mark: animate on the first popup of a browser session, then show the resting frame.
(async function bttwOnce() {
  const mark = document.getElementById('bttw');
  if (!mark) return;
  try {
    const { bttwPopupPlayed } = await chrome.storage.session.get('bttwPopupPlayed');
    if (!bttwPopupPlayed) { mark.classList.remove('static'); chrome.storage.session.set({ bttwPopupPlayed: 1 }); }
  } catch (e) {}
})();
