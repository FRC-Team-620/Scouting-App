const TBA_KEY = process.env.TBA_API_KEY;
const BASE_URL = 'https://www.thebluealliance.com/api/v3';

export async function fetchTBA(endpoint: string){
    const response = await fetch(`${BASE_URL}${endpoint}`, {
        headers: {
            'X-TBA-Auth-Key': TBA_KEY || '',
        },
    });

    if(!response.ok){
        throw new Error(`TBA API Erorr: ${response.statusText}`);
    }

    return response.json();
}