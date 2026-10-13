import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawn,spawnSync} from 'node:child_process';
import {pathToFileURL,fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));

test('clean package tarballs import from an independent consumer with no workspace siblings',async()=>{
  const built=spawnSync(process.execPath,['scripts/package.mjs'],{cwd:root,encoding:'utf8'});assert.equal(built.status,0,built.stderr);
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'lifeweave-consumer-'));
  try{
    const manifest=JSON.parse(await fs.readFile(path.join(root,'dist/release-manifest.json'),'utf8'));
    assert.ok(manifest.files.every(f=>!f.path.includes('.private/')&&!f.path.includes('personal-model')&&!f.path.includes('verification.tap')));
    for(const name of ['core','ui','connectors','planner']){const target=path.join(dir,'node_modules/@lifeweave',name);await fs.mkdir(target,{recursive:true});const tar=spawnSync('tar',['-xzf',path.join(root,`dist/lifeweave-${name}-0.1.0-alpha.1.tgz`),'--strip-components=1','-C',target],{encoding:'utf8'});assert.equal(tar.status,0,tar.stderr);}
    const core=await import(pathToFileURL(path.join(dir,'node_modules/@lifeweave/core/src/index.mjs')));const state=core.createDemoState(),result=core.evaluate(state,{now:state.fixture.clock,mode:'replay'});assert.equal(result.surfaces.length,4);
    const ui=await import(pathToFileURL(path.join(dir,'node_modules/@lifeweave/ui/src/index.mjs')));assert.equal(ui.parseSurfaceFrame(JSON.stringify(result.surfaces[0])).id,result.surfaces[0].id);
    const connectors=await import(pathToFileURL(path.join(dir,'node_modules/@lifeweave/connectors/src/index.mjs')));const events=[];await connectors.emitAgUiSurface(result.surfaces[0],event=>events.push(event));assert.equal(events.length,1);
    const planner=await import(pathToFileURL(path.join(dir,'node_modules/@lifeweave/planner/src/index.mjs')));assert.equal(typeof planner.createModelPlanner,'function');
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});

test('clean source snapshot starts without dependency installation or private source data',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'lifeweave-fresh-'));
  let child;
  try{
    const stage=path.join(root,'dist/source/lifeweave');await fs.cp(stage,path.join(dir,'source'),{recursive:true});
    const cwd=path.join(dir,'source');assert.equal(await fs.stat(path.join(cwd,'.private')).then(()=>true).catch(()=>false),false);
    child=spawn(process.execPath,['scripts/start.mjs'],{cwd,env:{PATH:path.dirname(process.execPath),LIFEWEAVE_PORT:'0',LIFEWEAVE_DATA_DIR:path.join(dir,'data')},stdio:['ignore','pipe','pipe']});
    const origin=await new Promise((resolve,reject)=>{let output='',errors='';const timer=setTimeout(()=>reject(new Error('Fresh source startup timed out')),10000);child.stderr.on('data',x=>errors+=x);child.once('exit',code=>{clearTimeout(timer);reject(new Error(`Fresh source startup exited ${code}: ${errors}`));});child.stdout.on('data',chunk=>{output+=chunk;for(const line of output.split('\n')){try{const message=JSON.parse(line);if(message.event==='lifeweave.ready'){clearTimeout(timer);resolve(message.url);}}catch{}}});});
    assert.equal((await fetch(origin)).status,200);assert.equal((await fetch(origin+'/.private/inputs/candidate-goals.json')).status,404);
    child.kill('SIGTERM');await new Promise(resolve=>child.once('exit',resolve));child=undefined;
  }finally{if(child)child.kill('SIGTERM');await fs.rm(dir,{recursive:true,force:true});}
});
