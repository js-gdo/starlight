import { getSessionUser } from '../utils/auth';
import { getLayout } from '../utils/layout';
import type { Env } from '../env.d';

const SPACE_SHOP_STYLES = `
    .space-shop{--ink:#f3f7ff;--muted:#9eacc7;--panel:#131e33;--line:#2c3d5c;--cyan:#71e3e2;--gold:#ffcf76;color:var(--ink)}
    .shop-hero{position:relative;overflow:hidden;padding:clamp(23px,5vw,44px);border:1px solid #3e647e;border-radius:23px;background:radial-gradient(ellipse at 86% 7%,#54d1dd36,transparent 38%),radial-gradient(ellipse at 8% 110%,#7265d137,transparent 46%),linear-gradient(125deg,#101a2c,#172c42 54%,#142033);box-shadow:0 20px 54px #08132366}
    .shop-hero:after{content:"";position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(#dfffff99 1px,transparent 1px),radial-gradient(#e7c98188 1px,transparent 1px);background-size:43px 43px,71px 71px;background-position:0 0,20px 17px;opacity:.25}
    .shop-hero-copy{position:relative;z-index:1;max-width:660px}
    .shop-kicker{color:var(--cyan);font-size:10px;font-weight:900;letter-spacing:.22em}
    .shop-hero h1{margin:9px 0;color:#fff;font-size:clamp(30px,6vw,46px);letter-spacing:-.045em}
    .shop-hero p{max-width:560px;margin:0;color:#c5d1e4;line-height:1.75}
    .shop-orbit{position:absolute;right:7%;top:50%;display:grid;width:clamp(132px,22vw,218px);aspect-ratio:1;place-items:center;transform:translateY(-50%);border:1px solid #83e2e566;border-radius:50%;color:#d9fbff;font-size:clamp(45px,8vw,76px);box-shadow:0 0 55px #52c5db24,inset 0 0 40px #78d9ed12}
    .shop-orbit:before,.shop-orbit:after{position:absolute;inset:20% -22%;border:1px solid #9d91ff55;border-radius:50%;content:"";transform:rotate(-35deg)}
    .shop-orbit:after{inset:31% -30%;transform:rotate(37deg)}
    .space-shop .page-header{margin-bottom:13px}
    .shop-panel{margin-top:14px;padding:clamp(15px,3vw,22px);border:1px solid var(--line);border-radius:16px;background:linear-gradient(145deg,#17243a,#111b2e);box-shadow:0 10px 30px #080f1f38}
    .shop-panel-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:13px}
    .shop-panel-heading h2{margin:0;color:#f6f8ff;font-size:17px}
    .shop-panel-heading p{margin:4px 0 0;color:var(--muted);font-size:11px;line-height:1.55}
    .shop-pill{display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border:1px solid #38516e;border-radius:99px;background:#1d2c44;color:#b8d9e7;font-size:10px;white-space:nowrap}
    .shop-stats{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:9px;margin:13px 0}
    .shop-stat{min-width:0;padding:12px;border:1px solid var(--line);border-radius:12px;background:linear-gradient(145deg,#1c2a41,#152136)}
    .shop-stat span{display:flex;align-items:center;gap:7px;color:var(--muted);font-size:10px}
    .shop-stat span i{color:var(--cyan)}
    .shop-stat strong{display:block;margin-top:7px;overflow-wrap:anywhere;color:#fff;font-size:clamp(15px,2.2vw,21px);font-variant-numeric:tabular-nums}
    .shop-stat small{display:block;margin-top:3px;color:#8596b0;font-size:9px}
    .shop-progress{height:7px;margin-top:7px;overflow:hidden;border-radius:99px;background:#344158}
    .shop-progress i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#6adbd9,#b7a7ff);transition:width .25s}
    .shop-main-grid{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(275px,.8fr);gap:14px;margin-top:14px;align-items:start}
    .shop-main-grid .shop-panel{margin-top:0}
    .shop-svg-wrap{overflow:auto;border:1px solid #2b3c58;border-radius:13px;background:linear-gradient(180deg,#12233a,#111a2c)}
    .shop-svg{display:block;width:100%;min-width:520px;height:auto}
    .shop-event{display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid #55788a;border-radius:12px;background:linear-gradient(105deg,#16394a,#202b4b)}
    .shop-event-icon{display:grid;flex:0 0 38px;width:38px;height:38px;place-items:center;border-radius:11px;background:#61d3d32b;color:#85f0e8;font-size:17px}
    .shop-event b{color:#f2feff;font-size:12px}
    .shop-event p{margin:4px 0 0;color:#b6cdd7;font-size:10px;line-height:1.5}
    .shop-controls{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:12px}
    .space-shop button,.space-shop input{font:inherit}
    .space-shop button{border:1px solid #3d98a4;border-radius:8px;padding:8px 11px;background:linear-gradient(135deg,#258c99,#286a91);color:#fff;font-size:10px;font-weight:800;cursor:pointer;transition:filter .15s,transform .15s}
    .space-shop button:hover:not(:disabled){filter:brightness(1.12);transform:translateY(-1px)}
    .space-shop button:disabled{opacity:.42;cursor:not-allowed}
    .space-shop .button-alt{border-color:#485b79;background:linear-gradient(135deg,#344765,#293951)}
    .space-shop .button-gold{border-color:#a88543;background:linear-gradient(135deg,#bd9249,#896437)}
    .shop-name-form{display:flex;align-items:center;gap:7px}
    .shop-name-form input{width:min(250px,48vw);padding:8px 10px;border:1px solid #405471;border-radius:8px;outline:none;background:#111c30;color:#f4f6ff;font-size:12px}
    .shop-name-form input:focus{border-color:#6ed5d6}
    .shop-products{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}
    .shop-product{position:relative;min-width:0;overflow:hidden;padding:12px;border:1px solid #2c3d5b;border-radius:13px;background:linear-gradient(150deg,#1b2941,#141f33)}
    .shop-product.locked{opacity:.68}
    .shop-product-top{display:flex;align-items:center;gap:9px}
    .shop-product-icon{display:grid;flex:0 0 36px;width:36px;height:36px;place-items:center;border:1px solid #51678455;border-radius:11px;background:#25354d}
    .shop-product h3{margin:0;color:#f2f5ff;font-size:12px;line-height:1.4}
    .shop-product small{display:block;margin-top:3px;color:#94a4bf;font-size:9px}
    .shop-product p{min-height:30px;margin:9px 0;color:#aab6ca;font-size:9px;line-height:1.55}
    .shop-product-meta{display:flex;justify-content:space-between;gap:6px;color:#c0cde0;font-size:9px}
    .shop-stock-track{height:6px;margin:6px 0;overflow:hidden;border-radius:99px;background:#344158}
    .shop-stock-track i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#4ec9b7,#a5d982)}
    .shop-price-row{display:flex;align-items:center;gap:5px;margin-top:8px}
    .shop-price-row input{width:74px;padding:6px;border:1px solid #3b4e69;border-radius:6px;background:#101b2e;color:#fff;font-size:10px}
    .shop-price-row span{color:#99a7bf;font-size:9px}
    .shop-restock-row{display:flex;align-items:center;gap:5px;margin-top:7px}
    .shop-restock-row input{width:53px;padding:6px;border:1px solid #3b4e69;border-radius:6px;background:#101b2e;color:#fff;font-size:10px}
    .shop-restock-row button,.shop-price-row button{padding:6px 8px}
    .shop-lock{position:absolute;inset:0;display:grid;place-items:center;background:#0e1726b8;color:#e0d7bb;font-size:10px;font-weight:800;text-align:center}
    .shop-upgrades{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}
    .shop-upgrade{padding:11px;border:1px solid #30415d;border-radius:11px;background:#1b2940}
    .shop-upgrade i{color:#9de1dd}
    .shop-upgrade h3{margin:6px 0 3px;color:#f4f5ff;font-size:11px}
    .shop-upgrade p{min-height:42px;margin:0;color:#98a8c0;font-size:9px;line-height:1.5}
    .shop-upgrade small{display:block;margin:7px 0;color:#e9c980;font-size:9px}
    .shop-upgrade button{width:100%}
    .shop-dashboard-grid{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(280px,.8fr);gap:14px;margin-top:14px;align-items:stretch}
    .shop-dashboard-grid .shop-panel{margin-top:0}
    .shop-chart{display:block;width:100%;height:auto;min-height:165px}
    .shop-daily-card{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px;border:1px solid #6c6141;border-radius:12px;background:linear-gradient(110deg,#3a3326,#203047)}
    .shop-daily-card h3{margin:0 0 4px;color:#f4e6c2;font-size:12px}
    .shop-daily-card p{margin:0;color:#c5bd9f;font-size:10px;line-height:1.55}
    .shop-quest{margin-top:9px;padding:12px;border:1px solid #35435f;border-radius:11px;background:#1a263b}
    .shop-quest h3{margin:0;color:#ebefff;font-size:12px}
    .shop-quest p{margin:5px 0;color:#a8b5c9;font-size:10px;line-height:1.55}
    .shop-table-wrap{overflow:auto}
    .shop-table{width:100%;min-width:420px;border-collapse:collapse}
    .shop-table th,.shop-table td{padding:8px;border-bottom:1px solid #293a55;text-align:left;font-size:9px}
    .shop-table th{color:#8294b0}
    .shop-table td{color:#d8e1ef}
    .shop-score{color:#f0ce81!important;font-weight:800}
    .shop-notice{min-height:18px;margin-top:9px;color:#95e0c9;font-size:11px;line-height:1.5}
    .shop-notice.error{color:#ff9ca6}
    .shop-empty{padding:14px;border:1px dashed #41516b;border-radius:10px;color:#96a4ba;font-size:10px;text-align:center}
    @media(max-width:980px){.shop-stats{grid-template-columns:repeat(3,minmax(0,1fr))}.shop-products{grid-template-columns:repeat(2,minmax(0,1fr))}.shop-upgrades{grid-template-columns:repeat(3,minmax(0,1fr))}.shop-main-grid,.shop-dashboard-grid{grid-template-columns:1fr}.shop-orbit{right:4%;opacity:.65}}
    @media(max-width:540px){.shop-stats{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.shop-stat{padding:10px}.shop-products{grid-template-columns:1fr}.shop-upgrades{grid-template-columns:repeat(2,minmax(0,1fr))}.shop-hero{padding:22px 18px}.shop-orbit{right:-35px;opacity:.28}.shop-name-form{flex-wrap:wrap}.shop-name-form input{width:100%}.shop-daily-card{align-items:flex-start;flex-direction:column}.shop-daily-card button{width:100%}}
`;

function shopMarkup(): string {
    return `
        <main class="space-shop" id="spaceShop">
            <section class="shop-hero">
                <div class="shop-hero-copy">
                    <div class="shop-kicker">STARLIGHT COMMERCE · ORBITAL RETAIL</div>
                    <h1>星际商店</h1>
                    <p>从空间站的一间小铺起步，采购星际特产、布置货架、调整售价并招募店员。顾客会在你离线时继续光顾，经营收益最多结算 72 小时。</p>
                </div>
                <div class="shop-orbit" aria-hidden="true"><i class="fas fa-shop"></i></div>
            </section>
            <section class="shop-stats" id="shopStats"><div class="shop-empty">正在读取门店经营数据…</div></section>
            <div class="shop-main-grid">
                <section class="shop-panel">
                    <div class="shop-panel-heading">
                        <div><h2><i class="fas fa-store"></i> 门店管理</h2><p>给你的空间站商铺取个名字，打造独一无二的星际招牌。</p></div>
                        <form class="shop-name-form" id="shopNameForm"><input name="name" maxlength="24" aria-label="店铺名称" placeholder="输入新的店铺名称"><button>更新招牌</button></form>
                    </div>
                    <div class="shop-event" id="shopEvent"></div>
                    <div class="shop-svg-wrap" style="margin-top:12px"><svg class="shop-svg" id="shopFloor" viewBox="0 0 960 272" role="img" aria-label="星际商店俯视货架布局"></svg></div>
                </section>
                <section class="shop-panel">
                    <div class="shop-panel-heading"><div><h2><i class="fas fa-chart-line"></i> 今日经营</h2><p>自动售货按小时结算，售出商品将转化为经验、星币和口碑。</p></div><span class="shop-pill" id="shopOffline">离线结算中</span></div>
                    <div id="shopDaily"></div>
                    <div class="shop-quest" id="shopQuest"></div>
                </section>
            </div>
            <section class="shop-panel">
                <div class="shop-panel-heading"><div><h2><i class="fas fa-boxes-stacked"></i> 星际商品与货架</h2><p>根据推荐售价和今日星域热度管理库存。仓库为共享容量，升级可摆下更多商品。</p></div><span class="shop-pill" id="shopCapacity">仓库 —</span></div>
                <div class="shop-products" id="shopProducts"></div>
            </section>
            <section class="shop-panel">
                <div class="shop-panel-heading"><div><h2><i class="fas fa-screwdriver-wrench"></i> 店铺扩建</h2><p>扩大店面、装修橱窗、投放广告、雇佣员工并扩充仓库，长期提升销售能力。</p></div><span class="shop-pill">门店等级同步提升客流</span></div>
                <div class="shop-upgrades" id="shopUpgrades"></div>
            </section>
            <div class="shop-dashboard-grid">
                <section class="shop-panel">
                    <div class="shop-panel-heading"><div><h2><i class="fas fa-chart-area"></i> 七日营业趋势</h2><p>查看最近一周的成交额变化，发现门店经营节奏。</p></div><span class="shop-pill">北京时间</span></div>
                    <div id="shopChart"></div>
                </section>
                <section class="shop-panel">
                    <div class="shop-panel-heading"><div><h2><i class="fas fa-ranking-star"></i> 星港商会榜</h2><p>按门店规模、等级、口碑和累计销量综合排名。</p></div><span class="shop-pill">前 20 名</span></div>
                    <div class="shop-table-wrap" id="shopLeaderboard"></div>
                </section>
            </div>
            <div class="shop-notice" id="shopNotice" role="status" aria-live="polite"></div>
        </main>
        <script>
        (function(){
            var state=null;
            var root=document.getElementById('spaceShop');
            var notice=document.getElementById('shopNotice');
            function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];});}
            function num(value){return Number(value||0).toLocaleString('zh-CN');}
            function setNotice(text,error){notice.textContent=text||'';notice.className='shop-notice'+(error?' error':'');}
            function stat(icon,label,value,small,progress){return '<div class="shop-stat"><span><i class="fas '+icon+'"></i>'+label+'</span><strong>'+value+'</strong><small>'+small+'</small>'+(progress===undefined?'':'<div class="shop-progress"><i style="width:'+Math.max(0,Math.min(100,progress))+'%"></i></div>')+'</div>';}
            function drawStats(){
                var p=state.player;
                document.getElementById('shopStats').innerHTML=
                    stat('fa-store',esc(p.store_name),'Lv.'+num(p.store_level)+' 门店','等级 '+num(p.level)+' · 口碑 '+num(p.reputation),p.xp_progress)+
                    stat('fa-coins','可用星币',num(p.credits),'累计营业额 '+num(p.total_revenue))+
                    stat('fa-box-open','仓库容量',num(p.stock_used)+' / '+num(p.inventory_capacity),'还可进货 '+num(p.capacity_remaining)+' 件')+
                    stat('fa-bag-shopping','累计售出',num(p.total_units_sold),'自动经营最多结算 '+state.max_offline_hours+' 小时')+
                    stat('fa-star','店铺口碑',num(p.reputation)+' / 100','口碑提高客流')+
                    stat('fa-user-astronaut','连续营业',num(p.daily_streak)+' 天','领取每日开店补给');
                document.getElementById('shopCapacity').textContent='已用 '+num(p.stock_used)+' / '+num(p.inventory_capacity)+' 件';
                document.getElementById('shopOffline').textContent='离线经营 · 最多 '+state.max_offline_hours+' 小时';
            }
            function drawFloor(){
                var svg=document.getElementById('shopFloor');
                var products=state.products;
                var slots=products.map(function(p,index){
                    var col=index%6,row=Math.floor(index/6);
                    var x=174+col*127,y=60+row*91;
                    var fill=p.unlocked?p.color:'#5c6678';
                    var amount=p.stock;
                    var ratio=Math.max(0,Math.min(1,amount/Math.max(12,Math.ceil(state.player.inventory_capacity/6))));
                    var height=Math.round(35*ratio);
                    return '<g><title>'+esc(p.name)+' · '+(p.unlocked?'库存 '+num(amount):'等级 '+num(p.unlockLevel)+' 解锁')+'</title><rect x="'+x+'" y="'+y+'" width="108" height="67" rx="9" fill="#1c2b41" stroke="'+fill+'" stroke-opacity=".55"/><rect x="'+(x+8)+'" y="'+(y+9)+'" width="31" height="31" rx="9" fill="'+fill+'" fill-opacity=".2"/><text x="'+(x+23.5)+'" y="'+(y+30)+'" text-anchor="middle" fill="'+fill+'" font-size="13">✦</text><text x="'+(x+46)+'" y="'+(y+22)+'" fill="#e9f0fa" font-size="9" font-weight="700">'+esc(p.name.slice(0,7))+'</text><text x="'+(x+46)+'" y="'+(y+39)+'" fill="#a5b3c7" font-size="8">'+(p.unlocked?'库存 '+num(amount):'Lv.'+num(p.unlockLevel)+' 解锁')+'</text><rect x="'+(x+8)+'" y="'+(y+51)+'" width="91" height="5" rx="3" fill="#34445c"/><rect x="'+(x+8)+'" y="'+(y+51)+'" width="'+Math.round(91*ratio)+'" height="5" rx="3" fill="'+fill+'"/></g>';
                }).join('');
                svg.innerHTML='<defs><linearGradient id="shop-window" x2="0" y2="1"><stop stop-color="#183550"/><stop offset="1" stop-color="#101c31"/></linearGradient></defs><rect x="13" y="13" width="934" height="246" rx="15" fill="url(#shop-window)" stroke="#314763"/><rect x="31" y="29" width="126" height="211" rx="10" fill="#192940" stroke="#334a66"/><path d="M43 92h102M43 149h102M43 205h102" stroke="#52637b" stroke-width="4"/><text x="94" y="56" text-anchor="middle" fill="#a9e9e6" font-size="11" font-weight="700">星港入口</text><circle cx="94" cy="120" r="21" fill="#4cd4da" fill-opacity=".13" stroke="#76dadd"/><text x="94" y="126" text-anchor="middle" fill="#ccffff" font-size="17">✦</text><text x="94" y="181" text-anchor="middle" fill="#e8d5a1" font-size="10">'+esc(state.player.store_name.slice(0,9))+'</text><text x="94" y="221" text-anchor="middle" fill="#92a4bd" font-size="8">Lv.'+num(state.player.store_level)+' · 星港 '+num(state.player.reputation)+' 口碑</text>'+slots+'<rect x="174" y="245" width="743" height="5" rx="3" fill="#35b8c466"/><text x="545" y="256" text-anchor="middle" fill="#8195af" font-size="8">全息陈列货架 · '+products.length+' 个星际品类 · 客流自动结算</text>';
            }
            function drawProducts(){
                document.getElementById('shopProducts').innerHTML=state.products.map(function(p){
                    var ratio=Math.min(100,Math.floor(p.stock/Math.max(1,state.player.inventory_capacity/4)*100));
                    return '<article class="shop-product'+(p.unlocked?'':' locked')+'"><div class="shop-product-top"><span class="shop-product-icon" style="color:'+esc(p.color)+'"><i class="fas '+esc(p.icon)+'"></i></span><div><h3>'+esc(p.name)+'</h3><small>'+esc(p.category)+' · Lv.'+num(p.unlockLevel)+' 解锁</small></div></div><p>'+esc(p.description)+'</p><div class="shop-product-meta"><span>库存 '+num(p.stock)+'</span><span>售价 '+num(p.price)+' 星币</span></div><div class="shop-stock-track"><i style="width:'+ratio+'%;background:'+esc(p.color)+'"></i></div><div class="shop-product-meta"><span>进货成本 '+num(p.cost)+'</span><span>累计售出 '+num(p.lifetime_sold)+'</span></div>'+(p.unlocked?'<div class="shop-price-row"><input type="number" min="'+p.price_min+'" max="'+p.price_max+'" step="1" value="'+p.price+'" aria-label="'+esc(p.name)+'的新售价"><span>新售价</span><button class="button-alt" data-price="'+esc(p.key)+'">调价</button></div><div class="shop-restock-row"><input type="number" min="1" max="200" value="12" aria-label="'+esc(p.name)+'的进货数量"><button data-restock="'+esc(p.key)+'">补货</button><span style="color:#91a2bb;font-size:9px">推荐售价 '+num(p.price_min*2)+' 星币</span></div>':'<div class="shop-lock"><span><i class="fas fa-lock"></i> 店铺等级 '+num(p.unlockLevel)+' 解锁</span></div>')+'</article>';
                }).join('');
            }
            function drawUpgrades(){
                document.getElementById('shopUpgrades').innerHTML=state.upgrades.map(function(upgrade){
                    return '<article class="shop-upgrade"><i class="fas '+esc(upgrade.icon)+'"></i><h3>'+esc(upgrade.name)+' · Lv.'+num(upgrade.level)+' / '+num(upgrade.max_level)+'</h3><p>'+esc(upgrade.description)+'</p><small>'+(upgrade.cost===null?'已达最高等级':num(upgrade.cost)+' 星币')+'</small><button data-upgrade="'+esc(upgrade.key)+'" '+(upgrade.cost===null||state.player.credits<upgrade.cost?'disabled':'')+'>'+(upgrade.cost===null?'已满级':'升级设施')+'</button></article>';
                }).join('');
            }
            function drawDaily(){
                var p=state.player,q=state.quest;
                document.getElementById('shopDaily').innerHTML='<div class="shop-daily-card"><div><h3>每日开店补给 · 连续 '+num(p.daily_streak)+' 天</h3><p>领取 180 星币、25 经验和口碑补给，连续经营每日奖励递增。</p></div><button class="button-gold" data-action="daily" '+(!p.can_claim_daily?'disabled':'')+'>'+(p.can_claim_daily?'领取补给':'今日已领取')+'</button></div>';
                document.getElementById('shopQuest').innerHTML='<h3><i class="fas fa-clipboard-check"></i> 今日星域订单：'+esc(q.title)+'</h3><p>'+esc(q.description)+' 当前进度 '+num(q.progress)+' / '+num(q.target)+' · 完成奖励 '+num(q.reward)+' 星币和 35 经验。</p><div class="shop-progress"><i style="width:'+Math.min(100,Math.floor(q.progress/q.target*100))+'%"></i></div><div class="shop-controls"><span class="shop-pill">'+(q.claimed?'订单奖励已领取':q.complete?'订单已完成':'继续经营以完成订单')+'</span>'+(q.complete&&!q.claimed?'<button class="button-gold" data-action="quest">领取订单奖励</button>':'')+'</div>';
            }
            function drawChart(){
                var rows=state.sales_chart;
                var max=Math.max(1,...rows.map(function(row){return row.revenue;}));
                var points=rows.map(function(row,index){
                    var x=45+index*102;
                    var y=145-Math.round(row.revenue/max*105);
                    return {x:x,y:y,row:row};
                });
                var line=points.map(function(point){return point.x+','+point.y;}).join(' ');
                document.getElementById('shopChart').innerHTML='<svg class="shop-chart" viewBox="0 0 680 190" role="img" aria-label="最近七日星币营业额图表"><defs><linearGradient id="shop-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#67d8d8" stop-opacity=".38"/><stop offset="1" stop-color="#67d8d8" stop-opacity="0"/></linearGradient></defs><path d="M45 145 '+points.map(function(p){return 'L'+p.x+' '+p.y;}).join(' ')+' L657 145 Z" fill="url(#shop-area)"/><polyline points="'+line+'" fill="none" stroke="#73e5df" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'+points.map(function(p){return '<circle cx="'+p.x+'" cy="'+p.y+'" r="4" fill="#ffd17c"><title>'+esc(p.row.day)+' · '+num(p.row.revenue)+' 星币 / '+num(p.row.units)+' 件</title></circle><text x="'+p.x+'" y="169" text-anchor="middle" fill="#9caec6" font-size="9">'+esc(p.row.day.slice(5))+'</text>';}).join('')+'<text x="10" y="17" fill="#9caec6" font-size="9">星币 '+num(max)+'</text></svg>';
            }
            function drawLeaderboard(){
                var rows=state.leaderboard||[];
                document.getElementById('shopLeaderboard').innerHTML=rows.length?'<table class="shop-table"><thead><tr><th>排名</th><th>门店</th><th>等级</th><th>累计营业额</th><th>商会声望</th></tr></thead><tbody>'+rows.map(function(row,index){return '<tr><td>#'+(index+1)+'</td><td>'+esc(row.store_name)+(Number(row.user_id)===Number(state.player.user_id)?'（你）':'')+'</td><td>Lv.'+num(row.level)+'</td><td>'+num(row.total_revenue)+'</td><td class="shop-score">'+num(row.score)+'</td></tr>';}).join('')+'</tbody></table>':'<div class="shop-empty">商会榜暂时空空如也，开张成为首位星际店主吧。</div>';
            }
            function draw(){
                drawStats();drawFloor();drawProducts();drawUpgrades();drawDaily();drawChart();drawLeaderboard();
            }
            async function load(){
                var response=await fetch('/api/space-shop/state',{headers:{Accept:'application/json'}});
                var data=await response.json();
                if(!response.ok)throw new Error(data.error||'门店数据暂不可用');
                state=data;draw();
            }
            async function post(path,payload,button){
                if(button)button.disabled=true;
                setNotice('正在处理经营操作…',false);
                try{
                    var response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(payload||{})});
                    var data=await response.json();
                    if(!response.ok)throw new Error(data.error||'操作失败');
                    state=data.state;draw();setNotice(data.notice||'经营操作已完成。',false);
                }catch(error){setNotice(error.message||'操作失败，请稍后重试。',true);}
                finally{if(button&&button.isConnected)button.disabled=false;}
            }
            root.addEventListener('click',function(event){
                var button=event.target.closest('button[data-action],button[data-upgrade],button[data-restock],button[data-price]');
                if(!button||!root.contains(button))return;
                if(button.dataset.action==='daily'){post('/api/space-shop/daily/claim',{},button);return;}
                if(button.dataset.action==='quest'){post('/api/space-shop/quest/claim',{},button);return;}
                if(button.dataset.upgrade){post('/api/space-shop/upgrade',{upgrade:button.dataset.upgrade},button);return;}
                if(button.dataset.restock){
                    var card=button.closest('.shop-product');
                    var quantity=Number(card.querySelector('.shop-restock-row input').value);
                    post('/api/space-shop/inventory/restock',{product:button.dataset.restock,quantity:quantity},button);return;
                }
                if(button.dataset.price){
                    var productCard=button.closest('.shop-product');
                    var price=Number(productCard.querySelector('.shop-price-row input').value);
                    post('/api/space-shop/inventory/price',{product:button.dataset.price,price:price},button);
                }
            });
            document.getElementById('shopNameForm').addEventListener('submit',function(event){
                event.preventDefault();
                var input=event.target.elements.name;
                post('/api/space-shop/store/name',{name:input.value},event.submitter);
            });
            load().catch(function(error){setNotice(error.message||'门店初始化失败。',true);});
            window.setInterval(function(){load().catch(function(error){setNotice(error.message||'门店刷新失败。',true);});},60000);
        }());
        </script>`;
}

export async function renderSpaceShop(env: Env, request: Request): Promise<string> {
    const user = await getSessionUser(env, request);
    if (!user) {
        const content = `<div class="page-header"><h1><i class="fas fa-shop"></i> 星际商店</h1><p>经营空间站店铺、采购星际商品并扩张你的商业帝国。</p></div><div class="card"><a href="/login?redirect=%2Fspace-shop">登录以开始经营</a></div>`;
        return getLayout(env, user, '星际商店', content, SPACE_SHOP_STYLES, request);
    }
    return getLayout(env, user, '星际商店', shopMarkup(), SPACE_SHOP_STYLES, request);
}
