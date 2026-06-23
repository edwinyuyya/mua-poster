// app/api/caption/route.js
export async function POST(request) {
  const { title, tone, extra, accountName } = await request.json();

  const prompt = `Kamu adalah ahli copywriting Instagram viral untuk audiens Indonesia.

Buat caption Instagram untuk akun MUA (Makeup Artist) bernama "${accountName}":
- Tema: "${title}"
- Tone: ${tone}
${extra ? `- Konteks: ${extra}` : ''}

Aturan:
1. Hook kuat kalimat pertama (stop scrolling)
2. Body 3-5 kalimat engaging
3. Call to action natural
4. 15-20 hashtag MUA Indonesia (populer + niche)
5. 2-3 emoji relevan, tidak lebay
6. Max 2200 karakter

Langsung tulis caption tanpa kata pengantar.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await res.json();

    // Kalau API balikin error, tampilkan pesannya biar gampang debug
    if (!res.ok) {
      const msg = data?.error?.message || `API error (status ${res.status})`;
      return Response.json({ error: msg }, { status: 500 });
    }

    const caption = data?.content?.[0]?.text;
    if (!caption) {
      return Response.json({ error: 'Caption kosong dari API' }, { status: 500 });
    }

    return Response.json({ caption });
  } catch (e) {
    return Response.json({ error: e.message || 'Gagal menghubungi API' }, { status: 500 });
  }
}
