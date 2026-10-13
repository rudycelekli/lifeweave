import './bootstrap.mjs';
const {createLocalServer}=await import('../apps/web/server.mjs');
const local=await createLocalServer({port:Number(process.env.LIFEWEAVE_PORT||4317),dataDir:process.env.LIFEWEAVE_DATA_DIR});
console.log(JSON.stringify({event:'lifeweave.ready',url:local.origin,workerIntervalMs:local.status.intervalMs,externalActions:false}));
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await local.close();process.exit(0);});
