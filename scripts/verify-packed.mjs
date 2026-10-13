import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const root=path.resolve(import.meta.dirname,'..'),dist=path.join(root,'dist');
const manifest=JSON.parse(await fs.readFile(path.join(dist,'release-manifest.json'),'utf8'));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'lifeweave-packed-'));
const checks=[];let host;
const check=(label,run)=>{run();checks.push(label);};
async function extract(name,target,expected){const bytes=await fs.readFile(path.join(dist,name));assert.equal(hash(bytes),expected,'Archive digest must match release manifest');const listed=spawnSync('tar',['-tzf',path.join(dist,name)],{encoding:'utf8'});assert.equal(listed.status,0);assert.ok(listed.stdout.trim());for(const entry of listed.stdout.trim().split('\n'))assert.ok(!path.isAbsolute(entry)&&!entry.split('/').includes('..'),'Archive paths must remain relative');await fs.mkdir(target,{recursive:true});const result=spawnSync('tar',['-xzf',path.join(dist,name),'-C',target],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);}
try{
  await extract(manifest.source.name,path.join(temp,'source'),manifest.source.sha256);
  const source=path.join(temp,'source/lifeweave');
  assert.ok(manifest.files.length>0);
  for(const item of manifest.files)assert.equal(hash(await fs.readFile(path.join(source,item.path))),item.sha256,item.path);
  checks.push('source archive matches every allowlisted file digest');
  for(const artifact of manifest.packages){const pkg=artifact.name.match(/^lifeweave-(core|ui|connectors|planner)-/)[1];const target=path.join(temp,'sdk/node_modules/@lifeweave',pkg);await extract(artifact.name,path.join(temp,'extract',pkg),artifact.sha256);await fs.mkdir(path.dirname(target),{recursive:true});await fs.rename(path.join(temp,'extract',pkg,'package'),target);const metadata=JSON.parse(await fs.readFile(path.join(target,'package.json'),'utf8'));check(`${pkg} packed generation`,()=>assert.equal(metadata.version,manifest.releaseVersion));}
  const core=await import(pathToFileURL(path.join(temp,'sdk/node_modules/@lifeweave/core/src/index.mjs')));
  for(const key of ['buildSharedContext','compileIntent','recordContextCorrection','buildOutcomeLedger','recordPlanOutcome'])check(`installed core ${key}`,()=>assert.equal(typeof core[key],'function'));
  for(const pkg of ['ui','connectors','planner']){await import(pathToFileURL(path.join(temp,`sdk/node_modules/@lifeweave/${pkg}/src/index.mjs`)));checks.push(`installed ${pkg} ESM entrypoint`);}
  await import(pathToFileURL(path.join(source,'scripts/bootstrap.mjs')));
  const {createLocalServer}=await import(pathToFileURL(path.join(source,'apps/web/server.mjs')));
  const now='2026-10-13T16:00:00.000Z';host=await createLocalServer({port:0,dataDir:path.join(temp,'state'),clock:()=>now});
  const response=await fetch(host.origin+'/api/bootstrap'),cookie=response.headers.get('set-cookie').split(';')[0],csrf=(await response.json()).csrfToken;
  const get=async route=>{const r=await fetch(host.origin+route,{headers:{Cookie:cookie}});assert.equal(r.status,200);return r.json();};
  const state=await get('/api/state?workspace=demo');check('packed host shared-context snapshot',()=>assert.equal(state.sharedContext.goals.length,5));check('packed host empty initial ledger',()=>assert.equal(state.ledger.stats.drafts,0));
  const intent=await fetch(host.origin+'/api/intent?workspace=demo',{method:'POST',headers:{Cookie:cookie,Origin:host.origin,'X-Lifeweave-Csrf':csrf,'Content-Type':'application/json'},body:JSON.stringify({request:'Help me focus on my learning goal for 30 minutes'})});assert.equal(intent.status,200);const value=await intent.json();check('packed host ready bounded focus request',()=>assert.equal(value.status,'ready'));check('packed host exact minute scenario',()=>assert.equal(value.brief.minutes,30));
  for(const asset of ['/apps/web/workspace-tools.mjs','/apps/web/app.mjs']){assert.equal((await fetch(host.origin+asset)).status,200);checks.push(`packed host ${asset}`);}
  check('packed host no external actions',()=>assert.equal(host.status.externalActions,0));
  assert.equal((await fetch(host.origin+'/.private/runtime/personal.json')).status,404);checks.push('packed host private-file boundary');
  const receipt={version:1,at:new Date().toISOString(),status:'passed',release:manifest.releaseVersion,sourceArchive:manifest.source,packages:manifest.packages,checks,checkCount:checks.length,fixture:'invented-local-only',providerCalls:0,externalActions:0,limits:'Clean temporary Node SDK imports and packed loopback host checks; not live integration, browser UX, mobile or production qualification.'};
  await fs.writeFile(path.join(dist,'packed-verification.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify({status:receipt.status,checks:checks.length,release:receipt.release,sourceSha256:manifest.source.sha256}));
}finally{if(host)await host.close();await fs.rm(temp,{recursive:true,force:true});}
