import fs from 'node:fs';
const html=fs.readFileSync('src/index.html','utf8').replace(/<script>[\s\S]*?<\/script>/, ()=>'<script>'+fs.readFileSync('src/client-water.js','utf8')+'</script>');
const server=fs.readFileSync('src/server.mjs','utf8');
fs.mkdirSync('dist/server',{recursive:true});fs.mkdirSync('dist/.openai',{recursive:true});
fs.writeFileSync('dist/server/index.js',server+'\nconst html='+JSON.stringify(html)+';\nexport default {async fetch(request,env){const p=new URL(request.url).pathname;if(p==="/api/air")return api(request,env);if(p==="/api/kwater"||p==="/api/busan")return waterApi(request,env);if(p!=="/")return new Response("Not found",{status:404});return new Response(html,{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"}})}};');
if(fs.existsSync('.openai/hosting.json'))fs.copyFileSync('.openai/hosting.json','dist/.openai/hosting.json');
console.log('Built server and dashboard');
