// spinrate/src/app/api/deezer/route.js
// Busca previews de canciones usando la API pública de Deezer (sin auth)

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const track  = searchParams.get("track");
  const artist = searchParams.get("artist");

  if (!track) return Response.json({ error: "Falta track" }, { status: 400 });

  try {
    const query = artist ? `${track} ${artist}` : track;
    const res = await fetch(
      `https://api.deezer.com/search/track?q=${encodeURIComponent(query)}&limit=5`,
      { headers: { "Accept": "application/json" } }
    );
    const data = await res.json();
    const results = (data.data || []);

    // Buscar el track que mejor coincida por nombre
    const match = results.find(t =>
      t.title?.toLowerCase().includes(track.toLowerCase()) ||
      track.toLowerCase().includes(t.title?.toLowerCase())
    ) || results[0];

    if (!match?.preview) {
      return Response.json({ previewUrl: null });
    }

    return Response.json({
      previewUrl: match.preview,
      title: match.title,
      artist: match.artist?.name,
      duration: match.duration,
    });
  } catch (err) {
    console.error("Deezer API error:", err);
    return Response.json({ previewUrl: null });
  }
}
