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
 for(const file of fs.readdirSync('.').filter(f=>f.endsWith('.html'))){const text=fs.readFileSync(file,'utf8');for(const script of text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){if(/type=["']application\/ld\+json/.test(script[1]))continue;new Function(script[2]);}}
 for(const ref of html.matchAll(/(?:src|href)="(assets\/[^"?]+)/g))assert(fs.existsSync(ref[1]),ref[1]);
 console.log('PASS: client startup, expired session, stale-response isolation, unsaved-finalization guard, CSV escaping, HTML script syntax and attendance assets.');
})().catch(e=>{console.error(e);process.exitCode=1;});
