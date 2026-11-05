const PAGES_ORIGIN='https://jeongsooooo-creator.github.io';
const API_PATHS=new Set(['/api/air','/api/kwater','/api/busan']);
export async function dispatch(request,env,html){
  const url=new URL(request.url),origin=request.headers.get('Origin');
  if(API_PATHS.has(url.pathname)){
    const allowed=origin===PAGES_ORIGIN;
    if(request.method==='OPTIONS')return new Response(null,{status:allowed?204:403,headers:allowed?{'Access-Control-Allow-Origin':PAGES_ORIGIN,'Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Max-Age':'86400','Vary':'Origin'}:{'Vary':'Origin'}});
    const response=url.pathname==='/api/air'?await api(request,env):await waterApi(request,env);
    const headers=new Headers(response.headers);headers.set('Vary','Origin');
    if(allowed)headers.set('Access-Control-Allow-Origin',PAGES_ORIGIN);
    return new Response(response.body,{status:response.status,headers});
  }
  if(url.pathname!=='/')return new Response('Not found',{status:404});
  return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
}
