import {promises as fs} from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
await import('./bootstrap.mjs');
const tests=(await fs.readdir(path.join(root,'tests'))).filter(name=>name.endsWith('.test.mjs')).sort().map(name=>`tests/${name}`);
const run=(command,args)=>{const result=spawnSync(command,args,{cwd:root,encoding:'utf8',maxBuffer:5_000_000,env:{...process.env,PATH:path.dirname(process.execPath)+path.delimiter+(process.env.PATH||'')}});return {passed:result.status===0,exitCode:result.status,output:(result.stdout||'')+(result.stderr||''),error:result.error?.message};};
const checks={tests:run(process.execPath,['--test',...tests]),types:run(path.join(root,'node_modules/.bin/tsc'),['--project','tsconfig.json']),replay:run(process.execPath,['scripts/replay.mjs'])};
await fs.mkdir(path.join(root,'.private'),{recursive:true,mode:0o700});await fs.writeFile(path.join(root,'.private/verification-output.txt'),Object.entries(checks).map(([key,value])=>`${key}\n${value.output}\n${value.error||''}`).join('\n'),{mode:0o600});
const hashes=[];
async function collect(relative){for(const item of await fs.readdir(path.join(root,relative),{withFileTypes:true})){if(item.name.startsWith('.')||['node_modules','vendor','verification.json'].includes(item.name))continue;const file=`${relative}/${item.name}`;if(item.isDirectory())await collect(file);else if(item.isFile()&&/\.(mjs|ts|html|css|json|swift)$/.test(item.name)){const bytes=await fs.readFile(path.join(root,file));hashes.push({file,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});}}}
for(const directory of ['packages','apps','tests','scripts'])await collect(directory);
const match=checks.tests.output.match(/(?:# tests|ℹ tests)\s+(\d+)/);
const report={version:1,at:new Date().toISOString(),status:Object.values(checks).every(x=>x.passed)?'passed':'failed',runtime:{node:process.version,platform:process.platform,architecture:process.arch},checks:Object.fromEntries(Object.entries(checks).map(([key,value])=>[key,{passed:value.passed,exitCode:value.exitCode}])),tests:Number(match?.[1]||0),sourceHashes:hashes,providerCalls:0,externalActions:0,cost:{providerSpendUsd:0,totalCostUsd:null,humanOversightMinutes:null},liveAccounts:'unconnected',multiUserEnterprise:'not-implemented',lifeOutcomeEvidence:'not-measured',note:'Provider contracts use mocks; local API tests use isolated synthetic data. Browser/native/package receipts are separate.'};
await fs.writeFile(path.join(root,'docs/evidence/verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,tests:report.tests,checks:report.checks,receipt:'docs/evidence/verification.json'}));if(report.status!=='passed'){for(const [name,check] of Object.entries(checks))if(!check.passed)console.error(`${name} failed:\n${(check.output||check.error||'No diagnostics').replaceAll(root,'<workspace>').replace(/(?:gh[pousr]_[A-Za-z0-9]{30,}|sk-[A-Za-z0-9]{30,}|AKIA[A-Z0-9]{16})/g,'[credential-redacted]').slice(-8000)}`);process.exitCode=1;}
