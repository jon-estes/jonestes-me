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
    // Log the raw token for debugging
    if (pagetoken) {
      console.log('Raw pagetoken length:', pagetoken.length);
      console.log('Raw pagetoken:', pagetoken);
    }

    const searchUrl = pagetoken
      ? `https://maps.googleapis.com/maps/api/place/textsearch/json?pagetoken=${pagetoken}&key=${key}`
      : `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${key}`;

    console.log('Search URL (no key):', searchUrl.replace(key, 'REDACTED'));

    const resp = await fetch(searchUrl);
    const data = await resp.json();
    console.log('Status:', data.status, '| results:', data.results?.length, '| error:', data.error_message);

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ status: data.status, error_message: data.error_message }),
      };
    }

    const places = data.results || [];

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
