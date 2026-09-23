const q=s=>document.querySelector(s), code=q("#code"), nums=q("#nums"), errors=q("#errors"), status=q("#status"), preview=q("#preview");
const exMind=`@startmindmap
* Centre d'escalade
** Réservations
*** Plages
*** Capacité
** Cours
*** Inscriptions
left side
** Utilisateurs
*** Membres
@endmindmap`;
const exComp=`@startuml
skinparam componentStyle rectangle
package "Client" {
  [Interface utilisateur] as UI
}
package "Serveur" {
  [Service Réservations] as Reservations
  [Service Notifications] as Notifications
  interface "I_Notification" as INotif
}
UI --> Reservations
Reservations --> INotif
Notifications -- INotif
note right of Reservations
  Gestion des réservations
end note
@enduml`;

function number(){nums.textContent=Array.from({length:Math.max(1,code.value.split("\n").length)},(_,i)=>i+1).join("\n")}
code.oninput=number; code.onscroll=()=>nums.scrollTop=code.scrollTop;
code.onkeydown=e=>{if(e.key==="Tab"){e.preventDefault();let a=code.selectionStart,b=code.selectionEnd;code.value=code.value.slice(0,a)+"  "+code.value.slice(b);code.selectionStart=code.selectionEnd=a+2;number()} if(e.ctrlKey&&e.key==="Enter"){e.preventDefault();validate()}};
q("#mind").onclick=()=>{code.value=exMind;number();validate()};q("#comp").onclick=()=>{code.value=exComp;number();validate()};
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
function checkComp(L,e){
 let stack=[],note=false,noteLine=0;
 L.slice(1,-1).forEach(x=>{let s=x.s;if(note){if(/^end\s*note$/i.test(s))note=false;return}
  if(/^note\b/i.test(s)){note=true;noteLine=x.n;return}
  if(/^(skinparam|title|caption)\b/i.test(s))return;
  if(/^(package|frame|cloud|node|folder|rectangle)\b/i.test(s)){if(!/\{\s*$/.test(s))E(e,x.n,"« { » attendu à la fin du regroupement.");else stack.push(x.n);return}
  if(s==="}"){if(!stack.length)E(e,x.n,"« } » sans regroupement ouvert.");else stack.pop();return}
  if(/^\[[^\]]+\](?:\s+as\s+[A-Za-z_]\w*)?$/i.test(s))return;
  if(/^(component|interface|database)\s+(?:"[^"]+"|[A-Za-z_]\w*)(?:\s+as\s+[A-Za-z_]\w*)?$/i.test(s))return;
  if(/^("[^"]+"|[A-Za-z_][\w.]*|\[[^\]]+\])\s+[-.=<>ox*+#]+\s+("[^"]+"|[A-Za-z_][\w.]*|\[[^\]]+\])(?:\s*:\s*.+)?$/i.test(s))return;
  E(e,x.n,"Instruction de diagramme de composants non reconnue.")
 });if(note)E(e,noteLine,"Bloc note non terminé par « end note ».");stack.forEach(n=>E(e,n,"Regroupement non fermé par « } »."))
}
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
 let a=[],rels=[],pkg="",note=false;L.slice(1,-1).forEach(x=>{let s=x.s,m;
 if(note){if(/^end\s*note$/i.test(s))note=false;return}if(/^note\b/i.test(s)){note=true;return}
 m=s.match(/^(package|frame|cloud|node|folder|rectangle)\s+(?:"([^"]+)"|(.+?))\s*\{$/i);if(m){pkg=m[2]||m[3];return}if(s==="}"){pkg="";return}
 m=s.match(/^\[([^\]]+)\](?:\s+as\s+([A-Za-z_]\w*))?$/);if(m){a.push({t:m[1],id:m[2]||m[1],k:"box",pkg});return}
 m=s.match(/^(component|interface|database)\s+(?:"([^"]+)"|([A-Za-z_]\w*))(?:\s+as\s+([A-Za-z_]\w*))?$/i);if(m){a.push({t:m[2]||m[3],id:m[4]||m[3]||m[2],k:m[1],pkg});return}
 m=s.match(/^("[^"]+"|[A-Za-z_][\w.]*|\[[^\]]+\])\s+[-.=<>ox*+#]+\s+("[^"]+"|[A-Za-z_][\w.]*|\[[^\]]+\])/);if(m)rels.push([m[1].replace(/[\[\]"]/g,""),m[2].replace(/[\[\]"]/g,"")])
 });
 a.forEach((n,i)=>{n.x=40+(i%3)*220;n.y=50+Math.floor(i/3)*100});
 let H=Math.max(340,160+Math.ceil(a.length/3)*100),line=rels.map(r=>{let x=a.find(n=>n.id===r[0]||n.t===r[0]),y=a.find(n=>n.id===r[1]||n.t===r[1]);return x&&y?`<line x1="${x.x+65}" y1="${x.y+20}" x2="${y.x+65}" y2="${y.y+20}" stroke="#4b5563" stroke-width="2"/>`:""}).join("");
 let boxes=a.map(n=>`<div class="box ${n.k==="interface"?"iface":""}" style="left:${n.x}px;top:${n.y}px">${n.k==="database"?"DB: ":""}${html(n.t)}</div>`).join("");
 preview.innerHTML=`<div class=diagram style="height:${H}px"><svg class=lines>${line}</svg>${boxes}</div>`
}
number();