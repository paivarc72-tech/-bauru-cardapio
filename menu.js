import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm';
import { SUPABASE_URL, SUPABASE_KEY, resolveAsset } from './config.js';
const sb=createClient(SUPABASE_URL,SUPABASE_KEY);
const $=s=>document.querySelector(s);
const esc=s=>(s??'').toString().replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0);
let categories=[],products=[],active='featured',query='';

async function boot(){
  const [cs,ps,ss]=await Promise.all([
    sb.from('menu_categories').select('*').order('sort_order'),
    sb.from('menu_products').select('*,menu_categories(name,slug)').order('sort_order'),
    sb.from('site_settings').select('*').eq('id',1).single()
  ]);
  if(cs.error||ps.error){$('#products').innerHTML='<div class="empty">Não foi possível carregar o cardápio agora.</div>';return}
  categories=cs.data||[]; products=ps.data||[];
  if(ss.data){
    $('#brand').textContent=ss.data.brand||'BAURU'; $('#subtitle').textContent=ss.data.subtitle||'';
    $('#headline').textContent=ss.data.headline||''; $('#intro').textContent=ss.data.intro||'';
    if(ss.data.logo_url) $('#logo').src=resolveAsset(ss.data.logo_url);
    $('#notes').innerHTML=[ss.data.service_note,ss.data.cover_note,ss.data.portion_note].filter(Boolean).map(x=>`<div class="note">${esc(x)}</div>`).join('');
  }
  renderChips(); render();
}
function renderChips(){
  $('#chips').innerHTML=`<button class="chip active" data-cat="featured">Destaques</button>`+categories.map(c=>`<button class="chip" data-cat="${esc(c.slug)}">${esc(c.name)}</button>`).join('');
}
function render(){
  const q=query.toLowerCase();
  let list=products.filter(p=>{
    const cat=p.menu_categories?.slug||'';
    const catOk=active==='featured'?p.featured:cat===active;
    const text=(p.name+' '+(p.description||'')+' '+(p.menu_categories?.name||'')).toLowerCase();
    return catOk&&(!q||text.includes(q));
  });
  if(query) list=products.filter(p=>(p.name+' '+(p.description||'')+' '+(p.menu_categories?.name||'')).toLowerCase().includes(q));
  const catObj=categories.find(c=>c.slug===active);
  $('#sectionName').textContent=query?'Resultados da busca':active==='featured'?'Destaques':(catObj?.name||'Cardápio');
  $('#count').textContent=`${list.length} ${list.length===1?'item':'itens'}`;
  $('#products').innerHTML=list.length?list.map(p=>`<article class="product">
    <div class="product-img">${p.image_url?`<img loading="lazy" src="${esc(resolveAsset(p.image_url))}" alt="${esc(p.name)}">`:''}</div>
    <div class="product-body"><div class="product-top"><h3>${esc(p.name)}</h3><div class="price">${money(p.price)}</div></div>
    ${p.description?`<p class="desc">${esc(p.description)}</p>`:''}${p.featured?'<span class="badge">DESTAQUE</span>':''}</div></article>`).join(''):'<div class="empty">Nenhum item encontrado.</div>';
}
$('#chips').addEventListener('click',e=>{const b=e.target.closest('[data-cat]');if(!b)return;active=b.dataset.cat;query='';$('#search').value='';document.querySelectorAll('.chip').forEach(x=>x.classList.toggle('active',x===b));render()});
$('#search').addEventListener('input',e=>{query=e.target.value.trim();render()});
boot();
