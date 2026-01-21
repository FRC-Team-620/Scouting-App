'use client';

import {useState, useEffect} from 'react';
import {supabase} from '@/lib/supabase';

interface Team{
    team_number: number;
    nickname: string;
}

export default function TeamsPage(){
    const [teams,setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTeams = async () => {
            const {data,error} = await supabase
                .from('teams')
                .select('*')
                .order('team_number', {ascending: true} );
            if (error) {
               console.error('Error fetching teams:', error.message);
            }else{
                setTeams(data || []);
            }


            setLoading(false);
        };
        
        fetchTeams();
    },[]);

    if (loading) return <p className="p-10">Loading teams...</p>;

    return (
<div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Event Teams</h1>
      
      {/* This creates a grid that has 1 column on phones and 3 columns on computers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* We 'map' over our teams list to create a card for every single team */}
        {teams.map((team) => (
          <div 
            key={team.team_number} 
            className="p-4 border rounded-lg bg-gray-950 border-gray-700 hover:border-red-500 transition"
          >
            {/* Display the team number in big bold text */}
            <h2 className="text-xl font-bold text-red-500">Team {team.team_number}</h2>
            {/* Display the nickname (e.g., The Cheesy Poofs) */}
            <p className="text-gray-300">{team.nickname}</p>
          </div>
        ))}
      </div>
      
      {/* If the list is empty, show a helpful hint */}
      {teams.length === 0 && (
        <p className="text-yellow-500 mt-4 italic">
          No teams found. Did you run the import on the /admin page?
        </p>
      )}
    </div>
    );
}