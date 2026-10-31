const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('presenca.html','utf8');
const source=fs.readFileSync('assets/roll-call.js','utf8');
const elements=new Map();
function element(){return {value:'',hidden:false,style:{},dataset:{},disabled:false,classList:{add(){},remove(){}},setAttribute(){},removeAttribute(){},append(){},addEventListener(){},querySelector(){return element();},querySelectorAll(){return []},click(){},showModal(){},close(){}};}
const context=vm.createContext({location:{protocol:'https:',hostname:'test'},document:{querySelector(selector){if(!elements.has(selector))elements.set(selector,element());return elements.get(selector);},querySelectorAll(){return []},createElement:element},window:{setTimeout(){},clearTimeout(){}},fetch:async()=>({ok:false,status:401,json:async()=>({error:'Entre novamente'})}),URL,URLSearchParams,Blob,Intl,console});
vm.runInContext(source,context);
(async()=>{
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(elements.get('#authForm').style.display,'grid');
 assert.equal(elements.get('#sessionLoading').hidden,true);
 for(const [protocol,hostname] of [['http:','localhost'],['http:','127.0.0.1'],['http:','[::1]'],['file:',''],['https:','example.test']]) {
  const requests=[];
  const local=vm.createContext({location:{protocol,hostname},document:context.document,window:context.window,
   fetch:async(url,options)=>{requests.push({url,options});return {ok:false,status:401,json:async()=>({error:'Entre novamente'})};},URL,URLSearchParams,Blob,Intl,console});
  vm.runInContext(source,local);await new Promise(resolve=>setImmediate(resolve));
  await assert.rejects(local.loginSession('admin','fictional-password'));
  assert(requests.every(request=>request.url.startsWith('/api/')),`${protocol}//${hostname} must use only same-origin API paths`);
  assert.equal(requests.at(-1).options.credentials,'same-origin');
 }
 assert(!source.includes('matriculasetdaam.pages.dev'));
 const publicPage=fs.readFileSync('inscricao.html','utf8');
 const contact=publicPage.match(/<section class="enrollment-contact"[\s\S]*?<\/section>/)?.[0];
 assert(contact,'Public contact card must exist');
 assert(contact.includes('+55 92 99475-3703'),'Keep the supplied phone unchanged');
 assert(contact.includes('PENDENTE DE CONFIRMAÇÃO'),'WhatsApp must remain pending confirmation');
 assert(/<button[^>]*class="enrollment-whatsapp-link"[^>]*\bdisabled\b/.test(contact),'WhatsApp action must be disabled');
 assert(!/href\s*=\s*["'][^"']*(?:wa\.me|whatsapp|tel:)/i.test(contact),'No active phone or WhatsApp destination before confirmation');
 for(const file of ['secretaria.html','cursos.html','inscricao.html']) {
  const page=fs.readFileSync(file,'utf8'),name=file==='inscricao.html'?'publicApiUrl':'apiBaseUrl';
  const expression=page.match(new RegExp('const '+name+' = ([\\s\\S]*?);'));
  assert(expression,'API base declaration: '+file);
  for(const [protocol,hostname] of [['http:','localhost'],['http:','127.0.0.1'],['http:','[::1]'],['file:','']]) {
   const target=vm.runInNewContext(expression[1],{location:{protocol,hostname}});
   assert(!/^https?:/.test(target),file+' must not target a remote API locally');
  }
 }

 vm.runInContext("currentAccess={role:'admin'};courseFilter.value='ALFA';classDate.value='2026-09-24'",context);
 let resolveOld,calls=0;
 context.fetch=async url=>{calls++;if(calls===1)return new Promise(resolve=>{resolveOld=resolve;});return {ok:true,json:async()=>url.includes('/attendance?')?{alerts:[]}:{rows:[{id:'new',fullName:'Novo',cpf:''}],snapshot:'new',nextCursor:null}};};
 const old=context.loadCall();vm.runInContext("classDate.value='2026-09-25'",context);await context.loadCall();
 resolveOld({ok:true,json:async()=>({rows:[{id:'old'}],snapshot:'old',nextCursor:null})});await old;
 assert.equal(vm.runInContext('callRows[0].id',context),'new');
 assert.equal(vm.runInContext('ready',context),true);
 assert.equal(context.csvCell('=1+1'),'"\'=1+1"');
 assert.equal(context.escapeHtml('<script>'),'&lt;script&gt;');
 vm.runInContext("drafts.set('new',{status:'Presente'});renderCall()",context);
 assert.equal(elements.get('#finalizeCall').disabled,true);
 assert(context.statusControls({id:'status-fixture',fullName:'Aluno fictício',record:{status:'Justificado',justification:'<script>'}}).includes('data-status="Justificado"'));
 for(const file of fs.readdirSync('.').filter(f=>f.endsWith('.html'))){const text=fs.readFileSync(file,'utf8');for(const script of text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){if(/type=["']application\/ld\+json/.test(script[1]))continue;new Function(script[2]);}}
 for(const ref of html.matchAll(/(?:src|href)="(assets\/[^"?]+)/g))assert(fs.existsSync(ref[1]),ref[1]);
 console.log('PASS: same-origin APIs on localhost/IPv4/IPv6/file, client startup, expired session, stale-response isolation, unsaved-finalization guard, status presentation, CSV escaping, HTML script syntax and attendance assets.');
})().catch(e=>{console.error(e);process.exitCode=1;});
