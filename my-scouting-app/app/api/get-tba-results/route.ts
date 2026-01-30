// app/api/import-tba/route.ts
import { NextResponse } from 'next/server';
import { fetchTBA } from '@/lib/tba';
import { supabaseAdmin as supabase } from '@/lib/supabaseServer';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const eventKey = searchParams.get('event'); 

    if (!eventKey) return NextResponse.json({ error: 'No event key provided' }, { status: 400 });

    try {
        // 1. Fetch ALL matches for this event from TBA
        // This returns an array of match objects
        const matches = await fetchTBA(`/event/${eventKey}/matches/simple`);

        // 2. Map the data to fit your Supabase schema
        const upsertData = matches.map((match: any) => ({
            match_key: match.key,
            event_key: match.event_key,
            match_number: match.match_number,
            winning_alliance: match.winning_alliance || null,
            red_score: match.alliances.red.score,
            blue_score: match.alliances.blue.score,
        }));

        // 3. Bulk Upsert (One database hit instead of 80+)
        const { error } = await supabase
            .from('matches')
            .upsert(upsertData, {
                onConflict: 'match_key'
            });

        if (error) throw error;

        return NextResponse.json({ 
            success: true, 
            count: upsertData.length 
        });
    
    } catch (error: any) {
        console.error('Import Error:', error.message);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}