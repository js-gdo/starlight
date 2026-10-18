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
    @media(max-width:540px){.salvage-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.salvage-loadout,.salvage-manufacturers{grid-template-columns:1fr}.salvage-hero{padding:22px 18px}}
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
                    return '<div class="salvage-item"><div><strong>'+esc(item.name)+(item.tier?' · '+item.tier+' 级':'')+'</strong><small>'+esc(condition)+' · '+esc(item.description)+'</small></div><div class="salvage-item-actions">'+itemActions(item)+'</div></div>';
                }).join('')+'</div>':'<div class="salvage-empty">仓库暂时空了；购买装备或继续探索补充物资。</div>';
            }
            function renderRun(run){
                var icons={server:'▤',safe:'▣',medical:'✚',supply:'▦',enemy:'◆',extract:'⇧'};
                var containerKinds=['server','safe','medical','supply'];
                var nearby=(run.objects||[]).filter(function(object){return object.kind==='enemy'&&!object.defeated&&Math.abs(object.x-run.x)+Math.abs(object.y-run.y)<=1;});
                var current=run.current_object;
                var cells='';
                for(var y=0;y<6;y++)for(var x=0;x<6;x++){
                    var object=run.objects.find(function(value){return value.x===x&&value.y===y;});
                    var here=x===run.x&&y===run.y;
                    var disabled=here||Math.abs(x-run.x)+Math.abs(y-run.y)!==1||(object&&object.kind==='enemy'&&!object.defeated);
                    var kindClass=object?(object.kind==='enemy'?'enemy':object.kind==='extract'?'exit':containerKinds.indexOf(object.kind)>=0?'container':''):'';
                    var symbol=here?'◉':object?icons[object.kind]:'·';
                    cells+='<button class="salvage-cell '+(here?'current ':'')+kindClass+'" data-action="move" data-x="'+x+'" data-y="'+y+'" aria-label="第 '+(x+1)+' 列第 '+(y+1)+' 行'+(object?' '+esc(object.name):' 空舱室')+'" '+(disabled?'disabled':'')+'>'+symbol+'</button>';
                }
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
                var cargo=run.cargo.length?run.cargo.map(function(item){return '<div class="salvage-run-item"><span>'+esc(item.name)+' ×'+number(item.quantity)+'</span><span>'+number(item.weight*item.quantity)+' 负重</span></div>';}).join(''):'<div class="salvage-empty">尚未搜到物资</div>';
                return '<section class="salvage-panel"><div class="salvage-heading"><div><h2>'+esc(run.zone==='chaos'?'混乱区':'安全区')+' · 对局进行中</h2><p>到达右下角撤离点带出装备、药品与搜刮物资。被击败或生命值归零会失去全部入局物品。</p></div><span class="salvage-pill">回合 '+number(run.turn)+'</span></div>'+
                    '<div class="salvage-stats"><div class="salvage-stat"><span>生命值</span><strong>'+number(run.health)+' / '+number(run.max_health)+'</strong></div><div class="salvage-stat"><span>背包负重</span><strong>'+number(run.cargo_weight)+' / '+number(run.capacity)+'</strong></div><div class="salvage-stat"><span>武器充能</span><strong>'+number(run.weapon.charges)+'</strong></div><div class="salvage-stat"><span>护甲耐久</span><strong>'+number(run.armor.durability)+' / '+number(run.armor.maxDurability)+'</strong></div></div>'+
                    '<div class="salvage-bar"><i style="width:'+Math.max(0,Math.min(100,run.health/run.max_health*100))+'%"></i></div>'+
                    '<div class="salvage-map">'+cells+'</div><div class="salvage-legend"><span>◉ 当前位置</span><span>▤ 服务器</span><span>▣ 保险箱</span><span>◆ 人机</span><span>⇧ 撤离点</span></div>'+
                    (current?'<div class="salvage-object"><strong>当前位置：'+esc(current.name)+'</strong><small>'+(current.kind==='extract'?'到达撤离点后可以结算本局战利品。':current.kind==='enemy'?'该区域有守卫；攻击附近目标以清理通路。':'搜索容器有机会获得不同类别的材料与收藏品。')+'</small></div>':'')+
                    '<div class="salvage-controls">'+(controls||'<span class="salvage-pill">移动探索，靠近敌人后攻击</span>')+'<button class="secondary" data-action="heal">使用急救包（恢复 45）</button></div>'+
                    '<div class="salvage-object"><strong>本局携带物资</strong>'+cargo+'</div>'+
                    '<div class="salvage-warning">当前穿戴：'+esc(run.backpack.name)+'、'+esc(run.weapon.name)+'、'+esc(run.armor.name)+'。撤离后耐久与剩余充能会保留；阵亡则全部遗失。</div></section>';
            }
            function renderHideout(){
                var gear=inventoryKind('backpack').length&&inventoryKind('weapon').length&&inventoryKind('armor').length;
                var options=gear?'<div class="salvage-loadout">'+selectMarkup('backpack','背包')+selectMarkup('weapon','武器')+selectMarkup('armor','护甲')+'</div>':'<div class="salvage-warning">仓库需要各有一件背包、武器和护甲才能出发。可在下方商店购买；首次档案附有一套 1 级装备。</div>';
                var medkits=inventoryKind('medicine').reduce(function(total,item){return total+Number(item.quantity);},0);
                var zoneCards='<div class="salvage-grid"><div class="salvage-panel"><div class="salvage-heading"><div><h2>选择地图与出战装备</h2><p>地图每局独立生成，六乘六舱室含容器、人机与一个撤离点。</p></div></div>'+options+
                    (gear?'<label class="salvage-inline-field" style="max-width:180px;margin-top:8px">携带急救包（仓库 '+number(medkits)+'）<input type="number" min="0" max="5" value="'+Math.min(2,medkits)+'" data-medkits></label>':'')+
                    '<div class="salvage-controls">'+
                    (gear?'<button data-action="start" data-zone="safe">进入安全区</button><button class="danger" data-action="start" data-zone="chaos">进入混乱区（装备价值需 ≥ '+number(state.zones.chaos.entry_value)+'）</button>':'')+
                    '</div><div class="salvage-warning">混乱区装备价值门槛按本次携带的背包、武器和护甲计算。护甲减伤、武器伤害和背包负重随等级提升。</div></div>'+
                    '<div class="salvage-panel"><div class="salvage-heading"><div><h2>装备商店</h2><p>星币独立于其他游戏经济；每级装备均可购买。</p></div></div>'+
                    '<div class="salvage-list">'+['backpack','weapon','armor'].map(function(kind){var names={backpack:'背包',weapon:'武器',armor:'护甲'};return '<div class="salvage-object"><strong>'+names[kind]+' · 1～6 级</strong><div class="salvage-controls">'+[1,2,3,4,5,6].map(function(tier){var key=kind+'_'+tier;var current=state.items.find(function(item){return item.item_key===key;});var price=Math.ceil(({backpack:320,weapon:440,armor:390}[kind])*Math.pow(1.72,tier-1));var stat=kind==='backpack'?'负重 '+(12+tier*6):kind==='weapon'?'伤害 '+(10+tier*7):'减伤 '+(tier*3)+' · 耐久 '+(45+tier*9);return '<button class="secondary" data-action="purchase" data-item="'+key+'">'+tier+'级 · '+stat+' · '+number(price)+' 星币'+(current?' ×'+number(current.quantity):'')+'</button>';}).join('')+'</div></div>';}).join('')+
                    '<div class="salvage-object"><strong>补给与充能材料</strong><div class="salvage-controls"><label class="salvage-inline-field">数量<input type="number" min="1" max="50" value="2" data-supply-quantity></label><button data-action="supplies" data-item="medkit">购买急救包（80 星币）</button><button class="secondary" data-action="supplies" data-item="star_crystal">购买星晶（45 星币）</button></div></div></div></div></div>';
                return zoneCards;
            }
            function renderCrafting(){
                var byCategory={};
                state.recipes.forEach(function(recipe){(byCategory[recipe.category]||(byCategory[recipe.category]=[])).push(recipe);});
                var names={crystal:'星晶制造商',backpack:'背包制造商',weapon:'武器制造商',armor:'护甲制造商',medicine:'药品制造商'};
                return '<section class="salvage-panel"><div class="salvage-heading"><div><h2>制造商</h2><p>各类别生产线可并行制造；同一生产线需先领取完成品再排产。启动时会提交配方材料。</p></div></div>'+
                    '<div class="salvage-manufacturers">'+Object.keys(names).map(function(category){var job=state.jobs.find(function(value){return value.category===category;});return '<div class="salvage-manufacturer"><h3>'+names[category]+'</h3>'+
                        (job?'<div class="salvage-job"><strong>'+esc(job.recipe?job.recipe.name:job.item_key)+'</strong><small>'+(job.ready?'制造完成，可以领取。':'完成时间：'+esc(new Date(job.finishes_at).toLocaleString('zh-CN')))+'</small>'+(job.ready?'<button data-action="claim-craft" data-id="'+job.id+'">领取成品</button>':'')+'</div>':
                            byCategory[category].map(function(recipe){var ingredients=Object.entries(recipe.requirements).map(function(entry){var found=state.items.find(function(item){return item.item_key===entry[0];});return (found?found.name:entry[0])+' ×'+entry[1];}).join('、');return '<div class="salvage-recipe"><span>'+esc(recipe.name)+'<br>'+esc(ingredients)+' · '+number(recipe.minutes)+' 分钟</span><button data-action="craft" data-item="'+esc(recipe.key)+'">制造</button></div>';}).join(''))+'</div>';}).join('')+'</div></section>';
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
                var button=event.target.closest('button[data-action]');
                if(!button||!root.contains(button))return;
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
