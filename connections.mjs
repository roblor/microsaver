export class ConnectionError extends Error {
 constructor(message,status=502){super(message);this.status=status;}
}
async function readJson(url,headers,fetcher){
 for(const [name,value] of Object.entries(headers)) {
  const credential=name==='Authorization'&&typeof value==='string'?value.replace(/^Bearer /,''):value;
  if(typeof credential!=='string'||/[^\x21-\x7e]/.test(credential))throw new ConnectionError('Invalid characters in '+name+'. Re-enter the key without spaces, line breaks or non-ASCII characters.',503);
 }
 let response;
 try{response=await fetcher(url,{method:'GET',headers,redirect:'error',signal:AbortSignal.timeout(15000)});}
 catch(error){
  const code=error?.cause?.code||error?.code;
  const hints={ENOTFOUND:'DNS lookup failed.',EAI_AGAIN:'DNS lookup temporarily failed.',ECONNREFUSED:'Connection refused.',ECONNRESET:'Connection reset by the network or provider.',ETIMEDOUT:'Network connection timed out.',UND_ERR_CONNECT_TIMEOUT:'Network connection timed out.',CERT_HAS_EXPIRED:'TLS certificate expired.',UNABLE_TO_VERIFY_LEAF_SIGNATURE:'TLS certificate verification failed.',SELF_SIGNED_CERT_IN_CHAIN:'TLS certificate chain is not trusted.',DEPTH_ZERO_SELF_SIGNED_CERT:'TLS certificate is self-signed.',ERR_INVALID_CHAR:'Invalid characters in request headers.',EPERM:'Network access denied by the operating system.',EACCES:'Network access denied by the operating system.'};
  const hint=hints[code]||(error?.name==='TimeoutError'?'Request exceeded 15 seconds.':'Unclassified network or request failure.');
  throw new ConnectionError('Connection failed: '+hint+' No credentials are included in this diagnostic.');
 }
 if(!response.ok){
 const hint={401:'Credentials were rejected. Check or replace your keys.',403:'Access denied. Check key permissions and account eligibility.',429:'Provider rate limit reached. Wait before retrying.'}[response.status]||'Provider request failed. Try again later.';
 throw new ConnectionError(hint,response.status===429?429:502);
 }
 try{return await response.json();}catch{throw new ConnectionError('Provider returned an invalid response.');}
}
export function connectionStatus(env=process.env){
 return {etoro:{configured:!!(env.ETORO_API_KEY&&env.ETORO_USER_KEY),environment:env.ETORO_ENV||'real',readOnly:true},openai:{configured:!!env.OPENAI_API_KEY,analysisEnabled:false},executionEnabled:false};
}
export async function readPortfolio(env=process.env,fetcher=fetch){
 if(!env.ETORO_API_KEY||!env.ETORO_USER_KEY)throw new ConnectionError('eToro keys are missing. Run Start-Microsaver.ps1 to enter both keys.',503);
 const mode=env.ETORO_ENV||'real';
 if(!['real','demo'].includes(mode))throw new ConnectionError('ETORO_ENV must be real or demo.',503);
 const path=mode==='real'?'/trading/info/portfolio':'/trading/info/demo/portfolio';
 const source='https://public-api.etoro.com/api/v1'+path;
 const raw=await readJson(source,{'x-api-key':env.ETORO_API_KEY,'x-user-key':env.ETORO_USER_KEY,'x-request-id':crypto.randomUUID()},fetcher);
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new ConnectionError('Unexpected portfolio schema; no portfolio values inferred.');
 return {mode,readOnly:true,receivedAt:new Date().toISOString(),source,raw,notice:'Live provider response. Portfolio normalization and investment analysis are not yet enabled.'};
}
function findInstrumentRows(value,found=[]){
 if(Array.isArray(value)){for(const item of value)findInstrumentRows(item,found);return found;}
 if(!value||typeof value!=='object')return found;
 const id=value.instrumentID??value.instrumentId??value.id;
 const symbol=value.symbol??value.ticker??value.displaySymbol??value.symbolFull;
 const name=value.name??value.instrumentDisplayName;
 if((typeof id==='number'||typeof id==='string')&&typeof symbol==='string'&&/^[A-Z0-9.:-]{1,15}$/i.test(symbol))found.push({instrumentId:id,symbol:symbol.toUpperCase(),name:typeof name==='string'?name:null});
 for(const child of Object.values(value))if(child&&typeof child==='object')findInstrumentRows(child,found);
 return found;
}
export async function readInstrumentUniverse(env=process.env,fetcher=fetch){
 if(!env.ETORO_API_KEY||!env.ETORO_USER_KEY)throw new ConnectionError('eToro keys are missing. Run Start-Microsaver.ps1 to enter both keys.',503);
 const raw=await readJson('https://public-api.etoro.com/api/v1/market-data/instruments',{'x-api-key':env.ETORO_API_KEY,'x-user-key':env.ETORO_USER_KEY,'x-request-id':crypto.randomUUID()},fetcher);
 const instruments=[];const seen=new Set();
 for(const instrument of findInstrumentRows(raw)){if(!seen.has(String(instrument.instrumentId))){seen.add(String(instrument.instrumentId));instruments.push(instrument);}}
 if(!instruments.length)throw new ConnectionError('eToro instrument catalogue returned no usable symbols. Starting alternatives are blocked.');
 return instruments.slice(0,250);
}
export async function checkOpenAI(env=process.env,fetcher=fetch){
 if(!env.OPENAI_API_KEY)throw new ConnectionError('OpenAI key is missing. Run Start-Microsaver.ps1 to enter it.',503);
 const result=await readJson('https://api.openai.com/v1/models',{Authorization:'Bearer '+env.OPENAI_API_KEY},fetcher);
 if(!Array.isArray(result.data))throw new ConnectionError('Unexpected OpenAI response.');
 return {authenticated:true,checkedAt:new Date().toISOString(),message:'OpenAI authentication succeeded. No analysis was run and no portfolio data was sent. Model access and billing for analysis still need validation.'};
}

export async function submitOrder(env=process.env,order,fetcher=fetch){
 if(!env.ETORO_API_KEY||!env.ETORO_USER_KEY)throw new ConnectionError('eToro keys are missing. Run Start-Microsaver.ps1 to load them.',503);
 if(!order||!['demo','real'].includes(order.mode)||!['buy','sell'].includes(order.transaction)||!['open'].includes(order.action))throw new ConnectionError('Invalid order request.',400);
 if(!(typeof order.instrumentId==='string'||typeof order.instrumentId==='number')||String(order.instrumentId).length>30)throw new ConnectionError('Invalid eToro instrument.',400);
 if(!Number.isFinite(order.amount)||order.amount<=0||order.amount>100000)throw new ConnectionError('Order amount must be between 0 and 100,000 USD.',400);
 const headers={'x-api-key':env.ETORO_API_KEY,'x-user-key':env.ETORO_USER_KEY,'x-request-id':crypto.randomUUID(),'Content-Type':'application/json'};
 for(const [name,value] of Object.entries(headers)){if(typeof value!=='string'||/[^\x21-\x7e]/.test(value))throw new ConnectionError('Invalid characters in '+name+'. Re-enter the key without spaces, line breaks or non-ASCII characters.',503);}
 const path=order.mode==='demo'?'/api/v2/trading/execution/demo/orders':'/api/v2/trading/execution/orders';let response;
 try{response=await fetcher('https://public-api.etoro.com'+path,{method:'POST',headers,redirect:'error',signal:AbortSignal.timeout(20000),body:JSON.stringify({action:'open',transaction:order.transaction,instrumentId:order.instrumentId,orderType:'mkt',amount:order.amount,orderCurrency:'usd'})});}
 catch(error){throw new ConnectionError('Order request could not reach eToro. No execution result was received.');}
 if(!response.ok){const hint={401:'eToro rejected the credentials.',403:'eToro denied execution. Check that the key has '+order.mode+' trading permission.',409:'eToro rejected the order because the account state changed.',422:'eToro rejected the order parameters or instrument.',429:'eToro rate limit reached. Try again later.'}[response.status]||'eToro rejected the order request.';throw new ConnectionError(hint,response.status===429?429:502);}
 let receipt={};try{receipt=await response.json();}catch{}
 const orderId=[receipt.orderId,receipt.orderID,receipt.id,receipt.data?.orderId].find(value=>typeof value==='string'||typeof value==='number');
 return {submittedAt:new Date().toISOString(),mode:order.mode,transaction:order.transaction,instrumentId:String(order.instrumentId),amount:order.amount,requestId:headers['x-request-id'],orderId:orderId===undefined?null:String(orderId),providerState:'submitted'};
}
