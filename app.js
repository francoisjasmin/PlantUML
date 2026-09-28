const q=s=>document.querySelector(s), code=q("#code"), nums=q("#nums"), errors=q("#errors"), status=q("#status"), preview=q("#preview");
function number(){nums.textContent=Array.from({length:Math.max(1,code.value.split("\n").length)},(_,i)=>i+1).join("\n")}
code.oninput=number; code.onscroll=()=>nums.scrollTop=code.scrollTop;
code.onkeydown=e=>{if(e.key==="Tab"){e.preventDefault();let a=code.selectionStart,b=code.selectionEnd;code.value=code.value.slice(0,a)+"  "+code.value.slice(b);code.selectionStart=code.selectionEnd=a+2;number()} if(e.ctrlKey&&e.key==="Enter"){e.preventDefault();validate()}};
q("#clear").onclick=()=>{code.value="";number();errors.innerHTML="<p>Écrivez votre diagramme puis cliquez sur <b>Valider</b>.</p>";preview.innerHTML="<p>L’aperçu apparaîtra ici si la syntaxe reconnue est valide.</p>";status.className="";status.textContent="En attente"};
q("#validate").onclick=validate;
const clean=s=>{let quoted=false;for(let i=0;i<s.length;i++){if(s[i]==='"')quoted=!quoted;if(s[i]==="'"&&!quoted)return s.slice(0,i).trim()}return s.trim()};
function sourceLines(source){
 let inNote=false;
 return source.replace(/\r/g,'').split('\n').map((raw,i)=>{
  const s=inNote?raw.trim():clean(raw);
  if(/^end\s*note$/i.test(clean(raw)))inNote=false;
  else if(/^note\s+(?:(?:left|right|top|bottom)\s+of\s+(?:"[^"]+"|\[[^\]]+\]|[\w.]+)|as\s+[\w.]+)$/i.test(s))inNote=true;
  return {n:i+1,s,raw};
 }).filter(x=>x.s);
}
const E=(a,n,m)=>a.push({n,m});
function validate(){
 let L=sourceLines(code.value), e=[], type="";
 if(!L.length){show([{n:1,m:"Le diagramme est vide."}],"");return}
 if(L[0].s.toLowerCase()==="@startmindmap")type="mind"; else if(L[0].s.toLowerCase()==="@startuml")type="comp"; else E(e,L[0].n,"Début de diagramme non reconnu.");
 if(type==="mind"&&L.at(-1).s.toLowerCase()!=="@endmindmap")E(e,L.at(-1).n,"Fin de MindMap non reconnue.");
 if(type==="comp"&&L.at(-1).s.toLowerCase()!=="@enduml")E(e,L.at(-1).n,"Fin de diagramme non reconnue.");
 type==="mind"?checkMind(L,e):type==="comp"&&checkComp(L,e); show(e,type,L)
}
function mindNode(s){
 let m=s.match(/^([*+#]+|[-]+)(?:_)?\s+(.+)$/);
 if(!m)return null;
 let marks=m[1];
 return {depth:marks.length,text:m[2].trim(),side:marks[0]==="-"?"l":marks[0]==="+"?"r":null};
}
function checkMind(L,e){
 let root=0,prev=0,seen=false;
 L.slice(1,-1).forEach(x=>{let s=x.s;if(/^(left|right) side$/i.test(s)||/^skinparam\b/i.test(s))return;
  let m=mindNode(s);if(!m){E(e,x.n,"Instruction MindMap non reconnue.");return}
  let d=m.depth;if(d===1)root++;if(seen&&d>prev+1)E(e,x.n,"Niveau de MindMap sauté.");prev=d;seen=true
 });if(!root)E(e,L[0].n,"Aucun nœud racine reconnu.");if(root>1)E(e,L[0].n,"Plus d’un nœud racine détecté.")
}
// Shared component/entity grammar for validation and preview.
const compName = String.raw`(?:"[^"\n]+"|\[[^\]\n]+\]|[A-Za-z_][\w.]*)`;
const compAlias = String.raw`(?:\s+as\s+([A-Za-z_][\w.]*))?`;
const unquote = s => /^["\[]/.test(s) ? s.slice(1,-1) : s;
function parseComp(L,e=[]){
 const nodes=[],groups=[],relations=[],stack=[],refs=new Map();
 let note=null,entity=null,skin=null,title='';
 const entityStyle={backgroundcolor:'#D6EAF8',bordercolor:'#1F618D',fontcolor:'black'};
 function setEntityStyle(key,value,n){
  key=key.toLowerCase();
  if(!(key in entityStyle))return;
  // Only color tokens can reach inline CSS; other PlantUML settings are ignored.
  if(/^(?:#[\da-f]{3}|#[\da-f]{6}|#[\da-f]{8}|[a-z]+)$/i.test(value))entityStyle[key]=value;
  else E(e,n,'Couleur entity non reconnue.');
 }
 const current=()=>stack.at(-1)||null;
 function declare(token,alias,kind,group=current()){
  const label=unquote(token),id=alias||label;
  let node=refs.get(id);
  if(!node){node={id,t:label,k:kind,group};nodes.push(node)}
  else {node.t=label;node.k=kind;if(!node.group)node.group=group}
  refs.set(id,node);refs.set(label,node);return node;
 }
 function resolve(token,group){
  const label=unquote(token);
  return refs.get(label)||declare(token,null,token.startsWith('[')?'component':nodes.some(n=>n.k==='entity')?'entity':'interface',group);
 }
 for(const x of L.slice(1,-1)){
  const s=x.s;let m;
  if(note){if(/^end\s*note$/i.test(clean(s))){note.node.t=note.text.join('\n');note=null}else note.text.push((x.raw??s).trim());continue}
  if(skin){
   if(s==='}'){skin=null;continue}
   m=s.match(/^(\w+)\s+([^{}]+)$/);
   if(!m)E(e,x.n,'Paramètre skinparam non reconnu.');
   else if(skin.kind==='entity')setEntityStyle(m[1],m[2].trim(),x.n);
   continue;
  }
  if(entity){
   if(s==='}'){entity=null;continue}
   if(/^(?:-{2,}|\.{2,}|={2,}|_{2,})$/.test(s))entity.node.attributes.push({separator:true});
   else if(/^[+~#*\-]?\s*(?:"[^"]+"|[\p{L}_][\p{L}\p{N}_]*)(?:\s*:\s*[^{}]+)?$/u.test(s))entity.node.attributes.push({text:s});
   else E(e,x.n,'Attribut d’entité non reconnu (ex. : +Id : int [PK]).');
   continue;
  }
  if(!s||s.startsWith("'"))continue;
  m=s.match(/^skinparam\s+(\w+)\s*\{$/i);
  if(m){skin={kind:m[1].toLowerCase(),n:x.n};continue}
  m=s.match(/^skinparam\s+entity(BackgroundColor|BorderColor|FontColor)\s+(.+)$/i);
  if(m){setEntityStyle(m[1],m[2],x.n);continue}
  m=s.match(/^title\s+(.+)$/i);
  if(m){title=m[1];continue}
  if(/^(skinparam|caption)\b/i.test(s))continue;
  m=s.match(new RegExp(`^entity\\s+(${compName})${compAlias}\\s*(\\{\\s*(\\})?)?$`,'i'));
  if(m){const node=declare(m[1],m[2],'entity');node.attributes=[];if(m[3]&&!m[4])entity={node,n:x.n};continue}
  if(s==='}'){if(!stack.length)E(e,x.n,'« } » sans regroupement ouvert.');else stack.pop();continue}
  m=s.match(new RegExp(`^(package|node|folder|frame|cloud|database|rectangle)(?:\\s+(${compName})${compAlias})?\\s*\\{$`,'i'));
  if(m){const g={t:m[2]?unquote(m[2]):m[1],k:m[1].toLowerCase(),parent:current(),n:x.n};groups.push(g);stack.push(g);continue}
  m=s.match(new RegExp(`^note\\s+(left|right|top|bottom)\\s+of\\s+(${compName})(?:\\s*:\\s*(.*))?$`,'i'));
  if(m){const node={id:`@note${x.n}`,t:m[3]||'',k:'note',group:current(),position:m[1].toLowerCase()};nodes.push(node);relations.push({from:m[2],to:node.id,arrow:'..',group:current(),note:true});refs.set(node.id,node);if(m[3]===undefined)note={node,text:[],n:x.n};continue}
  m=s.match(/^note\s+"([^"]+)"\s+as\s+([A-Za-z_][\w.]*)$/i);
  if(m){declare('"'+m[1]+'"',m[2],'note');continue}
  m=s.match(/^note\s+as\s+([A-Za-z_][\w.]*)$/i);
  if(m){const node=declare(m[1],null,'note');note={node,text:[],n:x.n};continue}
  m=s.match(new RegExp(`^(?:(component|interface|database)\\s+|([()]{2})\\s*)?(${compName})${compAlias}$`,'i'));
  if(m && (m[1]||m[2]==='()'||m[3].startsWith('['))){declare(m[3],m[4],m[2]?'interface':(m[1]||'component').toLowerCase());continue}
  m=s.match(new RegExp(`^(${compName})(?:\\s+"([^"\\n]+)")?\\s*([<ox*+#]?(?:[-.=]+(?:left|right|up|down|[lrud])?[-.=]*)[>ox*+#]?)(?:\\s*"([^"\\n]+)"\\s*)?\\s*(${compName})(?:\\s*:\\s*(.+))?$`,'i'));
  if(m){relations.push({from:m[1],to:m[5],arrow:m[3],label:m[6]||'',fromCardinality:(m[2]||'').replace(/\\\*/g,'*'),toCardinality:(m[4]||'').replace(/\\\*/g,'*'),group:current()});continue}
  E(e,x.n,'Instruction de diagramme de composants ou entité-relation non reconnue.');
 }
 if(note)E(e,note.n,'Bloc note non terminé par « end note ».');
 if(entity)E(e,entity.n,'Entité non fermée par « } ».');
 if(skin)E(e,skin.n,'Bloc skinparam non fermé par « } ».');
 stack.forEach(g=>E(e,g.n,'Regroupement non fermé par « } ».'));
 // Resolve after all declarations so forward aliases retain their explicit type.
 relations.forEach(r=>{r.a=resolve(r.from,r.group);r.b=resolve(r.to,r.group)});
 return {nodes,groups,relations,title,entityStyle};
}
function checkComp(L,e){return parseComp(L,e)}
function show(e,type,L){
 if(e.length){status.className="bad";status.textContent=e.length+" erreur"+(e.length>1?"s":"");errors.innerHTML=e.map(x=>`<div class=err><b>Ligne ${x.n}</b> — ${html(x.m)}</div>`).join("");preview.innerHTML="<p>Aperçu non généré tant que des erreurs de syntaxe reconnues sont présentes.</p>";return}
 status.className="ok";status.textContent="Syntaxe reconnue";errors.innerHTML='<div class=good>Aucune erreur détectée dans la syntaxe prise en charge.</div>';type==="mind"?drawMind(L):drawComp(L)
}
function html(s){return s.replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}
function drawMind(L){
 let ns=[],side="r",parents={};L.slice(1,-1).forEach(x=>{if(/^left side$/i.test(x.s)){side="l";return}if(/^right side$/i.test(x.s)){side="r";return}
 let m=mindNode(x.s);if(!m)return;let d=m.depth,id=ns.length,p=d===1?null:parents[d-1],nodeSide=d===1?"c":(m.side||side);ns.push({id,d,t:m.text,p,side:nodeSide});parents[d]=id});
 let left=ns.filter(n=>n.side==="l"),right=ns.filter(n=>n.side==="r"),pos={};let H=Math.max(340,Math.max(left.length,right.length,1)*65+80);let root=ns.find(n=>n.d===1);if(root)pos[root.id]={x:350,y:H/2};
 [left,right].forEach((a,k)=>a.forEach((n,i)=>pos[n.id]={x:k?350+n.d*120:350-n.d*120,y:45+i*((H-90)/Math.max(1,a.length-1))}));
 let line=ns.filter(n=>n.p!==null&&pos[n.p]&&pos[n.id]).map(n=>`<line x1="${pos[n.p].x}" y1="${pos[n.p].y}" x2="${pos[n.id].x}" y2="${pos[n.id].y}" stroke="#64748b"/>`).join("");
 let boxes=ns.map(n=>pos[n.id]?`<div class=mind style="left:${pos[n.id].x-55}px;top:${pos[n.id].y-18}px">${html(n.t)}</div>`:"").join("");
 preview.innerHTML=`<div class=diagram style="height:${H}px"><svg class=lines>${line}</svg>${boxes}</div>`
}
function drawComp(L){
 const model=parseComp(L),{nodes,groups,relations}=model;
 if(nodes.some(n=>n.k==='entity')){drawEntities(model);return}
 const display=s=>html(s).replace(/\\n|\n/g,'<br>');
 let cursor=30;
 function layout(parent,depth){
  const start=cursor;
  if(parent)cursor+=36;
  nodes.filter(n=>n.group===parent).forEach((n,i)=>{
   n.x=40+depth*25+(i%3)*220;n.y=cursor;
   n.h=Math.max(54,30+n.t.split(/\\n|\n/).length*20);
   if(i%3===2)cursor+=Math.max(...nodes.filter(v=>v.group===parent).slice(i-2,i+1).map(v=>v.h))+60;
  });
  const own=nodes.filter(n=>n.group===parent),remainder=own.length%3;
  if(remainder)cursor+=Math.max(...own.slice(-remainder).map(n=>n.h))+60;
  groups.filter(g=>g.parent===parent).forEach(g=>layout(g,depth+1));
  if(parent){cursor=Math.max(cursor,start+90)+20;Object.assign(parent,{x:20+depth*25,y:start,w:700,h:cursor-start-10})}
 }
 layout(null,0);
 const groupRight=Math.max(720,...groups.map(g=>g.x+g.w));
 const depth=g=>g.parent?depth(g.parent)+1:0;
 const groupBoxes=groups.map(g=>`<div class="pkg" style="left:${g.x}px;top:${g.y}px;width:${groupRight-g.x-depth(g)*10}px;height:${g.h}px">${html(g.k)} : ${display(g.t)}</div>`).join('');
 // Clip connections to the box edges so their arrowheads remain visible.
 function edge(a,b){
  const dx=b.x-a.x,dy=b.y+b.h/2-a.y-a.h/2;
  const scale=1/Math.max(Math.abs(dx)/85,Math.abs(dy)/(a.h/2));
  return {x:a.x+85+(dx?dx*scale:0),y:a.y+a.h/2+(dy?dy*scale:0)};
 }
 const lines=relations.map(r=>{
  const start=edge(r.a,r.b),end=edge(r.b,r.a),x1=start.x,y1=start.y,x2=end.x,y2=end.y;
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#4b5563" stroke-width="2" ${r.arrow.includes('.')?'stroke-dasharray="5 5"':''} ${r.arrow.startsWith('<')?'marker-start="url(#arrowStart)"':''} ${r.arrow.endsWith('>')?'marker-end="url(#arrowEnd)"':''}/>${r.label?`<text x="${(x1+x2)/2}" y="${(y1+y2)/2-8}" text-anchor="middle">${html(r.label)}</text>`:''}`;
 }).join('');
 const boxes=nodes.map(n=>`<div class="box ${n.k==='interface'?'iface':n.k==='note'?'note':''}" style="left:${n.x}px;top:${n.y}px;width:170px;min-height:${n.h}px">${n.k==='database'?'DB: ':''}${display(n.t)}</div>`).join('');
 const width=Math.max(740,...groups.map(g=>g.x+g.w+20),...nodes.map(n=>n.x+190));
 preview.innerHTML=`<div class="diagram" style="height:${Math.max(340,cursor)}px;min-width:${width}px">${groupBoxes}<svg class="lines"><defs><marker id="arrowEnd" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M 0 0 L 10 5 L 0 10" fill="#4b5563"/></marker><marker id="arrowStart" viewBox="0 0 10 10" refX="0" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M 10 0 L 0 5 L 10 10" fill="#4b5563"/></marker></defs>${lines}</svg>${boxes}</div>`;
}
function drawEntities({nodes,relations,title,entityStyle}){
 const display=s=>html(s).replace(/\\n|\n/g,'<br>');
 const links=relations.filter(r=>!r.note),attachments=relations.filter(r=>r.note);
 const attached=new Set(attachments.map(r=>r.b));
 const main=nodes.filter(n=>!attached.has(n));
 const noteWidth=250,noteGap=24,laneGap=72;
 const boxWidth=Math.max(280,Math.min(640,Math.max(...main.map(n=>Math.max(n.t.length,...(n.attributes||[]).filter(a=>!a.separator).map(a=>a.text.length))))*8+28));
 const boxX=noteWidth+80+Math.max(1,links.length)*laneGap;
 let cursor=title?80:30;
 function noteHeight(n){return 24+n.t.split(/\\n|\n/).reduce((sum,line)=>sum+Math.max(1,Math.ceil(line.length/29)),0)*20}
 const sumHeight=list=>list.reduce((sum,n)=>sum+n.h+noteGap,0);
 main.forEach(n=>{
  n.w=boxWidth;
  n.h=n.k==='entity'?44+(n.attributes||[]).reduce((sum,a)=>sum+(a.separator?12:Math.max(1,Math.ceil(a.text.length/((boxWidth-28)/8)))*24),0):noteHeight(n);
  n.h=Math.max(60,n.h);
  const sides={left:[],right:[],top:[],bottom:[]};
  attachments.filter(r=>r.a===n).forEach(r=>{r.b.w=noteWidth;r.b.h=noteHeight(r.b);sides[r.b.position].push(r.b)});
  let topY=cursor;
  sides.top.forEach(v=>{v.x=boxX+(boxWidth-noteWidth)/2;v.y=topY;topY+=v.h+noteGap});
  n.x=boxX;n.y=topY;
  for(const side of ['left','right']){
   let noteY=topY;
   sides[side].forEach(v=>{v.x=side==='left'?24:boxX+boxWidth+60;v.y=noteY;noteY+=v.h+noteGap});
  }
  cursor=topY+Math.max(n.h,sumHeight(sides.left),sumHeight(sides.right))+noteGap;
  sides.bottom.forEach(v=>{v.x=boxX+(boxWidth-noteWidth)/2;v.y=cursor;cursor+=v.h+noteGap});
  cursor+=70;
 });
 // Each relationship gets a lane beside the entities, clear of attributes and notes.
 const ports=new Map(main.map(n=>[n,[]]));
 links.forEach(r=>{for(const side of ['a','b']){const list=ports.get(r[side]);if(list)list.push({r,side})}});
 function port(r,side){
  const n=r[side],list=ports.get(n)||[],index=list.findIndex(p=>p.r===r&&p.side===side);
  return {x:n.x,y:n.y+18+(index+1)*(n.h-36)/(list.length+1)};
 }
 function markers(r){return `${r.arrow.startsWith('<')?' marker-start="url(#erArrowStart)"':''}${r.arrow.endsWith('>')?' marker-end="url(#erArrowEnd)"':''}`}
 const paths=links.map((r,i)=>{
  const a=port(r,'a'),b=port(r,'b'),lane=boxX-60-i*laneGap;
  const labelX=lane-10,labelY=(a.y+b.y)/2;
  return `<path d="M ${a.x} ${a.y} H ${lane} V ${b.y} H ${b.x}" fill="none" stroke="#4b5563" stroke-width="2"${r.arrow.includes('.')?' stroke-dasharray="5 5"':''}${markers(r)}/>`+
   (r.label?`<text class="er-link-label" x="${labelX}" y="${labelY}" text-anchor="middle" transform="rotate(-90 ${labelX} ${labelY})">${html(r.label)}</text>`:'')+
   (r.fromCardinality?`<text class="er-cardinality" x="${a.x-8}" y="${a.y-7}" text-anchor="end">${html(r.fromCardinality)}</text>`:'')+
   (r.toCardinality?`<text class="er-cardinality" x="${b.x-8}" y="${b.y-7}" text-anchor="end">${html(r.toCardinality)}</text>`:'');
 }).join('');
 function edge(a,b){
  const dx=b.x+b.w/2-a.x-a.w/2,dy=b.y+b.h/2-a.y-a.h/2;
  const scale=1/Math.max(Math.abs(dx)/(a.w/2),Math.abs(dy)/(a.h/2),1);
  return {x:a.x+a.w/2+dx*scale,y:a.y+a.h/2+dy*scale};
 }
 const notePaths=attachments.map(r=>{
  const a=edge(r.a,r.b),b=edge(r.b,r.a);
  return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#a18a32" stroke-dasharray="5 5"/>`;
 }).join('');
 const boxes=nodes.map(n=>{
  const position=`left:${n.x}px;top:${n.y}px;width:${n.w}px;min-height:${n.h}px`;
  if(n.k!=='entity')return `<div class="box ${n.k==='note'?'note':''}" style="${position}">${display(n.t)}</div>`;
  const rows=(n.attributes||[]).map(a=>a.separator?'<div class="entity-separator" role="separator"></div>':`<div class="entity-attribute${/\[PK\]/i.test(a.text)?' primary-key':''}">${html(a.text)}</div>`).join('');
  return `<div class="box entity" style="${position};background-color:${entityStyle.backgroundcolor};border-color:${entityStyle.bordercolor};color:${entityStyle.fontcolor}"><div class="entity-name">${display(n.t)}</div><div class="entity-attributes">${rows}</div></div>`;
 }).join('');
 const width=Math.max(boxX+boxWidth+30,...nodes.map(n=>n.x+n.w+30));
 preview.innerHTML=`<div class="diagram er-diagram" style="height:${Math.max(340,cursor)}px;min-width:${width}px">${title?`<div class="diagram-title">${display(title)}</div>`:''}<svg class="lines"><defs><marker id="erArrowEnd" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M 0 0 L 10 5 L 0 10" fill="#4b5563"/></marker><marker id="erArrowStart" viewBox="0 0 10 10" refX="0" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M 10 0 L 0 5 L 10 10" fill="#4b5563"/></marker></defs>${paths}${notePaths}</svg>${boxes}</div>`;
}
number();
