'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  // Soal & State Kuis
  const [packetName, setPacketName] = useState('Memuat soal...');
  const [soal, setSoal] = useState([]);
  const [userAnswers, setUserAnswers] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [unansweredList, setUnansweredList] = useState([]);

  // State Autentikasi & Device ID
  const [deviceId, setDeviceId] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  
  // State Admin Panel
  const [adminPackets, setAdminPackets] = useState([]);
  const [newPacketName, setNewPacketName] = useState('');
  const [uploadedJson, setUploadedJson] = useState(null);

  // State Toast Notification
  const [toastMsg, setToastMsg] = useState('');
  const [showToast, setShowToast] = useState(false);

  // 1. Inisialisasi Device ID & Muat Soal Aktif
  useEffect(() => {
    let id = localStorage.getItem('device_auth_id');
    if (!id) {
      id = 'DEV-' + Math.random().toString(36).substring(2, 11).toUpperCase();
      localStorage.setItem('device_auth_id', id);
    }
    setDeviceId(id);

    // Cek Hak Akses Device
    fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: id, action: 'check' })
    })
    .then(res => res.json())
    .then(data => setIsAdmin(data.isAuth));

    // Ambil Soal yang Sedang Aktif
    fetchQuizData();
  }, []);

  const fetchQuizData = () => {
    fetch('/api/quiz')
      .then(res => res.json())
      .then(data => {
        setPacketName(data.packet_name || 'Tidak ada paket aktif');
        setSoal(data.questions_data || []);
        setUserAnswers(new Array(data.questions_data?.length || 0).fill(null));
        setSubmitted(false);
        setScore(0);
        setUnansweredList([]);
      });
  };

  // Muat daftar paket khusus admin panel
  const fetchAdminPackets = (id) => {
    fetch(`/api/quiz?admin=true&deviceId=${id || deviceId}`)
      .then(res => res.json())
      .then(data => {
        if (data.packets) setAdminPackets(data.packets);
      });
  };

  // Trigger Toast Notification
  const triggerToast = (msg) => {
    setToastMsg(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // Logika Pemilihan Jawaban Siswa
  const handleSelectOption = (qIndex, oIndex) => {
    if (submitted) return;
    const newAnswers = [...userAnswers];
    newAnswers[qIndex] = oIndex;
    setUserAnswers(newAnswers);
    
    if (unansweredList.includes(qIndex)) {
      setUnansweredList(unansweredList.filter(i => i !== qIndex));
    }
  };

  // Periksa Semua Jawaban
  const handleCheckAll = () => {
    const missing = [];
    soal.forEach((_, index) => {
      if (userAnswers[index] === null) missing.push(index);
    });

    if (missing.length > 0) {
      setUnansweredList(missing);
      triggerToast(`⚠️ Masih ada ${missing.length} soal yang belum dijawab!`);
      document.getElementById(`card-${missing[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    let totalBenar = 0;
    soal.forEach((s, index) => {
      if (userAnswers[index] === s.jawaban) totalBenar++;
    });

    setScore(totalBenar);
    setSubmitted(true);
    triggerToast('🎉 Hasil koreksi berhasil dimuat!');
    setTimeout(() => {
      document.getElementById('resultCard')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  };

  // Reset Kuis
  const handleResetAll = () => {
    setUserAnswers(new Array(soal.length).fill(null));
    setSubmitted(false);
    setScore(0);
    setUnansweredList([]);
    triggerToast('🔄 Kuis berhasil di-reset!');
  };

  // Verifikasi Password Admin
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
      fetchAdminPackets(deviceId);
      triggerToast('🔑 Akses admin dikonfirmasi untuk device ini!');
    } else {
      alert(data.message);
    }
  };

  // Handler Baca File JSON yang di-upload
  const handleFileUpload = (e) => {
    const fileReader = new FileReader();
    fileReader.readAsText(e.target.files[0], "UTF-8");
    fileReader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        setUploadedJson(parsed);
      } catch (err) {
        alert("File gagal dibaca. Pastikan format file adalah .json murni.");
      }
    };
  };

  // Kirim Paket Soal Baru ke Supabase
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
      fetchQuizData();
      fetchAdminPackets();
    } else {
      alert(data.message);
    }
  };

  // Mengganti Paket Soal lewat Dropdown List Pilihan
  const handleSwitchPacket = async (packetId) => {
    const res = await fetch('/api/quiz', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, packetId })
    });
    if (res.ok) {
      triggerToast('✓ Paket aktif berhasil diubah!');
      fetchQuizData();
      fetchAdminPackets();
    }
  };

  // Kalkulasi Progress Real-time
  const answeredCount = userAnswers.filter(a => a !== null).length;
  const progressPercent = soal.length > 0 ? (answeredCount / soal.length) * 100 : 0;

  // Klasifikasi teks evaluasi berdasarkan skor akhir
  const getTierDescription = () => {
    const rate = score / soal.length;
    if (rate >= 0.95) return "PERFECT SCORE! Lu udah siap ujian bro! 🎉";
    if (rate >= 0.83) return "Hampir full! Tinggal dikit banget lagi buat sempurna. 🔥";
    if (rate >= 0.66) return "Udah bagus! Tinggal poles beberapa topik lagi.";
    if (rate >= 0.33) return "Lumayan ada yang nyantol. Bagian mana yang paling ngebingungin?";
    return "Masih jauh nih bro... tapi jangan nyerah, pelajari lagi pelan-pelan 💪";
  };

  const tagClass = { gelombang: 'tag-gelombang', cahaya: 'tag-cahaya', zat: 'tag-zat', bumi: 'tag-bumi' };

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Sora:wght@300;400;600;700&display=swap" rel="stylesheet" />
      <style>{`
        :root {
          --bg: #0a0f0d; --card: #111814; --border: #1e2e28; --accent: #34d399; --accent2: #fbbf24;
          --text: #e2ede8; --muted: #5a7268; --correct: #4ade80; --wrong: #f87171;
          --tag-gelombang: #34d399; --tag-cahaya: #60a5fa; --tag-zat: #fbbf24; --tag-bumi: #f472b6;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: var(--bg); color: var(--text); font-family: 'Sora', sans-serif; min-height: 100vh; padding: 0 0 80px; }
        .header { background: linear-gradient(135deg, #081a12 0%, #0a0f0d 60%); border-bottom: 1px solid var(--border); padding: 40px 24px 32px; position: relative; overflow: hidden; }
        .header::before { content: ''; position: absolute; top: -60px; right: -60px; width: 280px; height: 280px; background: radial-gradient(circle, rgba(52,211,153,0.12) 0%, transparent 70%); border-radius: 50%; }
        .header-inner { max-width: 780px; margin: 0 auto; position: relative; }
        .header-label { font-family: 'Space Mono', monospace; font-size: 11px; letter-spacing: 3px; color: var(--accent); text-transform: uppercase; margin-bottom: 12px; }
        .header h1 { font-size: clamp(22px, 5vw, 34px); font-weight: 700; line-height: 1.2; margin-bottom: 8px; }
        .header h1 span { color: var(--accent2); }
        .header-sub { color: var(--muted); font-size: 14px; font-weight: 300; }
        .setting-trigger { position: absolute; top: 15px; right: 20px; background: transparent; border: 1px solid var(--border); color: var(--muted); font-size: 18px; padding: 6px 10px; border-radius: 6px; cursor: pointer; transition: all 0.2s; z-index: 10; }
        .setting-trigger:hover { border-color: var(--accent2); color: var(--accent2); }
        .legend { max-width: 780px; margin: 22px auto 0; padding: 0 24px; display: flex; gap: 14px; flex-wrap: wrap; }
        .legend-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); }
        .legend-dot { width: 8px; height: 8px; border-radius: 50%; }
        .controls { max-width: 780px; margin: 18px auto 0; padding: 0 24px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
        .btn { padding: 8px 18px; border-radius: 6px; border: 1px solid var(--border); background: var(--card); color: var(--text); font-family: 'Sora', sans-serif; font-size: 13px; cursor: pointer; transition: all 0.2s; }
        .btn:hover { border-color: var(--accent); color: var(--accent); }
        .btn.primary { background: var(--accent); border-color: var(--accent); color: #051a10; font-weight: 700; }
        .score-display { margin-left: auto; font-family: 'Space Mono', monospace; font-size: 13px; color: var(--accent2); }
        .progress-bar-wrap { max-width: 780px; margin: 16px auto 0; padding: 0 24px; }
        .progress-info { display: flex; justify-content: space-between; font-size: 12px; color: var(--muted); margin-bottom: 6px; font-family: 'Space Mono', monospace; }
        .progress-track { height: 4px; background: var(--border); border-radius: 99px; overflow: hidden; }
        .progress-fill { height: 100%; background: var(--accent); border-radius: 99px; transition: width 0.3s ease; }
        .questions { max-width: 780px; margin: 28px auto 0; padding: 0 24px; display: flex; flex-direction: column; gap: 18px; }
        .q-card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; transition: border-color 0.2s; }
        .q-card.unanswered { border-color: #f59e0b; animation: pulse-warn 1s ease-in-out 3; }
        @keyframes pulse-warn { 0%, 100% { border-color: #f59e0b; } 50% { border-color: #fde68a; box-shadow: 0 0 0 3px rgba(245,158,11,0.2); } }
        .q-card.answered-correct { border-color: var(--correct); }
        .q-card.answered-wrong { border-color: var(--wrong); }
        .q-header { display: flex; align-items: center; gap: 10px; padding: 16px 20px 0; }
        .q-num { font-family: 'Space Mono', monospace; font-size: 11px; color: var(--muted); min-width: 28px; }
        .q-tag { font-size: 10px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; padding: 3px 8px; border-radius: 4px; }
        .tag-gelombang { background: rgba(52,211,153,0.12); color: var(--tag-gelombang); }
        .tag-cahaya { background: rgba(96,165,250,0.12); color: var(--tag-cahaya); }
        .tag-zat { background: rgba(251,191,36,0.12); color: var(--tag-zat); }
        .tag-bumi { background: rgba(244,114,182,0.12); color: var(--tag-bumi); }
        .q-body { padding: 12px 20px 6px; }
        .q-text { font-size: 14px; line-height: 1.75; color: #ffffff; }
        .q-text .hl { font-family: 'Space Mono', monospace; background: rgba(52,211,153,0.1); color: var(--accent); padding: 1px 5px; border-radius: 3px; font-size: 12.5px; }
        .q-text .hl2 { font-family: 'Space Mono', monospace; background: rgba(251,191,36,0.1); color: var(--accent2); padding: 1px 5px; border-radius: 3px; font-size: 12.5px; }
        .options { padding: 10px 20px 18px; display: flex; flex-direction: column; gap: 8px; }
        .option { display: flex; align-items: flex-start; gap: 10px; padding: 10px 14px; border-radius: 8px; border: 1px solid var(--border); cursor: pointer; transition: all 0.15s; font-size: 13.5px; line-height: 1.55; background: transparent; text-align: left; width: 100%; color: #ffffff; }
        .option:hover { border-color: var(--accent); background: rgba(52,211,153,0.05); }
        .option.selected { border-color: var(--accent); background: rgba(52,211,153,0.08); }
        .option.correct { border-color: var(--correct) !important; background: rgba(74,222,128,0.1) !important; }
        .option.wrong { border-color: var(--wrong) !important; background: rgba(248,113,113,0.1) !important; }
        .option.reveal-correct { border-color: var(--correct) !important; background: rgba(74,222,128,0.06) !important; }
        .opt-letter { font-family: 'Space Mono', monospace; font-size: 12px; font-weight: 700; color: var(--muted); min-width: 18px; padding-top: 1px; transition: color 0.15s; flex-shrink: 0; }
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
        .result-label { color: var(--muted); font-size: 13px; margin-bottom: 14px; }
        .result-desc  { font-size: 15px; color: var(--text); }
        .toast { position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%) translateY(80px); background: #1e1208; border: 1px solid #f59e0b; color: #fde68a; font-size: 13px; padding: 12px 20px; border-radius: 8px; z-index: 999; transition: transform 0.3s ease, opacity 0.3s ease; opacity: 0; pointer-events: none; }
        .toast.show { transform: translateX(-50%) translateY(0); opacity: 1; }
        
        /* CSS MODAL DI SINI */
        .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); display: flex; justify-content: center; align-items: center; z-index: 1000; padding: 15px; }
        .modal-content { background: var(--card); border: 1px solid var(--border); padding: 24px; border-radius: 12px; width: 100%; max-width: 440px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        .modal-content h3 { margin-bottom: 5px; font-size: 18px; color: #fff; }
        .modal-desc { font-size: 12px; color: var(--muted); margin-bottom: 16px; font-family: 'Space Mono', monospace; }
        .modal-input { width: 100%; padding: 10px 14px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; color: #fff; font-family: 'Sora', sans-serif; font-size: 14px; margin-bottom: 14px; }
        .modal-input:focus { border-color: var(--accent); outline: none; }
        .modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 10px; }
        .admin-section { border-top: 1px dashed var(--border); margin-top: 16px; padding-top: 16px; }
        .admin-section h4 { font-size: 13px; color: var(--accent2); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; }
        .packet-select { width: 100%; padding: 10px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; color: #fff; font-size: 13px; margin-bottom: 12px; }
      `}</style>

      {/* HEADER UTAMA */}
      <div className="header">
        <button className="setting-trigger" onClick={() => { setShowModal(true); if(isAdmin) fetchAdminPackets(); }}>⚙️</button>
        <div className="header-inner">
          <div className="header-label">Latihan Soal · SAT IPA 2026</div>
          <h1>{packetName.split('\n')[0]}<br /><span>{soal.length} Soal Pilihan Ganda</span></h1>
          <p className="header-sub">Gelombang & Bunyi · Cahaya & Optik · Zat & Campuran · Bumi & Atmosfer</p>
        </div>
      </div>

      {/* LEGENDA INDIKATOR TOP IK */}
      <div className="legend">
        <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--tag-gelombang)' }}></div>Gelombang & Bunyi</div>
        <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--tag-cahaya)' }}></div>Cahaya & Optik</div>
        <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--tag-zat)' }}></div>Zat & Campuran</div>
        <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--tag-bumi)' }}></div>Bumi & Atmosfer</div>
      </div>

      {/* TOMBOL RESET */}
      <div className="controls">
        <button className="btn" onClick={handleResetAll}>Reset</button>
        {submitted && <div className="score-display">{score} / {soal.length} benar</div>}
      </div>

      {/* PROGRESS TRACKER */}
      <div className="progress-bar-wrap">
        <div className="progress-info">
          <span>Progress jawaban</span>
          <span>{answeredCount} / {soal.length}</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progressPercent}%` }}></div>
        </div>
      </div>

      {/* DAFTAR SOAL DINAMIS */}
      <div className="questions">
        {soal.length === 0 ? (
          <div className="q-card" style={{ padding: '30px', textAlign: 'center', color: 'var(--muted)' }}>Belum ada paket kuis aktif. Masuk ke Setting untuk mengunggah berkas JSON soal.</div>
        ) : (
          soal.map((s, qIndex) => {
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
          })
        )}
      </div>

      {/* AREA KONTROL BAWAH */}
      {soal.length > 0 && (
        <div className="bottom-controls">
          <div className="submit-box">
            <div className="submit-info">Sudah menjawab <span>{answeredCount}</span> dari <span>{soal.length}</span> soal</div>
            <button className="btn primary" onClick={handleCheckAll} disabled={submitted} style={{ opacity: submitted ? 0.5 : 1 }}>Periksa Jawaban</button>
          </div>
        </div>
      )}

      {/* CARD HASIL SKOR AKHIR */}
      <div className={`result-card ${submitted ? 'show' : ''}`} id="resultCard">
        <div className="result-inner">
          <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Nilai Akhir</div>
          <div className="result-score">{score}</div>
          <div className="result-label">dari {soal.length} soal benar</div>
          <div className="result-desc">{submitted && getTierDescription()}</div>
        </div>
      </div>

      {/* NOTIFIKASI TOAST */}
      <div className={`toast ${showToast ? 'show' : ''}`}>{toastMsg}</div>

      {/* MODAL SETTING PANEL */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{isAdmin ? '⚙️ Control Center' : '🔒 Akses Pengaturan'}</h3>
            <div className="modal-desc">Device ID: {deviceId}</div>

            {!isAdmin ? (
              // PANEL LOGIN
              <div>
                <input type="password" placeholder="Masukkan Sandi Keamanan..." className="modal-input" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} />
                <div className="modal-actions">
                  <button className="btn primary" onClick={handleLoginAdmin}>Konfirmasi</button>
                  <button className="btn" onClick={() => setShowModal(false)}>Batal</button>
                </div>
              </div>
            ) : (
              // PANEL ADMIN (UPLOAD & PILIH PAKET)
              <div>
                <div className="admin-section">
                  <h4>Pilih Paket Soal Aktif</h4>
                  <select className="packet-select" onChange={(e) => handleSwitchPacket(e.target.value)} defaultValue="">
                    <option value="" disabled>-- Pilih paket di database --</option>
                    {adminPackets.map(p => (
                      <option key={p.id} value={p.id}>{p.packet_name} {p.is_active ? '(Aktif)' : ''}</option>
                    ))}
                  </select>
                </div>

                <div className="admin-section">
                  <h4>Upload File Soal Baru (.json)</h4>
                  <input type="text" placeholder="Nama Paket (Misal: SAT IPA v2)" className="modal-input" value={newPacketName} onChange={(e) => setNewPacketName(e.target.value)} />
                  <input type="file" accept=".json" className="modal-input" onChange={handleFileUpload} style={{ padding: '6px' }} />
                  <button className="btn primary" style={{ width: '100%', marginTop: '5px' }} onClick={handleSaveNewPacket}>Unggah & Aktifkan Paket</button>
                </div>

                <div className="modal-actions" style={{ marginTop: '20px' }}>
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
