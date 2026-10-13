/** Explicit host configuration only. Nothing is inferred from credentials or browser input. */
export function readHostModelConfig(env=process.env){
  const keys=['LIFEWEAVE_MODEL','LIFEWEAVE_MODEL_ENDPOINT','LIFEWEAVE_MODEL_MAX_REQUESTS','LIFEWEAVE_MODEL_TIMEOUT_MS'];
  if(keys.every(key=>env[key]===undefined||env[key]===''))return undefined;
  const invalid=code=>{throw new Error(`Local model configuration rejected: ${code}`);};
  const model=env.LIFEWEAVE_MODEL;
  if(typeof model!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$/.test(model))invalid('invalid-model');
  let endpoint;
  try{endpoint=new URL(env.LIFEWEAVE_MODEL_ENDPOINT||'http://127.0.0.1:11434/v1/chat/completions');}catch{invalid('invalid-endpoint');}
  if(endpoint.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(endpoint.hostname)||endpoint.pathname!=='/v1/chat/completions'||endpoint.username||endpoint.password||endpoint.search||endpoint.hash)invalid('loopback-endpoint-required');
  const integer=(key,fallback,min,max)=>{const raw=env[key];if(raw===undefined||raw==='')return fallback;if(typeof raw!=='string'||!/^\d+$/.test(raw))invalid('invalid-budget-or-timeout');const value=Number(raw);if(!Number.isSafeInteger(value)||value<min||value>max)invalid('invalid-budget-or-timeout');return value;};
  return {model,endpoint:endpoint.href,maxRequests:integer('LIFEWEAVE_MODEL_MAX_REQUESTS',1,0,10),timeoutMs:integer('LIFEWEAVE_MODEL_TIMEOUT_MS',10000,1,60000),allowRemote:false,allowDisclosure:false};
}
