'use client';

import { useState } from 'react';

export default function PrintControls({ jobId }) {
  const [done, setDone] = useState(false);

  async function printNow() {
    window.print();
    // Tandai print job selesai (sekali, setelah dialog cetak dibuka)
    if (jobId && !done) {
      setDone(true);
      try {
        await fetch(`/api/print-jobs/${jobId}`, { method: 'PATCH' });
      } catch {}
    }
  }

  return (
    <div className="between no-print">
      <button className="btn btn-brand" onClick={printNow}>🖨️ Cetak Sekarang</button>
      {done && <span className="badge badge-green">Ditandai dicetak</span>}
      <button className="btn" onClick={() => window.close()}>Tutup</button>
    </div>
  );
}
