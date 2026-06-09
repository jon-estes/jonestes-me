exports.handler = async function(event) {
  const { query } = event.queryStringParameters || {};
  const key = process.env.GOOGLE_PLACES_KEY;

  if (!key) {
    return { statusCode: 500, body: JSON.stringify({ error: 'GOOGLE_PLACES_KEY env var not set' }) };
  }
  if (!query) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing query' }) };
  }

  try {
    let allPlaces = [];

    // Page 1
    const url1 = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${key}`;
    const resp1 = await fetch(url1);
    const data1 = await resp1.json();
    console.log('Page 1:', data1.status, '| results:', data1.results?.length, '| token:', !!data1.next_page_token);

    if (data1.status !== 'OK' && data1.status !== 'ZERO_RESULTS') {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ status: data1.status, error_message: data1.error_message }),
      };
    }

    allPlaces = allPlaces.concat(data1.results || []);

    if (data1.next_page_token) {
      const token2 = data1.next_page_token;
      console.log('Token2 length:', token2.length, '| first20:', token2.substring(0, 20), '| last20:', token2.substring(token2.length - 20));

      await new Promise(r => setTimeout(r, 2000));

      for (let i = 0; i < 5; i++) {
        // Re-encode the token fresh each attempt to rule out any URL issues
        const url2 = `https://maps.googleapis.com/maps/api/place/textsearch/json?pagetoken=${encodeURIComponent(token2)}&key=${key}`;
        console.log(`Page 2 attempt ${i+1} URL snippet:`, url2.substring(0, 120));
        const r2 = await fetch(url2);
        const data2 = await r2.json();
        console.log(`Page 2 attempt ${i+1}:`, data2.status, '| error:', data2.error_message, '| results:', data2.results?.length);

        if (data2.status === 'OK') {
          allPlaces = allPlaces.concat(data2.results || []);

          if (data2.next_page_token) {
            await new Promise(r => setTimeout(r, 2000));
            const url3 = `https://maps.googleapis.com/maps/api/place/textsearch/json?pagetoken=${encodeURIComponent(data2.next_page_token)}&key=${key}`;
            const r3 = await fetch(url3);
            const data3 = await r3.json();
            console.log('Page 3:', data3.status, '| results:', data3.results?.length);
            if (data3.status === 'OK') allPlaces = allPlaces.concat(data3.results || []);
          }
          break;
        }

        if (i < 4) await new Promise(r => setTimeout(r, 2000));
      }
    }

    console.log('Total places:', allPlaces.length);

    const results = await Promise.all(
      allPlaces.map(async (place) => {
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

    console.log('Returning', results.length, 'total results');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ status: 'OK', results }),
    };

  } catch (e) {
    console.log('Exception:', e.message);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
