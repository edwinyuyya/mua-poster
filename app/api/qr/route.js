import QRCode from 'qrcode';

export const dynamic = 'force-dynamic';

// GET /api/qr?data=...&size=300 -> PNG QR code
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const data = searchParams.get('data');
  const size = Math.min(800, Math.max(120, parseInt(searchParams.get('size') || '300', 10)));
  if (!data) return new Response('missing data', { status: 400 });

  const buf = await QRCode.toBuffer(data, { width: size, margin: 1 });
  return new Response(buf, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
