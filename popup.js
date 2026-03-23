const DEFAULTS = { autoShow: true, ratedOnly: true, zenMode: false, semiZenMode: false, embeddedRiskScore: false, embeddedStats: false, embedTimeInterval: 86400, embedHideOwnStats: false, embedColorHighlight: true };

async function loadSettings() {
  const s = await chrome.storage.sync.get(DEFAULTS);
  document.getElementById('toggle-auto').checked = s.autoShow;
  document.getElementById('toggle-semizen').checked = s.semiZenMode;
  document.getElementById('toggle-zen').checked = s.zenMode;
  document.getElementById('toggle-embedstats').checked = s.embeddedStats;
  document.getElementById('toggle-embedrisk').checked = s.embeddedRiskScore;
  document.getElementById('toggle-hideown').checked = s.embedHideOwnStats;
  document.getElementById('toggle-colorhl').checked = s.embedColorHighlight;
  document.getElementById('select-interval').value = String(s.embedTimeInterval);
}

function bindToggle(id, key) {
  document.getElementById(id).addEventListener('change', async (e) => {
    await chrome.storage.sync.set({ [key]: e.target.checked });
  });
}

loadSettings();
bindToggle('toggle-auto', 'autoShow');
bindToggle('toggle-embedstats', 'embeddedStats');
bindToggle('toggle-embedrisk', 'embeddedRiskScore');
bindToggle('toggle-hideown', 'embedHideOwnStats');
bindToggle('toggle-colorhl', 'embedColorHighlight');

document.getElementById('select-interval').addEventListener('change', async (e) => {
  await chrome.storage.sync.set({ embedTimeInterval: parseInt(e.target.value, 10) });
});

// Cog toggle for embed settings panel
document.getElementById('embed-cog').addEventListener('click', () => {
  const panel = document.getElementById('embed-settings');
  const cog = document.getElementById('embed-cog');
  const open = panel.style.display !== 'none';
  panel.style.display = open ? 'none' : 'block';
  cog.classList.toggle('open', !open);
});

// Zen modes are mutually exclusive (semi-zen, full zen)
const zenToggles = [
  { id: 'toggle-semizen', key: 'semiZenMode' },
  { id: 'toggle-zen', key: 'zenMode' },
];

zenToggles.forEach(({ id, key }) => {
  document.getElementById(id).addEventListener('change', async (e) => {
    const updates = { [key]: e.target.checked };
    if (e.target.checked) {
      // Disable the other zen modes
      zenToggles.forEach(other => {
        if (other.key !== key) {
          document.getElementById(other.id).checked = false;
          updates[other.key] = false;
        }
      });
      // Full zen: auto-disable embedded stats and embedded risk score
      if (key === 'zenMode') {
        document.getElementById('toggle-embedstats').checked = false;
        document.getElementById('toggle-embedrisk').checked = false;
        updates.embeddedStats = false;
        updates.embeddedRiskScore = false;
      }
      // Semi-zen: auto-disable embedded stats
      if (key === 'semiZenMode') {
        document.getElementById('toggle-embedstats').checked = false;
        updates.embeddedStats = false;
      }
    }
    await chrome.storage.sync.set(updates);
  });
});

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
