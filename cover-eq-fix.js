(()=>{'use strict';
const $=s=>document.querySelector(s);
const FALLBACK='assets/covers/fallback.svg';
function css(){if($('#dm-cover-eq-fix-style'))return;const s=document.createElement('style');s.id='dm-cover-eq-fix-style';s.textContent=`
/* Cover editor */
.dm-modal.dm-cover-modal{position:fixed!important;inset:0!important;z-index:2147482999!important;display:grid!important;place-items:center!important;padding:18px!important;overflow:auto!important}
.dm-modal.dm-cover-modal .dm-card{width:min(620px,calc(100vw - 28px))!important;max-height:calc(100dvh - 28px)!important;margin:auto!important;padding:24px!important;overflow:auto!important}
.dm-cover-editor{display:grid;gap:16px;text-align:center}
.dm-cover-preview{width:min(330px,72vw);aspect-ratio:1;object-fit:cover;border-radius:24px;display:block;margin:0 auto;box-shadow:0 28px 80px #000,0 0 45px rgba(227,178,77,.12);border:1px solid rgba(255,255,255,.08)}
.dm-cover-picker{position:relative;min-height:96px;border:1px dashed rgba(227,178,77,.55);border-radius:20px;background:linear-gradient(145deg,rgba(227,178,77,.12),rgba(255,255,255,.025));display:grid;place-items:center;cursor:pointer;transition:.2s;overflow:hidden}
.dm-cover-picker:hover{border-color:#e3b24d;background:linear-gradient(145deg,rgba(227,178,77,.2),rgba(255,255,255,.045));transform:translateY(-1px);box-shadow:0 12px 35px rgba(227,178,77,.08)}
.dm-cover-picker strong{display:block;font-size:13px;letter-spacing:.12em}.dm-cover-picker span{display:block;margin-top:6px;font-size:11px;opacity:.52}.dm-cover-picker.has-file strong{color:#e3b24d}
.dm-cover-picker input{position:absolute!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important}
.dm-cover-crop{display:grid;gap:8px;text-align:left}.dm-cover-crop label{font-size:11px;letter-spacing:.12em;text-transform:uppercase;opacity:.58}
/* Full player equalizer */
.dmfp-art.dm-eq-ready{position:relative!important;isolation:isolate}
.dmfp-eq-ring-v2{position:absolute;inset:-42px;z-index:1;pointer-events:none;border-radius:50%}
.dmfp-eq-ring-v2:before{content:'';position:absolute;inset:18px;border-radius:50%;border:1px solid rgba(227,178,77,.24);box-shadow:0 0 35px rgba(227,178,77,.10),inset 0 0 25px rgba(227,178,77,.04)}
.dmfp-eq-ring-v2 .eqv{position:absolute;left:50%;top:50%;width:4px;height:24px;border-radius:99px;background:#e3b24d;box-shadow:0 0 8px rgba(227,178,77,.35);transform-origin:50% calc(50% + 188px);transform:translate(-50%,-50%) rotate(var(--a)) translateY(-188px) scaleY(.28);opacity:.62;animation:dmEqV2 1.05s ease-in-out infinite alternate;animation-delay:var(--d)}
.dmfp-art.playing .dmfp-eq-ring-v2 .eqv{animation-duration:.42s;opacity:.95}
.dmfp-art.playing .dmfp-eq-ring-v2:before{box-shadow:0 0 50px rgba(227,178,77,.22),inset 0 0 30px rgba(227,178,77,.06)}
@keyframes dmEqV2{from{transform:translate(-50%,-50%) rotate(var(--a)) translateY(-188px) scaleY(.22)}to{transform:translate(-50%,-50%) rotate(var(--a)) translateY(-188px) scaleY(var(--h))}}
@media(max-width:760px){.dmfp-eq-ring-v2{inset:-27px}.dmfp-eq-ring-v2 .eqv{width:3px;transform-origin:50% calc(50% + 140px);transform:translate(-50%,-50%) rotate(var(--a)) translateY(-140px) scaleY(.22)}@keyframes dmEqV2{from{transform:translate(-50%,-50%) rotate(var(--a)) translateY(-140px) scaleY(.2)}to{transform:translate(-50%,-50%) rotate(var(--a)) translateY(-140px) scaleY(var(--h))}}}
`;
document.head.appendChild(s)}
function coverEditorFix(root){const input=root?.querySelector?.('#dmCoverFile');if(!input||input.dataset.v2)return;input.dataset.v2='1';const modal=input.closest('.dm-modal');if(modal)modal.classList.add('dm-cover-modal');const old=input.closest('.dm-player-full')||input.parentElement;if(!old)return;old.classList.add('dm-cover-editor');const img=old.querySelector('#dmCoverPreview');if(img)img.classList.add('dm-cover-preview');let picker=old.querySelector('.dm-cover-picker');if(!picker){picker=document.createElement('label');picker.className='dm-cover-picker';picker.innerHTML='<div><strong>CHANGE COVER</strong><span>Choose JPG, PNG or WEBP · click to browse</span></div>';old.insertBefore(picker,input);picker.appendChild(input);picker.addEventListener('click',e=>{if(e.target!==input){e.preventDefault();input.click()}})}input.addEventListener('change',()=>{const f=input.files?.[0];if(!f)return;picker.classList.add('has-file');picker.querySelector('strong').textContent=f.name;picker.querySelector('span').textContent='Image selected · press SAVE COVER';});const crop=input.parentElement?.querySelector('#dmCrop');if(crop){const holder=crop.parentElement;holder?.classList.add('dm-cover-crop')}}
function buildEq(){const art=$('.dmfp-art');if(!art)return;if(art.querySelector('.dmfp-eq-ring-v2'))return;art.classList.add('dm-eq-ready');art.querySelector('.dmfp-eq-ring')?.remove();const ring=document.createElement('div');ring.className='dmfp-eq-ring-v2';for(let i=0;i<48;i++){const b=document.createElement('i');b.className='eqv';b.style.setProperty('--a',`${i*7.5}deg`);b.style.setProperty('--d',`${-(i%12)*.045}s`);b.style.setProperty('--h',`${.65+(i%6)*.12}`);ring.appendChild(b)}art.appendChild(ring)}
function lockModal(modal){if(!modal||modal.dataset.coverLock)return;modal.dataset.coverLock='1';document.body.classList.add('dm-cover-edit-open');const close=()=>document.body.classList.remove('dm-cover-edit-open');modal.querySelector('.dm-close')?.addEventListener('click',close);modal.addEventListener('click',e=>{if(e.target===modal)close()});}
function scan(){document.querySelectorAll('.dm-modal').forEach(m=>{const i=m.querySelector('#dmCoverFile');if(i){coverEditorFix(m);lockModal(m)}});buildEq()}
function init(){css();scan();const mo=new MutationObserver(scan);mo.observe(document.body,{subtree:true,childList:true});setInterval(scan,1000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();