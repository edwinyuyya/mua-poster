'use client';

export default function QrPrintButton() {
  return (
    <div className="between no-print" style={{ marginBottom: 12 }}>
      <button className="btn btn-brand" onClick={() => window.print()}>🖨️ Cetak QR Meja</button>
      <button className="btn" onClick={() => window.history.back()}>Kembali</button>
    </div>
  );
}
