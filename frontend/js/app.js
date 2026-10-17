const $ = id => document.getElementById(id);
let clients = [];
let selectedId = null;
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
  // fallback localStorage
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

function renderClients(){let q=$('searchClient').value.toLowerCase();let shown=clients.filter(c=>(c.name+' '+c.contact).toLowerCase().includes(q));$('clientCount').textContent=clients.length+' client(s)';$('clients').innerHTML=shown.length?shown.map(c=>`<button class="clientbtn ${c.id===selectedId?'active':''}" data-client="${c.id}"><span>${esc(c.name)}<br><span class="count">${esc(c.contact||'Pas de contact')}</span></span><span class="count">${c.products.length} lien(s)</span></button>`).join(''):'<div class="empty">Aucun client. Ajoute ton premier client.</div>'}
function renderDetail(){let c=selected();$('noSelection').classList.toggle('hidden',!!c);$('clientView').classList.toggle('hidden',!c);if(!c)return;$('selectedName').textContent=c.name;$('selectedMeta').textContent=(c.contact||'Pas de contact')+' · Créé le '+c.created;$('selectedNotes').textContent=c.notes?'Notes : '+c.notes:'';$('productCount').textContent=c.products.length+' produit(s)';$('products').innerHTML=c.products.length?c.products.map((p,i)=>`<article class="product"><div class="row"><h3>${esc(p.name)}</h3><span class="count">Quantité : ${p.qty}</span></div><a href="${esc(p.link)}" target="_blank" rel="noopener noreferrer">${esc(p.link)}</a>${p.variant?'<div class="details"><b>Variante :</b> '+esc(p.variant)+'</div>':''}${p.status?'<div class="details"><b>État :</b> '+esc(p.status)+'</div>':''}${p.details?'<div class="details">'+esc(p.details)+'</div>':''}<div style="margin-top:10px"><button class="secondary" data-edit-product="${i}">Modifier</button><button class="danger" data-delete-product="${i}">Supprimer</button></div></article>`).join(''):'<div class="empty">Aucun lien produit pour ce client. Ajoute le premier ci-dessus.</div>';renderClients()}
function clearProduct(){['productLink','productName','productVariant','productDetails','productStatus'].forEach(id=>$(id).value='');$('productQty').value=1;delete $('addProduct').dataset.edit;$('addProduct').textContent='Ajouter à la fiche client'}
function renderMultiLinkForms(n){n=Math.max(1,Math.min(20,Math.floor(Number(n)||1)));$('linkTarget').value=n;if(n===1){$('multiLinkForms').innerHTML='';return}let forms='';for(let i=1;i<=n;i++){forms+=`<div class="product"><h3>Lien ${i}</h3><label>URL du produit *</label><input type="url" data-batch-link="${i}" placeholder="https://..."><label>Nom du produit *</label><input data-batch-name="${i}" placeholder="Nom du produit"><div class="formgrid"><div><label>Couleur / modèle / taille</label><input data-batch-variant="${i}" placeholder="Optionnel"></div><div><label>Quantité</label><input data-batch-qty="${i}" type="number" min="1" value="1"></div></div><label>État</label><input data-batch-status="${i}" placeholder="Ex. à confirmer"><label>Autres détails</label><textarea data-batch-details="${i}" placeholder="Optionnel"></textarea></div>`}forms+=`<button id="saveBatchLinks" type="button">Enregistrer les ${n} liens</button>`;$('multiLinkForms').innerHTML=forms}

$('changeLinkCount').onclick=()=>renderMultiLinkForms($('linkTarget').value);
$('multiLinkForms').onclick=e=>{if(e.target.id!=='saveBatchLinks')return;let c=selected();if(!c){alert('Choisis un client.');return}let n=Number($('linkTarget').value)||1,items=[];for(let i=1;i<=n;i++){let link=linkOk($(`[data-batch-link="${i}"]`).value.trim()),name=$(`[data-batch-name="${i}"]`).value.trim();if(!link||!name){alert(`Complète le lien et le nom du produit ${i}.`);return}items.push({link,name,variant:$(`[data-batch-variant="${i}"]`).value.trim(),qty:Math.max(1,Math.floor(Number($(`[data-batch-qty="${i}"]`).value)||1)),status:$(`[data-batch-status="${i}"]`).value.trim(),details:$(`[data-batch-details="${i}"]`).value.trim()})}c.products.push(...items);scheduleSave();renderMultiLinkForms(1);renderDetail();alert(`${items.length} lien(s) ajouté(s) à la fiche.`)};
$('addClient').onclick=()=>{let name=$('clientName').value.trim();if(!name){alert('Écris le nom du client.');return}let c={id:makeId(),name,contact:$('clientContact').value.trim(),notes:$('clientNotes').value.trim(),created:new Date().toLocaleDateString('fr-FR'),products:[]};clients.push(c);selectedId=c.id;scheduleSave();$('clientName').value='';$('clientContact').value='';$('clientNotes').value='';renderDetail()};
$('clients').onclick=e=>{let b=e.target.closest('[data-client]');if(b){selectedId=b.dataset.client;clearProduct();scheduleSave();renderDetail()}};
$('searchClient').oninput=renderClients;
$('addProduct').onclick=()=>{let c=selected();if(!c){alert('Choisis un client.');return}let link=linkOk($('productLink').value.trim()),name=$('productName').value.trim();if(!link||!name){alert('Ajoute un lien http(s) valide et le nom du produit.');return}let p={link,name,variant:$('productVariant').value.trim(),qty:Math.max(1,Math.floor(Number($('productQty').value)||1)),status:$('productStatus').value.trim(),details:$('productDetails').value.trim()};let edit=$('addProduct').dataset.edit;if(edit!==undefined)c.products[Number(edit)]=p;else c.products.push(p);scheduleSave();clearProduct();renderDetail()};
$('clearProduct').onclick=clearProduct;
$('products').onclick=e=>{let c=selected();if(!c)return;let edit=e.target.closest('[data-edit-product]'),del=e.target.closest('[data-delete-product]');if(edit){let i=+edit.dataset.edit,p=c.products[i];$('productLink').value=p.link;$('productName').value=p.name;$('productVariant').value=p.variant;$('productQty').value=p.qty;$('productStatus').value=p.status;$('productDetails').value=p.details;$('addProduct').dataset.edit=i;$('addProduct').textContent='Enregistrer la modification';window.scrollTo({top:0,behavior:'smooth'})}if(del&&confirm('Supprimer ce lien produit ?')){c.products.splice(+del.dataset.deleteProduct,1);scheduleSave();renderDetail()}};
$('deleteClient').onclick=()=>{let c=selected();if(c&&confirm('Supprimer cette fiche client et tous ses liens ?')){clients=clients.filter(x=>x.id!==selectedId);selectedId=null;clearProduct();scheduleSave();renderDetail();renderClients()}};
$('export').onclick=()=>{let a=document.createElement('a'),u=URL.createObjectURL(new Blob([JSON.stringify(clients,null,2)],{type:'application/json'}));a.href=u;a.download='fiches-clients-produits.json';a.click();URL.revokeObjectURL(u)};
$('importBtn').onclick=()=>$('importFile').click();
$('importFile').onchange=async e=>{try{let d=JSON.parse(await e.target.files[0].text());if(!Array.isArray(d))throw 0;clients=d;selectedId=null;scheduleSave();renderDetail();renderClients();alert('Sauvegarde importée.')}catch{alert('Fichier JSON invalide.')}e.target.value=''};
loadState().then(()=>{renderClients();renderDetail();renderMultiLinkForms(1)});
