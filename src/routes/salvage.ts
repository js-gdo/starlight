import { getSessionUser } from '../utils/auth';
import { getLayout } from '../utils/layout';
import type { Env } from '../env.d';

const SALVAGE_STYLES = `
    .salvage{--ink:#edf4ff;--muted:#9aabc4;--line:#30435b;--panel:#142238;--cyan:#71e4df;--gold:#f2c979;color:var(--ink)}
    .salvage-hero{position:relative;overflow:hidden;padding:clamp(24px,5vw,44px);border:1px solid #4a637b;border-radius:21px;background:radial-gradient(ellipse at 83% 8%,#61d9dc30,transparent 37%),radial-gradient(ellipse at 8% 110%,#7564ce38,transparent 48%),linear-gradient(125deg,#111d2d,#1a3446 55%,#162239);box-shadow:0 20px 52px #09111e66}
    .salvage-hero h1{margin:8px 0;color:#fff;font-size:clamp(30px,6vw,46px)}
    .salvage-hero p{max-width:700px;margin:0;color:#c3d0df;line-height:1.75}
    .salvage-kicker{color:var(--cyan);font-size:10px;font-weight:900;letter-spacing:.2em}
    .salvage-wallet{display:flex;gap:8px;flex-wrap:wrap;margin-top:15px}
    .salvage-wallet span,.salvage-pill{padding:6px 10px;border:1px solid #38566d;border-radius:99px;background:#1b3045;color:#e3f5fa;font-size:11px}
    .salvage-grid{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(290px,.9fr);gap:13px;margin-top:13px;align-items:start}
    .salvage-panel{min-width:0;margin-top:13px;padding:clamp(14px,3vw,20px);border:1px solid var(--line);border-radius:15px;background:linear-gradient(145deg,#172840,#111d30);box-shadow:0 9px 27px #08111d42}
    .salvage-grid .salvage-panel{margin-top:0}
    .salvage-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px}
    .salvage-heading h2{margin:0;color:#f5f8ff;font-size:16px}
    .salvage-heading p{margin:4px 0 0;color:var(--muted);font-size:10px;line-height:1.6}
    .salvage-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:12px 0}
    .salvage-stat{padding:11px;border:1px solid #2e435c;border-radius:10px;background:#192b42}
    .salvage-stat span{color:var(--muted);font-size:9px}
    .salvage-stat strong{display:block;margin-top:5px;color:#fff;font-size:17px}
    .salvage-bar{height:8px;margin:6px 0 12px;overflow:hidden;border-radius:99px;background:#3c3340}
    .salvage-bar i{display:block;height:100%;background:linear-gradient(90deg,#59c9b9,#8ae2ae)}
    .salvage-map{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:5px;max-width:490px;margin:auto}
    .salvage-map-frame{overflow-x:auto;padding:8px;border:1px solid #30465d;border-radius:13px;background:radial-gradient(ellipse at 50% 45%,#203d4b,#101c2a 75%)}
    .salvage-map-svg{display:block;width:100%;min-width:410px;height:auto;max-width:780px;margin:auto}
    .salvage-map-node{cursor:pointer;outline:none}
    .salvage-map-node[aria-disabled="true"]{cursor:default}
    .salvage-map-node:not([aria-disabled="true"]):hover .map-floor{fill:#355c68;stroke:#83e4da;stroke-width:2}
    .salvage-map-node:focus .map-floor{stroke:#f4d284;stroke-width:3}
    .map-floor{fill:#1b2d3c;stroke:#344a5c;stroke-width:1}
    .map-floor.alt{fill:#203242}
    .map-wall{fill:#627487;stroke:#a5b2bd;stroke-width:1.4}
    .map-wall-side{fill:#344452}
    .map-wall-stripe{stroke:#d1a65d;stroke-width:2;opacity:.7}
    .map-current-ring{fill:#f0c86622;stroke:#f4d284;stroke-width:2}
    .salvage-item-art{display:block;flex:0 0 42px;width:42px;height:42px}
    .salvage-item-art svg{display:block;width:100%;height:100%}
    .salvage-item-main{display:flex;min-width:0;align-items:center;gap:10px}
    .salvage-kit-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px}
    .salvage-kit-card{display:flex;align-items:center;gap:9px;min-width:0;padding:9px;border:1px solid #344a61;border-radius:10px;background:#17283a}
    .salvage-kit-card .salvage-item-art{flex-basis:38px;width:38px;height:38px}
    .salvage-kit-card strong{display:block;color:#f0f5ff;font-size:9px}
    .salvage-kit-card small{display:block;margin-top:3px;color:#9eafc3;font-size:8px;line-height:1.4}
    .salvage-equipped{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px}
    .salvage-equipped .salvage-kit-card{background:#1b3040}
    .salvage-cell{position:relative;display:grid;aspect-ratio:1;place-items:center;padding:3px;border:1px solid #42576e;border-radius:7px;background:linear-gradient(145deg,#22354a,#19283a);color:#9eafc2;font-size:clamp(9px,2vw,13px)}
    .salvage-cell.current{border-color:#f0ca73;box-shadow:0 0 0 2px #f0ca7344;color:#fff}
    .salvage-cell.enemy{border-color:#96596b;color:#ffabb0}
    .salvage-cell.container{border-color:#6c6591;color:#d6c7ff}
    .salvage-cell.exit{border-color:#3f907c;color:#7ce3bd}
    .salvage-cell:disabled{opacity:.8;cursor:default}
    .salvage-legend{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin-top:9px;color:#aab9ca;font-size:9px}
    .salvage-controls{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}
    .salvage button,.salvage select,.salvage input{font:inherit}
    .salvage button{padding:8px 11px;border:1px solid #438c96;border-radius:8px;background:linear-gradient(135deg,#287d88,#285f83);color:#fff;font-size:10px;font-weight:800;cursor:pointer}
    .salvage button:hover:not(:disabled){filter:brightness(1.12)}
    .salvage button:disabled{opacity:.42;cursor:not-allowed}
    .salvage .secondary{border-color:#4a5d76;background:linear-gradient(135deg,#36495f,#29384c)}
    .salvage .gold{border-color:#ad8848;background:linear-gradient(135deg,#b68c49,#85613a)}
    .salvage .danger{border-color:#915966;background:linear-gradient(135deg,#8a4559,#623446)}
    .salvage select,.salvage input{max-width:100%;padding:8px 9px;border:1px solid #3b506a;border-radius:7px;background:#101c2e;color:#edf4ff;font-size:10px}
    .salvage-loadout{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}
    .salvage-loadout label,.salvage-inline-field{display:grid;gap:5px;color:#b4c2d4;font-size:9px}
    .salvage-object,.salvage-item,.salvage-job{padding:10px;border:1px solid #30445d;border-radius:10px;background:#192a40}
    .salvage-object{margin-top:9px}
    .salvage-item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center}
    .salvage-item strong,.salvage-object strong,.salvage-job strong{color:#f0f5ff;font-size:10px}
    .salvage-item small,.salvage-object small,.salvage-job small{display:block;margin-top:4px;color:#9eafc3;font-size:9px;line-height:1.5}
    .salvage-item-actions{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}
    .salvage-item-actions button{padding:6px 8px;font-size:9px}
    .salvage-list{display:grid;gap:7px}
    .salvage-manufacturers{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
    .salvage-manufacturer{padding:11px;border:1px solid #35465d;border-radius:11px;background:#192a40}
    .salvage-manufacturer h3{margin:0 0 8px;color:#eaf2ff;font-size:11px}
    .salvage-recipe{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:7px 0;border-top:1px solid #304158}
    .salvage-recipe span{color:#b9c7d8;font-size:9px;line-height:1.5}
    .salvage-recipe button{flex:none;padding:6px 8px;font-size:9px}
    .salvage-feedback{min-height:18px;margin-top:9px;color:#93e5c6;font-size:10px;line-height:1.5}
    .salvage-feedback.error{color:#ff9ba5}
    .salvage-empty{padding:12px;border:1px dashed #42546b;border-radius:9px;color:#9aaac0;font-size:10px;text-align:center}
    .salvage-warning{margin:9px 0;padding:9px 11px;border-left:3px solid #d5a951;border-radius:4px;background:#382f25;color:#f0d9a4;font-size:10px;line-height:1.6}
    .salvage-run-item{display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid #304158;color:#c6d3e2;font-size:9px}
    @media(max-width:850px){.salvage-grid{grid-template-columns:1fr}}
    @media(max-width:540px){.salvage-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.salvage-loadout,.salvage-manufacturers{grid-template-columns:1fr}.salvage-kit-grid,.salvage-equipped{grid-template-columns:1fr}.salvage-hero{padding:22px 18px}}
`;

function salvageMarkup(): string {
    return `
        <main class="salvage" id="salvageGame">
            <section class="salvage-hero">
                <div class="salvage-kicker">STARLIGHT · STATION SALVAGE</div>
                <h1>空间站搜刮行动</h1>
                <p>搜查失联空间站的服务器、保险箱与补给容器，击退巡逻人机，带着收集品抵达撤离点。混乱区物资更好，但门槛更高、敌人更强；生命归零会失去全部入局装备与物资。</p>
                <div id="salvageWallet" class="salvage-wallet"></div>
            </section>
            <div id="salvageNotice" class="salvage-feedback" role="status" aria-live="polite"></div>
            <div id="salvageContent"><div class="salvage-empty">正在扫描空间站档案…</div></div>
        </main>
        <script>
        (function(){
            var root=document.getElementById('salvageGame');
            var notice=document.getElementById('salvageNotice');
            var state=null;
            function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(char){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char];});}
            function number(value){return new Intl.NumberFormat('zh-CN').format(Number(value)||0);}
            function inventoryKind(kind){return state.items.filter(function(item){return item.kind===kind;});}
            function itemSvg(item){
                var key=item.item_key||item.key||'';
                var kind=item.kind||'loot';
                var tier=Number(item.tier)||1;
                var colors=['#70d9d0','#8cb8ff','#c39bff','#f2c979','#ff9e83','#c4e77e'];
                var accent=colors[(tier-1)%colors.length];
                var art='';
                if(kind==='backpack'){
                    art='<path d="M17 20v-4a7 7 0 0 1 14 0v4" fill="none" stroke="'+accent+'" stroke-width="3"/><path d="M13 20h22l3 25H10z" fill="#30495e" stroke="'+accent+'" stroke-width="2"/><path d="M16 25h16v11H16z" fill="#182b3c" stroke="#bfd6e7" stroke-width="1.5"/><path d="M15 41h18" stroke="'+accent+'" stroke-width="2"/>';
                }else if(kind==='weapon'){
                    art='<path d="M9 23h22l7 4-7 4H9z" fill="#a5bfd0" stroke="'+accent+'" stroke-width="2"/><path d="M19 31h9l-2 10h-8z" fill="#50677c" stroke="#c8d8e4" stroke-width="1.5"/><path d="M31 21h7v4h-7zM11 20h9v2h-9z" fill="'+accent+'"/><circle cx="15" cy="28" r="2" fill="#203548"/>';
                }else if(kind==='armor'){
                    var armorShapes={
                        1:'<path d="M18 19h14l6 7-5 15H15l-5-15z" fill="#3d6270" stroke="'+accent+'" stroke-width="2"/><path d="M18 22 25 28l7-6m-7 6v11" fill="none" stroke="#d8e8ec" stroke-width="2"/>',
                        2:'<path d="M17 18h16l5 8-5 16H12l-5-16z" fill="#3b596c" stroke="'+accent+'" stroke-width="2"/><path d="m18 22 7 3 7-3-2 8-5 3-5-3zm-5 5-4 1m28-1 4-1" fill="#6b8e96" stroke="#d1e6e6" stroke-width="1.5"/>',
                        3:'<path d="M17 17h16l7 8-5 17H15L10 25z" fill="#344f64" stroke="'+accent+'" stroke-width="2"/><path d="M18 21h14l3 5-3 12H17l-3-12z" fill="#253e50" stroke="#c4d7dc" stroke-width="1.5"/><path d="M20 28h10m-8 5h6" stroke="'+accent+'" stroke-width="2"/>',
                        4:'<path d="M16 16h18l7 8-5 18H14L9 24z" fill="#49677b" stroke="'+accent+'" stroke-width="2"/><path d="M18 19v19m14-19v19M12 27h26M17 22h18" stroke="#d8e8ec" stroke-width="2"/><path d="m9 23-5 7 6 4m31-11 5 7-6 4" fill="#526b7e" stroke="'+accent+'" stroke-width="2"/>',
                        5:'<path d="M17 16h16l7 8-5 18H15L10 24z" fill="#294d62" stroke="'+accent+'" stroke-width="2"/><path d="M25 19 35 27 31 39H19l-4-12z" fill="#4f7282" stroke="#ccebed" stroke-width="1.5"/><path d="M25 22v14m-8-8h16" stroke="'+accent+'" stroke-width="2"/><circle cx="25" cy="29" r="3" fill="#efffe7"/>',
                        6:'<path d="m16 16 9-5 9 5 9 9-5 19H12L8 25z" fill="#455b74" stroke="'+accent+'" stroke-width="2"/><path d="m17 21 8-4 8 4 4 7-4 11H17l-4-11z" fill="#253c52" stroke="#d7e5ee" stroke-width="1.5"/><path d="m16 24-7 5 5 4m25-9 7 5-5 4m-16-9 5 5 5-5" fill="none" stroke="'+accent+'" stroke-width="2"/>'
                    };
                    art=armorShapes[tier]+'<path d="M17 18l-7 5-4 9 7 3 4-8m14-9 7 5 4 9-7 3-4-8" fill="#30485a" stroke="'+accent+'" stroke-width="2"/>';
                }else if(key==='medkit'){
                    art='<path d="M12 19h26v25H12z" fill="#31565b" stroke="#83e4cf" stroke-width="2"/><path d="M19 15h12v5H19z" fill="#203d48" stroke="#b4f4e5" stroke-width="1.5"/><path d="M22 24h6v5h5v6h-5v5h-6v-5h-5v-6h5z" fill="#e4fff4"/>';
                }else if(key==='star_crystal'){
                    art='<path d="M25 7 39 23 28 44 11 34 12 17z" fill="'+accent+'" stroke="#e1f4ff" stroke-width="2"/><path d="m25 7 3 37M12 17l27 6M11 34l28-11" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.5"/>';
                }else if(key==='circuit_board'){
                    art='<rect x="12" y="12" width="27" height="30" rx="4" fill="#295a51" stroke="'+accent+'" stroke-width="2"/><path d="M18 18h14v10H18zm0 15h6m5 0h4M8 18h4m-4 7h4m-4 7h4m27-14h4m-4 7h4m-4 7h4M18 8v4m8-4v4m8-4v4M18 42v4m8-4v4m8-4v4" fill="none" stroke="#c9fff0" stroke-width="1.5"/>';
                }else if(key==='fiber_bundle'){
                    art='<path d="M13 17h24v24H13z" fill="#384966" stroke="'+accent+'" stroke-width="2"/><circle cx="25" cy="29" r="8" fill="none" stroke="#e5d8ff" stroke-width="3"/><circle cx="25" cy="29" r="3" fill="#a68bce"/><path d="M14 20h5m17 18h-5M18 14v5m14 19v5" stroke="#d4c6ee" stroke-width="2"/>';
                }else if(key==='nano_mesh'){
                    art='<path d="M12 17h26v25H12z" fill="#304957" stroke="'+accent+'" stroke-width="2"/><path d="m12 21 26 17M12 30l18 12m-8-25 16 11M38 21 12 39m17-22L12 33m26-3L19 42" stroke="#bce9d5" stroke-width="1.5"/><circle cx="25" cy="29" r="4" fill="#72cdb0"/>';
                }else if(key==='alloy_plate'){
                    art='<path d="m12 18 9-7 17 5 1 17-13 10-15-8z" fill="#536b7b" stroke="'+accent+'" stroke-width="2"/><path d="m12 18 14 7 12-9M26 25v18m0-18 13 8" fill="none" stroke="#d7e7f1" stroke-width="1.5"/>';
                }else if(key==='reactor_shard'){
                    art='<path d="m24 7 5 12 12 1-9 9 3 14-11-7-11 7 3-14-9-9 12-1z" fill="#e7836f" stroke="#ffd1ae" stroke-width="2"/><path d="m24 7 1 29m-16-7 27-11m-5 21 3-11-20-11" fill="none" stroke="#fff0ce" stroke-width="1.5"/>';
                }else if(key==='med_gel'){
                    art='<path d="M20 10h11v7l4 5v19H16V22l4-5z" fill="#315c5c" stroke="'+accent+'" stroke-width="2"/><path d="M18 29h15v9H18z" fill="#69cfae" fill-opacity=".8"/><path d="M20 14h11m-9 3h7" stroke="#d4fff1" stroke-width="2"/><circle cx="25" cy="33" r="3" fill="#e4fff4"/>';
                }else if(key==='bio_sample'){
                    art='<path d="M20 10h11v7l4 5v19H16V22l4-5z" fill="#315c5c" stroke="'+accent+'" stroke-width="2"/><path d="M18 29h15v9H18z" fill="#69cfae" fill-opacity=".65"/><circle cx="22" cy="32" r="3" fill="#f1d27d"/><circle cx="29" cy="36" r="2" fill="#e3b5f3"/><circle cx="28" cy="31" r="1.5" fill="#e8fff2"/>';
                }else if(key==='quantum_cell'){
                    art='<rect x="18" y="11" width="15" height="32" rx="6" fill="#344b68" stroke="'+accent+'" stroke-width="2"/><path d="M21 17h9v7h-9zm0 14h9v7h-9z" fill="'+accent+'"/><path d="M14 21h4m15 0h4M14 33h4m15 0h4" stroke="#d9edff" stroke-width="2"/>';
                }else if(key==='plasma_coil'){
                    art='<rect x="13" y="17" width="25" height="25" rx="4" fill="#344b68" stroke="'+accent+'" stroke-width="2"/><path d="M17 28c0-7 5-7 5 0s5 7 5 0 5-7 5 0" fill="none" stroke="#ffd293" stroke-width="3"/><path d="M9 22h4m25 15h4M18 12v5m15 25v5" stroke="#d9edff" stroke-width="2"/>';
                }else if(key==='magnetic_core'){
                    art='<path d="M14 15v14a11 11 0 0 0 22 0V15h-8v14a3 3 0 0 1-6 0V15z" fill="#435d70" stroke="'+accent+'" stroke-width="2"/><path d="M14 16h8m6 0h8m-22 5h8m6 0h8" stroke="#f1d286" stroke-width="2"/><circle cx="25" cy="42" r="3" fill="#a5e8e2"/>';
                }else if(key==='optic_lens'){
                    art='<circle cx="25" cy="27" r="15" fill="#304d68" stroke="'+accent+'" stroke-width="2"/><circle cx="25" cy="27" r="9" fill="#72bbd0" fill-opacity=".75" stroke="#ddf8ff" stroke-width="2"/><circle cx="22" cy="24" r="3" fill="#fff" fill-opacity=".8"/><path d="m33 38 7 7" stroke="#c8d9e3" stroke-width="3"/>';
                }else if(key==='signal_prism'){
                    art='<path d="m25 8 19 34H6z" fill="#405b72" stroke="'+accent+'" stroke-width="2"/><path d="m25 8-1 34M6 42l18-13 20 13m-19-5 13 5" fill="none" stroke="#d9f4ff" stroke-width="2"/><path d="m25 8 9 17-10 4-9-7z" fill="#d1a9ff" fill-opacity=".65"/>';
                }else if(key==='polymer_resin'){
                    art='<path d="M19 13h13v6l5 5v18H14V24l5-5z" fill="#3e5a63" stroke="'+accent+'" stroke-width="2"/><path d="M19 16h13m-14 16h18v6H18z" stroke="#e1f4ef" stroke-width="2"/><path d="M21 11h9" stroke="#d3e6e9" stroke-width="3"/>';
                }else if(key==='coolant_canister'){
                    art='<path d="M18 11h15v5l4 5v22H14V21l4-5z" fill="#35636b" stroke="'+accent+'" stroke-width="2"/><path d="M18 14h15m-14 17h16v8H19z" fill="#78d4d5" stroke="#d7ffff" stroke-width="1.5"/><path d="M21 9h9m-5 11v7m-4-3h8" stroke="#efffff" stroke-width="2"/>';
                }else if(key==='antique_relic'){
                    art='<circle cx="25" cy="27" r="16" fill="#73573a" stroke="'+accent+'" stroke-width="2"/><circle cx="25" cy="27" r="11" fill="none" stroke="#f5dda1" stroke-width="2"/><path d="m25 17 3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#f3d68b"/>';
                }else if(key==='ancient_coin'){
                    art='<circle cx="25" cy="27" r="16" fill="#80623c" stroke="'+accent+'" stroke-width="2"/><circle cx="25" cy="27" r="12" fill="none" stroke="#f5dda1" stroke-width="2"/><path d="M19 22h12m-12 5h12m-10 5h8m-4-13v16" stroke="#f3d68b" stroke-width="2"/>';
                }else if(key==='quantum_clock'){
                    art='<circle cx="25" cy="27" r="16" fill="#39495c" stroke="'+accent+'" stroke-width="2"/><circle cx="25" cy="27" r="11" fill="#182b3a" stroke="#d7e4ec" stroke-width="1.5"/><path d="M25 19v9l7 4M21 8h8m-4 0v3" fill="none" stroke="#f6dfa1" stroke-width="2"/>';
                }else if(key==='relic_compass'){
                    art='<circle cx="25" cy="27" r="17" fill="#354a5d" stroke="'+accent+'" stroke-width="2"/><circle cx="25" cy="27" r="12" fill="none" stroke="#dce8ef" stroke-width="1.5"/><path d="m27 18-3 8-7 10 9-5 4-12z" fill="#f1cf78" stroke="#fff1bd" stroke-width="1.5"/>';
                }else if(key==='starlight_crown'){
                    art='<path d="m10 19 9 8 6-15 7 15 9-8-4 22H14z" fill="#b88a45" stroke="'+accent+'" stroke-width="2"/><circle cx="19" cy="32" r="3" fill="#9de7e1"/><circle cx="32" cy="32" r="3" fill="#d8b7ff"/><path d="M15 37h21" stroke="#ffe6a2" stroke-width="2"/>';
                }else if(key==='alien_ceramic'){
                    art='<path d="M18 13h14l-2 7 7 9-4 14H17l-4-14 7-9z" fill="#55736b" stroke="'+accent+'" stroke-width="2"/><path d="M19 24h12m-13 7h14m-11-9v13m7-13v13" stroke="#d8e6ad" stroke-width="1.5"/>';
                }else if(key==='encrypted_key'){
                    art='<circle cx="17" cy="23" r="8" fill="none" stroke="'+accent+'" stroke-width="4"/><path d="M24 28 39 42m-7-7 5-5m-1 13 5-5" stroke="#d3e0ea" stroke-width="4" stroke-linecap="round"/><circle cx="17" cy="23" r="2" fill="#f6d27b"/>';
                }else if(key==='data_fragment'||key==='data_core'){
                    art='<path d="M13 12h22l5 6v25H13z" fill="#294f61" stroke="'+accent+'" stroke-width="2"/><path d="M35 12v8h6M18 26h17m-17 6h17m-17 6h10" stroke="#c9f3ed" stroke-width="2"/><circle cx="23" cy="19" r="2" fill="#f4d07b"/>';
                }else if(key==='void_artifact'){
                    art='<path d="m25 7 4 10 11 6-8 8-3 14-8-8-12-4 7-9z" fill="#574480" stroke="'+accent+'" stroke-width="2"/><path d="m25 7 4 17 3 21m-22-12 23-7 7-3" fill="none" stroke="#e8d6ff" stroke-width="1.5"/><circle cx="26" cy="26" r="4" fill="#c1a5ff"/>';
                }else if(kind==='loot'){
                    art='<path d="m25 8 15 12-5 20H15l-5-20z" fill="#584e76" stroke="'+accent+'" stroke-width="2"/><path d="m25 8 2 32m-17-20 30 0m-25 13 25-13" fill="none" stroke="#f0e6ff" stroke-width="1.5"/>';
                }else if(kind==='crystal'){
                    art='<path d="m25 8 14 14-6 20H17l-6-20z" fill="'+accent+'" stroke="#e7f4ff" stroke-width="2"/><path d="m25 8 1 34m-15-20 28 0" stroke="#fff" stroke-opacity=".55" stroke-width="1.5"/>';
                }else{
                    art='<circle cx="25" cy="27" r="17" fill="#354b5c" stroke="'+accent+'" stroke-width="2"/><path d="M17 27h16m-8-8v16" stroke="#d7f7ef" stroke-width="3"/>';
                }
                return '<span class="salvage-item-art"><svg viewBox="0 0 50 54" role="img" aria-label="'+esc(item.name||key)+'"><title>'+esc(item.name||key)+'</title>'+art+'</svg></span>';
            }
            function robotSvg(type){
                var palette={patrol:'#72cbd0',scout:'#a6dc82',sentry:'#d7a26d',support:'#82b8e6',hunter:'#e39170',brute:'#d9787e',wraith:'#ad9cec',elite:'#f0c979'};
                var glow=palette[type]||'#9bbbd0';
                var extra=type==='scout'||type==='wraith'
                    ?'<path d="m8 18-5-6m39 6 5-6M9 28H3m43 0h-6" stroke="'+glow+'" stroke-width="2"/><circle cx="7" cy="13" r="3" fill="'+glow+'"/><circle cx="45" cy="13" r="3" fill="'+glow+'"/>'
                    :type==='brute'||type==='elite'
                        ?'<path d="m8 18-5-7 10 2m29 5 5-7-10 2M10 34l-5 9h10m27-9 5 9H37" fill="#4f5360" stroke="'+glow+'" stroke-width="2"/>'
                        :'<path d="M14 40 9 47m25-7 5 7" stroke="'+glow+'" stroke-width="3"/>';
                return '<svg x="11" y="9" width="50" height="50" viewBox="0 0 50 54" aria-hidden="true">'+extra+'<path d="M15 20 18 9h14l3 11 5 8-4 15H14l-4-15z" fill="#33495b" stroke="'+glow+'" stroke-width="2"/><path d="M18 23h14l3 8H15z" fill="#172b3b" stroke="#c1d6df" stroke-width="1.5"/><circle cx="21" cy="27" r="2.2" fill="'+glow+'"/><circle cx="30" cy="27" r="2.2" fill="'+glow+'"/><path d="M19 37h12m-6-28V4" stroke="'+glow+'" stroke-width="2"/><circle cx="25" cy="4" r="2.5" fill="'+glow+'"/></svg>';
            }
            function mapFeatureSvg(object,x,y){
                if(!object)return '';
                if(object.kind==='wall'){
                    return '<g><path class="map-wall-side" d="M'+(x+7)+' '+(y+10)+'h49v47H'+(x+7)+'z"/><path class="map-wall" d="M'+(x+4)+' '+(y+5)+'h49v43H'+(x+4)+'z"/><path class="map-wall-stripe" d="M'+(x+9)+' '+(y+12)+'h38m-38 28h38"/><path d="M'+(x+15)+' '+(y+17)+'v28m24-28v28" stroke="#263847" stroke-width="2"/></g>';
                }
                if(object.kind==='enemy'){
                    return '<g opacity="'+(object.defeated?'.38':'1')+'">'+robotSvg(object.enemyType)+'</g>';
                }
                if(object.kind==='extract'){
                    return '<g><ellipse cx="'+(x+36)+'" cy="'+(y+39)+'" rx="24" ry="10" fill="#1c5750" stroke="#7ce2ba" stroke-width="2"/><ellipse cx="'+(x+36)+'" cy="'+(y+39)+'" rx="16" ry="5" fill="#76d7b3" fill-opacity=".35"/><path d="M'+(x+36)+' '+(y+35)+'V'+(y+13)+'m-8 8 8-8 8 8" fill="none" stroke="#c7ffe4" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></g>';
                }
                var boxColor=object.kind==='safe'?'#c9a66a':object.kind==='server'?'#5dc4d1':object.kind==='medical'?'#73d4b4':'#a8b6c7';
                if(object.kind==='medical'){
                    return '<g><rect x="'+(x+16)+'" y="'+(y+15)+'" width="40" height="38" rx="5" fill="#285552" stroke="'+boxColor+'" stroke-width="2"/><path d="M'+(x+32)+' '+(y+23)+'h8v7h7v8h-7v7h-8v-7h-7v-8h7z" fill="#d9fff1"/><path d="M'+(x+22)+' '+(y+50)+'h28" stroke="#b0eed5" stroke-width="2"/></g>';
                }
                if(object.kind==='server'){
                    return '<g><rect x="'+(x+17)+'" y="'+(y+10)+'" width="38" height="47" rx="4" fill="#304f63" stroke="'+boxColor+'" stroke-width="2"/><path d="M'+(x+22)+' '+(y+18)+'h28v9h-28zm0 14h28v9h-28zm0 14h19" fill="#172b3a" stroke="#a6e9e8" stroke-width="1.5"/><circle cx="'+(x+46)+'" cy="'+(y+22)+'" r="2" fill="#78e7c4"/><circle cx="'+(x+46)+'" cy="'+(y+36)+'" r="2" fill="#eecb78"/></g>';
                }
                var safe=object.kind==='safe';
                return '<g><path d="M'+(x+12)+' '+(y+24)+'l24-13 24 13-24 13z" fill="'+(safe?'#806c4d':'#586c7b')+'" stroke="'+boxColor+'" stroke-width="2"/><path d="M'+(x+12)+' '+(y+24)+'v21l24 13V37z" fill="'+(safe?'#5a503f':'#405361')+'" stroke="'+boxColor+'" stroke-width="2"/><path d="M'+(x+60)+' '+(y+24)+'v21L'+(x+36)+' '+(y+58)+'V37z" fill="'+(safe?'#746047':'#4b6170')+'" stroke="'+boxColor+'" stroke-width="2"/>'+(safe?'<circle cx="'+(x+36)+'" cy="'+(y+34)+'" r="5" fill="#f2d88b" stroke="#fff2bd" stroke-width="2"/>':'<path d="M'+(x+26)+' '+(y+27)+'h20m-10-5v11" stroke="#dce9ed" stroke-width="2"/>')+'</g>';
            }
            function equipmentCard(item,label){
                var detail=item.kind==='armor'?'耐久 '+number(item.durability)+' / '+number(item.max_durability):item.kind==='weapon'?'充能 '+number(item.charges):'负重上限 '+number(12+item.tier*6);
                return '<div class="salvage-kit-card">'+itemSvg(item)+'<div><strong>'+esc(label||item.name)+'</strong><small>'+esc(detail)+' · '+item.tier+' 级</small></div></div>';
            }
            function selectMarkup(kind,label){
                var rows=inventoryKind(kind);
                return '<label>'+label+'<select data-loadout="'+kind+'">'+rows.map(function(item){
                    var detail=kind==='armor'?'耐久 '+number(item.durability)+'/'+number(item.max_durability):kind==='weapon'?'充能 '+number(item.charges):'负重上限 '+number(12+item.tier*6);
                    return '<option value="'+item.id+'">'+esc(item.name)+' · '+detail+' · 价值 '+number(item.value)+'</option>';
                }).join('')+'</select></label>';
            }
            function itemActions(item){
                var actions='';
                if(item.kind==='loot'||item.kind==='material'){
                    actions+='<button class="gold" data-action="sell" data-id="'+item.id+'" data-quantity="'+item.quantity+'">售出 ×'+item.quantity+'（+'+number(item.value*item.quantity)+'）</button>';
                }
                if(item.kind==='weapon'){
                    actions+='<button class="secondary" data-action="charge" data-id="'+item.id+'">星晶充能</button>';
                }
                if(item.kind==='armor'&&item.durability<item.max_durability){
                    actions+='<button class="secondary" data-action="repair" data-id="'+item.id+'">维修护甲</button>';
                }
                return actions;
            }
            function renderInventory(){
                return state.items.length?'<div class="salvage-list">'+state.items.map(function(item){
                    var condition=item.kind==='armor'?'耐久 '+number(item.durability)+'/'+number(item.max_durability)
                        :item.kind==='weapon'?'充能 '+number(item.charges)
                        :item.kind==='backpack'?'负重上限 '+number(12+item.tier*6)
                        :'数量 '+number(item.quantity)+' · 单件估值 '+number(item.value)+' 星币';
                    return '<div class="salvage-item"><div class="salvage-item-main">'+itemSvg(item)+'<div><strong>'+esc(item.name)+(item.tier?' · '+item.tier+' 级':'')+'</strong><small>'+esc(condition)+' · '+esc(item.description)+'</small></div></div><div class="salvage-item-actions">'+itemActions(item)+'</div></div>';
                }).join('')+'</div>':'<div class="salvage-empty">仓库暂时空了；购买装备或继续探索补充物资。</div>';
            }
            function renderRun(run){
                var containerKinds=['server','safe','medical','supply'];
                var nearby=(run.objects||[]).filter(function(object){return object.kind==='enemy'&&!object.defeated&&Math.abs(object.x-run.x)+Math.abs(object.y-run.y)<=1;});
                var current=run.current_object;
                var width=Number(run.map_width)||6;
                var height=Number(run.map_height)||6;
                var cells=(run.map_tiles||[]).map(function(tile){
                    var x=tile.x,y=tile.y;
                    var object=run.objects.find(function(value){return value.x===x&&value.y===y;});
                    var here=x===run.x&&y===run.y;
                    var wall=Boolean(tile.wall||object&&object.kind==='wall');
                    var blocked=object&&object.kind==='enemy'&&!object.defeated;
                    var disabled=here||wall||Math.abs(x-run.x)+Math.abs(y-run.y)!==1||blocked;
                    var px=x*72,py=y*72;
                    var label=object?object.name:wall?'隔离墙':'开放舱室';
                    return '<g class="salvage-map-node" data-action="move" data-x="'+x+'" data-y="'+y+'" role="button" aria-label="'+esc('第 '+(x+1)+' 列第 '+(y+1)+' 行 · '+label)+'" aria-disabled="'+(disabled?'true':'false')+'" tabindex="'+(disabled?'-1':'0')+'"><rect class="map-floor '+((x+y)%2?'alt':'')+'" x="'+(px+2)+'" y="'+(py+2)+'" width="68" height="68" rx="8"/>'+mapFeatureSvg(object,px,py)+(here?'<circle class="map-current-ring" cx="'+(px+36)+'" cy="'+(py+35)+'" r="27"/><g transform="translate('+(px+16)+' '+(py+10)+')"><circle cx="20" cy="13" r="8" fill="#f1d085" stroke="#fff1be" stroke-width="2"/><path d="M7 41q1-17 13-17t13 17z" fill="#e6c576" stroke="#fff1be" stroke-width="2"/><path d="M14 12h12m-6-6v12" stroke="#37475b" stroke-width="2"/></g>':'')+'</g>';
                }).join('');
                var map='<div class="salvage-map-frame"><svg class="salvage-map-svg" viewBox="0 0 '+(width*72)+' '+(height*72)+'" role="group" aria-label="空间站舱室地图">'+cells+'</svg></div>';
                var controls='';
                if(current&&containerKinds.indexOf(current.kind)>=0&&!current.searched){
                    controls+='<button data-action="search">搜索'+esc(current.name)+'</button>';
                }else if(current&&containerKinds.indexOf(current.kind)>=0){
                    controls+='<span class="salvage-pill">已搜索</span>';
                }
                if(current&&current.kind==='extract'){
                    controls+='<button class="gold" data-action="extract">安全撤离并带出全部物资</button>';
                }
                controls+=nearby.map(function(enemy){return '<button class="danger" data-action="attack" data-id="'+esc(enemy.id)+'">攻击 '+esc(enemy.name)+'（'+number(enemy.health)+'/'+number(enemy.maxHealth)+' HP）</button>';}).join('');
                var cargo=run.cargo.length?run.cargo.map(function(item){return '<div class="salvage-run-item"><span class="salvage-item-main">'+itemSvg(item)+'<span>'+esc(item.name)+' ×'+number(item.quantity)+'</span></span><span>'+number(item.weight*item.quantity)+' 负重</span></div>';}).join(''):'<div class="salvage-empty">尚未搜到物资</div>';
                return '<section class="salvage-panel"><div class="salvage-heading"><div><h2>'+esc(run.zone==='chaos'?'混乱区':'安全区')+' · 对局进行中</h2><p>抵达舱站外沿的撤离平台带出装备、药品与搜刮物资。被击败或生命值归零会失去全部入局物品。</p></div><span class="salvage-pill">回合 '+number(run.turn)+'</span></div>'+
                    '<div class="salvage-stats"><div class="salvage-stat"><span>生命值</span><strong>'+number(run.health)+' / '+number(run.max_health)+'</strong></div><div class="salvage-stat"><span>背包负重</span><strong>'+number(run.cargo_weight)+' / '+number(run.capacity)+'</strong></div><div class="salvage-stat"><span>武器充能</span><strong>'+number(run.weapon.charges)+'</strong></div><div class="salvage-stat"><span>护甲耐久</span><strong>'+number(run.armor.durability)+' / '+number(run.armor.maxDurability)+'</strong></div></div>'+
                    '<div class="salvage-bar"><i style="width:'+Math.max(0,Math.min(100,run.health/run.max_health*100))+'%"></i></div>'+
                    map+'<div class="salvage-legend"><span>舱段隔离墙</span><span>服务器机柜</span><span>保险箱 / 补给</span><span>多型巡逻人机</span><span>边缘撤离平台</span></div>'+
                    (current?'<div class="salvage-object"><strong>当前位置：'+esc(current.name)+'</strong><small>'+(current.kind==='extract'?'到达撤离平台后可以结算本局战利品。':current.kind==='enemy'?'该区域有守卫；攻击附近目标以清理通路。':current.kind==='wall'?'隔离墙不可通行。':'搜索容器有机会获得不同类别的材料与收藏品。')+'</small></div>':'')+
                    '<div class="salvage-controls">'+(controls||'<span class="salvage-pill">移动探索，靠近敌人后攻击</span>')+'<button class="secondary" data-action="heal">使用急救包（恢复 45）</button></div>'+
                    '<div class="salvage-object"><strong>本局携带物资</strong>'+cargo+'</div>'+
                    '<div class="salvage-object"><strong>当前穿戴装备</strong><div class="salvage-equipped">'+equipmentCard(run.backpack,'背包 · '+run.backpack.name)+equipmentCard(run.weapon,'武器 · '+run.weapon.name)+equipmentCard(run.armor,'护甲 · '+run.armor.name)+'</div><small>撤离后耐久与剩余充能会保留；阵亡则全部遗失。</small></div></section>';
            }
            function renderHideout(){
                var gear=inventoryKind('backpack').length&&inventoryKind('weapon').length&&inventoryKind('armor').length;
                var options=gear?'<div class="salvage-loadout">'+selectMarkup('backpack','背包')+selectMarkup('weapon','武器')+selectMarkup('armor','护甲')+'</div>':'<div class="salvage-warning">仓库需要各有一件背包、武器和护甲才能出发。可在下方商店购买；首次档案附有一套 1 级装备。</div>';
                var ownedGear=inventoryKind('backpack').concat(inventoryKind('weapon'),inventoryKind('armor'));
                var gearCards=ownedGear.length?'<div class="salvage-kit-grid">'+ownedGear.map(function(item){return equipmentCard(item);}).join('')+'</div>':'';
                var medkits=inventoryKind('medicine').reduce(function(total,item){return total+Number(item.quantity);},0);
                var zoneCards='<div class="salvage-grid"><div class="salvage-panel"><div class="salvage-heading"><div><h2>选择地图与出战装备</h2><p>每局生成不规则舱站、隔离墙、容器、人机与外沿撤离平台。</p></div></div>'+options+gearCards+
                    (gear?'<label class="salvage-inline-field" style="max-width:180px;margin-top:8px">携带急救包（仓库 '+number(medkits)+'）<input type="number" min="0" max="5" value="'+Math.min(2,medkits)+'" data-medkits></label>':'')+
                    '<div class="salvage-controls">'+
                    (gear?'<button data-action="start" data-zone="safe">进入安全区</button><button class="danger" data-action="start" data-zone="chaos">进入混乱区（装备价值需 ≥ '+number(state.zones.chaos.entry_value)+'）</button>':'')+
                    '</div><div class="salvage-warning">混乱区装备价值门槛按本次携带的背包、武器和护甲计算。护甲减伤、武器伤害和背包负重随等级提升。</div></div>'+
                    '<div class="salvage-panel"><div class="salvage-heading"><div><h2>装备商店</h2><p>星币独立于其他游戏经济；每级装备均可购买。</p></div></div>'+
                    '<div class="salvage-list">'+['backpack','weapon','armor'].map(function(kind){var names={backpack:'背包',weapon:'武器',armor:'护甲'};return '<div class="salvage-object"><strong>'+names[kind]+' · 1～6 级</strong><div class="salvage-controls">'+[1,2,3,4,5,6].map(function(tier){var key=kind+'_'+tier;var current=state.items.find(function(item){return item.item_key===key;});var def=state.catalog.find(function(item){return item.key===key;});var price=Math.ceil(({backpack:320,weapon:440,armor:390}[kind])*Math.pow(1.72,tier-1));var stat=kind==='backpack'?'负重 '+(12+tier*6):kind==='weapon'?'伤害 '+(10+tier*7):'减伤 '+(tier*3)+' · 耐久 '+(45+tier*9);return '<button class="secondary" data-action="purchase" data-item="'+key+'">'+itemSvg(def)+'<span>'+tier+'级 · '+esc(def.name)+'<br>'+stat+' · '+number(price)+' 星币'+(current?' ×'+number(current.quantity):'')+'</span></button>';}).join('')+'</div></div>';}).join('')+
                    '<div class="salvage-object"><strong>补给与充能材料</strong><div class="salvage-controls"><label class="salvage-inline-field">数量<input type="number" min="1" max="50" value="2" data-supply-quantity></label><button data-action="supplies" data-item="medkit">'+itemSvg(state.catalog.find(function(item){return item.key==='medkit';}))+'购买急救包（80 星币）</button><button class="secondary" data-action="supplies" data-item="star_crystal">'+itemSvg(state.catalog.find(function(item){return item.key==='star_crystal';}))+'购买星晶（45 星币）</button></div></div></div></div></div>';
                return zoneCards;
            }
            function renderCrafting(){
                var byCategory={};
                state.recipes.forEach(function(recipe){(byCategory[recipe.category]||(byCategory[recipe.category]=[])).push(recipe);});
                var names={crystal:'星晶制造商',backpack:'背包制造商',weapon:'武器制造商',armor:'护甲制造商',medicine:'药品制造商'};
                return '<section class="salvage-panel"><div class="salvage-heading"><div><h2>制造商</h2><p>各类别生产线可并行制造；同一生产线需先领取完成品再排产。启动时会提交配方材料。</p></div></div>'+
                    '<div class="salvage-manufacturers">'+Object.keys(names).map(function(category){var job=state.jobs.find(function(value){return value.category===category;});return '<div class="salvage-manufacturer"><h3>'+names[category]+'</h3>'+
                        (job?'<div class="salvage-job"><strong>'+esc(job.recipe?job.recipe.name:job.item_key)+'</strong><small>'+(job.ready?'制造完成，可以领取。':'完成时间：'+esc(new Date(job.finishes_at).toLocaleString('zh-CN')))+'</small>'+(job.ready?'<button data-action="claim-craft" data-id="'+job.id+'">领取成品</button>':'')+'</div>':
                            byCategory[category].map(function(recipe){var ingredients=Object.entries(recipe.requirements).map(function(entry){var found=state.items.find(function(item){return item.item_key===entry[0];});var definition=state.catalog.find(function(item){return item.key===entry[0];});return (found?found.name:definition?definition.name:entry[0])+' ×'+entry[1];}).join('、');var product=state.catalog.find(function(item){return item.key===recipe.key;});return '<div class="salvage-recipe"><span>'+itemSvg(product)+esc(recipe.name)+'<br>'+esc(ingredients)+' · '+number(recipe.minutes)+' 分钟</span><button data-action="craft" data-item="'+esc(recipe.key)+'">制造</button></div>';}).join(''))+'</div>';}).join('')+'</div></section>';
            }
            function draw(){
                document.getElementById('salvageWallet').innerHTML='<span>✦ '+number(state.player.star_coins)+' 星币</span><span>✧ '+number(state.player.star_crystals)+' 星晶</span><span>仓库装备估值 '+number(state.player.total_equipment_value)+'</span>';
                var main=state.run?renderRun(state.run):renderHideout();
                var stash='<section class="salvage-panel"><div class="salvage-heading"><div><h2>个人仓库</h2><p>安全区物品留在仓库中；只有出发时选择的装备和急救包会带入对局。</p></div><span class="salvage-pill">'+number(state.items.length)+' 格物品</span></div>'+renderInventory()+'</section>';
                var recent=state.history.length?'<div class="salvage-list">'+state.history.map(function(run){return '<div class="salvage-item"><strong>'+esc(run.zone==='chaos'?'混乱区':'安全区')+' · '+esc(run.status==='dead'?'阵亡':'已撤离')+'</strong><small>'+esc(new Date(run.ended_at||run.started_at).toLocaleString('zh-CN'))+'</small></div>';}).join('')+'</div>':'<div class="salvage-empty">尚无已结束的对局</div>';
                document.getElementById('salvageContent').innerHTML=main+stash+(state.run?'':renderCrafting())+'<section class="salvage-panel"><div class="salvage-heading"><div><h2>行动记录</h2><p>最近八局结果</p></div></div>'+recent+'</section>';
            }
            async function load(){
                var response=await fetch('/api/salvage/state',{headers:{Accept:'application/json'}});
                var data=await response.json();
                if(!response.ok)throw new Error(data.error||'空间站档案暂不可用。');
                state=data;draw();
            }
            function feedback(message,error){notice.textContent=message||'';notice.classList.toggle('error',!!error);}
            async function post(path,payload){
                feedback('正在提交空间站指令…',false);
                try{
                    var response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(payload||{})});
                    var data=await response.json();
                    if(!response.ok)throw new Error(data.error||'操作失败。');
                    state=data.state;draw();feedback(data.notice||'空间站档案已更新。',false);
                }catch(error){feedback(error.message||'请求失败，请稍后重试。',true);}
            }
            root.addEventListener('click',function(event){
                var button=event.target.closest('[data-action]');
                if(!button||!root.contains(button))return;
                if(button.getAttribute('aria-disabled')==='true')return;
                var action=button.dataset.action;
                if(action==='start'){
                    var payload={zone:button.dataset.zone,medkits:Number(root.querySelector('[data-medkits]')?.value||0)};
                    ['backpack','weapon','armor'].forEach(function(kind){var select=root.querySelector('[data-loadout="'+kind+'"]');payload[kind+'_id']=select?Number(select.value):0;});
                    post('/api/salvage/start',payload);return;
                }
                if(action==='move'){post('/api/salvage/move',{x:Number(button.dataset.x),y:Number(button.dataset.y)});return;}
                if(action==='attack'){post('/api/salvage/attack',{object_id:button.dataset.id});return;}
                if(action==='search'){post('/api/salvage/search',{});return;}
                if(action==='extract'){post('/api/salvage/extract',{});return;}
                if(action==='heal'){post('/api/salvage/heal',{});return;}
                if(action==='purchase'){post('/api/salvage/purchase',{item:button.dataset.item});return;}
                if(action==='supplies'){post('/api/salvage/supplies',{item:button.dataset.item,quantity:Number(root.querySelector('[data-supply-quantity]').value)});return;}
                if(action==='sell'){post('/api/salvage/sell',{item_id:Number(button.dataset.id),quantity:Number(button.dataset.quantity)});return;}
                if(action==='repair'){post('/api/salvage/repair',{item_id:Number(button.dataset.id)});return;}
                if(action==='charge'){
                    var amount=Number(prompt('当前有 '+number(state.player.star_crystals)+' 个星晶。每个星晶可提供 3 次攻击充能，请输入充能数量：',String(Math.min(3,state.player.star_crystals))));
                    if(Number.isSafeInteger(amount)&&amount>0)post('/api/salvage/charge',{item_id:Number(button.dataset.id),crystals:amount});
                    return;
                }
                if(action==='craft'){post('/api/salvage/craft',{item:button.dataset.item});return;}
                if(action==='claim-craft'){post('/api/salvage/craft/claim',{job_id:Number(button.dataset.id)});}
            });
            root.addEventListener('keydown',function(event){
                if((event.key==='Enter'||event.key===' ')&&event.target.matches('.salvage-map-node[aria-disabled="false"]')){
                    event.preventDefault();event.target.click();
                }
            });
            load().catch(function(error){feedback(error.message||'空间站档案暂不可用。',true);});
            window.setInterval(function(){if(!state||!state.run)load().catch(function(error){feedback(error.message||'档案刷新失败。',true);});},15000);
        }());
        </script>`;
}

export async function renderSalvage(env: Env, request: Request): Promise<string> {
    const user = await getSessionUser(env, request);
    if (!user) {
        const content = `<div class="page-header"><h1><i class="fas fa-crosshairs"></i> 空间站搜刮行动</h1><p>搜索失联空间站、收集物资并安全撤离。</p></div><div class="card"><a href="/login?redirect=%2Fsalvage">登录后开始行动</a></div>`;
        return getLayout(env, user, '空间站搜刮行动', content, SALVAGE_STYLES, request);
    }
    return getLayout(env, user, '空间站搜刮行动', salvageMarkup(), SALVAGE_STYLES, request);
}
