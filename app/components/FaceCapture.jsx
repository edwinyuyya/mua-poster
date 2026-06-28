'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Modal kamera untuk ambil foto wajah (selfie) sebagai bukti keamanan.
// onCapture(dataUrl) dipanggil saat foto diambil; onCancel() saat batal.
// Foto dikompres kecil (~lebar 320px, JPEG) agar hemat penyimpanan.
export default function FaceCapture({ open, title = 'Ambil Foto Wajah', onCapture, onCancel }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [err, setErr] = useState('');
  const [ready, setReady] = useState(false);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setReady(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setErr('');
    setReady(false);
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setReady(true);
      } catch (e) {
        setErr('Kamera tidak bisa diakses. Pastikan izin kamera diaktifkan & buka via HTTPS.');
      }
    })();
    return () => { cancelled = true; stop(); };
  }, [open, stop]);

  function snap() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const w = 320;
    const h = Math.round((v.videoHeight / v.videoWidth) * w) || 240;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(v, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.55);
    stop();
    onCapture?.(dataUrl);
  }

  function cancel() { stop(); onCancel?.(); }

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div className="card" style={{ maxWidth: 380, width: '100%', textAlign: 'center' }}>
        <div className="h2" style={{ marginBottom: 8 }}>📸 {title}</div>
        {err ? (
          <p className="small" style={{ color: '#ff8585' }}>{err}</p>
        ) : (
          <div style={{ position: 'relative' }}>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              ref={videoRef} playsInline muted
              style={{ width: '100%', borderRadius: 12, background: '#000', transform: 'scaleX(-1)' }}
            />
            {!ready && <p className="muted small">Menyalakan kamera…</p>}
          </div>
        )}
        <div className="row" style={{ marginTop: 12, justifyContent: 'center' }}>
          <button className="btn" onClick={cancel}>Batal</button>
          <button className="btn btn-brand" disabled={!ready || !!err} onClick={snap}>Ambil Foto</button>
        </div>
        <p className="muted small" style={{ marginTop: 8 }}>Foto disimpan sebagai bukti keamanan.</p>
      </div>
    </div>
  );
}
