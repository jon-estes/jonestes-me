exports.handler = async function(event) {
  const { query } = event.queryStringParameters || {};
  const key = process.env.GOOGLE_PLACES_KEY;

  if (!query) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing query' }) };
  }
  if (!key) {
    return { statusCode: 500, body: JSON.stringify({ error: 'GOOGLE_PLACES_KEY env var not set in Netlify' }) };
  }

  try {
    // Step 1: Text search to get place IDs
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${key}`;
    const searchResp = await fetch(searchUrl);
    const searchData = await searchResp.json();

    if (searchData.status !== 'OK' && searchData.status !== 'ZERO_RESULTS') {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(searchData),
      };
    }

    // Step 2: For each result, fetch Place Details to get website
    const results = await Promise.all(
      (searchData.results || []).slice(0, 20).map(async (place) => {
        try {
          const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_address,rating,user_ratings_total,website,place_id&key=${key}`;
          const detailResp = await fetch(detailUrl);
          const detailData = await detailResp.json();
          const d = detailData.result || {};
          return {
            name: d.name || place.name,
            formatted_address: d.formatted_address || place.formatted_address,
            rating: d.rating || place.rating,
            user_ratings_total: d.user_ratings_total || place.user_ratings_total,
            website: d.website || null,
            place_id: place.place_id,
          };
        } catch (e) {
          // If detail call fails, return the basic result with no website
          return { ...place, website: null };
        }
      })
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ status: 'OK', results }),
    };

  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
