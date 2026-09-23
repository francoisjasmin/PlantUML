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
