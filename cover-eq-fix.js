(()=>{'use strict';
const $=s=>document.querySelector(s);
let audioCtx=null,analyser=null,sourceAudio=null,freq=null,raf=0;

function css(){
 const old=$('#dm-cover-eq-fix-style');if(old)old.remove();
 const s=document.createElement('style');s.id='dm-cover-eq-fix-style';s.textContent=`
/* COVER EDITOR — force a real viewport modal */
.dm-modal.dm-cover-modal{
 position:fixed!important;left:0!important;top:0!important;right:0!important;bottom:0!important;
 width:100vw!important;height:100dvh!important;min-height:100dvh!important;
 z-index:2147483647!important;display:flex!important;align-items:center!important;justify-content:center!important;
 margin:0!important;padding:20px!important;box-sizing:border-box!important;overflow:auto!important;
 background:rgba(0,0,0,.82)!important;backdrop-filter:blur(18px)!important
}
.dm-modal.dm-cover-modal .dm-card{
 width:min(620px,calc(100vw - 40px))!important;max-height:calc(100dvh - 40px)!important;
 margin:0 auto!important;transform:none!important;overflow:auto!important
}
body.dm-cover-edit-open{overflow:hidden!important}
.dm-cover-editor{display:grid!important;gap:16px!important;text-align:center!important}
.dm-cover-preview{width:min(330px,72vw)!important;aspect-ratio:1!important;object-fit:cover!important;border-radius:24px!important;display:block!important;margin:0 auto!important;box-shadow:0 28px 80px #000,0 0 45px rgba(227,178,77,.12)!important}
.dm-cover-picker{position:relative!important;min-height:96px!important;border:1px dashed rgba(227,178,77,.55)!important;border-radius:20px!important;background:linear-gradient(145deg,rgba(227,178,77,.12),rgba(255,255,255,.025))!important;display:grid!important;place-items:center!important;cursor:pointer!important;overflow:hidden!important;transition:.2s!important}
.dm-cover-picker:hover{border-color:#e3b24d!important;background:linear-gradient(145deg,rgba(227,178,77,.2),rgba(255,255,255,.045))!important}
.dm-cover-picker strong{display:block!important;font-size:13px!important;letter-spacing:.12em!important}.dm-cover-picker span{display:block!important;margin-top:6px!important;font-size:11px!important;opacity:.52!important}.dm-cover-picker.has-file strong{color:#e3b24d!important}
.dm-cover-picker input{position:absolute!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important}

/* EQ: bars live OUTSIDE the CD perimeter */
.dmfp-art.dm-eq-ready,.now-art-wrap.dm-mini-eq-ready{position:relative!important;isolation:isolate!important}
.dmfp-eq-live,.dm-mini-eq-live{position:absolute!important;inset:0!important;z-index:8!important;pointer-events:none!important;border-radius:50%!important;overflow:visible!important}
.dmfp-eq-live .eq-live-bar,.dm-mini-eq-live .eq-live-bar{
 position:absolute!important;left:50%!important;top:50%!important;
 width:3px!important;height:10px!important;border-radius:99px!important;
 background:#e3b24d!important;box-shadow:0 0 7px rgba(227,178,77,.5)!important;
 opacity:.3!important;transform-origin:50% 50%!important;will-change:transform,height,opacity!important
}
.dmfp-eq-live:before,.dm-mini-eq-live:before{
 content:'';position:absolute!important;left:50%!important;top:50%!important;
 width:var(--eq-d)!important;height:var(--eq-d)!important;border-radius:50%!important;
 transform:translate(-50%,-50%)!important;border:1px solid rgba(227,178,77,.24)!important;
 box-shadow:0 0 22px rgba(227,178,77,.12)!important
}
.dmfp-art.playing .dmfp-eq-live:before,.player.playing .dm-mini-eq-live:before{box-shadow:0 0 30px rgba(227,178,77,.3)!important}
.now-art-wrap.dm-mini-eq-ready img{border-radius:50%!important}
@media(max-width:700px){
 .dm-modal.dm-cover-modal{padding:10px!important}.dm-modal.dm-cover-modal .dm-card{width:calc(100vw - 20px)!important;max-height:calc(100dvh - 20px)!important}
 .dmfp-eq-live .eq-live-bar{width:2.5px!important}.dm-mini-eq-live .eq-live-bar{width:2px!important}
}
`;
 document.head.appendChild(s)
}

function markModal(root){
 const input=root?.querySelector?.('#dmCoverFile');if(!input)return;
 const modal=input.closest('.dm-modal');if(!modal)return;
 modal.classList.add('dm-cover-modal');document.body.classList.add('dm-cover-edit-open');
 const old=input.closest('.dm-player-full')||input.parentElement;
 if(old)old.classList.add('dm-cover-editor');
 const img=old?.querySelector?.('#dmCoverPreview');if(img)img.classList.add('dm-cover-preview');
 let picker=old?.querySelector?.('.dm-cover-picker');
 if(old&&!picker){
  picker=document.createElement('label');picker.className='dm-cover-picker';
  picker.innerHTML='<div><strong>＋ CHANGE COVER</strong><span>Choose JPG, PNG or WEBP</span></div>';
  old.insertBefore(picker,input);picker.appendChild(input);
 }
 if(input.dataset.v4)return;
 input.dataset.v4='1';
 input.addEventListener('change',()=>{const f=input.files?.[0];if(!f)return;picker?.classList.add('has-file');const st=picker?.querySelector('strong'),sp=picker?.querySelector('span');if(st)st.textContent='✓ '+f.name;if(sp)sp.textContent='Ready — press SAVE COVER'});
 setTimeout(()=>{modal.scrollTop=0;modal.scrollLeft=0},0)
}

function radiusFor(el,extra){
 const img=el?.querySelector?.('img');
 const rect=img?.getBoundingClientRect?.();
 const w=rect?.width||el?.getBoundingClientRect?.().width||100;
 return Math.max(20,Math.round(w/2+extra))
}

function makeRing(el,cls,count,extra){
 if(!el)return null;
 el.querySelectorAll('.dmfp-eq-live,.dm-mini-eq-live,.dmfp-eq-ring,.dmfp-eq-ring-v2,.dmfp-eq-ring-v3,.dm-mini-eq').forEach(x=>x.remove());
 el.classList.add(cls==='dmfp-eq-live'?'dm-eq-ready':'dm-mini-eq-ready');
 const ring=document.createElement('div');ring.className=cls;ring.style.setProperty('--eq-d',`${Math.max(1,radiusFor(el,extra)*2)}px`);
 for(let i=0;i<count;i++){
  const b=document.createElement('i');b.className='eq-live-bar';b.dataset.i=i;b.dataset.count=count;ring.appendChild(b)
 }
 el.appendChild(ring);return ring
}
function build(){
 const art=$('.dmfp-art');if(art&&!art.querySelector('.dmfp-eq-live'))makeRing(art,'dmfp-eq-live',56,11);
 const mini=$('.now-art-wrap');if(mini&&!mini.querySelector('.dm-mini-eq-live'))makeRing(mini,'dm-mini-eq-live',32,7)
}

function setupAudio(){
 const a=document.querySelector('audio');if(!a||sourceAudio===a)return;
 sourceAudio=a;
 try{
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
  audioCtx=new AC();analyser=audioCtx.createAnalyser();analyser.fftSize=256;analyser.smoothingTimeConstant=.72;
  const src=audioCtx.createMediaElementSource(a);src.connect(analyser);analyser.connect(audioCtx.destination);
  freq=new Uint8Array(analyser.frequencyBinCount);
  a.addEventListener('play',()=>audioCtx?.resume?.().catch(()=>{}));
 }catch(e){console.warn('DMusic EQ audio analyser unavailable',e);analyser=null;freq=null}
}
function isPlaying(){return !!sourceAudio&&!sourceAudio.paused&&!sourceAudio.ended&&sourceAudio.readyState>2}
function drawRing(ring,playing){
 if(!ring)return;
 const bars=[...ring.children],count=bars.length;
 const host=ring.parentElement;const extra=ring.classList.contains('dm-mini-eq-live')?7:11;
 const r=radiusFor(host,extra);
 ring.style.setProperty('--eq-d',`${r*2}px`);
 if(playing&&analyser&&freq)analyser.getByteFrequencyData(freq);
 bars.forEach((b,i)=>{
  const angle=i*360/count-90;
  let v=.08;
  if(playing&&freq){
   const bin=Math.min(freq.length-1,Math.max(0,Math.floor((i/count)*freq.length*.9)));
   v=freq[bin]/255
  }
  const level=playing?(0.16+v*1.55):0.06;
  const rr=r;
  b.style.height=`${playing?(5+v*18):4}px`;
  b.style.opacity=playing?`${.45+v*.55}`:'.22';
  b.style.transform=`translate(-50%,-50%) rotate(${angle}deg) translateY(-${rr}px) scaleY(${level})`;
 });
}
function loop(){
 setupAudio();build();const playing=isPlaying();
 drawRing($('.dmfp-eq-live'),playing);drawRing($('.dm-mini-eq-live'),playing);
 const art=$('.dmfp-art');const player=$('.player');if(art)art.classList.toggle('playing',playing);if(player)player.classList.toggle('playing',playing);
 raf=requestAnimationFrame(loop)
}

function scan(){document.querySelectorAll('.dm-modal').forEach(markModal);build();setupAudio()}
function init(){css();scan();if(!raf)raf=requestAnimationFrame(loop);const mo=new MutationObserver(()=>scan());mo.observe(document.body,{subtree:true,childList:true});window.addEventListener('resize',()=>{document.querySelectorAll('.dmfp-eq-live,.dm-mini-eq-live').forEach(x=>x.remove());document.querySelector('.dmfp-art')?.classList.remove('dm-eq-ready');document.querySelector('.now-art-wrap')?.classList.remove('dm-mini-eq-ready');build()})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();