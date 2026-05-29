exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const key = process.env.RESEND_KEY;
  if (!key) {
    return { statusCode: 500, body: JSON.stringify({ error: 'RESEND_KEY env var not set in Netlify' }) };
  }

  try {
    const { to, subject, body } = JSON.parse(event.body || '{}');
    if (!to || !subject || !body) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing to, subject, or body' }) };
    }

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        from: 'Jon @ Mende Marketing <jon@mendemarketing.com>',
        reply_to: 'jon@mendemarketing.com',
        to: [to],
        subject: subject,
        text: body,
      }),
    });

    const data = await resp.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true, id: data.id }),
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
