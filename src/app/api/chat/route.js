import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

export const runtime = 'edge';

export async function POST(request) {
  try {
    const { messages, quizContext } = await request.json();

    const systemPrompt = `Kamu adalah asisten belajar AI yang cerdas dan ramah untuk platform latihan soal SAT. Tugasmu adalah membantu siswa memahami materi pelajaran, menjelaskan konsep, dan menjawab pertanyaan seputar soal latihan. Gunakan gaya bahasa yang tidak kaku seperti mengobrol dengan teman gen z. kamu boleh menyindir atau menggunakan kata kata slank agar siswa lebih termotivasi untuk menanyakan pertanyaan. jawab seperti kamu adalah teman tongkrongannya.

Panduan perilaku:
- Jawab dalam Bahasa Indonesia yang jelas dan mudah dipahami boleh menggunakan slank
- Jangan langsung memberikan jawaban soal kuis jika belum dikerjakan — dorong siswa untuk berpikir dulu
- Berikan penjelasan konsep yang mendalam namun ringkas
- Gunakan analogi atau contoh nyata jika membantu pemahaman
- Bersikap supportif, motivatif dan menyindir jika perlu untuk meningkatkan kemauan untuk belajar lagi

${quizContext ? `
=== KONTEKS PAKET SOAL AKTIF ===
Siswa sedang mengerjakan paket soal berikut. Gunakan informasi ini sebagai referensi jika siswa bertanya tentang soal atau materi tertentu:

${quizContext}
=== AKHIR KONTEKS ===
` : 'Siswa belum memilih paket soal.'}

Jika siswa bertanya tentang soal spesifik, kamu bisa merujuk ke konteks di atas. Jangan langsung bocorkan jawaban — bimbing siswa dengan penjelasan konsep yang relevan.`;

    const result = streamText({
      model: anthropic('claude-haiku-4-5-20251001'),
      system: systemPrompt,
      messages,
      maxTokens: 1024,
    });

    return result.toDataStreamResponse();
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Gagal menghubungi AI. Periksa ANTHROPIC_API_KEY kamu.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
