import test from 'node:test';
import assert from 'node:assert/strict';
import {readHostModelConfig} from '../apps/web/host-model.mjs';

test('host model stays disabled without explicit configuration, ignoring generic provider secrets',()=>{
  assert.equal(readHostModelConfig({}),undefined);
  assert.equal(readHostModelConfig({OPENAI_API_KEY:'ignored-private-token',OLLAMA_HOST:'https://remote.invalid'}),undefined);
  const configured=readHostModelConfig({LIFEWEAVE_MODEL:'installed-example:3b'});
  assert.equal(configured.endpoint,'http://127.0.0.1:11434/v1/chat/completions');assert.equal(configured.maxRequests,1);assert.equal(configured.allowRemote,false);assert.equal(configured.allowDisclosure,false);assert.equal(configured.apiKey,undefined);
});
test('host model rejects remote endpoints, URL credentials, redirects paths and unbounded budgets without echoing inputs',()=>{
  const base={LIFEWEAVE_MODEL:'installed-example:3b'};
  for(const endpoint of ['https://cloud.invalid/v1/chat/completions','http://remote.invalid/v1/chat/completions','http://private-token@localhost:11434/v1/chat/completions','http://localhost:11434/v1/chat/completions?token=private-token','http://localhost:11434/other']){
    assert.throws(()=>readHostModelConfig({...base,LIFEWEAVE_MODEL_ENDPOINT:endpoint}),error=>/loopback-endpoint-required/.test(error.message)&&!error.message.includes('private-token'));
  }
  for(const budget of ['-1','11','1.5','Infinity','1e2'])assert.throws(()=>readHostModelConfig({...base,LIFEWEAVE_MODEL_MAX_REQUESTS:budget}),/invalid-budget/);
  for(const timeout of ['0','60001','1.5'])assert.throws(()=>readHostModelConfig({...base,LIFEWEAVE_MODEL_TIMEOUT_MS:timeout}),/invalid-budget/);
  assert.throws(()=>readHostModelConfig({LIFEWEAVE_MODEL_ENDPOINT:'http://localhost:11434/v1/chat/completions'}),/invalid-model/);
  assert.throws(()=>readHostModelConfig({LIFEWEAVE_MODEL:'Bearer private-token'}),error=>/invalid-model/.test(error.message)&&!error.message.includes('private-token'));
  assert.equal(readHostModelConfig({...base,LIFEWEAVE_MODEL_MAX_REQUESTS:'0',LIFEWEAVE_MODEL_TIMEOUT_MS:'60000'}).maxRequests,0);
});
