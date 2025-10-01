import { NextApiRequest, NextApiResponse } from 'next';
import { FRCEventsAPI } from '@/lib/frcApi';

// Helper to handle FRC API errors
function handleFrcApiError(error: any, res: NextApiResponse) {
  console.error('FRC API Error:', error);
  
  if (error.response) {
    // Handle HTTP error responses from FRC API
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
        return res.status(502).json({ // 502 Bad Gateway since our server is up but FRC API failed
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
  
  // Handle other types of errors
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
  res.setHeader('Cache-Control', 'public, max-age=60'); // Cache for 1 minute
  
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

  const { eventCode, teamNumber, districtCode } = req.query;
  
  // Validate parameters
  if (teamNumber && (eventCode || districtCode)) {
    return res.status(400).json({
      error: 'Invalid Parameters',
      message: 'teamNumber cannot be combined with eventCode or districtCode'
    });
  }

  // Require server-only FRC API key. Do NOT accept a public client key here.
  if (!process.env.FRC_API_KEY) {
    return res.status(500).json({ 
      error: 'Server Configuration Error',
      message: 'FRC API key is not configured on the server'
    });
  }

  const api = new FRCEventsAPI(process.env.FRC_API_KEY);
  
  try {
    let data;
    let lastModified: string | undefined;
    
    if (teamNumber) {
      const teamNum = Number(teamNumber);
      if (isNaN(teamNum) || teamNum <= 0) {
        return res.status(400).json({
          error: 'Invalid Parameter',
          message: 'teamNumber must be a positive number'
        });
      }
      data = await api.getTeam(teamNum);
    } else if (eventCode) {
      const event = String(eventCode).toUpperCase();
      if (!/^[A-Z0-9]{3,}$/.test(event)) {
        return res.status(400).json({
          error: 'Invalid Parameter',
          message: 'eventCode must be at least 3 alphanumeric characters'
        });
      }
      data = await api.getEventTeams(event);
    } else if (districtCode) {
      const district = String(districtCode).toUpperCase();
      data = await api.getDistrictTeams(district);
    } else {
      return res.status(400).json({
        error: 'Missing Parameters',
        message: 'One of teamNumber, eventCode, or districtCode is required'
      });
    }

    // Handle response with proper typing
    if (!data) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'No data found for the specified parameters'
      });
    }

    if (Array.isArray(data)) {
      // For array responses, use the most recent lastModified if available
      const lastModified = data.reduce((latest: string | undefined, team) => {
        if (!team?.lastModified) return latest;
        const teamDate = new Date(team.lastModified);
        if (!latest || teamDate > new Date(latest)) {
          return team.lastModified;
        }
        return latest;
      }, undefined);
      
      if (lastModified) {
        res.setHeader('Last-Modified', new Date(lastModified).toUTCString());
      }
      
      return res.status(200).json({
        teams: data,
        lastModified: lastModified || null
      });
    } else {
      // For single team response
      if (data?.lastModified) {
        res.setHeader('Last-Modified', new Date(data.lastModified).toUTCString());
      }
      return res.status(200).json(data);
    }
    
  } catch (error) {
    return handleFrcApiError(error, res);
  }
}
