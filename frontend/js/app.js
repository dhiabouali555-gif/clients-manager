const $ = id => document.getElementById(id);
let clients = [];
let selectedId = null;
let editingIndex = null;
const STORAGE_KEY = 'fiches_clients_shein_v1';

const makeId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function linkOk(s){try{let u=new URL(s);return ['http:','https:'].includes(u.protocol)?u.href:''}catch{return ''}}
function selected(){return clients.find(c=>c.id===selectedId)}

function saveLocal(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(clients));if(selectedId)localStorage.setItem(STORAGE_KEY+'_last',selectedId)}catch{}}

async function loadState(){
  try{
    const r = await fetch('/api/state');
    if(r.ok){
      const d = await r.json();
      clients = Array.isArray(d.clients)?d.clients:[];
      selectedId = d.selectedId || null;
      saveLocal();
      return;
    }
  }catch(e){}
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){const d=JSON.parse(raw);if(Array.isArray(d))clients=d;}
    const last = localStorage.getItem(STORAGE_KEY+'_last');
    if(last && clients.some(c=>c.id===last)) selectedId = last;
  }catch(e){}
}

let saveTimer = null;
function scheduleSave(){
  saveLocal();
  if(saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async ()=>{
    try{ await fetch('/api/state',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({clients,selectedId})}); }catch(e){}
  }, 300);
}

/* ---------- dynamic product forms ---------- */
function blockHTML(i){
  return `<div class="pform" data-fi="${i}">
  <div class="pform-head"><h3>Lien ${i+1}</h3>${i>0?'<button class="icon-btn" data-remove-form type="button" title="Retirer ce lien">&times;</button>':''}</div>
  <label>Lien SHEIN / produit *</label><input type="url" data-f="link" placeholder="https://...">
  <div class="formgrid"><div><label>Nom du produit *</label><input data-f="name" placeholder="Coque iPhone"></div><div><label>Couleur / modèle / taille</label><input data-f="variant" placeholder="Noir, iPhone 16 Pro..."></div></div>
  <div class="formgrid"><div><label>Quantité</label><input data-f="qty" type="number" min="1" step="1" value="1"></div><div><label>État</label><input data-f="status" placeholder="Ex. à confirmer"></div></div>
  <label>Autres détails</label><textarea data-f="details" placeholder="Capture demandée, préférence, lien alternatif, taille exacte..."></textarea>
  </div>`;
}
function renumber(){
  document.querySelectorAll('#productForms .pform').forEach((b,i)=>{
    b.dataset.fi = i;
    b.querySelector('h3').textContent = 'Lien ' + (i+1);
    let x = b.querySelector('[data-remove-form]');
    if(i>0 && !x) b.querySelector('.pform-head').insertAdjacentHTML('beforeend','<button class="icon-btn" data-remove-form type="button" title="Retirer ce lien">&times;</button>');
    if(i===0 && x) x.remove();
  });
}
function resetForms(n=1){
  $('productForms').innerHTML = Array.from({length:n},(_,i)=>blockHTML(i)).join('');
  cancelEdit();
}
function cancelEdit(){
  editingIndex = null;
  $('saveForms').textContent = 'Enregistrer les liens';
  $('formTitle').textContent = 'Ajouter des liens produits';
}
function collectForms(){
  const blocks=[...document.querySelectorAll('#productForms .pform')];
  const items=[];let partial=false;
  blocks.forEach(b=>{
    const v=f=>b.querySelector(`[data-f="${f}"]`).value.trim();
    const link=linkOk(v('link')), name=v('name');
    const filled = v('link')||name||v('variant')||v('details')||v('status')||(v('qty')&&v('qty')!=='1');
    if(!link && !name && !filled) return;
    if(!link || !name){partial=true;return;}
    items.push({link,name,variant:v('variant'),qty:Math.max(1,Math.floor(Number(v('qty'))||1)),status:v('status'),details:v('details')});
  });
  return {items,partial};
}

$('addForm').onclick=()=>{
  if(editingIndex!==null){cancelEdit();resetForms(1);}
  const n=document.querySelectorAll('#productForms .pform').length;
  if(n>=20){alert('Maximum 20 liens à la fois.');return}
  $('productForms').insertAdjacentHTML('beforeend',blockHTML(n));
  renumber();
  const last=document.querySelector('#productForms .pform:last-child [data-f="link"]');
  if(last){last.focus();last.scrollIntoView({behavior:'smooth',block:'center'})}
};
$('clearForms').onclick=()=>resetForms(1);
$('productForms').onclick=e=>{
  const rm=e.target.closest('[data-remove-form]');
  if(!rm)return;
  rm.closest('.pform').remove();
  renumber();
};
$('saveForms').onclick=()=>{
  const c=selected();
  if(!c){alert('Choisis un client.');return}
  const {items,partial}=collectForms();
  if(partial){alert('Chaque lien doit avoir une URL http(s) valide ET un nom de produit.');return}
  if(!items.length){alert('Ajoute au moins un lien complet.');return}
  if(editingIndex!==null){
    c.products[editingIndex]=items[0];
    scheduleSave();resetForms(1);renderDetail();
    alert('Modification enregistrée.');
    return;
  }
  c.products.push(...items);
  scheduleSave();resetForms(1);renderDetail();
  alert(items.length+' lien(s) ajouté(s) à la fiche.');
};

/* ---------- rendering ---------- */
function renderClients(){let q=$('searchClient').value.toLowerCase();let shown=clients.filter(c=>(c.name+' '+c.contact).toLowerCase().includes(q));$('clientCount').textContent=clients.length+' client(s)';$('clients').innerHTML=shown.length?shown.map(c=>`<button class="clientbtn ${c.id===selectedId?'active':''}" data-client="${c.id}"><span>${esc(c.name)}<br><span class="count">${esc(c.contact||'Pas de contact')}</span></span><span class="count">${c.products.length} lien(s)</span></button>`).join(''):'<div class="empty">Aucun client. Ajoute ton premier client.</div>'}
function renderDetail(){let c=selected();$('noSelection').classList.toggle('hidden',!!c);$('clientView').classList.toggle('hidden',!c);if(!c)return;$('selectedName').textContent=c.name;$('selectedMeta').textContent=(c.contact||'Pas de contact')+' · Créé le '+c.created;$('selectedNotes').textContent=c.notes?'Notes : '+c.notes:'';$('productCount').textContent=c.products.length+' produit(s)';$('products').innerHTML=c.products.length?c.products.map((p,i)=>`<article class="product"><div class="row"><h3>${esc(p.name)}</h3><span class="count">Quantité : ${p.qty}</span></div><a href="${esc(p.link)}" target="_blank" rel="noopener noreferrer">${esc(p.link)}</a>${p.variant?'<div class="details"><b>Variante :</b> '+esc(p.variant)+'</div>':''}${p.status?'<div class="details"><b>État :</b> '+esc(p.status)+'</div>':''}${p.details?'<div class="details">'+esc(p.details)+'</div>':''}<div class="btn-row" style="margin-top:12px"><button class="secondary" data-edit-product="${i}">Modifier</button><button class="danger" data-delete-product="${i}">Supprimer</button></div></article>`).join(''):'<div class="empty">Aucun lien produit pour ce client. Ajoute le premier ci-dessus.</div>';renderClients()}

/* ---------- events ---------- */
$('addClient').onclick=()=>{let name=$('clientName').value.trim();if(!name){alert('Écris le nom du client.');return}let c={id:makeId(),name,contact:$('clientContact').value.trim(),notes:$('clientNotes').value.trim(),created:new Date().toLocaleDateString('fr-FR'),products:[]};clients.push(c);selectedId=c.id;scheduleSave();$('clientName').value='';$('clientContact').value='';$('clientNotes').value='';renderDetail()};
$('clients').onclick=e=>{let b=e.target.closest('[data-client]');if(b){selectedId=b.dataset.client;scheduleSave();resetForms(1);renderDetail()}};
$('searchClient').oninput=renderClients;
$('products').onclick=e=>{let c=selected();if(!c)return;let edit=e.target.closest('[data-edit-product]'),del=e.target.closest('[data-delete-product]');if(edit){let i=+edit.dataset.edit,p=c.products[i];resetForms(1);const b=document.querySelector('#productForms .pform');b.querySelector('[data-f="link"]').value=p.link;b.querySelector('[data-f="name"]').value=p.name;b.querySelector('[data-f="variant"]').value=p.variant||'';b.querySelector('[data-f="qty"]').value=p.qty;b.querySelector('[data-f="status"]').value=p.status||'';b.querySelector('[data-f="details"]').value=p.details||'';editingIndex=i;$('saveForms').textContent='Enregistrer la modification';$('formTitle').textContent='Modifier le lien '+(i+1);document.getElementById('formTitle').scrollIntoView({behavior:'smooth',block:'center'})}if(del&&confirm('Supprimer ce lien produit ?')){c.products.splice(+del.dataset.deleteProduct,1);scheduleSave();renderDetail()}};
$('deleteClient').onclick=()=>{let c=selected();if(c&&confirm('Supprimer cette fiche client et tous ses liens ?')){clients=clients.filter(x=>x.id!==selectedId);selectedId=null;scheduleSave();resetForms(1);renderDetail();renderClients()}};
$('export').onclick=()=>{
  if(!clients.length){alert('Aucun client à exporter.');return}
  const sep='='.repeat(52);
  let t='FICHIERS CLIENTS — SHEIN\nExporté le '+new Date().toLocaleString('fr-FR')+'\n'+sep+'\n\n';
  clients.forEach((c,ci)=>{
    t+=(ci+1)+'. CLIENT : '+c.name+'\n';
    t+='   Contact  : '+(c.contact||'—')+'\n';
    t+='   Créé le  : '+c.created+'\n';
    t+='   Notes    : '+(c.notes||'—')+'\n';
    t+='   Produits : '+c.products.length+'\n';
    c.products.forEach((p,i)=>{
      t+='   ---\n   Produit '+(i+1)+' : '+p.name+'\n';
      t+='   Lien     : '+p.link+'\n';
      t+='   Variante : '+(p.variant||'—')+'\n';
      t+='   Quantité : '+p.qty+'\n';
      t+='   État     : '+(p.status||'—')+'\n';
      t+='   Détails  : '+(p.details||'—')+'\n';
    });
    t+=sep+'\n\n';
  });
  let a=document.createElement('a'),u=URL.createObjectURL(new Blob([t],{type:'text/plain;charset=utf-8'}));a.href=u;a.download='fiches-clients.txt';a.click();URL.revokeObjectURL(u)
};
$('exportJson').onclick=()=>{let a=document.createElement('a'),u=URL.createObjectURL(new Blob([JSON.stringify(clients,null,2)],{type:'application/json'}));a.href=u;a.download='fiches-clients-produits.json';a.click();URL.revokeObjectURL(u)};
$('importBtn').onclick=()=>$('importFile').click();
$('importFile').onchange=async e=>{try{let d=JSON.parse(await e.target.files[0].text());if(!Array.isArray(d))throw 0;clients=d;selectedId=null;scheduleSave();resetForms(1);renderDetail();renderClients();alert('Sauvegarde importée.')}catch{alert('Fichier JSON invalide.')}e.target.value=''};
loadState().then(()=>{resetForms(1);renderClients();renderDetail()});
