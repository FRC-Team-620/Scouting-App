// app/api/import-tba/route.ts

// Import the tool to send responses back to the browser
import { NextResponse } from 'next/server';
// Import our custom helper to talk to The Blue Alliance API
import { fetchTBA } from '@/lib/tba';
// Import the "Master Key" Supabase client to bypass security during import
import { supabaseAdmin as supabase } from '@/lib/supabaseServer';

// This function runs when the /admin page sends a request here
export async function GET(request: Request) {

    // Extract the URL parameters (e.g., ?event=2026txhou)
    const { searchParams } = new URL(request.url);
    // Get the specific value for the event key
    const eventKey = searchParams.get('event');

    // If the admin didn't provide a key, stop and return an error
    if (!eventKey) return NextResponse.json({ error: 'No event key provided' });

    try {

        const TBAcomp = await fetchTBA(`/event/${eventKey}/simple`)
        
        const event_name = TBAcomp?.name;

        const {data: comp, error: compErr} = await supabase
            .from('competitions')
            .upsert({
                event_key: eventKey,
                name: event_name,
                year: parseInt(eventKey.substring(0,4)),
            }, {onConflict: 'event_key'})
            .select()
            .single();

        if(compErr) throw compErr;



        // --- STEP 1: IMPORT TEAMS ---
        // Ask TBA for the list of teams at this event
        const teams = await fetchTBA(`/event/${eventKey}/teams/simple`);

        // Clean the team data to match our database columns
        const teamData = teams.map((t: any) => ({
            team_number: t.team_number,
            nickname: t.nickname,
        }));

        // Save teams; if they already exist, update them
        const { error: teamErr } = await supabase.from('teams').upsert(teamData);
        // If Supabase fails, stop and jump to the 'catch' block
        if (teamErr) throw teamErr;


        // --- STEP 2: IMPORT MATCHES ---
        // Ask TBA for the match schedule
        const matches = await fetchTBA(`/event/${eventKey}/matches/simple`);

        // Create a 'Map' to store matches. A Map automatically prevents duplicates 
        // because it only allows one entry for each unique key.
        const matchMap = new Map();

        // Loop through every match sent by TBA
        matches.forEach((m: any) => {
            // We only care about Qualification matches ('qm')
            if (m.comp_level === 'qm') {
                // Create a clean match object
                const cleanedMatch = {
                    match_number: m.match_number, // The match number (1, 2, 3...)
                    competition_id: comp.id,
                    red_alliance: m.alliances.red.team_keys.map((k: string) => parseInt(k.replace('frc', ''))),
                    blue_alliance: m.alliances.blue.team_keys.map((k: string) => parseInt(k.replace('frc', ''))),
                    event_key: eventKey, // Link this match to the event
                    match_key: m.key
                };

                // Add this match to the Map. If match_number 1 appears twice, 
                // the second one will simply overwrite the first one here.
                matchMap.set(m.match_number, cleanedMatch);
            }
        });

        // Convert our unique Map back into a standard list (array) for Supabase
        const finalMatchData = Array.from(matchMap.values());

        // Send the unique, cleaned match list to Supabase
        const { error: matchErr } = await supabase
            .from('matches')
            .upsert(finalMatchData, {
                // If a row with this match_number and event_key exists, update it
                onConflict: 'match_number,event_key'
            });

        // If Supabase fails to save matches, throw an error
        if (matchErr) throw matchErr;

        // If everything worked perfectly, return success
        return NextResponse.json({ success: true });
    
    } catch (error: any) {
        // If any error occurred in the 'try' block, catch it and send it to the UI
        return NextResponse.json({ success: false, error: error.message });
    }
}