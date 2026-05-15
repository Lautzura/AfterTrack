// spinrate/src/app/api/spotify/route.js
// Maneja autenticación y búsquedas con la API de Spotify
 
const CLIENT_ID     = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
 
let cachedToken = null;
let tokenExpiry  = 0;
 
async function getToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
    },
    body: "grant_type=client_credentials",
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("No se pudo obtener token de Spotify");
  cachedToken = data.access_token;
  tokenExpiry  = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}
 
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const type  = searchParams.get("type");   // "search" | "album" | "artist"
  const query = searchParams.get("q");
  const id    = searchParams.get("id");
 
  try {
    const token = await getToken();
    const headers = { Authorization: `Bearer ${token}` };
 
    // ── Búsqueda de álbumes ──────────────────────────────────────────────────
    if (type === "search") {
      if (!query) return Response.json({ error: "Falta query" }, { status: 400 });
      const res  = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=album&limit=8&market=AR`,
        { headers }
      );
      const data = await res.json();
      const albums = (data.albums?.items || []).map(a => ({
        spotifyId: a.id,
        mbid:      a.id,           // usamos spotifyId como mbid para compatibilidad
        title:     a.name,
        artist:    a.artists?.[0]?.name || "Desconocido",
        year:      a.release_date?.slice(0, 4) || "—",
        cover:     a.images?.[0]?.url || null,
        spotifyUrl:a.external_urls?.spotify || null,
      }));
      return Response.json({ albums });
    }
 
    // ── Detalle de un álbum (portada HD + tracklist) ─────────────────────────
    if (type === "album") {
      if (!id) return Response.json({ error: "Falta id" }, { status: 400 });
      const [albumRes, tracksRes] = await Promise.all([
        fetch(`https://api.spotify.com/v1/albums/${id}?market=AR`, { headers }),
        fetch(`https://api.spotify.com/v1/albums/${id}/tracks?limit=50&market=AR`, { headers }),
      ]);
      const album  = await albumRes.json();
      const tracks = await tracksRes.json();
 
      const coverUrl = album.images?.[0]?.url || null;
      const tracklist = (tracks.items || []).map((t, i) => ({
        number:     t.track_number || i + 1,
        title:      t.name,
        length:     t.duration_ms,
        previewUrl: t.preview_url || null,
        spotifyUrl: t.external_urls?.spotify || null,
      }));
 
      // Preview del álbum = primera canción con preview
      const previewUrl = tracklist.find(t => t.previewUrl)?.previewUrl || null;
 
      return Response.json({
        coverUrl,
        previewUrl,
        tracklist,
        genres:    album.genres || [],
        label:     album.label  || null,
        spotifyUrl:album.external_urls?.spotify || null,
      });
    }
 
    // ── Álbumes de un artista ────────────────────────────────────────────────
    if (type === "artist") {
      if (!query) return Response.json({ error: "Falta query" }, { status: 400 });
      // Primero buscar el artista
      const searchRes  = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=artist&limit=1&market=AR`,
        { headers }
      );
      const searchData = await searchRes.json();
      const artist     = searchData.artists?.items?.[0];
      if (!artist) return Response.json({ albums: [], artistInfo: null });
 
      const albumsRes  = await fetch(
        `https://api.spotify.com/v1/artists/${artist.id}/albums?include_groups=album,single&limit=20&market=AR`,
        { headers }
      );
      const albumsData = await albumsRes.json();
      const albums = (albumsData.items || []).map(a => ({
        spotifyId: a.id,
        mbid:      a.id,
        title:     a.name,
        artist:    a.artists?.[0]?.name || query,
        year:      a.release_date?.slice(0, 4) || "—",
        cover:     a.images?.[0]?.url || null,
      }));
 
      return Response.json({
        albums,
        artistInfo: {
          id:         artist.id,
          name:       artist.name,
          image:      artist.images?.[0]?.url || null,
          genres:     artist.genres || [],
          followers:  artist.followers?.total || 0,
          spotifyUrl: artist.external_urls?.spotify || null,
        },
      });
    }
 
    return Response.json({ error: "Tipo no válido" }, { status: 400 });
  } catch (err) {
    console.error("Spotify API error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
