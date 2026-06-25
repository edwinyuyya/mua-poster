'use client';

import { useEffect, useRef, useState } from 'react';

// Scanner barcode pakai BarcodeDetector bawaan browser (didukung Chrome Android).
export default function BarcodeScanner({ onDetected, onClose }) {
  const videoRef = useRef(null);
  const [err, setErr] = useState('');
  const supported = typeof window !== 'undefined' && 'BarcodeDetector' in window;

  useEffect(() => {
    if (!supported) { setErr('Browser ini tidak mendukung scan barcode. Pakai input manual / Chrome di Android.'); return; }
    let stream, raf, stop = false;
    const detector = new window.BarcodeDetector({
      formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code'],
    });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        const v = videoRef.current;
        v.srcObject = stream;
        await v.play();
        const tick = async () => {
          if (stop) return;
          try {
            const codes = await detector.detect(v);
            if (codes && codes.length) { onDetected(codes[0].rawValue); return; }
          } catch {}
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        setErr('Tidak bisa membuka kamera. Izinkan akses kamera.');
      }
    })();
    return () => {
      stop = true;
      if (raf) cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [supported, onDetected]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.9)', zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="card" style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
        <div className="between"><div className="h2">Scan Barcode</div><button className="btn" onClick={onClose}>Tutup</button></div>
        {err ? (
          <p className="muted small" style={{ marginTop: 10 }}>{err}</p>
        ) : (
          <video ref={videoRef} style={{ width: '100%', borderRadius: 10, marginTop: 10, background: '#000' }} muted playsInline />
        )}
        <p className="muted small" style={{ marginTop: 8 }}>Arahkan kamera ke barcode barang.</p>
      </div>
    </div>
  );
}
