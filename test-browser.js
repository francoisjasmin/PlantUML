const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawn}=require('node:child_process'),{pathToFileURL}=require('node:url');
const assert=require('node:assert/strict');
const browser=[process.env.PLANTUML_TEST_BROWSER,
 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
].find(p=>p&&fs.existsSync(p));
assert.ok(browser,'Définir PLANTUML_TEST_BROWSER avec le chemin de Chrome ou Edge.');
const source=fs.readFileSync('test-fixtures/mindmap-styles.puml','utf8');
const componentSource='@startuml\n'+Array.from({length:24},(_,i)=>`[Composant ${i}]`).join('\n')+'\n[Composant 0] --> [Composant 23]\n@enduml';
const entitySource='@startuml\n'+Array.from({length:8},(_,i)=>`entity E${i} {\n+type : ENUM(\'Créateur\', \'Participant\')\n}`).join('\n')+'\nE0 --> E7\n@enduml';
const noteSource=fs.readFileSync('test-fixtures/notes.puml','utf8');
const entityNoteSource=noteSource.replace('[Composant] as C','entity "Composant" as C {}').replace('[Autre composant] as D','entity "Autre composant" as D {}');
const input=JSON.stringify({source,componentSource,entitySource,noteSource,entityNoteSource}).replace(/</g,'\\u003c');
const script=`
const inputs=${input};
const reports=[];
function requireTest(condition,message){if(!condition)throw Error(message)}
function inspect(label){
 requireTest(status.className==='ok',label+': '+errors.textContent);
 const diagram=preview.querySelector('.diagram'),stage=preview.querySelector('.preview-stage');
 const bounds=preview.getBoundingClientRect(),css=getComputedStyle(preview);
 const left=bounds.left+preview.clientLeft+parseFloat(css.paddingLeft);
 const top=bounds.top+preview.clientTop+parseFloat(css.paddingTop);
 const right=left+preview.clientWidth-parseFloat(css.paddingLeft)-parseFloat(css.paddingRight);
 const bottom=top+preview.clientHeight-parseFloat(css.paddingTop)-parseFloat(css.paddingBottom);
 for(const item of [stage,diagram,...diagram.querySelectorAll('.box,.mind,.pkg')]){
  const rect=item.getBoundingClientRect();
  requireTest(rect.left>=left-1&&rect.top>=top-1&&rect.right<=right+1&&rect.bottom<=bottom+1,label+': élément hors du cadre');
 }
 const scale=Number(diagram.style.transform.match(/scale\\(([^)]+)\\)/)[1]);
 requireTest(scale>0&&scale<=1,label+': échelle invalide');
 const expected=Math.min(1,(right-left)/diagram.offsetWidth,(bottom-top)/diagram.offsetHeight);
 requireTest(Math.abs(scale-expected)<.00001,label+': échelle non réajustée');
 requireTest(preview.scrollWidth<=preview.clientWidth+1&&preview.scrollHeight<=preview.clientHeight+1,label+': débordement');
 if(diagram.querySelector('.mind,.note')){
  const boxes=[...diagram.querySelectorAll('.mind,.box')].map(n=>({text:n.textContent,r:n.getBoundingClientRect()}));
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
   const a=boxes[i].r,b=boxes[j].r;
   requireTest(a.right<=b.left+.1||b.right<=a.left+.1||a.bottom<=b.top+.1||b.bottom<=a.top+.1,label+': chevauchement '+boxes[i].text+' / '+boxes[j].text);
  }
 }
 reports.push({label,viewport:innerWidth,scale,width:diagram.offsetWidth,height:diagram.offsetHeight});
 return scale;
}
function render(label,source){code.value=source;validate();return inspect(label)}
function inspectNotes(){
 const model=parseComp(sourceLines(code.value)),boxes=[...preview.querySelectorAll('.box,.pkg')];
 const compact=text=>text.replace(/\\\\n|\\n/g,'');
 function find(object){return boxes.find(box=>
  box.classList.contains('entity')?box.querySelector('.entity-name').textContent===object.t:
  box.textContent===compact(object.t)||box.textContent===object.k+' : '+compact(object.t)
 )}
 model.relations.filter(r=>r.note).forEach(r=>{
  const target=find(r.a),note=find(r.b);requireTest(target&&note,'Objet ou note introuvable');
  const a=target.getBoundingClientRect(),b=note.getBoundingClientRect(),side=r.b.position;
  if(side==='left')requireTest(b.right<a.left,'Note à gauche');
  if(side==='right')requireTest(b.left>a.right,'Note à droite');
  if(side==='top')requireTest(b.bottom<a.top,'Note en haut');
  if(side==='bottom')requireTest(b.top>a.bottom,'Note en bas');
 });
 requireTest(boxes.some(box=>box.textContent==='Note sans lien'),'Note autonome sans lien');
}
function resized(){return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))}
async function run(){
 try{
  await document.fonts.ready;
  render('MindMap complet',inputs.source);
  const boxes=[...preview.querySelectorAll('.mind')];
  requireTest(getComputedStyle(boxes.find(n=>n.textContent==='Jeu')).backgroundColor==='rgb(255, 187, 204)','Couleur concept');
  requireTest(getComputedStyle(boxes.find(n=>n.textContent==='règlements')).backgroundColor==='rgb(173, 216, 230)','Couleur legal');
  requireTest(boxes.some(n=>n.textContent===\"Règlements des magasins d'app.\"),'Apostrophe conservée');
  const previous=preview.querySelector('.diagram').style.transform;
  preview.style.width='280px';preview.style.height='220px';
  await resized();
  inspect('Cadre rétréci automatiquement');
  requireTest(preview.querySelector('.diagram').style.transform!==previous,'Observer de redimensionnement');
  preview.style.width='';preview.style.height='';
  await resized();
  inspect('Cadre rétabli automatiquement');
  render('Composants',inputs.componentSource);
  render('Entités',inputs.entitySource);
  render('Notes des composants',inputs.noteSource);inspectNotes();
  render('Notes des entités',inputs.entityNoteSource);inspectNotes();
  render('Petit diagramme','@startmindmap\\n* Racine\\n** Enfant\\n@endmindmap');
  requireTest(reports.at(-1).scale===1,'Un petit diagramme doit conserver sa taille');
  render('Nouveau grand diagramme',inputs.source);
  code.value='@startmindmap\\n* Racine\\n*** Niveau sauté\\n@endmindmap';validate();
  requireTest(status.className==='bad'&&!preview.querySelector('.diagram'),'Erreur après aperçu');
  document.querySelector('#clear').click();
  requireTest(!preview.querySelector('.preview-stage'),'Effacement après aperçu');
  report({ok:true,reports});
 }catch(error){report({ok:false,error:error.message,reports})}
}
function report(data){
 const output=document.createElement('pre');output.id='browser-test-results';output.hidden=true;
 output.textContent=JSON.stringify(data);document.body.appendChild(output);
}
setTimeout(run,50);
`;
const taskTempRoot=path.resolve(os.tmpdir());
const taskTempDir=fs.mkdtempSync(path.join(taskTempRoot,'plantuml-preview-'));
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function checkBrowser(page,width){
 const profile=path.join(taskTempDir,'profile-'+width);
 const child=spawn(browser,['--headless','--disable-gpu','--no-first-run',
  '--disable-background-networking','--allow-file-access-from-files','--remote-debugging-port=0',
  '--user-data-dir='+profile,'about:blank'
 ],{stdio:'ignore',windowsHide:true});
 let socket;
 try{
  const portFile=path.join(profile,'DevToolsActivePort');
  for(let i=0;!fs.existsSync(portFile)&&i<200;i++)await delay(50);
  assert.ok(fs.existsSync(portFile),'Le navigateur ne démarre pas.');
  const port=fs.readFileSync(portFile,'utf8').split('\n')[0];
  const target=await (await fetch('http://127.0.0.1:'+port+'/json/new?about:blank',{method:'PUT'})).json();
  socket=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true})});
  let id=0;const pending=new Map();
  socket.addEventListener('message',event=>{
   const data=JSON.parse(event.data),entry=pending.get(data.id);
   if(entry){pending.delete(data.id);data.error?entry.reject(Error(JSON.stringify(data.error))):entry.resolve(data.result)}
  });
  function call(method,params={}){
   return new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});socket.send(JSON.stringify({id:key,method,params}))});
  }
  await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
  await call('Page.navigate',{url:pathToFileURL(page).href});
  let report;
  for(let i=0;i<200;i++){
   const evaluated=await call('Runtime.evaluate',{expression:'document.querySelector("#browser-test-results")?.textContent',returnByValue:true});
   if(evaluated.result.value){report=JSON.parse(evaluated.result.value);break}
   await delay(50);
  }
  assert.ok(report,'Pas de résultat navigateur.');
  assert.ok(report.ok,JSON.stringify(report));
  console.log('Browser preview '+width+'px: OK '+JSON.stringify(report.reports));
  await call('Browser.close');
 }finally{
  if(socket)socket.close();
  if(child.exitCode===null){child.kill();await delay(500)}
 }
}
async function main(){try{
 const html=fs.readFileSync('index.html','utf8')
  .replace('href="style.css"',`href="${pathToFileURL(path.resolve('style.css')).href}"`)
  .replace('src="app.js"',`src="${pathToFileURL(path.resolve('app.js')).href}"`)
  .replace('</body>',`<script>${script}</script></body>`);
 const page=path.join(taskTempDir,'check.html');fs.writeFileSync(page,html);
 for(const width of [1400,430])await checkBrowser(page,width);
}finally{
 // Only remove the temporary directory created by this test under the OS temp root.
 const resolved=path.resolve(taskTempDir);
 if(path.dirname(resolved)===taskTempRoot&&path.basename(resolved).startsWith('plantuml-preview-'))fs.rmSync(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}}
main().catch(error=>{console.error(error);process.exitCode=1});
