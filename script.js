(() => {
  'use strict';
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const world = $('#world'), ctx = world.getContext('2d');
  const eventCanvas = $('#event-layer'), fx = eventCanvas.getContext('2d');
  const state = {
    screen:'boot', started:false, paused:false, spectrum:false, found:[],
    pointer:{x:.5,y:.5,tx:.5,ty:.5,active:false}, startTime:0, enterTime:0,
    gazeTime:0, hesitation:0, lastFrame:0, dpr:1, reduced:matchMedia('(prefers-reduced-motion:reduce)').matches,
    burn:0, breachLines:[], audio:null, muted:false, signalPulse:0
  };
  const signals = [
    {x:.37,y:.39,label:'生物电回声',tone:261.63},
    {x:.66,y:.55,label:'逆向热源',tone:329.63},
    {x:.48,y:.69,label:'未知语言',tone:392.00}
  ];
  const bootData = [
    ['01','定位观察节点','STABLE'],['02','建立低频链路','STABLE'],['03','载入光学记录','STABLE'],
    ['04','映射表层结构','STABLE'],['05','校准凝视追踪','STABLE'],['06','检测自主运动','NONE'],
    ['07','载入显影频谱','STABLE'],['08','隔离外部信号','FAILED'],['09','验证观察者身份','UNKNOWN'],['10','开放观察窗口','READY']
  ];

  function resize(){
    state.dpr=Math.min(devicePixelRatio||1, innerWidth<700?1.5:2);
    for(const c of [world,eventCanvas]){c.width=Math.round(innerWidth*state.dpr);c.height=Math.round(innerHeight*state.dpr);c.style.width=innerWidth+'px';c.style.height=innerHeight+'px'}
    ctx.setTransform(state.dpr,0,0,state.dpr,0,0);fx.setTransform(state.dpr,0,0,state.dpr,0,0);
  }
  addEventListener('resize',resize); resize();

  function screen(name){
    state.screen=name;
    $$('[data-screen]').forEach(el=>el.classList.toggle('is-active',el.dataset.screen===name));
  }

  function boot(){
    const records=$('[data-boot-records]'); records.innerHTML='';
    let i=0, progress=0; const total=bootData.length;
    const next=()=>{
      if(state.screen!=='boot')return;
      if(i>=total){setTimeout(()=>{if(state.screen==='boot')screen('brief')},550);return}
      const row=bootData[i], el=document.createElement('div');
      el.className='boot-line'+(row[2]==='FAILED'||row[2]==='UNKNOWN'?' is-warn':'');
      el.innerHTML=`<i>${row[0]}</i><b>${row[1]}</b><span class="pulse"></span><em>${row[2]}</em>`;
      records.appendChild(el); i++; progress=Math.round(i/total*100);
      $('[data-boot-progress]').style.width=progress+'%'; $('[data-boot-percent]').textContent=String(progress).padStart(3,'0')+'%';
      const delay=i<4?180:i<8?150:230; setTimeout(next,delay);
    }; next();
  }
  $('[data-skip-boot]').addEventListener('click',()=>screen('brief'));

  function unlockAudio(){
    if(state.audio)return;
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
    const ac=new AC(), master=ac.createGain();master.gain.value=.16;master.connect(ac.destination);
    state.audio={ac,master};
  }
  function tone(freq=220,dur=.18,type='sine',vol=.18,delay=0){
    if(!state.audio||state.muted)return;const {ac,master}=state.audio;
    const o=ac.createOscillator(),g=ac.createGain(),t=ac.currentTime+delay;o.type=type;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(30,freq*.72),t+dur);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.018);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g);g.connect(master);o.start(t);o.stop(t+dur+.02);
  }
  function chord(){[130.81,196,261.63].forEach((f,i)=>tone(f,.8,'sine',.1,i*.08))}

  $('[data-enter]').addEventListener('click',()=>{
    unlockAudio();chord();state.started=true;state.enterTime=performance.now();state.startTime=state.enterTime;screen('lab');
    setTimeout(()=>setObjective('移动鼠标或手指，靠近样本'),400);
  });

  function setObjective(text){$('[data-objective]').textContent=text}
  function setMode(force){
    if(state.screen!=='lab'||state.paused)return;
    state.spectrum=typeof force==='boolean'?force:!state.spectrum;document.body.classList.toggle('is-spectrum',state.spectrum);
    $('[data-mode]').setAttribute('aria-pressed',String(state.spectrum));
    $('[data-mode-name]').textContent=state.spectrum?'显影频谱':'观察频谱';
    $('[data-mode-note]').textContent=state.spectrum?'不可见光 / 内层回声':'可见光 / 表层信息';
    setObjective(state.spectrum?'移动视线，点击正在脉动的异常点':'切换至显影频谱，寻找隐藏信号');
    tone(state.spectrum?420:210,.23,'triangle',.14);
  }
  $('[data-mode]').addEventListener('click',()=>setMode());
  addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();setMode()}if(e.code==='Escape'&&state.screen==='lab')togglePause()});

  function pointerMove(e){
    if(state.paused||state.screen!=='lab')return;
    const p=e.touches?e.touches[0]:e;if(!p)return;
    state.pointer.tx=Math.max(0,Math.min(1,p.clientX/innerWidth));state.pointer.ty=Math.max(0,Math.min(1,p.clientY/innerHeight));state.pointer.active=true;
    const r=$('[data-reticle]');r.style.left=p.clientX+'px';r.style.top=p.clientY+'px';
  }
  const lab=$('[data-screen="lab"]');
  lab.addEventListener('pointermove',pointerMove);lab.addEventListener('pointerdown',e=>{if(e.target.closest('button,a'))return;pointerMove(e);trySignal(e.clientX,e.clientY)});
  function signalScreenPos(sig){
    const cx=innerWidth*.52,cy=innerHeight*.49;
    const radius=Math.min(innerWidth,innerHeight)*(innerWidth<700?.29:.31);
    const mx=innerWidth<700?3.05:1.55,my=innerWidth<700?2.65:1.45;
    return{x:cx+(sig.x-.5)*radius*mx,y:cy+(sig.y-.5)*radius*my};
  }
  function trySignal(x,y){
    if(!state.spectrum||state.found.length>=3)return;
    let best=-1,dist=Infinity;signals.forEach((s,i)=>{if(state.found.includes(i))return;const p=signalScreenPos(s),d=Math.hypot(x-p.x,y-p.y);if(d<dist){dist=d;best=i}});
    const threshold=innerWidth<700?54:42;if(best>=0&&dist<threshold)findSignal(best);
  }
  function findSignal(i){
    state.found.push(i);state.signalPulse=1;tone(signals[i].tone,.55,'sine',.22);tone(signals[i].tone*2,.38,'triangle',.08,.08);
    const slot=$(`[data-signal-slot="${state.found.length-1}"]`);slot.classList.add('is-found');slot.querySelector('b').textContent=signals[i].label;
    if(state.found.length<3)setObjective(`已捕获 ${state.found.length}/3 —— 继续扫描`);
    else{setObjective('信号形成了完整句子');setTimeout(startBreach,1250)}
  }

  function togglePause(force){
    state.paused=typeof force==='boolean'?force:!state.paused;const p=$('[data-pause-panel]');p.classList.toggle('is-open',state.paused);p.setAttribute('aria-hidden',String(!state.paused));
  }
  $('[data-pause]').addEventListener('click',()=>togglePause());$('[data-resume]').addEventListener('click',()=>togglePause(false));
  $('[data-reduce-motion]').addEventListener('click',e=>{state.reduced=!state.reduced;document.body.classList.toggle('reduced-motion',state.reduced);e.currentTarget.textContent='动态效果：'+(state.reduced?'精简':'完整')});
  function restart(){location.reload()} $$('[data-restart],[data-pause-restart],[data-result-restart]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();restart()}));
  $('[data-mute]').addEventListener('click',e=>{state.muted=!state.muted;e.currentTarget.textContent='声音：'+(state.muted?'关':'开')});

  function startBreach(){
    if(state.screen!=='lab')return;state.hesitation=(performance.now()-state.enterTime)/1000;state.burn=.001;document.body.classList.add('is-burning');screen('breach');
    const lines=['03/03 SIGNALS COMBINED','DECODING…','MESSAGE: 不是你在观察它','GAZE DIRECTION: OUTWARD','OBSERVER IDENTITY EXPOSED','CONTAINMENT FAILURE'];
    const box=$('[data-breach-lines]');box.innerHTML='';lines.forEach((line,i)=>setTimeout(()=>{const d=document.createElement('div');d.textContent='> '+line;box.appendChild(d);tone(90+i*22,.28,'square',.08)},i*280));
    setTimeout(()=>tone(52,2.8,'sawtooth',.14),700);setTimeout(showResult,state.reduced?900:3900);
  }
  function showResult(){
    document.body.classList.remove('is-burning');screen('result');
    const t=(performance.now()-state.startTime)/1000,id=Math.floor(1000+Math.random()*8999);
    $('[data-result-id]').textContent=id;$('[data-gaze-time]').textContent=t.toFixed(1)+' 秒';$('[data-hesitation]').textContent=Math.min(state.hesitation,t).toFixed(1)+' 秒';
    const type=t<25?'直觉闯入者':t<55?'快速解码者':t<95?'耐心接近者':'长期凝视者';$('[data-observer-type]').textContent=type;state.result={id,t,type};
    chord();
  }
  $('[data-copy-result]').addEventListener('click',async e=>{const r=state.result||{id:'047',type:'观察者',t:0};const text=`未知样本 047 / 观测报告 ${r.id}\n类型：${r.type}\n被注视时间：${r.t.toFixed(1)} 秒\n结论：我没有发现样本，样本发现了我。\n${location.href}`;try{await navigator.clipboard.writeText(text);e.currentTarget.textContent='已复制观测结果 ✓'}catch{e.currentTarget.textContent='复制失败，请截屏保存'}});

  function drawGrid(w,h,time){
    ctx.strokeStyle=state.spectrum?'rgba(255,75,34,.10)':'rgba(233,230,218,.08)';ctx.lineWidth=1;const gap=70;
    ctx.beginPath();for(let x=(time*.008)%gap;x<w;x+=gap){ctx.moveTo(x,0);ctx.lineTo(x,h)}for(let y=(time*.004)%gap;y<h;y+=gap){ctx.moveTo(0,y);ctx.lineTo(w,y)}ctx.stroke();
  }
  function organicPoint(a,t,base){const wobble=1+Math.sin(a*3+t*.0007)*.055+Math.cos(a*7-t*.00033)*.025;return base*wobble}
  function drawSpecimen(w,h,t){
    const px=state.pointer.x,py=state.pointer.y,cx=w*.52+(px-.5)*-40,cy=h*.49+(py-.5)*-30;
    const R=Math.min(w,h)*(w<700?.29:.31);ctx.save();ctx.translate(cx,cy);
    // orbit and measurement geometry
    ctx.strokeStyle=state.spectrum?'rgba(255,75,34,.34)':'rgba(216,255,56,.25)';ctx.lineWidth=1;
    for(let i=0;i<3;i++){ctx.save();ctx.rotate(t*.00004*(i+1)+(i*Math.PI/3));ctx.scale(1,.32+i*.09);ctx.beginPath();ctx.arc(0,0,R*(1.25+i*.08),0,Math.PI*2);ctx.stroke();ctx.restore()}
    // aura
    const g=ctx.createRadialGradient(0,0,R*.1,0,0,R*1.2);g.addColorStop(0,state.spectrum?'rgba(255,75,34,.18)':'rgba(216,255,56,.18)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,R*1.25,0,Math.PI*2);ctx.fill();
    // organic body
    ctx.beginPath();for(let i=0;i<=120;i++){const a=i/120*Math.PI*2,r=organicPoint(a,t,R);const x=Math.cos(a)*r,y=Math.sin(a)*r*.92;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.closePath();
    const body=ctx.createRadialGradient(-R*.28,-R*.36,R*.08,0,0,R);body.addColorStop(0,state.spectrum?'#f9a342':'#efff91');body.addColorStop(.38,state.spectrum?'#ff4b22':'#d8ff38');body.addColorStop(1,state.spectrum?'#301007':'#354a0b');ctx.fillStyle=body;ctx.fill();ctx.strokeStyle='rgba(233,230,218,.5)';ctx.stroke();
    // internal contour
    ctx.globalAlpha=state.spectrum?.85:.16;for(let k=0;k<8;k++){ctx.beginPath();const rr=R*(.16+k*.09);for(let i=0;i<=80;i++){const a=i/80*Math.PI*2,r=organicPoint(a,t+k*380,rr);const x=Math.cos(a)*r,y=Math.sin(a)*r*.9;if(!i)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.closePath();ctx.strokeStyle=state.spectrum?'rgba(8,10,8,.45)':'rgba(8,10,8,.36)';ctx.stroke()}ctx.globalAlpha=1;
    // eye opens based on proximity
    const d=Math.hypot(px-.52,py-.49),near=d<.19;$('.proximity').classList.toggle('is-visible',near&&state.found.length<3);$('[data-response]').textContent=near?'跟随':'微弱';
    const open=near?Math.min(1,(.19-d)*8):.06;ctx.save();ctx.translate((px-.5)*R*.22,(py-.5)*R*.16);ctx.scale(1,Math.max(.05,open));ctx.beginPath();ctx.ellipse(0,0,R*.29,R*.14,0,0,Math.PI*2);ctx.fillStyle='#080a08';ctx.fill();ctx.beginPath();ctx.arc((px-.5)*R*.12,(py-.5)*R*.08,R*.065,0,Math.PI*2);ctx.fillStyle=state.spectrum?'#d8ff38':'#ff4b22';ctx.fill();ctx.restore();if(near)state.gazeTime+=.016;
    ctx.restore();
    // signals live in screen space
    if(state.spectrum){signals.forEach((s,i)=>{if(state.found.includes(i))return;const p=signalScreenPos(s),pulse=1+Math.sin(t*.006+i*2)*.2;ctx.save();ctx.translate(p.x,p.y);ctx.strokeStyle='rgba(216,255,56,.9)';ctx.fillStyle='rgba(216,255,56,.09)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,14*pulse,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.beginPath();ctx.arc(0,0,28*pulse,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#d8ff38';ctx.font='8px monospace';if(innerWidth<700){ctx.fillText(`0${i+1}`,32,3)}else{ctx.fillText('UNRESOLVED',34,-3);ctx.fillText('点击捕获',34,9)}ctx.restore()})}
    // scanner
    const scanY=(t*.06%(h*1.35))-h*.2;ctx.fillStyle=state.spectrum?'rgba(255,75,34,.025)':'rgba(216,255,56,.018)';ctx.fillRect(0,scanY,w,60);ctx.strokeStyle=state.spectrum?'rgba(255,75,34,.18)':'rgba(216,255,56,.12)';ctx.beginPath();ctx.moveTo(0,scanY);ctx.lineTo(w,scanY);ctx.stroke();
    $('[data-phase]').textContent=(Math.sin(t*.0017)*2.4>=0?'+':'')+(Math.sin(t*.0017)*2.4).toFixed(2);$('[data-temp]').textContent=(18.4+Math.sin(t*.0009)*.7+state.found.length*.9).toFixed(1)+'°';
  }
  function drawBreach(w,h,t){
    fx.clearRect(0,0,w,h);if(state.screen!=='breach')return;state.burn=Math.min(1,state.burn+.0065);
    fx.fillStyle='#080a08';fx.fillRect(0,0,w,h);const cx=w*(.35+state.pointer.x*.3),cy=h*(.35+state.pointer.y*.25),r=Math.hypot(w,h)*state.burn*.75;
    fx.globalCompositeOperation='destination-out';const hole=fx.createRadialGradient(cx,cy,r*.55,cx,cy,r);hole.addColorStop(0,'rgba(0,0,0,1)');hole.addColorStop(.78,'rgba(0,0,0,.95)');hole.addColorStop(1,'rgba(0,0,0,0)');fx.fillStyle=hole;fx.beginPath();fx.arc(cx,cy,r,0,Math.PI*2);fx.fill();fx.globalCompositeOperation='source-over';
    for(let i=0;i<95;i++){const a=i/95*Math.PI*2+Math.sin(i*3.7)*.06,rr=r*(.78+Math.sin(i*8.2+t*.008)*.05),x=cx+Math.cos(a)*rr,y=cy+Math.sin(a)*rr;fx.fillStyle=i%3?'#ff4b22':'#d8ff38';fx.globalAlpha=.25+Math.sin(i+t*.01)*.2;fx.beginPath();fx.arc(x,y,1.5+(i%5),0,Math.PI*2);fx.fill()}fx.globalAlpha=1;
    // embers
    for(let i=0;i<45;i++){const seed=(i*971)%997,x=(seed/997*w+t*(i%4+1)*.035)%w,y=h-((t*.08+i*83)%(h*1.2));fx.fillStyle=i%4?'#ff4b22':'#d8ff38';fx.fillRect(x,y,1+(i%3),4+(i%7))}
  }
  function frame(t){
    const dt=Math.min(32,t-(state.lastFrame||t));state.lastFrame=t;state.pointer.x+=(state.pointer.tx-state.pointer.x)*.075;state.pointer.y+=(state.pointer.ty-state.pointer.y)*.075;
    ctx.clearRect(0,0,innerWidth,innerHeight);ctx.fillStyle='#080a08';ctx.fillRect(0,0,innerWidth,innerHeight);
    if(state.screen==='lab'||state.screen==='breach'){drawGrid(innerWidth,innerHeight,t);drawSpecimen(innerWidth,innerHeight,t)}
    drawBreach(innerWidth,innerHeight,t);requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.screen==='lab'&&!state.paused)togglePause(true)});
  $('[data-clock]').textContent=new Date().toLocaleTimeString('zh-CN',{hour12:false});setInterval(()=>{$('[data-clock]').textContent=new Date().toLocaleTimeString('zh-CN',{hour12:false})},1000);
  boot();requestAnimationFrame(frame);
})();
