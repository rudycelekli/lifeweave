import {promises as fs} from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),dist=path.join(root,'dist'),stage=path.join(dist,'source/lifeweave');
const ROOT_FILES=['README.md','AGENTS.md','PRODUCT.md','DESIGN.md','SECURITY.md','LICENSE','NOTICE','THIRD_PARTY_NOTICES.md','package.json','pnpm-lock.yaml','pnpm-workspace.yaml','tsconfig.json','.gitignore'];
const DOC_FILES=['SPEC.md','ARCHITECTURE.md','COMMERCIAL-MODEL.md','ROADMAP.md','research/upstream-analysis.md','research/upstream-manifest.json','research/comparison.json','research/github-metadata.json','research/hark-design-reference.md','evidence/verification.json','evidence/replay.json','evidence/independent-review.md','evidence/review-resolution.md','evidence/browser.json','evidence/desktop.json','evidence/tooling.json'];
const files=[];
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
async function add(relative,required=true){const input=path.join(root,relative);const stat=await fs.lstat(input).catch(()=>null);if(!stat){if(required)throw new Error(`Missing release file ${relative}`);return;}if(!stat.isFile()||stat.isSymbolicLink())throw new Error(`Nonregular release file ${relative}`);const bytes=await fs.readFile(input);const output=path.join(stage,relative);await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,bytes);files.push({path:relative,bytes:bytes.length,sha256:hash(bytes)});}
async function tree(relative,filter=()=>true){for(const item of await fs.readdir(path.join(root,relative),{withFileTypes:true})){if(item.name.startsWith('.')||item.name==='node_modules')continue;const next=`${relative}/${item.name}`;if(item.isSymbolicLink())throw new Error(`Source symlink forbidden: ${next}`);if(item.isDirectory())await tree(next,filter);else if(filter(next))await add(next);}}
await fs.mkdir(dist,{recursive:true});await fs.rm(stage,{recursive:true,force:true});await fs.mkdir(stage,{recursive:true});
for(const file of ROOT_FILES)await add(file);
for(const file of DOC_FILES)await add(`docs/${file}`,false);
await tree('docs/adr',file=>/\.(md|json)$/.test(file));
await tree('.github',file=>/\.ya?ml$/.test(file));
for(const app of ['web','desktop'])await tree(`apps/${app}`,file=>/\.(mjs|js|html|css|json|svg|md|swift|plist)$/.test(file)||file.endsWith('-LICENSE'));
for(const pkg of ['core','ui','connectors','planner']){await tree(`packages/${pkg}/src`);if(await fs.stat(path.join(root,'packages',pkg,'scripts')).catch(()=>null))await tree(`packages/${pkg}/scripts`,file=>file.endsWith('.mjs'));for(const file of ['package.json','README.md','LICENSE'])await add(`packages/${pkg}/${file}`);}
await tree('scripts',file=>file.endsWith('.mjs'));await tree('tests',file=>/\.(mjs|ts)$/.test(file));await tree('examples',file=>file.endsWith('.json'));if(await fs.stat(path.join(root,'schemas')).catch(()=>null))await tree('schemas',file=>file.endsWith('.json'));
if(await fs.stat(path.join(root,'docs/assets/workspace.jpg')).catch(()=>null))await add('docs/assets/workspace.jpg');
const canaries=['PRIVATE'+' KEY-----','/'+'Users'+'/'];
try{const manifest=JSON.parse(await fs.readFile(path.join(root,'.private/inputs/manifest.json'),'utf8'));const serialized=JSON.stringify(manifest);for(const match of serialized.matchAll(/(?:\/Users\/[^"\\]+\/Downloads\/)([^"\\]+\.(?:pdf|docx))/g))canaries.push(match[1]);}catch{}
try{const candidates=JSON.parse(await fs.readFile(path.join(root,'.private/inputs/candidate-goals.json'),'utf8'));for(const candidate of candidates.candidates||[])if(candidate.sourceStatement?.length>80)canaries.push(candidate.sourceStatement.slice(0,80));}catch{}
for(const file of files){if(file.path.includes('.private/')||file.path.includes('personal-model')||file.path.includes('candidate-goals')||file.path.includes('project-memory'))throw new Error(`Private release path ${file.path}`);if(/\.(mjs|js|ts|json|md|html|swift|plist|ya?ml)$/.test(file.path)){const content=await fs.readFile(path.join(stage,file.path),'utf8');for(const canary of canaries)if(content.includes(canary))throw new Error(`Release content check failed: ${file.path}`);if(/(?:gh[pousr]_[A-Za-z0-9]{30,}|sk-[A-Za-z0-9]{30,}|AKIA[A-Z0-9]{16})/.test(content))throw new Error(`Credential-shape scan failed: ${file.path}`);}}
const version=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')).version;
function tar(file,base,name){const result=spawnSync('tar',['-czf',file,'-C',base,name],{encoding:'utf8'});if(result.status!==0)throw new Error(result.stderr||'tar failed');}
const sourceName=`lifeweave-${version}-source.tar.gz`;tar(path.join(dist,sourceName),path.join(dist,'source'),'lifeweave');
const packages=[];
for(const pkg of ['core','ui','connectors','planner']){const packageStage=path.join(dist,`package-${pkg}`);await fs.rm(packageStage,{recursive:true,force:true});await fs.mkdir(packageStage,{recursive:true});await fs.cp(path.join(stage,'packages',pkg),path.join(packageStage,'package'),{recursive:true});const name=`lifeweave-${pkg}-${version}.tgz`;tar(path.join(dist,name),packageStage,'package');packages.push({name,sha256:hash(await fs.readFile(path.join(dist,name)))});await fs.rm(packageStage,{recursive:true,force:true});}
const manifest={version:1,releaseVersion:version,at:new Date().toISOString(),source:{name:sourceName,sha256:hash(await fs.readFile(path.join(dist,sourceName)))},packages,files,checks:{explicitAllowlist:true,privatePathCheck:true,knownSourceCanaryCheck:true,credentialShapeCheck:true},excluded:['private inputs and goals','runtime state and drafts','project memory','upstream clones','development caches','machine-specific core receipts'],notProof:'A bounded scan does not prove absence of arbitrary unknown secrets.'};
await fs.writeFile(path.join(dist,'release-manifest.json'),JSON.stringify(manifest,null,2));console.log(JSON.stringify({sourceArchive:sourceName,packageArchives:packages.map(x=>x.name),publicFiles:files.length,privateFiles:0,stage:'dist/source/lifeweave',manifest:'dist/release-manifest.json'}));
