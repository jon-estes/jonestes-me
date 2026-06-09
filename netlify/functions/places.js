exports.handler = async function(event) {
  const { query, pagetoken } = event.queryStringParameters || {};
  const key = process.env.GOOGLE_PLACES_KEY;

  if (!key) {
    return { statusCode: 500, body: JSON.stringify({ error: 'GOOGLE_PLACES_KEY env var not set' }) };
  }
  if (!query && !pagetoken) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing query or pagetoken' }) };
  }

  try {
    const searchUrl = pagetoken
      ? `https://maps.googleapis.com/maps/api/place/textsearch/json?pagetoken=${encodeURIComponent(pagetoken)}&key=${key}`
      : `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${key}`;

    // For pagetoken calls, retry up to 4 times if Google returns INVALID_REQUEST
    // (token activation is async on Google's side and can take up to ~10s)
    let data;
    const maxAttempts = pagetoken ? 4 : 1;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const resp = await fetch(searchUrl);
      data = await resp.json();
      console.log(`Attempt ${attempt} status:`, data.status, '| results:', data.results?.length, '| next token:', !!data.next_page_token);
      if (data.status !== 'INVALID_REQUEST') break;
      if (attempt < maxAttempts) {
        console.log(`INVALID_REQUEST on attempt ${attempt}, retrying in 3s...`);
        await new Promise(r => setTimeout(r, 5000));
      }
    }

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ status: data.status, error_message: data.error_message }),
      };
    }

    const places = data.results || [];

    // Fetch place details for each result in parallel
    const results = await Promise.all(
      places.map(async (place) => {
        try {
          const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_address,formatted_phone_number,international_phone_number,rating,user_ratings_total,website,url,place_id&key=${key}`;
          const detailResp = await fetch(detailUrl);
          const detailData = await detailResp.json();
          const d = detailData.result || {};
          return {
            name: d.name || place.name,
            formatted_address: d.formatted_address || place.formatted_address,
            phone: d.formatted_phone_number || null,
            phone_intl: d.international_phone_number || null,
            rating: d.rating || place.rating,
            user_ratings_total: d.user_ratings_total || place.user_ratings_total,
            website: d.website || null,
            google_maps_url: d.url || `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
            place_id: place.place_id,
          };
        } catch (e) {
          return { ...place, website: null, phone: null, google_maps_url: null };
        }
      })
    );

    console.log('Returning', results.length, 'results | next_page_token:', !!data.next_page_token);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        status: 'OK',
        results,
        next_page_token: data.next_page_token || null,
      }),
    };

  } catch (e) {
    console.log('Exception:', e.message);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
