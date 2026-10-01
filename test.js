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
