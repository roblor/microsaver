import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';
import {connectionStatus,readPortfolio,checkOpenAI,ConnectionError} from './connections.mjs';
import {Iteration} from './iteration.mjs';
export function createServer(app,port=8765){
 const token=crypto.randomUUID();
 return http.createServer(async(req,res)=>{
 const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
 const origins=['http://127.0.0.1:'+port,'http://localhost:'+port];
 if(!origins.includes('http://'+req.headers.host)||req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&!origins.includes(req.headers.origin)))return json(403,{error:'Local same-origin access only.'});
 try{
 if(req.method==='POST'){
 if(req.headers['x-microsaver-token']!==token)return json(403,{error:'Reload the page before making changes.'});
 if(req.headers['content-type']!=='application/json')return json(415,{error:'JSON required.'});
 let body='';for await(const chunk of req){body+=chunk;if(body.length>10000)return json(413,{error:'Request too large.'});}
 let input;try{input=JSON.parse(body);}catch{return json(400,{error:'Invalid JSON.'});}
 if(req.url==='/api/settings'){await app.configure(input);return json(200,{ok:true});}
 if(req.url==='/api/refresh'){if(app.busy)return json(409,{error:'Research is running.'});app.busy=true;try{await app.refresh();app.error=null;}finally{app.busy=false;}return json(200,{ok:true});}
 if(req.url==='/api/research'){if(app.busy)return json(409,{error:'Research is running.'});void app.run().catch(e=>{app.error=e instanceof ConnectionError?e.message:'Research failed.';});return json(202,{ok:true});}
 if(req.url==='/api/review'){await app.decide(input.id,input.status);return json(200,{ok:true});}
 if(req.url==='/api/review-chat'){await app.askReview(input.id,input.question);return json(200,{ok:true});}
 if(req.url==='/api/candidate'){await app.selectCandidate(input.reviewId,input.candidateId,input.selected);return json(200,{ok:true});}
 if(req.url==='/api/orders'){return json(200,await app.executeOrder(input));}
 return json(405,{error:'Unsupported local operation.'});
 }
 if(req.method!=='GET')return json(405,{error:'Method disabled.'});
 if(req.url==='/api/state')return json(200,{...app.snapshot(),token,connections:connectionStatus()});
 if(req.url==='/api/connections')return json(200,connectionStatus());
 if(req.url==='/api/etoro/portfolio')return json(200,await readPortfolio());
 if(req.url==='/api/openai/check')return json(200,await checkOpenAI());
 const paths={'/':'index.html','/app.js':'app.js','/style.css':'style.css'};
 if(!paths[req.url])return json(404,{error:'Not found'});
 res.writeHead(200,{'Content-Type':req.url.endsWith('.js')?'text/javascript':req.url.endsWith('.css')?'text/css':'text/html'});
 res.end(await readFile(new URL('./public/'+paths[req.url],import.meta.url)));
 }catch(error){if(!res.headersSent)json(error instanceof ConnectionError?error.status:500,{error:error instanceof ConnectionError?error.message:'Local operation failed. Check storage access and retry.'});else res.end();}
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const port=Number(process.env.PORT||8765);
 const directory=process.env.MICROSAVER_DATA_DIR||join(process.env.LOCALAPPDATA||process.cwd(),'Microsaver');
 const app=await new Iteration({directory}).init();
 const server=createServer(app,port);
 server.listen(port,'127.0.0.1',()=>{console.log('Microsaver: http://127.0.0.1:'+port);void app.tick();});
 const timer=setInterval(()=>void app.tick(),30*60e3);timer.unref();
 server.on('close',()=>clearInterval(timer));
}
