'use client';

import { useParams } from 'next/navigation'; // Tool to grab the team number from the URL
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function TeamDetailPage(){
    const params = useParams();
    const teamNumber = params.teamNumber;

    const [reports, setReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTeamData = async () => {
        // Fetch all reports where team_number matches our URL
            // app/analysis/team/[teamNumber]/page.tsx

            // Use the name of the foreign key column to clarify the join
            const { data, error } = await supabase
            .from('scouting_reports')
            .select(`
                auto_score,
                scouter_name,
                notes,
                teleop_score,
                created_at,
                matches!scouting_reports_match_id_fkey (
                    match_number
                )
            `) 
            .eq('team_number', teamNumber)
            .order('created_at', { ascending: true });

            if (error){
                console.error(error.message);
            }else{ 
                setReports(data || []);
            }
            setLoading(false);
        };
        fetchTeamData();
    }, [teamNumber]);

    const totalReports = reports.length;
    const avgAuto = totalReports > 0 ? (reports.reduce((acc, r) => acc + r.auto_score, 0) / totalReports).toFixed(2): 0;
    const maxAuto = Math.max(...reports.map(r => r.auto_score), 0);


if (loading) return <div className="p-10 text-white">Loading stats for {teamNumber}...</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 text-white">
      <header className="flex justify-between items-center border-b border-gray-800 pb-6">
        <div>
          <h1 className="text-5xl font-black text-blue-500">TEAM {teamNumber}</h1>
          <p className="text-gray-400 mt-2">Historical Performance & Match Log</p>
        </div>
        <div className="text-right">
          <p className="text-4xl font-mono text-green-400">{avgAuto}</p>
          <p className="text-xs text-gray-500 uppercase font-bold tracking-widest">Avg Auto Score</p>
        </div>
      </header>

      {/* --- QUICK STATS CARDS --- */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800 text-center">
          <p className="text-gray-500 text-xs font-bold uppercase">Matches Scouted</p>
          <p className="text-3xl font-bold">{totalReports}</p>
        </div>
        <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800 text-center">
          <p className="text-gray-500 text-xs font-bold uppercase">Peak Auto</p>
          <p className="text-3xl font-bold text-yellow-500">{maxAuto}</p>
        </div>
        <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800 text-center">
          <p className="text-gray-500 text-xs font-bold uppercase">Consistency</p>
          <p className="text-3xl font-bold">{totalReports > 1 ? 'Stable' : 'N/A'}</p>
        </div>
      </div>

      {/* --- FULL MATCH HISTORY --- */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold">Match-by-Match Breakdown</h2>
        <div className="space-y-2">
          {reports.map((report, index) => (
            <div key={index} className="flex items-center justify-between p-4 bg-gray-900/50 rounded-xl border border-gray-800">
                <span className="font-bold text-gray-400">
                Match {report.matches?.match_number || 'N/A'}
                </span>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-xs text-gray-500 uppercase">Auto Score</p>
                  <p className="font-mono font-bold text-blue-400">{report.auto_score}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 uppercase">Scouted By</p>
                  <p className="text-sm">{report.scouter_name}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}