'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  // State Mode Tampilan & Menu
  const [packetsList, setPacketsList] = useState([]);
  const [isMenuMode, setIsMenuMode] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // State Soal & Kuis
  const [packetName, setPacketName] = useState('');
  const [soal, setSoal] = useState([]);
  const [userAnswers, setUserAnswers] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [unansweredList, setUnansweredList] = useState([]);

  // State Autentikasi & Admin
  const [deviceId, setDeviceId] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [newPacketName, setNewPacketName] = useState('');
  const [uploadedJson, setUploadedJson] = useState(null);

  // State Toast
  const [toastMsg, setToastMsg] = useState('');
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    let id = localStorage.getItem('device_auth_id');
    if (!id) {
      id = 'DEV-' + Math.random().toString(36).substring(2, 11).toUpperCase();
      localStorage.setItem('device_auth_id', id);
    }
    setDeviceId(id);

    fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: id, action: 'check' })
    })
    .then(res => res.json())
    .then(data => setIsAdmin(data.isAuth));

    fetchAllPackets();
  }, []);

  const fetchAllPackets = () => {
    setIsLoading(true);
    fetch('/api/quiz?action=list')
      .then(res => res.json())
      .then(data => {
        setPacketsList(data);
        setIsLoading(false);
      });
  };

  const loadQuizPacket = (id) => {
    setIsLoading(true);
    triggerToast('Sedang menyiapkan soal...');
    fetch(`/api/quiz?action=get&id=${id}`)
      .then(res => res.json())
      .then(data => {
        if(data) {
          setPacketName(data.packet_name);
          setSoal(data.questions_data);
          setUserAnswers(new Array(data.questions_data.length).fill(null));
          setSubmitted(false);
          setScore(0);
          setUnansweredList([]);
          setIsMenuMode(false);
        }
        setIsLoading(false);
      });
  };

  const backToMenu = () => {
    setIsMenuMode(true);
    setSoal([]);
    fetchAllPackets();
  };

  const triggerToast = (msg) => {
    setToastMsg(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // --- LOGIKA KUIS ---
  const handleSelectOption = (qIndex, oIndex) => {
    if (submitted) return;
    const newAnswers = [...userAnswers];
    newAnswers[qIndex] = oIndex;
    setUserAnswers(newAnswers);
    if (unansweredList.includes(qIndex)) setUnansweredList(unansweredList.filter(i => i !== qIndex));
  };

  const handleCheckAll = () => {
    const missing = [];
    soal.forEach((_, index) => { if (userAnswers[index] === null) missing.push(index); });

    if (missing.length > 0) {
      setUnansweredList(missing);
      triggerToast(`⚠️ Masih ada ${missing.length} soal belum dijawab!`);
      document.getElementById(`card-${missing[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    let totalBenar = 0;
    soal.forEach((s, index) => { if (userAnswers[index] === s.jawaban) totalBenar++; });
    setScore(totalBenar);
    setSubmitted(true);
    triggerToast('🎉 Hasil koreksi berhasil dimuat!');
    setTimeout(() => document.getElementById('resultCard')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
  };

  const handleResetAll = () => {
    setUserAnswers(new Array(soal.length).fill(null));
    setSubmitted(false);
    setScore(0);
    setUnansweredList([]);
    triggerToast('🔄 Kuis berhasil di-reset!');
  };

  // --- LOGIKA ADMIN ---
  const handleLoginAdmin = async () => {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, password: passwordInput, action: 'login' })
    });
    const data = await res.json();
    if (data.success) {
      setIsAdmin(true);
      setPasswordInput('');
      triggerToast('🔑 Akses admin dikonfirmasi!');
    } else alert(data.message);
  };

  const handleFileUpload = (e) => {
    const fileReader = new FileReader();
    fileReader.readAsText(e.target.files[0], "UTF-8");
    fileReader.onload = (event) => {
      try { setUploadedJson(JSON.parse(event.target.result)); } 
      catch (err) { alert("File gagal dibaca. Pastikan format file .json murni."); }
    };
  };

  const handleSaveNewPacket = async () => {
    if (!newPacketName || !uploadedJson) return alert('Nama paket dan file JSON wajib diisi.');
    const res = await fetch('/api/quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, packetName: newPacketName, jsonData: uploadedJson })
    });
    const data = await res.json();
    if (res.ok) {
      triggerToast('✓ Paket soal berhasil diunggah!');
      setNewPacketName('');
      setUploadedJson(null);
      fetchAllPackets();
    } else alert(data.message);
  };

  const handleDeletePacket = async (id) => {
    if(!confirm("Yakin ingin menghapus paket soal ini?")) return;
    const res = await fetch('/api/quiz', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, packetId: id })
    });
    if (res.ok) {
      triggerToast('🗑️ Paket berhasil dihapus');
      fetchAllPackets();
    }
  };

  const getTierDescription = () => {
    const rate = score / soal.length;
    if (rate >= 0.95) return "PERFECT SCORE! Lu udah siap ujian bro! 🎉";
    if (rate >= 0.83) return "Hampir full! Tinggal dikit banget lagi buat sempurna. 🔥";
    if (rate >= 0.66) return "Udah bagus! Tinggal poles beberapa topik lagi.";
    if (rate >= 0.33) return "Lumayan ada yang nyantol. Bagian mana yang paling ngebingungin?";
    return "Masih jauh nih bro... tapi jangan nyerah, pelajari lagi pelan-pelan 💪";
  };

  const answeredCount = userAnswers.filter(a => a !== null).length;
  const progressPercent = soal.length > 0 ? (answeredCount / soal.length) * 100 : 0;
  const tagClass = { gelombang: 'tag-gelombang', cahaya: 'tag-cahaya', zat: 'tag-zat', bumi: 'tag-bumi', narrative: 'tag-narrative', recount: 'tag-recount', present: 'tag-present', past: 'tag-past', pastcont: 'tag-pastcont', comparison: 'tag-comparison', vocab: 'tag-vocab', reading: 'tag-reading' };

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Sora:wght@300;400;600;700&display=swap" rel="stylesheet" />
      <style>{`
        :root {
          --bg: #0a0f0d; --card: #111814; --border: #1e2e28; --accent: #34d399; --accent2: #fbbf24;
          --text: #e2ede8; --muted: #5a7268; --correct: #4ade80; --wrong: #f87171;
          --tag-gelombang: #34d399; --tag-cahaya: #60a5fa; --tag-zat: #fbbf24; --tag-bumi: #f472b6;
          --tag-narrative: #a855f7; --tag-recount: #38bdf8; --tag-present: #f97316; --tag-past: #ec4899; 
          --tag-pastcont: #14b8a6; --tag-comparison: #84cc16; --tag-vocab: #f43f5e; --tag-reading: #6366f1;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: var(--bg); color: var(--text); font-family: 'Sora', sans-serif; min-height: 100vh; padding: 0 0 80px; }
        .header { background: linear-gradient(135deg, #081a12 0%, #0a0f0d 60%); border-bottom: 1px solid var(--border); padding: 40px 24px 32px; position: relative; overflow: hidden; }
        .header::before { content: ''; position: absolute; top: -60px; right: -60px; width: 280px; height: 280px; background: radial-gradient(circle, rgba(52,211,153,0.12) 0%, transparent 70%); border-radius: 50%; }
        .header-inner { max-width: 780px; margin: 0 auto; position: relative; }
        .header-label { font-family: 'Space Mono', monospace; font-size: 11px; letter-spacing: 3px; color: var(--accent); text-transform: uppercase; margin-bottom: 12px; display: inline-block; }
        .header h1 { font-size: clamp(22px, 5vw, 34px); font-weight: 700; line-height: 1.2; margin-bottom: 8px; }
        .header h1 span { color: var(--accent2); }
        .setting-trigger { position: absolute; top: 15px; right: 20px; background: transparent; border: 1px solid var(--border); color: var(--muted); font-size: 18px; padding: 6px 10px; border-radius: 6px; cursor: pointer; transition: all 0.2s; z-index: 10; }
        .setting-trigger:hover { border-color: var(--accent2); color: var(--accent2); }
        
        /* CSS KHUSUS MENU MAPEL */
        .menu-grid { max-width: 780px; margin: 30px auto; padding: 0 24px; display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 16px; }
        .paket-card { background: var(--card); border: 1px solid var(--border); padding: 24px; border-radius: 12px; cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; justify-content: center; min-height: 120px; position: relative; overflow: hidden; }
        .paket-card:hover { border-color: var(--accent); transform: translateY(-3px); box-shadow: 0 10px 20px rgba(0,0,0,0.2); }
        .paket-card::after { content:''; position:absolute; bottom:0; left:0; height:3px; width:0; background:var(--accent); transition: width 0.3s ease; }
        .paket-card:hover::after { width:100%; }
        .paket-title { font-size: 16px; font-weight: 600; color: #fff; margin-bottom: 8px; }
        .paket-btn { align-self: flex-start; margin-top: 10px; font-size: 12px; color: var(--accent); font-family: 'Space Mono', monospace; }
        .back-btn { background: rgba(255,255,255,0.05); border: 1px solid var(--border); color: var(--text); padding: 6px 12px; border-radius: 6px; font-size: 12px; cursor: pointer; margin-right: 15px; font-family: 'Sora'; }
        .back-btn:hover { background: rgba(255,255,255,0.1); }

        /* CSS KUIS STANDAR */
        .legend { max-width: 780px; margin: 22px auto 0; padding: 0 24px; display: flex; gap: 14px; flex-wrap: wrap; }
        .legend-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); }
        .legend-dot { width: 8px; height: 8px; border-radius: 50%; }
        .controls { max-width: 780px; margin: 18px auto 0; padding: 0 24px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
        .btn { padding: 8px 18px; border-radius: 6px; border: 1px solid var(--border); background: var(--card); color: var(--text); font-family: 'Sora', sans-serif; font-size: 13px; cursor: pointer; transition: all 0.2s; }
        .btn:hover { border-color: var(--accent); color: var(--accent); }
        .btn.primary { background: var(--accent); border-color: var(--accent); color: #051a10; font-weight: 700; }
        .btn.danger { background: rgba(248,113,113,0.1); border-color: var(--wrong); color: var(--wrong); }
        .btn.danger:hover { background: var(--wrong); color: #fff; }
        .score-display { margin-left: auto; font-family: 'Space Mono', monospace; font-size: 13px; color: var(--accent2); }
        .progress-bar-wrap { max-width: 780px; margin: 16px auto 0; padding: 0 24px; }
        .progress-info { display: flex; justify-content: space-between; font-size: 12px; color: var(--muted); margin-bottom: 6px; font-family: 'Space Mono', monospace; }
        .progress-track { height: 4px; background: var(--border); border-radius: 99px; overflow: hidden; }
        .progress-fill { height: 100%; background: var(--accent); border-radius: 99px; transition: width 0.3s ease; }
        .questions { max-width: 780px; margin: 28px auto 0; padding: 0 24px; display: flex; flex-direction: column; gap: 18px; }
        .q-card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; transition: border-color 0.2s; }
        .q-card.unanswered { border-color: #f59e0b; }
        .q-card.answered-correct { border-color: var(--correct); }
        .q-card.answered-wrong { border-color: var(--wrong); }
        .q-header { display: flex; align-items: center; gap: 10px; padding: 16px 20px 0; }
        .q-num { font-family: 'Space Mono', monospace; font-size: 11px; color: var(--muted); min-width: 28px; }
        .q-tag { font-size: 10px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; padding: 3px 8px; border-radius: 4px; }
        
        .tag-gelombang { background: rgba(52,211,153,0.12); color: var(--tag-gelombang); }
        .tag-cahaya { background: rgba(96,165,250,0.12); color: var(--tag-cahaya); }
        .tag-zat { background: rgba(251,191,36,0.12); color: var(--tag-zat); }
        .tag-bumi { background: rgba(244,114,182,0.12); color: var(--tag-bumi); }
        .tag-narrative { background: rgba(168,85,247,0.12); color: var(--tag-narrative); }
        .tag-recount { background: rgba(56,189,248,0.12); color: var(--tag-recount); }
        .tag-present { background: rgba(249,115,22,0.12); color: var(--tag-present); }
        .tag-past { background: rgba(236,72,153,0.12); color: var(--tag-past); }
        .tag-pastcont { background: rgba(20,184,166,0.12); color: var(--tag-pastcont); }
        .tag-comparison { background: rgba(132,204,22,0.12); color: var(--tag-comparison); }
        .tag-vocab { background: rgba(244,63,94,0.12); color: var(--tag-vocab); }
        .tag-reading { background: rgba(99,102,241,0.12); color: var(--tag-reading); }

        .q-body { padding: 12px 20px 6px; }
        .q-text { font-size: 14px; line-height: 1.75; color: #ffffff; }
        .q-text .hl { font-family: 'Space Mono', monospace; background: rgba(52,211,153,0.1); color: var(--accent); padding: 1px 5px; border-radius: 3px; font-size: 12.5px; }
        .q-text .hl2 { font-family: 'Space Mono', monospace; background: rgba(251,191,36,0.1); color: var(--accent2); padding: 1px 5px; border-radius: 3px; font-size: 12.5px; }
        .options { padding: 10px 20px 18px; display: flex; flex-direction: column; gap: 8px; }
        .option { display: flex; align-items: flex-start; gap: 10px; padding: 10px 14px; border-radius: 8px; border: 1px solid var(--border); cursor: pointer; font-size: 13.5px; line-height: 1.55; background: transparent; text-align: left; width: 100%; color: #ffffff; transition: all 0.15s; }
        .option:hover { border-color: var(--accent); background: rgba(52,211,153,0.05); }
        .option.selected { border-color: var(--accent); background: rgba(52,211,153,0.08); }
        .option.correct { border-color: var(--correct) !important; background: rgba(74,222,128,0.1) !important; }
        .option.wrong { border-color: var(--wrong) !important; background: rgba(248,113,113,0.1) !important; }
        .option.reveal-correct { border-color: var(--correct) !important; background: rgba(74,222,128,0.06) !important; }
        .opt-letter { font-family: 'Space Mono', monospace; font-size: 12px; font-weight: 700; color: var(--muted); min-width: 18px; padding-top: 1px; }
        .option.selected .opt-letter { color: var(--accent); }
        .option.correct .opt-letter { color: var(--correct); }
        .option.wrong .opt-letter { color: var(--wrong); }
        .option.reveal-correct .opt-letter { color: var(--correct); }
        .pembahasan { margin: 0 20px 16px; padding: 12px 14px; background: rgba(251,191,36,0.06); border-left: 3px solid var(--accent2); border-radius: 0 8px 8px 0; font-size: 12.5px; color: #c0a860; line-height: 1.7; display: none; }
        .pembahasan.show { display: block; }
        .pembahasan strong { color: var(--accent2); }
        
        .bottom-controls { max-width: 780px; margin: 28px auto 0; padding: 0 24px; }
        .submit-box { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 20px 24px; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .submit-info { font-size: 13px; color: var(--muted); }
        .submit-info span { color: var(--text); font-weight: 600; }
        .result-card { max-width: 780px; margin: 20px auto 0; padding: 0 24px; display: none; }
        .result-card.show { display: block; }
        .result-inner { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 30px; text-align: center; }
        .result-score { font-family: 'Space Mono', monospace; font-size: 54px; font-weight: 700; color: var(--accent2); margin: 8px 0; }
        
        .toast { position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%) translateY(80px); background: #1e1208; border: 1px solid #f59e0b; color: #fde68a; font-size: 13px; padding: 12px 20px; border-radius: 8px; z-index: 999; transition: transform 0.3s ease, opacity 0.3s ease; opacity: 0; pointer-events: none; }
        .toast.show { transform: translateX(-50%) translateY(0); opacity: 1; }
        
        /* CSS MODAL & ADMIN */
        .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); display: flex; justify-content: center; align-items: center; z-index: 1000; padding: 15px; }
        .modal-content { background: var(--card); border: 1px solid var(--border); padding: 24px; border-radius: 12px; width: 100%; max-width: 460px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); max-height: 90vh; overflow-y: auto; }
        .modal-content h3 { margin-bottom: 5px; font-size: 18px; color: #fff; }
        .modal-desc { font-size: 12px; color: var(--muted); margin-bottom: 16px; font-family: 'Space Mono', monospace; }
        .modal-input { width: 100%; padding: 10px 14px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; color: #fff; font-family: 'Sora', sans-serif; font-size: 14px; margin-bottom: 14px; }
        .admin-section { border-top: 1px dashed var(--border); margin-top: 16px; padding-top: 16px; }
        .admin-section h4 { font-size: 13px; color: var(--accent2); margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px; }
        .admin-packet-item { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); border: 1px solid var(--border); padding: 10px 14px; border-radius: 6px; margin-bottom: 8px; font-size: 13px; }
      `}</style>

      {/* HEADER DINAMIS */}
      <div className="header">
        <button className="setting-trigger" onClick={() => setShowModal(true)}>⚙️</button>
        <div className="header-inner">
          <div className="header-label">
            {!isMenuMode && <button className="back-btn" onClick={backToMenu}>← KEMBALI</button>}
            Platform Latihan · SAT 2026
          </div>
          {isMenuMode ? (
            <>
              <h1>Pilih Paket Latihan<br /><span>Ujian SAT</span></h1>
              <p className="header-sub">Pilih salah satu mata pelajaran di bawah untuk mulai simulasi.</p>
            </>
          ) : (
            <>
              <h1>{packetName.split('\n')[0]}<br /><span>{soal.length} Soal Pilihan Ganda</span></h1>
              <p className="header-sub">Kerjakan dengan teliti. Hasil akan dikoreksi otomatis.</p>
            </>
          )}
        </div>
      </div>

      {/* WAJAH 1: MENU UTAMA (PILIHAN MAPEL) */}
      {isMenuMode && (
        <div className="menu-grid">
          {isLoading ? (
            <div style={{ color: 'var(--muted)', textAlign: 'center', gridColumn: '1 / -1', padding: '40px' }}>Memuat daftar soal dari server...</div>
          ) : packetsList.length === 0 ? (
            <div style={{ color: 'var(--muted)', textAlign: 'center', gridColumn: '1 / -1', padding: '40px' }}>Belum ada paket soal yang tersedia.</div>
          ) : (
            packetsList.map(paket => (
              <div className="paket-card" key={paket.id} onClick={() => loadQuizPacket(paket.id)}>
                <div className="paket-title">{paket.packet_name}</div>
                <div className="paket-btn">Mulai Kuis ➔</div>
              </div>
            ))
          )}
        </div>
      )}

      {/* WAJAH 2: MODE KUIS (HTML SOAL) */}
      {!isMenuMode && (
        <>
          <div className="controls">
            <button className="btn" onClick={handleResetAll}>Reset</button>
            {submitted && <div className="score-display">{score} / {soal.length} benar</div>}
          </div>

          <div className="progress-bar-wrap">
            <div className="progress-info">
              <span>Progress jawaban</span>
              <span>{answeredCount} / {soal.length}</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progressPercent}%` }}></div>
            </div>
          </div>

          <div className="questions">
            {soal.map((s, qIndex) => {
              const isUnanswered = unansweredList.includes(qIndex);
              let cardStatusClass = isUnanswered ? 'unanswered' : '';
              if (submitted) {
                cardStatusClass = userAnswers[qIndex] === s.jawaban ? 'answered-correct' : 'answered-wrong';
              }

              return (
                <div className={`q-card ${cardStatusClass}`} id={`card-${qIndex}`} key={qIndex}>
                  <div className="q-header">
                    <span className="q-num">{String(s.id).padStart(2, '0')}.</span>
                    <span className={`q-tag ${tagClass[s.tag] || ''}`}>{s.tagLabel}</span>
                  </div>
                  <div className="q-body">
                    <p className="q-text" dangerouslySetInnerHTML={{ __html: s.soal }}></p>
                  </div>
                  <div className="options">
                    {s.opsi.map((optionText, oIndex) => {
                      let optClass = '';
                      if (submitted) {
                        if (oIndex === s.jawaban) optClass = 'reveal-correct';
                        if (userAnswers[qIndex] === oIndex && oIndex !== s.jawaban) optClass = 'wrong';
                        if (userAnswers[qIndex] === oIndex && oIndex === s.jawaban) optClass = 'correct';
                      } else if (userAnswers[qIndex] === oIndex) {
                        optClass = 'selected';
                      }
                      return (
                        <button className={`option ${optClass}`} key={oIndex} onClick={() => handleSelectOption(qIndex, oIndex)}>
                          <span className="opt-letter">{['A', 'B', 'C', 'D'][oIndex]}</span>
                          <span>{optionText}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className={`pembahasan ${submitted ? 'show' : ''}`}>
                    <span dangerouslySetInnerHTML={{ __html: `<strong>Pembahasan:</strong> ${s.pembahasan}` }}></span>
                  </div>
                </div>
              );
            })}
          </div>

          {soal.length > 0 && (
            <div className="bottom-controls">
              <div className="submit-box">
                <div className="submit-info">Sudah menjawab <span>{answeredCount}</span> dari <span>{soal.length}</span> soal</div>
                <button className="btn primary" onClick={handleCheckAll} disabled={submitted} style={{ opacity: submitted ? 0.5 : 1 }}>Periksa Jawaban</button>
              </div>
            </div>
          )}

          <div className={`result-card ${submitted ? 'show' : ''}`} id="resultCard">
            <div className="result-inner">
              <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Nilai Akhir</div>
              <div className="result-score">{score}</div>
              <div className="result-label">dari {soal.length} soal benar</div>
              <div className="result-desc">{submitted && getTierDescription()}</div>
            </div>
          </div>
        </>
      )}

      {/* TOAST & MODAL ADMIN */}
      <div className={`toast ${showToast ? 'show' : ''}`}>{toastMsg}</div>
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{isAdmin ? '⚙️ Admin Panel' : '🔒 Akses Admin'}</h3>
            <div className="modal-desc">Device ID: {deviceId}</div>
            
            {!isAdmin ? (
              <div>
                <input type="password" placeholder="Masukkan Sandi Admin..." className="modal-input" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} />
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button className="btn primary" onClick={handleLoginAdmin}>Masuk</button>
                  <button className="btn" onClick={() => setShowModal(false)}>Batal</button>
                </div>
              </div>
            ) : (
              <div>
                <div className="admin-section" style={{ marginTop: '0', paddingTop: '0', borderTop: 'none' }}>
                  <h4>1. Upload Paket Baru (.json)</h4>
                  <input type="text" placeholder="Nama Mapel (Misal: SAT Fisika)" className="modal-input" value={newPacketName} onChange={(e) => setNewPacketName(e.target.value)} />
                  <input type="file" accept=".json" className="modal-input" onChange={handleFileUpload} style={{ padding: '6px' }} />
                  <button className="btn primary" style={{ width: '100%', marginTop: '5px' }} onClick={handleSaveNewPacket}>Unggah ke Server</button>
                </div>
                
                <div className="admin-section">
                  <h4>2. Kelola Paket Tersedia</h4>
                  {packetsList.length === 0 ? <p style={{ fontSize: '12px', color: 'var(--muted)' }}>Belum ada paket.</p> : (
                    packetsList.map(p => (
                      <div className="admin-packet-item" key={p.id}>
                        <span>{p.packet_name}</span>
                        <button className="btn danger" style={{ padding: '4px 10px', fontSize: '11px' }} onClick={() => handleDeletePacket(p.id)}>Hapus</button>
                      </div>
                    ))
                  )}
                </div>

                <div style={{ marginTop: '20px' }}>
                  <button className="btn" style={{ width: '100%' }} onClick={() => setShowModal(false)}>Tutup Panel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
