import { getSessionUser } from '../utils/auth';
import { getLayout } from '../utils/layout';
import { htmlEscape } from '../utils/html';
import type { Env } from '../env.d';

const GAME_STYLES = `
    .space-game{--space-ink:#edf3ff;--space-muted:#9ba9c7;--space-panel:#111a30;--space-line:#273451;--space-violet:#a987ff;--space-cyan:#67dbeb;color:var(--space-ink)}
    .space-hero{position:relative;overflow:hidden;padding:clamp(22px,5vw,42px);border:1px solid #34466d;border-radius:22px;background:radial-gradient(ellipse at 80% 0%,#6e57a444,transparent 42%),radial-gradient(ellipse at 10% 110%,#257b9a35,transparent 45%),linear-gradient(125deg,#11182b,#17213b 55%,#10192c);box-shadow:0 20px 60px #080f1f55}
    .space-hero:after{content:"";position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(#fff9 1px,transparent 1px),radial-gradient(#a9c8ff99 1px,transparent 1px);background-size:37px 37px,71px 71px;background-position:0 0,19px 28px;opacity:.34}
    .space-hero-content{position:relative;z-index:1;max-width:680px}
    .space-kicker{color:var(--space-cyan);font-weight:800;letter-spacing:.2em;font-size:10px}
    .space-hero h1{margin:8px 0;font-size:clamp(30px,6vw,48px);letter-spacing:-.04em;color:#fff}
    .space-hero p{max-width:590px;margin:0;color:#c0cbe1;line-height:1.7}
    .space-hero-orbit{position:absolute;right:7%;top:50%;width:clamp(120px,22vw,220px);height:clamp(120px,22vw,220px);transform:translateY(-50%);border:1px solid #9e8bea66;border-radius:50%;box-shadow:0 0 55px #8d75e522,inset 0 0 40px #6187bf12}
    .space-hero-orbit:before,.space-hero-orbit:after{content:"";position:absolute;border:1px solid #8edbea44;border-radius:50%;inset:18% -18%;transform:rotate(-35deg)}
    .space-hero-orbit:after{inset:30% -28%;transform:rotate(38deg)}
    .space-planet{position:absolute;left:50%;top:50%;width:38%;height:38%;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle at 30% 28%,#a8dcfa,#5684c2 42%,#473c82 74%,#171b43);box-shadow:0 0 48px #728cf477}
    .space-game .page-header{margin-bottom:14px}
    .space-resource-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin:13px 0}
    .space-resource{min-width:0;padding:14px 15px;border:1px solid var(--space-line);border-radius:13px;background:linear-gradient(145deg,#151e34,#11192a);box-shadow:0 8px 24px #090e1c35}
    .space-resource-top{display:flex;align-items:center;gap:8px;color:var(--space-muted);font-size:11px}
    .space-resource-top i{color:var(--space-cyan)}
    .space-resource strong{display:block;margin-top:7px;color:#fff;font-size:clamp(17px,2.5vw,23px);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
    .space-resource small{display:block;margin-top:3px;color:#8493af;font-size:10px}
    .space-section{margin-top:14px;padding:clamp(15px,3vw,22px);border:1px solid var(--space-line);border-radius:16px;background:linear-gradient(145deg,#141d32,#101829);box-shadow:0 10px 30px #090e1c30}
    .space-section-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px}
    .space-section-heading h2{margin:0;color:#f4f6ff;font-size:17px}
    .space-section-heading p{margin:4px 0 0;color:var(--space-muted);font-size:11px;line-height:1.5}
    .space-label{display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border:1px solid #334261;border-radius:99px;color:#aebbd4;background:#1b2740;font-size:10px;white-space:nowrap}
    .space-daily{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 16px;border:1px solid #695692;border-radius:13px;background:linear-gradient(110deg,#30254b,#1a2640 70%);margin-top:13px}
    .space-daily h3{margin:0 0 4px;color:#fff;font-size:14px}
    .space-daily p{margin:0;color:#c2b9d8;font-size:11px;line-height:1.5}
    .space-game button{border:1px solid #6958a0;border-radius:9px;padding:9px 12px;background:linear-gradient(135deg,#8064cf,#6344a8);color:#fff;font:inherit;font-size:11px;font-weight:800;cursor:pointer;transition:filter .15s,transform .15s}
    .space-game button:hover:not(:disabled){filter:brightness(1.12);transform:translateY(-1px)}
    .space-game button:disabled{opacity:.42;cursor:not-allowed}
    .space-button-secondary{background:#202d46!important;border-color:#3b4e70!important}
    .space-main-grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(280px,.75fr);gap:14px;margin-top:14px;align-items:start}
    .space-building-grid,.space-tech-grid,.space-sector-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    .space-item{min-width:0;padding:14px;border:1px solid #2a3855;border-radius:12px;background:linear-gradient(145deg,#18233a,#141d30)}
    .space-item-top{display:flex;align-items:center;gap:10px}
    .space-item-icon{display:grid;place-items:center;flex:0 0 36px;width:36px;height:36px;border:1px solid #3a416b;border-radius:11px;background:#282746;color:#b8a6ff}
    .space-item h3{margin:0;color:#f4f5ff;font-size:13px}
    .space-item .space-item-level{margin-top:3px;color:#8f9db9;font-size:10px}
    .space-item>p{min-height:32px;margin:10px 0;color:#9eabc4;font-size:10px;line-height:1.6}
    .space-item-footer{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
    .space-cost{color:#99a8c3;font-size:9px;line-height:1.7}
    .space-cost b{color:#dce5f5;font-weight:700}
    .space-output{margin-top:9px;padding-top:8px;border-top:1px solid #283650;color:#81d7df;font-size:10px}
    .space-sector{display:flex;flex-direction:column;min-height:180px}
    .space-sector>p{flex:1}
    .space-sector .space-sector-meta{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 10px}
    .space-game .space-tag{padding:4px 7px;border-radius:6px;background:#202c45;color:#adbad2;font-size:9px}
    .space-game .space-tag.alert{background:#4a3743;color:#f1b9a9}
    .space-expedition-list{display:grid;gap:8px}
    .space-expedition{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:12px;border:1px solid #2a3855;border-radius:11px;background:#172138}
    .space-expedition h3{margin:0;color:#f2f4ff;font-size:12px}
    .space-expedition p{margin:4px 0 0;color:#92a0bb;font-size:10px;line-height:1.6}
    .space-expedition-reward{color:#a8e0ce!important}
    .space-rank-wrap{overflow:auto}
    .space-rank-table{width:100%;min-width:480px;border-collapse:collapse}
    .space-rank-table th,.space-rank-table td{padding:9px 10px;border-bottom:1px solid #27344d;text-align:left;font-size:10px}
    .space-rank-table th{color:#8493af;font-size:9px;text-transform:uppercase;letter-spacing:.08em}
    .space-rank-table td{color:#dbe3f3}
    .space-rank-table .space-rank-score{color:#b9a3ff;font-weight:800;font-variant-numeric:tabular-nums}
    .space-rank-self{background:#27213e}
    .space-feedback{min-height:18px;margin-top:9px;color:#9eabc4;font-size:11px}
    .space-feedback.error{color:#ff9a9a}
    .space-empty{padding:16px;border:1px dashed #33415c;border-radius:10px;color:#8997b1;font-size:11px;text-align:center}
    .space-game-loading{padding:20px;border:1px solid var(--space-line);border-radius:14px;background:#121b2e;color:#aebbd4}
    .space-game .page-header h1{color:#fff}
    @media(max-width:850px){.space-resource-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.space-main-grid{grid-template-columns:1fr}.space-hero-orbit{right:3%;opacity:.65}}
    @media(max-width:520px){.space-resource-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.space-resource{padding:11px}.space-hero{padding:22px 18px}.space-hero-orbit{right:-34px;opacity:.35}.space-building-grid,.space-tech-grid,.space-sector-grid{grid-template-columns:1fr}.space-daily{align-items:flex-start;flex-direction:column}.space-daily button{width:100%}.space-expedition{grid-template-columns:1fr}.space-expedition button{width:100%}}
`;

function renderGameContent(): string {
    return `
        <div class="page-header"><h1><i class="fas fa-rocket"></i> 星际边境</h1><p>扩建你的轨道基地，研究跃迁科技，派遣舰队探索未知星域。</p></div>
        <main class="space-game">
            <section class="space-hero">
                <div class="space-hero-orbit"><div class="space-planet"></div></div>
                <div class="space-hero-content">
                    <span class="space-kicker">STARLIGHT FRONTIER · SECTOR 07</span>
                    <h1>星际边境</h1>
                    <p>从一座小型空间站出发。资源会随时间持续产出，离线也会继续发展；升级设施、推进科技树，逐步开启深空远征。</p>
                </div>
            </section>
            <div class="space-resource-grid" id="spaceResources"><div class="space-game-loading">正在载入基地数据…</div></div>
            <section class="space-daily">
                <div><h3><i class="fas fa-calendar-check"></i> 每日星际补给</h3><p id="spaceDailyText">每日领取信用点、合金、晶体和研究点。连续签到可提高补给。</p></div>
                <button id="spaceDailyClaim" type="button" disabled>领取今日补给</button>
            </section>
            <div class="space-main-grid">
                <section class="space-section">
                    <div class="space-section-heading"><div><h2><i class="fas fa-building"></i> 空间站设施</h2><p>设施每小时自动生产资源；离线收益最多累积 48 小时。</p></div><span class="space-label" id="spaceOfflineLabel">自动生产</span></div>
                    <div class="space-building-grid" id="spaceBuildings"><div class="space-game-loading">正在载入设施…</div></div>
                </section>
                <section class="space-section">
                    <div class="space-section-heading"><div><h2><i class="fas fa-atom"></i> 科技树</h2><p>投入研究点与稀有晶体，永久强化基地。</p></div></div>
                    <div class="space-tech-grid" id="spaceTechnologies"><div class="space-game-loading">正在载入科技…</div></div>
                </section>
            </div>
            <section class="space-section">
                <div class="space-section-heading"><div><h2><i class="fas fa-satellite"></i> 深空远征</h2><p>出发前消耗能量，旅程结束后领取预先确定的战利品；升级船坞可增加远征位。</p></div><span class="space-label" id="spaceExpeditionSlots">远征位 —</span></div>
                <div class="space-sector-grid" id="spaceSectors"><div class="space-game-loading">正在扫描星域…</div></div>
            </section>
            <section class="space-section">
                <div class="space-section-heading"><div><h2><i class="fas fa-route"></i> 远征舰队</h2><p>远征完成后领取奖励，奖励只可领取一次。</p></div></div>
                <div class="space-expedition-list" id="spaceExpeditions"></div>
            </section>
            <section class="space-section">
                <div class="space-section-heading"><div><h2><i class="fas fa-trophy"></i> 星际指挥官榜</h2><p>根据设施、科技、完成远征和连续补给综合计算。</p></div><span class="space-label">前 20 名</span></div>
                <div class="space-rank-wrap" id="spaceLeaderboard"><div class="space-empty">正在载入指挥官榜…</div></div>
            </section>
            <div id="spaceFeedback" class="space-feedback" role="status" aria-live="polite"></div>
        </main>
        <script>
        (function(){
            var state=null;
            var feedback=document.getElementById('spaceFeedback');
            var resourceConfig=[
                ['credits','fa-coins','信用点'],['alloy','fa-industry','合金'],
                ['crystal','fa-gem','能源晶体'],['research_points','fa-flask','研究点'],['energy','fa-bolt','舰队能量']
            ];
            var resourceNames={credits:'信用点',alloy:'合金',crystal:'晶体',research_points:'研究点'};
            function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];});}
            function number(value){return Number(value||0).toLocaleString('zh-CN');}
            function costHtml(cost){
                if(!cost)return '<span class="space-cost">已达最高等级</span>';
                return '<span class="space-cost">'+Object.keys(cost).map(function(key){return '<b>'+esc(resourceNames[key]||key)+' '+number(cost[key])+'</b>';}).join(' · ')+'</span>';
            }
            function resources(player){
                document.getElementById('spaceResources').innerHTML=resourceConfig.map(function(item){
                    var value=item[0]==='energy'?number(player.energy)+' / '+number(player.energy_cap):number(player[item[0]]);
                    var rate=item[0]==='energy'?'每 10 分钟恢复 1 点':(state.production[item[0]]||0)+' / 小时';
                    return '<div class="space-resource"><div class="space-resource-top"><i class="fas '+item[1]+'"></i>'+item[2]+'</div><strong>'+value+'</strong><small>'+rate+'</small></div>';
                }).join('');
                var daily=document.getElementById('spaceDailyClaim');
                daily.disabled=!player.can_claim_daily;
                daily.textContent=player.can_claim_daily?'领取今日补给':'今日已领取';
                document.getElementById('spaceDailyText').textContent=player.can_claim_daily
                    ?'今日连续补给第 '+(Number(player.daily_streak)+1)+' 天：领取信用点、合金、晶体与研究点。连续补给奖励逐日提升。'
                    :'已连续补给 '+number(player.daily_streak)+' 天。明天回来领取下一份补给。';
            }
            function buildings(items){
                document.getElementById('spaceBuildings').innerHTML=items.map(function(item){
                    var output=item.production?'<div class="space-output">+'+number(item.production)+' '+esc(resourceNames[item.resource]||item.resource)+' / 小时</div>':'<div class="space-output">远征位 '+Math.min(3,1+Math.floor(Math.max(0,item.level-1)/3))+' / 3</div>';
                    return '<article class="space-item"><div class="space-item-top"><span class="space-item-icon"><i class="fas '+esc(item.icon)+'"></i></span><div><h3>'+esc(item.name)+'</h3><div class="space-item-level">等级 '+number(item.level)+' / '+number(item.level_cap)+'</div></div></div><p>'+esc(item.description)+'</p><div class="space-item-footer">'+costHtml(item.next_cost)+'<button type="button" data-upgrade-building="'+esc(item.key)+'" '+(!item.next_cost?'disabled':'')+'>升级</button></div>'+output+'</article>';
                }).join('');
                document.querySelectorAll('[data-upgrade-building]').forEach(function(button){button.addEventListener('click',function(){post('/api/game/building/upgrade',{building:button.dataset.upgradeBuilding},button);});});
            }
            function technologies(items){
                document.getElementById('spaceTechnologies').innerHTML=items.map(function(item){
                    return '<article class="space-item"><div class="space-item-top"><span class="space-item-icon"><i class="fas '+esc(item.icon)+'"></i></span><div><h3>'+esc(item.name)+'</h3><div class="space-item-level">等级 '+number(item.level)+' / '+number(item.max_level)+'</div></div></div><p>'+esc(item.description)+'</p><div class="space-item-footer">'+costHtml(item.next_cost)+'<button type="button" data-upgrade-tech="'+esc(item.key)+'" '+(!item.next_cost?'disabled':'')+'>研究</button></div></article>';
                }).join('');
                document.querySelectorAll('[data-upgrade-tech]').forEach(function(button){button.addEventListener('click',function(){post('/api/game/research/upgrade',{technology:button.dataset.upgradeTech},button);});});
            }
            function sectors(items){
                document.getElementById('spaceSectors').innerHTML=items.map(function(item){
                    var locked=!item.unlocked;
                    return '<article class="space-item space-sector"><div class="space-item-top"><span class="space-item-icon"><i class="fas '+esc(item.icon)+'"></i></span><div><h3>'+esc(item.name)+'</h3><div class="space-item-level">'+number(item.duration_minutes)+' 分钟航程</div></div></div><p>'+esc(item.description)+'</p><div class="space-sector-meta"><span class="space-tag">能量 '+number(item.energy_cost)+'</span><span class="space-tag">船坞 Lv.'+number(item.required_shipyard)+'</span>'+(item.required_navigation?'<span class="space-tag">导航 Lv.'+number(item.required_navigation)+'</span>':'')+'</div><button type="button" data-launch-sector="'+esc(item.key)+'" '+(locked?'disabled':'')+'>'+(locked?'研究并升级以解锁':'派遣舰队')+'</button></article>';
                }).join('');
                document.querySelectorAll('[data-launch-sector]').forEach(function(button){button.addEventListener('click',function(){post('/api/game/expedition/launch',{sector:button.dataset.launchSector},button);});});
            }
            function formatRemaining(endAt){
                var seconds=Math.max(0,Math.ceil((Date.parse(endAt)-Date.now())/1000));
                if(!seconds)return '远征已完成，可以领取奖励';
                var hours=Math.floor(seconds/3600),minutes=Math.floor(seconds%3600/60),remaining=seconds%60;
                return '剩余 '+(hours?hours+' 小时 ':'')+(minutes?minutes+' 分 ':'')+remaining+' 秒';
            }
            function expeditions(items,slots){
                document.getElementById('spaceExpeditionSlots').textContent='远征位 '+number(slots.active)+' / '+number(slots.max);
                var active=items.filter(function(item){return item.status==='active';});
                var history=items.filter(function(item){return item.status==='claimed';}).slice(0,4);
                var list=active.concat(history);
                var host=document.getElementById('spaceExpeditions');
                host.innerHTML=list.length?list.map(function(item){
                    var reward=item.rewards;
                    var rewardText='信用点 '+number(reward.credits)+' · 合金 '+number(reward.alloy)+' · 晶体 '+number(reward.crystal)+' · 研究 '+number(reward.research_points);
                    var activeTrip=item.status==='active';
                    return '<article class="space-expedition"><div><h3><i class="fas '+(activeTrip?'fa-shuttle-space':'fa-circle-check')+'"></i> '+esc(item.sector_name)+(activeTrip?' · '+esc(formatRemaining(item.ends_at)):' · 已领取')+'</h3><p class="space-expedition-reward">'+rewardText+'</p></div>'+(activeTrip?'<button type="button" data-claim-expedition="'+number(item.id)+'" '+(!item.ready_to_claim?'disabled':'')+'>'+(item.ready_to_claim?'领取战利品':'远征中')+'</button>':'<span class="space-label">远征完成</span>')+'</article>';
                }).join(''):'<div class="space-empty">舰队尚未出发。选择一个已解锁的星域开始远征。</div>';
                document.querySelectorAll('[data-claim-expedition]').forEach(function(button){button.addEventListener('click',function(){post('/api/game/expedition/claim',{expedition_id:Number(button.dataset.claimExpedition)},button);});});
            }
            function draw(data){
                state=data;
                resources(data.player);
                buildings(data.buildings);
                technologies(data.technologies);
                sectors(data.sectors);
                expeditions(data.expeditions,data.expedition_slots);
            }
            function setFeedback(text,isError){
                feedback.textContent=text||'';
                feedback.classList.toggle('error',!!isError);
            }
            async function load(){
                try{
                    var response=await fetch('/api/game/state',{headers:{Accept:'application/json'}});
                    var data=await response.json();
                    if(!response.ok)throw new Error(data.error||'HTTP '+response.status);
                    draw(data);
                }catch(error){setFeedback('基地数据加载失败：'+error.message,true);}
            }
            async function post(path,payload,button){
                if(button)button.disabled=true;
                setFeedback('正在与空间站同步…',false);
                try{
                    var response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(payload||{})});
                    var data=await response.json();
                    if(!response.ok)throw new Error(data.error||'HTTP '+response.status);
                    draw(data.state);
                    setFeedback('操作完成，基地数据已更新。',false);
                    loadLeaderboard();
                }catch(error){setFeedback(error.message,true);}
                finally{if(button&&button.isConnected)button.disabled=false;}
            }
            async function loadLeaderboard(){
                var host=document.getElementById('spaceLeaderboard');
                try{
                    var response=await fetch('/api/game/leaderboard',{headers:{Accept:'application/json'}});
                    var data=await response.json();
                    if(!response.ok)throw new Error(data.error||'HTTP '+response.status);
                    var rows=Array.isArray(data.standings)?data.standings:[];
                    host.innerHTML=rows.length?'<table class="space-rank-table"><thead><tr><th>排名</th><th>指挥官</th><th>基地等级</th><th>科技</th><th>远征</th><th>总声望</th></tr></thead><tbody>'+rows.map(function(row,index){return '<tr><td>#'+(index+1)+'</td><td>'+esc(row.username)+'</td><td>'+number(row.building_levels)+'</td><td>'+number(row.technology_levels)+'</td><td>'+number(row.completed_expeditions)+'</td><td class="space-rank-score">'+number(row.score)+'</td></tr>';}).join('')+'</tbody></table>':'<div class="space-empty">还没有星际指挥官上榜，成为第一个拓荒者吧。</div>';
                }catch(error){host.innerHTML='<div class="space-empty">排行榜暂不可用：'+esc(error.message)+'</div>';}
            }
            document.getElementById('spaceDailyClaim').addEventListener('click',function(){post('/api/game/daily/claim',{},this);});
            load();
            loadLeaderboard();
            window.setInterval(load,60000);
            window.setInterval(function(){
                document.querySelectorAll('[data-claim-expedition]').forEach(function(button){
                    var row=state&&state.expeditions.find(function(item){return item.id===Number(button.dataset.claimExpedition);});
                    if(row&&row.status==='active'&&!row.ready_to_claim&&Date.parse(row.ends_at)<=Date.now())load();
                });
                document.querySelectorAll('.space-expedition h3').forEach(function(heading){
                    var row=state&&state.expeditions.find(function(item){return item.status==='active'&&heading.textContent.indexOf(item.sector_name)!==-1;});
                    if(row)heading.innerHTML='<i class="fas fa-shuttle-space"></i> '+esc(row.sector_name)+' · '+esc(formatRemaining(row.ends_at));
                });
            },1000);
        }());
        </script>
    `;
}

export async function renderGame(env: Env, req: Request): Promise<string> {
    const user = await getSessionUser(env, req);
    if (!user) {
        const content = `<div class="page-header"><h1><i class="fas fa-rocket"></i> 星际边境</h1><p>登录后建立你的空间站并开始探索。</p></div><div class="card"><a href="/login?redirect=%2Fgame">登录以开始游戏</a></div>`;
        return getLayout(env, user, '星际边境', content, GAME_STYLES, req);
    }
    return getLayout(env, user, '星际边境', renderGameContent(), GAME_STYLES, req);
}
