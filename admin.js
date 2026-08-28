import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm';
import { SUPABASE_URL, SUPABASE_KEY, resolveAsset } from './config.js';
const sb=createClient(SUPABASE_URL,SUPABASE_KEY);
const $=s=>document.querySelector(s);
const esc=s=>(s??'').toString().replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0);
let cats=[],products=[],currentImage='',removeImage=false;

function msg(el,text,ok=true){$(el).textContent=text;$(el).style.color=ok?'#a7e8b8':'#ff9292'}
async function ensureAdmin(){
  const {data:{session}}=await sb.auth.getSession();
  if(!session){showAuth();return}
  const claim=await sb.rpc('claim_bauru_admin');
  if(claim.error||claim.data!==true){await sb.auth.signOut();showAuth();msg('#authMsg','Esta conta não tem permissão para administrar este cardápio.',false);return}
  $('#authBox').classList.add('hidden');$('#panel').classList.remove('hidden');await loadData();
}
function showAuth(){ $('#authBox').classList.remove('hidden');$('#panel').classList.add('hidden') }

$('#authForm').addEventListener('submit',async e=>{e.preventDefault();msg('#authMsg','Entrando...');
 const {error}=await sb.auth.signInWithPassword({email:$('#email').value.trim(),password:$('#password').value});
 if(error){msg('#authMsg',error.message,false);return} await ensureAdmin();
});
$('#signupBtn').addEventListener('click',async()=>{msg('#authMsg','Criando acesso...');
 const {data,error}=await sb.auth.signUp({email:$('#email').value.trim(),password:$('#password').value});
 if(error){msg('#authMsg',error.message,false);return}
 if(data.session){msg('#authMsg','Acesso criado. Ativando administração...');await ensureAdmin()}
 else msg('#authMsg','Conta criada. Confira seu e-mail para confirmar o cadastro e depois volte para entrar.');
});
$('#logout').addEventListener('click',async()=>{await sb.auth.signOut();showAuth()});

async function loadData(){
 const [c,p]=await Promise.all([sb.from('menu_categories').select('*').order('sort_order'),sb.from('menu_products').select('*,menu_categories(name,slug)').order('sort_order')]);
 if(c.error||p.error){msg('#saveMsg','Erro ao carregar os dados.',false);return}
 cats=c.data||[];products=p.data||[];
 $('#category').innerHTML=cats.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');
 renderList(); if(products.length) edit(products[0].id); else resetForm();
}
function renderList(){
 const q=$('#filter').value.trim().toLowerCase();
 const list=products.filter(p=>(p.name+' '+(p.menu_categories?.name||'')).toLowerCase().includes(q));
 $('#adminList').innerHTML=list.map(p=>`<button class="admin-item" data-id="${p.id}"><strong>${esc(p.name)}</strong><small>${esc(p.menu_categories?.name||'')} • ${money(p.price)} • ${p.visible?'visível':'oculto'}</small></button>`).join('');
}
function resetForm(){
 $('#productForm').reset();$('#id').value='';$('#visible').checked=true;$('#preview').classList.add('hidden');currentImage='';removeImage=false;$('#removeImageBtn').classList.add('hidden');$('#deleteBtn').classList.add('hidden');msg('#saveMsg','');
}
function edit(id){
 const p=products.find(x=>x.id===id);if(!p)return;$('#id').value=p.id;$('#name').value=p.name;$('#category').value=p.category_id;$('#price').value=p.price;$('#description').value=p.description||'';$('#visible').checked=p.visible;$('#featured').checked=p.featured;currentImage=p.image_url||'';
 removeImage=false;if(currentImage){$('#preview').src=resolveAsset(currentImage);$('#preview').classList.remove('hidden');$('#removeImageBtn').classList.remove('hidden')}else{$('#preview').classList.add('hidden');$('#removeImageBtn').classList.add('hidden')};
 $('#deleteBtn').classList.remove('hidden');document.querySelectorAll('.admin-item').forEach(b=>b.classList.toggle('active',b.dataset.id===id));msg('#saveMsg','');
}
$('#adminList').addEventListener('click',e=>{const b=e.target.closest('[data-id]');if(b)edit(b.dataset.id)});
$('#filter').addEventListener('input',renderList);
$('#newProduct').addEventListener('click',resetForm);
$('#image').addEventListener('change',e=>{const f=e.target.files[0];if(f){removeImage=false;$('#preview').src=URL.createObjectURL(f);$('#preview').classList.remove('hidden');$('#removeImageBtn').classList.remove('hidden')}});
$('#removeImageBtn').addEventListener('click',()=>{removeImage=true;currentImage='';$('#image').value='';$('#preview').removeAttribute('src');$('#preview').classList.add('hidden');$('#removeImageBtn').classList.add('hidden');msg('#saveMsg','Foto marcada para remoção. Toque em Salvar alterações.');});

async function uploadImage(file,id){
 if(removeImage)return null;
 if(!file)return currentImage||null;
 const ext=(file.name.split('.').pop()||'jpg').toLowerCase();
 const path=`products/${id}/${Date.now()}.${ext}`;
 const {error}=await sb.storage.from('menu-images').upload(path,file,{upsert:true,contentType:file.type});
 if(error)throw error;
 return sb.storage.from('menu-images').getPublicUrl(path).data.publicUrl;
}
$('#productForm').addEventListener('submit',async e=>{e.preventDefault();msg('#saveMsg','Salvando...');
 try{
   let id=$('#id').value;
   const base={name:$('#name').value.trim(),category_id:$('#category').value,price:Number($('#price').value)||0,description:$('#description').value.trim(),visible:$('#visible').checked,featured:$('#featured').checked};
   if(!id){const ins=await sb.from('menu_products').insert({...base,image_url:null}).select('id').single();if(ins.error)throw ins.error;id=ins.data.id}
   const imageUrl=await uploadImage($('#image').files[0],id);
   const up=await sb.from('menu_products').update({...base,image_url:imageUrl}).eq('id',id);if(up.error)throw up.error;
   msg('#saveMsg','Salvo. O cardápio público já está atualizado.');$('#image').value='';await loadData();edit(id);
 }catch(err){msg('#saveMsg',err.message||'Erro ao salvar.',false)}
});
$('#deleteBtn').addEventListener('click',async()=>{const id=$('#id').value;if(!id||!confirm('Excluir este produto?'))return;const {error}=await sb.from('menu_products').delete().eq('id',id);if(error){msg('#saveMsg',error.message,false);return}await loadData();resetForm()});
ensureAdmin();
