const BASE = 'https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/';
const memo = new Map();
function number(value) { if (value == null || String(value).trim() === '' || value === '-') return null; const n = Number(value); return Number.isFinite(n) && n >= 0 ? n : null; }
function clean(item) {
  return {time:String(item.dataTime || ''), station:String(item.stationName || ''), pm25:number(item.pm25Value), pm10:number(item.pm10Value), ozone:number(item.o3Value), flag:String(item.pm25Flag || ''), network:String(item.mangName || '')};
}
async function upstream(env, operation, params) {
  const id = operation + JSON.stringify(params); const hit = memo.get(id);
  if (hit && Date.now() - hit.at < 300000) return hit.items;
  if (!env.AIRKOREA_SERVICE_KEY) throw new Error('KEY_MISSING');
  let key = env.AIRKOREA_SERVICE_KEY.trim(); if (/%[0-9a-f]{2}/i.test(key)) { try { key = decodeURIComponent(key); } catch {} }
  const url = new URL(BASE + operation);
  url.search = new URLSearchParams({serviceKey:key, returnType:'json', pageNo:'1', numOfRows:'100', ver:'1.3', ...params});
  let response; try { response = await fetch(url, {signal:AbortSignal.timeout(15000)}); } catch { throw new Error('UPSTREAM_UNAVAILABLE'); }
  if (!response.ok) throw new Error('UPSTREAM_UNAVAILABLE');
  let data; try { data = await response.json(); } catch { throw new Error('API_RESPONSE_ERROR'); }
  if (String(data.response?.header?.resultCode) !== '00') throw new Error('API_RESPONSE_ERROR');
  const items = data.response?.body?.items;
  if (!Array.isArray(items)) throw new Error('API_RESPONSE_ERROR');
  const result = items.map(clean); if (memo.size > 100) memo.clear(); memo.set(id, {at:Date.now(), items:result}); return result;
}
export async function api(request, env) {
  const u = new URL(request.url);
  if (request.method !== 'GET') return Response.json({error:'METHOD_NOT_ALLOWED'}, {status:405});
  try {
    const stations = await upstream(env, 'getCtprvnRltmMesureDnsty', {sidoName:'부산'});
    const requested = u.searchParams.get('station');
    if (requested && !stations.some(s=>s.station === requested)) return Response.json({error:'INVALID_STATION'}, {status:400});
    const chosen = requested || stations.find(s=>s.pm25 !== null && s.network === '도시대기')?.station || stations[0]?.station;
    if (!chosen) throw new Error('NO_DATA');
    const history = await upstream(env, 'getMsrstnAcctoRltmMesureDnsty', {stationName:chosen, dataTerm:'DAILY'});
    const rows = history.map(r=>({...r,station:chosen})).sort((a,b)=>a.time.localeCompare(b.time)).slice(-24);
    return Response.json({source:'한국환경공단 에어코리아',region:'부산',station:chosen,receivedAt:new Date().toISOString(),stations,rows}, {headers:{'Cache-Control':'private, no-store'}});
  } catch (e) {
    const known=['KEY_MISSING','UPSTREAM_UNAVAILABLE','API_RESPONSE_ERROR','NO_DATA'];
    return Response.json({error:known.includes(e.message)?e.message:'UPSTREAM_UNAVAILABLE'}, {status:503,headers:{'Cache-Control':'no-store'}});
  }
}
export const districts = {'110':'중구','140':'서구','170':'동구','200':'영도구','230':'부산진구','260':'동래구','290':'남구','320':'북구','350':'해운대구','380':'사하구','410':'금정구','440':'강서구','470':'연제구','500':'수영구','530':'사상구','710':'기장군'};
async function waterFetch(envKey, base, params, ttl) {
  if (!envKey) throw new Error('KEY_MISSING');
  const id=base+JSON.stringify(params), hit=memo.get(id); if(hit&&Date.now()-hit.at<ttl)return hit.body;
  let key=envKey.trim();if(/%[0-9a-f]{2}/i.test(key)){try{key=decodeURIComponent(key);}catch{}}
  const url=new URL(base);url.search=new URLSearchParams({serviceKey:key,...params});
  let r;try{r=await fetch(url,{signal:AbortSignal.timeout(20000)});}catch{throw new Error('UPSTREAM_UNAVAILABLE');}
  if(!r.ok)throw new Error('UPSTREAM_UNAVAILABLE');let j;try{j=await r.json();}catch{throw new Error('API_RESPONSE_ERROR');}
  if(!['00','0'].includes(String(j.response?.header?.resultCode)))throw new Error('API_RESPONSE_ERROR');
  const body=j.response.body;if(!body)throw new Error('API_RESPONSE_ERROR');if(memo.size>100)memo.clear();memo.set(id,{at:Date.now(),body});return body;
}
function list(body){const v=body.items?.item;return Array.isArray(v)?v:v&&typeof v==='object'?[v]:[];}
function kstDay(ms=Date.now()){return new Date(ms+9*3600000).toISOString().slice(0,10);}
export async function waterApi(request,env) {
  if(request.method!=='GET')return Response.json({error:'METHOD_NOT_ALLOWED'},{status:405});
  const u=new URL(request.url);try{
    let result;
    if(u.pathname==='/api/kwater'){
      const base='https://apis.data.go.kr/B500001/waterways/wdr/';
      const codes=await waterFetch(env.KWATER_SERVICE_KEY,base+'waterfltplt/waterfltpltlist',{pageNo:'1',numOfRows:'100',_type:'json'},86400000);
      const plants=list(codes).map(r=>({code:String(r.fltplt),name:String(r.fltpltnm)}));
      const code=u.searchParams.get('plant')||plants.find(p=>p.code==='A045')?.code||plants[0]?.code;
      const plant=plants.find(p=>p.code===code);if(!plant)return Response.json({error:'INVALID_PLANT'},{status:400});
      const start=kstDay(Date.now()-29*86400000),end=kstDay();
      const b=await waterFetch(env.KWATER_SERVICE_KEY,base+'dailwater/dailwaterlist',{pageNo:'1',numOfRows:'100',_type:'json',fcode:code,stdt:start,eddt:end},1800000);
      const rows=list(b).map(r=>{const raw=String(r.mesurede);return {time:/^\d{8}$/.test(raw)?raw.slice(0,4)+'-'+raw.slice(4,6)+'-'+raw.slice(6):raw,station:plant.name,ph:number(r.item4),turbidity:number(r.item5),chlorine:number(r.item6),taste:String(r.item1??''),odor:String(r.item2??'')};}).sort((a,b)=>a.time.localeCompare(b.time));
      result={source:'한국수자원공사 공업생활용수 수질 정보',interval:'일간',plant,plants,start,end,rows,receivedAt:new Date().toISOString()};
    }else{
      const district=u.searchParams.get('district')||'470';if(!districts[district])return Response.json({error:'INVALID_DISTRICT'},{status:400});
      const b=await waterFetch(env.BUSAN_WATER_SERVICE_KEY,'https://apis.data.go.kr/6260000/TownWaterQualityService/getVillageWaterQuality',{pageNo:'1',numOfRows:'1000',resultType:'json',argGugun:district},300000);
      const rows=list(b).map(r=>({id:[r.argGugun,r.argHjd,r.orgAreaNm].join('|'),station:String(r.orgAreaNm??''),kind:String(r.gb??''),district:String(r.argGugun??''),dong:String(r.argHjd??''),ph:number(r.ph),turbidity:number(r.td),chlorine:number(r.jy),conductivity:number(r.ec),temperature:number(r.tp),status:String(r.sopCheck??''),time:null}));
      result={source:'부산광역시 우리동네 수질 정보 조회',interval:'현재 조회값',district,districtName:districts[district],districts,rows,total:Number(b.totalCount),receivedAt:new Date().toISOString(),measurementTimeProvided:false};
    }
    return Response.json(result,{headers:{'Cache-Control':'private, no-store'}});
  }catch(e){const known=['KEY_MISSING','UPSTREAM_UNAVAILABLE','API_RESPONSE_ERROR'];return Response.json({error:known.includes(e.message)?e.message:'UPSTREAM_UNAVAILABLE'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
