exports.handler = async function(event) {
  const { query, pagetoken } = event.queryStringParameters || {};
  const key = process.env.GOOGLE_PLACES_KEY;

  if (!query && !pagetoken) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing query or pagetoken' }) };
  }
  if (!key) {
    return { statusCode: 500, body: JSON.stringify({ error: 'GOOGLE_PLACES_KEY env var not set' }) };
  }

  try {
    // If pagetoken provided, wait 3s — Google requires a delay before next_page_token is valid
    if (pagetoken) {
      await new Promise(r => setTimeout(r, 3000));
    }

    const searchUrl = pagetoken
      ? `https://maps.googleapis.com/maps/api/place/textsearch/json?pagetoken=${encodeURIComponent(pagetoken)}&key=${key}`
      : `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${key}`;

    console.log('Fetching:', pagetoken ? 'page with token' : 'query: ' + query);
    const searchResp = await fetch(searchUrl);
    const searchData = await searchResp.json();
    console.log('Status:', searchData.status, '| Results:', searchData.results?.length, '| Has next token:', !!searchData.next_page_token);

    if (searchData.status === 'INVALID_REQUEST') {
      // Token not ready yet — wait more and retry once
      console.log('INVALID_REQUEST — retrying after extra delay...');
      await new Promise(r => setTimeout(r, 3000));
      const retryResp = await fetch(searchUrl);
      const retryData = await retryResp.json();
      console.log('Retry status:', retryData.status, '| Results:', retryData.results?.length);
      if (retryData.status !== 'OK') {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ status: 'OK', results: [], next_page_token: null }),
        };
      }
      searchData.results = retryData.results;
      searchData.next_page_token = retryData.next_page_token;
      searchData.status = retryData.status;
    }

    if (searchData.status !== 'OK' && searchData.status !== 'ZERO_RESULTS') {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(searchData),
      };
    }

    // Fetch place details for each result
    const results = await Promise.all(
      (searchData.results || []).map(async (place) => {
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

    console.log('Returning', results.length, 'results, next_page_token:', !!searchData.next_page_token);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        status: 'OK',
        results,
        next_page_token: searchData.next_page_token || null,
      }),
    };

  } catch (e) {
    console.log('Exception:', e.message);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
