import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAdmin(deviceId) {
  if (!deviceId) return false;
  const { data } = await supabase.from('authenticated_devices').select('device_id').eq('device_id', deviceId).maybeSingle();
  return !!data;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');
    const isAdminMode = searchParams.get('admin') === 'true';

    if (isAdminMode) {
      const authorized = await checkAdmin(deviceId);
      if (!authorized) return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
      
      const { data } = await supabase.from('quiz_packets').select('id, packet_name, is_active').order('id', { ascending: false });
      return NextResponse.json({ packets: data });
    }

    const { data } = await supabase.from('quiz_packets').select('packet_name, questions_data').eq('is_active', true).maybeSingle();
    return NextResponse.json(data || { packet_name: "Kosong", questions_data: [] });
  } catch (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { deviceId, packetName, jsonData } = await request.json();
    const authorized = await checkAdmin(deviceId);
    if (!authorized) return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });

    if (!Array.isArray(jsonData)) return NextResponse.json({ message: 'Format JSON harus berupa Array' }, { status: 400 });
    
    for (let item of jsonData) {
      if (!item.id || !item.tag || !item.tagLabel || !item.soal || !Array.isArray(item.opsi) || item.jawaban === undefined || !item.pembahasan) {
        return NextResponse.json({ message: `Struktur salah pada item ID: ${item.id || 'Unknown'}. Pastikan memiliki komponen: id, tag, tagLabel, soal, opsi (array), jawaban (0-3), pembahasan.` }, { status: 400 });
      }
      if (item.opsi.length !== 4) return NextResponse.json({ message: `ID ${item.id} harus memiliki tepat 4 opsi jawaban.` }, { status: 400 });
    }

    await supabase.from('quiz_packets').update({ is_active: false }).eq('is_active', true);

    // Masukkan paket soal baru dan langsung jadikan aktif
    const { data, error } = await supabase.from('quiz_packets').insert([
      { packet_name: packetName, questions_data: jsonData, is_active: true }
    ]);

    return NextResponse.json({ success: true, message: 'Paket baru berhasil disimpan dan diaktifkan!' });
  } catch (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { deviceId, packetId } = await request.json();
    const authorized = await checkAdmin(deviceId);
    if (!authorized) return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });

    await supabase.from('quiz_packets').update({ is_active: false }).eq('is_active', true);
    await supabase.from('quiz_packets').update({ is_active: true }).eq('id', packetId);

    return NextResponse.json({ success: true, message: 'Paket soal berhasil diganti!' });
  } catch (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
