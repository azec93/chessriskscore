// Overlay styles. They are placed inside the overlay's shadow root so the host page
// (chess.com / lichess) and the overlay cannot restyle each other.
// This file is the source: edit the CSS below directly. It is plain CSS in a template string.
const CRS_OVERLAY_CSS = `
:host{all:initial}
/* Hallmark · round 3 · Tonal Pastel · Material-3 dark surfaces, pastel hue per metric, motion on transform/opacity only */
:host{
  --bg: oklch(18% 0.014 285);
  --c1: oklch(22.5% 0.017 285);
  --c2: oklch(27% 0.02 285);
  --c3: oklch(33% 0.022 285);
  --on: oklch(95% 0.008 285);
  --on2: oklch(79% 0.014 285);
  --on3: oklch(67% 0.016 285);
  --lav: oklch(80% 0.145 290);
  --sky: oklch(82% 0.12 225);
  --mint: oklch(84% 0.155 163);
  --peach: oklch(83% 0.14 55);
  --rose: oklch(77% 0.155 14);
  --butter: oklch(90% 0.14 100);
  --prim: var(--lav);
  --prim-c: oklch(36% 0.07 290);
  --on-prim-c: oklch(93% 0.04 290);
  --warn: var(--butter);
  --flag: var(--rose);
  --focus: oklch(84% 0.1 235);
  --sq-l: #ebecd0;
  --sq-d: #739552;
  --font: 'Roboto Flex', 'Roboto', system-ui, 'Segoe UI', sans-serif;
  --ease: cubic-bezier(.2,0,0,1);
  --out: cubic-bezier(.16,1,.3,1);
}
*{box-sizing:border-box;margin:0}
button,select{font:inherit;color:inherit}
button{background:none;border:0;cursor:pointer}
:focus-visible{outline:2px solid var(--focus);outline-offset:2px}


.ver{font-size:11px;color:var(--on3);font-weight:400}
.credit{font-size:12px;color:var(--on3)}.credit b{font-weight:500;color:var(--on2)}.credit em{font-style:normal;color:var(--on2)}
.dot{display:inline-block;width:10px;height:10px;border-radius:50%}
.dot.low{background:var(--mint)}.dot.mod{background:var(--butter)}.dot.high{background:var(--peach)}.dot.ext{background:var(--rose)}
.flag{color:var(--flag)}.warn{color:var(--warn)}

@keyframes rise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes enter{from{opacity:0;transform:translateY(10px) scale(.985)}to{opacity:1;transform:none}}
@keyframes fade{from{opacity:0}to{opacity:1}}
.rise{animation:rise .5s var(--out) both;animation-delay:calc(var(--i,0) * 45ms + 100ms)}

/* folds: smooth height without animating height */
.fold-b{display:grid;grid-template-rows:0fr;transition:grid-template-rows .38s var(--out)}
.fold.open > .fold-b{grid-template-rows:1fr}
.fold-in{overflow:hidden;min-height:0}

/* ── popup ── */
.pop{width:320px;max-width:100%;background:var(--c1);border-radius:28px;padding:8px 0 4px;overflow:hidden;animation:enter .45s var(--out) both}
.p-head{display:flex;align-items:center;gap:12px;padding:14px 24px 10px}
.p-head img{width:28px;height:28px;border-radius:8px}
.p-head b{font-size:15px;font-weight:700;letter-spacing:.09em;text-transform:uppercase}
.sec{padding:8px 0 6px}
.sec h2{font-size:13px;font-weight:500;padding:8px 24px 4px;letter-spacing:.01em}
.sec h2{color:var(--lav)}
.r{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:8px 24px;min-height:52px}
.r-t b{display:block;font-weight:400;font-size:15px}
.r-t small{display:block;font-size:12.5px;color:var(--on3);margin-top:1px}
.r-ctl{display:flex;align-items:center;gap:6px}
.tg{position:relative;flex:none;width:46px;height:26px;border-radius:13px;background:var(--c2);border:2px solid var(--on3);transition:background .25s var(--ease),border-color .25s var(--ease)}
.tg i{position:absolute;top:50%;left:4px;width:12px;height:12px;margin-top:-6px;border-radius:50%;background:var(--on3);transition:transform .3s var(--out),width .2s var(--ease),height .2s var(--ease),margin .2s var(--ease),background .25s}
.tg:active i{width:18px;height:18px;margin-top:-9px}
.tg[aria-checked=true]{background:var(--prim);border-color:var(--prim)}
.tg[aria-checked=true] i{transform:translateX(18px);width:16px;height:16px;margin-top:-8px;background:var(--bg)}
.tg[aria-checked=true]:active i{width:20px;height:20px;margin-top:-10px;transform:translateX(16px)}
select{background:var(--c2);border:0;border-radius:10px;padding:7px 10px;font-size:13.5px;color:var(--on);cursor:pointer;transition:background .2s}
select:hover{background:var(--c3)}
.cogb{width:34px;height:34px;display:grid;place-items:center;border-radius:50%;color:var(--on3);transition:transform .45s var(--out),background .2s,color .2s}
.cogb:hover{background:var(--c2);color:var(--on)}.cogb.on{color:var(--lav);transform:rotate(90deg);background:color-mix(in oklch,var(--lav) 14%,var(--c1))}
.subpanel{margin:2px 16px 6px;background:var(--bg);border-radius:20px;padding:4px 0}
.subpanel .r{padding:6px 16px;min-height:46px}
.acc{border-top:1px solid var(--c2)}
.fold-h{width:100%;text-align:left}
.acc .fold-h{display:flex;justify-content:space-between;align-items:center;padding:14px 24px;font-size:15px;transition:background .2s}
.acc .fold-h:hover{background:var(--c2)}
.fold-h svg{color:var(--on3);transition:transform .35s var(--out),color .2s;flex:none}
.fold.open > .fold-h svg{transform:rotate(90deg);color:var(--lav)}
.acc-b,.acc .fold-in{color:var(--on2);font-size:13.5px}
.acc .fold-in{padding:0 24px}
.acc .fold-in > *:first-child{margin-top:0}
.acc .fold-in > *:last-child{margin-bottom:16px}
.acc .fold-in p{margin-top:8px}.acc .fold-in b{font-weight:500;color:var(--on)}
.guide{display:grid;gap:10px;margin-bottom:0}
.guide div{display:grid;grid-template-columns:12px 72px 1fr;gap:10px;align-items:center}
.guide code{font:inherit;color:var(--on3)}
.formula{font-size:13px;background:var(--bg);padding:10px 12px;border-radius:12px;color:var(--on)}
.p-foot{display:flex;justify-content:space-between;align-items:center;padding:12px 24px 14px;border-top:1px solid var(--c2)}
.p-foot a{display:inline-flex;gap:6px;align-items:center;color:var(--lav);text-decoration:none;font-weight:500;font-size:13px}

/* ── overlay ── */
.ov{--crs-risk:var(--mint);width:364px;max-width:100%;zoom:var(--crs-scale,1);border-radius:28px;padding-bottom:6px;overflow:hidden;
  background:var(--c1);box-shadow:0 14px 44px oklch(6% 0.02 285 / .55);
  transition:--crs-risk .7s var(--ease);animation:enter .5s var(--out) both}
.ov[data-band=low]{--crs-risk:var(--mint)}.ov[data-band=mod]{--crs-risk:var(--butter)}.ov[data-band=high]{--crs-risk:var(--peach)}.ov[data-band=ext]{--crs-risk:var(--rose)}
.o-bar{display:flex;align-items:center;justify-content:space-between;padding:14px 12px 8px 22px}
.acts{display:flex}
.brand{display:flex;align-items:center;gap:10px}
.brand img{width:22px;height:22px;border-radius:6px}
.brand b{font-size:14px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;white-space:nowrap}
.ib{width:36px;height:36px;display:grid;place-items:center;border-radius:50%;color:var(--on2);transition:background .2s,color .2s,transform .4s var(--out)}
.ib:hover{background:color-mix(in oklch,var(--on) 9%,transparent);color:var(--on)}
.ib:first-child:hover{transform:rotate(60deg)}
.tabs{position:relative;display:grid;grid-template-columns:1fr 1fr;margin:6px 20px 0;padding:3px;background:var(--bg);border-radius:12px}
.tabs::before{content:"";position:absolute;top:3px;bottom:3px;left:3px;width:calc((100% - 6px) / 2);border-radius:9px;background:var(--c3);
  box-shadow:inset 0 0 0 1px color-mix(in oklch,var(--on) 9%,transparent);transform:translateX(calc(var(--i,0) * 100%));transition:transform .45s var(--out)}
.tabs button{position:relative;display:block;padding:10px 8px;min-width:0;text-align:center}
.tabs b{display:block;max-width:100%;font-size:14px;font-weight:500;color:var(--on3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:color .25s}
.tabs button:hover b{color:var(--on2)}
.tabs button[aria-selected=true] b{color:var(--on)}
.score{display:grid;grid-template-columns:92px 1fr;gap:18px;align-items:center;padding:20px 22px 8px}
.ring{position:relative;width:92px;height:92px}
.ring svg{width:92px;height:92px;transform:rotate(-90deg);overflow:visible}
.rt{fill:none;stroke:var(--c3);stroke-width:7}
.rf{fill:none;stroke:var(--crs-risk);stroke-width:7;stroke-linecap:round;transition:stroke-dashoffset 1s var(--out)}
.head{transform-origin:38px 38px;transition:transform 1s var(--out)}
.head circle{fill:var(--on);}
.ring b{position:absolute;inset:0;display:grid;place-items:center;font-size:32px;font-weight:600;letter-spacing:-.02em;color:var(--crs-risk)}
.verdict{margin-bottom:8px}
.vd{display:block;font-size:17px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--crs-risk);line-height:1.2;transition:color .7s var(--ease)}
.m{--hue:var(--lav);display:grid;grid-template-columns:78px 1fr 44px;gap:10px;align-items:center;min-height:26px}
.m-l{font-size:13px;color:var(--on2)}
.m-t{position:relative;height:6px;border-radius:3px;background:var(--c3)}
.m-f{position:absolute;inset:0 auto 0 0;border-radius:3px;background:var(--crs-risk);transition:width .95s var(--out),background .4s;transition-delay:calc(var(--i,0) * 60ms)}
.m-f.warn{background:var(--warn)}.m-f.flag{background:var(--flag)}
.m-t u{position:absolute;top:-4px;bottom:-4px;width:2px;border-radius:1px;background:var(--on);opacity:.8;animation:fade .5s ease both .6s}
.m-v{font-size:13px;font-weight:500;text-align:right;color:var(--on)}
.m-v.warn{color:var(--warn)}.m-v.flag{color:var(--flag)}
.tags-wrap{display:grid;grid-template-rows:1fr;transition:grid-template-rows .4s var(--out)}
.ov[data-badges=off] .tags-wrap{grid-template-rows:0fr}
.chips{padding:0 22px;overflow:hidden;min-height:0}
.chips-in{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding-top:12px}
.ft{display:flex;align-items:center;gap:8px;height:34px;padding:0 12px 0 10px;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-radius:8px;background:var(--c2);
  box-shadow:inset 0 0 0 1px var(--c3);font-size:12.5px;font-weight:500;color:var(--on);cursor:default;transition:background .2s}
.ft:hover{background:var(--c3)}
.ft svg{width:16px;height:16px;flex:none;color:var(--butter)}
.ft.med svg{color:var(--peach)}.ft.high svg{color:var(--rose)}
.facts{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:12px 22px 0}
.facts div{--hue:var(--lav);border-radius:14px;height:60px;padding:0 6px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;text-align:center;background:var(--c2);transition:transform .3s var(--out)}
.facts div:hover{transform:translateY(-2px)}
.facts b{display:block;font-size:17px;line-height:1;font-weight:500;letter-spacing:-.01em;color:var(--on)}
.facts b.warn{color:var(--warn)}.facts b.flag{color:var(--flag)}
.facts span{font-size:12px;color:var(--on2)}
.tbl{padding:16px 14px 0}
.th,.tr{display:grid;grid-template-columns:24px repeat(5,minmax(0,1fr));align-items:center;gap:0;text-align:center}
.th{font-size:11.5px;color:var(--on3);padding-bottom:6px;font-weight:500}
.tr{min-height:40px;border-top:1px solid var(--c2);font-size:13.5px;margin:0 -8px;padding:0 8px;border-radius:12px;transition:background .2s}
.tr:hover{background:var(--c2)}
.fi{display:grid;place-items:center;color:var(--on3)}
.wld{font-weight:500;color:var(--on3)}
.wld .w{font-style:normal;color:var(--mint)}.wld .l{font-style:normal;color:var(--rose)}.wld .d{font-style:normal;color:var(--on3)}
.cn{position:relative;display:inline-block}
.cd{position:absolute;left:100%;top:50%;transform:translateY(-50%);margin-left:4px;font-size:11px;font-weight:500;font-style:normal;white-space:nowrap}
.cd.up{color:var(--mint)}.cd.dn{color:var(--rose)}
.tr.none{grid-template-columns:24px 1fr}
.wld{font-size:13px;white-space:nowrap}
.nodata{text-align:left;color:var(--on3)}
.o-foot{display:flex;align-items:center;justify-content:space-between;padding:6px 20px 14px}
.refresh{display:inline-flex;align-items:center;gap:8px;padding:10px 18px;border-radius:999px;background:var(--prim-c);color:var(--on-prim-c);font-weight:500;font-size:14px;transition:background .2s,transform .2s var(--out)}
.refresh:hover{background:color-mix(in oklch,var(--prim-c) 80%,var(--lav))}
.refresh:active{transform:scale(.97)}
.refresh svg{transition:transform .6s var(--out)}
.refresh:hover svg{transform:rotate(180deg)}

/* BTTW mark: figure throws a brick through the window, flash + confetti. Loops every 3s. */
.bttw{display:inline-flex;align-items:center;gap:8px}
.bttw-l{font-size:11px;font-weight:600;line-height:1.25;letter-spacing:.1em;text-transform:uppercase;color:color-mix(in oklch,var(--rose) 62%,var(--on3));cursor:help}
.bttw-a{position:relative;display:block;width:80px;height:34px;overflow:hidden}
.bttw-thrower{position:absolute;left:14px;bottom:0;width:20px;height:30px;transform-origin:center bottom;animation:bttw-throw 3s ease-in-out 1 both}
.bttw-brick{position:absolute;left:34px;bottom:22px;width:7px;height:5px;border-radius:1px;background:var(--rose);opacity:0;animation:bttw-fly 3s ease-in 1 both}
.bttw-window{position:absolute;right:6px;bottom:3px;width:24px;height:26px;border:1.5px solid color-mix(in oklch,var(--on) 22%,transparent);border-radius:3px;background:color-mix(in oklch,var(--sky) 7%,transparent)}
.bttw-window::before{content:"";position:absolute;left:50%;top:0;bottom:0;width:1px;background:color-mix(in oklch,var(--on) 12%,transparent)}
.bttw-window::after{content:"";position:absolute;top:50%;left:0;right:0;height:1px;background:color-mix(in oklch,var(--on) 12%,transparent)}
.bttw-flash{position:absolute;right:9px;bottom:8px;width:18px;height:18px;border-radius:50%;background:radial-gradient(circle,oklch(97% 0.06 95 / .85) 0%,oklch(85% 0.12 70 / .35) 42%,transparent 70%);opacity:0;animation:bttw-flash 3s ease-out 1 both}
.bttw-confetti{position:absolute;right:2px;bottom:2px;width:34px;height:30px;pointer-events:none}
.bttw-confetti i{position:absolute;left:14px;top:14px;width:4px;height:4px;border-radius:1px;opacity:0;animation:bttw-settle 3s ease-out 1 both}
.bttw-confetti i:nth-child(1){background:var(--rose);--cx:-16px;--cy:-16px;--cr:400deg;width:5px;height:3px}
.bttw-confetti i:nth-child(2){background:var(--butter);left:16px;top:12px;--cx:14px;--cy:-20px;--cr:-360deg;animation-delay:.02s;width:3px;height:5px}
.bttw-confetti i:nth-child(3){background:var(--sky);left:18px;top:16px;--cx:18px;--cy:-8px;--cr:320deg;animation-delay:.04s}
.bttw-confetti i:nth-child(4){background:var(--lav);left:12px;top:10px;--cx:-12px;--cy:-22px;--cr:-420deg;animation-delay:.01s;width:3px;height:5px}
.bttw-confetti i:nth-child(5){background:var(--mint);left:20px;top:14px;--cx:20px;--cy:-12px;--cr:460deg;animation-delay:.05s}
.bttw-confetti i:nth-child(6){background:var(--peach);left:10px;top:16px;--cx:-20px;--cy:-6px;--cr:-280deg;animation-delay:.03s;width:5px;height:2px}
@keyframes bttw-throw{0%,100%{transform:rotate(0)}22%{transform:rotate(-22deg)}32%{transform:rotate(12deg)}42%{transform:rotate(0)}}
@keyframes bttw-fly{0%,28%{left:34px;bottom:22px;opacity:0;transform:rotate(0)}30%{opacity:1}52%{left:56px;bottom:13px;opacity:1;transform:rotate(540deg)}53%{opacity:0}100%{opacity:0}}
@keyframes bttw-flash{0%,51%{opacity:0;transform:scale(.2)}53%{opacity:1;transform:scale(1.5)}60%{opacity:0;transform:scale(2.4)}100%{opacity:0}}
@keyframes bttw-pop{0%,51%{opacity:0;transform:translate(0,0) rotate(0) scale(.3)}54%{opacity:1;transform:translate(0,0) rotate(0) scale(1.3)}70%{opacity:.9;transform:translate(var(--cx),var(--cy)) rotate(var(--cr)) scale(1)}90%{opacity:.3;transform:translate(calc(var(--cx)*1.2),calc(var(--cy) + 14px)) rotate(var(--cr)) scale(.6)}100%{opacity:0}}
.p-foot-r{display:flex;flex-direction:column;align-items:flex-end;gap:4px}
.p-foot-r .credit em{font-weight:600;color:color-mix(in oklch,var(--sky) 60%,var(--on3))}
.o-credit{display:inline-flex;align-items:center;gap:10px}
.o-credit .bttw{zoom:.72}
.o-credit .credit em{font-style:normal;font-weight:600;color:var(--on2)}
.ov .acc{margin-top:10px}
.ov .acc .fold-h{padding:14px 22px}
.ov .acc .fold-in{padding:0 22px}
.ov .o-foot{border-top:1px solid var(--c2);margin-top:0;padding-top:12px}

/* all-caps labels like the original extension */
.acc .fold-h > span{font-size:12.5px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--on2)}
.acc.open .fold-h > span,.acc .fold-h:hover > span{color:var(--on)}
.refresh span{font-size:13px;font-weight:700;letter-spacing:.09em;text-transform:uppercase}
/* small labels: all caps, tracked, like the original */
.facts span{display:block;font-size:9.5px;line-height:1;font-weight:500;letter-spacing:.07em;text-transform:uppercase;white-space:nowrap}
.th{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase}
.sec h2{font-size:12px;font-weight:700;letter-spacing:.09em;text-transform:uppercase}

/* full calculation panel: ledger + accuracy scale + baselines */
.calc{padding-top:2px}
.cs{margin-top:22px}
.cs:first-child{margin-top:6px}
.cs h4{display:flex;justify-content:space-between;align-items:baseline;margin:0 0 12px;padding-bottom:8px;border-bottom:1px solid var(--c3);
  font-size:11.5px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--on2)}
.cs h4 span{font-size:12px;font-weight:400;letter-spacing:0;text-transform:none;color:var(--on3)}
.formula2{font-size:12px;line-height:1.6;text-align:center;color:var(--on2);background:var(--bg);border-radius:12px;padding:10px 12px;margin-bottom:14px;letter-spacing:.01em}
.stack{display:flex;gap:2px;height:8px;margin-bottom:6px;border-radius:4px;overflow:hidden}
.stack i{display:block;border-radius:2px}
.s-owr{background:var(--lav)}.s-rwr{background:var(--sky)}.s-acc{background:var(--peach)}.s-rest{background:var(--c3)}
.ldg .lr{display:grid;grid-template-columns:10px 1fr 40px 44px;gap:10px;align-items:center;min-height:38px;border-bottom:1px solid var(--c2)}
.lr > i{width:10px;height:10px;border-radius:3px;background:transparent}
.lr > i.s-owr{background:var(--lav)}.lr > i.s-rwr{background:var(--sky)}.lr > i.s-acc{background:var(--peach)}
.lr .nm{font-size:13.5px;font-weight:500;color:var(--on)}
.lr .nm small{margin-left:8px;font-size:11.5px;font-weight:400;color:var(--on3)}
.lr .wt{font-size:12.5px;color:var(--on3);text-align:right}
.lr .pt{font-size:14px;font-weight:500;text-align:right;color:var(--on)}
.lr.sub .nm,.lr.sub .pt{color:var(--on2)}
.lr.sub{border-bottom-color:var(--c3)}
.lr.mult .pt{color:var(--on2)}
.lr.fin{border-bottom:0;min-height:44px}
.lr.fin .nm{font-weight:700;letter-spacing:.05em;text-transform:uppercase;font-size:12.5px}
.lr.fin .pt{font-size:20px;font-weight:600;color:var(--crs-risk)}
.scale{position:relative;height:10px;border-radius:5px;background:var(--c3);margin:20px 0 0}
.scale .band{position:absolute;top:0;bottom:0;border-radius:5px;background:color-mix(in oklch,var(--lav) 55%,var(--c3))}
.scale .tk{position:absolute;top:-4px;bottom:-4px;width:2px;margin-left:-1px;border-radius:1px}
.scale .tk.exp{background:var(--on)}
.scale .tk.lim{background:var(--butter)}
.scale .you{position:absolute;top:50%;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;background:var(--mint);box-shadow:0 0 0 3px var(--c1)}
.scale .you.warn{background:var(--butter)}.scale .you.flag{background:var(--rose)}
.sax{display:flex;justify-content:space-between;margin-top:8px;font-size:10.5px;color:var(--on3)}
.kv{display:grid;grid-template-columns:1fr;margin:10px 0 0}
.kv > div{display:flex;justify-content:space-between;align-items:center;min-height:36px;border-bottom:1px solid var(--c2);font-size:13.5px}
.kv > div:last-child{border-bottom:0}
.kv dt{display:flex;align-items:center;gap:8px;color:var(--on2)}
.kv dd{font-weight:500;color:var(--on);margin:0}
.kv i{display:inline-block;flex:none}
.k-band{width:12px;height:8px;border-radius:3px;background:color-mix(in oklch,var(--lav) 55%,var(--c3))}
.k-exp{width:2px;height:12px;border-radius:1px;background:var(--on);margin:0 5px}
.k-lim{width:2px;height:12px;border-radius:1px;background:var(--butter);margin:0 5px}
.k-you{width:10px;height:10px;border-radius:50%;background:var(--mint)}
.k-you.warn{background:var(--butter)}.k-you.flag{background:var(--rose)}
.bt .bth,.bt .btr{display:grid;grid-template-columns:1.1fr 1fr 1fr .9fr;align-items:center;text-align:right;column-gap:8px}
.bt .bth{padding:0 10px 6px;font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--on3)}
.bt .bth span:first-child,.bt .btr .bf{text-align:left}
.bt .btr{min-height:38px;padding:0 10px;border-radius:10px;font-size:13px;color:var(--on)}
.bt .btr + .btr{margin-top:2px}
.bt .btr.on{background:var(--c2)}
.bt .bf{display:flex;align-items:center;gap:8px;font-weight:500}
.bt .bf svg{color:var(--on3);width:16px;height:16px}
.bt .btr.on .bf svg{color:var(--lav)}

/* contact link beside BTTW Media */
.p-foot-l{display:flex;align-items:center;gap:12px}
.p-foot .credit,.o-foot .credit{white-space:nowrap}
.mail-l{display:inline-flex;align-items:center;gap:6px;color:var(--lav);font-size:12.5px;font-weight:600;text-decoration:none;padding:6px 8px;margin:-6px -4px;border-radius:8px;transition:background .2s}
.mail-l:hover{background:color-mix(in oklch,var(--lav) 14%,transparent);text-decoration:underline;text-underline-offset:3px}
.mail-i{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;color:var(--lav);transition:background .2s}
.mail-i:hover{background:color-mix(in oklch,var(--lav) 16%,transparent)}
.o-credit{gap:6px}

/* compact refresh so the footer has room for a readable Contact link */
.o-foot{padding:6px 18px 12px}
.o-foot .refresh{padding:7px 12px;gap:6px;font-size:12px}
.o-foot .refresh span{font-size:11.5px}
.o-foot .refresh svg{width:14px;height:14px}
.o-credit{gap:10px}
.o-credit .mail-l{margin:0}

.o-foot{gap:8px;padding:6px 18px 12px}
.o-foot .refresh{padding:6px 10px;font-size:11px}
.o-foot .refresh span{font-size:11px;letter-spacing:.07em}
.o-credit{gap:8px;flex:none}
.o-credit .bttw{zoom:.64;gap:6px}
.o-credit .mail-l{padding:0;margin:0;font-size:12px}
.o-credit .credit{font-size:12px}
/* report flag under the score ring (opponent only) */
.ring-col{display:flex;flex-direction:column;align-items:center;gap:4px}
.rep-flag{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;color:var(--on3);transition:background .2s,color .2s}
.rep-flag svg{width:15px;height:15px}
.rep-flag:hover{color:var(--rose);background:color-mix(in oklch,var(--rose) 13%,transparent)}

/* overlay footer: BTTW label, Contact and credit share one type style; only the animation is scaled */
.o-credit .bttw{zoom:1;gap:6px}
.o-credit .bttw-a{zoom:.58}
.o-credit .bttw-l,.o-credit .mail-l,.o-credit .credit{font-size:10px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;line-height:1.25}
.o-credit .mail-l{gap:5px}
.o-credit .mail-l svg{width:12px;height:10px}
.o-credit .credit em{font-weight:600}
.o-credit{gap:6px}

/* popup footer uses the same one-style row as the overlay: BTTW | BY AZ_93 | CONTACT */
.p-foot{justify-content:flex-start}
.p-foot-l{gap:12px;flex-wrap:nowrap}
.p-foot .bttw-l,.p-foot .mail-l,.p-foot .credit{font-size:10px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;line-height:1.25}
.p-foot .mail-l{padding:0;margin:0;gap:5px}
.p-foot .mail-l svg{width:12px;height:10px}
.p-foot .credit em{font-weight:600}

/* BTTW plays once, then rests: confetti stays scattered over the window */
.bttw-confetti i:nth-child(1){--fx:-9px;--fy:-9px}
.bttw-confetti i:nth-child(2){--fx:10px;--fy:-8px}
.bttw-confetti i:nth-child(3){--fx:11px;--fy:8px}
.bttw-confetti i:nth-child(4){--fx:-8px;--fy:12px}
.bttw-confetti i:nth-child(5){--fx:3px;--fy:11px}
.bttw-confetti i:nth-child(6){--fx:14px;--fy:-1px}
@keyframes bttw-settle{
  0%,51%{opacity:0;transform:translate(0,0) rotate(0) scale(.3)}
  56%{opacity:1;transform:translate(0,0) rotate(0) scale(1.3)}
  80%{opacity:1;transform:translate(calc(var(--fx) * 1.2),calc(var(--fy) * 1.2 - 6px)) rotate(var(--cr)) scale(1)}
  100%{opacity:1;transform:translate(var(--fx),var(--fy)) rotate(var(--cr)) scale(1)}
}
.bttw.static .bttw-thrower,.bttw.static .bttw-brick,.bttw.static .bttw-flash,.bttw.static .bttw-confetti i{animation:none}
.bttw.static .bttw-brick,.bttw.static .bttw-flash{opacity:0}
.bttw.static .bttw-confetti i{opacity:1;transform:translate(var(--fx),var(--fy)) rotate(var(--cr))}

/* tighter rhythm */
.pop{padding-top:4px}
.p-head{padding:10px 20px 6px}
.sec{padding:4px 0 2px}
.sec h2{padding:6px 20px 2px}
.r{padding:5px 20px;min-height:44px}
.subpanel .r{min-height:42px;padding:4px 14px}
.acc .fold-h{padding:11px 20px}
.acc .fold-in{padding:0 20px}
.acc .fold-in > *:last-child{margin-bottom:12px}
.p-foot{padding:10px 20px 12px}
.o-bar{padding:10px 10px 4px 20px}
.tabs{margin:2px 18px 0}
.tabs button{padding:8px 8px}
.score{padding:14px 20px 4px;gap:16px}
.m{min-height:23px}
.verdict{margin-bottom:5px}
.chips-in{padding-top:10px;gap:5px}
.ft{height:30px}
.facts{padding:10px 20px 0;gap:6px}
.facts div{height:54px;gap:4px}
.tbl{padding:12px 14px 0}
.th{padding-bottom:4px}
.tr{min-height:34px}
.ov .acc{margin-top:6px}
.ov .acc .fold-h{padding:11px 20px}
.ov .acc .fold-in{padding:0 20px}
.o-foot{padding:4px 18px 10px}
.calc{padding-top:0}
.cs{margin-top:16px}
.cs h4{margin-bottom:8px;padding-bottom:6px}
.formula2{margin-bottom:10px;padding:8px 10px}
.ldg .lr{min-height:33px}
.lr.fin{min-height:38px}
.kv > div{min-height:31px}
.scale{margin-top:16px}
.bt .btr{min-height:32px}
@media(prefers-reduced-motion:reduce){
  *,*::before,*::after{transition:none!important;animation:none!important}
  .rise,.pop,.ov{opacity:1;transform:none}
  .bttw-confetti i{opacity:1;transform:translate(var(--fx),var(--fy)) rotate(var(--cr))}
}

/* ── extension-only additions (not in the prototype) ── */
.ov{font:400 14px/1.4 var(--font);font-variant-numeric:tabular-nums;color:var(--on);text-align:left;letter-spacing:normal;cursor:default;-webkit-font-smoothing:antialiased;user-select:none}
.ov a{cursor:pointer}
.o-bar{cursor:grab}
.ov.quiet,.ov.quiet .rise,.ov.quiet .m-t u{animation:none}
.ft.low svg{color:var(--butter)}.ft.good svg{color:var(--sky)}
.ft span{overflow:hidden;text-overflow:ellipsis}
.m-v.none{color:var(--on3)}
.state{padding:22px 22px 26px;text-align:center}
.state-l{font-size:11px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:var(--on3)}
.state-n{margin-top:4px;font-size:17px;font-weight:500;color:var(--on);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dots{display:flex;gap:7px;justify-content:center;margin:18px 0 10px}
.dots i{width:8px;height:8px;border-radius:50%;background:var(--lav);animation:crs-dot .9s var(--ease) infinite alternate}
.dots i:nth-child(2){animation-delay:.15s}.dots i:nth-child(3){animation-delay:.3s}
@keyframes crs-dot{from{opacity:.25;transform:translateY(0)}to{opacity:1;transform:translateY(-4px)}}
.state-t{font-size:13px;color:var(--on3)}
.state.err .state-t{margin-top:14px;color:var(--rose);font-size:13.5px}
.semi{display:grid;justify-items:center;gap:10px;padding:14px 22px 18px}
.expand{display:inline-flex;align-items:center;gap:6px;margin-top:2px;padding:7px 14px;border-radius:999px;background:var(--prim-c);color:var(--on-prim-c);font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;transition:background .2s}
.expand:hover{background:color-mix(in oklch,var(--prim-c) 80%,var(--lav))}
.expand svg{width:14px;height:14px}
.refresh[disabled]{opacity:.7;cursor:default}
.refresh[disabled] svg{animation:crs-spin .8s linear infinite}
@keyframes crs-spin{to{transform:rotate(360deg)}}
.ldg .lr.sig{grid-template-columns:10px 1fr auto}
.lr.sig .pt{font-size:12.5px;white-space:nowrap}
.lr .pt.up{color:var(--rose)}.lr .pt.dn{color:var(--mint)}.lr .pt.nil{color:var(--on3)}
.cs .note{margin-top:10px;font-size:12px;line-height:1.5;color:var(--on3)}
/* never taller than the window: the calculation panel scrolls inside the overlay */
.ov{max-height:calc((100vh - 100px) / var(--crs-scale,1));overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:var(--c3) transparent}
/* format table rows: one step smaller than the prototype (13.5 -> 12.5) */
.tr{font-size:12.5px}
.wld{font-size:12px}
.cd{font-size:10.5px}
/* confetti falls away at the end of the BTTW animation; the resting frame has none */
@keyframes bttw-settle{0%,51%{opacity:0;transform:translate(0,0) rotate(0) scale(.3)}56%{opacity:1;transform:translate(0,0) rotate(0) scale(1.3)}80%{opacity:1;transform:translate(calc(var(--fx) * 1.2),calc(var(--fy) * 1.2 - 6px)) rotate(var(--cr)) scale(1)}100%{opacity:0;transform:translate(var(--fx),calc(var(--fy) + 8px)) rotate(var(--cr)) scale(.7)}}
.bttw.static .bttw-confetti i{opacity:0}
@media(prefers-reduced-motion:reduce){.bttw-confetti i{opacity:0}}
/* sub-heading inside the score ledger */
.ldg .lr.cmp{grid-template-columns:10px 1fr;min-height:30px;border-bottom:0;align-items:end}
.lr.cmp .nm{font-size:10.5px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--on3);padding-bottom:4px}
/* shown when part of the player's data did not load */
.notice{display:flex;align-items:flex-start;gap:8px;margin:10px 20px 0;padding:9px 12px;border-radius:12px;background:color-mix(in oklch,var(--butter) 12%,var(--c1));box-shadow:inset 0 0 0 1px color-mix(in oklch,var(--butter) 35%,transparent);font-size:12.5px;line-height:1.4;color:var(--on)}
.notice svg{flex:none;color:var(--butter);margin-top:1px}
`;
