// app/api/cron/route.js
// Vercel Cron memanggil endpoint ini setiap 1 menit otomatis
// Cek antrian post yang sudah waktunya → posting ke Instagram

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function postToInstagram(igUserId, token, imageUrl, caption) {
  // Step 1: Buat media container
  const createRes = await fetch(
    `https://graph.instagram.com/v18.0/${igUserId}/media`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: imageUrl, caption, access_token: token }),
    }
  );
  const createData = await createRes.json();
  if (!createData.id) throw new Error(createData.error?.message || 'Gagal buat container IG');

  // Step 2: Publish
  const pubRes = await fetch(
    `https://graph.instagram.com/v18.0/${igUserId}/media_publish`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: createData.id, access_token: token }),
    }
  );
  const pubData = await pubRes.json();
  if (!pubData.id) throw new Error(pubData.error?.message || 'Gagal publish ke IG');
  return pubData.id;
}

export async function GET(request) {
  // Verifikasi request dari Vercel Cron (keamanan)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date().toISOString();

  // Ambil semua post yang sudah waktunya & masih pending
  const { data: duePosts, error } = await supabase
    .from('queue')
    .select('*, accounts(ig_user_id, token)')
    .eq('status', 'pending')
    .lte('schedule_at', now)
    .limit(10); // max 10 post per menit

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!duePosts || duePosts.length === 0) {
    return Response.json({ message: 'Tidak ada post yang perlu dipublish', checked_at: now });
  }

  const results = [];

  for (const post of duePosts) {
    // Tandai sebagai "sedang posting" dulu
    await supabase.from('queue').update({ status: 'posting' }).eq('id', post.id);

    try {
      const igUserId = post.accounts?.ig_user_id;
      const token    = post.accounts?.token;

      if (!igUserId || !token) throw new Error('Data akun tidak lengkap');

      const postId = await postToInstagram(igUserId, token, post.image_url, post.caption);

      // Berhasil → update status done
      await supabase.from('queue').update({
        status: 'done',
        post_id: postId,
        done_at: new Date().toISOString(),
      }).eq('id', post.id);

      results.push({ id: post.id, account: post.account_name, status: 'done', postId });

    } catch (e) {
      // Gagal → update status failed
      await supabase.from('queue').update({
        status: 'failed',
        error_msg: e.message,
      }).eq('id', post.id);

      results.push({ id: post.id, account: post.account_name, status: 'failed', error: e.message });
    }
  }

  return Response.json({ processed: results.length, results });
}
