const q=s=>document.querySelector(s), code=q("#code"), nums=q("#nums"), errors=q("#errors"), status=q("#status"), preview=q("#preview");
function number(){nums.textContent=Array.from({length:Math.max(1,code.value.split("\n").length)},(_,i)=>i+1).join("\n")}
code.oninput=number; code.onscroll=()=>nums.scrollTop=code.scrollTop;
code.onkeydown=e=>{if(e.key==="Tab"){e.preventDefault();let a=code.selectionStart,b=code.selectionEnd;code.value=code.value.slice(0,a)+"  "+code.value.slice(b);code.selectionStart=code.selectionEnd=a+2;number()} if(e.ctrlKey&&e.key==="Enter"){e.preventDefault();validate()}};
q("#clear").onclick=()=>{code.value="";number();errors.innerHTML="<p>Écrivez votre diagramme puis cliquez sur <b>Valider</b>.</p>";preview.innerHTML="<p>L’aperçu apparaîtra ici si la syntaxe reconnue est valide.</p>";status.className="";status.textContent="En attente"};
q("#validate").onclick=validate;
function clean(s){
 let quote=null,depth=0,enumDepth=0;
 for(let i=0;i<s.length;i++){
  const c=s[i];
  if(quote){
   if(c==='\\'){i++;continue}
   if(c===quote){if(s[i+1]===quote)i++;else quote=null}
   continue;
  }
  if(c==='"'){quote=c;continue}
  // Apostrophes delimit strings inside ENUM(...), and comments elsewhere.
  if(c==="'"){if(enumDepth)quote=c;else return s.slice(0,i).trim();continue}
  if(c==='('){depth++;if(!enumDepth&&/\bENUM\s*$/i.test(s.slice(0,i)))enumDepth=depth}
  else if(c===')'){if(depth===enumDepth)enumDepth=0;depth=Math.max(0,depth-1)}
 }
 return s.trim();
}
function sourceLines(source){
 let inNote=false,inMind=false,inTitle=false,inStyle=false,inBody=false;
 return source.replace(/\r/g,'').split('\n').map((raw,i)=>{
  if(/^@startmindmap\s*$/i.test(raw.trim()))inMind=true;
  const literal=inNote||inTitle||(!inStyle&&!inBody&&/^title\s+/i.test(raw.trim()))||(inMind&&!!mindNode(raw.trim()))||/^note\s+(?:left|right|top|bottom)\s+of\s+(?:"[^"]+"|\[[^\]]+\]|[\w.]+)\s*:/i.test(raw.trim());
  const s=literal?raw.trim():clean(raw);
  if(inTitle){if(/^end\s+title$/i.test(clean(raw)))inTitle=false}
  else if(inNote){if(/^end\s*note$/i.test(clean(raw)))inNote=false}
  else if(inStyle){if(/^<\/style>$/i.test(s))inStyle=false}
  else if(inBody){if(s==='}')inBody=false}
  else if(/^title$/i.test(s))inTitle=true;
  else if(/^<style>$/i.test(s))inStyle=true;
  else if(/^(?:entity\s+.+|skinparam\s+\w+)\s*\{$/i.test(s))inBody=true;
  else if(/^note\s+(?:(?:left|right|top|bottom)\s+of\s+(?:"[^"]+"|\[[^\]]+\]|[\w.]+)|as\s+[\w.]+)$/i.test(s))inNote=true;
  return {n:i+1,s,raw,literal};
 }).filter(x=>x.s||x.literal);
}
const E=(a,n,m)=>a.push({n,m});
const colorToken=s=>/^(?:#[\da-f]{3}|#[\da-f]{6}|#[\da-f]{8}|[a-z]+)$/i.test(s);
function extractStyles(L,e=[]){
 const lines=[],rules=[];let block=null;
 function readBlock(){
  const stack=[];
  const tokens=block.body.flatMap(x=>x.s.split(/([{}])/).map(s=>({s:s.trim(),n:x.n})).filter(x=>x.s));
  for(let i=0;i<tokens.length;i++){
   const {s,n}=tokens[i];
   if(s==='}'){
    if(stack.length)stack.pop();else E(e,n,'« } » sans sélecteur de style ouvert.');
   }else if(tokens[i+1]?.s==='{'){
    if(!/^[.#]?[\w-]+(?:\s+[.#]?[\w-]+)*$/.test(s))E(e,n,'Sélecteur de style non reconnu.');
    stack.push({s,n});i++;
   }else{
    const m=s.match(/^([a-z]\w*)\s+(.+?);?$/i);
    if(!stack.length||!m){E(e,n,'Instruction de style non reconnue.');continue}
    const key=m[1].toLowerCase(),value=m[2];
    if(['backgroundcolor','linecolor','fontcolor','bordercolor'].includes(key)&&!colorToken(value))E(e,n,'Couleur de style non reconnue.');
    else if(['padding','margin','maximumwidth','fontsize'].includes(key)&&(!/^\d+(?:\.\d+)?$/.test(value)||Number(value)>2000||(['maximumwidth','fontsize'].includes(key)&&Number(value)===0)))E(e,n,'Dimension de style non reconnue.');
    else if(key==='horizontalalignment'&&!/^(left|center|right)$/i.test(value))E(e,n,'Alignement de style non reconnu.');
    else rules.push({path:stack.map(v=>v.s),key,value});
   }
  }
  stack.forEach(v=>E(e,v.n,'Sélecteur de style non fermé par « } ».'));
 }
 for(const x of L){
  if(block){
   if(/^<\/style>$/i.test(x.s)){readBlock();block=null}
   else if(/^<style>$/i.test(x.s))E(e,x.n,'Bloc <style> déjà ouvert.');
   else if(/^@end(?:uml|mindmap)$/i.test(x.s)){E(e,block.n,'Bloc <style> non terminé par « </style> ».');readBlock();block=null;lines.push(x)}
   else block.body.push(x);
  }else if(!x.literal&&/^<style>$/i.test(x.s))block={n:x.n,body:[]};
  else if(!x.literal&&/^<\/style>$/i.test(x.s))E(e,x.n,'« </style> » sans bloc <style> ouvert.');
  else lines.push(x);
 }
 if(block){E(e,block.n,'Bloc <style> non terminé par « </style> ».');readBlock()}
 return {lines,rules};
}
function extractTitle(L,e=[]){
 const lines=[];let title='',block=null,body=null;
 for(const x of L){
  const s=x.s;
  if(block){
   if(/^end\s+title$/i.test(clean(s))){title=block.text.join('\n');block=null}
   else if(/^@end(?:uml|mindmap)$/i.test(s)){E(e,block.n,'Bloc title non terminé par « end title ».');block=null;lines.push(x)}
   else block.text.push((x.raw??s).trim());
   continue;
  }
  if(body){
   lines.push(x);
   if(body==='note'?/^end\s*note$/i.test(clean(s)):s==='}')body=null;
   continue;
  }
  const m=s.match(/^title(?:\s+(.+))?$/i);
  if(m){if(m[1]!==undefined)title=m[1];else block={n:x.n,text:[]};continue}
  if(/^end\s+title$/i.test(s)){E(e,x.n,'« end title » sans bloc title ouvert.');continue}
  lines.push(x);
  if(/^note\s+(?:(?:left|right|top|bottom)\s+of\s+(?:"[^"]+"|\[[^\]]+\]|[\w.]+)|as\s+[\w.]+)$/i.test(s))body='note';
  else if(/^(?:entity\s+.+|skinparam\s+\w+)\s*\{$/i.test(s))body='brace';
 }
 if(block)E(e,block.n,'Bloc title non terminé par « end title ».');
 return {lines,title};
}
function validate(){
 let L=sourceLines(code.value), e=[], type="";
 if(!L.length){show([{n:1,m:"Le diagramme est vide."}],"");return}
 if(L[0].s.toLowerCase()==="@startmindmap")type="mind"; else if(L[0].s.toLowerCase()==="@startuml")type="comp"; else E(e,L[0].n,"Début de diagramme non reconnu.");
 if(type==="mind"&&L.at(-1).s.toLowerCase()!=="@endmindmap")E(e,L.at(-1).n,"Fin de MindMap non reconnue.");
 if(type==="comp"&&L.at(-1).s.toLowerCase()!=="@enduml")E(e,L.at(-1).n,"Fin de diagramme non reconnue.");
 type==="mind"?checkMind(L,e):type==="comp"&&checkComp(L,e); show(e,type,L)
}
function mindNode(s){
 // Read the whole prefix first so bare markers cannot become node text.
 let m=s.match(/^\\?([*+#]+|[-]+)(?:\\?_)?/);
 if(!m)return null;
 let marks=m[1],text=s.slice(m[0].length).trim(),stereotypes=[],tag;
 while((tag=text.match(/\s*<<([^<>]+)>>\s*$/))){stereotypes.unshift(tag[1].trim());text=text.slice(0,tag.index).trim()}
 // Show the label of a PlantUML hyperlink rather than its long URL.
 text=text.replace(/\[\[(https?:\/\/[^\s\]]+)(?:\s+([^\]]+))?\]\]/g,(_,url,label)=>label||url);
 if(!text)return null;
 return {depth:marks.length,text,stereotypes,side:marks[0]==="-"?"l":marks[0]==="+"?"r":null};
}
function checkMind(L,e){
 L=extractTitle(extractStyles(L,e).lines,e).lines;
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
 const styled=extractStyles(L,e),titled=extractTitle(styled.lines,e);L=titled.lines;
 const nodes=[],groups=[],relations=[],stack=[],refs=new Map();
 let note=null,entity=null,skin=null,title=titled.title;
 const entityStyle={backgroundcolor:'#D6EAF8',bordercolor:'#1F618D',fontcolor:'black'};
 function setEntityStyle(key,value,n){
  key=key.toLowerCase();
  if(!(key in entityStyle))return;
  // Only color tokens can reach inline CSS; other PlantUML settings are ignored.
  if(colorToken(value))entityStyle[key]=value;
  else E(e,n,'Couleur entity non reconnue.');
 }
 styled.rules.filter(r=>r.path.map(s=>s.toLowerCase()).includes('entity')).forEach(r=>setEntityStyle(r.key==='linecolor'?'bordercolor':r.key,r.value));
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
  if(/^(skinparam|caption)\b/i.test(s))continue;
  m=s.match(new RegExp(`^entity\\s+(${compName})${compAlias}\\s*(\\{\\s*(\\})?)?$`,'i'));
  if(m){const node=declare(m[1],m[2],'entity');node.attributes=[];if(m[3]&&!m[4])entity={node,n:x.n};continue}
  if(s==='}'){if(!stack.length)E(e,x.n,'« } » sans regroupement ouvert.');else stack.pop();continue}
  m=s.match(new RegExp(`^(package|node|folder|frame|cloud|database|rectangle)(?:\\s+(${compName})${compAlias})?\\s*\\{$`,'i'));
  if(m){
   const label=m[2]?unquote(m[2]):m[1];
   const g={id:m[3]|| (m[2]?label:`@group${x.n}`),t:label,k:m[1].toLowerCase(),parent:current(),n:x.n};
   groups.push(g);
   if(m[2]){refs.set(g.id,g);refs.set(label,g)}
   stack.push(g);continue;
  }
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
function previewScale(width,height,availableWidth,availableHeight){
 return width>0&&height>0&&availableWidth>0&&availableHeight>0?Math.min(1,availableWidth/width,availableHeight/height):1;
}
function fitPreview(){
 if(typeof preview.querySelector!=='function')return;
 const stage=preview.querySelector('.preview-stage'),diagram=preview.querySelector('.diagram');
 if(!stage||!diagram||!preview.clientWidth||!preview.clientHeight)return;
 // Include actual text bounds, which can exceed the estimated box sizes.
 let width=diagram.offsetWidth,height=diagram.offsetHeight;
 diagram.querySelectorAll('.box,.pkg,.mind,.diagram-title').forEach(box=>{
  width=Math.max(width,box.offsetLeft+box.offsetWidth+20);
  height=Math.max(height,box.offsetTop+box.offsetHeight+20);
 });
 const css=getComputedStyle(preview);
 const availableWidth=preview.clientWidth-parseFloat(css.paddingLeft)-parseFloat(css.paddingRight);
 const availableHeight=preview.clientHeight-parseFloat(css.paddingTop)-parseFloat(css.paddingBottom);
 const scale=previewScale(width,height,availableWidth,availableHeight);
 diagram.style.width=width+'px';diagram.style.height=height+'px';
 diagram.style.transform=`scale(${scale})`;
 stage.style.width=width*scale+'px';stage.style.height=height*scale+'px';
}
function renderPreview(markup,title=''){
 if(title)markup=markup.replace(/^(<div\b[^>]*>)/,opening=>opening+`<div class="diagram-title">${html(title).replace(/\\n|\n/g,'<br>')}</div>`);
 preview.innerHTML=`<div class="preview-stage">${markup}</div>`;
 if(title&&typeof preview.querySelector==='function'){
  const diagram=preview.querySelector('.diagram'),heading=diagram.querySelector('.diagram-title');
  const height=diagram.offsetHeight,reserve=heading.offsetHeight+30;
  // Shift the entire drawing beneath the measured heading, including its connections.
  Array.from(diagram.children).filter(child=>child!==heading).forEach(child=>{
   if(child.tagName.toLowerCase()==='svg'){child.style.top=reserve+'px';child.style.bottom='auto';child.style.height=height+'px'}
   else child.style.top=(parseFloat(child.style.top)||0)+reserve+'px';
  });
  diagram.style.height=height+reserve+'px';
 }
 fitPreview();
}
if(typeof ResizeObserver!=='undefined')new ResizeObserver(fitPreview).observe(preview);
else if(typeof window!=='undefined')window.addEventListener('resize',fitPreview);
if(typeof document.fonts?.ready?.then==='function')document.fonts.ready.then(fitPreview);
function mindStyle(rules,node){
 const style={padding:7,margin:8,maximumwidth:180,horizontalalignment:'center',backgroundcolor:'white',linecolor:'#64748b',fontcolor:'#1f2937',fontsize:14};
 const matches=rules.filter(r=>{
  const path=r.path.map(s=>s.toLowerCase());
  if(path[0]!=='mindmapdiagram'&&path[0]!=='node')return false;
  return path.every(s=>s==='node'||s==='mindmapdiagram'||(s==='root'&&node.d===1)||(s.startsWith('.')&&node.stereotypes.includes(s.slice(1))));
 }).sort((a,b)=>a.path.filter(s=>s.startsWith('.')).length-b.path.filter(s=>s.startsWith('.')).length);
 matches.forEach(r=>{if(r.key in style)style[r.key]=['padding','margin','maximumwidth','fontsize'].includes(r.key)?Number(r.value):r.value.toLowerCase()});
 return style;
}
function layoutMind(L){
 const styled=extractStyles(L),{lines,title}=extractTitle(styled.lines),rules=styled.rules,nodes=[],parents={l:{},r:{}};let side='r';
 const probe=typeof document.createElement==='function'?document.createElement('div'):null;
 if(probe){probe.className='mind';preview.appendChild(probe)}
 lines.slice(1,-1).forEach(x=>{
  if(/^left side$/i.test(x.s)){side='l';return}if(/^right side$/i.test(x.s)){side='r';return}
  const m=mindNode(x.s);if(!m)return;
  const id=nodes.length,d=m.depth,nodeSide=d===1?'c':m.side||side;
  const n={id,d,t:m.text,stereotypes:m.stereotypes,side:nodeSide,p:d===1?null:parents[nodeSide][d-1],children:[]};
  n.style=mindStyle(rules,n);
  const textLines=n.t.split(/\\n|\n/),{padding,maximumwidth,fontsize}=n.style;
  n.w=Math.min(maximumwidth,Math.max(60,Math.max(...textLines.map(s=>s.length))*fontsize*.62+padding*2+2));
  const chars=Math.max(1,(n.w-padding*2-2)/(fontsize*.62));
  n.h=padding*2+2+textLines.reduce((sum,s)=>sum+Math.max(1,Math.ceil(s.length/chars)),0)*fontsize*1.4;
  if(probe){
   probe.style.cssText=`visibility:hidden;left:0;top:0;width:${n.w}px;padding:${padding}px;font-size:${fontsize}px;line-height:${fontsize*1.4}px`;
   probe.innerHTML=html(n.t).replace(/\\n|\n/g,'<br>');
   n.h=Math.max(n.h,probe.offsetHeight);
  }
  nodes.push(n);
  if(d===1){parents.l[1]=parents.r[1]=id}
  else{
   if(nodes[n.p])nodes[n.p].children.push(n);
   parents[nodeSide][d]=id;
   Object.keys(parents[nodeSide]).filter(v=>Number(v)>d).forEach(v=>delete parents[nodeSide][v]);
  }
 });
 if(probe)probe.remove();
 const root=nodes.find(n=>n.d===1);
 if(!root)return {nodes:[],width:700,height:340,title};
 const gap=n=>Math.max(12,n.style.margin*2);
 const listHeight=list=>list.reduce((sum,n,i)=>sum+n.subtree+(i?gap(n):0),0);
 function measure(n){n.children.forEach(measure);n.subtree=Math.max(n.h,listHeight(n.children))}
 root.children.forEach(measure);
 const branches={l:root.children.filter(n=>n.side==='l'),r:root.children.filter(n=>n.side==='r')};
 const columns={l:[],r:[]};
 for(const s of ['l','r'])nodes.filter(n=>n.side===s).forEach(n=>columns[s][n.d]=Math.max(columns[s][n.d]||0,n.w));
 const span=s=>columns[s].reduce((sum,w)=>sum+w+40,0);
 const width=40+span('l')+root.w+span('r');
 const height=Math.max(40+root.h,40+listHeight(branches.l),40+listHeight(branches.r));
 root.x=20+span('l');root.y=(height-root.h)/2;
 function place(n,start){
  const distance=columns[n.side].slice(0,n.d).reduce((sum,w)=>sum+w+40,0);
  n.x=n.side==='l'?root.x-distance-40-n.w:root.x+root.w+distance+40;
  n.y=start+(n.subtree-n.h)/2;
  let childY=start+(n.subtree-listHeight(n.children))/2;
  n.children.forEach((child,i)=>{if(i)childY+=gap(child);place(child,childY);childY+=child.subtree});
 }
 for(const s of ['l','r']){
  let y=(height-listHeight(branches[s]))/2;
  branches[s].forEach((n,i)=>{if(i)y+=gap(n);place(n,y);y+=n.subtree});
 }
 return {nodes,width,height,title};
}
function drawMind(L){
 const {nodes,width,height,title}=layoutMind(L);
 const lines=nodes.filter(n=>nodes[n.p]).map(n=>{
  const p=nodes[n.p],left=n.side==='l';
  return `<line x1="${p.x+(left?0:p.w)}" y1="${p.y+p.h/2}" x2="${n.x+(left?n.w:0)}" y2="${n.y+n.h/2}" stroke="#64748b"/>`;
 }).join('');
 const boxes=nodes.map(n=>{
  const s=n.style;
  return `<div class="mind" style="left:${n.x}px;top:${n.y}px;width:${n.w}px;min-height:${n.h}px;padding:${s.padding}px;text-align:${s.horizontalalignment};background-color:${s.backgroundcolor};border-color:${s.linecolor};color:${s.fontcolor};font-size:${s.fontsize}px;line-height:${s.fontsize*1.4}px">${html(n.t).replace(/\\n|\n/g,'<br>')}</div>`;
 }).join('');
 renderPreview(`<div class="diagram mind-diagram" style="width:${width}px;height:${height}px"><svg class="lines">${lines}</svg>${boxes}</div>`,title);
}
function sizeNote(n){
 n.w=250;
 n.h=24+n.t.split(/\\n|\n/).reduce((sum,line)=>sum+Math.max(1,Math.ceil(line.length/29)),0)*20;
 measureBoxHeight(n);
}
function measureBoxHeight(n){
 if(typeof document.createElement!=='function')return;
 const probe=document.createElement('div');probe.className=`box ${n.k==='note'?'note':''}`;
 probe.style.cssText=`visibility:hidden;left:0;top:0;width:${n.w}px`;
 probe.innerHTML=html(n.t).replace(/\\n|\n/g,'<br>');preview.appendChild(probe);
 n.h=Math.max(n.h,probe.offsetHeight);probe.remove();
}
function layoutComponentNotes({nodes,groups,relations}){
 const gap=24,attached=new Set(relations.filter(r=>r.note).map(r=>r.b)),layouts=new Map();
 const children=parent=>[...nodes.filter(n=>n.group===parent&&!attached.has(n)),...groups.filter(g=>g.parent===parent)];
 const sumHeight=list=>list.reduce((sum,n,i)=>sum+n.h+(i?gap:0),0);
 function measure(target){
  const isGroup=groups.includes(target),items=isGroup?children(target):[];
  items.forEach(measure);
  if(isGroup){
   target.w=Math.max(300,...items.map(n=>layouts.get(n).w+40));
   target.h=Math.max(90,56+items.reduce((sum,n,i)=>sum+layouts.get(n).h+(i?gap:0),0));
  }else if(target.k==='note')sizeNote(target);
  else{target.w=170;target.h=Math.max(54,30+target.t.split(/\\n|\n/).length*20);measureBoxHeight(target)}
  const sides={left:[],right:[],top:[],bottom:[]};
  relations.filter(r=>r.note&&r.a===target).forEach(r=>{sizeNote(r.b);sides[r.b.position].push(r.b)});
  const overhang=sides.top.length||sides.bottom.length?Math.max(0,(250-target.w)/2):0;
  const bx=sides.left.length?250+gap:overhang;
  const right=sides.right.length?250+gap:overhang;
  const by=sumHeight(sides.top)+(sides.top.length?gap:0);
  const middle=Math.max(target.h,sumHeight(sides.left),sumHeight(sides.right));
  const bottomY=by+middle+(sides.bottom.length?gap:0);
  const notes=[];
  for(const side of ['top','bottom','left','right']){
   let y=side==='top'?0:side==='bottom'?bottomY:by;
   sides[side].forEach(n=>{
    const x=side==='left'?bx-gap-n.w:side==='right'?bx+target.w+gap:bx+(target.w-n.w)/2;
    notes.push({n,x,y});y+=n.h+gap;
   });
  }
  layouts.set(target,{items,notes,bx,by,w:bx+target.w+right,h:bottomY+sumHeight(sides.bottom)});
 }
 function place(target,x,y){
  const l=layouts.get(target);target.x=x+l.bx;target.y=y+l.by;
  l.notes.forEach(v=>{v.n.x=x+v.x;v.n.y=y+v.y});
  let childY=target.y+36;
  l.items.forEach(n=>{place(n,target.x+20,childY);childY+=layouts.get(n).h+gap});
 }
 const main=children(null);main.forEach(measure);
 let cursor=30;
 main.forEach(n=>{place(n,30,cursor);cursor+=layouts.get(n).h+gap});
 return {height:cursor+6};
}
function drawComp(L){
 const model=parseComp(L),{nodes,groups,relations}=model;
 if(nodes.some(n=>n.k==='entity')){drawEntities(model);return}
 const display=s=>html(s).replace(/\\n|\n/g,'<br>');
 let cursor=30;
 if(nodes.some(n=>n.k==='note'))cursor=layoutComponentNotes(model).height;
 else{
 function layout(parent,depth){
  const start=cursor;
  if(parent)cursor+=36;
  nodes.filter(n=>n.group===parent).forEach((n,i)=>{
   n.x=40+depth*25+(i%3)*220;n.y=cursor;n.w=170;
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
 groups.forEach(g=>g.w=groupRight-g.x-depth(g)*10);
 }
 const groupBoxes=groups.map(g=>`<div class="pkg" style="left:${g.x}px;top:${g.y}px;width:${g.w}px;height:${g.h}px">${html(g.k)} : ${display(g.t)}</div>`).join('');
 // Clip connections to the box edges so their arrowheads remain visible.
 function edge(a,b){
  const dx=b.x+b.w/2-a.x-a.w/2,dy=b.y+b.h/2-a.y-a.h/2;
  const scale=1/Math.max(Math.abs(dx)/(a.w/2),Math.abs(dy)/(a.h/2),1);
  return {x:a.x+a.w/2+dx*scale,y:a.y+a.h/2+dy*scale};
 }
 const lines=relations.map(r=>{
  const start=edge(r.a,r.b),end=edge(r.b,r.a),x1=start.x,y1=start.y,x2=end.x,y2=end.y;
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#4b5563" stroke-width="2" ${r.arrow.includes('.')?'stroke-dasharray="5 5"':''} ${r.arrow.startsWith('<')?'marker-start="url(#arrowStart)"':''} ${r.arrow.endsWith('>')?'marker-end="url(#arrowEnd)"':''}/>${r.label?`<text x="${(x1+x2)/2}" y="${(y1+y2)/2-8}" text-anchor="middle">${html(r.label)}</text>`:''}`;
 }).join('');
 const boxes=nodes.map(n=>`<div class="box ${n.k==='interface'?'iface':n.k==='note'?'note':''}" style="left:${n.x}px;top:${n.y}px;width:${n.w}px;min-height:${n.h}px">${n.k==='database'?'DB: ':''}${display(n.t)}</div>`).join('');
 const width=Math.max(740,...groups.map(g=>g.x+g.w+20),...nodes.map(n=>n.x+190));
 renderPreview(`<div class="diagram" style="height:${Math.max(340,cursor)}px;min-width:${width}px">${groupBoxes}<svg class="lines"><defs><marker id="arrowEnd" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M 0 0 L 10 5 L 0 10" fill="#4b5563"/></marker><marker id="arrowStart" viewBox="0 0 10 10" refX="0" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M 10 0 L 0 5 L 10 10" fill="#4b5563"/></marker></defs>${lines}</svg>${boxes}</div>`,model.title);
}
function drawEntities({nodes,groups=[],relations,title,entityStyle}){
 // ER layout is flat; linked groups still need a visible box and connection ports.
 nodes=[...nodes,...groups.filter(g=>relations.some(r=>r.a===g||r.b===g))];
 const display=s=>html(s).replace(/\\n|\n/g,'<br>');
 const links=relations.filter(r=>!r.note),attachments=relations.filter(r=>r.note);
 const attached=new Set(attachments.map(r=>r.b));
 const main=nodes.filter(n=>!attached.has(n));
 const noteWidth=250,noteGap=24,laneGap=72;
 const boxWidth=Math.max(280,Math.min(640,Math.max(...main.map(n=>Math.max(n.t.length,...(n.attributes||[]).filter(a=>!a.separator).map(a=>a.text.length))))*8+28));
 const boxX=noteWidth+80+Math.max(1,links.length)*laneGap;
 let cursor=30;
 function noteHeight(n){return 24+n.t.split(/\\n|\n/).reduce((sum,line)=>sum+Math.max(1,Math.ceil(line.length/29)),0)*20}
 const sumHeight=list=>list.reduce((sum,n)=>sum+n.h+noteGap,0);
 main.forEach(n=>{
  n.w=boxWidth;
  n.h=n.k==='entity'?44+(n.attributes||[]).reduce((sum,a)=>sum+(a.separator?12:Math.max(1,Math.ceil(a.text.length/((boxWidth-28)/8)))*24),0):noteHeight(n);
  n.h=Math.max(60,n.h);
  const sides={left:[],right:[],top:[],bottom:[]};
  attachments.filter(r=>r.a===n).forEach(r=>{sizeNote(r.b);sides[r.b.position].push(r.b)});
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
  if(n.k!=='entity')return `<div class="box ${n.k==='note'?'note':''}" style="${position}">${groups.includes(n)?html(n.k)+' : ':''}${display(n.t)}</div>`;
  const rows=(n.attributes||[]).map(a=>a.separator?'<div class="entity-separator" role="separator"></div>':`<div class="entity-attribute${/\[PK\]/i.test(a.text)?' primary-key':''}">${html(a.text)}</div>`).join('');
  return `<div class="box entity" style="${position};background-color:${entityStyle.backgroundcolor};border-color:${entityStyle.bordercolor};color:${entityStyle.fontcolor}"><div class="entity-name">${display(n.t)}</div><div class="entity-attributes">${rows}</div></div>`;
 }).join('');
 const width=Math.max(boxX+boxWidth+30,...nodes.map(n=>n.x+n.w+30));
 renderPreview(`<div class="diagram er-diagram" style="height:${Math.max(340,cursor)}px;min-width:${width}px"><svg class="lines"><defs><marker id="erArrowEnd" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M 0 0 L 10 5 L 0 10" fill="#4b5563"/></marker><marker id="erArrowStart" viewBox="0 0 10 10" refX="0" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M 10 0 L 0 5 L 10 10" fill="#4b5563"/></marker></defs>${paths}${notePaths}</svg>${boxes}</div>`,title);
}
number();
