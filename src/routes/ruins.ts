import { getSessionUser } from '../utils/auth';
import { getLayout } from '../utils/layout';
import { htmlEscape } from '../utils/html';
import type { Env } from '../env.d';

const RUINS_STYLES = `
    .ruins{--ink:#eff0ff;--muted:#a9a8c5;--panel:#17172b;--line:#393650;--gold:#f6c66b;--violet:#b69aff;color:var(--ink)}
    .ruins-hero{position:relative;overflow:hidden;padding:clamp(24px,5vw,46px);border:1px solid #51446f;border-radius:22px;background:radial-gradient(ellipse at 82% 15%,#d3954b35,transparent 36%),radial-gradient(ellipse at 15% 100%,#7a50c13d,transparent 46%),linear-gradient(125deg,#1b1930,#29223b 55%,#171a30);box-shadow:0 20px 54px #11101f55}
    .ruins-hero:after{content:"";position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(#fff9 1px,transparent 1px),radial-gradient(#f3c98266 1px,transparent 1px);background-size:41px 41px,73px 73px;background-position:0 0,17px 29px;opacity:.25}
    .ruins-hero-copy{position:relative;z-index:1;max-width:700px}
    .ruins-kicker{color:#f4cf8d;font-weight:800;font-size:10px;letter-spacing:.22em}
    .ruins-hero h1{margin:9px 0;font-size:clamp(30px,6vw,48px);letter-spacing:-.04em;color:#fff}
    .ruins-hero p{max-width:590px;margin:0;color:#d0cde0;line-height:1.75}
    .ruins-sigil{position:absolute;right:8%;top:50%;width:clamp(112px,19vw,190px);aspect-ratio:1;display:grid;place-items:center;transform:translateY(-50%);border:1px solid #dfbd7355;border-radius:50%;color:#e7c372;font-size:clamp(48px,8vw,78px);box-shadow:0 0 55px #d7a34e22,inset 0 0 42px #d7a34e12}
    .ruins-sigil:before,.ruins-sigil:after{content:"";position:absolute;inset:13%;border:1px solid #b69aff55;border-radius:50%;transform:rotate(45deg) scaleX(1.5)}
    .ruins-sigil:after{transform:rotate(-45deg) scaleX(1.5)}
    .ruins .page-header{margin-bottom:14px}
    .ruins-grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(280px,.75fr);gap:14px;margin-top:14px;align-items:start}
    .ruins-panel{margin-top:14px;padding:clamp(15px,3vw,22px);border:1px solid var(--line);border-radius:16px;background:linear-gradient(145deg,#1c1c32,#151527);box-shadow:0 10px 30px #100f1f35}
    .ruins-grid .ruins-panel{margin-top:0}
    .ruins-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px}
    .ruins-heading h2{margin:0;color:#faf8ff;font-size:17px}
    .ruins-heading p{margin:4px 0 0;color:var(--muted);font-size:11px;line-height:1.55}
    .ruins-label{display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border:1px solid #50476c;border-radius:99px;color:#ddd3f6;background:#28253d;font-size:10px;white-space:nowrap}
    .ruins-stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px;margin:13px 0}
    .ruins-stat{min-width:0;padding:13px;border:1px solid var(--line);border-radius:12px;background:linear-gradient(145deg,#202039,#17172a)}
    .ruins-stat span{display:flex;align-items:center;gap:7px;color:var(--muted);font-size:10px}
    .ruins-stat span i{color:var(--gold)}
    .ruins-stat strong{display:block;margin-top:7px;color:#fff;font-size:clamp(15px,2.3vw,21px);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
    .ruins-stat small{display:block;margin-top:3px;color:#918fac;font-size:9px}
    .ruins .progress-track{height:8px;margin:9px 0 3px;overflow:hidden;border-radius:99px;background:#36334e}
    .ruins .progress-fill{height:100%;border-radius:inherit;background:linear-gradient(90deg,#9a7ce7,#e2bd6b);transition:width .25s}
    .ruins button,.ruins select{font:inherit}
    .ruins button{border:1px solid #8065bd;border-radius:9px;padding:9px 12px;background:linear-gradient(135deg,#8064cf,#6344a8);color:#fff;font-size:11px;font-weight:800;cursor:pointer;transition:filter .15s,transform .15s}
    .ruins button:hover:not(:disabled){filter:brightness(1.12);transform:translateY(-1px)}
    .ruins button:disabled{opacity:.42;cursor:not-allowed}
    .ruins .button-secondary{border-color:#4d4a68;background:#29283e}
    .ruins .button-gold{border-color:#ae8951;background:linear-gradient(135deg,#bd914c,#876332)}
    .ruins .button-danger{border-color:#874f60;background:linear-gradient(135deg,#86475b,#633243)}
    .ruins .button-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
    .ruins .class-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
    .ruins .class-option{display:flex;min-height:115px;flex-direction:column;align-items:flex-start;gap:6px;padding:12px;border:1px solid #3c3956;border-radius:11px;background:#201f35;color:#e9e4fb;text-align:left}
    .ruins .class-option.active{border-color:#ac8ce6;background:#2c2641;box-shadow:0 0 0 1px #ac8ce633}
    .ruins .class-option i{color:#e3c176;font-size:18px}
    .ruins .class-option span{color:#aaa6c1;font-size:10px;font-weight:400;line-height:1.5}
    .ruins .class-locked{color:#948fa9;font-size:10px}
    .ruins-room{position:relative;overflow:hidden;min-height:232px;padding:20px;border:1px solid #50456b;border-radius:15px;background:radial-gradient(ellipse at 100% 0%,#8059b533,transparent 46%),linear-gradient(145deg,#222039,#19182d)}
    .ruins-room.boss{border-color:#975f67;background:radial-gradient(ellipse at 100% 0%,#bd4c573d,transparent 48%),linear-gradient(145deg,#30202e,#19182b)}
    .ruins-room h3{margin:7px 0;color:#fff;font-size:22px}
    .ruins-room p{color:#b9b4cc;font-size:12px;line-height:1.65}
    .ruins-room-meta{display:flex;gap:7px;flex-wrap:wrap;margin:10px 0}
    .ruins-room-meta span{padding:5px 8px;border-radius:7px;background:#302d46;color:#c8c2d8;font-size:10px}
    .ruins-health{display:flex;justify-content:space-between;color:#c8c2d8;font-size:10px}
    .ruins .health-track{height:10px;margin:5px 0 11px;overflow:hidden;border-radius:99px;background:#493344}
    .ruins .health-fill{height:100%;background:linear-gradient(90deg,#df6577,#eea26f);transition:width .2s}
    .ruins-battle-actions{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}
    .ruins-battle-actions button{min-height:42px;padding:8px 5px}
    .ruins-gear-list{display:grid;gap:9px}
    .ruins-gear{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px;border:1px solid #383650;border-radius:11px;background:#201f34}
    .ruins-gear h3{margin:0;color:#f3efff;font-size:12px}
    .ruins-gear p{margin:4px 0 0;color:#aaa6c1;font-size:10px;line-height:1.5}
    .ruins-notice{min-height:19px;margin-top:10px;color:#e7c77f;font-size:11px;line-height:1.5}
    .ruins-notice.error{color:#ff9ba8}
    .ruins-feed{display:grid;gap:7px}
    .ruins-feed-item{display:flex;justify-content:space-between;gap:8px;padding:9px 10px;border-bottom:1px solid #34324b;color:#cbc6da;font-size:10px}
    .ruins-feed-item small{color:#9691aa}
    .ruins-table-wrap{overflow:auto}
    .ruins-table{width:100%;min-width:430px;border-collapse:collapse}
    .ruins-table th,.ruins-table td{padding:9px 8px;border-bottom:1px solid #34324b;text-align:left;font-size:10px}
    .ruins-table th{color:#9792ad;font-size:9px}
    .ruins-table td{color:#e2deed}
    .ruins-score{color:#e9c56f!important;font-weight:800}
    .ruins-empty{padding:15px;border:1px dashed #484460;border-radius:10px;color:#9994ad;font-size:11px;text-align:center}
    .ruins .daily-card{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px;border:1px solid #7a6848;border-radius:12px;background:linear-gradient(110deg,#3b3027,#28253a)}
    .ruins .daily-card h3{margin:0 0 4px;color:#f6e6c4;font-size:12px}
    .ruins .daily-card p{margin:0;color:#c2b89e;font-size:10px;line-height:1.5}
    @media(max-width:850px){.ruins-grid{grid-template-columns:1fr}.ruins-stats{grid-template-columns:repeat(3,minmax(0,1fr))}.ruins-sigil{right:4%;opacity:.7}}
    @media(max-width:520px){.ruins-stats{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.ruins-stat{padding:10px}.ruins-hero{padding:22px 18px}.ruins-sigil{right:-36px;opacity:.3}.ruins .class-grid{grid-template-columns:1fr}.ruins .class-option{min-height:0}.ruins-battle-actions{grid-template-columns:repeat(2,minmax(0,1fr))}.ruins .daily-card{align-items:flex-start;flex-direction:column}.ruins .daily-card button{width:100%}}
`;

function gameMarkup(): string {
    return `
        <main class="ruins" id="ruinsGame">
            <section class="ruins-hero">
                <div class="ruins-hero-copy">
                    <div class="ruins-kicker">STARLIGHT CHRONICLES · ROGUELITE</div>
                    <h1>遗迹远征</h1>
                    <p>深入被星辉吞没的古老遗迹。选择职业、磨炼装备、应对随机房间与强大的守门者，在五间房的冒险中一步步攀登更深层的地城。</p>
                </div>
                <div class="ruins-sigil" aria-hidden="true"><i class="fas fa-dungeon"></i></div>
            </section>
            <section class="ruins-stats" id="ruinsStats"><div class="ruins-empty">正在读取冒险者档案…</div></section>
            <section class="ruins-panel">
                <div class="ruins-heading"><div><h2><i class="fas fa-scroll"></i> 每日悬赏</h2><p>补给每日刷新，连续登录可累积额外金币。</p></div><span class="ruins-label" id="ruinsStreak">连续 — 天</span></div>
                <div class="daily-card"><div><h3>领取远征补给</h3><p>金币、星晶、治疗药剂和 3 点体力。体力每小时恢复 1 点，上限 10 点。</p></div><button class="button-gold" id="ruinsDaily">领取补给</button></div>
            </section>
            <div class="ruins-grid">
                <section class="ruins-panel">
                    <div class="ruins-heading"><div><h2><i class="fas fa-door-open"></i> 当前远征</h2><p id="ruinsRunCaption">尚未进入遗迹。每次远征消耗 3 点体力，完成五个房间即可攻克当前层。</p></div><span class="ruins-label" id="ruinsRunBadge">准备中</span></div>
                    <div id="ruinsRoom"></div>
                    <div class="button-row" id="ruinsRunControls"></div>
                </section>
                <section class="ruins-panel">
                    <div class="ruins-heading"><div><h2><i class="fas fa-hammer"></i> 铁匠与药剂商</h2><p>用探索所得强化永久属性，带足药剂再深入遗迹。</p></div></div>
                    <div class="ruins-gear-list" id="ruinsGear"></div>
                </section>
            </div>
            <section class="ruins-panel">
                <div class="ruins-heading"><div><h2><i class="fas fa-trophy"></i> 冒险者榜</h2><p>综合等级、最深层数、击败怪物与完整通关次数。</p></div><span class="ruins-label">前 20 名</span></div>
                <div class="ruins-table-wrap" id="ruinsLeaderboard"></div>
            </section>
            <section class="ruins-panel">
                <div class="ruins-heading"><div><h2><i class="fas fa-book"></i> 远征记录</h2><p>追踪你最近的冒险与挑战进度。</p></div></div>
                <div class="ruins-feed" id="ruinsHistory"></div>
            </section>
            <div class="ruins-notice" id="ruinsNotice" role="status" aria-live="polite"></div>
        </main>
        <script>
        (function(){
            var state=null;
            var root=document.getElementById('ruinsGame');
            var notice=document.getElementById('ruinsNotice');
            function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];});}
            function num(value){return Number(value||0).toLocaleString('zh-CN');}
            function setNotice(text,error){notice.textContent=text||'';notice.className='ruins-notice'+(error?' error':'');}
            function statCard(icon,label,value,small){return '<div class="ruins-stat"><span><i class="fas '+icon+'"></i>'+label+'</span><strong>'+value+'</strong><small>'+small+'</small></div>';}
            function drawStats(){
                var p=state.player;
                var xp=Math.min(100,Math.floor(p.experience/p.next_level_xp*100));
                document.getElementById('ruinsStats').innerHTML=
                    statCard('fa-user-ninja',esc(p.class_name)+' · Lv.'+num(p.level),num(p.experience)+' / '+num(p.next_level_xp)+' XP','<div class="progress-track"><div class="progress-fill" style="width:'+xp+'%"></div></div>攻击 '+num(p.attack)+' · 防御 '+num(p.defense))+
                    statCard('fa-heart','生命上限',num(p.maxHp),'每次远征开始时恢复')+
                    statCard('fa-coins','金币',num(p.gold),'强化装备与购买药剂')+
                    statCard('fa-gem','星晶',num(p.crystals),'稀有装备强化材料')+
                    statCard('fa-bolt','远征体力',num(p.stamina)+' / '+num(p.stamina_cap),p.stamina>=p.stamina_cap?'体力已满':'每 '+num(p.stamina_recovery_minutes)+' 分钟恢复 1 点');
                document.getElementById('ruinsStreak').textContent='连续 '+num(p.daily_streak)+' 天';
                var daily=document.getElementById('ruinsDaily');
                daily.disabled=!p.can_claim_daily;
                daily.textContent=p.can_claim_daily?'领取今日补给':'今日已领取';
            }
            function drawClassSelector(){
                if(state.class_locked)return '';
                return '<div class="ruins-panel"><div class="ruins-heading"><div><h2><i class="fas fa-user-astronaut"></i> 选择你的职业</h2><p>首次进入遗迹前可自由更换，开始首次远征后职业将固定。</p></div></div><div class="class-grid">'+state.classes.map(function(c){
                    return '<button type="button" class="class-option'+(c.key===state.player.class_key?' active':'')+'" data-class="'+esc(c.key)+'"><i class="fas '+esc(c.icon)+'"></i><b>'+esc(c.name)+(c.key===state.player.class_key?' · 当前':'')+'</b><span>'+esc(c.description)+' 技能：'+esc(c.skill)+'</span></button>';
                }).join('')+'</div></div>';
            }
            function drawRoom(){
                var host=document.getElementById('ruinsRoom');
                var controls=document.getElementById('ruinsRunControls');
                var run=state.run;
                if(!run){
                    document.getElementById('ruinsRunCaption').textContent='尚未进入遗迹。每次远征消耗 '+state.run_stamina_cost+' 点体力，完成五个房间即可攻克当前层。';
                    document.getElementById('ruinsRunBadge').textContent='准备中';
                    host.innerHTML=drawClassSelector()+'<div class="ruins-room"><span class="ruins-label">下一挑战 · 第 '+num(Number(state.player.best_floor)+1)+' 层</span><h3>遗迹入口</h3><p>火把已经点亮，古老的石门正在等待新的冒险者。每层包含随机遭遇、宝藏、营地与神龛，并在第五个房间面对守门者。</p><div class="ruins-room-meta"><span>本层 5 个房间</span><span>体力消耗 '+num(state.run_stamina_cost)+'</span><span>携带药剂 '+num(state.player.potions)+' / 10</span></div></div>';
                    controls.innerHTML='<button type="button" class="button-gold" data-action="start" '+(state.player.stamina<state.run_stamina_cost?'disabled':'')+'><i class="fas fa-person-walking"></i> 开始远征</button>';
                    return;
                }
                var isBoss=run.monster_key==='guardian_boss';
                var roomName=run.room_type==='monster'?(isBoss?run.monster_name:'遭遇敌人：'+run.monster_name):({treasure:'发现一只遗迹宝箱',camp:'找到一处安静营地',shrine:'发现星辉神龛'}[run.room_type]||'未探索房间');
                document.getElementById('ruinsRunCaption').textContent='第 '+num(run.floor)+' 层 · 第 '+num(run.room)+' / '+state.room_limit+' 个房间';
                document.getElementById('ruinsRunBadge').textContent=isBoss?'首领战':'探索中';
                host.innerHTML='<div class="ruins-room'+(isBoss?' boss':'')+'"><span class="ruins-label">'+(isBoss?'⚔ 首领房间':'第 '+num(run.room)+' 号房间')+'</span><h3>'+esc(roomName)+'</h3>'+(
                    run.room_type==='monster'
                    ?'<div class="ruins-health"><span>敌人生命</span><span>'+num(run.monster_hp)+' / '+num(run.monster_max_hp)+'</span></div><div class="health-track"><div class="health-fill" style="width:'+Math.max(0,Math.min(100,run.monster_hp/run.monster_max_hp*100))+'%"></div></div><div class="ruins-health"><span>你的生命</span><span>'+num(run.hp)+' / '+num(state.player.maxHp)+'</span></div><div class="health-track"><div class="health-fill" style="width:'+Math.max(0,Math.min(100,run.hp/state.player.maxHp*100))+'%"></div></div><div class="ruins-room-meta"><span>敌方攻击 '+num(run.monster_attack)+'</span><span>'+esc(state.player.skill_name)+' 冷却 '+Math.max(0,run.skill_ready_turn-run.turn)+' 回合</span><span>药剂 '+num(state.player.potions)+'</span></div>'
                    :'<p>'+(run.room_type==='treasure'?'尘封的宝箱或许藏着金币与星晶，小心处理其中的古老机关。':run.room_type==='camp'?'短暂休息可以恢复伤势，也可以利用时间提升战斗经验。':'神龛中的星辉仍未消散，选择治愈或接受祝福。')+'</p><div class="ruins-room-meta"><span>你的生命 '+num(run.hp)+' / '+num(state.player.maxHp)+'</span><span>药剂 '+num(state.player.potions)+'</span></div>'
                )+'</div>';
                if(run.room_cleared){
                    controls.innerHTML='<button type="button" class="button-gold" data-action="advance">'+(run.room>=state.room_limit?'完成本层远征':'前往下一房间')+' <i class="fas fa-arrow-right"></i></button><button type="button" class="button-danger" data-action="retreat" data-turn="'+run.turn+'">立即撤退</button>';
                }else if(run.room_type==='monster'){
                    controls.innerHTML='<div class="ruins-battle-actions"><button type="button" data-action="attack" data-turn="'+run.turn+'"><i class="fas fa-khanda"></i> 普通攻击</button><button type="button" class="button-gold" data-action="skill" data-turn="'+run.turn+'" '+(run.turn<run.skill_ready_turn?'disabled':'')+'><i class="fas fa-wand-sparkles"></i> '+esc(state.player.skill_name)+'</button><button type="button" class="button-secondary" data-action="guard" data-turn="'+run.turn+'"><i class="fas fa-shield-halved"></i> 防御</button><button type="button" class="button-secondary" data-action="potion" data-turn="'+run.turn+'" '+(!state.player.potions||run.hp>=state.player.maxHp?'disabled':'')+'><i class="fas fa-flask"></i> 使用药剂</button></div><button type="button" class="button-danger" data-action="retreat" data-turn="'+run.turn+'">撤退（放弃本次远征）</button>';
                }else{
                    var options=run.room_type==='treasure'?[['treasure_open','打开宝箱'],['treasure_careful','小心拆解']]:run.room_type==='camp'?[['camp_rest','休息恢复'],['camp_train','训练技巧']]:[['shrine_heal','接受治愈'],['shrine_bless','接受祝福']];
                    controls.innerHTML=options.map(function(option){return '<button type="button" class="'+(option[0].endsWith('heal')||option[0].endsWith('rest')?'button-gold':'')+'" data-action="'+option[0]+'" data-turn="'+run.turn+'">'+esc(option[1])+'</button>';}).join('')+'<button type="button" class="button-danger" data-action="retreat" data-turn="'+run.turn+'">撤退</button>';
                }
            }
            function drawGear(){
                var p=state.player;
                var inRun=Boolean(state.run);
                var weaponNext=p.weapon_level>=25?'已达最高等级':'金币 '+num(p.weapon_cost)+' · 星晶 '+num(Math.floor(p.weapon_level/4));
                var armorNext=p.armor_level>=25?'已达最高等级':'金币 '+num(p.armor_cost)+' · 星晶 '+num(Math.floor(p.armor_level/4)+1);
                document.getElementById('ruinsGear').innerHTML=
                    '<article class="ruins-gear"><div><h3><i class="fas fa-khanda"></i> 星纹武器 · Lv.'+num(p.weapon_level)+'</h3><p>每级增加 3 点攻击。'+weaponNext+'</p></div><button data-action="upgrade-weapon" '+(inRun||p.weapon_cost===null?'disabled':'')+'>强化</button></article>'+
                    '<article class="ruins-gear"><div><h3><i class="fas fa-shield"></i> 守望护甲 · Lv.'+num(p.armor_level)+'</h3><p>每级增加 7 点生命上限与 2 点防御。'+armorNext+'</p></div><button data-action="upgrade-armor" '+(inRun||p.armor_cost===null?'disabled':'')+'>强化</button></article>'+
                    '<article class="ruins-gear"><div><h3><i class="fas fa-flask"></i> 治疗药剂 · '+num(p.potions)+' / 10</h3><p>战斗中恢复 42% 生命，购买价格 35 金币。</p></div><button class="button-secondary" data-action="buy-potion" '+(inRun||p.potions>=10?'disabled':'')+'>购买</button></article>';
            }
            function drawLists(){
                var rows=state.leaderboard||[];
                document.getElementById('ruinsLeaderboard').innerHTML=rows.length?'<table class="ruins-table"><thead><tr><th>排名</th><th>冒险者</th><th>等级</th><th>最深层</th><th>击败怪物</th><th>声望</th></tr></thead><tbody>'+rows.map(function(row,index){return '<tr><td>#'+(index+1)+'</td><td>'+esc(row.username)+(Number(row.user_id)===Number(state.player.user_id)?'（你）':'')+'</td><td>Lv.'+num(row.level)+'</td><td>'+num(row.best_floor)+'</td><td>'+num(row.defeated_monsters)+'</td><td class="ruins-score">'+num(row.score)+'</td></tr>';}).join('')+'</tbody></table>':'<div class="ruins-empty">榜单尚无冒险者，开始你的首次远征吧。</div>';
                var history=state.recent_runs||[];
                var statuses={completed:'成功通关',defeated:'冒险失败',retreated:'主动撤退',active:'进行中'};
                document.getElementById('ruinsHistory').innerHTML=history.length?history.map(function(row){return '<div class="ruins-feed-item"><span>第 '+num(row.floor)+' 层 · '+esc(statuses[row.status]||row.status)+'</span><small>'+esc(String(row.started_at||'').slice(0,16).replace('T',' '))+'</small></div>';}).join(''):'<div class="ruins-empty">还没有远征记录。</div>';
            }
            function draw(){
                drawStats();drawRoom();drawGear();drawLists();
            }
            async function load(){
                var response=await fetch('/api/ruins/state',{headers:{Accept:'application/json'}});
                var data=await response.json();
                if(!response.ok)throw new Error(data.error||'冒险档案加载失败');
                state=data;draw();
            }
            async function post(path,payload,button){
                if(button)button.disabled=true;
                setNotice('正在处理行动…',false);
                try{
                    var response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(payload||{})});
                    var data=await response.json();
                    if(!response.ok)throw new Error(data.error||'操作失败');
                    state=data.state;draw();setNotice(data.notice||'行动完成。',false);
                }catch(error){setNotice(error.message||'操作失败，请稍后重试。',true);}
                finally{
                    if(button&&button.isConnected){
                        button.disabled=button.id==='ruinsDaily'&&state
                            ?!state.player.can_claim_daily
                            :false;
                    }
                }
            }
            root.addEventListener('click',function(event){
                var button=event.target.closest('button[data-action],button[data-class]');
                if(!button||!root.contains(button))return;
                if(button.dataset.class){post('/api/ruins/class/select',{class:button.dataset.class},button);return;}
                var action=button.dataset.action;
                if(action==='start'){post('/api/ruins/run/start',{},button);return;}
                if(action==='advance'){post('/api/ruins/run/advance',{turn:state.run.turn},button);return;}
                if(action==='retreat'){post('/api/ruins/run/retreat',{turn:Number(button.dataset.turn)},button);return;}
                if(action==='upgrade-weapon'||action==='upgrade-armor'){post('/api/ruins/gear/upgrade',{kind:action==='upgrade-weapon'?'weapon':'armor'},button);return;}
                if(action==='buy-potion'){post('/api/ruins/shop/potion',{},button);return;}
                if(action==='daily'){post('/api/ruins/daily/claim',{},button);return;}
                post('/api/ruins/run/action',{action:action,turn:Number(button.dataset.turn)},button);
            });
            document.getElementById('ruinsDaily').dataset.action='daily';
            load().catch(function(error){setNotice(error.message||'冒险档案暂不可用。',true);});
        }());
        </script>`;
}

export async function renderRuins(env: Env, request: Request): Promise<string> {
    const user = await getSessionUser(env, request);
    if (!user) {
        const content = `<div class="page-header"><h1><i class="fas fa-dungeon"></i> 遗迹远征</h1><p>选择职业，深入古代地城，挑战遗迹守门者。</p></div><div class="card"><a href="/login?redirect=%2Fruins">登录以开始冒险</a></div>`;
        return getLayout(env, user, '遗迹远征', content, RUINS_STYLES, request);
    }
    return getLayout(env, user, '遗迹远征', gameMarkup(), RUINS_STYLES, request);
}
