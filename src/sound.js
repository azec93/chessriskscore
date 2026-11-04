// ============================================================
// SOUND ALERT: one short sound when an opponent's score finishes loading.
// Three sounds. Harp and Low bell are made by the browser (nothing to download).
// Russian GM is four short spoken clips in sounds/, one per risk level.
// Every sound is bigger as the risk goes up: one soft note, two rising notes, three or four, or a longer, heavier line.
// Used by the page (content.js) and by the preview buttons in the settings popup.
// ============================================================

const CRS_SOUND = (() => {
  const RANK = { low: 0, mod: 1, high: 2, ext: 3 };
  const levelOf = (score) => score >= 75 ? 'ext' : score >= 50 ? 'high' : score >= 25 ? 'mod' : 'low';
  // soundOn is off until the user turns it on; soundFrom is the lowest level that makes a sound.
  const shouldPlay = (s, score) => !!s && s.soundOn === true && RANK[levelOf(score)] >= (RANK[s.soundFrom] ?? RANK.high);

  const LEVEL = { low: { gain: 0.4, tail: 1 }, mod: { gain: 0.6, tail: 1 }, high: { gain: 0.8, tail: 1.15 }, ext: { gain: 1, tail: 1.5 } };
  const MASTER = { low: 0.05, mid: 0.1, high: 0.17 };      // synthesised sounds: kept quiet, nothing sharp
  const CLIP = { low: 0.35, mid: 0.65, high: 1 };          // spoken clips
  let ctx = null, clip = null;
  const audioCtx = () => ctx || (ctx = new (window.AudioContext || window.webkitAudioContext)());

  // one note with a soft 12 ms start (no click) and a smooth fade
  function note(c, t, hz, dur, peak, type, out) {
    const g = c.createGain(); g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); g.connect(out);
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(hz, t); o.connect(g); o.start(t); o.stop(t + dur + 0.05);
  }
  const SYNTH = {
    // Harp: quick plucks run up a chord; Extreme runs one note further.
    harp: (c, t0, out, lv, L) => {
      const n = { low: [392], mod: [523.3], high: [523.3, 784], ext: [523.3, 659.3, 784, 1046.5] }[lv];
      n.forEach((hz, i) => { const t = t0 + i * 0.085, d = i === n.length - 1 ? 1.4 * L.tail : 0.8;
        note(c, t, hz, d, L.gain * 0.9, 'triangle', out); note(c, t, hz * 2, 0.25, L.gain * 0.25, 'sine', out); });
    },
    // Low bell: a warm, deep bell; the notes stack up with the risk.
    bell: (c, t0, out, lv, L) => {
      const n = { low: [330], mod: [440], high: [440, 554.4], ext: [440, 554.4, 659.3] }[lv];
      n.forEach((hz, i) => { const t = t0 + i * 0.17, d = 1.5 * (i === n.length - 1 ? L.tail : 0.8);
        note(c, t, hz, d, L.gain, 'sine', out); note(c, t, hz * 2.76, d * 0.5, L.gain * 0.18, 'sine', out); });
    },
  };

  function playClip(level, vol) {
    let url; try { url = chrome.runtime.getURL('sounds/gm-' + level + '.wav'); } catch (e) { return false; }
    if (clip) { try { clip.pause(); } catch (e) {} }
    clip = new Audio(url); clip.volume = CLIP[vol] ?? CLIP.mid;
    const p = clip.play(); if (p && p.catch) p.catch(() => {});   // the browser may refuse before the page has had a click: stay silent
    return true;
  }

  // sound: 'harp' | 'bell' | 'gm'   level: 'low' | 'mod' | 'high' | 'ext'   vol: 'low' | 'mid' | 'high'
  function play(sound, level, vol) {
    try {
      const L = LEVEL[level]; if (!L) return false;
      if (sound === 'gm') return playClip(level, vol);
      const f = SYNTH[sound] || SYNTH.harp;
      const c = audioCtx(); if (c.state === 'suspended') c.resume();
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3000;
      const m = c.createGain(); m.gain.value = MASTER[vol] ?? MASTER.mid;
      lp.connect(m).connect(c.destination);
      f(c, c.currentTime + 0.02, lp, level, L);
      return true;
    } catch (e) { return false; }
  }
  // what the Russian GM says in each clip, for the speech bubble in the popup
  const GM_LINES = { low: 'Pretty low risk.', mod: 'Slightly risky.', high: 'A bit of a high risk.', ext: 'Very extreme looking risk!' };
  return { levelOf, shouldPlay, play, RANK, GM_LINES };
})();
