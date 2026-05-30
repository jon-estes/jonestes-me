exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const email = process.env.SLYBROADCAST_EMAIL;
  const password = process.env.SLYBROADCAST_PASSWORD;
  const recordingId = process.env.SLYBROADCAST_RECORDING_ID;

  if (!email || !password || !recordingId) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Slybroadcast env vars not set. Add SLYBROADCAST_EMAIL, SLYBROADCAST_PASSWORD, SLYBROADCAST_RECORDING_ID to Netlify.' }) };
  }

  try {
    const { phone, name } = JSON.parse(event.body || '{}');
    if (!phone) return { statusCode: 400, body: JSON.stringify({ error: 'Missing phone number' }) };

    // Clean phone number — digits only
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) return { statusCode: 400, body: JSON.stringify({ error: 'Invalid phone number' }) };

    const params = new URLSearchParams({
      c_uid: email,
      c_password: password,
      c_phone: cleanPhone,
      c_record_audio: recordingId,
      c_callerID: process.env.SLYBROADCAST_CALLER_ID || cleanPhone,
      c_date: 'now',
    });

    const resp = await fetch('https://www.slybroadcast.com/gateway/service.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const text = await resp.text();

    // Slybroadcast returns "OK" or an error message
    if (text.trim().startsWith('OK') || text.includes('success')) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: true, message: 'Voicemail dropped to ' + name }),
      };
    } else {
      throw new Error(text.trim() || 'Unknown Slybroadcast error');
    }
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
