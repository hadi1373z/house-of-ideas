import assert from 'node:assert/strict';

// Service credentials arrive on hidden stdin, never in argv, files or logs.
const origin='https://house-of-ideas.nutmeg-ibex-4408.chatgpt.site';
async function readInput() {
 return new Promise((resolve,reject)=>{
  let input='';const terminal=process.stdin.isTTY;
  const cleanup=()=>{process.stdin.removeListener('data',onData);process.stdin.removeListener('end',onEnd);if(terminal)process.stdin.setRawMode(false);process.stdin.pause();};
  const finish=()=>{cleanup();try{resolve(JSON.parse(input.trim()));}catch{reject(Error('Provide one JSON object on stdin.'));}};
  const onEnd=()=>finish();
  const onData=chunk=>{input+=chunk;if(input.length>20000){cleanup();reject(Error('Review input is too large.'));return;}if(input.includes('\u0003')){cleanup();reject(Error('Review cancelled.'));return;}if(input.includes('\n')||input.includes('\r'))finish();};
  if(terminal){process.stdin.setRawMode(true);process.stderr.write('Ready for review JSON on stdin (input is hidden).\n');}
  process.stdin.setEncoding('utf8');process.stdin.on('data',onData);process.stdin.once('end',onEnd);process.stdin.resume();
 });
}
try {
 const input=await readInput();
 if(input.url!==origin||typeof input.token!=='string'||!input.token)throw Error('Use the current linked private Site and a fresh service credential.');
 const headers={'OAI-Sites-Authorization':'Bearer '+input.token};
 const request=async(path,method)=>{
  const response=await fetch(origin+path,{method,headers,redirect:'error',signal:AbortSignal.timeout(30000)});
  if(!response.ok){
   let detail;try{detail=await response.json();}catch{}
   const known=['The evening review service takes no request data.','Use the private evening review service.','The evening review could not be saved. It can be retried safely.','Method not allowed.'];
   throw Error('Review service returned HTTP '+response.status+'.'+(known.includes(detail?.error)?' '+detail.error:''));
  }
  if(!response.headers.get('content-type')?.includes('application/json'))throw Error('Review service did not return JSON.');
  return response.json();
 };
 const result=await request('/api/review/run','POST');
 const status=await request('/api/review/status','GET');
 assert.deepEqual(status.lastRun,result,'The persisted evening review receipt differs from the completed run.');
 const countKeys=['enrolled','created','existing','noActivity','revoked','invalid'];
 if(!/^\d{4}-\d{2}-\d{2}$/.test(result.date)||countKeys.some(key=>!Number.isInteger(result[key])||result[key]<0)||!Number.isFinite(Date.parse(result.completedAt)))throw Error('The review service returned an invalid aggregate receipt.');
 console.log(JSON.stringify({verified:true,date:result.date,...Object.fromEntries(countKeys.map(key=>[key,result[key]])),completedAt:result.completedAt}));
} catch(error) {
 // Fixed/local messages only. Network errors cannot disclose input headers.
 console.error(error instanceof assert.AssertionError?'Review write/readback verification failed.':error.message.startsWith('Review service')||error.message.startsWith('Use the current')||error.message.startsWith('Provide one')||error.message.startsWith('Review input')||error.message.startsWith('Review cancelled')||error.message.startsWith('The review service')?error.message:'The evening review request failed. Recheck private access and retry safely.');
 process.exitCode=1;
}
