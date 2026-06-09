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

    // Page 2 — wait inside the SAME function instance (same IP)
    if (data1.next_page_token) {
      await new Promise(r => setTimeout(r, 2000));
      const url2 = `https://maps.googleapis.com/maps/api/place/textsearch/json?pagetoken=${data1.next_page_token}&key=${key}`;

      // Retry up to 5 times within this invocation
      let data2;
      for (let i = 0; i < 5; i++) {
        const r2 = await fetch(url2);
        data2 = await r2.json();
        console.log(`Page 2 attempt ${i+1}:`, data2.status, '| results:', data2.results?.length);
        if (data2.status === 'OK') break;
        await new Promise(r => setTimeout(r, 2000));
      }

      if (data2?.status === 'OK') {
        allPlaces = allPlaces.concat(data2.results || []);

        // Page 3 — same approach
        if (data2.next_page_token) {
          await new Promise(r => setTimeout(r, 2000));
          const url3 = `https://maps.googleapis.com/maps/api/place/textsearch/json?pagetoken=${data2.next_page_token}&key=${key}`;

          let data3;
          for (let i = 0; i < 5; i++) {
            const r3 = await fetch(url3);
            data3 = await r3.json();
            console.log(`Page 3 attempt ${i+1}:`, data3.status, '| results:', data3.results?.length);
            if (data3.status === 'OK') break;
            await new Promise(r => setTimeout(r, 2000));
          }

          if (data3?.status === 'OK') {
            allPlaces = allPlaces.concat(data3.results || []);
          }
        }
      }
    }

    console.log('Total places:', allPlaces.length);

    // Fetch place details for each result in parallel
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
