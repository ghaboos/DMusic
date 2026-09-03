(()=>{'use strict';
const $=s=>document.querySelector(s);
let ctx=null,analyser=null,source=null,data=null,raf=0,audio=null;
const POS='dmusic-track-positions-v2';
const readPos=()=>{try{return JSON.parse(localStorage.getItem(POS))||{}}catch{return{}}};
const writePos=v=>localStorage.setItem(POS,JSON.stringify(v));
const tracks=()=>window.DMusicData?.folders?.flatMap(f=>(f.tracks||[]).map(t=>({...t,folderId:f.id})))||[];
function currentTrack(){const title=$('#nowTitle')?.textContent?.trim();const artist=$('#nowArtist')?.textContent?.trim();return tracks().find(t=>t.title===title&&(t.artist||'Unknown artist')===artist)||tracks().find(t=>t.title===title)||null}
function css(){
 const old=$('#dm-cover-eq-fix-style');old?.remove();
 const s=document.createElement('style');s.id='dm-cover-eq-fix-style';s.textContent=`
/* DMusic FINAL COVER / CD / EQ */
.dm-modal.dm-cover-modal{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;z-index:2147483647!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:20px!important;margin:0!important;box-sizing:border-box!important;overflow:auto!important;background:rgba(0,0,0,.84)!important;backdrop-filter:blur(18px)!important}
.dm-modal.dm-cover-modal .dm-card{width:min(620px,calc(100vw - 40px))!important;max-height:calc(100dvh - 40px)!important;margin:auto!important;transform:none!important;overflow:auto!important}
body.dm-cover-edit-open{overflow:hidden!important}
.dm-cover-editor{display:grid!important;gap:16px!important;text-align:center!important}
.dm-cover-preview{width:min(330px,72vw)!important;aspect-ratio:1!important;object-fit:cover!important;border-radius:24px!important;display:block!important;margin:0 auto!important}
.dm-cover-picker{position:relative!important;min-height:96px!important;border:1px dashed rgba(227,178,77,.55)!important;border-radius:20px!important;background:rgba(227,178,77,.07)!important;display:grid!important;place-items:center!important;cursor:pointer!important;overflow:hidden!important}
.dm-cover-picker input{position:absolute!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important}
.dmfp-eq-ring,.dmfp-eq-ring-v2,.dmfp-eq-ring-v3,.dm-mini-eq,.dm-mini-eq-v3{display:none!important}
.dmfp-art.dm-eq-ready,.now-art-wrap.dm-mini-eq-ready{position:relative!important;isolation:isolate!important}
.dm-eq-live{position:absolute!important;inset:0!important;z-index:20!important;pointer-events:none!important;overflow:visible!important}
.dm-eq-live .dm-eq-bar{position:absolute!important;left:50%!important;top:50%!important;width:3px!important;height:14px!important;border-radius:99px!important;background:#e3b24d!important;box-shadow:0 0 8px rgba(227,178,77,.65)!important;transform-origin:center!important;will-change:transform,opacity!important}
.dm-eq-live:before{content:'';position:absolute!important;left:50%!important;top:50%!important;width:var(--eq-size)!important;height:var(--eq-size)!important;transform:translate(-50%,-50%)!important;border:1px solid rgba(227,178,77,.2)!important;border-radius:50%!important;box-shadow:0 0 18px rgba(227,178,77,.08)!important}
.dm-eq-live.active:before{box-shadow:0 0 34px rgba(227,178,77,.28)!important}
.now-art-wrap img{position:relative;z-index:2}
/* Mini player = physical CD: perfectly round, slow rotation only while playing. */
.now-art-wrap{width:min(72px,16vw)!important;height:min(72px,16vw)!important;min-width:58px!important;min-height:58px!important;flex:0 0 auto!important}
.now-art-wrap img{width:100%!important;height:100%!important;aspect-ratio:1!important;object-fit:cover!important;border-radius:50%!important;display:block!important;animation:none!important;transform:none!important}
.player.playing .now-art-wrap img,.now-art-wrap.playing img{animation:dmMiniCDSpin 18s linear infinite!important}
@keyframes dmMiniCDSpin{to{transform:rotate(360deg)}}
.dm-eq-live .dm-eq-bar{background:currentColor!important;color:#e3b24d!important}
.now-art-wrap .dm-eq-live{inset:-2px!important}
.now-art-wrap .dm-eq-live:before{border-color:rgba(227,178,77,.16)!important;box-shadow:0 0 12px rgba(227,178,77,.06)!important}
/* EQ must stay visually smaller than the mini CD and never stretch the sidebar. */
.now-art-wrap .dm-eq-live .dm-eq-bar{width:2px!important}
.now-art-wrap .dm-eq-live:before{width:calc(100% + 8px)!important;height:calc(100% + 8px)!important}
@media(max-width:700px){.dm-modal.dm-cover-modal{padding:10px!important}.dm-modal.dm-cover-modal .dm-card{width:calc(100vw - 20px)!important;max-height:calc(100dvh - 20px)!important}.dm-eq-live .dm-eq-bar{width:2px!important;height:9px!important}.now-art-wrap{width:64px!important;height:64px!important}}
`;
 document.head.appendChild(s)
}
function modalFix(){
 document.querySelectorAll('.dm-modal').forEach(m=>{
  const input=m.querySelector('#dmCoverFile');if(!input)return;
  m.classList.add('dm-cover-modal');document.body.classList.add('dm-cover-edit-open');
  const box=input.closest('.dm-player-full')||input.parentElement;if(box)box.classList.add('dm-cover-editor');
  const img=box?.querySelector('#dmCoverPreview');if(img)img.classList.add('dm-cover-preview');
  let picker=box?.querySelector('.dm-cover-picker');
  if(box&&!picker){picker=document.createElement('label');picker.className='dm-cover-picker';picker.innerHTML='<div><strong>＋ CHANGE COVER</strong><span>Choose JPG, PNG or WEBP</span></div>';box.insertBefore(picker,input);picker.appendChild(input)}
  if(input.dataset.eqfix)return;input.dataset.eqfix='1';
  input.addEventListener('change',()=>{const f=input.files?.[0];if(!f)return;picker?.classList.add('has-file');const a=picker?.querySelector('strong'),b=picker?.querySelector('span');if(a)a.textContent='✓ '+f.name;if(b)b.textContent='Ready — press SAVE COVER'});
  m.querySelector('.dm-close')?.addEventListener('click',()=>document.body.classList.remove('dm-cover-edit-open'),{once:true});
 });
 if(!document.querySelector('.dm-cover-modal'))document.body.classList.remove('dm-cover-edit-open');
}
function radius(host,extra){const img=host?.querySelector('img');const r=img?.getBoundingClientRect();return Math.max(12,Math.round((r?.width||host?.getBoundingClientRect().width||40)/2+extra))}
function ring(host,count,extra){if(!host)return;let el=host.querySelector('.dm-eq-live');if(!el){el=document.createElement('div');el.className='dm-eq-live';host.appendChild(el)}host.classList.add('dm-eq-ready');const r=radius(host,extra);el.style.setProperty('--eq-size',`${r*2}px`);if(el.childElementCount!==count){el.innerHTML='';for(let i=0;i<count;i++){const b=document.createElement('i');b.className='dm-eq-bar';el.appendChild(b)}}return el}
function build(){ring($('.dmfp-art'),64,12);ring($('.now-art-wrap'),32,6)}
function savePosition(){if(!audio)return;const t=currentTrack();if(!t)return;const p=readPos();if(Number.isFinite(audio.currentTime)&&audio.currentTime>1)p[String(t.id)]=audio.currentTime;writePos(p)}
function restorePosition(){const t=currentTrack();if(!audio||!t)return;const p=readPos(),saved=Number(p[String(t.id)]||0);if(saved>1&&Number.isFinite(audio.duration)&&saved<audio.duration-2){try{audio.currentTime=saved}catch{}}}
function captureAudio(){
 if(audio)return audio;
 const hook=HTMLMediaElement.prototype.play;
 if(!hook.__dmEQHook){HTMLMediaElement.prototype.play=function(){window.__dmusicLastAudio=this;return hook.apply(this,arguments)};HTMLMediaElement.prototype.play.__dmEQHook=true}
 audio=window.__dmusicLastAudio||null;
 if(!audio)return null;
 try{
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return audio;
  ctx=new AC();analyser=ctx.createAnalyser();analyser.fftSize=256;analyser.smoothingTimeConstant=.78;source=ctx.createMediaElementSource(audio);source.connect(analyser);analyser.connect(ctx.destination);data=new Uint8Array(analyser.frequencyBinCount);
  audio.addEventListener('play',()=>{ctx.resume().catch(()=>{});setTimeout(restorePosition,80)});
  audio.addEventListener('timeupdate',savePosition);
  audio.addEventListener('pause',savePosition);
  audio.addEventListener('ended',()=>{savePosition();const next=$('#nextBtn');if(next){setTimeout(()=>next.click(),40)}});
  audio.addEventListener('loadedmetadata',restorePosition);
 }catch(e){console.warn('DMusic EQ:',e)}
 return audio
}
function playing(){return !!audio&&!audio.paused&&!audio.ended}
function syncMiniSpin(){const w=$('.now-art-wrap');if(w)w.classList.toggle('playing',playing())}
function draw(el,isMini){if(!el)return;const bars=[...el.children],r=radius(el.parentElement,isMini?6:12),live=playing();if(live&&analyser&&data)analyser.getByteFrequencyData(data);el.classList.toggle('active',live);bars.forEach((b,i)=>{const angle=i*360/bars.length-90;let v=0;if(live&&data){const bin=Math.min(data.length-1,Math.floor(i/bars.length*data.length*.75));v=data[bin]/255}const h=live?Math.max(.25,.35+v*1.9):.08;b.style.opacity=live?String(.35+v*.65):'.18';b.style.height=live?`${isMini?4+v*7:6+v*20}px`:'4px';b.style.transform=`translate(-50%,-50%) rotate(${angle}deg) translateY(-${r}px) scaleY(${h})`})}
function loop(){captureAudio();build();syncMiniSpin();draw($('.dmfp-art .dm-eq-live'),false);draw($('.now-art-wrap .dm-eq-live'),true);const p=$('.player');if(p)p.classList.toggle('playing',playing());raf=requestAnimationFrame(loop)}
function init(){css();modalFix();build();if(!raf)raf=requestAnimationFrame(loop);new MutationObserver(modalFix).observe(document.body,{subtree:true,childList:true});window.addEventListener('resize',()=>{document.querySelectorAll('.dm-eq-live').forEach(x=>x.remove());document.querySelectorAll('.dmfp-art,.now-art-wrap').forEach(x=>x.classList.remove('dm-eq-ready'));build()})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();