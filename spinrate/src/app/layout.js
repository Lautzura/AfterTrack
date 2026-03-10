export const metadata = {
  title: 'Aftertrack',
  description: 'Reseñas musicales con tus amigos',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
