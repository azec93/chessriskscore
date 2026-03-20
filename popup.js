const DEFAULTS = { autoShow: true, ratedOnly: true, zenMode: false, semiZenMode: false };

async function loadSettings() {
  const s = await chrome.storage.sync.get(DEFAULTS);
  document.getElementById('toggle-auto').checked = s.autoShow;
  document.getElementById('toggle-rated').checked = s.ratedOnly;
  document.getElementById('toggle-semizen').checked = s.semiZenMode;
  document.getElementById('toggle-zen').checked = s.zenMode;
}

function bindToggle(id, key) {
  document.getElementById(id).addEventListener('change', async (e) => {
    await chrome.storage.sync.set({ [key]: e.target.checked });
  });
}

loadSettings();
bindToggle('toggle-auto', 'autoShow');
bindToggle('toggle-rated', 'ratedOnly');

// Zen and semi-zen are mutually exclusive
document.getElementById('toggle-semizen').addEventListener('change', async (e) => {
  await chrome.storage.sync.set({ semiZenMode: e.target.checked });
  if (e.target.checked) {
    document.getElementById('toggle-zen').checked = false;
    await chrome.storage.sync.set({ zenMode: false });
  }
});

document.getElementById('toggle-zen').addEventListener('change', async (e) => {
  await chrome.storage.sync.set({ zenMode: e.target.checked });
  if (e.target.checked) {
    document.getElementById('toggle-semizen').checked = false;
    await chrome.storage.sync.set({ semiZenMode: false });
  }
});

// Detect active platform by messaging the content script on the active tab
async function updateStatusDots() {
  const dotCC = document.getElementById('dot-chesscom');
  const dotLC = document.getElementById('dot-lichess');
  if (!dotCC || !dotLC) return;

  // Default: both red
  dotCC.className = 'status-dot red';
  dotLC.className = 'status-dot red';

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || !tabs[0]) return;

    chrome.tabs.sendMessage(tabs[0].id, { type: 'get-platform' }, (response) => {
      if (chrome.runtime.lastError || !response) return;

      if (response.platform === 'lichess') {
        dotLC.className = 'status-dot green';
      } else {
        dotCC.className = 'status-dot green';
      }
    });
  } catch (e) {
    // Not on a chess site - both stay red
  }
}
updateStatusDots();

// Expandable sections
['calc', 'disclaimer', 'privacy'].forEach(id => {
  const toggle = document.getElementById(id + '-toggle');
  const panel = document.getElementById(id + '-panel');
  const arrow = document.getElementById(id + '-arrow');
  if (toggle && panel) {
    toggle.addEventListener('click', () => {
      const open = panel.style.display !== 'none';
      panel.style.display = open ? 'none' : 'block';
      if (arrow) arrow.textContent = open ? '▸' : '▾';
    });
  }
});
