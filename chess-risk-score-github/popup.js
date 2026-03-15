const DEFAULTS = { autoShow: true, ratedOnly: true };

async function loadSettings() {
  const s = await chrome.storage.sync.get(DEFAULTS);
  document.getElementById('toggle-auto').checked = s.autoShow;
  document.getElementById('toggle-rated').checked = s.ratedOnly;
}

function bindToggle(id, key) {
  document.getElementById(id).addEventListener('change', async (e) => {
    await chrome.storage.sync.set({ [key]: e.target.checked });
  });
}

loadSettings();
bindToggle('toggle-auto', 'autoShow');
bindToggle('toggle-rated', 'ratedOnly');

// Detect active platform by messaging the content script on the active tab
async function updateStatusDots() {
  const dotCC = document.getElementById('dot-chesscom');
  const dotLC = document.getElementById('dot-lichess');
  if (!dotCC || !dotLC) return;

  // Default: both red
  dotCC.className = 'status-dot red';
  dotLC.className = 'status-dot red';

  try {
    // Get active tab — works from popup without special permissions
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || !tabs[0]) return;

    // Send message to content script on that tab
    chrome.tabs.sendMessage(tabs[0].id, { type: 'get-platform' }, (response) => {
      // If content script is not running (not chess.com/lichess), this errors silently
      if (chrome.runtime.lastError || !response) return;

      if (response.platform === 'lichess') {
        dotLC.className = 'status-dot green';
      } else {
        dotCC.className = 'status-dot green';
      }
    });
  } catch (e) {
    // Not on a chess site — both stay red
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
