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
    const action = searchParams.get('action');
    const id = searchParams.get('id');

    // Minta Daftar Nama Paket (Untuk Tampilan Depan)
    if (action === 'list') {
      const { data } = await supabase.from('quiz_packets').select('id, packet_name').order('id', { ascending: false });
      return NextResponse.json(data || []);
    }

    // Minta Isi Soal Berdasarkan Paket yang Dipilih
    if (action === 'get' && id) {
      const { data } = await supabase.from('quiz_packets').select('packet_name, questions_data').eq('id', id).maybeSingle();
      return NextResponse.json(data || null);
    }

    return NextResponse.json({ message: 'Action not valid' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { deviceId, packetName, jsonData } = await request.json();
    const authorized = await checkAdmin(deviceId);
    if (!authorized) return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });

    if (!Array.isArray(jsonData)) return NextResponse.json({ message: 'Format JSON harus Array' }, { status: 400 });

    const { error } = await supabase.from('quiz_packets').insert([
      { packet_name: packetName, questions_data: jsonData }
    ]);

    if (error) throw error;
    return NextResponse.json({ success: true, message: 'Paket berhasil ditambahkan ke database!' });
  } catch (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

// Fitur Baru: Hapus Paket (Khusus Admin)
export async function DELETE(request) {
  try {
    const { deviceId, packetId } = await request.json();
    const authorized = await checkAdmin(deviceId);
    if (!authorized) return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });

    await supabase.from('quiz_packets').delete().eq('id', packetId);
    return NextResponse.json({ success: true, message: 'Paket berhasil dihapus!' });
  } catch (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
