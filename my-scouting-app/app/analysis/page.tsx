'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function AnalysisPage() {
    const [teamStats, setTeamStats] = useState<any[]>([]);
    const [matches, setMatches] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeMatch, setActiveMatch] = useState<any>(null);
    const router = useRouter();
    const [sortBy, setSortBy] = useState('avg_auto');

    useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
      // 1. Fetch our custom "View" we just made in SQL
      const { data: stats } = await supabase.from('team_averages').select('*');
      
      // 2. Fetch the match schedule
      const { data: matchData } = await supabase.from('matches').select('*').order('match_number');

      setTeamStats(stats || []);
      setMatches(matchData || []);
      setLoading(false);
    };

    const filteredTeams = teamStats.filter(t => t.team_number.toString().includes(searchQuery));

if (loading) return <div className="p-10 text-white">Calculating stats...</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-10 bg-black min-h-screen text-white">
      <h1 className="text-4xl font-black tracking-tighter">ANALYSIS HUB</h1>

      {/* --- SECTION 1: TEAM SEARCH & LEADERBOARD --- */}
      <section className="space-y-4">
        <div className="flex justify-between items-end">
          <h2 className="text-xl font-bold text-blue-400">Team Performance</h2>
          <input 
            type="text" 
            placeholder="Search team number..."
            className="bg-gray-900 border border-gray-700 p-2 rounded-lg text-sm w-64 focus:border-blue-500 outline-none"
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900">
          <table className="w-full text-left">
            <thead className="bg-gray-800 text-gray-400 uppercase text-xs">
              <tr>
                <th className="p-4">Team</th>
                <th className="p-4">Avg Auto</th>
                <th className="p-4 text-right">Potential</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
            {filteredTeams
            .sort((a,b) => b[sortBy] - a[sortBy])
            .map((stat) => (
                <tr 
                key={stat.team_number} 
                onClick={() => router.push(`/analysis/team/${stat.team_number}`)}
                className="hover:bg-blue-900/10 cursor-pointer transition-colors group"
                >
                <td className="p-4">
                    <span className="font-bold text-lg group-hover:text-blue-400">
                    {stat.team_number}
                    </span>
                </td>
                <td className="p-4 text-green-400 font-mono">
                    {stat.avg_auto}
                </td>
                <td className="p-4 text-right">
                    {/* Potential bar remains the same */}
                    <div className="inline-block w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div 
                        className="bg-blue-500 h-full" 
                        style={{ width: `${Math.min(stat.avg_auto * 15, 100)}%` }}
                        ></div>
                    </div>
                </td>
                </tr>
            ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* --- SECTION 2: MATCH SCHEDULE --- */}
      <section>
        <h2 className="text-xl font-bold mb-4 text-red-400">Match Intelligence</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {matches.map((m) => (
            <div 
              key={m.id} 
              onClick={() => setActiveMatch(m)} // CLICK TO OPEN SUMMARY
              className="p-4 bg-gray-1000 border border-gray-500 xl flex items-center justify-between cursor-pointer hover:border-red-600 transition"
            >
              <span className="font-bold text-gray-500">QM {m.match_number}</span>
              <div className="flex gap-4">
                <div className="flex -space-x-0">
                  {m.red_alliance.map((t: any) => <div key={t} className="w-9 h-9 rounded-full bg-red-700 border-1 border-gray-900 flex items-center justify-center text-[10px] font-bold">{t}</div>)}
                </div>
                <div className="flex -space-x-0">
                  {m.blue_alliance.map((t: any) => <div key={t} className="w-9 h-9 rounded-full bg-blue-700 border-1 border-gray-900 flex items-center justify-center text-[10px] font-bold">{t}</div>)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* --- SECTION 3: THE MATCH SUMMARY OVERLAY (MODAL) --- */}
      {activeMatch && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-gray-700 w-full max-w-2xl rounded-3xl p-8 relative overflow-hidden">
            <button 
              onClick={() => setActiveMatch(null)}
              className="absolute top-4 right-4 text-gray-500 hover:text-white text-2xl"
            >✕</button>

            <h2 className="text-3xl font-black mb-6">Match {activeMatch.match_number} Breakdown</h2>
            
            <div className="grid grid-cols-2 gap-8">
              {/* RED SUMMARY */}
              <div className="space-y-4">
                <h3 className="text-red-500 font-bold border-b border-red-900/50 pb-2">Red Alliance</h3>
                {activeMatch.red_alliance.map((t: number) => {
                  const stats = teamStats.find(s => s.team_number === t);
                  return (
                    <div key={t} className="flex justify-between items-center">
                      <span className="font-bold text-xl">{t}</span>
                      <span className="text-gray-400 text-sm">Avg Auto: {stats?.avg_auto || '0.0'}</span>
                    </div>
                  );
                })}
              </div>

              {/* BLUE SUMMARY */}
              <div className="space-y-4">
                <h3 className="text-blue-500 font-bold border-b border-blue-900/50 pb-2">Blue Alliance</h3>
                {activeMatch.blue_alliance.map((t: number) => {
                  const stats = teamStats.find(s => s.team_number === t);
                  return (
                    <div key={t} className="flex justify-between items-center">
                      <span className="font-bold text-xl">{t}</span>
                      <span className="text-gray-400 text-sm">Avg Auto: {stats?.avg_auto || '0.0'}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-800 text-center">
               <p className="text-gray-500 text-sm italic">Compare these stats to predict which alliance will win the Auto period.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}