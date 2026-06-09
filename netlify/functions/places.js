exports.handler = async function(event) {
  const { query, btype, city } = event.queryStringParameters || {};
  const key = process.env.GOOGLE_PLACES_KEY;

  if (!key) {
    return { statusCode: 500, body: JSON.stringify({ error: 'GOOGLE_PLACES_KEY env var not set' }) };
  }

  // Support both ?query= (legacy) and ?btype=&city= (new multi-synonym mode)
  let baseType, baseCity;
  if (btype && city) {
    baseType = btype;
    baseCity = city;
  } else if (query) {
    baseType = query;
    baseCity = '';
  } else {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing query or btype/city' }) };
  }

  // Generate synonym queries to maximize unique results (60 per query = up to 180+ total)
  const synonyms = generateSynonyms(baseType);
  const queries = synonyms.map(s => baseCity ? `${s} in ${baseCity}` : s);
  console.log('Running queries:', queries);

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

  // Fetch all 3 pages for a single query text
  const fetchAllPages = async (textQuery) => {
    const places = [];
    const searchBody = { textQuery, pageSize: 20 };

    const d1 = await fetchPage(searchBody);
    if (d1.error || (!d1.places && !d1.nextPageToken)) {
      console.log(`Query "${textQuery}" error:`, d1.error?.message || 'no results');
      return places;
    }
    places.push(...(d1.places || []));
    console.log(`"${textQuery}" p1: ${d1.places?.length || 0} | token: ${!!d1.nextPageToken}`);

    if (d1.nextPageToken) {
      await new Promise(r => setTimeout(r, 2000));
      const d2 = await fetchPage({ ...searchBody, pageToken: d1.nextPageToken });
      places.push(...(d2.places || []));
      console.log(`"${textQuery}" p2: ${d2.places?.length || 0} | token: ${!!d2.nextPageToken}`);

      if (d2.nextPageToken) {
        await new Promise(r => setTimeout(r, 2000));
        const d3 = await fetchPage({ ...searchBody, pageToken: d2.nextPageToken });
        places.push(...(d3.places || []));
        console.log(`"${textQuery}" p3: ${d3.places?.length || 0}`);
      }
    }

    return places;
  };

  try {
    // Run synonym queries in parallel for speed
    const resultsPerQuery = await Promise.all(queries.map(q => fetchAllPages(q)));

    const seen = new Set();
    const allPlaces = [];
    for (const places of resultsPerQuery) {
      for (const p of places) {
        if (p.id && !seen.has(p.id)) {
          seen.add(p.id);
          allPlaces.push(p);
        }
      }
    }

    console.log('Final unique places:', allPlaces.length);

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

function generateSynonyms(btype) {
  const t = btype.toLowerCase().trim();

  // Common synonym maps
  const synonymMap = {
    'roofing contractor': ['roofing contractor', 'roofing company', 'roofer'],
    'roofer': ['roofer', 'roofing contractor', 'roofing company'],
    'roofing company': ['roofing company', 'roofing contractor', 'roofer'],
    'plumber': ['plumber', 'plumbing contractor', 'plumbing company'],
    'plumbing': ['plumbing contractor', 'plumber', 'plumbing company'],
    'electrician': ['electrician', 'electrical contractor', 'electrical company'],
    'hvac': ['hvac contractor', 'hvac company', 'heating and cooling'],
    'landscaper': ['landscaper', 'landscaping company', 'lawn care service'],
    'landscaping': ['landscaping company', 'landscaper', 'lawn care service'],
    'painter': ['painter', 'painting contractor', 'painting company'],
    'painting contractor': ['painting contractor', 'painter', 'painting company'],
    'general contractor': ['general contractor', 'home remodeling', 'construction company'],
    'dentist': ['dentist', 'dental office', 'dental clinic'],
    'dental': ['dental office', 'dentist', 'dental clinic'],
    'attorney': ['attorney', 'lawyer', 'law office'],
    'lawyer': ['lawyer', 'attorney', 'law firm'],
    'restaurant': ['restaurant', 'eatery', 'dining'],
    'auto repair': ['auto repair', 'car repair', 'auto mechanic'],
    'mechanic': ['mechanic', 'auto repair shop', 'car repair'],
    'cleaning service': ['cleaning service', 'house cleaning', 'maid service'],
    'pest control': ['pest control', 'exterminator', 'pest exterminator'],
    'moving company': ['moving company', 'movers', 'moving service'],
    'movers': ['movers', 'moving company', 'moving service'],
    'insurance agent': ['insurance agent', 'insurance agency', 'insurance broker'],
    'real estate agent': ['real estate agent', 'realtor', 'real estate broker'],
    'realtor': ['realtor', 'real estate agent', 'real estate agency'],
    'nail salon': ['nail salon', 'nail studio', 'manicure salon'],
    'nail': ['nail salon', 'nail studio', 'manicure pedicure'],
    'hair salon': ['hair salon', 'hair stylist', 'beauty salon'],
    'gym': ['gym', 'fitness center', 'health club'],
    'chiropractor': ['chiropractor', 'chiropractic clinic', 'chiropractic office'],
    'accountant': ['accountant', 'cpa', 'accounting firm'],
    'cpa': ['cpa', 'accountant', 'accounting services'],
    'solar': ['solar company', 'solar installer', 'solar panel installation'],
    'fence': ['fence company', 'fencing contractor', 'fence installer'],
    'garage door': ['garage door company', 'garage door repair', 'garage door installer'],
    'window': ['window company', 'window installer', 'window replacement'],
    'concrete': ['concrete contractor', 'concrete company', 'concrete services'],
    'pool': ['pool company', 'swimming pool contractor', 'pool builder'],
  };

  // Check for a match — exact, input contains key, OR key contains input (e.g. "nail" matches "nail salon")
  for (const [key, synonyms] of Object.entries(synonymMap)) {
    if (t === key || t.includes(key) || key.includes(t)) {
      return synonyms;
    }
  }

  // No match — generate sensible generic variations
  const base = btype.trim();
  return [
    base,
    `${base} company`,
    `${base} service`,
  ].filter((v, i, a) => a.indexOf(v) === i).slice(0, 3);
}
