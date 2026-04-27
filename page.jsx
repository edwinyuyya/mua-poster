'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

/* ─── TONES ─── */
const TONES = [
  { id:'viral',    emoji:'🔥', label:'Viral & Bold' },
  { id:'aesthetic',emoji:'✨', label:'Aesthetic' },
  { id:'funny',    emoji:'😂', label:'Lucu & Relatable' },
  { id:'inspire',  emoji:'💫', label:'Inspiratif' },
  { id:'story',    emoji:'📖', label:'Storytelling' },
  { id:'casual',   emoji:'😎', label:'Santai' },
];
const TONE_MAP = {
  viral:'viral, hook kuat di kalimat pertama, pakai angka/fakta mengejutkan',
  aesthetic:'aesthetic, puitis, elegan, cocok untuk visual content creator',
  funny:'lucu, relatable, humor sehari-hari orang Indonesia',
  inspire:'inspiratif, motivasi, membangkitkan semangat pembaca',
  story:'bercerita, engaging, bikin penasaran sampai akhir',
  casual:'santai, friendly, seperti ngobrol sama teman',
};

/* ─── GENERATE CAPTION ─── */
async function generateCaption({ title, tone, extra, accountName }) {
  const res = await fetch('/api/caption', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, tone: TONE_MAP[tone], extra, accountName }),
  });
  if (!res.ok) throw new Error('Gagal generate caption');
  const data = await res.json();
  return data.caption;
}

/* ════════ STYLES ════════ */
const S = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800;900&family=Nunito:wght@300;400;500;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
:root{
  --bg:#fdf8f5;--surface:#fff;--surface2:#fef3ec;
  --border:#f0e6dc;--border2:#e8d5c4;
  --text:#2d1f14;--text2:#7a5c47;--text3:#b89882;
  --pink:#e91e8c;--pink2:#f06292;--pink3:#fce4ec;
  --gold:#c9933a;--gold2:#fff3e0;
  --green:#2e7d32;--green2:#e8f5e9;
  --red:#c62828;--red2:#ffebee;
  --shadow:0 2px 16px rgba(200,120,80,.10);
}
body{font-family:'Nunito',sans-serif;background:var(--bg);color:var(--text);min-height:100vh;}
.app{min-height:100vh;}
.hdr{background:linear-gradient(135deg,#c2185b 0%,#e91e8c 50%,#f48fb1 100%);padding:20px 20px 0;}
.hdr-inner{max-width:480px;margin:0 auto;}
.hdr-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;}
.logo{display:flex;align-items:center;gap:10px;}
.logo-icon{width:40px;height:40px;background:rgba(255,255,255,.2);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:20px;backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.3);}
.logo-text{font-family:'Playfair Display',serif;font-size:18px;font-weight:900;color:white;line-height:1;}
.logo-sub{font-size:10px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,.7);}
.hdr-pill{background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.3);border-radius:20px;padding:4px 12px;font-size:11px;font-weight:700;color:white;letter-spacing:.5px;backdrop-filter:blur(10px);}
.nav{display:flex;background:rgba(255,255,255,.15);backdrop-filter:blur(10px);border-radius:12px 12px 0 0;margin-top:16px;overflow:hidden;}
.nav-btn{flex:1;padding:12px 6px;border:none;background:transparent;color:rgba(255,255,255,.7);font-family:'Nunito',sans-serif;font-size:11px;font-weight:700;cursor:pointer;transition:all .2s;display:flex;flex-direction:column;align-items:center;gap:3px;}
.nav-btn .ni{font-size:18px;}
.nav-btn.active{background:white;color:var(--pink);}
.main{max-width:480px;margin:0 auto;padding:16px;}
.card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:18px;margin-bottom:14px;box-shadow:var(--shadow);}
.card-hd{display:flex;align-items:center;gap:10px;margin-bottom:16px;}
.card-icon{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,#c2185b,#e91e8c);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;}
.card-title{font-family:'Playfair Display',serif;font-size:15px;font-weight:700;}
.card-sub{font-size:11px;color:var(--text3);}
.field{margin-bottom:14px;}
.lbl{font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--text2);margin-bottom:6px;display:block;}
.inp{width:100%;background:#fdf8f5;border:1.5px solid var(--border);border-radius:10px;padding:11px 14px;color:var(--text);font-family:'Nunito',sans-serif;font-size:13px;outline:none;transition:all .2s;}
.inp:focus{border-color:var(--pink);background:white;box-shadow:0 0 0 3px rgba(233,30,140,.08);}
textarea.inp{resize:vertical;min-height:110px;line-height:1.6;}
.inp::placeholder{color:var(--text3);}
.hint{font-size:10px;color:var(--text3);margin-top:4px;font-style:italic;}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:12px 22px;border-radius:12px;font-family:'Nunito',sans-serif;font-size:13px;font-weight:700;cursor:pointer;transition:all .2s;border:none;}
.btn:disabled{opacity:.45;cursor:not-allowed;}
.btn-pink{background:linear-gradient(135deg,#c2185b,#e91e8c);color:white;box-shadow:0 4px 14px rgba(233,30,140,.3);}
.btn-pink:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 6px 20px rgba(233,30,140,.4);}
.btn-ghost{background:var(--surface2);color:var(--text2);border:1.5px solid var(--border);}
.btn-full{width:100%;}
.btn-sm{padding:8px 14px;font-size:12px;border-radius:9px;}
.btn-row{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;margin-top:16px;}
.alert{border-radius:10px;padding:11px 14px;font-size:12px;line-height:1.5;margin-bottom:12px;display:flex;gap:8px;align-items:flex-start;}
.alert-info{background:#e3f2fd;border:1px solid #90caf9;color:#1565c0;}
.alert-warn{background:#fff8e1;border:1px solid #ffe082;color:#e65100;}
.alert-ok{background:var(--green2);border:1px solid #a5d6a7;color:var(--green);}
.alert-err{background:var(--red2);border:1px solid #ef9a9a;color:var(--red);}
.acc-item{display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--surface2);border-radius:12px;border:1.5px solid var(--border);margin-bottom:10px;transition:all .2s;}
.acc-avatar{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#c2185b,#f48fb1);display:flex;align-items:center;justify-content:center;font-family:'Playfair Display',serif;font-size:16px;font-weight:900;color:white;flex-shrink:0;}
.acc-name{font-weight:700;font-size:14px;}
.acc-id{font-size:10px;color:var(--text3);}
.acc-actions{margin-left:auto;display:flex;gap:6px;}
.icon-btn{width:30px;height:30px;border-radius:8px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;transition:all .2s;}
.icon-btn-del{background:var(--red2);color:var(--red);}
.icon-btn-del:hover{background:var(--red);color:white;}
.tone-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}
.tone-card{padding:10px 8px;border-radius:10px;border:1.5px solid var(--border);cursor:pointer;transition:all .2s;text-align:center;background:var(--surface2);}
.tone-card.sel{border-color:var(--pink);background:var(--pink3);}
.tone-emoji{font-size:20px;margin-bottom:3px;}
.tone-lbl{font-size:10px;font-weight:700;color:var(--text2);}
.tone-card.sel .tone-lbl{color:var(--pink);}
.upload-zone{border:2px dashed var(--border2);border-radius:12px;padding:36px 16px;text-align:center;cursor:pointer;background:var(--surface2);}
.upload-zone:hover{border-color:var(--pink);background:var(--pink3);}
.preview-wrap{position:relative;border-radius:12px;overflow:hidden;}
.preview-wrap img,.preview-wrap video{width:100%;max-height:280px;object-fit:cover;display:block;}
.preview-top{position:absolute;top:8px;right:8px;}
.q-item{background:var(--surface);border:1.5px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px;display:flex;gap:12px;align-items:flex-start;box-shadow:var(--shadow);}
.q-thumb{width:52px;height:52px;border-radius:10px;object-fit:cover;flex-shrink:0;background:var(--pink3);}
.q-thumb-ph{width:52px;height:52px;border-radius:10px;background:var(--pink3);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;}
.q-body{flex:1;min-width:0;}
.q-acct{font-size:11px;font-weight:700;color:var(--pink);margin-bottom:3px;}
.q-cap{font-size:12px;color:var(--text2);line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;margin-bottom:6px;}
.q-time{font-size:10px;color:var(--text3);font-weight:600;}
.q-status{display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;padding:3px 8px;border-radius:6px;}
.q-status.pending{background:var(--gold2);color:var(--gold);}
.q-status.done{background:var(--green2);color:var(--green);}
.q-status.failed{background:var(--red2);color:var(--red);}
.q-status.posting{background:#e3f2fd;color:#1565c0;}
.q-del{background:none;border:none;cursor:pointer;color:var(--text3);font-size:16px;padding:4px;border-radius:6px;flex-shrink:0;}
.steps{display:flex;align-items:center;justify-content:center;margin-bottom:18px;}
.step{display:flex;align-items:center;gap:6px;cursor:pointer;}
.step-dot{width:28px;height:28px;border-radius:50%;border:2px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:var(--text3);font-family:'Playfair Display',serif;transition:all .25s;background:var(--surface);}
.step-dot.active{border-color:var(--pink);background:linear-gradient(135deg,#c2185b,#e91e8c);color:white;box-shadow:0 0 14px rgba(233,30,140,.3);}
.step-dot.done{border-color:#43a047;background:#43a047;color:white;}
.step-lbl{font-size:11px;font-weight:700;color:var(--text3);}
.step-lbl.active{color:var(--text);}
.step-line{width:28px;height:2px;background:var(--border);margin:0 3px;}
.step-line.done{background:var(--pink);}
.cc{text-align:right;font-size:10px;color:var(--text3);margin-top:4px;}
.sel-btn{display:flex;align-items:center;gap:10px;padding:11px 14px;background:var(--surface2);border:1.5px solid var(--border);border-radius:10px;cursor:pointer;transition:all .2s;width:100%;margin-bottom:8px;}
.sel-btn.chosen{border-color:var(--pink);background:var(--pink3);}
.sel-btn .sa{width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#c2185b,#e91e8c);display:flex;align-items:center;justify-content:center;font-size:14px;color:white;font-weight:900;font-family:'Playfair Display',serif;flex-shrink:0;}
.sel-btn .sn{font-weight:700;font-size:13px;}
.sel-btn .si{font-size:10px;color:var(--text3);}
.sel-btn .sc{margin-left:auto;color:var(--pink);font-size:18px;}
.acct-list-sel{max-height:260px;overflow-y:auto;}
@keyframes spin{to{transform:rotate(360deg)}}
.spinner{width:16px;height:16px;border:2px solid rgba(255,255,255,.4);border-top-color:white;border-radius:50%;animation:spin .7s linear infinite;display:inline-block;}
.spinner-p{border-color:rgba(233,30,140,.3);border-top-color:var(--pink);}
@keyframes popIn{0%{transform:scale(.5);opacity:0}70%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}}
.success-wrap{text-align:center;padding:36px 20px;}
.success-icon{font-size:64px;display:block;animation:popIn .5s ease forwards;margin-bottom:16px;}
.success-title{font-family:'Playfair Display',serif;font-size:26px;font-weight:900;margin-bottom:8px;}
.success-sub{font-size:13px;color:var(--text2);margin-bottom:24px;}
.empty{text-align:center;padding:40px 20px;}
.empty-icon{font-size:48px;margin-bottom:12px;}
.empty-txt{font-size:14px;color:var(--text3);font-weight:600;}
hr{border:none;border-top:1px solid var(--border);margin:16px 0;}
`;

export default function App() {
  const [tab, setTab]       = useState('post');
  const [accounts, setAccounts] = useState([]);
  const [queue, setQueue]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: accs }, { data: q }] = await Promise.all([
      supabase.from('accounts').select('*').order('created_at'),
      supabase.from('queue').select('*').order('schedule_at'),
    ]);
    setAccounts(accs || []);
    setQueue(q || []);
    setLoading(false);
  };

  const pending = queue.filter(q => q.status === 'pending').length;

  return (
    <>
      <style>{S}</style>
      <div className="app">
        <div className="hdr">
          <div className="hdr-inner">
            <div className="hdr-top">
              <div className="logo">
                <div className="logo-icon">💄</div>
                <div>
                  <div className="logo-text">MUA Poster</div>
                  <div className="logo-sub">Auto Post Manager</div>
                </div>
              </div>
              <div className="hdr-pill">{accounts.length} Akun · {pending} Terjadwal</div>
            </div>
            <div className="nav">
              {[
                { id:'post',  icon:'✍️', label:'Buat Post' },
                { id:'queue', icon:'📋', label:`Antrian${pending>0?` (${pending})`:''}` },
                { id:'accts', icon:'👥', label:'Akun MUA' },
              ].map(t => (
                <button key={t.id} className={`nav-btn ${tab===t.id?'active':''}`} onClick={()=>setTab(t.id)}>
                  <span className="ni">{t.icon}</span>{t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="main">
          {loading
            ? <div style={{textAlign:'center',padding:40,color:'var(--text3)'}}>⏳ Memuat...</div>
            : <>
                {tab==='post'  && <PostCreator accounts={accounts} onRefresh={fetchAll} />}
                {tab==='queue' && <QueueView queue={queue} onRefresh={fetchAll} />}
                {tab==='accts' && <AccountManager accounts={accounts} onRefresh={fetchAll} />}
              </>
          }
        </div>
      </div>
    </>
  );
}

/* ════════ POST CREATOR ════════ */
function PostCreator({ accounts, onRefresh }) {
  const [step, setStep]       = useState(1);
  const [selId, setSelId]     = useState('');
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaType, setMediaType] = useState('image');
  const [imageUrl, setImageUrl] = useState('');
  const [title, setTitle]     = useState('');
  const [tone, setTone]       = useState('viral');
  const [extra, setExtra]     = useState('');
  const [caption, setCaption] = useState('');
  const [scheduleAt, setScheduleAt] = useState('');
  const [postNow, setPostNow] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState(false);
  const fileRef = useRef();

  const selAccount = accounts.find(a => a.id === selId);

  const handleFile = (file) => {
    if (!file) return;
    setMediaType(file.type.startsWith('video/') ? 'video' : 'image');
    setMediaPreview(URL.createObjectURL(file));
  };

  const handleGenerate = async () => {
    if (!title.trim()) { setError('Isi tema/judul dulu!'); return; }
    setError(''); setGenLoading(true);
    try {
      const result = await generateCaption({ title, tone, extra, accountName: selAccount?.name || 'MUA' });
      setCaption(result); setStep(3);
    } catch(e) { setError(e.message); }
    finally { setGenLoading(false); }
  };

  const handleSubmit = async () => {
    if (!selAccount) { setError('Pilih akun dulu!'); return; }
    if (!imageUrl) { setError('Isi URL gambar publik!'); return; }
    if (!caption)  { setError('Caption kosong!'); return; }
    if (!postNow && !scheduleAt) { setError('Pilih waktu posting!'); return; }
    setError(''); setPosting(true);
    try {
      const schedTime = postNow ? new Date().toISOString() : new Date(scheduleAt).toISOString();
      const { error: dbErr } = await supabase.from('queue').insert({
        account_id: selAccount.id,
        account_name: selAccount.name,
        image_url: imageUrl,
        caption,
        schedule_at: schedTime,
        status: 'pending',
      });
      if (dbErr) throw new Error(dbErr.message);
      setSuccess(true);
      onRefresh();
    } catch(e) { setError(e.message); }
    finally { setPosting(false); }
  };

  const reset = () => {
    setStep(1); setSelId(''); setMediaPreview(null); setImageUrl('');
    setTitle(''); setExtra(''); setCaption(''); setScheduleAt('');
    setPostNow(false); setError(''); setSuccess(false);
  };

  if (accounts.length === 0) return (
    <div className="empty"><div className="empty-icon">👥</div>
      <div className="empty-txt">Belum ada akun MUA.<br/>Tambah dulu di tab Akun MUA!</div></div>
  );

  if (success) return (
    <div className="card"><div className="success-wrap">
      <span className="success-icon">📅</span>
      <div className="success-title">Berhasil Dijadwalkan!</div>
      <div className="success-sub">
        Post @{selAccount?.name} akan tayang otomatis{postNow?' sekarang':` ${new Date(scheduleAt).toLocaleString('id-ID',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}`}
      </div>
      <button className="btn btn-pink" onClick={reset}>➕ Buat Post Baru</button>
    </div></div>
  );

  return (
    <>
      <div className="steps">
        {[{n:1,l:'Akun'},{n:2,l:'Media'},{n:3,l:'Caption'},{n:4,l:'Jadwal'}].map((s,i)=>(
          <div key={s.n} style={{display:'flex',alignItems:'center'}}>
            {i>0 && <div className={`step-line ${step>s.n-1?'done':''}`} />}
            <div className="step" onClick={()=>step>=s.n&&setStep(s.n)}>
              <div className={`step-dot ${step===s.n?'active':step>s.n?'done':''}`}>{step>s.n?'✓':s.n}</div>
              <span className={`step-lbl ${step===s.n?'active':''}`}>{s.l}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Step 1 */}
      {step===1 && <div className="card">
        <div className="card-hd"><div className="card-icon">👤</div><div><div className="card-title">Pilih Akun MUA</div></div></div>
        <div className="acct-list-sel">
          {accounts.map(a=>(
            <div key={a.id} className={`sel-btn ${selId===a.id?'chosen':''}`} onClick={()=>setSelId(a.id)}>
              <div className="sa">{a.name[0]}</div>
              <div><div className="sn">@{a.name}</div><div className="si">ID: {a.ig_user_id?.slice(0,12)}...</div></div>
              {selId===a.id&&<div className="sc">✓</div>}
            </div>
          ))}
        </div>
        <div className="btn-row">
          <button className="btn btn-pink" disabled={!selId} onClick={()=>setStep(2)}>Lanjut →</button>
        </div>
      </div>}

      {/* Step 2 */}
      {step===2 && <div className="card">
        <div className="card-hd"><div className="card-icon">📸</div><div><div className="card-title">Upload Media</div><div className="card-sub">untuk @{selAccount?.name}</div></div></div>
        {!mediaPreview
          ? <div className="upload-zone" onClick={()=>fileRef.current.click()}>
              <input ref={fileRef} type="file" accept="image/*,video/*" style={{display:'none'}} onChange={e=>handleFile(e.target.files[0])} />
              <div style={{fontSize:36,marginBottom:8}}>📤</div>
              <div style={{fontWeight:700,marginBottom:4}}>Tap untuk upload</div>
              <div style={{fontSize:11,color:'var(--text3)'}}>Preview lokal saja</div>
            </div>
          : <div className="preview-wrap">
              {mediaType==='video'?<video src={mediaPreview} controls/>:<img src={mediaPreview} alt=""/>}
              <div className="preview-top">
                <button style={{background:'rgba(0,0,0,.6)',border:'none',color:'white',borderRadius:8,padding:'4px 8px',cursor:'pointer'}} onClick={()=>setMediaPreview(null)}>🗑️</button>
              </div>
            </div>
        }
        <hr/>
        <div className="field">
          <label className="lbl">URL Publik Gambar *</label>
          <input className="inp" type="text" value={imageUrl} onChange={e=>setImageUrl(e.target.value)} placeholder="https://i.ibb.co/xxx/foto.jpg" />
          <p className="hint">Upload ke imgbb.com → copy direct link → paste di sini</p>
        </div>
        <div className="btn-row">
          <button className="btn btn-ghost" onClick={()=>setStep(1)}>←</button>
          <button className="btn btn-pink" disabled={!imageUrl} onClick={()=>setStep(2.5)}>Lanjut →</button>
        </div>
      </div>}

      {/* Step 2.5 */}
      {step===2.5 && <div className="card">
        <div className="card-hd"><div className="card-icon">🎯</div><div><div className="card-title">Tema & Tone</div></div></div>
        <div className="field">
          <label className="lbl">Tema / Judul Post</label>
          <input className="inp" type="text" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Before after makeup pengantin, GRWM kondangan..." />
        </div>
        <div className="field">
          <label className="lbl">Pilih Tone</label>
          <div className="tone-grid">
            {TONES.map(t=>(
              <div key={t.id} className={`tone-card ${tone===t.id?'sel':''}`} onClick={()=>setTone(t.id)}>
                <div className="tone-emoji">{t.emoji}</div>
                <div className="tone-lbl">{t.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="field">
          <label className="lbl">Konteks Tambahan (opsional)</label>
          <textarea className="inp" rows={2} value={extra} onChange={e=>setExtra(e.target.value)} placeholder="Makeup natural glowing, lokasi Solo..." />
        </div>
        {error&&<div className="alert alert-err">❌ {error}</div>}
        <div className="btn-row">
          <button className="btn btn-ghost" onClick={()=>setStep(2)}>←</button>
          <button className="btn btn-pink" onClick={handleGenerate} disabled={genLoading}>
            {genLoading?<><div className="spinner"/>Generating...</>:'✨ Generate Caption AI'}
          </button>
        </div>
      </div>}

      {/* Step 3 */}
      {step===3 && <div className="card">
        <div className="card-hd"><div className="card-icon">✏️</div><div><div className="card-title">Edit Caption</div></div></div>
        <textarea className="inp" value={caption} onChange={e=>setCaption(e.target.value)} rows={9} style={{fontSize:12}} />
        <div className="cc">{caption.length}/2200</div>
        <div className="btn-row">
          <button className="btn btn-ghost btn-sm" onClick={handleGenerate} disabled={genLoading}>
            {genLoading?<><div className="spinner spinner-p"/>...</>:'🔄'}
          </button>
          <button className="btn btn-ghost" onClick={()=>setStep(2.5)}>←</button>
          <button className="btn btn-pink" disabled={!caption} onClick={()=>setStep(4)}>Lanjut →</button>
        </div>
      </div>}

      {/* Step 4 */}
      {step===4 && <div className="card">
        <div className="card-hd"><div className="card-icon">📅</div><div><div className="card-title">Waktu Posting</div><div className="card-sub">@{selAccount?.name}</div></div></div>
        <div className={`sel-btn ${postNow?'chosen':''}`} onClick={()=>setPostNow(true)}>
          <div style={{fontSize:22}}>⚡</div><div><div className="sn">Post Sekarang</div><div className="si">Langsung dijadwalkan untuk menit ini</div></div>
          {postNow&&<div className="sc">✓</div>}
        </div>
        <div className={`sel-btn ${!postNow?'chosen':''}`} onClick={()=>setPostNow(false)}>
          <div style={{fontSize:22}}>📅</div><div><div className="sn">Jadwalkan</div><div className="si">Pilih tanggal & jam</div></div>
          {!postNow&&<div className="sc">✓</div>}
        </div>
        {!postNow && <>
          <div className="field">
            <label className="lbl">Tanggal & Jam</label>
            <input className="inp" type="datetime-local" value={scheduleAt} onChange={e=>setScheduleAt(e.target.value)} min={new Date().toISOString().slice(0,16)} />
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:12}}>
            {[['☀️','07:00','Pagi – engagement tinggi'],['☕','12:00','Siang – jam istirahat'],['🌙','19:00','Malam – prime time']].map(([ic,hr,desc])=>(
              <div key={hr} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',background:'var(--gold2)',borderRadius:8,cursor:'pointer',border:'1px solid #ffe082'}}
                onClick={()=>{const d=new Date();d.setHours(parseInt(hr),0,0,0);if(d<new Date())d.setDate(d.getDate()+1);setScheduleAt(d.toISOString().slice(0,16));}}>
                <span>{ic}</span><div><div style={{fontSize:11,fontWeight:700,color:'var(--gold)'}}>{hr} WIB</div><div style={{fontSize:10,color:'var(--text3)'}}>{desc}</div></div>
              </div>
            ))}
          </div>
        </>}
        {error&&<div className="alert alert-err">❌ {error}</div>}
        <div className="btn-row">
          <button className="btn btn-ghost" onClick={()=>setStep(3)}>←</button>
          <button className="btn btn-pink" onClick={handleSubmit} disabled={posting}>
            {posting?<><div className="spinner"/>Menyimpan...</>:postNow?'⚡ Jadwalkan Sekarang':'📅 Simpan Jadwal'}
          </button>
        </div>
      </div>}
    </>
  );
}

/* ════════ QUEUE VIEW ════════ */
function QueueView({ queue, onRefresh }) {
  const sorted = [...queue].sort((a,b)=>new Date(a.schedule_at)-new Date(b.schedule_at));
  const pending = queue.filter(q=>q.status==='pending').length;
  const done    = queue.filter(q=>q.status==='done').length;

  const handleDel = async (id) => {
    await supabase.from('queue').delete().eq('id', id);
    onRefresh();
  };

  return (
    <>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
        {[{icon:'⏳',label:'Terjadwal',val:pending,bg:'var(--gold2)',col:'var(--gold)'},
          {icon:'✅',label:'Selesai',val:done,bg:'var(--green2)',col:'var(--green)'}].map(s=>(
          <div key={s.label} style={{background:s.bg,borderRadius:14,padding:14,textAlign:'center',border:`1.5px solid ${s.col}33`}}>
            <div style={{fontSize:24,marginBottom:4}}>{s.icon}</div>
            <div style={{fontSize:22,fontWeight:900,fontFamily:"'Playfair Display',serif",color:s.col}}>{s.val}</div>
            <div style={{fontSize:11,fontWeight:700,color:s.col,opacity:.8}}>{s.label}</div>
          </div>
        ))}
      </div>
      {sorted.length===0
        ? <div className="empty"><div className="empty-icon">📭</div><div className="empty-txt">Belum ada post terjadwal.</div></div>
        : sorted.map(item=>(
            <div key={item.id} className="q-item">
              <div className="q-thumb-ph">🖼️</div>
              <div className="q-body">
                <div className="q-acct">@{item.account_name}</div>
                <div className="q-cap">{item.caption}</div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                  <div className="q-time">📅 {new Date(item.schedule_at).toLocaleString('id-ID',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
                  <span className={`q-status ${item.status}`}>
                    {item.status==='pending'&&'⏳ Terjadwal'}
                    {item.status==='posting'&&'📤 Posting...'}
                    {item.status==='done'&&'✅ Selesai'}
                    {item.status==='failed'&&'❌ Gagal'}
                  </span>
                </div>
                {item.status==='failed'&&item.error_msg&&<div style={{fontSize:10,color:'var(--red)',marginTop:4}}>{item.error_msg}</div>}
              </div>
              {item.status!=='posting'&&<button className="q-del" onClick={()=>handleDel(item.id)}>🗑️</button>}
            </div>
          ))
      }
    </>
  );
}

/* ════════ ACCOUNT MANAGER ════════ */
function AccountManager({ accounts, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName]         = useState('');
  const [igUserId, setIgUserId] = useState('');
  const [token, setToken]       = useState('');
  const [showTok, setShowTok]   = useState(false);
  const [editId, setEditId]     = useState(null);
  const [error, setError]       = useState('');
  const [saving, setSaving]     = useState(false);

  const handleSave = async () => {
    if (!name.trim()||!igUserId.trim()||!token.trim()) { setError('Semua field wajib!'); return; }
    setSaving(true); setError('');
    try {
      if (editId) {
        const { error:e } = await supabase.from('accounts').update({name,ig_user_id:igUserId,token}).eq('id',editId);
        if(e) throw e;
      } else {
        const { error:e } = await supabase.from('accounts').insert({name,ig_user_id:igUserId,token});
        if(e) throw e;
      }
      setName(''); setIgUserId(''); setToken(''); setShowForm(false); setEditId(null);
      onRefresh();
    } catch(e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleDel = async (id) => {
    await supabase.from('accounts').delete().eq('id', id);
    onRefresh();
  };

  const handleEdit = (a) => { setName(a.name); setIgUserId(a.ig_user_id); setToken(a.token); setEditId(a.id); setShowForm(true); };

  return (
    <>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:900}}>{accounts.length} Akun Terdaftar</div>
        <button className="btn btn-pink btn-sm" onClick={()=>{setShowForm(true);setEditId(null);setName('');setIgUserId('');setToken('');}}>+ Tambah</button>
      </div>

      {showForm && <div className="card" style={{border:'1.5px solid var(--pink2)'}}>
        <div className="card-hd"><div className="card-icon">{editId?'✏️':'➕'}</div><div><div className="card-title">{editId?'Edit':'Tambah'} Akun MUA</div></div></div>
        <div className="alert alert-warn">⚠️ Butuh akun <strong>Instagram Business/Creator</strong> + token dari developers.facebook.com</div>
        <div className="field">
          <label className="lbl">Username / Nama Akun</label>
          <input className="inp" type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="sandra_mua_solo" />
        </div>
        <div className="field">
          <label className="lbl">Instagram User ID</label>
          <input className="inp" type="text" value={igUserId} onChange={e=>setIgUserId(e.target.value)} placeholder="17841400008460056" />
          <p className="hint">Dapat dari Graph API Explorer → /me → id</p>
        </div>
        <div className="field">
          <label className="lbl">Access Token</label>
          <div style={{position:'relative'}}>
            <input className="inp" type={showTok?'text':'password'} value={token} onChange={e=>setToken(e.target.value)} placeholder="EAAxxxxxxxx..." style={{paddingRight:44}} />
            <button onClick={()=>setShowTok(!showTok)} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:16}}>
              {showTok?'🙈':'👁️'}
            </button>
          </div>
        </div>
        {error&&<div className="alert alert-err">❌ {error}</div>}
        <div className="btn-row">
          <button className="btn btn-ghost" onClick={()=>{setShowForm(false);setError('');}}>Batal</button>
          <button className="btn btn-pink" onClick={handleSave} disabled={saving}>
            {saving?<><div className="spinner"/>Menyimpan...</>:'💾 Simpan'}
          </button>
        </div>
      </div>}

      {accounts.length===0&&!showForm
        ? <div className="empty"><div className="empty-icon">💄</div><div className="empty-txt">Klik "+ Tambah" untuk daftar akun MUA!</div></div>
        : accounts.map(a=>(
            <div key={a.id} className="acc-item">
              <div className="acc-avatar">{a.name[0].toUpperCase()}</div>
              <div><div className="acc-name">@{a.name}</div><div className="acc-id">ID: {a.ig_user_id}</div></div>
              <div className="acc-actions">
                <button className="icon-btn" style={{background:'var(--gold2)',color:'var(--gold)'}} onClick={()=>handleEdit(a)}>✏️</button>
                <button className="icon-btn icon-btn-del" onClick={()=>handleDel(a.id)}>🗑️</button>
              </div>
            </div>
          ))
      }
    </>
  );
}
