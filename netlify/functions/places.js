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

    // Use Places API (New) - Text Search endpoint
    // This returns nextPageToken that works reliably with the new API
    const searchBody = { textQuery: query, pageSize: 20 };

    const fields = 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.rating,places.userRatingCount,places.websiteUri,places.googleMapsUri,nextPageToken';

    const fetchPage = async (body) => {
      const resp = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': key,
          'X-Goog-FieldMask': fields,
        },
        body: JSON.stringify(body),
      });
      return await resp.json();
    };

    // Page 1
    const data1 = await fetchPage(searchBody);
    console.log('Page 1: places:', data1.places?.length, '| token:', !!data1.nextPageToken, '| error:', data1.error?.message);

    if (data1.error) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ status: 'ERROR', error_message: data1.error.message }),
      };
    }

    allPlaces = allPlaces.concat(data1.places || []);

    // Page 2
    if (data1.nextPageToken) {
      await new Promise(r => setTimeout(r, 2000));
      const data2 = await fetchPage({ ...searchBody, pageToken: data1.nextPageToken });
      console.log('Page 2: places:', data2.places?.length, '| token:', !!data2.nextPageToken, '| error:', data2.error?.message);
      allPlaces = allPlaces.concat(data2.places || []);

      // Page 3
      if (data2.nextPageToken) {
        await new Promise(r => setTimeout(r, 2000));
        const data3 = await fetchPage({ ...searchBody, pageToken: data2.nextPageToken });
        console.log('Page 3: places:', data3.places?.length, '| error:', data3.error?.message);
        allPlaces = allPlaces.concat(data3.places || []);
      }
    }

    console.log('Total places:', allPlaces.length);

    // Map new API response shape to existing frontend shape
    const results = allPlaces.map(p => ({
      name: p.displayName?.text || '',
      formatted_address: p.formattedAddress || '',
      phone: p.nationalPhoneNumber || null,
      phone_intl: p.internationalPhoneNumber || null,
      rating: p.rating || null,
      user_ratings_total: p.userRatingCount || 0,
      website: p.websiteUri || null,
      google_maps_url: p.googleMapsUri || null,
      place_id: p.id || null,
    }));

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
