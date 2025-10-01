// FRC Events API Integration
// API Documentation: https://frc-api.firstinspires.org/v3.0/swagger/ui/index

const FRC_API_BASE = 'https://frc-api.firstinspires.org/v3.0';
const CURRENT_SEASON = 2025;

export interface FRCEvent {
  code: string;
  name: string;
  startDate: string;
  endDate: string;
  city: string;
  stateProv: string;
  country: string;
  venue?: string;
  website?: string;
  timezone?: string;
  type?: string;
  typeName?: string;
  districtCode?: string;
  districtName?: string;
  divisionCode?: string;
  divisionName?: string;
  venueAddress?: string;
  timezoneOffset?: string;
  week?: number;
  address?: string;
  postalCode?: string;
  gmapsPlaceId?: string;
  gmapsUrl?: string;
  lat?: number;
  lng?: number;
  locationName?: string;
  websiteUrl?: string;
  firstEventId?: string;
  firstEventCode?: string;
  webcasts?: Array<{
    type: string;
    channel: string;
    date?: string;
    file?: string;
  }>;
  lastModified?: string;
}

export interface FRCTeam {
  teamNumber: number;
  nameFull: string;
  nameShort?: string;
  schoolName?: string;
  city: string;
  stateProv: string;
  country: string;
  website?: string;
  rookieYear?: number;
  homeCMP?: string;
  homeCMPDate?: string;
  lastModified?: string;
  // Add other fields from FRC API as needed
}

export interface FRCMatch {
  matchNumber: number;
  description: string;
  tournamentLevel: string; // 'Qualification' | 'Playoff'
  startTime?: string;
  field?: string;
  teams?: Array<{
    teamNumber: number;
    station: string;
    surrogate: boolean;
  }>;
}

export class FRCEventsAPI {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async fetchAPI(endpoint: string) {
    const url = `${FRC_API_BASE}${endpoint}`;
    console.log('FRC API Request:', url);
    
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.apiKey}:`).toString('base64')}`,
          'Accept': 'application/json',
        },
        cache: 'no-store'
      });

      console.log('FRC API Response Status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('FRC API Error Response:', errorText);
        const error = new Error(`FRC API Error: ${response.status} ${response.statusText}`);
        (error as any).status = response.status;
        throw error;
      }

      return await response.json();
    } catch (error) {
      console.error('FRC API Request Failed:', error);
      throw error;
    }
  }

  /**
   * Get list of teams at an event
   * @param eventCode - Event code (e.g., "CASD" for San Diego Regional)
   * @param page - Page number for pagination (optional, default 1)
   */
  async getEventTeams(eventCode: string, page: number = 1): Promise<FRCTeam[]> {
    const allTeams: FRCTeam[] = [];
    let currentPage = page;
    let hasMorePages = true;
    
    try {
      while (hasMorePages) {
        const data = await this.fetchAPI(`/${CURRENT_SEASON}/teams?eventCode=${eventCode.toUpperCase()}&page=${currentPage}`);
        const teams = data.teams || [];
        
        if (teams.length === 0) {
          hasMorePages = false;
        } else {
          allTeams.push(...teams);
          currentPage++;
          
          // If we get fewer teams than the page size, we've reached the end
          if (teams.length < 100) {
            hasMorePages = false;
          }
        }
      }
      return allTeams;
    } catch (error) {
      console.error(`Error fetching teams for event ${eventCode}:`, error);
      throw error;
    }
  }
  
  /**
   * Get a specific team by number
   * @param teamNumber - Team number (e.g., 620)
   * @returns Team data or null if not found
   */
  async getTeam(teamNumber: number): Promise<FRCTeam | null> {
    try {
      const data = await this.fetchAPI(`/${CURRENT_SEASON}/teams?teamNumber=${teamNumber}`);
      const teams = data?.teams || [];
      return teams.length > 0 ? teams[0] : null;
    } catch (error: any) {
      if (error?.response?.status === 404) {
        return null; // Team not found
      }
      throw error; // Re-throw other errors
    }
  }
  
  /**
   * Get all teams in a district
   * @param districtCode - District code (e.g., "FMA", "PNW")
   */
  async getDistrictTeams(districtCode: string): Promise<FRCTeam[]> {
    const data = await this.fetchAPI(`/${CURRENT_SEASON}/teams?districtCode=${districtCode.toUpperCase()}`);
    return data.teams || [];
  }

  /**
   * Get event details by event code
   * @param eventCode - Event code (e.g., "CMPMO")
   */
  async getEventDetails(eventCode: string): Promise<FRCEvent | null> {
    try {
      const data = await this.fetchAPI(`/${CURRENT_SEASON}/events?eventCode=${eventCode.toUpperCase()}`);
      return data?.Events?.[0] || null;
    } catch (error: any) {
      if (error?.response?.status === 404) {
        return null; // Event not found
      }
      throw error; // Re-throw other errors
    }
  }

  /**
   * Get all events for a team in the current season
   * @param teamNumber - Team number (e.g., 620)
   */
  async getTeamEvents(teamNumber: number): Promise<FRCEvent[]> {
    const data = await this.fetchAPI(`/${CURRENT_SEASON}/events?teamNumber=${teamNumber}`);
    return data.Events || [];
  }

  /**
   * Get events in a district
   * @param districtCode - District code (e.g., "FMA", "PNW")
   * @param exclude - If true, returns events NOT in the specified district
   */
  async getDistrictEvents(districtCode: string, exclude: boolean = false): Promise<FRCEvent[]> {
    const url = `/${CURRENT_SEASON}/events?districtCode=${districtCode.toUpperCase()}`;
    const data = await this.fetchAPI(exclude ? `${url}&exclude=true` : url);
    return data.Events || [];
  }

  /**
   * Get all events in the current season
   */
  async getAllEvents(): Promise<FRCEvent[]> {
    const data = await this.fetchAPI(`/${CURRENT_SEASON}/events`);
    return data.Events || [];
  }

  /**
   * Get match schedule for an event
   * @param eventCode - Event code (e.g., "CASD")
   * @param level - 'qual' or 'playoff' (optional, gets both if not specified)
   */
  async getEventMatches(eventCode: string, level?: 'qual' | 'playoff'): Promise<FRCMatch[]> {
    const allMatches: FRCMatch[] = [];
    
    // Get qualification matches
    if (!level || level === 'qual') {
      try {
        const qualData = await this.fetchAPI(`/${CURRENT_SEASON}/schedule/${eventCode.toUpperCase()}/qual`);
        const qualSchedule = qualData.Schedule || [];
        allMatches.push(...qualSchedule);
      } catch (error) {
        console.warn('No qualification matches found');
      }
    }
    
    // Get playoff matches
    if (!level || level === 'playoff') {
      try {
        const playoffData = await this.fetchAPI(`/${CURRENT_SEASON}/schedule/${eventCode.toUpperCase()}/playoff`);
        const playoffSchedule = playoffData.Schedule || [];
        allMatches.push(...playoffSchedule);
      } catch (error) {
        console.warn('No playoff matches found');
      }
    }
    
    return allMatches.map((match: any) => ({
      matchNumber: match.matchNumber,
      description: match.description,
      tournamentLevel: match.tournamentLevel,
      startTime: match.startTime,
      field: match.field,
      teams: match.teams,
    }));
  }

  /**
   * Get match schedule for an event with optional filters supported by the FRC API.
   * This proxies the endpoint: /{season}/schedule/{eventCode}?tournamentLevel=&teamNumber=&start=&end=
   *
   * @param eventCode - Event code (e.g., "CASD")
   * @param filters - Optional filters: tournamentLevel (Qualification|Playoff), teamNumber, start, end
   */
  async getEventMatchesWithFilters(eventCode: string, filters?: { tournamentLevel?: string; teamNumber?: number | string; start?: string; end?: string }): Promise<FRCMatch[]> {
    const params = new URLSearchParams();
    if (filters?.tournamentLevel) params.append('tournamentLevel', String(filters.tournamentLevel));
    if (filters?.teamNumber) params.append('teamNumber', String(filters.teamNumber));
    if (filters?.start) params.append('start', String(filters.start));
    if (filters?.end) params.append('end', String(filters.end));

    const query = params.toString() ? `?${params.toString()}` : '';
    const data = await this.fetchAPI(`/${CURRENT_SEASON}/schedule/${eventCode.toUpperCase()}${query}`);
    const schedule = data?.Schedule || [];
    return schedule.map((match: any) => ({
      matchNumber: match.matchNumber,
      description: match.description,
      tournamentLevel: match.tournamentLevel,
      startTime: match.startTime,
      field: match.field,
      teams: match.teams,
    }));
  }


}

// Helper to get API instance
export function getFRCAPI(): FRCEventsAPI {
  // This helper is intended for server-side usage only. The API key must be set in the server
  // environment as FRC_API_KEY. Never expose the key to the client.
  const apiKey = process.env.FRC_API_KEY;
  if (!apiKey) {
    throw new Error('FRC API key is not configured on the server. Please set FRC_API_KEY in your environment variables.');
  }
  return new FRCEventsAPI(apiKey);
}
