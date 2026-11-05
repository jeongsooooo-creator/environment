const $=id=>document.getElementById(id);
const state={air:{data:null,busy:false,error:''},kw:{data:null,busy:false,error:''},bs:{data:null,busy:false,error:''}};
const meta={air:{agency:'한국환경공단',label:'초미세먼지',unit:'㎍/㎥',color:'#087f70'},kw:{agency:'K-water',label:'탁도',unit:'NTU',color:'#368ea5'},bs:{agency:'부산광역시',label:'pH',unit:'pH',color:'#7b9445'}};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const show=v=>v===null||v===undefined?'—':v;
const stamp=d=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(d));
function opt(value,text){const o=document.createElement('option');o.value=value;o.textContent=text;return o;}
function airLast(){const d=state.air.data;return d?.rows.at(-1)||d?.stations.find(r=>r.station===d.station);}
function busanPoint(){const d=state.bs.data;return d?.rows.find(r=>r.id===$('bs-point').value)||d?.rows[0];}
function selected(){const key=$('series').value,m=meta[key],n=Number($('period').value);let rows=[];
  if(key==='air')rows=(state.air.data?.rows||[]).map(r=>({...r,value:r.pm25,label:r.time.slice(-5),status:r.pm25===null?r.flag||'미수신':'실측'})).slice(-n);
  if(key==='kw'){const end=state.kw.data?.end;const start=end?new Date(Date.parse(end+'T00:00:00Z')-(n-1)*86400000).toISOString().slice(0,10):'';rows=(state.kw.data?.rows||[]).filter(r=>r.time>=start).map(r=>({...r,value:r.turbidity,label:r.time.slice(5),status:r.turbidity===null?'미수신':'일간 실측'}));}
  if(key==='bs'){const point=busanPoint();rows=(state.bs.data?.rows||[]).filter(r=>r.dong===point?.dong).map(r=>({...r,value:r.ph,label:r.station,time:'측정시각 미제공',status:r.status||'상태 미제공'}));}
  return {key,m,rows};
}
function periodOptions(){const k=$('series').value,old=$('period').value,choices=k==='air'?[[24,'24시간'],[12,'12시간'],[6,'6시간']]:k==='kw'?[[30,'30일'],[14,'14일'],[7,'7일']]:[[0,'현재 조회값']];$('period').replaceChildren(...choices.map(([v,t])=>opt(v,t)));if(choices.some(c=>String(c[0])===old))$('period').value=old;$('period').disabled=k==='bs';}
function render(){const count=Object.values(state).filter(s=>s.data).length,loading=Object.values(state).some(s=>s.busy),errors=Object.entries(state).filter(([k,s])=>s.error);
  $('mode-title').textContent=errors.length?'일부 데이터 조회에 문제가 있습니다':count===3?'세 기관의 실제 환경 데이터가 연결되었습니다':loading?'기관별 데이터를 불러오고 있습니다':'환경 데이터 연결 상태';
  $('mode-desc').textContent=errors.length?errors.map(([k,s])=>meta[k].agency+': '+s.error).join(' / '):'대기질은 시간별, K-water는 일별 자료입니다. 부산 수질은 측정시각이 제공되지 않아 조회 시각을 표시합니다.';
  const air=airLast(),kw=state.kw.data?.rows.at(-1),bs=busanPoint();
  const items={air,kw,bs};
  for(const [k,s]of Object.entries(state)){const row=items[k],d=s.data;$(k+'-value').textContent=show(k==='air'?row?.pm25:k==='kw'?row?.turbidity:row?.ph);$(k+'-station').textContent=row?(k==='air'?'부산 · ':k==='bs'?d.districtName+' · ':'')+row.station:'조회 데이터 없음';
    $(k+'-detail').textContent=k==='bs'&&d?'측정시각 미제공 · 조회 '+stamp(d.receivedAt)+' KST':row?'측정 '+row.time+(k==='air'?' KST · 1시간 측정값':' · 일간 자료'):'측정 시각 —';
    const badge=document.querySelectorAll('.state')[['air','kw','bs'].indexOf(k)];badge.textContent=s.error?(d?'이전 수신 자료':'조회 오류'):s.busy?'조회 중':row?(k==='kw'?'일간 실측':k==='bs'?row.status||'현재 조회값':row.pm25===null?row.flag||'미수신':'실측'):'자료 없음';
    $(k+'-status').textContent=s.error?'조회 오류':d?'연결 완료':'조회 중';$(k+'-status-desc').textContent=d?(k==='air'?'부산 '+d.stations.length+'개 측정소':k==='kw'?d.plant.name+' · 최근 30일 조회':d.districtName+' · '+d.rows.length+'개 조회 항목'):s.error||'공식 API 조회 중';
  }
  $('extra-air').textContent=air?'PM₁₀ '+show(air.pm10)+' ㎍/㎥ · 오존 '+show(air.ozone)+' ppm':'관측값 미수신';
  $('extra-kw').textContent=kw?'pH '+show(kw.ph)+' · 잔류염소 '+show(kw.chlorine)+' mg/L':'최근 30일 내 수질 자료 없음';
  $('extra-bs').textContent=bs?'탁도 '+show(bs.turbidity)+' NTU · 잔류염소 '+show(bs.chlorine)+' mg/L':'검사지점 데이터 없음';
  $('station').disabled=state.air.busy;$('kw-plant').disabled=state.kw.busy;$('bs-district').disabled=state.bs.busy;$('bs-point').disabled=state.bs.busy;
  $('refresh').disabled=loading;$('refresh').textContent=loading?'조회 중…':'전체 새로고침';
  $('poll-status').textContent='페이지가 열려 있으면 10분마다 조회 · '+count+'/3 기관 수신';
  const {key,m,rows}=selected(),d=state[key].data;
  $('graph-title').textContent=key==='bs'?'검사지점별 현재 pH':'시간에 따른 변화';
  $('chart-caption').textContent=m.label+' · '+m.unit+' · '+(key==='bs'?(d?.districtName||'')+' / 동코드 '+(bs?.dong||'—'):key==='kw'?'최근 '+$('period').value+'일':'최근 '+$('period').value+'시간');
  $('chart-foot').textContent=key==='bs'?'출처: 부산광역시 · 같은 동코드의 검사지점 비교 · 시간 추이가 아닙니다.':key==='kw'?'출처: 한국수자원공사 · 일간 수질 · 최신 측정일 '+(kw?.time||'—'):'출처: 한국환경공단 에어코리아 · 미확정 실시간 자료 · 빈 구간은 결측값';
  $('table-caption').textContent=d?m.agency+' · 조회 '+stamp(d.receivedAt)+' KST'+(key==='bs'?' · 측정시각 미제공':''): '데이터 조회 대기';
  $('download').disabled=!rows.length;
  $('rows').innerHTML=rows.length?rows.slice().reverse().map(r=>'<tr><td>'+esc(r.time)+'</td><td>'+m.agency+'</td><td>'+esc(r.station)+(key==='bs'?' · 동코드 '+esc(r.dong):'')+'</td><td>'+m.label+'</td><td>'+show(r.value)+' '+m.unit+'</td><td>'+esc(r.status)+'</td></tr>').join(''):'<tr><td colspan="6">조회 기간에 수신된 자료가 없습니다.</td></tr>';
  draw(rows,m,key);
}
function draw(rows,m,key){const good=rows.filter(r=>r.value!==null);if(!good.length){$('chart').innerHTML='<div class="empty"><strong>표시할 관측값이 없습니다</strong><p>조회 기간이나 해당 지점의 수신 상태를 확인하세요.</p></div>';return;}
  const W=720,H=245,L=48,R=15,T=20,B=35,vals=good.map(r=>r.value);let min=Math.min(...vals),max=Math.max(...vals),pad=Math.max((max-min)*.35,key==='air'?3:.025);min=key==='bs'?0:Math.max(0,min-pad);max+=pad;const x=i=>L+(i+.5)*(W-L-R)/rows.length,y=v=>T+(max-v)*(H-T-B)/(max-min);let svg='';
  for(let i=0;i<5;i++){const v=min+(max-min)*i/4,yy=y(v);svg+='<line x1="'+L+'" y1="'+yy+'" x2="'+(W-R)+'" y2="'+yy+'" stroke="#e5ebe4"/><text x="'+(L-9)+'" y="'+(yy+4)+'" text-anchor="end" fill="#73847a" font-size="11">'+v.toFixed(key==='air'?0:2)+'</text>';}
  let seg=[];const flush=()=>{if(seg.length)svg+='<polyline points="'+seg.join(' ')+'" fill="none" stroke="'+m.color+'" stroke-width="2.5"/>';seg=[];};
  rows.forEach((r,i)=>{if(key!=='bs'){if(r.value===null)flush();else seg.push(x(i)+','+y(r.value));}if(i%Math.ceil(rows.length/6)===0||i===rows.length-1)svg+='<text x="'+x(i)+'" y="'+(H-8)+'" text-anchor="middle" fill="#73847a" font-size="11">'+esc(r.label.length>7?r.label.slice(0,6)+'…':r.label)+'</text>';});flush();
  rows.forEach((r,i)=>{if(r.value===null)return;const title=esc((key==='bs'?r.station:r.time)+' · '+r.value+' '+m.unit);svg+=key==='bs'?'<rect x="'+(x(i)-Math.min(22,(W-L-R)/rows.length*.3))+'" y="'+y(r.value)+'" width="'+Math.min(44,(W-L-R)/rows.length*.6)+'" height="'+(H-B-y(r.value))+'" fill="'+m.color+'" rx="3"><title>'+title+'</title></rect>':'<circle cx="'+x(i)+'" cy="'+y(r.value)+'" r="3" fill="'+m.color+'"><title>'+title+'</title></circle>';});
  $('chart').innerHTML='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+m.label+(key==='bs'?' 검사지점별 현재 비교':' 실측 추이')+'. 상세값은 아래 표 참고.">'+svg+'</svg>';
}
async function load(key,param){const s=state[key];if(s.busy)return;s.busy=true;render();const routes={air:'/api/air',kw:'/api/kwater',bs:'/api/busan'};try{
  const r=await fetch(routes[key]+(param?'?'+new URLSearchParams(param):''),{cache:'no-store'}),data=await r.json();if(!r.ok)throw new Error(data.error);s.data=data;s.error='';
  if(key==='air'){$('station').replaceChildren(...data.stations.map(r=>opt(r.station,r.station+(r.pm25===null?' · 미수신':''))));$('station').value=data.station;}
  if(key==='kw'){$('kw-plant').replaceChildren(...data.plants.map(p=>opt(p.code,p.name)));$('kw-plant').value=data.plant.code;}
  if(key==='bs'){const old=$('bs-point').value;$('bs-district').replaceChildren(...Object.entries(data.districts).map(([c,n])=>opt(c,n)));$('bs-district').value=data.district;$('bs-point').replaceChildren(...data.rows.map(p=>opt(p.id,p.station+' · 동코드 '+p.dong)));if(data.rows.some(p=>p.id===old))$('bs-point').value=old;}
  }catch(e){s.error=({KEY_MISSING:'서버 인증키 확인 필요',API_RESPONSE_ERROR:'기관 응답 오류 · 승인 상태와 호출 한도 확인',UPSTREAM_UNAVAILABLE:'기관 연결 지연 · 잠시 후 다시 조회',NO_DATA:'조회 자료 없음'})[e.message]||'조회 실패 · 잠시 후 다시 시도';}finally{s.busy=false;render();}}
function all(){return Promise.all([load('air',state.air.data?{station:$('station').value}:null),load('kw',state.kw.data?{plant:$('kw-plant').value}:null),load('bs',state.bs.data?{district:$('bs-district').value}:null)]);}
$('today').textContent=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'long',day:'numeric'}).format(new Date())+' · KST';
$('series').onchange=()=>{periodOptions();render();};$('period').onchange=render;$('station').onchange=()=>load('air',{station:$('station').value});$('kw-plant').onchange=()=>load('kw',{plant:$('kw-plant').value});$('bs-district').onchange=()=>load('bs',{district:$('bs-district').value});$('bs-point').onchange=render;$('refresh').onclick=all;
$('download').onclick=()=>{const {key,m,rows}=selected(),d=state[key].data;const data=[['관측일시(KST)','조회시각(UTC)','기관','측정지점','동코드','항목','값','단위','상태'],...rows.map(r=>[r.time,d.receivedAt,m.agency,r.station,r.dong||'',m.label,r.value??'',m.unit,r.status])];const csv=data.map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n'),a=document.createElement('a'),u=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));a.href=u;a.download='환경한눈에_실측_'+key+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};
periodOptions();render();all();setInterval(()=>{if(!document.hidden)all();},600000);
