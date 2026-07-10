import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './style.css'
import { estacoesLinhaOeste } from './data/estacoes.js'
import { passagensNivelLinhaOeste } from './data/passagensNivel.js'
import { marcosKmLinhaOeste, marcosPrincipaisLinhaOeste } from './data/marcosKm.js'

const LS_LOCAIS = 'rjp_nav_locais_extra_v1'
const LS_DESLOC = 'rjp_nav_deslocacoes_v1'
const LS_GPS_ATIVOS = 'rjp_nav_gps_ativos_v2'
const norm = (v='') => String(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
const load = (k,d) => { try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(d)) } catch { return d } }
const save = (k,v) => localStorage.setItem(k, JSON.stringify(v))
const today = () => new Date().toISOString().slice(0,10)
const base = import.meta.env.BASE_URL || './'

const queryFor = item => item.lat && item.lng
  ? `${item.lat},${item.lng}`
  : `${item.nome || item.localidade || item.titulo || ''} ${item.concelho || ''} Portugal`
const mapsUrl = item => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(queryFor(item))}&travelmode=driving`
const wazeUrl = item => `https://waze.com/ul?q=${encodeURIComponent(queryFor(item))}&navigate=yes`

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
  const [form,setForm] = useState({categoria:'Passagem de Nível',nome:'',pk:'',localidade:'',concelho:'',freguesia:'',observacoes:''})

  useEffect(()=>{ verificarPermissao() },[])

  const withGps = item => {
    const saved = gpsAtivos[item.key]
    return saved ? {...item, lat:saved.lat, lng:saved.lng, gpsSaved:saved} : item
  }

  const ativos = useMemo(()=>[
    ...estacoesLinhaOeste.map(x=>withGps({...x,key:`est-${x.id}`,titulo:x.nome,categoria:'Estação/Apeadeiro'})),
    ...estacoesLinhaOeste.filter(x=>String(x.tipo).includes('Estação')).map(x=>withGps({...x,key:`edf-${x.id}`,categoria:'Edifício',titulo:`EDF · ${x.nome}`,observacoes:'Edifício ferroviário associado à estação'})),
    ...passagensNivelLinhaOeste.map(x=>withGps({...x,key:`pn-${x.id}`,categoria:'Passagem de Nível',titulo:`PN · Km ${x.km || x.pk}`})),
    ...marcosKmLinhaOeste.map(x=>withGps({...x,key:`km-${x.id}`,categoria:'Marco Quilométrico',titulo:x.nome})),
    ...extras.map((x,i)=>withGps({...x,key:x.key || `extra-${i}`,titulo:x.nome || 'Local registado'}))
  ],[extras,gpsAtivos])

  const categoriaTab = {
    estacoes:'Estação/Apeadeiro', edificios:'Edifício', pn:'Passagem de Nível', km:'Marco Quilométrico'
  }[tab]

  const filtrados = useMemo(()=>ativos.filter(a=>{
    if(categoriaTab && a.categoria !== categoriaTab) return false
    return norm(JSON.stringify(a)).includes(norm(q))
  }).sort((a,b)=>(parseFloat(String(a.km || a.pk || '').replace(',','.')) || 0) - (parseFloat(String(b.km || b.pk || '').replace(',','.')) || 0)),[ativos,q,categoriaTab])

  const current = sel && filtrados.some(x=>x.key===sel.key) ? sel : filtrados[0]

  async function verificarPermissao(){
    if(!navigator.geolocation){
      setGpsEstado('Indisponível')
      return
    }
    try{
      if(navigator.permissions?.query){
        const p = await navigator.permissions.query({ name: 'geolocation' })
        const atualizar = () => setGpsEstado(p.state === 'granted' ? 'Autorizado' : p.state === 'denied' ? 'Recusado' : 'Por autorizar')
        atualizar()
        p.onchange = atualizar
      }else{
        setGpsEstado('Por autorizar')
      }
    }catch{
      setGpsEstado('Por autorizar')
    }
  }

  async function obterGPS(){
    setGpsBusy(true)
    try{
      if(!navigator.geolocation) throw new Error('GPS indisponível')
      const p = await new Promise((resolve,reject)=>
        navigator.geolocation.getCurrentPosition(resolve,reject,{
          enableHighAccuracy:true, timeout:20000, maximumAge:0
        })
      )
      setGpsEstado('Autorizado')
      setGps({
        lat:Number(p.coords.latitude).toFixed(6), lng:Number(p.coords.longitude).toFixed(6),
        acc:Math.round(p.coords.accuracy || 0), alt:p.coords.altitude == null ? '' : Math.round(p.coords.altitude),
        time:new Date().toISOString()
      })
    }catch(e){
      console.error(e)
      if(e?.code === 1) setGpsEstado('Recusado')
      alert('Não foi possível obter a posição. Confirma se o GPS está ligado e autoriza a localização quando o Android pedir.')
    }finally{ setGpsBusy(false) }
  }

  function guardarGPSAtivo(item){
    if(!gps){ alert('Obtém primeiro a posição GPS.'); return }
    const reg={lat:gps.lat,lng:gps.lng,acc:gps.acc,alt:gps.alt,data:new Date().toLocaleDateString('pt-PT'),hora:new Date().toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'}),ativo:item.titulo,categoria:item.categoria,pk:item.pk || item.km || ''}
    const novo={...gpsAtivos,[item.key]:reg}; setGpsAtivos(novo); save(LS_GPS_ATIVOS,novo); setSel({...item,lat:gps.lat,lng:gps.lng,gpsSaved:reg}); alert('Localização guardada neste ativo.')
  }

  function registarDeslocacao(item){
    const row={id:Date.now(),data:today(),hora:new Date().toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'}),destino:item.titulo,categoria:item.categoria,pk:item.pk || item.km || '',gps:gps ? `${gps.lat}, ${gps.lng}` : ''}
    const novo=[row,...desloc]; setDesloc(novo); save(LS_DESLOC,novo); alert('Deslocação registada.')
  }

  function adicionarLocal(){
    if(!form.nome && !form.pk){ alert('Preenche pelo menos o nome ou o Km/PK.'); return }
    const key=`extra-${Date.now()}`
    const novo={...form,id:key,key,linha:'Linha do Oeste',lat:gps?.lat || '',lng:gps?.lng || ''}
    const lista=[novo,...extras]; setExtras(lista); save(LS_LOCAIS,lista)
    setForm({categoria:'Passagem de Nível',nome:'',pk:'',localidade:'',concelho:'',freguesia:'',observacoes:''}); setTab('pn')
  }


  function abrirNavegacao(item, app){
    const url = app === 'waze' ? wazeUrl(item) : mapsUrl(item)
    setNavTarget(null)
    window.location.href = url
  }

  function clicarAtivo(item){
    setSel(item)
    if(['Passagem de Nível','Edifício','Estação/Apeadeiro'].includes(item.categoria)){
      setNavTarget(item)
    }
  }

  function exportarJSON(){
    const blob=new Blob([JSON.stringify({exportadoEm:new Date().toISOString(),locais:ativos,gpsAtivos,deslocacoes:desloc},null,2)],{type:'application/json'})
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`rjp-navigator-${today()}.json`; a.click(); URL.revokeObjectURL(a.href)
  }

  const tabs=[['inicio','Início'],['estacoes','Estações'],['edificios','EDF'],['pn','PN'],['km','PK/Km'],['mapa','Mapa'],['novo','Novo'],['desloc','Deslocações']]

  return <div className="app">
    <header>
      <img src={`${base}ip-logo.png`} alt="RJP Navigator" />
      <div><h1>RJP Navigator</h1><p>Linha do Oeste · PK 21+190 a 191+197</p></div>
      <span className="version">V3.0</span>
    </header>
    <nav>{tabs.map(([k,t])=><button key={k} className={tab===k?'on':''} onClick={()=>{setTab(k);setSel(null);setQ('')}}>{t}</button>)}</nav>

    {tab==='inicio' && <main className="grid">
      <section className="card hero"><h2>Assistente técnico de campo</h2><p>Consulta estações, edifícios e PN. Guarda coordenadas GPS diretamente em cada ativo.</p><div className="stats"><b>{estacoesLinhaOeste.length}</b><span>Estações/Apeadeiros</span><b>{estacoesLinhaOeste.filter(x=>String(x.tipo).includes('Estação')).length}</b><span>EDF</span><b>{passagensNivelLinhaOeste.length}</b><span>Passagens de Nível</span><b>{Object.keys(gpsAtivos).length}</b><span>Ativos com GPS guardado</span></div></section>
      <section className="card gpscard"><div className="cardtitle"><h3>Localização</h3><span className={`status ${gpsEstado==='Autorizado'?'good':''}`}>{gpsEstado}</span></div>{gps ? <><p className="coords">{gps.lat}<br/>{gps.lng}</p><p className="mini">Precisão ±{gps.acc} m{gps.alt!==''?` · Alt. ${gps.alt} m`:''}</p></> : <p>Sem posição obtida.</p>}<button onClick={obterGPS} disabled={gpsBusy}>{gpsBusy?'A obter GPS…':'Autorizar e obter GPS'}</button></section>
      <section className="card"><h3>Ações rápidas</h3><div className="stack"><button onClick={()=>setTab('pn')}>Passagens de Nível</button><button onClick={()=>setTab('estacoes')}>Estações/Apeadeiros</button><button onClick={()=>setTab('edificios')}>Edifícios EDF</button><button className="secondary" onClick={exportarJSON}>Exportar dados</button></div></section>
    </main>}

    {['estacoes','edificios','pn','km','mapa'].includes(tab) && <main className="layout">
      <aside className="card list"><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Pesquisar por Km, distrito, concelho, freguesia ou classificação…"/><div className="count">{filtrados.length} registos</div>{filtrados.map(item=><button key={item.key} className={`row ${current?.key===item.key?'sel':''}`} onClick={()=>clicarAtivo(item)}><b>{item.titulo}</b><small>{item.categoria==='Passagem de Nível' ? `${item.freguesia || 'Sem freguesia'}${item.concelho?` · ${item.concelho}`:''}${item.classificacao?` · Tipo ${item.classificacao}`:''}` : `${item.localidade || item.nome || ''}${item.concelho?` · ${item.concelho}`:''}`}</small>{item.gpsSaved && <span className="gpsdot">GPS</span>}</button>)}</aside>
      <section className="card detail">{current ? <>
        <div className="detailhead"><div><h2>{current.titulo}</h2><span className="pill">{current.categoria}</span></div>{current.gpsSaved && <span className="saved">GPS guardado</span>}</div>
        <dl><dt>Km/PK</dt><dd>{current.km || current.pk || '-'}</dd>{current.categoria==='Passagem de Nível' ? <><dt>Distrito</dt><dd>{current.distrito || '-'}</dd><dt>Concelho</dt><dd>{current.concelho || '-'}</dd><dt>Freguesia</dt><dd>{current.freguesia || '-'}</dd><dt>Classificação</dt><dd>{current.classificacao || '-'}</dd></> : <><dt>Localidade</dt><dd>{current.localidade || current.nome || '-'}</dd><dt>Concelho</dt><dd>{current.concelho || '-'}</dd><dt>Freguesia</dt><dd>{current.freguesia || '-'}</dd></>}<dt>Coordenadas</dt><dd>{current.lat && current.lng ? `${current.lat}, ${current.lng}` : 'Sem localização guardada'}</dd><dt>Fonte GPS</dt><dd>{current.gpsSaved ? 'Confirmado no terreno' : (current.fonteGps || 'Sem referência')}</dd>{current.gpsSaved && <><dt>Precisão</dt><dd>±{current.gpsSaved.acc} m · {current.gpsSaved.data} {current.gpsSaved.hora}</dd></>}</dl>
        {tab==='km' && <div className="pkbox"><h3>Referências</h3>{marcosPrincipaisLinhaOeste.map(m=><button key={m.pk} className="tag" onClick={()=>setQ(m.pk)}>{m.pk} · {m.nome}</button>)}</div>}
        {tab==='mapa' && <iframe title="mapa" className="map" src={`https://www.openstreetmap.org/export/embed.html?bbox=-9.45%2C38.55%2C-8.65%2C39.95&layer=mapnik&marker=${current.lat || 39.743}%2C${current.lng || -8.807}`}/>} 
        <div className="actions"><button onClick={obterGPS}>{gpsBusy?'A obter…':'Obter GPS atual'}</button><button onClick={()=>guardarGPSAtivo(current)}>Guardar neste ativo</button><a href={mapsUrl(current)} target="_blank" rel="noreferrer">Google Maps</a><a href={wazeUrl(current)} target="_blank" rel="noreferrer">Waze</a><button className="secondary" onClick={()=>registarDeslocacao(current)}>Registar deslocação</button></div>
      </> : <p>Sem registos.</p>}</section>
    </main>}

    {tab==='novo' && <main className="card form"><h2>Novo local</h2><p>Regista uma PN ou outro ativo e associa a posição atual.</p><button onClick={obterGPS}>{gpsBusy?'A obter GPS…':'Capturar GPS'}</button>{gps && <p className="ok">{gps.lat}, {gps.lng} · ±{gps.acc} m</p>}<label>Categoria<select value={form.categoria} onChange={e=>setForm({...form,categoria:e.target.value})}><option>Passagem de Nível</option><option>Estação/Apeadeiro</option><option>Edifício</option><option>Outro</option></select></label><label>Nome<input value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})}/></label><label>Km/PK<input value={form.pk} onChange={e=>setForm({...form,pk:e.target.value})} placeholder="Ex.: 157,708"/></label><label>Localidade<input value={form.localidade} onChange={e=>setForm({...form,localidade:e.target.value})}/></label><label>Concelho<input value={form.concelho} onChange={e=>setForm({...form,concelho:e.target.value})}/></label><label>Freguesia<input value={form.freguesia} onChange={e=>setForm({...form,freguesia:e.target.value})}/></label><label>Observações<textarea value={form.observacoes} onChange={e=>setForm({...form,observacoes:e.target.value})}/></label><button onClick={adicionarLocal}>Guardar local</button></main>}

    {tab==='desloc' && <main className="card tablecard"><div className="cardtitle"><h2>Deslocações</h2><button className="secondary" onClick={exportarJSON}>Exportar</button></div>{desloc.length===0?<p>Sem deslocações registadas.</p>:<div className="tablewrap"><table><thead><tr><th>Data</th><th>Hora</th><th>Destino</th><th>Km/PK</th><th>GPS</th></tr></thead><tbody>{desloc.map(d=><tr key={d.id}><td>{d.data}</td><td>{d.hora}</td><td>{d.destino}</td><td>{d.pk}</td><td>{d.gps}</td></tr>)}</tbody></table></div>}</main>}
    {navTarget && <div className="modalback" onClick={()=>setNavTarget(null)}><div className="navmodal" onClick={e=>e.stopPropagation()}><h2>Navegar para este local?</h2><p className="navdest">{navTarget.titulo}</p><p className="mini">Km/PK {navTarget.km || navTarget.pk || '-'}{navTarget.concelho ? ` · ${navTarget.concelho}` : ''}</p><div className="navchoices"><button onClick={()=>abrirNavegacao(navTarget,'google')}>Google Maps</button><button onClick={()=>abrirNavegacao(navTarget,'waze')}>Waze</button></div><button className="secondary full" onClick={()=>setNavTarget(null)}>Cancelar</button></div></div>}
    <footer>RJP Navigator V3.0 · PK 21+190–191+197 · uso interno/académico · dados guardados localmente no dispositivo</footer>
  </div>
}

createRoot(document.getElementById('root')).render(<App />)
