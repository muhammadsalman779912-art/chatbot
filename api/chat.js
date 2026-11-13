// Vercel Serverless Function for Streaming Chat Proxy
export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const authHeader = req.headers.get('Authorization') || '';
    const clientKey = authHeader.replace(/^Bearer\s+/i, '').trim();

    // Prioritize client key if provided, else use environment variable
    const apiKey = clientKey || process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: { message: 'API key not configured on server or in request.' } }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const targetUrl = process.env.API_BASE_URL || 'https://api.groq.com/openai/v1/chat/completions';

    const upstreamResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: {
        'Content-Type': upstreamResponse.headers.get('content-type') || 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: { message: err.message } }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

