exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const email = process.env.SLYBROADCAST_EMAIL;
  const password = process.env.SLYBROADCAST_PASSWORD;
  const recordingId = process.env.SLYBROADCAST_RECORDING_ID;
  const callerId = process.env.SLYBROADCAST_CALLER_ID;

  if (!email || !password || !recordingId) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Missing env vars. Need: SLYBROADCAST_EMAIL, SLYBROADCAST_PASSWORD, SLYBROADCAST_RECORDING_ID' })
    };
  }

  try {
    const { phone, name } = JSON.parse(event.body || '{}');
    if (!phone) return { statusCode: 400, body: JSON.stringify({ error: 'Missing phone number' }) };

    const cleanPhone = phone.replace(/\D/g, '');
    console.log('Dropping voicemail to:', cleanPhone, 'for:', name);
    console.log('Recording ID:', recordingId);
    console.log('Caller ID:', callerId);

    const params = new URLSearchParams({
      c_uid: email,
      c_password: password,
      c_phone: cleanPhone,
      c_record_audio: recordingId,
      c_date: 'now',
    });

    if (callerId) {
      params.append('c_callerID', callerId.replace(/\D/g, ''));
    }

    console.log('Sending to Slybroadcast...');
    const resp = await fetch('https://www.slybroadcast.com/gateway/service.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const text = await resp.text();
    console.log('Slybroadcast raw response:', text);
    console.log('HTTP status:', resp.status);

    if (text.trim().toUpperCase().startsWith('OK') || text.toLowerCase().includes('success')) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: true, message: 'Voicemail dropped to ' + (name || cleanPhone) }),
      };
    } else {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Slybroadcast error: ' + text.trim() }),
      };
    }
  } catch (e) {
    console.log('Exception:', e.message);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
