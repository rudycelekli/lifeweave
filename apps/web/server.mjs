import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { validateState, createDemoState, evaluate, ingestObservations, applyFeedback, recordSurfaceDelivery } from '../../packages/core/src/index.mjs';
import { integrationCatalog } from '../../packages/connectors/src/index.mjs';

const ROOT = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const MIME = {'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.md':'text/plain; charset=utf-8'};
const WEB_ASSETS=new Set(['apps/web/index.html','apps/web/app.mjs','apps/web/app.css','apps/web/icon.svg','apps/web/manifest.json','apps/web/sw.js']);
const publicPath=relative=>WEB_ASSETS.has(relative)||/^packages\/(core|ui)\/src\/[a-zA-Z0-9_./-]+\.(mjs|css)$/.test(relative);
const clone=value=>structuredClone(value);

export async function createLocalServer({port=4317,dataDir=path.join(ROOT,'.private/runtime'),clock=()=>new Date().toISOString(),intervalMs=60000}={}) {
  await fs.mkdir(dataDir,{recursive:true,mode:0o700});
  const startedAt=clock(), sessions=new Map(), states={},activity=[];
  const status={startedAt,lastTick:startedAt,ticks:0,evaluations:0,workerRunning:true,intervalMs,externalActions:0,auditError:null};
  let origin, timer, writeQueue=Promise.resolve();
  function emptyState(mode='personal') {
    return {version:1,tenantId:mode==='business'?'business-local':'local',goals:[],observations:[],connections:[{id:'local-import',provider:'manual',status:'disconnected',scopes:['manual.read']}],preferences:{timezone:'America/New_York',quietHours:{start:22,end:7},dailySurfaceBudget:4},feedback:[],deliveries:[]};
  }
  function assertState(state) {
    const validation=validateState(state);
    if(!validation.valid)throw new Error(validation.issues.join('; '));
  }
  for(const mode of ['demo','personal','business']) {
    try {states[mode]=JSON.parse(await fs.readFile(path.join(dataDir,`${mode}.json`),'utf8'));assertState(states[mode]);}
    catch(error) {if(error.code!=='ENOENT')throw error;states[mode]=mode==='demo'?createDemoState(clock()):emptyState(mode);assertState(states[mode]);}
  }
  async function persist(mode,state) {
    assertState(state);
    const file=path.join(dataDir,`${mode}.json`),tmp=`${file}.${crypto.randomUUID()}.tmp`;
    await fs.writeFile(tmp,JSON.stringify(state,null,2),{mode:0o600});
    await fs.rename(tmp,file);states[mode]=state;
  }
  for(const mode of ['demo','personal','business'])await persist(mode,states[mode]);
  function log(kind,detail,mode) {
    const event={id:crypto.randomUUID(),at:clock(),kind,detail,mode};
    activity.unshift(event);activity.splice(100);
    // Logs contain local workflow summaries, never provider secrets or observation bodies.
    fs.appendFile(path.join(dataDir,'activity.jsonl'),`${JSON.stringify(event)}\n`,{mode:0o600}).catch(()=>{status.auditError='Local audit log could not be written';});
  }
  try {const raw=await fs.readFile(path.join(dataDir,'activity.jsonl'),'utf8');activity.push(...raw.trim().split('\n').filter(Boolean).slice(-100).map(x=>JSON.parse(x)).reverse());}catch(error){if(error.code!=='ENOENT')throw error;}
  const queue=mode=>{status.evaluations++;return evaluate(states[mode],{now:clock(),mode:mode==='demo'?'replay':'live'});};
  const tick=()=>{status.lastTick=clock();status.ticks++;for(const mode of ['demo','personal','business'])queue(mode);};
  tick();timer=setInterval(tick,intervalMs);timer.unref();
  async function jsonFile(relative,fallback) {try{return JSON.parse(await fs.readFile(path.join(ROOT,relative),'utf8'));}catch{return fallback;}}
  function send(res,code,body) {res.writeHead(code,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(body));}
  async function readBody(req) {
    if(!String(req.headers['content-type']).startsWith('application/json'))throw Object.assign(new Error('JSON content type required'),{status:415});
    let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>250000)throw Object.assign(new Error('Request exceeds 250 KB'),{status:413});}
    try{return JSON.parse(raw);}catch{throw Object.assign(new Error('Invalid JSON'),{status:400});}
  }
  function session(req) {
    const cookie=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('lifeweave_session='));
    const id=cookie?.slice('lifeweave_session='.length),found=sessions.get(id);
    if(found&&Date.now()-found.at<86400000)return found;
    return null;
  }
  async function api(req,res,url) {
    if(url.pathname==='/api/bootstrap'&&req.method==='GET') {
      let found=session(req);
      if(!found){if(sessions.size>1000)sessions.clear();const id=crypto.randomBytes(32).toString('hex');found={csrf:crypto.randomBytes(32).toString('hex'),at:Date.now()};sessions.set(id,found);res.setHeader('Set-Cookie',`lifeweave_session=${id}; HttpOnly; SameSite=Strict; Path=/`);}
      return send(res,200,{csrfToken:found.csrf});
    }
    const found=session(req);
    if(!found)return send(res,401,{error:'Open the local workspace first.'});
    const mode=url.searchParams.get('workspace')||'demo';
    if(!['demo','personal','business'].includes(mode))return send(res,400,{error:'Unknown workspace'});
    if(req.method==='GET') {
      if(url.pathname==='/api/state')return send(res,200,{workspace:mode,state:states[mode],queue:queue(mode),status});
      if(url.pathname==='/api/catalog')return send(res,200,{integrations:integrationCatalog});
      if(url.pathname==='/api/activity')return send(res,200,{activity:activity.filter(x=>x.mode===mode),status});
      if(url.pathname==='/api/plans')return send(res,200,{plans:states[mode].plans||[]});
      if(url.pathname==='/api/research')return send(res,200,await jsonFile('docs/research/comparison.json',{repositories:[],gaps:['Source review is in progress.']}));
      if(url.pathname==='/api/candidates')return send(res,200,{candidates:mode==='personal'?await jsonFile('.private/inputs/candidate-goals.json',[]):[]});
      if(url.pathname==='/api/export') {res.setHeader('Content-Disposition','attachment; filename="lifeweave-workspace.json"');return send(res,200,states[mode]);}
      return send(res,404,{error:'Unknown endpoint'});
    }
    if(req.method!=='POST')return send(res,405,{error:'Method not allowed'});
    if(req.headers.origin!==origin||req.headers['x-lifeweave-csrf']!==found.csrf)return send(res,403,{error:'Local origin and CSRF token required'});
    const body=await readBody(req);
    // Serialize state changes so two browser tabs cannot silently overwrite one another.
    const operation=writeQueue.then(async()=>{
      let state=clone(states[mode]);
      if(url.pathname==='/api/feedback') {
        state=applyFeedback(state,body,{now:clock()});await persist(mode,state);log('feedback',`${body.kind} suggestion ${body.surfaceId}`,mode);
      } else if(url.pathname==='/api/deliveries') {
        state=recordSurfaceDelivery(state,body.surfaceIds,{now:clock()});await persist(mode,state);
      } else if(url.pathname==='/api/goals') {
        if(typeof body.title!=='string'||!body.title.trim())throw new Error('Goal title required');
        const goal={id:body.id||`goal-${crypto.randomUUID()}`,title:body.title.trim(),dimension:body.dimension||'personal',status:body.status||'active',priority:body.priority??60};
        if(body.metric)goal.metric=body.metric;
        if(body.source)goal.source=body.source;
        const index=state.goals.findIndex(g=>g.id===goal.id);
        if(index<0)state.goals.push(goal);else state.goals[index]=goal;
        await persist(mode,state);log('goal',`${index<0?'Added':'Updated'} ${goal.dimension} goal`,mode);
      } else if(url.pathname==='/api/preferences') {
        state.preferences=body;await persist(mode,state);log('preferences','Updated quiet hours and attention budget',mode);
      } else if(url.pathname==='/api/plans') {
        if(!body||Object.keys(body).some(key=>!['surfaceId','actionId','text','focusMinutes'].includes(key))||typeof body.text!=='string'||!body.text.trim()||body.text.length>4000)throw new Error('A bounded local draft is required; execution fields are not accepted');
        const surface=evaluate(state,{now:clock(),mode:'replay'}).surfaces.find(s=>s.id===body.surfaceId);
        const action=surface?.actions.find(a=>a.id===body.actionId&&a.kind==='local');
        if(!action)throw new Error('Current evidence and a declared local planning action are required');
        if(body.focusMinutes!==undefined){const max=surface.blocks.find(b=>b.type==='metric'&&b.unit==='minutes')?.value;if(action.payload?.intent!=='plan-focus'||!Number.isInteger(body.focusMinutes)||body.focusMinutes<5||body.focusMinutes>max)throw new Error('Focus plan must fit the confirmed available window');}
        state.plans||=[];if(state.plans.length>=100)throw new Error('Export or archive local drafts before adding more than 100');
        state.plans.push({id:`plan-${crypto.randomUUID()}`,tenantId:state.tenantId,surfaceId:surface.id,goalId:surface.goalId,actionId:action.id,intent:action.payload?.intent||'open-evidence',text:body.text.trim(),...(body.focusMinutes!==undefined?{focusMinutes:body.focusMinutes}:{}),status:'draft',createdAt:clock(),evidenceRefs:surface.evidenceRefs});
        await persist(mode,state);log('plan','Saved a local draft; no external action executed',mode);
      } else if(url.pathname==='/api/local-consent') {
        const scopes=['manual.read'];
        if(body.health===true)scopes.push('health.sleep.read');
        const connection={id:'local-import',provider:'manual',status:'connected',scopes,consentAt:clock()};
        const index=state.connections.findIndex(c=>c.id==='local-import');
        if(index<0)state.connections.push(connection);else state.connections[index]=connection;
        if(body.health!==true)state.observations=state.observations.filter(o=>o.connectorId!=='local-import'||o.kind!=='health.sleep');
        await persist(mode,state);log('consent',`Allowed local evidence: ${scopes.join(', ')}`,mode);
      } else if(url.pathname==='/api/revoke') {
        const connection=state.connections.find(c=>c.id===body.connectorId);
        if(!connection)throw new Error('Connection not found');
        connection.status='disconnected';
        state.observations=state.observations.filter(o=>o.connectorId!==connection.id);
        state.plans=(state.plans||[]).filter(p=>p.evidenceRefs.every(id=>state.observations.some(o=>o.id===id)));
        await persist(mode,state);log('revocation','Revoked source and deleted its observations',mode);
      } else if(url.pathname==='/api/observations') {
        if(!Array.isArray(body.observations)||body.observations.length>100)throw new Error('Import at most 100 observations');
        // Manual host cannot impersonate a live provider or another tenant.
        if(body.observations.some(o=>o.connectorId!=='local-import'||o.tenantId!==state.tenantId))throw new Error('Local imports require local-import connector and current tenant');
        state=ingestObservations(state,body.observations,{now:clock()});await persist(mode,state);log('observation',`Imported ${body.observations.length} local records`,mode);
      } else if(url.pathname==='/api/reset-demo'&&mode==='demo') {
        state=createDemoState(clock());await persist(mode,state);log('demo','Regenerated synthetic sample data',mode);
      } else {return send(res,404,{error:'Unknown endpoint'});}
      return send(res,200,{ok:true,state,queue:queue(mode),status});
    });
    writeQueue=operation.catch(()=>{});
    return operation;
  }
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Cache-Control','no-store');res.setHeader('Cross-Origin-Resource-Policy','same-origin');
    const importMapHash=crypto.createHash('sha256').update('{"imports":{"@lifeweave/core":"/packages/core/src/index.mjs"}}').digest('base64');
    res.setHeader('Content-Security-Policy',`default-src 'self'; script-src 'self' 'sha256-${importMapHash}'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`);
    try {
      const host=req.headers.host;
      const address=server.address(),actualPort=address?.port;
      if(![`127.0.0.1:${actualPort}`,`localhost:${actualPort}`].includes(host))return send(res,403,{error:'Local host required'});
      if(req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&req.headers.origin!==origin))return send(res,403,{error:'Local origin required'});
      const url=new URL(req.url,origin);
      if(url.pathname.startsWith('/api/'))return await api(req,res,url);
      const requested=url.pathname==='/'?'apps/web/index.html':decodeURIComponent(url.pathname).slice(1);
      const file=path.resolve(ROOT,requested);
      const relative=path.relative(ROOT,file);
      if(!publicPath(relative)||!file.startsWith(ROOT+path.sep))return send(res,404,{error:'Not found'});
      const canonical=await fs.realpath(file),canonicalRoot=await fs.realpath(ROOT),resolvedData=await fs.realpath(dataDir);
      if(!canonical.startsWith(canonicalRoot+path.sep)||!publicPath(path.relative(canonicalRoot,canonical))||canonical===resolvedData||canonical.startsWith(resolvedData+path.sep))return send(res,404,{error:'Not found'});
      const data=await fs.readFile(canonical);
      res.writeHead(200,{'Content-Type':MIME[path.extname(file)]||'application/octet-stream'});res.end(data);
    }catch(error){send(res,error.status|| (error.code==='ENOENT'?404:400),{error:error.message.slice(0,2000)});}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  origin=`http://127.0.0.1:${server.address().port}`;
  log('worker','Local proactive evaluator started. No external notifications or actions.', 'demo');
  return {server,origin,status,close:async()=>{clearInterval(timer);status.workerRunning=false;await writeQueue;await new Promise(resolve=>server.close(resolve));}};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const port=Number(process.env.LIFEWEAVE_PORT||4317);
  const local=await createLocalServer({port,dataDir:process.env.LIFEWEAVE_DATA_DIR});
  console.log(JSON.stringify({event:'lifeweave.ready',url:local.origin,workerIntervalMs:local.status.intervalMs,storage:'local private directory',externalActions:false}));
  const parentPid=Number(process.env.LIFEWEAVE_PARENT_PID);
  if(Number.isSafeInteger(parentPid)&&parentPid>1){const monitor=setInterval(()=>{try{process.kill(parentPid,0);}catch(error){if(error.code==='ESRCH'){clearInterval(monitor);local.close().then(()=>process.exit(0));}}},3000);monitor.unref();}
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await local.close();process.exit(0);});
}
