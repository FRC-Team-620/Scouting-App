import { NextApiRequest, NextApiResponse } from 'next';
import { getFRCAPI } from '@/lib/frcApi';

// Reuse error handler pattern
function handleFrcApiError(error: any, res: NextApiResponse) {
  console.error('FRC API Error:', error);
  if (error.response) {
    const status = error.response.status;
    const message = error.response.data?.message || 'FRC API Error';
    switch (status) {
      case 400:
        return res.status(400).json({ error: 'Invalid Request', message });
      case 401:
        return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or missing API token' });
      case 404:
        return res.status(404).json({ error: 'Not Found', message });
      case 500:
        return res.status(502).json({ error: 'FRC API Service Error', message: 'The FRC API returned an error' });
      case 503:
        return res.status(503).json({ error: 'Service Unavailable', message: 'FRC API is currently unavailable', retryAfter: error.response.headers['retry-after'] });
      default:
        return res.status(500).json({ error: 'FRC API Error', message: `Unexpected error (${status}): ${message}` });
    }
  }
  return res.status(500).json({ error: 'Internal Server Error', message: error instanceof Error ? error.message : 'An unknown error occurred' });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=300'); // cache for 5 minutes

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET', 'OPTIONS']);
    return res.status(405).json({ error: 'Method Not Allowed', message: 'Only GET and OPTIONS are allowed' });
  }

  const { eventCode } = req.query;
  if (!eventCode) {
    return res.status(400).json({ error: 'Missing Parameter', message: 'eventCode is required' });
  }

  try {
    const api = getFRCAPI();
    const code = String(eventCode).toUpperCase();

    // Fetch event details
    const event = await api.getEventDetails(code);
    if (!event) {
      return res.status(404).json({ error: 'Not Found', message: 'Event not found' });
    }

    // Fetch teams and matches in parallel
    const [teams, matches] = await Promise.all([
      api.getEventTeams(code),
      api.getEventMatches(code)
    ]);

    return res.status(200).json({ event, teams, matches });
  } catch (error) {
    return handleFrcApiError(error, res);
  }
}
