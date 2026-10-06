const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const elements=new Map();
const context=vm.createContext({document:{querySelector(s){if(!elements.has(s))elements.set(s,{value:'',innerHTML:'',textContent:''});return elements.get(s)}}});
vm.runInContext(fs.readFileSync('app.js','utf8'),context);
function parse(body){context.source='@startuml\n'+body+'\n@enduml';return vm.runInContext('(()=>{const errors=[];const lines=source.split("\\n").map((s,i)=>({s:s.trim(),n:i+1}));const model=parseComp(lines,errors);drawComp(lines);return {model,errors}})()',context)}
let result=parse(String.raw`[First component]
[Another component] as Comp2
component Comp3
component [Last\ncomponent] as Comp4`);
assert.equal(result.errors.length,0);assert.equal(result.model.nodes.length,4);assert.equal(result.model.nodes[3].id,'Comp4');
result=parse(`() "First Interface"
() "Another interface" as Interf2
interface Interf3
interface "Lastinterface" as Interf4`);
assert.equal(result.errors.length,0);assert.ok(result.model.nodes.every(n=>n.k==='interface'));
result=parse(`interface "Data Access" as DA
DA - [First Component]
[First Component] ..> HTTP : use
note left of HTTP : Web Service only
note right of [First Component]
A note can also
be on several lines
end note`);
assert.equal(result.errors.length,0);assert.equal(result.model.nodes.length,5);assert.equal(result.model.relations.length,4);
assert.match(elements.get('#preview').innerHTML,/stroke-dasharray/);assert.match(elements.get('#preview').innerHTML,/Web Service only/);
result=parse(`package "Some Group" {
HTTP - [First Component]
[Another Component]
}
node "Other Groups" {
FTP - [Second Component]
[First Component] --> FTP
}
cloud {
[Example 1]
}
database "MySql" {
folder "This is my folder" {
[Folder 3]
}
frame "Foo" {
[Frame 4]
}
}
[Another Component] --> [Example 1]
[Example 1] --> [Folder 3]
[Folder 3] --> [Frame 4]`);
assert.equal(result.errors.length,0);assert.equal(result.model.groups.length,6);assert.equal(result.model.nodes.length,8);
assert.equal(result.model.groups.find(g=>g.k==='folder').parent.t,'MySql');
result=parse(`A --> B
component "Alpha" as A
() "Beta" as B
note "Hello" as N
N .. A
note as N2
Multiline
note text
end note
N2 .. B`);
assert.equal(result.errors.length,0);assert.equal(result.model.nodes.length,4);assert.equal(result.model.relations[0].a.t,'Alpha');
for(const side of ['left','right','top','bottom'])assert.equal(parse(`component C\nnote ${side} of C : text\nC -- [D]`).errors.length,0);
for(const body of ['note right of A\ntext','package "G" {\n[A]','}','note nonsense','component [broken'])assert.ok(parse(body).errors.length>0,body);
context.source='@startmindmap\n* Root\n** Child\n@endmindmap';
vm.runInContext('code.value=source;validate()',context);assert.equal(elements.get('#status').textContent,'Syntaxe reconnue');
// Spacing and escaped prefixes must produce the same hierarchy and preview.
const mindPreviews=[];
for(const body of [
 '+_  Allo\n++ adroite\n-- agauche\n---plusagauche',
 '+_Allo\n++adroite\n--agauche\n--- plusagauche',
 String.raw`+\_  Allo
++ adroite
\-- agauche
\---plusagauche`
]){
 context.source='@startmindmap\n'+body+'\n@endmindmap';
 vm.runInContext('code.value=source;validate()',context);
 assert.equal(elements.get('#status').textContent,'Syntaxe reconnue',body);
 mindPreviews.push(elements.get('#preview').innerHTML);
}
assert.equal(mindPreviews[0],mindPreviews[1]);
assert.equal(mindPreviews[0],mindPreviews[2]);
for(const prefix of ['*','**','***','+_','++','---','##',String.raw`+\_`,String.raw`\--`]){
 for(const gap of ['', ' ', '  ', '\t']){
  context.nodeSource=prefix+gap+'Concept composé';
  const node=vm.runInContext('mindNode(nodeSource)',context);
  assert.equal(node.text,'Concept composé');
 }
 for(const suffix of ['', ' ', '\t']){
  context.source='@startmindmap\n* Root\n'+prefix+suffix+'\n@endmindmap';
  vm.runInContext('code.value=source;validate()',context);
  assert.equal(elements.get('#status').className,'bad',prefix+suffix);
 }
}
context.source='@startmindmap\n*Root\n***Child\n@endmindmap';
vm.runInContext('code.value=source;validate()',context);
assert.match(elements.get('#errors').innerHTML,/Niveau de MindMap sauté/);
assert.doesNotMatch(fs.readFileSync('index.html','utf8'),/Exemple MindMap|Exemple composants/);
assert.doesNotMatch(fs.readFileSync('index.html','utf8'),/placeholder=/);
for(const arrow of ['-->','<--','<-->','..>','<..','<..>','-right->','<-left-','--','..']){
 const {errors}=parse(`[A] ${arrow} [B]`);
 assert.equal(errors.length,0,arrow);
 const line=elements.get('#preview').innerHTML.match(/<line\b[^>]*\/>/)[0];
 assert.equal(line.includes('marker-start='),arrow.startsWith('<'),arrow);
 assert.equal(line.includes('marker-end='),arrow.endsWith('>'),arrow);
 assert.equal(line.includes('stroke-dasharray='),arrow.includes('.'),arrow);
 // The tips must reach the facing edges, not the obscured box centers.
 assert.match(line,/x1="210" y1="57" x2="260" y2="57"/,arrow);
}
parse('[A]\n[B]\n[C]\n[D]\n[A] --> [D]');
assert.match(elements.get('#preview').innerHTML,/<line x1="125" y1="84" x2="125" y2="144"/);
console.log('Component examples, aliases, implicit nodes, notes, nesting, invalid syntax and MindMap regression: OK');

const erExample=String.raw`@startuml
' 🎨 Paramètres visuels
skinparam entity {
BackgroundColor #D6EAF8
BorderColor #1F618D
FontColor black
}
title 🎓 Diagramme ER – Application Gestion du Temps Étudiant
entity "Etudiant" as Etudiant {
+Id : int [PK]
--------------
Nom : VARCHAR(50)
Coordonnees : VARCHAR(100)
}
entity "Cours" as Cours {
+Id : int [PK]
--------------
Nom : VARCHAR(100)
Professeur : VARCHAR(50)
}
entity "TacheDevoir" as TacheDevoir {
+Id : int [PK]
--------------
Titre : VARCHAR(100)
DateEcheance : DATE
Statut : VARCHAR(20)
IdEtudiant : int [FK]
IdCours : int [FK]
}
' Relations
Cours "1" -- "0..\*" TacheDevoir : contient >
Etudiant "1" -- "0..\*" TacheDevoir : réalise >
Cours "1" -- "1..\*" Etudiant : inscrit >
note right of TacheDevoir
Chaque tâche/devoir appartient à un seul étudiant
et est associée à un cours.
end note
note left of Cours
Un cours peut avoir plusieurs étudiants et plusieurs tâches.
end note
@enduml`;
function validateSource(source){
 context.source=source;
 return vm.runInContext('(()=>{code.value=source;validate();const errors=[];const model=parseComp(sourceLines(source),errors);return {model,errors}})()',context);
}
result=validateSource(erExample);
assert.equal(elements.get('#status').textContent,'Syntaxe reconnue');
assert.equal(result.errors.length,0);
assert.equal(result.model.nodes.filter(n=>n.k==='entity').length,3);
assert.equal(result.model.nodes.filter(n=>n.k==='note').length,2);
assert.equal(result.model.nodes.find(n=>n.id==='TacheDevoir').attributes.length,7);
assert.equal(result.model.relations.length,5);
assert.equal(result.model.relations[0].a.id,'Cours');
assert.equal(result.model.relations[0].b.id,'TacheDevoir');
assert.equal(result.model.relations[0].fromCardinality,'1');
assert.equal(result.model.relations[0].toCardinality,'0..*');
assert.equal(result.model.relations[2].toCardinality,'1..*');
let output=elements.get('#preview').innerHTML;
for(const expected of ['Application Gestion du Temps Étudiant','+Id : int [PK]','IdCours : int [FK]','VARCHAR(100)','contient &gt;','réalise &gt;','inscrit &gt;','Chaque tâche/devoir','Un cours peut avoir plusieurs','background-color:#D6EAF8','border-color:#1F618D','color:black','entity-separator','0..*','1..*'])assert.ok(output.includes(expected),expected);
// The rendered model is separate from the validation model; check positions by drawing it.
context.erModel=result.model;
vm.runInContext('drawEntities(erModel)',context);
for(const rel of result.model.relations.filter(r=>r.note)){
 if(rel.b.position==='left')assert.ok(rel.b.x+rel.b.w<rel.a.x);
 if(rel.b.position==='right')assert.ok(rel.b.x>rel.a.x+rel.a.w);
}
result=validateSource(`@startuml
A "0..*" --> "1" B : dépend de
entity "L'étudiant" as A {
*Id : UUID [PK]
..
Prénom : VARCHAR(50)
}
entity B {}
note top of A
L'étudiant s'inscrit à un cours.
'Texte conservé dans la note'
end note
note bottom of B : Une note en bas
@enduml`);
assert.equal(result.errors.length,0);
assert.equal(result.model.relations[0].a.t,"L'étudiant");
assert.equal(result.model.relations[0].a.k,'entity');
output=elements.get('#preview').innerHTML;
assert.ok(output.includes("L'étudiant s'inscrit à un cours."));
assert.ok(output.includes("'Texte conservé dans la note'"));
assert.match(output,/marker-end="url\(#erArrowEnd\)"/);
assert.doesNotMatch(output,/NaN|undefined|Infinity/);
for(const [body,line,message] of [
 ['entity A {\nId : int',2,'Entité non fermée'],
 ['skinparam entity {\nBackgroundColor red',2,'Bloc skinparam non fermé'],
 ['entity A {}\nnote left of A\nTexte',3,'Bloc note non terminé'],
 ['entity A {\n???\n}',3,'Attribut d’entité non reconnu'],
 ['entity A {}\n}',3,'sans regroupement ouvert'],
 ['entity A {}\nskinparam entityBackgroundColor red;display:none',3,'Couleur entity non reconnue']
]){
 result=validateSource('@startuml\n'+body+'\n@enduml');
 assert.ok(result.errors.some(e=>e.n===line&&e.m.includes(message)),body);
 assert.equal(elements.get('#status').className,'bad');
 assert.doesNotMatch(elements.get('#preview').innerHTML,/class="diagram/);
}
result=validateSource(`@startuml
title <img src=x onerror=alert(1)>
entity "<script>alert(1)</script>" as A {
Value : <img src=x> [PK]
}
A "1" -- "*" A : <script>label</script>
note right of A : <img src=x>
@enduml`);
assert.equal(result.errors.length,0);
output=elements.get('#preview').innerHTML;
assert.doesNotMatch(output,/<script>|<img|NaN|undefined|Infinity/);
assert.match(output,/&lt;script&gt;/);
console.log('Entity-relation example, attributes, cardinalities, styles, notes, aliases, invalid blocks and escaping: OK');

// Exercise preprocessing as well as parsing: apostrophes must survive in ENUM values.
for(const quote of ["'", '"']){
 const attribute=`+type : ENUM(${quote}Créateur${quote}, ${quote}Participant${quote}, ${quote}Modérateur${quote})`;
 result=validateSource(`@startuml
entity Utilisateur {
+idUtilisateur : UUID [PK]
+nomUtilisateur : VARCHAR(30)
+motDePasse : VARCHAR(255)
+courriel : VARCHAR(100) [unique]
+photoProfil : TEXT
${attribute}
}
@enduml`);
 assert.equal(result.errors.length,0);
 assert.equal(elements.get('#status').textContent,'Syntaxe reconnue');
 assert.equal(result.model.nodes[0].attributes.length,6);
 assert.equal(result.model.nodes[0].attributes[5].text,attribute);
 assert.ok(elements.get('#preview').innerHTML.includes(attribute.replace(/"/g,'&quot;')));
}
const enumAttributes=[
 String.raw`+type : enum ('L''étudiant', 'A (B)', 'C, D', 'Modérateur')`,
 String.raw`+type : ENUM('L\'étudiant', 'Participant')`,
 String.raw`+type : ENUM("L'étudiant", "Un \"créateur\"") [unique]`,
 `+type : ENUM('Créateur') ENUM('Participant')`
];
result=validateSource(`@startuml
' Commentaire contenant ENUM('ignoré')
entity Utilisateur { ' commentaire
${enumAttributes.map(a=>a+" ' commentaire supprimé").join('\n')}
+nom : VARCHAR(30) ' commentaire supprimé
}
@enduml`);
assert.equal(result.errors.length,0);
assert.deepEqual(Array.from(result.model.nodes[0].attributes,a=>a.text),[...enumAttributes,'+nom : VARCHAR(30)']);
assert.doesNotMatch(elements.get('#preview').innerHTML,/commentaire|ignoré|NaN|undefined|Infinity/);

// The user's example links the actual Other group, without an implicit duplicate node.
result=validateSource(`@startuml
package "Some Group" {
  HTTP - [First Component]
  [Another Component]
}
node Other {
  FTP - [Second Component]
  [First Component] --> FTP
}
cloud {
  [Example 1]
}
database "MySql" {
  folder "This is my folder" {
    [Folder 3]
  }
  frame "Foo" {
    [Frame 4]
  }
}
Other --> [Example 1]
[Example 1] --> [Folder 3]
[Folder 3] --> [Frame 4]
@enduml`);
assert.equal(result.errors.length,0);
assert.equal(result.model.groups.length,6);
assert.equal(result.model.nodes.length,8);
assert.equal(result.model.relations[3].a,result.model.groups.find(g=>g.id==='Other'));
assert.equal(result.model.nodes.some(n=>n.id==='Other'),false);
assert.equal(result.model.relations[0].a.group,result.model.groups[0]);
assert.equal(result.model.relations[0].b.group,result.model.groups[0]);
assert.doesNotMatch(elements.get('#preview').innerHTML,/NaN|undefined|Infinity/);

for(const kind of ['package','node','folder','frame','cloud','database','rectangle']){
 result=validateSource(`@startuml
G --> [Child]
"Named Group" ..> G
${kind} "Named Group" as G {
 [Child]
}
[Child] --> "Named Group"
note right of G : Note du groupe
@enduml`);
 assert.equal(result.errors.length,0,kind);
 const group=result.model.groups[0];
 assert.equal(group.id,'G');
 assert.equal(result.model.nodes.length,2);
 assert.equal(result.model.nodes[0].group,group);
 for(const [index,side] of [[0,'a'],[1,'a'],[1,'b'],[2,'b'],[3,'a']])assert.equal(result.model.relations[index][side],group,kind);
 assert.doesNotMatch(elements.get('#preview').innerHTML,/NaN|undefined|Infinity/,kind);
}

result=validateSource(`@startuml
package "First Group" as A {
}
node B {
}
A --> B
@enduml`);
assert.equal(result.errors.length,0);
assert.equal(result.model.nodes.length,0);
output=elements.get('#preview').innerHTML;
assert.match(output,/<line x1="395" y1="130" x2="395" y2="140"/);
assert.doesNotMatch(output,/NaN|undefined|Infinity/);
console.log('Quoted ENUM values, comments, group references by name/alias, forward references and group arrow endpoints: OK');

result=validateSource(`@startuml
G --> Utilisateur
package "Accounts" as G {
 entity Utilisateur {
  +type : ENUM('Créateur', 'Participant', 'Modérateur')
 }
}
note right of G : Note du groupe
@enduml`);
assert.equal(result.errors.length,0);
assert.equal(result.model.nodes.length,2);
assert.equal(result.model.relations[0].a,result.model.groups[0]);
output=elements.get('#preview').innerHTML;
assert.ok(output.includes('package : Accounts'));
assert.ok(output.includes('Note du groupe'));
assert.ok(output.includes("ENUM('Créateur', 'Participant', 'Modérateur')"));
assert.doesNotMatch(output,/NaN|undefined|Infinity/);
console.log('Group references and notes in entity-relation previews: OK');

function validateMindSource(source){
 context.source=source;
 return vm.runInContext('(()=>{code.value=source;validate();const errors=[];const lines=sourceLines(source);checkMind(lines,errors);return {model:layoutMind(lines),errors}})()',context);
}
const styledMindmap=fs.readFileSync('test-fixtures/mindmap-styles.puml','utf8');
result=validateMindSource(styledMindmap);
assert.equal(result.errors.length,0);
assert.equal(elements.get('#status').textContent,'Syntaxe reconnue');
const mind=result.model;
assert.equal(mind.nodes.length,styledMindmap.split('\n').filter(s=>/^[+-]/.test(s)).length);
assert.equal(mind.nodes[0].t,'Puzzler');
for(const n of mind.nodes){
 assert.ok(n.x>=0&&n.y>=0,n.t);
 assert.ok(n.x+n.w<=mind.width&&n.y+n.h<=mind.height,n.t);
 assert.ok(n.w<=150,n.t);
 assert.equal(n.style.padding,12);
 assert.equal(n.style.margin,3);
 assert.equal(n.style.horizontalalignment,'center');
 if(n.d===2)assert.equal(n.p,0,n.t);
 else if(n.d>2)assert.equal(mind.nodes[n.p].side,n.side,n.t);
 const colors={'autre-app':'yellow',legal:'lightblue',tangible:'violet',concept:'#ffbbcc'};
 if(n.stereotypes.length)assert.equal(n.style.backgroundcolor,colors[n.stereotypes[0]],n.t);
}
for(let i=0;i<mind.nodes.length;i++)for(let j=i+1;j<mind.nodes.length;j++){
 const a=mind.nodes[i],b=mind.nodes[j];
 assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y,`MindMap boxes overlap: ${a.t} / ${b.t}`);
}
assert.ok(mind.nodes.some(n=>n.t==="Règlements des magasins d'app."));
assert.ok(mind.nodes.some(n=>n.t==='Type'));
assert.ok(mind.nodes.some(n=>n.t==='Calcul de surface?'));
output=elements.get('#preview').innerHTML;
for(const color of ['yellow','lightblue','violet','#ffbbcc'])assert.ok(output.includes('background-color:'+color));
assert.doesNotMatch(output,/<style>|&lt;&lt;|https:\/\/|NaN|undefined|Infinity/);

result=validateMindSource(`@startmindmap
<style>
mindmapDiagram { .concept { BackgroundColor yellow } }
node {
 BackgroundColor white
 HorizontalAlignment right
 FontSize 16
 FontColor blue
}
</style>
* Root
** Child <<concept>>
<style>
mindmapDiagram { .concept { BackgroundColor violet } }
</style>
@endmindmap`);
assert.equal(result.errors.length,0);
assert.equal(result.model.nodes[0].style.backgroundcolor,'white');
assert.equal(result.model.nodes[1].style.backgroundcolor,'violet');
assert.equal(result.model.nodes[1].style.horizontalalignment,'right');
assert.equal(result.model.nodes[1].style.fontsize,16);
for(const [body,message] of [
 ['<style>\nnode {\n Padding 12\n}', 'non terminé'],
 ['</style>', 'sans bloc'],
 ['<style>\nnode {\n Padding 12\n</style>', 'non fermé'],
 ['<style>\nnode { MaximumWidth -1 }\n</style>', 'Dimension'],
 ['<style>\nnode { HorizontalAlignment diagonal }\n</style>', 'Alignement'],
 ['<style>\nnode { BackgroundColor red;display:none }\n</style>', 'Couleur'],
 ['<style>\nnode { Padding 12 }\n}\n</style>', 'sans sélecteur']
]){
 result=validateMindSource('@startmindmap\n'+body+'\n* Root\n@endmindmap');
 assert.ok(result.errors.some(e=>e.m.includes(message)),body);
 assert.equal(elements.get('#status').className,'bad',body);
 assert.doesNotMatch(elements.get('#preview').innerHTML,/class="diagram/);
}
result=validateSource(`@startuml
<style>
entity { BackgroundColor pink }
</style>
entity A {}
note right of A
<style>
Texte de la note
</style>
end note
@enduml`);
assert.equal(result.errors.length,0);
assert.equal(result.model.entityStyle.backgroundcolor,'pink');
assert.match(elements.get('#preview').innerHTML,/&lt;style&gt;/);

for(const [width,height,availableWidth,availableHeight,expected] of [
 [1200,600,600,400,.5],
 [400,2000,600,400,.2],
 [400,200,600,400,1],
 [1200,2000,300,200,.1]
]){
 context.dimensions=[width,height,availableWidth,availableHeight];
 const scale=vm.runInContext('previewScale(...dimensions)',context);
 assert.equal(scale,expected);
 assert.ok(width*scale<=availableWidth&&height*scale<=availableHeight);
}
console.log('MindMap style blocks, category colors, long labels, hierarchy, bounds, invalid styles and preview scaling: OK');

const noteExample=fs.readFileSync('test-fixtures/notes.puml','utf8');
result=validateSource(noteExample);
assert.equal(result.errors.length,0);
assert.equal(elements.get('#status').textContent,'Syntaxe reconnue');
assert.equal(result.model.nodes.filter(n=>n.k==='note').length,9);
assert.equal(result.model.relations.filter(r=>r.note).length,6);
assert.equal(result.model.relations.filter(r=>!r.note).length,3);
assert.equal(result.model.nodes.find(n=>n.id==='N2').t,"Note autonome en bloc\n\nL'objet conserve ses apostrophes.\n<style>\nTexte de la note\n</style>");
assert.equal(result.model.nodes.find(n=>n.id==='N3').t,'Note sans lien');
context.noteModel=result.model;
vm.runInContext('layoutComponentNotes(noteModel)',context);
function assertNotePosition(rel){
 const target=rel.a,note=rel.b,side=note.position;
 if(side==='left')assert.ok(note.x+note.w<target.x,side);
 if(side==='right')assert.ok(note.x>target.x+target.w,side);
 if(side==='top')assert.ok(note.y+note.h<target.y,side);
 if(side==='bottom')assert.ok(note.y>target.y+target.h,side);
}
result.model.relations.filter(r=>r.note).forEach(assertNotePosition);
for(let i=0;i<result.model.nodes.length;i++)for(let j=i+1;j<result.model.nodes.length;j++){
 const a=result.model.nodes[i],b=result.model.nodes[j];
 assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y,`Notes overlap: ${a.t} / ${b.t}`);
}
output=elements.get('#preview').innerHTML;
assert.ok(output.includes("Note à droite de l'objet"));
assert.ok(output.includes("L'objet conserve ses apostrophes."));
assert.ok(output.includes('Note autonome<br>sur deux lignes'));
assert.ok(output.includes('&lt;style&gt;'));
assert.doesNotMatch(output,/NaN|undefined|Infinity/);

for(const kind of ['component','entity'])for(const side of ['left','right','top','bottom'])for(const multiline of [false,true]){
 const declaration=kind==='entity'?'entity "Objet" as A {}':'component "Objet" as A';
 const note=multiline?`note ${side} of A\nL'objet est annoté.\n\nDeuxième paragraphe\nend note`:`note ${side} of A : L'objet est annoté.`;
 result=validateSource(`@startuml\n${note}\n${declaration}\n@enduml`);
 assert.equal(result.errors.length,0,kind+' '+side);
 assert.equal(result.model.nodes.length,2);
 const rel=result.model.relations[0];
 assert.equal(rel.note,true);assert.equal(rel.a.id,'A');assert.equal(rel.b.position,side);
 assert.equal(rel.b.t,multiline?"L'objet est annoté.\n\nDeuxième paragraphe":"L'objet est annoté.");
 context.noteModel=result.model;
 vm.runInContext(kind==='entity'?'drawEntities(noteModel)':'layoutComponentNotes(noteModel)',context);
 assertNotePosition(rel);
 assert.doesNotMatch(elements.get('#preview').innerHTML,/NaN|undefined|Infinity/);
}
result=validateSource('@startuml\ncomponent A\ncomponent B\nnote left of A, B : Deux objets\n@enduml');
assert.ok(result.errors.length>0);
console.log('Notes on all four sides, standalone notes, links, forward aliases, groups, apostrophes and blank paragraphs: OK');
