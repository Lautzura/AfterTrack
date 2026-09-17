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
  const type  = searchParams.get("type");   // "search" | "album" | "artist" | "audiofeatures" | "recommendations"
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

    // ── Detalle de un álbum (portada HD + tracklist + metadata rica) ─────────
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
        spotifyId:  t.id,
      }));

      // Preview del álbum = primera canción con preview
      const previewUrl = tracklist.find(t => t.previewUrl)?.previewUrl || null;

      // Duración total en milisegundos
      const totalDurationMs = tracklist.reduce((sum, t) => sum + (t.length || 0), 0);

      return Response.json({
        coverUrl,
        previewUrl,
        tracklist,
        genres:       album.genres || [],
        label:        album.label  || null,
        spotifyUrl:   album.external_urls?.spotify || null,
        popularity:   album.popularity ?? null,        // 0-100
        total_tracks: album.total_tracks ?? tracklist.length,
        release_date: album.release_date || null,      // "YYYY-MM-DD" o "YYYY"
        totalDurationMs,
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

    // ── Audio features de un álbum (energy, danceability, valence, tempo) ───
    if (type === "audiofeatures") {
      if (!id) return Response.json({ error: "Falta id" }, { status: 400 });
      // id = comma-separated list of track IDs, OR single album ID
      // If it's a single ID we first get the album tracks then fetch features
      let trackIds = id.includes(",") ? id.split(",") : null;

      if (!trackIds) {
        // Single album ID — get tracks first
        const tracksRes = await fetch(
          `https://api.spotify.com/v1/albums/${id}/tracks?limit=50&market=AR`,
          { headers }
        );
        const tracksData = await tracksRes.json();
        trackIds = (tracksData.items || []).map(t => t.id).filter(Boolean);
      }

      if (trackIds.length === 0) return Response.json({ features: {} });

      // Spotify allows max 100 ids per request
      const chunks = [];
      for (let i = 0; i < trackIds.length; i += 100) {
        chunks.push(trackIds.slice(i, i + 100));
      }

      const allFeatures = {};
      for (const chunk of chunks) {
        const featRes = await fetch(
          `https://api.spotify.com/v1/audio-features?ids=${chunk.join(",")}`,
          { headers }
        );
        const featData = await featRes.json();
        (featData.audio_features || []).forEach(f => {
          if (f && f.id) {
            allFeatures[f.id] = {
              energy:      f.energy ?? null,       // 0.0 – 1.0
              danceability:f.danceability ?? null, // 0.0 – 1.0
              valence:     f.valence ?? null,      // 0.0 – 1.0 (happyness)
              tempo:       f.tempo ?? null,        // BPM
              acousticness:f.acousticness ?? null,
            };
          }
        });
      }

      return Response.json({ features: allFeatures });
    }

    // ── Recomendaciones basadas en géneros y artistas ────────────────────────
    if (type === "recommendations") {
      // q = comma-separated genre seeds (e.g. "rock,indie")
      // id = comma-separated artist IDs (optional, e.g. "4Z8W4fKeB5YxbusRsdQVPb")
      const genres  = (query || "").split(",").map(g => g.trim().toLowerCase()).filter(Boolean).slice(0, 3);
      const artists = (id    || "").split(",").map(a => a.trim()).filter(Boolean).slice(0, 2);

      if (genres.length === 0 && artists.length === 0) {
        return Response.json({ albums: [] });
      }

      // Spotify genre seeds must match their official list — map common ones
      const GENRE_MAP = {
        "hip-hop":"hip-hop", "electronica":"electronic", "clasica":"classical",
        "alternativo":"alternative", "folk":"folk", "soul":"soul", "ambient":"ambient",
        "punk":"punk", "reggae":"reggaeton", "metal":"metal", "indie":"indie",
        "jazz":"jazz", "rock":"rock", "pop":"pop",
      };
      const seedGenres  = genres.map(g => GENRE_MAP[g] || g).slice(0, 3);
      const seedArtists = artists.slice(0, 2);

      const params = new URLSearchParams({ limit: "20", market: "AR" });
      if (seedGenres.length)  params.set("seed_genres",  seedGenres.join(","));
      if (seedArtists.length) params.set("seed_artists", seedArtists.join(","));

      const recRes  = await fetch(
        `https://api.spotify.com/v1/recommendations?${params}`,
        { headers }
      );
      const recData = await recRes.json();

      // Recommendations returns tracks — get unique album IDs
      const trackItems = recData.tracks || [];
      const seenAlbums = new Set();
      const albums = [];

      for (const track of trackItems) {
        const a = track.album;
        if (!a || seenAlbums.has(a.id)) continue;
        seenAlbums.add(a.id);
        albums.push({
          spotifyId: a.id,
          mbid:      a.id,
          title:     a.name,
          artist:    a.artists?.[0]?.name || "Desconocido",
          year:      a.release_date?.slice(0, 4) || "—",
          cover:     a.images?.[0]?.url || null,
          spotifyUrl:a.external_urls?.spotify || null,
        });
      }

      return Response.json({ albums: albums.slice(0, 10) });
    }

    return Response.json({ error: "Tipo no válido" }, { status: 400 });
  } catch (err) {
    console.error("Spotify API error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
