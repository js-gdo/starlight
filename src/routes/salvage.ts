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
    .salvage-map-frame{position:relative;overflow:hidden;padding:8px;border:1px solid #30465d;border-radius:13px;background:#101c2a;touch-action:none}
    .salvage-map-svg{display:block;width:100%;height:auto;max-height:70vh;min-height:390px;margin:auto}
    .map-floor{fill:#243846;stroke:none}
    .map-floor-panel{fill:#2a3e4d;fill-opacity:.55;stroke:#4a5a65;stroke-width:1}
    .map-corridor{fill:#1c2c38;stroke:#405462;stroke-width:2}
    .map-floor-mark{fill:none;stroke:#60727d;stroke-opacity:.18;stroke-width:1}
    .map-boundary{fill:none;stroke:#78909e;stroke-opacity:.45;stroke-width:5}
    .salvage-player{pointer-events:none;filter:drop-shadow(0 3px 6px #03070dcc)}
    .salvage-player-charge{fill:#8ef3db;stroke:#e0fff8;stroke-width:1}
    .salvage-entity{cursor:pointer}
    .salvage-player-marker{transition:none}
    .salvage-map-hint{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-top:7px;color:#acbdcc;font-size:10px}
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
    .salvage-tactical{border-color:#3a4e62;background:linear-gradient(145deg,#101b28,#182536 58%,#111c2a)}
    .salvage-stash-grid{display:grid;grid-template-columns:minmax(0,1fr) 230px;gap:12px}
    .salvage-stash-categories{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:9px}
    .salvage-stash-categories span{padding:5px 8px;border:1px solid #354a60;border-radius:5px;background:#101c2a;color:#aabbd0;font-size:9px}
    .salvage-slot-list{display:grid;gap:7px}
    .salvage-slot{width:100%;display:flex;align-items:center;gap:8px;text-align:left;background:linear-gradient(135deg,#25364a,#172536)!important;border-color:#52677c!important}
    .salvage-slot.selected{border-color:#e4c172!important;box-shadow:0 0 0 1px #e4c17266}
    .salvage-slot small{display:block;color:#b7c5d4;font-size:8px;font-weight:400}
    .salvage-selectable{cursor:pointer}
    .salvage-item.is-selected{border-color:#e4c172;box-shadow:0 0 0 1px #e4c17266}
    .salvage-inventory{max-height:620px;overflow:auto;padding-right:3px}
    .salvage-row-value{color:#e8c87e;font-size:9px}
    .salvage-tutorial{position:fixed;z-index:9999;inset:0;display:grid;place-items:center;padding:18px;background:#050b13d9}
    .salvage-tutorial-card{width:min(540px,100%);padding:22px;border:1px solid #536b80;border-radius:16px;background:linear-gradient(145deg,#1a2d40,#101a29);box-shadow:0 24px 80px #000a;color:#edf4ff}
    .salvage-tutorial-card h2{margin:0 0 8px}
    .salvage-tutorial-card li{margin:8px 0;color:#bdcada;font-size:12px;line-height:1.6}
    @media(max-width:850px){.salvage-grid{grid-template-columns:1fr}}
    @media(max-width:540px){.salvage-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.salvage-loadout,.salvage-manufacturers,.salvage-stash-grid{grid-template-columns:1fr}.salvage-kit-grid,.salvage-equipped{grid-template-columns:1fr}.salvage-hero{padding:22px 18px}}
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
            var selectedGear={backpack:0,weapon:0,armor:0};
            var selectedStashItem=0;
            var requestPending=false;
            var pressedKeys={};
            var moveTarget=null;
            var lastFrame=0;
            var lastSnapshot=0;
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
                    var branch=item.weaponBranch||'pulse';
                    art=branch==='rail'
                        ?'<path d="M7 22h27l7 4-7 4H7z" fill="#a5bfd0" stroke="'+accent+'" stroke-width="2"/><path d="M20 30h9l-2 11h-8z" fill="#50677c" stroke="#c8d8e4" stroke-width="1.5"/><path d="M31 19h10v3H31zM10 18h25v2H10z" fill="'+accent+'"/><path d="M13 25h21" stroke="#e9fbff" stroke-width="1.4"/>'
                        :branch==='scatter'
                            ?'<path d="M8 23h23l9 4-9 4H8z" fill="#a5bfd0" stroke="'+accent+'" stroke-width="2"/><path d="M18 31h10l-2 11h-9z" fill="#50677c" stroke="#c8d8e4" stroke-width="1.5"/><path d="M30 20h11v3H30zM12 20h9v2h-9z" fill="'+accent+'"/><circle cx="15" cy="27" r="2" fill="#203548"/>'
                            :'<path d="M9 23h22l7 4-7 4H9z" fill="#a5bfd0" stroke="'+accent+'" stroke-width="2"/><path d="M19 31h9l-2 10h-8z" fill="#50677c" stroke="#c8d8e4" stroke-width="1.5"/><path d="M31 21h7v4h-7zM11 20h9v2h-9z" fill="'+accent+'"/><circle cx="15" cy="28" r="2" fill="#203548"/>';
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
            function playerSvg(run,x,y){
                var packTier=Math.max(1,Number(run.backpack.tier)||1);
                var armorTier=Math.max(1,Number(run.armor.tier)||1);
                var weaponTier=Math.max(1,Number(run.weapon.tier)||1);
                var armorColor=['#6ca9ae','#79a7ce','#9c8dc8','#d0a561','#d47c68','#a7cc69'][(armorTier-1)%6];
                var packWidth=10+packTier*1.2;
                var branch=run.weapon.weaponBranch||'pulse';
                var weaponShape=branch==='rail'?'<path d="M34 28h17l4 2-4 2H34zM39 31h5l-1 5h-4z"/>'
                    :branch==='scatter'?'<path d="M34 28h13l6 2-6 2H34zM38 31h5l-1 5h-4z"/>'
                    :'<path d="M34 28h15l4 2-4 2H34zM39 31h5l-1 5h-4z"/>';
                var charges=Math.max(0,Number(run.weapon.charges)||0);
                return '<g id="salvagePlayer" class="salvage-player" transform="translate('+(x-26)+' '+(y-26)+')">'+
                    '<path d="M'+(19-packWidth/2)+' 25h'+packWidth+'v14h-'+packWidth+'z" fill="#273c50" stroke="'+armorColor+'" stroke-width="2"/>'+
                    '<path d="M20 22 22 16h8l2 6 4 4-3 15H19l-3-15z" fill="'+armorColor+'" stroke="#f0f5ff" stroke-width="1.5"/>'+
                    '<path d="M22 25h8l2 7H20z" fill="#17283a" stroke="#d8e8ec" stroke-width="1"/>'+
                    '<circle cx="26" cy="12" r="5.2" fill="#e7c893" stroke="#fff0c8" stroke-width="1.5"/>'+
                    '<path d="M23 12h6m-3-3v6" stroke="#293b4e" stroke-width="1.2"/>'+
                    '<g fill="#a9c4d4" stroke="'+armorColor+'" stroke-width="1.5">'+weaponShape+'</g>'+
                    '<path d="M21 38h10m-8 2-2 5m8-5 2 5" stroke="#d5dfeb" stroke-width="2" stroke-linecap="round"/>'+
                    '<circle class="salvage-player-charge" cx="39" cy="17" r="5"/><text x="39" y="19.5" text-anchor="middle" font-size="6" font-weight="900" fill="#143044">'+charges+'</text>'+
                    '<text x="26" y="51" text-anchor="middle" font-size="6" fill="#fff">'+armorTier+'级甲 · '+weaponTier+'级武器</text></g>';
            }
            function itemActions(item){
                var actions='';
                if(!state.run&&item.kind==='weapon'&&Number(item.charges)>0){
                    var unloadable=Math.floor(Number(item.charges)/3);
                    actions+='<button class="secondary" data-action="unload" data-id="'+item.id+'"'+(unloadable?'':' disabled')+'>卸载 '+unloadable+' 星晶（余 '+(Number(item.charges)%3)+' 次）</button>';
                }
                if(!state.run&&item.kind==='weapon'){
                    actions+='<button class="secondary" data-action="charge" data-id="'+item.id+'">星晶充能</button>';
                }
                if(!state.run&&item.kind==='armor'&&item.durability<item.max_durability){
                    actions+='<button class="secondary" data-action="repair" data-id="'+item.id+'">维修护甲</button>';
                }
                if(!state.run&&(item.kind!=='weapon'||Number(item.charges)===0)){
                    actions+='<button class="gold" data-action="sell" data-id="'+item.id+'" data-quantity="'+item.quantity+'">售出 ×'+item.quantity+'（+'+number(Number(item.sale_value)*Number(item.quantity))+'）</button>';
                }
                return actions;
            }
            function renderInventory(){
                return state.items.length?'<div class="salvage-list">'+state.items.map(function(item){
                    var condition=item.kind==='armor'?'耐久 '+number(item.durability)+'/'+number(item.max_durability)
                        :item.kind==='weapon'?'充能 '+number(item.charges)
                        :item.kind==='backpack'?'负重上限 '+number(12+item.tier*6)
                        :'数量 '+number(item.quantity)+' · 单件估值 '+number(item.value)+' 星币';
                    if(item.kind==='armor'&&Number(item.sale_value)<Number(item.value))condition+=' · 磨损折价 '+number(item.sale_value)+' 星币';
                    return '<div class="salvage-item '+(Number(selectedStashItem)===Number(item.id)?'is-selected':'')+'"><div class="salvage-item-main">'+itemSvg(item)+'<div><strong>'+esc(item.name)+(item.tier?' · '+item.tier+' 级':'')+'</strong><small>'+esc(condition)+' · '+esc(item.description)+'</small></div></div><div class="salvage-item-actions">'+itemActions(item)+'</div></div>';
                }).join('')+'</div>':'<div class="salvage-empty">仓库暂时空了；购买装备或继续探索补充物资。</div>';
            }
            function renderRun(run){
                var containerKinds=['server','safe','medical','supply'];
                var width=Number(run.map_width)||6;
                var height=Number(run.map_height)||6;
                var playerX=Number(run.world_x)||((run.x+.5)*72);
                var playerY=Number(run.world_y)||((run.y+.5)*72);
                var closeTo=function(object,radius){
                    var dx=object.x*72+36-playerX,dy=object.y*72+36-playerY;
                    return dx*dx+dy*dy<=radius*radius;
                };
                var nearby=(run.objects||[]).filter(function(object){return object.kind==='enemy'&&!object.defeated&&closeTo(object,112);});
                var current=(run.objects||[]).filter(function(object){return containerKinds.indexOf(object.kind)>=0||object.kind==='extract';})
                    .sort(function(a,b){var da=Math.pow(a.x*72+36-playerX,2)+Math.pow(a.y*72+36-playerY,2);var db=Math.pow(b.x*72+36-playerX,2)+Math.pow(b.y*72+36-playerY,2);return da-db;})
                    .find(function(object){return closeTo(object,62);})||null;
                run.nearby_enemies=nearby;
                run.current_object=current;
                var floorPath=(run.map_tiles||[]).filter(function(tile){return !tile.wall;}).map(function(tile){
                    return 'M'+(tile.x*72)+' '+(tile.y*72)+'h72v72h-72z';
                }).join('');
                var objects=(run.objects||[]).map(function(object){
                    return '<g class="salvage-entity" data-entity="'+esc(object.id)+'" transform="translate('+(object.x*72)+' '+(object.y*72)+')">'+mapFeatureSvg(object,0,0)+'</g>';
                }).join('');
                var panels='<rect class="map-corridor" x="44" y="224" width="488" height="56" rx="26"/>'+
                    '<rect class="map-floor-panel" x="76" y="76" width="174" height="132" rx="30"/>'+
                    '<rect class="map-floor-panel" x="326" y="292" width="170" height="134" rx="30"/>'+
                    '<path class="map-floor-mark" d="M65 132h120m-120 16h90m253 190h93m-93 16h63M288 52v92m16 0V52"/>';
                var map='<div class="salvage-map-frame"><svg id="salvageMap" class="salvage-map-svg" viewBox="0 0 '+(width*72)+' '+(height*72)+'" role="application" aria-label="空间站连续移动地图">'+
                    '<defs><clipPath id="stationFloor"><path d="'+floorPath+'"/></clipPath></defs>'+
                    '<rect width="'+(width*72)+'" height="'+(height*72)+'" fill="#111c28"/><path class="map-floor" d="'+floorPath+'"/>'+
                    '<g clip-path="url(#stationFloor)">'+panels+'</g>'+objects+playerSvg(run,playerX,playerY)+
                    '</svg><div class="salvage-map-hint"><span>WASD / 方向键持续移动 · 点击地面可行走</span><span>移动与搜刮在本地即时运行</span></div></div>';
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
                return '<section class="salvage-panel"><div class="salvage-heading"><div><h2>'+esc(run.zone==='chaos'?'混乱区':'安全区')+' · 对局进行中</h2><p>抵达舱站外沿的撤离平台带出装备、药品与搜刮物资。移动耗时 1 分钟，搜索容器耗时 2 分钟；每项操作都会提交至服务器。生命值归零会失去全部入局物品。</p></div><span class="salvage-pill">行动耗时 '+number(run.turn)+' 分钟</span></div>'+
                    '<div class="salvage-stats"><div class="salvage-stat"><span>生命值</span><strong>'+number(run.health)+' / '+number(run.max_health)+'</strong></div><div class="salvage-stat"><span>背包负重</span><strong>'+number(run.cargo_weight)+' / '+number(run.capacity)+'</strong></div><div class="salvage-stat"><span>武器充能</span><strong>'+number(run.weapon.charges)+'</strong></div><div class="salvage-stat"><span>护甲耐久</span><strong>'+number(run.armor.durability)+' / '+number(run.armor.maxDurability)+'</strong></div></div>'+
                    '<div class="salvage-bar"><i style="width:'+Math.max(0,Math.min(100,run.health/run.max_health*100))+'%"></i></div>'+
                    map+'<div class="salvage-legend"><span>舱段隔离墙</span><span>服务器机柜</span><span>保险箱 / 补给</span><span>多型巡逻人机</span><span>边缘撤离平台</span></div>'+
                    (current?'<div class="salvage-object"><strong>当前位置：'+esc(current.name)+'</strong><small>'+(current.kind==='extract'?'到达撤离平台后可以结算本局战利品。':current.kind==='enemy'?'该区域有守卫；攻击附近目标以清理通路。':current.kind==='wall'?'隔离墙不可通行。':current.searched?'该容器已经搜过。':'搜索耗时 2 分钟，会通过 API 保存战利品。')+'</small></div>':'')+
                    '<div class="salvage-controls"><span class="salvage-pill">WASD / 方向键移动 · 也可点击地图舱室</span></div>'+
                    '<div class="salvage-controls">'+(controls||'<span class="salvage-pill">移动探索，靠近敌人后攻击</span>')+'<button class="secondary" data-action="heal">使用急救包（恢复 45）</button></div>'+
                    '<div class="salvage-object"><strong>本局携带物资</strong>'+cargo+'</div>'+
                    '<div class="salvage-object"><strong>当前穿戴装备</strong><div class="salvage-equipped">'+equipmentCard(run.backpack,'背包 · '+run.backpack.name)+equipmentCard(run.weapon,'武器 · '+run.weapon.name)+equipmentCard(run.armor,'护甲 · '+run.armor.name)+'</div><small>撤离后耐久与剩余充能会保留；阵亡则全部遗失。</small></div></section>';
            }
            function renderRun(run){
                var width=Number(run.map_width)||8;
                var height=Number(run.map_height)||7;
                var playerX=Number(run.world_x)||((run.x+.5)*72);
                var playerY=Number(run.world_y)||((run.y+.5)*72);
                function closeTo(object,radius){
                    var dx=object.x*72+36-playerX,dy=object.y*72+36-playerY;
                    return dx*dx+dy*dy<=radius*radius;
                }
                var containers=['server','safe','medical','supply'];
                var nearby=(run.objects||[]).filter(function(object){
                    return object.kind==='enemy'&&!object.defeated&&closeTo(object,112);
                });
                var current=(run.objects||[]).filter(function(object){
                    return containers.indexOf(object.kind)>=0||object.kind==='extract';
                }).sort(function(a,b){
                    var da=Math.pow(a.x*72+36-playerX,2)+Math.pow(a.y*72+36-playerY,2);
                    var db=Math.pow(b.x*72+36-playerX,2)+Math.pow(b.y*72+36-playerY,2);
                    return da-db;
                }).find(function(object){return closeTo(object,62);})||null;
                run.nearby_enemies=nearby;
                run.current_object=current;
                var floorPath=(run.map_tiles||[]).filter(function(tile){return !tile.wall;}).map(function(tile){
                    return 'M'+(tile.x*72)+' '+(tile.y*72)+'h72v72h-72z';
                }).join('');
                var objects=(run.objects||[]).map(function(object){
                    return '<g class="salvage-entity" data-entity="'+esc(object.id)+'" transform="translate('+(object.x*72)+' '+(object.y*72)+')">'+mapFeatureSvg(object,0,0)+'</g>';
                }).join('');
                var panels='<rect class="map-corridor" x="44" y="224" width="488" height="56" rx="26"/>'+
                    '<rect class="map-floor-panel" x="76" y="76" width="174" height="132" rx="30"/>'+
                    '<rect class="map-floor-panel" x="326" y="292" width="170" height="134" rx="30"/>'+
                    '<path class="map-floor-mark" d="M65 132h120m-120 16h90m253 190h93m-93 16h63M288 52v92m16 0V52"/>';
                var map='<div class="salvage-map-frame"><svg id="salvageMap" class="salvage-map-svg" viewBox="0 0 '+(width*72)+' '+(height*72)+'" role="application" aria-label="空间站连续移动地图">'+
                    '<defs><clipPath id="stationFloor"><path d="'+floorPath+'"/></clipPath></defs>'+
                    '<rect width="'+(width*72)+'" height="'+(height*72)+'" fill="#111c28"/><path class="map-floor" d="'+floorPath+'"/>'+
                    '<g clip-path="url(#stationFloor)">'+panels+'</g>'+objects+playerSvg(run,playerX,playerY)+
                    '</svg><div class="salvage-map-hint"><span>WASD / 方向键持续移动 · 点击地面可行走</span><span>行动在客户端运行，结束时一次提交</span></div></div>';
                var controls='';
                if(current&&containers.indexOf(current.kind)>=0){
                    controls+=current.searched?'<span class="salvage-pill">已搜索</span>':'<button data-action="search">搜索'+esc(current.name)+'</button>';
                }
                if(current&&current.kind==='extract')controls+='<button class="gold" data-action="extract">撤离并提交本局</button>';
                controls+=nearby.map(function(enemy){
                    return '<button class="danger" data-action="attack" data-id="'+esc(enemy.id)+'">攻击 '+esc(enemy.name)+'（'+number(enemy.health)+'/'+number(enemy.maxHealth)+' HP）</button>';
                }).join('');
                if(run.terminalStatus)controls='<button data-action="retry-finish">重试提交本局记录</button>';
                var cargo=run.cargo.length?run.cargo.map(function(item){
                    return '<div class="salvage-run-item"><span class="salvage-item-main">'+itemSvg(item)+'<span>'+esc(item.name)+' ×'+number(item.quantity)+'</span></span><span>'+number(item.weight*item.quantity)+' 负重</span></div>';
                }).join(''):'<div class="salvage-empty">尚未搜到物资</div>';
                return '<section class="salvage-panel"><div class="salvage-heading"><div><h2>'+esc(run.zone==='chaos'?'混乱区':'安全区')+' · 实时行动</h2><p>连续行走和局内操作在客户端即时运行，不再逐步请求 API；撤离或阵亡时一次提交完整结算。</p></div><span class="salvage-pill">行动 '+number(run.turn)+' · 本地</span></div>'+
                    '<div class="salvage-stats"><div class="salvage-stat"><span>生命值</span><strong id="runHealth">'+number(run.health)+' / '+number(run.max_health)+'</strong></div><div class="salvage-stat"><span>背包负重</span><strong id="runWeight">'+number(run.cargo_weight)+' / '+number(run.capacity)+'</strong></div><div class="salvage-stat"><span>武器充能</span><strong id="runCharges">'+number(run.weapon.charges)+'</strong></div><div class="salvage-stat"><span>护甲耐久</span><strong id="runArmor">'+number(run.armor.durability)+' / '+number(run.armor.maxDurability)+'</strong></div></div>'+
                    '<div class="salvage-bar"><i id="runHealthBar" style="width:'+Math.max(0,Math.min(100,run.health/run.max_health*100))+'%"></i></div>'+
                    map+'<div class="salvage-legend"><span>隔离墙 / 障碍</span><span>服务器 / 保险箱 / 补给</span><span>巡逻人机</span><span>外沿撤离平台</span></div>'+
                    '<div class="salvage-object"><strong id="runPrompt">'+(current?'附近：'+esc(current.name):'探索空间站')+'</strong><small>WASD 或方向键移动 · E 交互 · 点击地图可行走</small></div>'+
                    '<div class="salvage-controls">'+(controls||'<span class="salvage-pill">靠近容器、人机或撤离点进行交互</span>')+'<button class="secondary" data-action="heal">使用急救包（恢复 45）</button></div>'+
                    '<div class="salvage-object"><strong>本局携带物资</strong>'+cargo+'</div>'+
                    '<div class="salvage-object"><strong>当前穿戴装备</strong><div class="salvage-equipped">'+equipmentCard(run.backpack,'背包 · '+run.backpack.name)+equipmentCard(run.weapon,'武器 · '+run.weapon.name)+equipmentCard(run.armor,'护甲 · '+run.armor.name)+'</div><small>撤离后带回；阵亡则全部遗失。</small></div></section>';
            }
            function initializeClientRun(){
                if(!state.run)return;
                var run=state.run;
                var storageKey='salvage-client-run-'+run.id;
                var saved=null;
                try{saved=JSON.parse(localStorage.getItem(storageKey)||'null');}catch(error){localStorage.removeItem(storageKey);}
                if(saved&&saved.id===run.id){
                    state.run=saved;
                }else{
                    run.objects=run.client_objects||run.objects;
                    run.world_x=(run.x+.5)*72;
                    run.world_y=(run.y+.5)*72;
                    run.turn=0;
                    run.started_client_at=Date.now();
                    run.kit={
                        backpack:{key:run.backpack.key,quantity:1,durability:run.backpack.durability,maxDurability:run.backpack.maxDurability,charges:run.backpack.charges||0},
                        weapon:{key:run.weapon.key,quantity:1,durability:run.weapon.durability||0,maxDurability:run.weapon.maxDurability||0,charges:run.weapon.charges||0},
                        armor:{key:run.armor.key,quantity:1,durability:run.armor.durability,maxDurability:run.armor.maxDurability,charges:run.armor.charges||0}
                    };
                    run.cargo=(run.cargo||[]).map(function(entry){return enrichCargo(entry);});
                    state.run=run;
                    saveClientRun();
                }
            }
            function saveClientRun(){
                if(!state||!state.run)return;
                try{localStorage.setItem('salvage-client-run-'+state.run.id,JSON.stringify(state.run));}
                catch(error){feedback('本地行动存档失败；请勿刷新或关闭页面，直到本局结算。',true);}
            }
            function enrichCargo(entry){
                var definition=state.catalog.find(function(value){return value.key===(entry.key||entry.item_key);})||{};
                return Object.assign({},definition,entry,{key:entry.key||entry.item_key,item_key:entry.key||entry.item_key});
            }
            function cargoWeight(run){
                return run.cargo.reduce(function(total,entry){return total+(Number(entry.weight)||0)*Number(entry.quantity||0);},0);
            }
            function walkable(run,x,y){
                var tileX=Math.floor(x/72),tileY=Math.floor(y/72);
                var tile=(run.map_tiles||[]).find(function(value){return value.x===tileX&&value.y===tileY;});
                if(!tile||tile.wall||x<8||y<8||x>=run.map_width*72-8||y>=run.map_height*72-8)return false;
                return !(run.objects||[]).some(function(object){
                    if(object.kind==='wall'){
                        return Math.abs((object.x+.5)*72-x)<24&&Math.abs((object.y+.5)*72-y)<24;
                    }
                    if(object.kind==='enemy'&&!object.defeated){
                        var dx=(object.x+.5)*72-x,dy=(object.y+.5)*72-y;
                        return dx*dx+dy*dy<18*18;
                    }
                    return false;
                });
            }
            function movePlayer(dx,dy){
                var run=state&&state.run;
                if(!run||run.terminalStatus)return;
                var nextX=run.world_x+dx,nextY=run.world_y+dy;
                if(walkable(run,nextX,run.world_y))run.world_x=nextX;
                if(walkable(run,run.world_x,nextY))run.world_y=nextY;
                run.x=Math.max(0,Math.min(run.map_width-1,Math.floor(run.world_x/72)));
                run.y=Math.max(0,Math.min(run.map_height-1,Math.floor(run.world_y/72)));
                var marker=document.getElementById('salvagePlayer');
                if(marker)marker.setAttribute('transform','translate('+(run.world_x-26)+' '+(run.world_y-26)+')');
            }
            function animationFrame(now){
                if(state&&state.run&&!state.run.terminalStatus){
                    var dt=lastFrame?Math.min(.05,(now-lastFrame)/1000):0;
                    lastFrame=now;
                    var dx=(pressedKeys.d?1:0)-(pressedKeys.a?1:0);
                    var dy=(pressedKeys.s?1:0)-(pressedKeys.w?1:0);
                    if(moveTarget&&!dx&&!dy){
                        dx=moveTarget.x-state.run.world_x;
                        dy=moveTarget.y-state.run.world_y;
                        var distance=Math.sqrt(dx*dx+dy*dy);
                        if(distance<4){moveTarget=null;dx=0;dy=0;}
                        else{dx/=distance;dy/=distance;}
                    }
                    if(dx||dy){
                        var magnitude=Math.sqrt(dx*dx+dy*dy)||1;
                        movePlayer(dx/magnitude*115*dt,dy/magnitude*115*dt);
                        if(now-lastSnapshot>1200){lastSnapshot=now;saveClientRun();}
                        updateRunHud();
                    }
                }else lastFrame=0;
                window.requestAnimationFrame(animationFrame);
            }
            function updateRunHud(){
                var run=state&&state.run;
                if(!run)return;
                var health=document.getElementById('runHealth');
                var weight=document.getElementById('runWeight');
                var charges=document.getElementById('runCharges');
                var armor=document.getElementById('runArmor');
                var bar=document.getElementById('runHealthBar');
                if(health)health.textContent=number(run.health)+' / '+number(run.max_health);
                run.cargo_weight=cargoWeight(run);
                if(weight)weight.textContent=number(run.cargo_weight)+' / '+number(run.capacity);
                if(charges)charges.textContent=number(run.weapon.charges);
                if(armor)armor.textContent=number(run.armor.durability)+' / '+number(run.armor.maxDurability);
                if(bar)bar.style.width=Math.max(0,Math.min(100,run.health/run.max_health*100))+'%';
            }
            function addCargo(run,entries){
                for(var i=0;i<entries.length;i++){
                    var entry=enrichCargo(entries[i]);
                    var canStack=['weapon','armor','backpack'].indexOf(entry.kind)<0;
                    var existing=canStack&&run.cargo.find(function(value){return value.key===entry.key;});
                    if(existing)existing.quantity+=entry.quantity;
                    else run.cargo.push(entry);
                }
                run.cargo_weight=cargoWeight(run);
            }
            function activeObject(kind,id){
                var run=state.run;
                var px=run.world_x,py=run.world_y;
                return run.objects.find(function(object){
                    if(kind==='enemy'&&(object.kind!=='enemy'||object.defeated))return false;
                    if(kind==='container'&&['server','safe','medical','supply'].indexOf(object.kind)<0)return false;
                    if(kind==='extract'&&object.kind!=='extract')return false;
                    if(id&&object.id!==id)return false;
                    if(kind==='container'&&object.searched)return false;
                    var dx=(object.x+.5)*72-px,dy=(object.y+.5)*72-py;
                    return dx*dx+dy*dy<=(kind==='enemy'?112:kind==='extract'?54:62)*(kind==='enemy'?112:kind==='extract'?54:62);
                });
            }
            function finishClientRun(status,retry){
                var run=state&&state.run;
                if(!run||(run.terminalStatus&&!retry)||requestPending)return;
                run.terminalStatus=status;
                run.turn+=1;
                saveClientRun();
                post('/api/salvage/finish',{result:{
                    run_id:run.id,status:status,x:run.x,y:run.y,health:status==='dead'?0:run.health,turn:run.turn,
                    objects:run.objects,cargo:run.cargo.map(function(entry){
                        return {key:entry.key,quantity:entry.quantity,durability:Number(entry.durability)||0,maxDurability:Number(entry.maxDurability)||0,charges:Number(entry.charges)||0};
                    }),
                    kit:run.kit
                }});
            }
            function interact(){
                var run=state&&state.run;
                if(!run||run.terminalStatus)return;
                var container=activeObject('container');
                if(container){performLocalAction('search',container.id);return;}
                var exit=activeObject('extract');
                if(exit){finishClientRun('extracted');return;}
                var enemy=activeObject('enemy');
                if(enemy)performLocalAction('attack',enemy.id);
            }
            function performLocalAction(action,id){
                var run=state&&state.run;
                if(!run||run.terminalStatus)return;
                if(action==='search'){
                    var container=activeObject('container',id);
                    if(!container){feedback('靠近未搜索的容器后再搜索。',true);return;}
                    var capacity=run.capacity-cargoWeight(run);
                    var collected=[];
                    (container.loot||[]).forEach(function(entry){
                        var definition=state.catalog.find(function(value){return value.key===entry.key;});
                        if(!definition)return;
                        var quantity=definition.weight===0?entry.quantity:Math.min(entry.quantity,Math.floor(capacity/definition.weight));
                        if(quantity>0){collected.push(Object.assign({},entry,{quantity:quantity}));capacity-=quantity*definition.weight;}
                    });
                    container.searched=true;
                    container.loot=[];
                    if(collected.length)addCargo(run,collected);
                    run.turn+=2;
                    feedback(collected.length?'搜刮获得 '+collected.map(function(entry){var def=state.catalog.find(function(value){return value.key===entry.key;});return (def?def.name:entry.key)+' ×'+entry.quantity;}).join('、'):'已搜索容器，背包空间不足，未能带走物资。',false);
                }else if(action==='attack'){
                    var enemy=activeObject('enemy',id);
                    if(!enemy){feedback('靠近敌人后再攻击。',true);return;}
                    if(run.weapon.charges<1){feedback('武器充能不足，需撤离后购买星晶充能。',true);return;}
                    var definition=state.catalog.find(function(value){return value.key===run.weapon.key;})||{};
                    var damage=Number(definition.damage)||10+(Number(run.weapon.tier)||1)*7;
                    run.weapon.charges=Math.max(0,run.weapon.charges-1);
                    enemy.health=Math.max(0,enemy.health-damage);
                    if(enemy.health===0){
                        enemy.defeated=true;
                        var drops=enemy.loot||[];
                        if(cargoWeight(run)+drops.reduce(function(total,entry){var def=state.catalog.find(function(value){return value.key===entry.key;});return total+(def?def.weight:0)*entry.quantity;},0)<=run.capacity)addCargo(run,drops);
                        enemy.loot=[];
                        feedback('已击败'+enemy.name+'。'+(drops.length?'获得人机掉落物资。':''),false);
                    }else{
                        var reduction=run.armor.durability>0?(Number(run.armor.tier)||1)*3:0;
                        var incoming=Math.max(1,Number(enemy.attack||1)-reduction);
                        run.armor.durability=Math.max(0,run.armor.durability-1);
                        run.kit.armor.durability=run.armor.durability;
                        run.health=Math.max(0,run.health-incoming);
                        feedback('造成 '+damage+' 点伤害，受到 '+incoming+' 点反击。',false);
                        if(run.health===0){saveClientRun();finishClientRun('dead');return;}
                    }
                    run.kit.weapon.charges=run.weapon.charges;
                    run.turn+=1;
                }else if(action==='heal'){
                    var medkit=run.cargo.find(function(entry){return entry.key==='medkit'&&entry.quantity>0;});
                    if(!medkit||run.health>=run.max_health){feedback(!medkit?'没有携带急救包。':'生命值已满，无需使用急救包。',true);return;}
                    medkit.quantity-=1;
                    run.cargo=run.cargo.filter(function(entry){return entry.quantity>0;});
                    var healed=Math.min(run.max_health-run.health,45);
                    run.health+=healed;
                    run.turn+=1;
                    feedback('使用急救包，恢复 '+healed+' 点生命值。',false);
                }
                saveClientRun();
                draw();
            }
            function renderHideout(){
                var gear=inventoryKind('backpack').length&&inventoryKind('weapon').length&&inventoryKind('armor').length;
                var ownedGear=inventoryKind('backpack').concat(inventoryKind('weapon'),inventoryKind('armor'));
                ['backpack','weapon','armor'].forEach(function(kind){
                    var chosen=state.items.find(function(item){return Number(item.id)===Number(selectedGear[kind])&&item.kind===kind;});
                    if(!chosen)selectedGear[kind]=Number((inventoryKind(kind)[0]||{}).id)||0;
                });
                var slots='<div class="salvage-slot-list">'+['backpack','weapon','armor'].map(function(kind){
                    var names={backpack:'背包槽位',weapon:'武器槽位',armor:'护甲槽位'};
                    var chosen=state.items.find(function(item){return Number(item.id)===Number(selectedGear[kind]);});
                    return '<button class="salvage-slot '+(selectedStashItem?'selected':'')+'" data-action="assign-gear" data-kind="'+kind+'">'+
                        (chosen?itemSvg(chosen):'')+'<span><strong>'+names[kind]+'</strong><small>'+(chosen?esc(chosen.name)+' · '+(kind==='weapon'?'充能 '+number(chosen.charges):kind==='armor'?'耐久 '+number(chosen.durability)+'/'+number(chosen.max_durability):'负重 '+number(12+chosen.tier*6)):'尚未选择')+'</small></span></button>';
                }).join('')+'</div>';
                var gearCards=ownedGear.length?'<div class="salvage-list">'+ownedGear.map(function(item){
                    var detail=item.kind==='weapon'?'充能 '+number(item.charges):item.kind==='armor'?'耐久 '+number(item.durability)+'/'+number(item.max_durability):'负重上限 '+number(12+item.tier*6);
                    return '<div class="salvage-item '+(Number(selectedStashItem)===Number(item.id)?'is-selected':'')+'"><button class="salvage-slot salvage-selectable" data-action="select-gear" data-id="'+item.id+'">'+itemSvg(item)+'<span><strong>'+esc(item.name)+'</strong><small>'+esc(detail)+' · 价值 '+number(item.value)+' 星币</small></span></button><div class="salvage-item-actions">'+itemActions(item)+'</div></div>';
                }).join('')+'</div>':'';
                var medkits=inventoryKind('medicine').reduce(function(total,item){return total+Number(item.quantity);},0);
                var zoneCards='<div class="salvage-grid"><div class="salvage-panel salvage-tactical"><div class="salvage-heading"><div><h2>战术配装 · 选择地图与出战装备</h2><p>先点击左侧仓库中的装备，再点击右侧对应槽位完成配装。</p></div></div>'+
                    (gear?'<div class="salvage-stash-grid"><div><div class="salvage-stash-categories"><span>仓库装备 · '+number(ownedGear.length)+' 件</span><span>点击物品选择</span></div>'+gearCards+'</div>'+slots+'</div>':'<div class="salvage-warning">仓库需要各有一件背包、武器和护甲才能出发。可在下方商店购买；首次档案附有一套 1 级装备。</div>')+
                    (gear?'<label class="salvage-inline-field" style="max-width:180px;margin-top:8px">携带急救包（仓库 '+number(medkits)+'）<input type="number" min="0" max="5" value="'+Math.min(2,medkits)+'" data-medkits></label>':'')+
                    '<div class="salvage-controls">'+
                    (gear?'<button data-action="start" data-zone="safe">进入安全区</button><button class="danger" data-action="start" data-zone="chaos">进入混乱区（装备价值需 ≥ '+number(state.zones.chaos.entry_value)+'）</button>':'')+
                    '<button class="secondary" data-action="tutorial">查看行动教程</button></div><div class="salvage-warning">混乱区装备价值门槛按本次携带的背包、武器和护甲计算。移动耗时 1 分钟，搜索耗时 2 分钟；护甲减伤、武器伤害和背包负重随等级提升。</div></div>'+
                    '<div class="salvage-panel"><div class="salvage-heading"><div><h2>装备商店</h2><p>星币独立于其他游戏经济；每级装备均可购买。</p></div></div>'+
                    '<div class="salvage-list">'+['backpack','weapon','armor'].map(function(kind){var names={backpack:'背包',weapon:'武器',armor:'护甲'};return '<div class="salvage-object"><strong>'+names[kind]+' · 1～6 级</strong><div class="salvage-controls">'+[1,2,3,4,5,6].map(function(tier){return state.catalog.filter(function(def){return def.kind===kind&&def.tier===tier;}).map(function(def){var current=state.items.filter(function(item){return item.item_key===def.key;}).length;var stat=kind==='backpack'?'负重 '+(12+tier*6):kind==='weapon'?'伤害 '+number(def.damage||10+tier*7)+' · '+(def.weaponBranch==='rail'?'磁轨':def.weaponBranch==='scatter'?'散射':'脉冲'): '减伤 '+(tier*3)+' · 耐久 '+(45+tier*9);return '<button class="secondary" data-action="purchase" data-item="'+esc(def.key)+'">'+itemSvg(def)+'<span>'+tier+'级 · '+esc(def.name)+'<br>'+stat+' · '+number(def.price)+' 星币'+(current?' ×'+number(current):'')+'</span></button>';}).join('');}).join('')+'</div></div>';}).join('')+
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
                var stash='<section class="salvage-panel salvage-tactical"><div class="salvage-heading"><div><h2>战术仓库</h2><p>按装备状态管理物资；带磨损耐久的物品会按剩余耐久折价出售。带充能武器要先卸载完整星晶。</p></div><span class="salvage-pill">'+number(state.items.length)+' 格物品</span></div><div class="salvage-stash-categories"><span>装备 / 武器</span><span>医疗补给</span><span>材料 / 收藏品</span><span>出售估值含耐久折价</span></div><div class="salvage-inventory">'+renderInventory()+'</div></section>';
                var recent=state.history.length?'<div class="salvage-list">'+state.history.map(function(run){return '<div class="salvage-item"><strong>'+esc(run.zone==='chaos'?'混乱区':'安全区')+' · '+esc(run.status==='dead'?'阵亡':'已撤离')+'</strong><small>'+esc(new Date(run.ended_at||run.started_at).toLocaleString('zh-CN'))+'</small></div>';}).join('')+'</div>':'<div class="salvage-empty">尚无已结束的对局</div>';
                document.getElementById('salvageContent').innerHTML=main+stash+(state.run?'':renderCrafting())+'<section class="salvage-panel"><div class="salvage-heading"><div><h2>行动记录</h2><p>最近八局结果</p></div></div>'+recent+'</section>';
            }
            function showTutorial(){
                var overlay=document.createElement('div');
                overlay.className='salvage-tutorial';
                overlay.setAttribute('role','dialog');
                overlay.setAttribute('aria-modal','true');
                overlay.innerHTML='<section class="salvage-tutorial-card"><span class="salvage-kicker">STATION FIELD GUIDE</span><h2>空间站行动教程</h2><ul><li>局外先点击一件背包、武器或护甲，再点击右侧对应槽位完成配装；武器需要星晶充能。</li><li>对局中按住 WASD / 方向键可连续移动，也可点击地图行走；位置和行动在本地即时更新。</li><li>靠近服务器、保险箱或补给容器后按 E 搜索；靠近敌人后按 E 或点击攻击。</li><li>接近边缘撤离平台后按 E 撤离；阵亡或成功撤离时，客户端只提交一次完整本局记录。</li><li>仓库物品均可出售；护甲按耐久折价。出售带充能的武器前，先卸载完整星晶。</li></ul><div class="salvage-controls"><button data-action="close-tutorial">开始行动</button></div></section>';
                root.appendChild(overlay);
            }
            async function load(){
                var response=await fetch('/api/salvage/state',{headers:{Accept:'application/json'}});
                var data=await response.json();
                if(!response.ok)throw new Error(data.error||'空间站档案暂不可用。');
                state=data;
                if(state.run)initializeClientRun();
                draw();
            }
            function feedback(message,error){notice.textContent=message||'';notice.classList.toggle('error',!!error);}
            async function post(path,payload){
                if(requestPending)return;
                requestPending=true;
                feedback('正在提交空间站指令…',false);
                try{
                    var response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(payload||{})});
                    var data=await response.json();
                    if(!response.ok)throw new Error(data.error||'操作失败。');
                    state=data.state;
                    if(path==='/api/salvage/start'&&state.run)initializeClientRun();
                    if(path==='/api/salvage/finish'){
                        if(payload.result&&payload.result.run_id!==undefined)localStorage.removeItem('salvage-client-run-'+payload.result.run_id);
                        pressedKeys={};moveTarget=null;
                    }
                    draw();feedback(data.notice||'空间站档案已更新。',false);
                }catch(error){
                    feedback(error.message||'请求失败，请稍后重试。',true);
                    if(path==='/api/salvage/finish')draw();
                }
                finally{requestPending=false;}
            }
            root.addEventListener('click',function(event){
                var button=event.target.closest('[data-action]');
                if(!button||!root.contains(button))return;
                if(button.getAttribute('aria-disabled')==='true')return;
                var action=button.dataset.action;
                if(action==='start'){
                    var payload={zone:button.dataset.zone,medkits:Number(root.querySelector('[data-medkits]')?.value||0)};
                    ['backpack','weapon','armor'].forEach(function(kind){payload[kind+'_id']=Number(selectedGear[kind])||0;});
                    post('/api/salvage/start',payload);return;
                }
                if(action==='select-gear'){selectedStashItem=Number(button.dataset.id);draw();return;}
                if(action==='assign-gear'){
                    var selected=state.items.find(function(item){return Number(item.id)===Number(selectedStashItem);});
                    if(!selected){feedback('请先点击仓库中的一件装备。',true);return;}
                    if(selected.kind!==button.dataset.kind){feedback('装备类型与目标槽位不匹配，请选择对应类型的物品。',true);return;}
                    selectedGear[selected.kind]=selected.id;selectedStashItem=0;draw();feedback('已将'+selected.name+'装入'+({backpack:'背包',weapon:'武器',armor:'护甲'}[selected.kind])+'槽位。',false);return;
                }
                if(action==='tutorial'){showTutorial();return;}
                if(action==='close-tutorial'){button.closest('.salvage-tutorial').remove();localStorage.setItem('salvage-tutorial-seen','1');return;}
                if(action==='attack'){performLocalAction('attack',button.dataset.id);return;}
                if(action==='search'){performLocalAction('search');return;}
                if(action==='extract'){if(activeObject('extract'))finishClientRun('extracted');else feedback('靠近撤离平台后再撤离。',true);return;}
                if(action==='heal'){performLocalAction('heal');return;}
                if(action==='retry-finish'&&state.run&&state.run.terminalStatus){finishClientRun(state.run.terminalStatus,true);return;}
                if(action==='purchase'){post('/api/salvage/purchase',{item:button.dataset.item});return;}
                if(action==='supplies'){post('/api/salvage/supplies',{item:button.dataset.item,quantity:Number(root.querySelector('[data-supply-quantity]').value)});return;}
                if(action==='sell'){post('/api/salvage/sell',{item_id:Number(button.dataset.id),quantity:Number(button.dataset.quantity)});return;}
                if(action==='unload'){post('/api/salvage/unload',{item_id:Number(button.dataset.id)});return;}
                if(action==='repair'){post('/api/salvage/repair',{item_id:Number(button.dataset.id)});return;}
                if(action==='charge'){
                    var amount=Number(prompt('当前有 '+number(state.player.star_crystals)+' 个星晶。每个星晶可提供 3 次攻击充能，请输入充能数量：',String(Math.min(3,state.player.star_crystals))));
                    if(Number.isSafeInteger(amount)&&amount>0)post('/api/salvage/charge',{item_id:Number(button.dataset.id),crystals:amount});
                    return;
                }
                if(action==='craft'){post('/api/salvage/craft',{item:button.dataset.item});return;}
                if(action==='claim-craft'){post('/api/salvage/craft/claim',{job_id:Number(button.dataset.id)});}
            });
            root.addEventListener('pointerdown',function(event){
                var svg=event.target.closest&&event.target.closest('#salvageMap');
                if(!svg||!state||!state.run||event.target.closest('[data-action]'))return;
                var point=svg.createSVGPoint();
                point.x=event.clientX;point.y=event.clientY;
                var local=point.matrixTransform(svg.getScreenCTM().inverse());
                if(walkable(state.run,local.x,local.y))moveTarget={x:local.x,y:local.y};
                svg.focus();
            });
            document.addEventListener('keydown',function(event){
                if(!state||!state.run||state.run.terminalStatus||requestPending||event.repeat||event.altKey||event.ctrlKey||event.metaKey)return;
                var target=event.target;
                if(target&&target.closest&&target.closest('input,select,textarea,[contenteditable="true"]'))return;
                if(event.key==='e'||event.key==='E'){event.preventDefault();interact();return;}
                var key=event.key.toLowerCase();
                if(['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright'].indexOf(key)<0)return;
                event.preventDefault();moveTarget=null;
                if(key==='w'||key==='arrowup')pressedKeys.w=true;
                if(key==='a'||key==='arrowleft')pressedKeys.a=true;
                if(key==='s'||key==='arrowdown')pressedKeys.s=true;
                if(key==='d'||key==='arrowright')pressedKeys.d=true;
            });
            document.addEventListener('keyup',function(event){
                var key=event.key.toLowerCase();
                if(key==='w'||key==='arrowup')delete pressedKeys.w;
                if(key==='a'||key==='arrowleft')delete pressedKeys.a;
                if(key==='s'||key==='arrowdown')delete pressedKeys.s;
                if(key==='d'||key==='arrowright')delete pressedKeys.d;
            });
            window.addEventListener('blur',function(){pressedKeys={};});
            load().then(function(){
                if(localStorage.getItem('salvage-tutorial-seen')!=='1')showTutorial();
            }).catch(function(error){feedback(error.message||'空间站档案暂不可用。',true);});
            window.setInterval(function(){if(!state||!state.run)load().catch(function(error){feedback(error.message||'档案刷新失败。',true);});},15000);
            window.requestAnimationFrame(animationFrame);
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
