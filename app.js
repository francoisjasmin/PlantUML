const q=s=>document.querySelector(s), code=q("#code"), nums=q("#nums"), errors=q("#errors"), status=q("#status"), preview=q("#preview");
function number(){nums.textContent=Array.from({length:Math.max(1,code.value.split("\n").length)},(_,i)=>i+1).join("\n")}
code.oninput=number; code.onscroll=()=>nums.scrollTop=code.scrollTop;
code.onkeydown=e=>{if(e.key==="Tab"){e.preventDefault();let a=code.selectionStart,b=code.selectionEnd;code.value=code.value.slice(0,a)+"  "+code.value.slice(b);code.selectionStart=code.selectionEnd=a+2;number()} if(e.ctrlKey&&e.key==="Enter"){e.preventDefault();validate()}};
q("#clear").onclick=()=>{code.value="";number();errors.innerHTML="<p>Écrivez votre diagramme puis cliquez sur <b>Valider</b>.</p>";preview.innerHTML="<p>L’aperçu apparaîtra ici si la syntaxe reconnue est valide.</p>";status.className="";status.textContent="En attente"};
q("#validate").onclick=validate;
const clean=s=>{let i=s.indexOf("'");return (i<0?s:s.slice(0,i)).trim()};
const E=(a,n,m)=>a.push({n,m});
function validate(){
 let L=code.value.replace(/\r/g,"").split("\n").map((raw,i)=>({n:i+1,s:clean(raw)})).filter(x=>x.s), e=[], type="";
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
// Shared component grammar for validation and preview.
const compName = String.raw`(?:"[^"\n]+"|\[[^\]\n]+\]|[A-Za-z_][\w.]*)`;
const compAlias = String.raw`(?:\s+as\s+([A-Za-z_][\w.]*))?`;
const unquote = s => /^["\[]/.test(s) ? s.slice(1,-1) : s;
function parseComp(L,e=[]){
 const nodes=[],groups=[],relations=[],stack=[],refs=new Map();
 let note=null;
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
  return refs.get(label)||declare(token,null,token.startsWith('[')?'component':'interface',group);
 }
 for(const x of L.slice(1,-1)){
  const s=x.s;let m;
  if(note){if(/^end\s*note$/i.test(s)){note.node.t=note.text.join('\n');note=null}else note.text.push(s);continue}
  if(/^(skinparam|title|caption)\b/i.test(s))continue;
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
  m=s.match(new RegExp(`^(${compName})\\s*([<ox*+#]?(?:[-.=]+(?:left|right|up|down|[lrud])?[-.=]*)[>ox*+#]?)\\s*(${compName})(?:\\s*:\\s*(.+))?$`,'i'));
  if(m){relations.push({from:m[1],to:m[3],arrow:m[2],label:m[4]||'',group:current()});continue}
  E(e,x.n,'Instruction de diagramme de composants non reconnue.');
 }
 if(note)E(e,note.n,'Bloc note non terminé par « end note ».');
 stack.forEach(g=>E(e,g.n,'Regroupement non fermé par « } ».'));
 // Resolve after all declarations so forward aliases retain their explicit type.
 relations.forEach(r=>{r.a=resolve(r.from,r.group);r.b=resolve(r.to,r.group)});
 return {nodes,groups,relations};
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
 const {nodes,groups,relations}=parseComp(L);
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
 const lines=relations.map(r=>{
  const a=r.a,b=r.b,x1=a.x+85,y1=a.y+a.h/2,x2=b.x+85,y2=b.y+b.h/2;
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#4b5563" stroke-width="2" ${r.arrow.includes('.')?'stroke-dasharray="5 5"':''} ${r.arrow.startsWith('<')?'marker-start="url(#arrowStart)"':''} ${r.arrow.endsWith('>')?'marker-end="url(#arrowEnd)"':''}/>${r.label?`<text x="${(x1+x2)/2}" y="${(y1+y2)/2-8}" text-anchor="middle">${html(r.label)}</text>`:''}`;
 }).join('');
 const boxes=nodes.map(n=>`<div class="box ${n.k==='interface'?'iface':n.k==='note'?'note':''}" style="left:${n.x}px;top:${n.y}px;width:170px;min-height:${n.h}px">${n.k==='database'?'DB: ':''}${display(n.t)}</div>`).join('');
 const width=Math.max(740,...groups.map(g=>g.x+g.w+20),...nodes.map(n=>n.x+190));
 preview.innerHTML=`<div class="diagram" style="height:${Math.max(340,cursor)}px;min-width:${width}px">${groupBoxes}<svg class="lines"><defs><marker id="arrowEnd" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M 0 0 L 10 5 L 0 10" fill="#4b5563"/></marker><marker id="arrowStart" viewBox="0 0 10 10" refX="0" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M 10 0 L 0 5 L 10 10" fill="#4b5563"/></marker></defs>${lines}</svg>${boxes}</div>`;
}
number();
