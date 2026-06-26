import './globals.css';

export const metadata = {
  title: 'F&B Order System',
  description: 'Sistem order F&B via QR meja, bayar QRIS / kasir, dengan routing cetak dapur per station.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
