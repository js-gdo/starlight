import { getSessionUser } from '../utils/auth';
import { getLayout } from '../utils/layout';
import type { Env } from '../env.d';

const STATION_STYLES = `
    .station{--ink:#eff6ff;--muted:#a5b5ca;--line:#2b415a;--cyan:#73e2e1;--gold:#f3cb7b;color:var(--ink)}
    .station-hero{position:relative;overflow:hidden;padding:clamp(24px,5vw,44px);border:1px solid #42627a;border-radius:22px;background:radial-gradient(ellipse at 82% 8%,#58dce02e,transparent 38%),radial-gradient(ellipse at 10% 110%,#5071bf36,transparent 48%),linear-gradient(125deg,#101a2a,#18364a 56%,#15243a);box-shadow:0 20px 54px #09111d66}
    .station-hero-copy{position:relative;z-index:1;max-width:670px}
    .station-kicker{color:var(--cyan);font-size:10px;font-weight:900;letter-spacing:.22em}
    .station-hero h1{margin:9px 0;color:#fff;font-size:clamp(30px,6vw,46px)}
    .station-hero p{max-width:590px;margin:0;color:#c1d0df;line-height:1.75}
    .station-orbit{position:absolute;right:8%;top:50%;display:grid;width:clamp(125px,22vw,205px);aspect-ratio:1;place-items:center;transform:translateY(-50%);border:1px solid #8fe1dc55;border-radius:50%;color:#d5ffff;font-size:clamp(42px,8vw,68px);box-shadow:0 0 55px #56cedc24,inset 0 0 44px #61d8e017}
    .station-orbit:before,.station-orbit:after{position:absolute;inset:20% -24%;border:1px solid #a2b1ff55;border-radius:50%;content:"";transform:rotate(-35deg)}
    .station-orbit:after{inset:31% -30%;transform:rotate(38deg)}
    .station-stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px;margin:13px 0}
    .station-stat{min-width:0;padding:13px;border:1px solid var(--line);border-radius:12px;background:linear-gradient(145deg,#192c40,#142033)}
    .station-stat span{display:flex;align-items:center;gap:7px;color:var(--muted);font-size:10px}
    .station-stat span i{color:var(--cyan)}
    .station-stat strong{display:block;margin-top:7px;color:#fff;font-size:clamp(16px,2.5vw,23px);font-variant-numeric:tabular-nums}
    .station-stat small{display:block;margin-top:3px;color:#879bb1;font-size:9px}
    .station-track{height:7px;margin-top:8px;overflow:hidden;border-radius:99px;background:#34465b}
    .station-track i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#56caba,#8ce4d4);transition:width .25s}
    .station-section{margin-top:14px;padding:clamp(15px,3vw,22px);border:1px solid var(--line);border-radius:16px;background:linear-gradient(145deg,#17283b,#111d2e);box-shadow:0 10px 30px #09111e44}
    .station-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:13px}
    .station-heading h2{margin:0;color:#f5f8ff;font-size:17px}
    .station-heading p{margin:4px 0 0;color:var(--muted);font-size:11px;line-height:1.55}
    .station-pill{display:inline-flex;padding:5px 9px;border:1px solid #3a566c;border-radius:99px;background:#1d3146;color:#b6dce0;font-size:10px;white-space:nowrap}
    .station-visual{overflow:auto;border:1px solid #2b4057;border-radius:13px;background:radial-gradient(ellipse at center,#1c3a4c,#111d2f)}
    .station-svg{display:block;width:100%;min-width:530px;height:auto}
    .station-panel-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,.7fr);gap:14px;margin-top:14px;align-items:start}
    .station-exchange{margin-top:14px;padding:18px;border:1px solid #294454;border-radius:15px;background:linear-gradient(140deg,#142734,#121a2b)}
    .station-exchange-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
    .station-exchange h2{margin:0;color:#f2fbff;font-size:16px}
    .station-exchange p{margin:5px 0;color:#9fb7c3;font-size:11px;line-height:1.5}
    .station-exchange-controls{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:10px}
    .station-exchange input{width:130px;padding:9px 10px;border:1px solid #385568;border-radius:8px;background:#111d2c;color:#effaff;font:inherit;font-size:11px}
    .station-exchange button{padding:9px 12px;border:1px solid #438a91;border-radius:9px;background:linear-gradient(135deg,#2c8589,#375a9c);color:#fff;font:inherit;font-size:11px;font-weight:800;cursor:pointer}
    .station-exchange button:disabled{opacity:.45;cursor:not-allowed}
    .station-exchange-rate{margin-top:8px;color:#8faab8;font-size:10px}
    .station-panel-grid .station-section{margin-top:0}
    .station-components{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
    .station-component{padding:12px;border:1px solid #30445a;border-radius:12px;background:linear-gradient(145deg,#1a2b40,#142136)}
    .station-component-head{display:flex;align-items:center;gap:9px}
    .station-component-icon{display:grid;flex:0 0 36px;width:36px;height:36px;place-items:center;border:1px solid #476679;border-radius:11px;background:#20394b;color:#9ce5e0}
    .station-component h3{margin:0;color:#f3f7ff;font-size:12px}
    .station-component small{display:block;margin-top:3px;color:#9aaec1;font-size:9px}
    .station-component p{min-height:31px;margin:8px 0;color:#a9b7c8;font-size:9px;line-height:1.55}
    .station-component-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;color:#c0d0de;font-size:9px}
    .station button{border:1px solid #398d93;border-radius:8px;padding:8px 10px;background:linear-gradient(135deg,#287e86,#265f80);color:#fff;font:inherit;font-size:10px;font-weight:800;cursor:pointer;transition:filter .15s,transform .15s}
    .station button:hover:not(:disabled){filter:brightness(1.12);transform:translateY(-1px)}
    .station button:disabled{opacity:.42;cursor:not-allowed}
    .station .station-gold{border-color:#a4824a;background:linear-gradient(135deg,#b98d49,#80613b)}
    .station .station-secondary{border-color:#485d73;background:linear-gradient(135deg,#364b60,#28384c)}
    .station-contract{padding:14px;border:1px solid #6b6148;border-radius:12px;background:linear-gradient(110deg,#3b3428,#213247)}
    .station-contract h3{margin:0 0 5px;color:#f4e4bd;font-size:13px}
    .station-contract p{margin:0;color:#c6bea5;font-size:10px;line-height:1.55}
    .station-contract button{margin-top:11px}
    .station-maintenance{margin-top:9px;padding:13px;border:1px solid #34495e;border-radius:12px;background:#19283a}
    .station-maintenance h3{margin:0;color:#e9f1f8;font-size:12px}
    .station-maintenance p{margin:5px 0 10px;color:#a5b4c6;font-size:10px;line-height:1.55}
    .station-feedback{min-height:19px;margin-top:10px;color:#92e2c9;font-size:11px}
    .station-feedback.error{color:#ff9ba5}
    .station-empty{padding:15px;border:1px dashed #40556b;border-radius:10px;color:#9bacc0;font-size:10px;text-align:center}
    @media(max-width:850px){.station-stats{grid-template-columns:repeat(3,minmax(0,1fr))}.station-panel-grid{grid-template-columns:1fr}.station-orbit{right:4%;opacity:.6}}
    @media(max-width:540px){.station-stats{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.station-stat{padding:10px}.station-hero{padding:22px 18px}.station-orbit{right:-35px;opacity:.3}.station-components{grid-template-columns:1fr}}
`;

function stationMarkup(): string {
    return `
        <main class="station" id="stationGame">
            <section class="station-hero">
                <div class="station-hero-copy">
                    <div class="station-kicker">STARLIGHT ORBITAL · STATION COMMAND</div>
                    <h1>空间站管理</h1>
                    <p>建设发电阵列、生命维持舱和深空实验室，维持电力与生态平衡。空间站每小时离线运行，失去电力会导致环境恶化。</p>
                </div>
                <div class="station-orbit" aria-hidden="true"><i class="fas fa-satellite"></i></div>
            </section>
            <section class="station-stats" id="stationStats"><div class="station-empty">正在读取空间站数据…</div></section>
            <section class="station-exchange">
                <div class="station-exchange-head"><div><h2><i class="fas fa-right-left"></i> 社区积分兑换</h2><p>每 10 积分兑换 20 建设星币，每次最多兑换 2,000 积分。</p></div><span class="station-pill" id="stationPointBalance">积分 —</span></div>
                <div class="station-exchange-controls"><input id="stationExchangePoints" type="number" min="10" max="2000" step="10" value="100" aria-label="投入社区积分"><button type="button" id="stationExchangeButton">兑换建设星币</button></div>
                <div class="station-exchange-rate" id="stationExchangeRate">输入积分查看预计到账星币。</div>
            </section>
            <section class="station-section">
                <div class="station-heading"><div><h2><i class="fas fa-diagram-project"></i> 站体能源与环境网络</h2><p>电池显示实时储能，右侧标注每小时收支；环境组件在有电时自动运作。</p></div><span class="station-pill" id="stationOffline">离线结算</span></div>
                <div class="station-visual"><svg class="station-svg" id="stationDiagram" viewBox="0 0 900 260" role="img" aria-label="空间站能源与生命维持系统示意图"></svg></div>
            </section>
            <div class="station-panel-grid">
                <section class="station-section">
                    <div class="station-heading"><div><h2><i class="fas fa-screwdriver-wrench"></i> 组件建造</h2><p>组件价格随同类设施数量提升，每种最多建造 5 个。</p></div><span class="station-pill" id="stationCredits">星币 —</span></div>
                    <div class="station-components" id="stationComponents"></div>
                </section>
                <section class="station-section">
                    <div class="station-heading"><div><h2><i class="fas fa-clipboard-check"></i> 维护任务</h2><p>保持站体稳定，完成每日合同获取建设资金和科技值。</p></div></div>
                    <div class="station-contract"><h3>每日稳定运行合同</h3><p id="stationContractText">空间站综合状态达到 60 即可领取奖励。</p><button type="button" class="station-gold" id="stationContract">领取合同奖励</button></div>
                    <div class="station-maintenance"><h3><i class="fas fa-screwdriver-wrench"></i> 应急维护</h3><p>花费 75 星币修复站体、补充电池并恢复氧气和整洁度。</p><button type="button" class="station-secondary" id="stationMaintain">执行维护</button></div>
                </section>
            </div>
            <div class="station-feedback" id="stationFeedback" role="status" aria-live="polite"></div>
        </main>
        <script>
        (function(){
            var state=null;
            var root=document.getElementById('stationGame');
            var feedback=document.getElementById('stationFeedback');
            var exchangePoints=document.getElementById('stationExchangePoints');
            function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];});}
            function num(value){return Number(value||0).toLocaleString('zh-CN');}
            function notice(text,error){feedback.textContent=text||'';feedback.className='station-feedback'+(error?' error':'');}
            function updateExchangePreview(){
                var points=Number(exchangePoints.value)||0;
                document.getElementById('stationExchangeRate').textContent=Number.isSafeInteger(points)&&points>=10&&points<=2000&&points%10===0
                    ?'本次消耗 '+num(points)+' 积分，可获得 '+num(points*2)+' 建设星币。'
                    :'积分必须是 10 的倍数，且每次不超过 2,000。';
            }
            function meter(icon,label,value,detail,max,unit){var percent=Math.max(0,Math.min(100,Number(value)/Number(max||100)*100));return '<div class="station-stat"><span><i class="fas '+icon+'"></i>'+label+'</span><strong>'+num(value)+(unit===undefined?(label==='科技值'?'':'%'):unit)+'</strong><div class="station-track"><i style="width:'+percent+'%"></i></div><small>'+detail+'</small></div>';}
            function draw(){
                var p=state.player,r=state.rates;
                document.getElementById('stationStats').innerHTML=
                    meter('fa-bolt','电池电量',p.battery,'容量 '+num(p.battery_capacity)+' · '+(r.power>=0?'+':'')+num(r.power)+' / 小时',p.battery_capacity,' / '+num(p.battery_capacity))+
                    meter('fa-wind','氧气环境',p.oxygen,(r.oxygen>=0?'+':'')+num(r.oxygen)+' / 小时')+
                    meter('fa-broom','整洁度',p.cleanliness,(r.cleanliness>=0?'+':'')+num(r.cleanliness)+' / 小时')+
                    meter('fa-shield-halved','结构完整度',p.integrity,'综合状态 '+num(p.condition))+
                    meter('fa-microchip','科技值',p.technology,'实验室每小时产出 '+num(r.technology),100,'');
                document.getElementById('stationCredits').textContent='建设星币 '+num(p.credits);
                document.getElementById('stationPointBalance').textContent='可用积分 '+num(p.community_points);
                document.getElementById('stationOffline').textContent='离线模拟最多 '+state.max_offline_hours+' 小时';
                var contract=document.getElementById('stationContract');
                contract.disabled=!p.can_claim_contract||p.condition<60;
                contract.textContent=p.can_claim_contract?'领取 '+num(state.contract_reward)+' 星币 + 3 科技':'今日合同已领取';
                document.getElementById('stationContractText').textContent=p.can_claim_contract
                    ?'综合状态 '+num(p.condition)+' / 100；达到 60 可领取 '+num(state.contract_reward)+' 星币和 3 科技值。'
                    :'今日维护合同已完成，明天再回来领取。';
                document.getElementById('stationMaintain').disabled=p.credits<75||
                    (Number(p.battery)>=Number(p.battery_capacity)&&Number(p.oxygen)>=100&&Number(p.cleanliness)>=100&&Number(p.integrity)>=100);
                drawDiagram();
                document.getElementById('stationComponents').innerHTML=state.components.map(function(c){
                    var impact='电力 '+(c.power>0?'+':'')+num(c.power)+' /h · 氧气 '+(c.air>0?'+':'')+num(c.air)+' /h · 整洁 '+(c.cleaning>0?'+':'')+num(c.cleaning)+' /h';
                    return '<article class="station-component"><div class="station-component-head"><span class="station-component-icon"><i class="fas '+esc(c.icon)+'"></i></span><div><h3>'+esc(c.name)+'</h3><small>已建造 '+num(c.quantity)+' / '+num(c.max_quantity)+'</small></div></div><p>'+esc(c.description)+'</p><div class="station-component-foot"><span>'+impact+'</span><button type="button" data-build="'+esc(c.key)+'" '+(c.quantity>=c.max_quantity||p.credits<c.cost?'disabled':'')+'>建造 · '+num(c.cost)+'</button></div></article>';
                }).join('');
            }
            function drawDiagram(){
                var p=state.player;
                var pct=Math.max(0,Math.min(100,Number(p.battery)/Number(p.battery_capacity)*100));
                document.getElementById('stationDiagram').innerHTML='<defs><linearGradient id="stationCore" x1="0" x2="1"><stop stop-color="#176d82"/><stop offset="1" stop-color="#474d91"/></linearGradient></defs><path d="M210 130H690M450 65v130M450 83 290 52M450 83 610 52M450 177 290 208M450 177 610 208" stroke="#52798b" stroke-width="3" stroke-dasharray="7 6"/><circle cx="450" cy="130" r="67" fill="#1a3046" stroke="#6eddda" stroke-width="2"/><circle cx="450" cy="130" r="51" fill="url(#stationCore)" opacity=".9"/><text x="450" y="122" text-anchor="middle" fill="#fff" font-size="13" font-weight="700">星港空间站</text><text x="450" y="145" text-anchor="middle" fill="#baf8ed" font-size="11">综合状态 '+num(p.condition)+'%</text><g><circle cx="210" cy="130" r="33" fill="#1b3b48" stroke="#74d8c7"/><text x="210" y="126" text-anchor="middle" fill="#cbf8e5" font-size="10">电池</text><text x="210" y="143" text-anchor="middle" fill="#fff" font-size="10">'+num(p.battery)+' / '+num(p.battery_capacity)+'</text></g><g><circle cx="690" cy="130" r="33" fill="#22354c" stroke="#82c9df"/><text x="690" y="126" text-anchor="middle" fill="#c9f0ff" font-size="10">科技值</text><text x="690" y="143" text-anchor="middle" fill="#fff" font-size="10">'+num(p.technology)+'</text></g><g><rect x="106" y="31" width="112" height="42" rx="10" fill="#192d42" stroke="#4d7185"/><text x="162" y="49" text-anchor="middle" fill="#b9d5e1" font-size="10">氧气环境</text><text x="162" y="64" text-anchor="middle" fill="#fff" font-size="11">'+num(p.oxygen)+'%</text></g><g><rect x="682" y="31" width="112" height="42" rx="10" fill="#192d42" stroke="#4d7185"/><text x="738" y="49" text-anchor="middle" fill="#b9d5e1" font-size="10">整洁度</text><text x="738" y="64" text-anchor="middle" fill="#fff" font-size="11">'+num(p.cleanliness)+'%</text></g><g><rect x="106" y="187" width="112" height="42" rx="10" fill="#192d42" stroke="#4d7185"/><text x="162" y="205" text-anchor="middle" fill="#b9d5e1" font-size="10">结构完整度</text><text x="162" y="220" text-anchor="middle" fill="#fff" font-size="11">'+num(p.integrity)+'%</text></g><g><rect x="682" y="187" width="112" height="42" rx="10" fill="#192d42" stroke="#4d7185"/><text x="738" y="205" text-anchor="middle" fill="#b9d5e1" font-size="10">能源余量</text><text x="738" y="220" text-anchor="middle" fill="#fff" font-size="11">'+(pct<25?'需要扩建':'稳定运行')+'</text></g>';
            }
            async function load(){
                var response=await fetch('/api/space-station/state',{headers:{Accept:'application/json'}});
                var data=await response.json();
                if(!response.ok)throw new Error(data.error||'空间站数据暂不可用');
                state=data;draw();
            }
            async function post(path,payload,button){
                if(button)button.disabled=true;
                notice('正在提交空间站指令…',false);
                try{
                    var response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(payload||{})});
                    var data=await response.json();
                    if(!response.ok)throw new Error(data.error||'操作失败');
                    state=data.state;draw();notice(data.notice||'空间站数据已更新。',false);
                }catch(error){notice(error.message||'操作失败，请稍后重试。',true);}
                finally{if(button&&button.isConnected)button.disabled=false;}
            }
            root.addEventListener('click',function(event){
                var button=event.target.closest('button[data-build],#stationMaintain,#stationContract,#stationExchangeButton');
                if(!button||!root.contains(button))return;
                if(button.dataset.build){post('/api/space-station/component/build',{component:button.dataset.build},button);return;}
                if(button.id==='stationMaintain'){post('/api/space-station/maintenance',{},button);return;}
                if(button.id==='stationContract'){post('/api/space-station/contract/claim',{},button);return;}
                if(button.id==='stationExchangeButton')post('/api/space-station/exchange',{resource:'credits',points:Number(exchangePoints.value)},button);
            });
            exchangePoints.addEventListener('input',updateExchangePreview);
            updateExchangePreview();
            load().catch(function(error){notice(error.message||'空间站初始化失败。',true);});
            window.setInterval(function(){load().catch(function(error){notice(error.message||'空间站刷新失败。',true);});},60000);
        }());
        </script>`;
}

export async function renderSpaceStation(env: Env, request: Request): Promise<string> {
    const user = await getSessionUser(env, request);
    if (!user) {
        const content = `<div class="page-header"><h1><i class="fas fa-satellite"></i> 空间站管理</h1><p>建设设施，维持电力、氧气和空间站环境。</p></div><div class="card"><a href="/login?redirect=%2Fspace-station">登录以管理空间站</a></div>`;
        return getLayout(env, user, '空间站管理', content, STATION_STYLES, request);
    }
    return getLayout(env, user, '空间站管理', stationMarkup(), STATION_STYLES, request);
}
