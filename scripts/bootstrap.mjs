import {promises as fs} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
await fs.mkdir(path.join(root,'node_modules/@lifeweave'),{recursive:true});
for(const name of ['core','ui','connectors','planner']){
  const target=path.join(root,'node_modules/@lifeweave',name);
  try{await fs.symlink(`../../packages/${name}`,target,process.platform==='win32'?'junction':'dir');}
  catch(error){if(error.code!=='EEXIST')throw error;const real=await fs.realpath(target);if(real!==path.join(root,'packages',name))throw new Error(`Existing @lifeweave/${name} resolves outside this workspace; use a fresh install.`);}
}
