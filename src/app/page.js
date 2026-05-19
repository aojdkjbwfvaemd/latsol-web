'use client';
import { useState, useEffect, useRef } from 'react';
import { useChat } from 'ai/react';

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

  // State AI Chat Bubble
  const [isChatOpen, setIsChatOpen] = useState(false);
  const chatEndRef = useRef(null);

  // Bangun konteks soal untuk AI (ringkasan tanpa jawaban)
  const quizContext = !isMenuMode && soal.length > 0
    ? `Paket: "${packetName}"\nJumlah soal: ${soal.length}\n\nDaftar soal:\n` +
      soal.map((s, i) =>
        `Soal ${i + 1} [${s.tagLabel}]: ${s.soal.replace(/<[^>]*>/g, '')}\nOpsi: ${s.opsi.map((o, idx) => `${['A','B','C','D'][idx]}) ${o}`).join(', ')}`
      ).join('\n\n')
    : '';

  const { messages, input, handleInputChange, handleSubmit, isLoading: isChatLoading, setMessages } = useChat({
    api: '/api/chat',
    body: { quizContext },
    onError: () => triggerToast('❌ AI tidak bisa dijangkau. Cek API key!'),
  });

  // Auto-scroll chat ke bawah saat pesan baru masuk
  useEffect(() => {
    if (isChatOpen) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isChatOpen]);

  // Reset chat saat ganti paket soal
  useEffect(() => {
    setMessages([]);
    setIsChatOpen(false);
  }, [packetName]);

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
    triggerToast('🚀 Menyiapkan simulasi soal...');
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
          --tag-sejarah: #ff4757;
          --tag-ekonomi: #ffa502;
          --tag-sosiologi: #2ed573;
          --tag-geografi: #1e90ff;
          --tag-komputasional: #f43f5e;
          --tag-algoritma: #8b5cf6;
          --tag-scratch: #0ea5e9;
          --tag-blockly: #10b981;

        }
        
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: var(--bg); color: var(--text); font-family: 'Sora', sans-serif; min-height: 100vh; padding: 0 0 80px; overflow-x: hidden; }
        
        /* --- ANIMATIONS ENGINE --- */
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes popIn {
          0% { transform: scale(0.92); opacity: 0; }
          70% { transform: scale(1.02); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes pulseCorrect {
          0% { box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.4); }
          70% { box-shadow: 0 0 0 12px rgba(74, 222, 128, 0); }
          100% { box-shadow: 0 0 0 0 rgba(74, 222, 128, 0); }
        }
        @keyframes pulseUnanswered {
          0% { border-color: #1e2e28; }
          50% { border-color: #f59e0b; box-shadow: 0 0 8px rgba(245, 158, 11, 0.2); }
          100% { border-color: #1e2e28; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes slideToast {
          0% { transform: translateX(-50%) translateY(40px); opacity: 0; }
          100% { transform: translateX(-50%) translateY(0); opacity: 1; }
        }

        /* --- STYLES --- */
        .header { background: linear-gradient(135deg, #081a12 0%, #0a0f0d 60%); border-bottom: 1px solid var(--border); padding: 40px 24px 32px; position: relative; overflow: hidden; }
        .header::before { content: ''; position: absolute; top: -60px; right: -60px; width: 280px; height: 280px; background: radial-gradient(circle, rgba(52,211,153,0.12) 0%, transparent 70%); border-radius: 50%; }
        .header-inner { max-width: 780px; margin: 0 auto; position: relative; animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
        .header-label { font-family: 'Space Mono', monospace; font-size: 11px; letter-spacing: 3px; color: var(--accent); text-transform: uppercase; margin-bottom: 12px; display: inline-block; }
        .header h1 { font-size: clamp(22px, 5vw, 34px); font-weight: 700; line-height: 1.2; margin-bottom: 8px; }
        .header h1 span { color: var(--accent2); }
        .setting-trigger { position: absolute; top: 15px; right: 20px; background: transparent; border: 1px solid var(--border); color: var(--muted); font-size: 18px; padding: 6px 10px; border-radius: 6px; cursor: pointer; transition: all 0.2s; z-index: 10; }
        .setting-trigger:hover { border-color: var(--accent2); color: var(--accent2); transform: rotate(45deg); }
        
        /* CSS MENU MAPEL + ANIMATION */
        .menu-grid { max-width: 780px; margin: 30px auto; padding: 0 24px; display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 16px; }
        .paket-card { background: var(--card); border: 1px solid var(--border); padding: 24px; border-radius: 12px; cursor: pointer; display: flex; flex-direction: column; justify-content: center; min-height: 120px; position: relative; overflow: hidden; transform: translateY(0); transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); opacity: 0; animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .paket-card:hover { border-color: var(--accent); transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0,0,0,0.3); }
        .paket-card::after { content:''; position:absolute; bottom:0; left:0; height:3px; width:0; background:var(--accent); transition: width 0.3s ease; }
        .paket-card:hover::after { width:100%; }
        .paket-title { font-size: 16px; font-weight: 600; color: #fff; margin-bottom: 8px; }
        .paket-btn { align-self: flex-start; margin-top: 10px; font-size: 12px; color: var(--accent); font-family: 'Space Mono', monospace; transition: transform 0.2s; }
        .paket-card:hover .paket-btn { transform: translateX(4px); }
        .back-btn { background: rgba(255,255,255,0.05); border: 1px solid var(--border); color: var(--text); padding: 6px 12px; border-radius: 6px; font-size: 12px; cursor: pointer; margin-right: 15px; font-family: 'Sora'; transition: all 0.2s; }
        .back-btn:hover { background: rgba(255,255,255,0.1); border-color: var(--text); }

        /* KUIS & AREA SOAL */
        .controls { max-width: 780px; margin: 18px auto 0; padding: 0 24px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center; animation: fadeInUp 0.5s ease-out 0.1s forwards; opacity: 0; }
        .btn { padding: 8px 18px; border-radius: 6px; border: 1px solid var(--border); background: var(--card); color: var(--text); font-family: 'Sora', sans-serif; font-size: 13px; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
        .btn:hover { border-color: var(--accent); color: var(--accent); transform: translateY(-1px); }
        .btn:active { transform: translateY(1px); }
        .btn.primary { background: var(--accent); border-color: var(--accent); color: #051a10; font-weight: 700; }
        .btn.primary:hover { box-shadow: 0 0 12px rgba(52, 211, 153, 0.3); }
        .btn.danger { background: rgba(248,113,113,0.1); border-color: var(--wrong); color: var(--wrong); }
        .btn.danger:hover { background: var(--wrong); color: #fff; }
        .score-display { margin-left: auto; font-family: 'Space Mono', monospace; font-size: 13px; color: var(--accent2); }
        
        /* PROGRESS BAR FLOWING */
        .progress-bar-wrap { max-width: 780px; margin: 16px auto 0; padding: 0 24px; animation: fadeInUp 0.5s ease-out 0.15s forwards; opacity: 0; }
        .progress-info { display: flex; justify-content: space-between; font-size: 12px; color: var(--muted); margin-bottom: 6px; font-family: 'Space Mono', monospace; }
        .progress-track { height: 5px; background: var(--border); border-radius: 99px; overflow: hidden; }
        .progress-fill { height: 100%; background: var(--accent); border-radius: 99px; transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 0 8px var(--accent); }
        
        /* QUESTIONS PACK */
        .questions { max-width: 780px; margin: 28px auto 0; padding: 0 24px; display: flex; flex-direction: column; gap: 20px; }
        .q-card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; opacity: 0; animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; transition: border-color 0.3s, box-shadow 0.3s; }
        .q-card.unanswered { animation: pulseUnanswered 1.5s infinite; }
        .q-card.answered-correct { border-color: var(--correct); box-shadow: 0 0 15px rgba(74, 222, 128, 0.05); }
        .q-card.answered-wrong { border-color: var(--wrong); box-shadow: 0 0 15px rgba(248, 113, 113, 0.05); }
        .q-header { display: flex; align-items: center; gap: 10px; padding: 16px 20px 0; }
        .q-num { font-family: 'Space Mono', monospace; font-size: 11px; color: var(--muted); min-width: 28px; }
        .q-tag { font-size: 10px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; padding: 3px 8px; border-radius: 4px; }
        
        /* TAG COLOR SCHEMES */
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
        .tag-penjelajahan, .tag-pergerakan, .tag-perlawanan, .tag-kolonialisme, .tag-jepang, .tag-kemerdekaan {
  background: rgba(255, 6b, 103, 0.1);
  color: var(--tag-sejarah);
  border: 1px solid rgba(255, 6b, 103, 0.3);
}

.tag-keuangan, .tag-ekonomi, .tag-perdagangan {
  background: rgba(255, 165, 2, 0.1);
  color: var(--tag-ekonomi);
  border: 1px solid rgba(255, 165, 2, 0.3);
}

.tag-konflik, .tag-integrasi, .tag-pembangunan {
  background: rgba(46, 213, 115, 0.1);
  color: var(--tag-sosiologi);
  border: 1px solid rgba(46, 213, 115, 0.3);
}

.tag-penduduk {
  background: rgba(30, 144, 255, 0.1);
  color: var(--tag-geografi);
  border: 1px solid rgba(30, 144, 255, 0.3);
}
.tag-berpikir-komputasional {
  background: rgba(244, 63, 94, 0.12); color: var(--tag-komputasional); border: 1px solid rgba(244, 63, 94, 0.3);
}
.tag-algoritma {
  background: rgba(139, 92, 246, 0.12); color: var(--tag-algoritma); border: 1px solid rgba(139, 92, 246, 0.3);
}
.tag-scratch {
  background: rgba(14, 165, 233, 0.12); color: var(--tag-scratch); border: 1px solid rgba(14, 165, 233, 0.3);
}
.tag-blockly-games, .tag-pemrograman-visual {
  background: rgba(16, 185, 129, 0.12); color: var(--tag-blockly); border: 1px solid rgba(16, 185, 129, 0.3);
}

        .q-body { padding: 12px 20px 6px; }
        .q-text { font-size: 14.5px; line-height: 1.75; color: #ffffff; }
        .q-text .hl { font-family: 'Space Mono', monospace; background: rgba(52,211,153,0.1); color: var(--accent); padding: 1px 5px; border-radius: 3px; font-size: 12.5px; }
        .q-text .hl2 { font-family: 'Space Mono', monospace; background: rgba(251,191,36,0.1); color: var(--accent2); padding: 1px 5px; border-radius: 3px; font-size: 12.5px; }
        
        /* MICROINTERACTIONS OPTIONS */
        .options { padding: 10px 20px 18px; display: flex; flex-direction: column; gap: 8px; }
        .option { display: flex; align-items: flex-start; gap: 10px; padding: 11px 14px; border-radius: 8px; border: 1px solid var(--border); cursor: pointer; font-size: 13.5px; line-height: 1.55; background: transparent; text-align: left; width: 100%; color: #ffffff; transform: scale(1); transition: transform 0.1s, border-color 0.2s, background-color 0.2s; }
        .option:hover { border-color: var(--accent); background: rgba(52,211,153,0.04); }
        .option:active { transform: scale(0.985); }
        .option.selected { border-color: var(--accent); background: rgba(52,211,153,0.08); box-shadow: 0 0 10px rgba(52,211,153,0.05); }
        .option.correct { border-color: var(--correct) !important; background: rgba(74,222,128,0.12) !important; animation: pulseCorrect 0.5s ease-out; }
        .option.wrong { border-color: var(--wrong) !important; background: rgba(248,113,113,0.12) !important; }
        .option.reveal-correct { border-color: var(--correct) !important; background: rgba(74,222,128,0.06) !important; }
        .opt-letter { font-family: 'Space Mono', monospace; font-size: 12px; font-weight: 700; color: var(--muted); min-width: 18px; padding-top: 1px; transition: color 0.2s; }
        .option.selected .opt-letter { color: var(--accent); }
        .option.correct .opt-letter { color: var(--correct); }
        .option.wrong .opt-letter { color: var(--wrong); }
        
        /* PEMBAHASAN ACCORDION LOOK */
        .pembahasan { margin: 0 20px 16px; padding: 12px 14px; background: rgba(251,191,36,0.05); border-left: 3px solid var(--accent2); border-radius: 0 8px 8px 0; font-size: 12.5px; color: #c0a860; line-height: 1.7; display: none; opacity: 0; transform: translateY(5px); transition: all 0.3s ease-out; }
        .pembahasan.show { display: block; opacity: 1; transform: translateY(0); }
        .pembahasan strong { color: var(--accent2); }
        
        /* FOOTER AREA */
        .bottom-controls { max-width: 780px; margin: 28px auto 0; padding: 0 24px; animation: fadeInUp 0.5s ease-out; }
        .submit-box { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 20px 24px; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .submit-info { font-size: 13px; color: var(--muted); }
        .submit-info span { color: var(--text); font-weight: 600; }
        
        /* BOUNCY POP IN RESULT */
        .result-card { max-width: 780px; margin: 20px auto 0; padding: 0 24px; display: none; }
        .result-card.show { display: block; }
        .result-inner { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 30px; text-align: center; animation: popIn 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; box-shadow: 0 16px 32px rgba(0,0,0,0.4); }
        .result-score { font-family: 'Space Mono', monospace; font-size: 58px; font-weight: 700; color: var(--accent2); margin: 6px 0; text-shadow: 0 0 15px rgba(251, 191, 36, 0.2); }
        
        /* TOAST SLIDEOUT */
        .toast { position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%) translateY(80px); background: #111e17; border: 1px solid var(--accent); color: #a7f3d0; font-size: 13px; padding: 12px 22px; border-radius: 8px; z-index: 999; opacity: 0; pointer-events: none; box-shadow: 0 8px 20px rgba(0,0,0,0.4); transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.2s; }
        .toast.show { transform: translateX(-50%) translateY(0); opacity: 1; animation: slideToast 0.3s ease forwards; }
        
        /* NEON LOADER SPINNER */
        .loader-container { display: flex; flex-direction: column; align-items: center; justify-content: center; grid-column: 1 / -1; padding: 60px 0; gap: 15px; color: var(--muted); font-size: 13px; font-family: 'Space Mono', monospace; }
        .spinner { width: 32px; height: 32px; border: 3px solid rgba(52, 211, 153, 0.1); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; }

        /* MODAL */
        .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); display: flex; justify-content: center; align-items: center; z-index: 1000; padding: 15px; backdrop-filter: blur(4px); }
        .modal-content { background: var(--card); border: 1px solid var(--border); padding: 24px; border-radius: 12px; width: 100%; max-width: 460px; box-shadow: 0 20px 40px rgba(0,0,0,0.6); max-height: 90vh; overflow-y: auto; animation: popIn 0.3s cubic-bezier(0.34, 1.3, 0.64, 1); }
        .modal-content h3 { margin-bottom: 5px; font-size: 18px; color: #fff; }
        .modal-desc { font-size: 12px; color: var(--muted); margin-bottom: 16px; font-family: 'Space Mono', monospace; }
        .modal-input { width: 100%; padding: 10px 14px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; color: #fff; font-family: 'Sora', sans-serif; font-size: 14px; margin-bottom: 14px; transition: border-color 0.2s; }
        .modal-input:focus { border-color: var(--accent); outline: none; }
        .admin-section { border-top: 1px dashed var(--border); margin-top: 16px; padding-top: 16px; }
        .admin-section h4 { font-size: 13px; color: var(--accent2); margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px; }
        .admin-packet-item { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02); border: 1px solid var(--border); padding: 10px 14px; border-radius: 6px; margin-bottom: 8px; font-size: 13px; }
      
        /* === AI CHAT BUBBLE === */
        .ai-bubble-toggle { position: fixed; bottom: 28px; right: 24px; width: 54px; height: 54px; border-radius: 50%; background: linear-gradient(135deg, #34d399, #059669); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 22px; box-shadow: 0 4px 20px rgba(52, 211, 153, 0.4); z-index: 900; transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s; }
        .ai-bubble-toggle:hover { transform: scale(1.1); box-shadow: 0 6px 28px rgba(52, 211, 153, 0.6); }
        .ai-bubble-toggle.open { background: linear-gradient(135deg, #475569, #334155); box-shadow: 0 4px 16px rgba(0,0,0,0.4); }
        .ai-bubble-toggle .bubble-badge { position: absolute; top: -2px; right: -2px; width: 14px; height: 14px; background: var(--accent2); border-radius: 50%; border: 2px solid var(--bg); animation: pulseBadge 2s infinite; }
        @keyframes pulseBadge { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.2); } }

        .ai-chat-panel { position: fixed; bottom: 94px; right: 24px; width: 360px; max-width: calc(100vw - 32px); height: 480px; background: #0d1a14; border: 1px solid var(--accent); border-radius: 16px; display: flex; flex-direction: column; z-index: 900; box-shadow: 0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(52,211,153,0.1); overflow: hidden; animation: popIn 0.3s cubic-bezier(0.34, 1.3, 0.64, 1); }
        
        .ai-chat-header { background: linear-gradient(135deg, #081a12, #0d2018); padding: 14px 16px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
        .ai-chat-avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #34d399, #059669); display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
        .ai-chat-title { flex: 1; }
        .ai-chat-title strong { display: block; font-size: 13px; color: #fff; font-weight: 600; }
        .ai-chat-title span { font-size: 11px; color: var(--accent); font-family: 'Space Mono', monospace; }
        .ai-chat-close { background: none; border: none; color: var(--muted); font-size: 18px; cursor: pointer; padding: 2px 6px; border-radius: 4px; transition: color 0.2s; line-height: 1; }
        .ai-chat-close:hover { color: var(--text); }

        .ai-chat-messages { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px; scroll-behavior: smooth; }
        .ai-chat-messages::-webkit-scrollbar { width: 4px; }
        .ai-chat-messages::-webkit-scrollbar-track { background: transparent; }
        .ai-chat-messages::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }

        .chat-msg { max-width: 88%; display: flex; flex-direction: column; gap: 3px; animation: fadeInUp 0.2s ease-out; }
        .chat-msg.user { align-self: flex-end; align-items: flex-end; }
        .chat-msg.assistant { align-self: flex-start; align-items: flex-start; }
        .chat-bubble { padding: 10px 13px; border-radius: 12px; font-size: 13px; line-height: 1.6; word-break: break-word; }
        .chat-msg.user .chat-bubble { background: rgba(52, 211, 153, 0.15); border: 1px solid rgba(52, 211, 153, 0.25); color: #d1fae5; border-radius: 12px 12px 4px 12px; }
        .chat-msg.assistant .chat-bubble { background: rgba(255,255,255,0.05); border: 1px solid var(--border); color: var(--text); border-radius: 12px 12px 12px 4px; }
        .chat-role-label { font-size: 10px; color: var(--muted); font-family: 'Space Mono', monospace; letter-spacing: 0.5px; }

        .ai-chat-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: var(--muted); text-align: center; padding: 20px; }
        .ai-chat-empty .empty-icon { font-size: 32px; opacity: 0.5; }
        .ai-chat-empty p { font-size: 12px; line-height: 1.6; }
        .ai-chat-empty .suggestion-chips { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; width: 100%; }
        .suggestion-chip { background: rgba(52,211,153,0.07); border: 1px solid rgba(52,211,153,0.2); color: var(--accent); font-size: 11.5px; padding: 7px 12px; border-radius: 8px; cursor: pointer; text-align: left; transition: all 0.2s; font-family: 'Sora', sans-serif; }
        .suggestion-chip:hover { background: rgba(52,211,153,0.14); border-color: var(--accent); }

        .ai-chat-typing { display: flex; align-items: center; gap: 4px; padding: 10px 13px; }
        .typing-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); animation: typingBounce 1.2s infinite; }
        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes typingBounce { 0%, 60%, 100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-5px); opacity: 1; } }

        .ai-chat-input-area { padding: 12px; border-top: 1px solid var(--border); display: flex; gap: 8px; align-items: flex-end; flex-shrink: 0; background: rgba(0,0,0,0.2); }
        .ai-chat-textarea { flex: 1; background: rgba(255,255,255,0.04); border: 1px solid var(--border); border-radius: 10px; color: #fff; font-family: 'Sora', sans-serif; font-size: 13px; padding: 9px 12px; resize: none; min-height: 40px; max-height: 100px; line-height: 1.5; transition: border-color 0.2s; overflow-y: auto; }
        .ai-chat-textarea:focus { outline: none; border-color: var(--accent); }
        .ai-chat-textarea::placeholder { color: var(--muted); }
        .ai-send-btn { width: 36px; height: 36px; border-radius: 8px; background: var(--accent); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 15px; color: #051a10; flex-shrink: 0; transition: all 0.2s; font-weight: bold; }
        .ai-send-btn:hover:not(:disabled) { background: #6ee7b7; transform: scale(1.05); }
        .ai-send-btn:disabled { background: var(--border); color: var(--muted); cursor: not-allowed; transform: none; }
      `}</style>

      {/* HEADER DINAMIS */}
      <div className="header">
        <button className="setting-trigger" onClick={() => setShowModal(true)}>⚙️</button>
        <div className="header-inner">
          <div className="header-label">
            {!isMenuMode && <button className="back-btn" onClick={backToMenu}>← MENU</button>}
            Platform Latihan · SAT 2026
          </div>
          {isMenuMode ? (
            <>
              <h1>Pilih Paket Latihan<br /><span>Ujian SAT</span></h1>
              <p style={{ fontSize:'13.5px', color:'var(--muted)', marginTop:'6px' }}>Silakan pilih salah satu simulasi mata pelajaran di bawah ini.</p>
            </>
          ) : (
            <>
              <h1>{packetName.split('\n')[0]}<br /><span>{soal.length} Soal Pilihan Ganda</span></h1>
              <p style={{ fontSize:'13.5px', color:'var(--muted)', marginTop:'6px' }}>Hasil koreksi otomatis dan pembahasan lengkap akan terbuka di akhir kuis.</p>
            </>
          )}
        </div>
      </div>

      {/* WAJAH 1: MENU UTAMA (PILIHAN MAPEL) */}
      {isMenuMode && (
        <div className="menu-grid">
          {isLoading ? (
            <div className="loader-container">
              <div className="spinner"></div>
              <div>MENARIK DATA DARI SUPABASE...</div>
            </div>
          ) : packetsList.length === 0 ? (
            <div style={{ color: 'var(--muted)', textAlign: 'center', gridColumn: '1 / -1', padding: '40px', fontSize: '13.5px' }}>Belum ada paket kuis yang di-upload admin.</div>
          ) : (
            packetsList.map((paket, index) => (
              <div 
                className="paket-card" 
                key={paket.id} 
                onClick={() => loadQuizPacket(paket.id)}
                style={{ animationDelay: `${index * 0.06}s` }} // Efek meluncur berurutan
              >
                <div className="paket-title">{paket.packet_name}</div>
                <div className="paket-btn">Mulai Kuis ➔</div>
              </div>
            ))
          )}
        </div>
      )}

      {/* WAJAH 2: MODE KUIS (AREA SOAL) */}
      {!isMenuMode && (
        <>
          <div className="controls">
            <button className="btn" onClick={handleResetAll}>Reset Jawaban</button>
            {submitted && <div className="score-display">Skor: {score} / {soal.length} Benar</div>}
          </div>

          <div className="progress-bar-wrap">
            <div className="progress-info">
              <span>Progress Pengisian</span>
              <span>{answeredCount} / {soal.length} Selesai</span>
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
                <div 
                  className={`q-card ${cardStatusClass}`} 
                  id={`card-${qIndex}`} 
                  key={qIndex}
                  style={{ animationDelay: `${qIndex * 0.05}s` }} // Staggered loading untuk soal
                >
                  <div className="q-header">
                    <span className="q-num">{String(qIndex + 1).padStart(2, '0')}.</span>
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
                <div className="submit-info">Kamu sudah menjawab <span>{answeredCount}</span> dari <span>{soal.length}</span> soal</div>
                <button className="btn primary" onClick={handleCheckAll} disabled={submitted} style={{ opacity: submitted ? 0.4 : 1, cursor: submitted ? 'not-allowed' : 'pointer' }}>Periksa Hasil</button>
              </div>
            </div>
          )}

          <div className={`result-card ${submitted ? 'show' : ''}`} id="resultCard">
            <div className="result-inner">
              <div style={{ fontSize: '13px', color: 'var(--muted)', fontFamily:'Space Mono' }}>SKOR AKHIR SIMULASI</div>
              <div className="result-score">{score}</div>
              <div style={{ fontSize:'14px', fontWeight:'600', marginBottom:'12px' }}>Koreksi: {score} Benar & {soal.length - score} Salah</div>
              <div style={{ fontSize:'13px', color:'var(--accent)', lineHeight:'1.6', maxWidth:'500px', margin:'0 auto' }}>{submitted && getTierDescription()}</div>
            </div>
          </div>
        </>
      )}

      {/* SYSTEM TOAST & ADMIN MODAL PANELS */}
      <div className={`toast ${showToast ? 'show' : ''}`}>{toastMsg}</div>
      
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{isAdmin ? '⚙️ Admin Dashboard' : '🔒 Akses Enkripsi Admin'}</h3>
            <div className="modal-desc">Device Authenticated ID: {deviceId}</div>
            
            {!isAdmin ? (
              <div>
                <input type="password" placeholder="Masukkan Sandi Kunci Admin..." className="modal-input" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} />
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button className="btn primary" onClick={handleLoginAdmin}>Otorisasi</button>
                  <button className="btn" onClick={() => setShowModal(false)}>Batal</button>
                </div>
              </div>
            ) : (
              <div>
                <div className="admin-section" style={{ marginTop: '0', paddingTop: '0', borderTop: 'none' }}>
                  <h4>1. Inject Paket Baru (.json)</h4>
                  <input type="text" placeholder="Nama Mata Pelajaran (Contoh: SAT Sejarah)" className="modal-input" value={newPacketName} onChange={(e) => setNewPacketName(e.target.value)} />
                  <input type="file" accept=".json" className="modal-input" onChange={handleFileUpload} style={{ padding: '6px' }} />
                  <button className="btn primary" style={{ width: '100%', marginTop: '5px' }} onClick={handleSaveNewPacket}>Unggah ke Database</button>
                </div>
                
                <div className="admin-section">
                  <h4>2. Wipe/Hapus Paket Aktif</h4>
                  {packetsList.length === 0 ? <p style={{ fontSize: '12px', color: 'var(--muted)' }}>Belum ada paket terdeteksi.</p> : (
                    packetsList.map(p => (
                      <div className="admin-packet-item" key={p.id}>
                        <span>{p.packet_name}</span>
                        <button className="btn danger" style={{ padding: '4px 10px', fontSize: '11px' }} onClick={() => handleDeletePacket(p.id)}>Hapus</button>
                      </div>
                    ))
                  )}
                </div>

                <div style={{ marginTop: '20px' }}>
                  <button className="btn" style={{ width: '100%' }} onClick={() => setShowModal(false)}>Keluar Panel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* === AI FLOATING CHAT BUBBLE (hanya muncul di mode kuis) === */}
      {!isMenuMode && (
        <>
          {/* Panel Chat */}
          {isChatOpen && (
            <div className="ai-chat-panel">
              {/* Header */}
              <div className="ai-chat-header">
                <div className="ai-chat-avatar">🤖</div>
                <div className="ai-chat-title">
                  <strong>Asisten Belajar AI</strong>
                  <span>● Online · Tanya apa aja soal materi</span>
                </div>
                <button className="ai-chat-close" onClick={() => setIsChatOpen(false)}>✕</button>
              </div>

              {/* Pesan */}
              <div className="ai-chat-messages">
                {messages.length === 0 ? (
                  <div className="ai-chat-empty">
                    <div className="empty-icon">💬</div>
                    <p>Halo! Aku AI yang bisa bantu kamu memahami materi di paket soal ini.<br />Tanya apa aja!</p>
                    <div className="suggestion-chips">
                      {[
                        '📖 Jelaskan konsep utama di soal ini',
                        '❓ Aku bingung soal nomor 1, bantu dong',
                        '💡 Tips mengerjakan soal ini?',
                      ].map((chip) => (
                        <button
                          key={chip}
                          className="suggestion-chip"
                          onClick={() => {
                            handleInputChange({ target: { value: chip.slice(3) } });
                          }}
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map((msg) => (
                      <div key={msg.id} className={`chat-msg ${msg.role}`}>
                        <span className="chat-role-label">
                          {msg.role === 'user' ? 'Kamu' : '🤖 AI'}
                        </span>
                        <div className="chat-bubble">
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    {isChatLoading && (
                      <div className="chat-msg assistant">
                        <span className="chat-role-label">🤖 AI</span>
                        <div className="chat-bubble">
                          <div className="ai-chat-typing">
                            <div className="typing-dot"></div>
                            <div className="typing-dot"></div>
                            <div className="typing-dot"></div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input Area */}
              <form
                className="ai-chat-input-area"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!input.trim() || isChatLoading) return;
                  handleSubmit(e);
                }}
              >
                <textarea
                  className="ai-chat-textarea"
                  placeholder="Tanya tentang materi soal ini..."
                  value={input}
                  onChange={handleInputChange}
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (!input.trim() || isChatLoading) return;
                      handleSubmit(e);
                    }
                  }}
                />
                <button
                  type="submit"
                  className="ai-send-btn"
                  disabled={!input.trim() || isChatLoading}
                  title="Kirim (Enter)"
                >
                  ➤
                </button>
              </form>
            </div>
          )}

          {/* Tombol Bubble Floating */}
          <button
            className={`ai-bubble-toggle ${isChatOpen ? 'open' : ''}`}
            onClick={() => setIsChatOpen(v => !v)}
            title={isChatOpen ? 'Tutup chat AI' : 'Buka asisten AI'}
          >
            {isChatOpen ? '✕' : '🤖'}
            {!isChatOpen && messages.length === 0 && (
              <span className="bubble-badge" />
            )}
          </button>
        </>
      )}
    </>
  );
}
