'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function AnalysisPage() {
  const [teamStats, setTeamStats] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [competitions, setCompetitions] = useState<any[]>([]);
  const [selectedCompId, setSelectedCompId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      // 1. Fetch competitions for the dropdown
      const { data: compData } = await supabase.from('competitions').select('*').order('year');
      if (compData && compData.length > 0) {
        setCompetitions(compData);

        const savedCompId = localStorage.getItem('analysis_last_comp_id');

        if(savedCompId && compData.find(c => c.id.toString() === savedCompId)){
          setSelectedCompId(savedCompId);
        }else if(compData && compData.length > 0){
          setSelectedCompId(compData[0].id.toString());
        }
      }

      // 2. Fetch team averages (Assuming the view includes competition_id)
      const { data: stats } = await supabase.from('team_averages').select('*');
      
      // 3. Fetch match schedule
      const { data: matchData } = await supabase.from('matches').select('*').order('match_number');

      setTeamStats(stats || []);
      setMatches(matchData || []);
      setLoading(false);
    };
    fetchData();
  }, []);

  // Filter teams and matches based on the selected competition
  const filteredTeams = teamStats.filter(t => 
    t.competition_id === selectedCompId && 
    t.team_number.toString().includes(searchQuery)
  );

  const handleCompChange = (compId: string) => {
      setSelectedCompId(compId);
      localStorage.setItem('analysis_last_comp_id', compId);
    }

  const filteredMatches = matches.filter(m => m.competition_id === selectedCompId);

  if (loading) return <div className="p-10 text-white animate-pulse">Synchronizing Chronos Archives...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-10 bg-black min-h-screen text-white">
      {/* --- HEADER & COMP SELECT --- */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-6">
        <div className="space-y-2">
          <h1 className="text-5xl font-black text-red-700 tracking-tighter">ANALYSIS HUB</h1>
          <div className="flex items-center gap-3">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Active Event:</label>
            <select 
              value={selectedCompId}
              onChange={(e) => handleCompChange(e.target.value)}
              className="bg-gray-900 border border-gray-700 text-red-700 text-sm rounded-lg p-2 outline-none focus:border-amber-500 transition-all"
            >
              {competitions.map(c => (
                <option key={c.id} value={c.id}> {c.year} - {c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <input 
          type="text" 
          placeholder="Search team number..."
          className="bg-gray-900 border border-gray-700 p-3 rounded-xl text-sm w-full md:w-80 focus:border-blue-500 outline-none"
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* --- SECTION 1: LEADERBOARD --- */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-blue-400 uppercase tracking-widest">Scout Rankings</h2>
        <div className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900/40">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-800/50 text-gray-400 uppercase text-[10px] font-black">
              <tr>
                <th className="p-4">Team</th>
                <th className="p-4">Avg Auto</th>
                <th className="p-4">Avg Teleop</th>
                <th className="p-4">Climb (L1-3)</th>
                <th className="p-4 text-right">Potential</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filteredTeams.sort((a,b) => b.avg_auto - a.avg_auto).map((stat) => (
                <tr 
                  key={stat.team_number} 
                  onClick={() => router.push(`/analysis/team/${stat.team_number}`)}
                  className="hover:bg-amber-500/5 cursor-pointer transition-colors group"
                >
                  <td className="p-4"><span className="font-black text-2xl group-hover:text-amber-400 transition-colors">{stat.team_number}</span></td>
                  <td className="p-4 text-blue-400 font-mono font-bold">{stat.avg_auto}</td>
                  <td className="p-4 text-orange-400 font-mono font-bold">{stat.avg_teleop}</td>
                  <td className="p-4 font-bold text-green-500">L{Math.round(stat.avg_climb)}</td>
                  <td className="p-4 text-right">
                    <div className="inline-block w-32 h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div className="bg-amber-500 h-full" style={{ width: `${Math.min(stat.avg_auto * 8, 100)}%` }}></div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* --- SECTION 2: MATCH PREVIEWS --- */}
      <section className="space-y-6">
        <h2 className="text-xl font-bold text-red-500 uppercase tracking-widest">Upcoming Strategy</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMatches.map((m) => (
            <div key={m.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-red-600 transition-all group">
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs font-black text-gray-500">QUAL MATCH {m.match_number}</span>
                <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></div>
              </div>
              <div className="flex justify-between items-center">
                <div className="space-y-1">
                  {m.red_alliance.map((t: number) => (
                    <div key={t} onClick={() => router.push(`/analysis/team/${t}`)} className="text-lg font-black text-red-500 hover:underline cursor-pointer">{t}</div>
                  ))}
                </div>
                <div className="text-xs font-black text-gray-700 italic">VS</div>
                <div className="space-y-1 text-right">
                  {m.blue_alliance.map((t: number) => (
                    <div key={t} onClick={() => router.push(`/analysis/team/${t}`)} className="text-lg font-black text-blue-500 hover:underline cursor-pointer">{t}</div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}