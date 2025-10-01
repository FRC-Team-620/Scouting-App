import { NextApiRequest, NextApiResponse } from 'next';
import { FRCEventsAPI, FRCEvent, getFRCAPI } from '@/lib/frcApi';

// Reuse the error handler from teams.ts
function handleFrcApiError(error: any, res: NextApiResponse) {
  console.error('FRC API Error:', error);
  
  if (error.response) {
    const status = error.response.status;
    const message = error.response.data?.message || 'FRC API Error';
    
    switch (status) {
      case 400:
        return res.status(400).json({ 
          error: 'Invalid Request',
          message: message || 'Malformed parameter or missing required parameter'
        });
      case 401:
        return res.status(401).json({ 
          error: 'Unauthorized',
          message: 'Invalid or missing API token'
        });
      case 404:
        return res.status(404).json({ 
          error: 'Not Found',
          message: 'The requested resource was not found'
        });
      case 500:
        return res.status(502).json({
          error: 'FRC API Service Error',
          message: 'The FRC API returned an error'
        });
      case 503:
        return res.status(503).json({
          error: 'Service Unavailable',
          message: 'FRC API is currently unavailable, please try again later',
          retryAfter: error.response.headers['retry-after']
        });
      default:
        return res.status(500).json({
          error: 'FRC API Error',
          message: `Unexpected error (${status}): ${message}`
        });
    }
  }
  
  return res.status(500).json({
    error: 'Internal Server Error',
    message: error instanceof Error ? error.message : 'An unknown error occurred'
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache events for 1 hour
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET', 'OPTIONS']);
    return res.status(405).json({ 
      error: 'Method Not Allowed',
      message: 'Only GET and OPTIONS methods are allowed'
    });
  }

  const { eventCode, teamNumber, districtCode, excludeDistrict } = req.query;
  
  try {
    const api = getFRCAPI();
    let events: FRCEvent | FRCEvent[];
    
    if (eventCode) {
      // Get single event by code
      const event = await api.getEventDetails(String(eventCode));
      if (!event) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Event not found'
        });
      }
      return res.status(200).json(event);
    } else if (teamNumber) {
      // Get events for a specific team
      const teamNum = Number(teamNumber);
      if (isNaN(teamNum) || teamNum <= 0) {
        return res.status(400).json({
          error: 'Invalid Parameter',
          message: 'teamNumber must be a positive number'
        });
      }
      events = await api.getTeamEvents(teamNum);
    } else if (districtCode) {
      // Get events in a specific district
      const district = String(districtCode).toUpperCase();
      const exclude = excludeDistrict === 'true';
      events = await api.getDistrictEvents(district, exclude);
    } else {
      // Get all events
      events = await api.getAllEvents();
    }

    // For array responses, find the most recent lastModified
    let lastModified: string | undefined;
    
    if (Array.isArray(events)) {
      // Find the most recent lastModified date
      lastModified = events.reduce((latest: string | undefined, event: FRCEvent) => {
        if (!event.lastModified) return latest;
        const eventDate = new Date(event.lastModified);
        if (!latest || eventDate > new Date(latest)) {
          return event.lastModified;
        }
        return latest;
      }, undefined);
    } else if (events && typeof events === 'object' && events !== null && 'lastModified' in events) {
      // For single event response with type guard
      lastModified = (events as FRCEvent).lastModified;
    }

    // Set Last-Modified header if available
    if (lastModified) {
      res.setHeader('Last-Modified', new Date(lastModified).toUTCString());
    }

    // Return the response with the appropriate structure
    const response = Array.isArray(events) 
      ? { events, lastModified: lastModified || null }
      : { event: events as FRCEvent, lastModified: lastModified || null };
      
    return res.status(200).json(response);
    
  } catch (error) {
    return handleFrcApiError(error, res);
  }
}
