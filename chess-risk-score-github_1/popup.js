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
