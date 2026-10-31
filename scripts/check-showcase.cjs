const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'media/showcases/manifest.json')));
assert.equal(manifest.publicAdultBleeped,true);
const expected={codependent:['brenda','marty','hal'],sarcastic:['graham','roxie','raven'],adult:['frankie','rita','vivienne']};
for(const [mode,ids] of Object.entries(expected)){
 const entry=manifest.modes[mode];assert.deepEqual(entry.cast.map(c=>c.id),ids);
 assert(entry.duration>=14&&entry.duration<=21);
 const bytes=fs.readFileSync(path.join(root,entry.src));
 assert.equal(bytes.length,entry.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),entry.sha256);
 for(const c of entry.cast){assert(c.end>c.start);assert(c.sourceEnd>c.sourceStart);assert(!/\bmeters\b|\bmetres\b|\bbullshit\b|\bdamn\b|\bfucking\b/i.test(c.line));if(mode==='adult')assert(c.line.includes('[bleep]'));}
}
new vm.Script(fs.readFileSync(path.join(root,'showcase.js'),'utf8'));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert(html.indexOf('data-showcase="website"')<html.indexOf('<div class="wrap hero">'));
assert.equal((html.match(/data-showcase-mode=/g)||[]).length,3);
assert(html.includes('data-showcase-sound'));assert(html.includes('data-showcase-skip'));assert(html.includes('data-open-beta'));
console.log('PASS: nine cast members in correct modes, complete captions, public bleeps, durations, immutable media hashes, front-door placement and player script syntax.');
