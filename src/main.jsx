import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './style.css'
import { estacoesLinhaOeste } from './data/estacoes.js'
import { passagensNivelLinhaOeste } from './data/passagensNivel.js'
import { marcosKmLinhaOeste, marcosPrincipaisLinhaOeste } from './data/marcosKm.js'

const VERSION = '3.2.0'
const LS_LOCAIS = 'rjp_nav_locais_extra_v2'
const LS_DESLOC = 'rjp_nav_deslocacoes_v1'
const LS_GPS_ATIVOS = 'rjp_nav_gps_ativos_v2'
const LS_IMPORTADOS = 'rjp_nav_importados_v1'
const LS_FONTES = 'rjp_nav_fontes_drive_v1'

const MODULOS = {
  obras: {
    titulo:'Obras de Arte', categoria:'Obra de Arte', icon:'🌉',
    tipos:['Ponte','Pontão','Viaduto','Túnel','Passagem Superior','Passagem Inferior','Aqueduto','Outro']
  },
  drenagem: {
    titulo:'Órgãos Drenantes', categoria:'Órgão Drenante', icon:'💧',
    tipos:['Passagem Hidráulica','Aqueduto','Valeta','Dreno','Caixa','Descarga','Coletor','Outro']
  },
  geotecnia: {
    titulo:'Geotecnia e Contenções', categoria:'Geotecnia/Contenção', icon:'🏔️',
    tipos:['Talude de escavação','Talude de aterro','Pregagens','Ancoragens','Máscara drenante','Rede metálica','Barreira dinâmica','Betão projetado','Muro de suporte','Gabiões','Terra armada','Dreno sub-horizontal','Vala de crista','Vala de pé','Banqueta','Outro']
  }
}

const norm = (v='') => String(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
const load = (k,d) => { try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(d)) } catch { return d } }
const save = (k,v) => localStorage.setItem(k, JSON.stringify(v))
const today = () => new Date().toISOString().slice(0,10)
const base = import.meta.env.BASE_URL || './'
const kmNumero = v => Number(String(v ?? '').replace('+','.').replace(',','.').replace(/[^0-9.]/g,'')) || 0
const kmVisivel = item => String(item?.km ?? item?.pk ?? '').replace('+', ',')

function csvRows(text){
  const rows=[]; let row=[], field='', quoted=false
  for(let i=0;i<text.length;i++){
    const c=text[i], n=text[i+1]
    if(c==='"' && quoted && n==='"'){ field+='"'; i++; continue }
    if(c==='"'){ quoted=!quoted; continue }
    if(c===',' && !quoted){ row.push(field.trim()); field=''; continue }
    if((c==='\n'||c==='\r') && !quoted){
      if(c==='\r'&&n==='\n') i++
      row.push(field.trim()); field=''
      if(row.some(x=>x!=='')) rows.push(row)
      row=[]; continue
    }
    field+=c
  }
  row.push(field.trim()); if(row.some(x=>x!=='')) rows.push(row)
  return rows
}

function normalizarUrlFolha(url){
  const raw=String(url||'').trim()
  if(!raw) return ''
  if(raw.includes('docs.google.com/spreadsheets')){
    const id=raw.match(/\/d\/([^/]+)/)?.[1]
    const gid=raw.match(/[?&#]gid=(\d+)/)?.[1] || '0'
    if(id) return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`
  }
  return raw
}

function registosCsv(text, modulo){
  const rows=csvRows(text)
  if(rows.length<2) return []
  const headers=rows[0].map(norm)
  const get=(obj,...aliases)=>{ for(const a of aliases){ const i=headers.findIndex(h=>h===norm(a)||h.includes(norm(a))); if(i>=0&&obj[i]!==undefined) return obj[i] } return '' }
  return rows.slice(1).map((r,i)=>{
    const km=get(r,'km','pk','quilometro','quilómetro','pki','km inicial')
    const kmFinal=get(r,'km final','pk final','pkf')
    const nome=get(r,'nome','designacao','designação','descricao','descrição','ativo') || `${MODULOS[modulo].titulo} ${i+1}`
    return {
      id:`${modulo}-${Date.now()}-${i}`, key:`imp-${modulo}-${Date.now()}-${i}`,
      categoria:MODULOS[modulo].categoria, modulo, titulo:nome, nome,
      tipo:get(r,'tipo','tipologia','classe') || 'Outro', km, pk:km, kmFinal,
      lado:get(r,'lado'), estado:get(r,'estado','conservacao','conservação'), risco:get(r,'risco','nivel de risco','nível de risco'),
      prioridade:get(r,'prioridade'), observacoes:get(r,'observacoes','observações','notas'),
      lat:get(r,'latitude','lat'), lng:get(r,'longitude','lng','lon'),
      altura:get(r,'altura'), extensao:get(r,'extensao','extensão'), ultimaInspecao:get(r,'ultima inspecao','última inspeção','data'),
      fonte:'Google Drive/Sheets'
    }
  }).filter(x=>x.km||x.nome)
}

const queryFor = item => item?.lat && item?.lng ? `${item.lat},${item.lng}` : ''
const mapsUrl = item => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(queryFor(item))}&travelmode=driving`
const wazeUrl = item => `https://waze.com/ul?ll=${encodeURIComponent(queryFor(item))}&navigate=yes`

function App(){
  const [tab,setTab] = useState('inicio')
  const [q,setQ] = useState('')
  const [sel,setSel] = useState(null)
  const [navTarget,setNavTarget] = useState(null)
  const [gps,setGps] = useState(null)
  const [gpsEstado,setGpsEstado] = useState('Por verificar')
  const [gpsBusy,setGpsBusy] = useState(false)
  const [extras,setExtras] = useState(load(LS_LOCAIS, []))
  const [desloc,setDesloc] = useState(load(LS_DESLOC, []))
  const [gpsAtivos,setGpsAtivos] = useState(load(LS_GPS_ATIVOS, {}))
  const [importados,setImportados] = useState(load(LS_IMPORTADOS,{obras:[],drenagem:[],geotecnia:[]}))
  const [fontes,setFontes] = useState(load(LS_FONTES,{obras:'',drenagem:'',geotecnia:''}))
  const [syncBusy,setSyncBusy] = useState('')
  const [form,setForm] = useState({categoria:'Obra de Arte',nome:'',tipo:'Outro',pk:'',kmFinal:'',lado:'',observacoes:''})

  useEffect(()=>{ verificarPermissao() },[])

  const withGps = item => {
    const saved = gpsAtivos[item.key]
    return saved ? {...item, lat:saved.lat, lng:saved.lng, gpsSaved:saved} : item
  }

  const ativos = useMemo(()=>[
    ...estacoesLinhaOeste.map(x=>withGps({...x,key:`est-${x.id}`,titulo:x.nome,categoria:'Estação/Apeadeiro'})),
    ...estacoesLinhaOeste.filter(x=>String(x.tipo).includes('Estação')).map(x=>withGps({...x,key:`edf-${x.id}`,categoria:'Edifício',titulo:`EDF · ${x.nome}`,observacoes:'Edifício ferroviário associado à estação'})),
    ...passagensNivelLinhaOeste.map(x=>withGps({...x,key:`pn-${x.id}`,categoria:'Passagem de Nível',titulo:`PN · Km ${kmVisivel(x)}`})),
    ...Object.values(importados).flat().map(withGps),
    ...marcosKmLinhaOeste.map(x=>withGps({...x,key:`km-${x.id}`,categoria:'Marco Quilométrico',titulo:x.nome})),
    ...extras.map((x,i)=>withGps({...x,key:x.key || `extra-${i}`,titulo:x.nome || 'Local registado'}))
  ],[extras,gpsAtivos,importados])

  const categoriaTab = {
    estacoes:'Estação/Apeadeiro', edificios:'Edifício', pn:'Passagem de Nível', obras:'Obra de Arte',
    drenagem:'Órgão Drenante', geotecnia:'Geotecnia/Contenção', km:'Marco Quilométrico'
  }[tab]

  const filtrados = useMemo(()=>ativos.filter(a=>{
    if(categoriaTab && a.categoria !== categoriaTab) return false
    return norm(JSON.stringify(a)).includes(norm(q))
  }).sort((a,b)=>kmNumero(a.km||a.pk)-kmNumero(b.km||b.pk)),[ativos,q,categoriaTab])

  const current = sel && filtrados.some(x=>x.key===sel.key) ? sel : filtrados[0]

  async function verificarPermissao(){
    if(!navigator.geolocation){ setGpsEstado('Indisponível'); return }
    try{
      if(navigator.permissions?.query){
        const p=await navigator.permissions.query({name:'geolocation'})
        const up=()=>setGpsEstado(p.state==='granted'?'Autorizado':p.state==='denied'?'Recusado':'Por autorizar'); up(); p.onchange=up
      } else setGpsEstado('Por autorizar')
    }catch{ setGpsEstado('Por autorizar') }
  }

  async function obterGPS(){
    setGpsBusy(true)
    try{
      if(!navigator.geolocation) throw new Error('GPS indisponível')
      const p=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:20000,maximumAge:0}))
      setGpsEstado('Autorizado')
      setGps({lat:Number(p.coords.latitude).toFixed(6),lng:Number(p.coords.longitude).toFixed(6),acc:Math.round(p.coords.accuracy||0),alt:p.coords.altitude==null?'':Math.round(p.coords.altitude),time:new Date().toISOString()})
    }catch(e){ if(e?.code===1)setGpsEstado('Recusado'); alert('Não foi possível obter a posição. Confirma o GPS e a permissão de localização.') }
    finally{ setGpsBusy(false) }
  }

  function guardarGPSAtivo(item){
    if(!gps){ alert('Obtém primeiro a posição GPS.'); return }
    const reg={lat:gps.lat,lng:gps.lng,acc:gps.acc,alt:gps.alt,data:new Date().toLocaleDateString('pt-PT'),hora:new Date().toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'}),ativo:item.titulo,categoria:item.categoria,pk:item.pk||item.km||''}
    const novo={...gpsAtivos,[item.key]:reg}; setGpsAtivos(novo); save(LS_GPS_ATIVOS,novo); setSel({...item,lat:gps.lat,lng:gps.lng,gpsSaved:reg}); alert('Localização guardada neste ativo.')
  }

  function registarDeslocacao(item){
    const row={id:Date.now(),data:today(),hora:new Date().toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'}),destino:item.titulo,categoria:item.categoria,pk:item.pk||item.km||'',gps:gps?`${gps.lat}, ${gps.lng}`:''}
    const novo=[row,...desloc]; setDesloc(novo); save(LS_DESLOC,novo); alert('Deslocação registada.')
  }

  function adicionarLocal(){
    if(!form.nome&&!form.pk){ alert('Preenche pelo menos o nome ou o Km.'); return }
    const key=`extra-${Date.now()}`
    const novo={...form,id:key,key,linha:'Linha do Oeste',titulo:form.nome||`${form.categoria} ${form.pk}`,lat:gps?.lat||'',lng:gps?.lng||''}
    const lista=[novo,...extras]; setExtras(lista); save(LS_LOCAIS,lista); setForm({categoria:'Obra de Arte',nome:'',tipo:'Outro',pk:'',kmFinal:'',lado:'',observacoes:''}); alert('Ativo guardado.')
  }

  async function sincronizar(modulo){
    const url=normalizarUrlFolha(fontes[modulo])
    if(!url){ alert('Indica primeiro a ligação da folha Google Sheets ou do endpoint CSV.'); return }
    setSyncBusy(modulo)
    try{
      const res=await fetch(url,{cache:'no-store'})
      if(!res.ok) throw new Error(`HTTP ${res.status}`)
      const text=await res.text(); const lista=registosCsv(text,modulo)
      if(!lista.length) throw new Error('A folha não contém linhas reconhecíveis.')
      const novo={...importados,[modulo]:lista}; setImportados(novo); save(LS_IMPORTADOS,novo); save(LS_FONTES,fontes)
      alert(`${lista.length} registos importados para ${MODULOS[modulo].titulo}.`)
    }catch(e){ console.error(e); alert('Não foi possível importar. Confirma se a folha está publicada/partilhada como CSV ou usa um endpoint Apps Script com CORS.') }
    finally{ setSyncBusy('') }
  }

  function abrirNavegacao(item,app){
    if(!queryFor(item)){ alert('Este ativo ainda não tem coordenadas GPS. Guarda a localização no terreno ou importa latitude/longitude da folha Excel.'); return }
    setNavTarget(null); window.location.href=app==='waze'?wazeUrl(item):mapsUrl(item)
  }
  function clicarAtivo(item){ setSel(item); if(item.categoria!=='Marco Quilométrico') setNavTarget(item) }
  function exportarJSON(){
    const blob=new Blob([JSON.stringify({exportadoEm:new Date().toISOString(),locais:ativos,gpsAtivos,deslocacoes:desloc,fontes},null,2)],{type:'application/json'})
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`rjp-navigator-${today()}.json`; a.click(); URL.revokeObjectURL(a.href)
  }

  const tabs=[['inicio','Início'],['estacoes','Estações'],['edificios','EDF'],['pn','PN'],['obras','Obras de Arte'],['drenagem','Drenagem'],['geotecnia','Geotecnia'],['km','PK/Km'],['mapa','Mapa'],['importar','Drive/Excel'],['novo','Novo'],['desloc','Deslocações']]
  const moduloAtual=Object.entries(MODULOS).find(([,m])=>m.categoria===form.categoria)?.[1]

  return <div className="app">
    <header><img src={`${base}ip-logo.png`} alt="RJP Navigator"/><div><h1>RJP Navigator</h1><p>Linha do Oeste · PK 21,190 a 191,197</p></div><span className="version">V{VERSION}</span></header>
    <nav>{tabs.map(([k,t])=><button key={k} className={tab===k?'on':''} onClick={()=>{setTab(k);setSel(null);setQ('')}}>{t}</button>)}</nav>

    {tab==='inicio'&&<main className="grid">
      <section className="card hero"><h2>Cadastro técnico ferroviário</h2><p>PN, estações, EDF, obras de arte, drenagem e ativos geotécnicos organizados pelo Km da Linha do Oeste.</p><div className="stats"><b>{passagensNivelLinhaOeste.length}</b><span>PN</span><b>{estacoesLinhaOeste.length}</b><span>Estações/Apeadeiros</span><b>{importados.obras.length}</b><span>Obras de Arte</span><b>{importados.drenagem.length}</b><span>Órgãos Drenantes</span><b>{importados.geotecnia.length}</b><span>Geotecnia/Contenções</span></div></section>
      <section className="card gpscard"><div className="cardtitle"><h3>Localização</h3><span className={`status ${gpsEstado==='Autorizado'?'good':''}`}>{gpsEstado}</span></div>{gps?<><p className="coords">{gps.lat}<br/>{gps.lng}</p><p className="mini">Precisão ±{gps.acc} m</p></>:<p>Sem posição obtida.</p>}<button onClick={obterGPS} disabled={gpsBusy}>{gpsBusy?'A obter GPS…':'Autorizar e obter GPS'}</button></section>
      <section className="card"><h3>Módulos em aberto</h3><div className="stack"><button onClick={()=>setTab('obras')}>🌉 Obras de Arte</button><button onClick={()=>setTab('drenagem')}>💧 Órgãos Drenantes</button><button onClick={()=>setTab('geotecnia')}>🏔️ Geotecnia e Contenções</button><button className="secondary" onClick={()=>setTab('importar')}>Ligar folhas do Drive</button></div></section>
    </main>}

    {['estacoes','edificios','pn','obras','drenagem','geotecnia','km','mapa'].includes(tab)&&<main className="layout">
      <aside className="card list"><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Pesquisar por Km, nome, tipo ou estado…"/><div className="count">{filtrados.length} registos</div>{filtrados.length===0&&<div className="empty"><b>Separador em aberto</b><p>Sem registos. Importa a folha Excel/Sheets ou adiciona um ativo manualmente.</p><button onClick={()=>setTab('importar')}>Configurar importação</button></div>}{filtrados.map(item=><button key={item.key} className={`row ${current?.key===item.key?'sel':''}`} onClick={()=>clicarAtivo(item)}><b>{item.titulo} {item.categoria!=='Marco Quilométrico'&&<span>🧭</span>}</b><small>{item.tipo?`${item.tipo} · `:''}Km {kmVisivel(item)||'-'}{item.kmFinal?` a ${kmVisivel({km:item.kmFinal})}`:''}</small>{item.gpsSaved&&<span className="gpsdot">GPS</span>}</button>)}</aside>
      <section className="card detail">{current?<><div className="detailhead"><div><h2>{current.titulo}</h2><span className="pill">{current.categoria}</span></div>{current.gpsSaved&&<span className="saved">GPS guardado</span>}</div><dl><dt>Km inicial</dt><dd>{kmVisivel(current)||'-'}</dd>{current.kmFinal&&<><dt>Km final</dt><dd>{current.kmFinal}</dd></>}<dt>Tipo</dt><dd>{current.tipo||current.classificacao||'-'}</dd><dt>Lado</dt><dd>{current.lado||'-'}</dd><dt>Estado</dt><dd>{current.estado||'-'}</dd><dt>Risco</dt><dd>{current.risco||'-'}</dd><dt>Coordenadas</dt><dd>{current.lat&&current.lng?`${current.lat}, ${current.lng}`:'Sem localização guardada'}</dd><dt>Fonte</dt><dd>{current.gpsSaved?'GPS confirmado no terreno':current.fonte||current.fonteGps||'Base local'}</dd><dt>Observações</dt><dd>{current.observacoes||'-'}</dd></dl>{tab==='km'&&<div className="pkbox"><h3>Referências</h3>{marcosPrincipaisLinhaOeste.map(m=><button key={m.pk} className="tag" onClick={()=>setQ(m.pk)}>{m.pk} · {m.nome}</button>)}</div>}{tab==='mapa'&&<iframe title="mapa" className="map" src={`https://www.openstreetmap.org/export/embed.html?bbox=-9.45%2C38.55%2C-8.65%2C39.95&layer=mapnik&marker=${current.lat||39.743}%2C${current.lng||-8.807}`}/>}<div className="actions"><button onClick={obterGPS}>{gpsBusy?'A obter…':'Obter GPS atual'}</button><button onClick={()=>guardarGPSAtivo(current)}>Guardar neste ativo</button>{current.categoria!=='Marco Quilométrico'&&<button onClick={()=>setNavTarget(current)}>Navegar</button>}<button className="secondary" onClick={()=>registarDeslocacao(current)}>Registar deslocação</button></div></>:<p>Sem registos.</p>}</section>
    </main>}

    {tab==='importar'&&<main className="importgrid">{Object.entries(MODULOS).map(([key,m])=><section className="card importcard" key={key}><h2>{m.icon} {m.titulo}</h2><p>Importa uma folha do Google Sheets publicada ou um endpoint CSV do Apps Script.</p><label>Ligação da folha<input value={fontes[key]||''} onChange={e=>{const n={...fontes,[key]:e.target.value};setFontes(n);save(LS_FONTES,n)}} placeholder="https://docs.google.com/spreadsheets/d/.../edit?gid=0"/></label><button onClick={()=>sincronizar(key)} disabled={syncBusy===key}>{syncBusy===key?'A sincronizar…':'Sincronizar folha'}</button><p className="mini">Campos reconhecidos: Km/PK, Km final, Nome/Designação, Tipo, Lado, Estado, Risco, Prioridade, Latitude, Longitude, Observações.</p><div className="syncstat"><b>{importados[key].length}</b> registos locais</div></section>)}</main>}

    {tab==='novo'&&<main className="card form"><h2>Novo ativo</h2><button onClick={obterGPS}>{gpsBusy?'A obter GPS…':'Capturar GPS'}</button>{gps&&<p className="ok">{gps.lat}, {gps.lng} · ±{gps.acc} m</p>}<label>Categoria<select value={form.categoria} onChange={e=>setForm({...form,categoria:e.target.value,tipo:'Outro'})}><option>Obra de Arte</option><option>Órgão Drenante</option><option>Geotecnia/Contenção</option><option>Passagem de Nível</option><option>Estação/Apeadeiro</option><option>Edifício</option><option>Outro</option></select></label><label>Tipo<select value={form.tipo} onChange={e=>setForm({...form,tipo:e.target.value})}>{(moduloAtual?.tipos||['Outro']).map(t=><option key={t}>{t}</option>)}</select></label><label>Nome/Designação<input value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})}/></label><label>Km inicial<input value={form.pk} onChange={e=>setForm({...form,pk:e.target.value})} placeholder="Ex.: 157,708"/></label><label>Km final<input value={form.kmFinal} onChange={e=>setForm({...form,kmFinal:e.target.value})}/></label><label>Lado<input value={form.lado} onChange={e=>setForm({...form,lado:e.target.value})} placeholder="Esquerdo, direito ou ambos"/></label><label>Observações<textarea value={form.observacoes} onChange={e=>setForm({...form,observacoes:e.target.value})}/></label><button onClick={adicionarLocal}>Guardar ativo</button></main>}

    {tab==='desloc'&&<main className="card tablecard"><div className="cardtitle"><h2>Deslocações</h2><button className="secondary" onClick={exportarJSON}>Exportar</button></div>{desloc.length===0?<p>Sem deslocações registadas.</p>:<div className="tablewrap"><table><thead><tr><th>Data</th><th>Hora</th><th>Destino</th><th>Km</th><th>GPS</th></tr></thead><tbody>{desloc.map(d=><tr key={d.id}><td>{d.data}</td><td>{d.hora}</td><td>{d.destino}</td><td>{d.pk}</td><td>{d.gps}</td></tr>)}</tbody></table></div>}</main>}

    {navTarget&&<div className="modalback" onClick={()=>setNavTarget(null)}><div className="navmodal" onClick={e=>e.stopPropagation()}><h2>Escolher navegação</h2><p className="navdest">{navTarget.titulo}</p><p className="mini">Km {kmVisivel(navTarget)||'-'}</p><div className="navchoices"><button onClick={()=>abrirNavegacao(navTarget,'google')}>Google Maps</button><button onClick={()=>abrirNavegacao(navTarget,'waze')}>Waze</button></div><button className="secondary full" onClick={()=>setNavTarget(null)}>Cancelar</button></div></div>}
    <footer>RJP Navigator V{VERSION} · PK 21,190–191,197 · dados guardados localmente no dispositivo</footer>
  </div>
}

createRoot(document.getElementById('root')).render(<App />)
