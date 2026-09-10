// AI47 GPT - Frontend Logic - Honest Free Architecture
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

let state = {
  providerConfigured: false,
  selectedStyle: 'realistic',
  selectedRatio: '1:1',
  gallery: JSON.parse(localStorage.getItem('ai47_gallery')||'[]'),
  history: JSON.parse(localStorage.getItem('ai47_history')||'[]'),
  theme: localStorage.getItem('ai47_theme')||'dark'
};

const styles = ['Realistic','Cinematic','Anime','Fantasy','Cyberpunk','3D','Digital Art','Watercolor','Oil Painting','Minimalist','Portrait','Product Photography','Comic','Futuristic','Studio Photography'];
const ratios = ['1:1','9:16','16:9','4:5','3:4'];

function init(){
  // hide loading
  setTimeout(()=>{ const ls=$('#loadingScreen'); if(ls){ls.style.opacity='0'; setTimeout(()=>ls.remove(),500);} },800);

  // build controls
  const sg = $('#styleGrid');
  if(sg){ styles.forEach(s=>{ const b=document.createElement('button'); b.className='style-btn'+(s.toLowerCase()===state.selectedStyle?' active':''); b.textContent=s; b.onclick=()=>{ $$('.style-btn').forEach(x=>x.classList.remove('active')); b.classList.add('active'); state.selectedStyle=s.toLowerCase(); }; sg.appendChild(b); }); }
  const rg = $('#ratioGrid');
  if(rg){ ratios.forEach(r=>{ const b=document.createElement('button'); b.className='ratio-btn'+(r===state.selectedRatio?' active':''); b.textContent=r; b.onclick=()=>{ $$('.ratio-btn').forEach(x=>x.classList.remove('active')); b.classList.add('active'); state.selectedRatio=r; }; rg.appendChild(b); }); }

  // nav
  $$('.nav-item, .bottom-nav button, [data-goto]').forEach(el=>{ el.addEventListener('click',()=>{ const p=el.dataset.page||el.dataset.goto; if(p) gotoPage(p); }); });
  $('#collapseBtn')?.addEventListener('click',()=>{ $('#sidebar').classList.toggle('collapsed'); });
  $('#mobileMenuBtn')?.addEventListener('click',()=>{ $('#sidebar').classList.toggle('mobile-open'); });
  $('#themeToggle')?.addEventListener('click',toggleTheme);
  applyTheme();

  // status
  checkStatus();

  // generator
  $('#generateBtn')?.addEventListener('click',handleGenerate);
  $('#chatSend')?.addEventListener('click',()=>{ const v=$('#chatInput').value.trim(); if(v) handleChat(v); });
  $('#chatInput')?.addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); const v=$('#chatInput').value.trim(); if(v) handleChat(v);} });
  $('#editBtn')?.addEventListener('click',handleEdit);
  $('#clearGallery')?.addEventListener('click',()=>{ if(confirm('Clear gallery? Local only.')){ state.gallery=[]; save(); renderGallery(); }});

  // upload boxes
  setupUpload('#uploadBox','#imageUpload','#uploadPreview');
  setupUpload('#editorUploadBox','#editorImage','#editorPreviewArea');

  renderGallery(); renderHistory();
  registerSW();
}

async function checkStatus(){
  try{
    const res = await fetch('/api/status');
    const data = await res.json();
    state.providerConfigured = data.configured;
    $('#comfyUrlDisplay') && ($('#comfyUrlDisplay').textContent=data.comfyUrl);
    $('#settingsStatus') && ($('#settingsStatus').innerHTML = data.configured?`<span style="color:var(--success)">● Local provider ready</span> - ${data.providerDetails} at ${data.comfyUrl}`:`<div class="config-error"><h3>AI image generation is not configured yet.</h3><p>${data.message}</p><p>Install ComfyUI + model, or enable optional cloud provider.</p><button class="btn ghost" onclick="gotoPage('help')">View Setup Guide</button></div>`);
    $('#statusText') && ($('#statusText').textContent = data.configured?`Local provider ready (${data.providerDetails})`:`AI image generation is not configured yet - ${data.message}`);
    $('#statusBanner') && ($('#statusBanner').style.display = data.configured?'none':'flex');
  }catch(e){
    $('#statusText') && ($('#statusText').textContent='Status check failed - backend not running');
  }
}

function gotoPage(p){
  $$('.page').forEach(x=>x.classList.remove('active'));
  const el = $('#page-'+p);
  if(el) el.classList.add('active');
  $$('.nav-item').forEach(x=>x.classList.toggle('active', x.dataset.page===p));
  $('#sidebar')?.classList.remove('mobile-open');
  window.scrollTo(0,0);
}

async function handleGenerate(){
  const prompt = $('#promptInput').value.trim();
  if(!prompt) return alert('Enter a prompt');
  const useEnhance = $('#enhanceToggle')?.checked;
  const quality = $('#qualitySelect')?.value || 'High';
  const numImages = parseInt($('#numImages')?.value||'1');
  const steps = parseInt($('#stepsInput')?.value||'20');
  const guidance = parseFloat($('#guidanceInput')?.value||'7');
  const seed = $('#seedInput')?.value ? parseInt($('#seedInput').value) : undefined;
  const negative = $('#negativeInput')?.value;

  const btn = $('#generateBtn'); btn.disabled=true; btn.textContent='Creating...';

  try{
    // enhance
    let enhanced = prompt, negativeFinal = negative;
    if(useEnhance){
      const enhRes = await fetch('/api/enhance-prompt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt, style:state.selectedStyle, useEnhancement:true})});
      const enhData = await enhRes.json();
      enhanced = enhData.enhanced||prompt;
      negativeFinal = negativeFinal || enhData.negative;
      $('#enhancePreview') && ($('#enhancePreview').textContent = 'Enhanced: '+enhanced.slice(0,120));
    }

    // check status again
    if(!state.providerConfigured){
      addMessageToChat(prompt, null, true); // show error honestly
      showNotConfigured();
      return;
    }

    const res = await fetch('/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      prompt, enhancedPrompt:enhanced, negativePrompt:negativeFinal, style:state.selectedStyle, aspectRatio:state.selectedRatio, quality, steps, guidance, seed, numImages
    })});
    const data = await res.json();
    if(!res.ok){
      if(data.code==='NOT_CONFIGURED'){ showNotConfigured(); addMessageToChat(prompt, data, true); }
      else throw new Error(data.error||'Generation failed');
      return;
    }
    // data contains queue info or images
    addMessageToChat(prompt, data);
    // save to gallery/history if images present - in real ComfyUI flow, you would poll history endpoint
    if(data.images && data.images.length){ saveToGallery(prompt, enhanced, data.images); }
    else {
      // No images yet (queued) - show queue info honestly, not fake image
      addMessageToChat(prompt, { message: data.message||'Queued to local provider. Implement polling for ComfyUI history API.', queueId: data.queueId, provider:'local' });
    }
  }catch(e){
    alert(e.message);
    addMessageToChat(prompt, { error:e.message }, true);
  }finally{ btn.disabled=false; btn.textContent='Generate ✨'; }
}

function showNotConfigured(){
  const chat = $('#chatHistory');
  if(!chat) return;
  const div = document.createElement('div');
  div.className='config-error';
  div.innerHTML=`<h3>AI image generation is not configured yet.</h3><p>Connect a local image-generation provider to enable this feature.</p><p>Install ComfyUI + a compatible model (e.g. SDXL) on your machine, set <code>COMFYUI_URL=http://127.0.0.1:8188</code> and restart.</p><button class="btn ghost" onclick="gotoPage('help')">View Setup Guide</button>`;
  chat.appendChild(div);
  chat.scrollTop=chat.scrollHeight;
}

function addMessageToChat(prompt, result, isError){
  const chat = $('#chatHistory') || $('#chatMessages');
  if(!chat) return;
  const wrap = document.createElement('div');
  wrap.className='message';
  const errClass = isError?' style="border-color:var(--danger)"':'';
  let imagesHtml='';
  if(result && result.images && result.images.length){
    imagesHtml = result.images.map(src=>`<div class="image-result"><img src="${src}" alt="${prompt}"><div class="image-actions"><button class="icon-btn" onclick="downloadImage('${src}')">⬇ Download</button><button class="icon-btn">✏ Edit</button><button class="icon-btn">🔄 Variation</button><button class="icon-btn">↗ Share</button></div></div>`).join('');
  } else if(result && result.error){
    imagesHtml=`<div class="config-error"><p>${result.error}</p><small>${result.details||''}</small></div>`;
  } else if(result && result.message){
    imagesHtml=`<div class="glass card" style="margin-top:8px"><p>${result.message}</p>${result.queueId?`<small>Queue ID: ${result.queueId}</small>`:''}</div>`;
  }
  wrap.innerHTML=`<img src="/assets/ai47-logo.png" class="avatar"><div class="msg-content"><div class="msg-bubble"${errClass}><strong>You:</strong> ${escapeHtml(prompt)}<br><br><strong>AI47 GPT:</strong> ${isError?'Failed - see details below':'Creating your image...' } </div>${imagesHtml}</div>`;
  chat.appendChild(wrap);
  chat.scrollTop=chat.scrollHeight;
}

async function handleChat(text){
  $('#chatInput').value=''; $('#promptInput').value=text; gotoPage('generator'); handleGenerate();
}

async function handleEdit(){
  const prompt = $('#editPrompt').value.trim();
  if(!prompt) return alert('Enter edit instruction');
  const fileInput = $('#editorImage');
  if(!fileInput.files[0]) return alert('Upload image first');
  const fd = new FormData();
  fd.append('image', fileInput.files[0]);
  fd.append('prompt', prompt);
  const btn=$('#editBtn'); btn.disabled=true; btn.textContent='Editing...';
  try{
    const res= await fetch('/api/edit',{method:'POST',body:fd});
    const data= await res.json();
    if(!res.ok) throw new Error(data.error);
    $('#editResult').innerHTML=`<div class="glass card"><p>${data.message||'Edited'}</p></div>`;
  }catch(e){ alert(e.message);}finally{ btn.disabled=false; btn.textContent='Edit Image ✏️'; }
}

function setupUpload(boxSel,inputSel,previewSel){
  const box=$(boxSel), input=$(inputSel), preview=$(previewSel);
  if(!box||!input) return;
  box.addEventListener('click',()=>input.click());
  box.addEventListener('dragover',e=>{ e.preventDefault(); box.style.borderColor='var(--accent)'; });
  box.addEventListener('dragleave',()=>box.style.borderColor='');
  box.addEventListener('drop',e=>{ e.preventDefault(); const f=e.dataTransfer.files[0]; if(f){ input.files=e.dataTransfer.files; showPreview(f,preview); }});
  input.addEventListener('change',()=>{ if(input.files[0]) showPreview(input.files[0],preview); });
}
function showPreview(file, container){
  if(!container) return;
  const url=URL.createObjectURL(file);
  container.innerHTML=`<div class="gallery-item"><img src="${url}"><div class="meta">${file.name} - ${(file.size/1024).toFixed(1)}KB <button class="link-btn" onclick="this.parentElement.parentElement.remove()">Remove</button></div></div>`;
}

function saveToGallery(prompt, enhanced, images){
  images.forEach(src=>{
    state.gallery.unshift({ id:Date.now()+Math.random(), prompt, enhanced, src, date:new Date().toISOString(), provider:'local' });
    state.history.unshift({ prompt, enhanced, date:new Date().toISOString(), provider:'local', src });
  });
  save(); renderGallery(); renderHistory();
}
function save(){ localStorage.setItem('ai47_gallery',JSON.stringify(state.gallery)); localStorage.setItem('ai47_history',JSON.stringify(state.history)); }
function renderGallery(){
  const grid=$('#galleryGrid'); if(!grid) return;
  if(!state.gallery.length){ grid.innerHTML='<div class="empty-state"><h3>No creations yet.</h3><p>Generated images will appear here. Stored locally in your browser.</p></div>'; return; }
  grid.innerHTML=state.gallery.map(item=>`<div class="gallery-item"><img src="${item.src}" alt="${escapeHtml(item.prompt)}"><div class="meta"><small>${new Date(item.date).toLocaleString()}</small><p>${escapeHtml(item.prompt.slice(0,80))}</p></div><div class="actions"><button class="icon-btn" onclick="downloadImage('${item.src}')">⬇</button><button class="icon-btn">✏</button><button class="icon-btn">🔄</button><button class="icon-btn" onclick="deleteGallery('${item.id}')">🗑</button></div></div>`).join('');
  const vg=$('#variationGrid'); if(vg) vg.innerHTML=grid.innerHTML;
}
function renderHistory(){
  const list=$('#historyList'); if(!list) return;
  if(!state.history.length){ list.innerHTML='<div class="empty-state"><h3>No generation history yet.</h3></div>'; return; }
  list.innerHTML=state.history.map(h=>`<div class="glass card" style="display:flex;gap:12px;margin-bottom:10px"><img src="${h.src}" style="width:60px;height:60px;object-fit:cover;border-radius:8px"><div><small>${new Date(h.date).toLocaleString()} - ${h.provider}</small><p>${escapeHtml(h.prompt)}</p><small>Enhanced: ${escapeHtml(h.enhanced||'')}</small></div></div>`).join('');
}
window.deleteGallery=(id)=>{ state.gallery=state.gallery.filter(x=>String(x.id)!==String(id)); save(); renderGallery(); };
window.downloadImage=(src)=>{ const a=document.createElement('a'); a.href=src; a.download='ai47-'+Date.now()+'.png'; a.click(); };
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function toggleTheme(){ state.theme=state.theme==='dark'?'light':'dark'; localStorage.setItem('ai47_theme',state.theme); applyTheme(); }
function applyTheme(){ document.body.classList.toggle('light',state.theme==='light'); const t=$('#themeToggle'); if(t) t.innerHTML=(state.theme==='light'?'☀️ <span>Light Mode</span>':'🌙 <span>Dark Mode</span>'); }
function registerSW(){ if('serviceWorker' in navigator){ navigator.serviceWorker.register('/sw.js'); } }

document.addEventListener('DOMContentLoaded',init);
window.gotoPage=gotoPage;
