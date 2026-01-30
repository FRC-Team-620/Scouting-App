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
  const [sortedStat, setSortedStat] = useState('');
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

  // --- SORTING LOGIC ---
  const getSortedTeams = () => {
    const teams = [...filteredTeams];
    if (!sortedStat || sortedStat === 'team_number') {
      return teams.sort((a, b) => a.team_number - b.team_number);
    }

    return teams.sort((a, b) => {
      const valA = a[sortedStat] || 0;
      const valB = b[sortedStat] || 0;
      return valB - valA; // Descending order (Highest stats first)
    });
  };

  const activeTeams = getSortedTeams();

  const handleSort = (statKey: string) => {
    // If clicking the same stat, you could implement a toggle, 
    // but for scouting, "Highest First" is usually the priority.
    setSortedStat(statKey);
  };

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
          <h1 className="text-5xl font-black text-red-700 tracking-tighter">TEAM ANALYSIS HUB</h1>
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
      
      
      <section className="space-y-4">
  <div className="flex justify-between items-center">
    <h2 className="text-xl font-bold text-blue-400 uppercase tracking-widest">Scout Rankings</h2>
    <p className="text-[10px] text-gray-500 font-bold uppercase">
      Sorting by: <span className="text-amber-500">{sortedStat || 'Default'}</span>
    </p>
  </div>

  <div className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900/40">
    <table className="w-full text-left border-collapse">
      <thead className="bg-gray-800/50 text-gray-400 uppercase text-[10px] font-black">
        <tr>
          <th className="p-4 cursor-pointer hover:text-white" onClick={() => handleSort('team_number')}>Team</th>
          
          {/* SORTABLE HEADERS */}

          <th 
            className={`p-4 cursor-pointer transition-colors hover:text-blue-400 ${sortedStat === 'avg_auto' ? 'text-blue-400 bg-blue-400/5' : ''}`}
            onClick={() => handleSort('avg_score')}
          >
            Avg Score {sortedStat === 'avg_score' && '▼'}
          </th>


          <th 
            className={`p-4 cursor-pointer transition-colors hover:text-blue-400 ${sortedStat === 'avg_auto' ? 'text-blue-400 bg-blue-400/5' : ''}`}
            onClick={() => handleSort('avg_auto')}
          >
            Avg Auto {sortedStat === 'avg_auto' && '▼'}
          </th>
          
          <th 
            className={`p-4 cursor-pointer transition-colors hover:text-orange-400 ${sortedStat === 'avg_teleop' ? 'text-orange-400 bg-orange-400/5' : ''}`}
            onClick={() => handleSort('avg_teleop')}
          >
            Avg Teleop {sortedStat === 'avg_teleop' && '▼'}
          </th>
          
          <th 
            className={`p-4 cursor-pointer transition-colors hover:text-purple-400 ${sortedStat === 'avg_climb' ? 'text-purple-400 bg-purple-400/5' : ''}`}
            onClick={() => handleSort('avg_climb')}
          >
            Avg Climb {sortedStat === 'avg_climb' && '▼'}
          </th>

          <th 
            className={`p-4 cursor-pointer transition-colors hover:text-red-400 ${sortedStat === 'avg_climb' ? 'text-red-400 bg-red-400/5' : ''}`}
            onClick={() => handleSort('avg_defense')}
          >
            Avg Defense {sortedStat === 'avg_defense' && '▼'}
          </th>

          <th 
            className={`p-4 cursor-pointer transition-colors hover:text-orange-500 ${sortedStat === 'avg_climb' ? 'text-orange-500 bg-orange-500/5' : ''}`}
            onClick={() => handleSort('avg_shooting_speed')}
          >
            Avg Shooting Speed {sortedStat === 'avg_shooting_speed' && '▼'}
          </th>

          <th 
            className={`p-4 cursor-pointer transition-colors hover:text-green-500 ${sortedStat === 'avg_climb' ? 'text-green-500 bg-green-500/5' : ''}`}
            onClick={() => handleSort('avg_speed')}
          >
            Avg Movement Speed {sortedStat === 'avg_speed' && '▼'}
          </th>
          
        </tr>
      </thead>
      
      <tbody className="divide-y divide-gray-800">
        {activeTeams.map((stat) => (
          <tr 
            key={stat.team_number} 
            onClick={() => router.push(`/analysis/teams/team/${stat.team_number}`)}
            className="hover:bg-amber-500/5 cursor-pointer transition-colors group"
          >
            <td className="p-4">
              <span className="font-black text-2xl group-hover:text-amber-400 transition-colors">
                {stat.team_number}
              </span>
            </td>
            <td className={`p-4 font-mono font-bold ${sortedStat === 'avg_score' ? 'bg-blue-400/5 text-blue-300' : 'text-blue-400/60'}`}>
              {stat.avg_score}
            </td>
            <td className={`p-4 font-mono font-bold ${sortedStat === 'avg_auto' ? 'bg-blue-400/5 text-blue-300' : 'text-blue-400/60'}`}>
              {stat.avg_auto}
            </td>
            <td className={`p-4 font-mono font-bold ${sortedStat === 'avg_teleop' ? 'bg-orange-300/5 text-orange-300' : 'text-orange-300/60'}`}>
              {stat.avg_teleop}
            </td>
            <td className={`p-4 font-bold ${sortedStat === 'avg_climb' ? 'bg-purple-400/5 text-purple-300' : 'text-purple-500/60'}`}>
              {stat.avg_climb}
            </td>
            <td className={`p-4 font-bold ${sortedStat === 'avg_defense' ? 'bg-red-400/5 text-red-300' : 'text-red-500/60'}`}>
              {stat.avg_defense}
            </td>
            <td className={`p-4 font-bold ${sortedStat === 'avg_shooting_speed' ? 'bg-orange-500/5 text-orange-500' : 'text-orange-500/60'}`}>
              {stat.avg_climb}
            </td>
            <td className={`p-4 font-bold ${sortedStat === 'avg_speed' ? 'bg-green-500/5 text-green-500' : 'text-green-500/60'}`}>
              {stat.avg_speed}
            </td>
            
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</section>
    </div>
    );
}