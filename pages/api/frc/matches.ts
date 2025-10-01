import { NextApiRequest, NextApiResponse } from 'next';
import { FRCEventsAPI } from '@/lib/frcApi';

type Level = 'qual' | 'playoff' | undefined;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { eventCode, level, tournamentLevel, teamNumber, start, end } = req.query;
  
  if (!eventCode) {
    return res.status(400).json({ error: 'eventCode is required' });
  }

  if (!process.env.FRC_API_KEY) {
    return res.status(500).json({ error: 'FRC API key not configured' });
  }

  const api = new FRCEventsAPI(process.env.FRC_API_KEY);
  
  try {
    // If any filter parameters are provided, use the filtered schedule endpoint
    const hasFilters = tournamentLevel || teamNumber || start || end;
    let matches;
    if (hasFilters) {
      matches = await api.getEventMatchesWithFilters(String(eventCode), {
        tournamentLevel: tournamentLevel ? String(tournamentLevel) : undefined,
        teamNumber: teamNumber ? Number(teamNumber) : undefined,
        start: start ? String(start) : undefined,
        end: end ? String(end) : undefined,
      });
    } else {
      matches = await api.getEventMatches(
        String(eventCode), 
        level as Level
      );
    }
    return res.status(200).json(matches);
  } catch (error) {
    console.error('FRC Matches API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ 
      error: 'Failed to fetch matches',
      details: errorMessage
    });
  }
}
