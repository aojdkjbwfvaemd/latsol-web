import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const { deviceId, password, action } = await request.json();

    if (!deviceId) return NextResponse.json({ success: false, message: 'Device ID dibutuhkan' }, { status: 400 });

    if (action === 'login') {
      if (password === process.env.ADMIN_PASSWORD) {
        await supabase.from('authenticated_devices').upsert([{ device_id: deviceId }]);
        return NextResponse.json({ success: true, message: 'Akses diterima!' });
      }
      return NextResponse.json({ success: false, message: 'Password salah!' }, { status: 401 });
    }

    if (action === 'check') {
      const { data } = await supabase
        .from('authenticated_devices')
        .select('device_id')
        .eq('device_id', deviceId)
        .maybeSingle();

      return NextResponse.json({ isAuth: !!data });
    }

    return NextResponse.json({ success: false, message: 'Aksi tidak valid' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
