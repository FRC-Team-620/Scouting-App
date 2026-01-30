'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function MatchAnalysisPage() {
  const [competitions, setCompetitions] = useState<any[]>([]);
  const [selectedCompId, setSelectedCompId] = useState<string>("");
  const [matches, setMatches] = useState<any[]>([]);
  const [teamStats, setTeamStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      // 1. Get Competitions
      const { data: compData } = await supabase.from('competitions').select('*').order('year', { ascending: false });
      if (!compData) return;
      setCompetitions(compData);

      // Sticky ID Logic
      const savedCompId = localStorage.getItem('analysis_last_comp_id') || compData[0]?.id.toString();
      setSelectedCompId(savedCompId);
      const activeComp = compData.find(c => c.id.toString() === savedCompId);

      const tbaResponse = await fetch(`/api/get-tba-results?event=${activeComp.event_key}`);

      // 2. Fetch Team Stats (for predictions)
      const { data: tStats } = await supabase.from('team_averages').select('*').eq('competition_id', savedCompId);
      setTeamStats(tStats || []);

      // 3. Fetch Matches + Scouting Counts
      const { data: localMatches } = await supabase
        .from('matches')
        .select('*, scouting_reports(id, teleop_score, auto_score, climb_level)')
        .eq('competition_id', savedCompId)
        .order('match_number', { ascending: true });

      // 4. Fetch TBA Real-time Data
      // We call your internal API route to get TBA data safely

      setMatches(localMatches || []);
      setLoading(false);
    };
    init();
  }, [selectedCompId]);


  // --- REBUILT PREDICTION ENGINE ---
  const getAlliancePrediction = (teamNums: number[]) => {
    let totalScore = 0;
    let autoClimbers = 0;

    teamNums.forEach(num => {
      const stats = teamStats.find(s => s.team_number === num);
      if (!stats) return;

      // 1. AUTO POINTS (1pt per Fuel, 10pts per Climb)
      totalScore += (stats.avg_auto || 0);
      
      // Auto Climb (Max 2 robots per alliance can earn points)
      if (stats.auto_climb_rate > 0.5 && autoClimbers < 2) {
        totalScore += 10;
        autoClimbers++;
      }

      totalScore += (stats.avg_teleop_fuel || 0 );

      // 3. ENDGAME CLIMB
      // Level 1: 15 | Level 2: 20 | Level 3: 30
      const climbLevel = Math.round(stats.avg_climb_level || 0);
      if (climbLevel === 3) totalScore += 30;
      else if (climbLevel === 2) totalScore += 20;
      else if (climbLevel === 1) totalScore += 15;
    });

    return totalScore.toFixed(1);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-12 bg-black min-h-screen text-white font-mono">
      {/* HEADER SECTION */}
      <div className="flex justify-between items-end border-b border-gray-800 pb-6">
        <div>
          <h1 className="text-6xl font-black text-red-700 italic tracking-tighter uppercase">Neural Hub // Rebuilt</h1>
          <p className="text-gray-500 text-xs mt-2 uppercase tracking-[0.3em]">Predictive Combat Intelligence Engine</p>
        </div>
        <select 
          value={selectedCompId} 
          onChange={(e) => {
            setSelectedCompId(e.target.value);
            localStorage.setItem('analysis_last_comp_id', e.target.value);
          }}
          className="bg-gray-900 border border-gray-800 p-2 rounded text-[10px] font-bold uppercase tracking-widest outline-none focus:border-red-600 transition-colors"
        >
          {competitions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <input 
          type="text" 
          placeholder="Search team number..."
          className="bg-gray-900 border border-gray-700 p-3 rounded-xl text-sm w-full md:w-80 focus:border-blue-500 outline-none"
          onChange={(e) => setSearchQuery(e.target.value)}
        />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        
        {/* LEFT COLUMN: UPCOMING PREDICTIONS */}
        <section className="space-y-6">
          <h2 className="text-sm font-black text-blue-500 uppercase tracking-[0.4em] flex items-center gap-3">
            <span className="h-1 w-8 bg-blue-600"></span> Next Deployments
          </h2>
          {matches.filter(m => !m.actual_red && (m.red_alliance.toString().includes(searchQuery) || m.blue_alliance.toString().includes(searchQuery))).slice(0, 7).map(m => {
            const redPred = parseFloat(getAlliancePrediction(m.red_alliance));
            const bluePred = parseFloat(getAlliancePrediction(m.blue_alliance));
            const winProb = ((redPred / (redPred + bluePred)) * 100).toFixed(0);

            return (
              <div key={m.id} className="bg-gray-900/40 border border-gray-800 p-6 rounded-sm relative group overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-600 group-hover:w-2 transition-all"></div>
                <div className="flex justify-between mb-6">
                  <span className="text-[10px] font-bold text-gray-500 tracking-widest">QUAL {m.match_number}</span>
                  <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Win Prob: Red {winProb}%</span>
                </div>
                
                <div className="flex justify-between items-center px-4">
                  <AllianceList teams={m.red_alliance} color="red" prediction={redPred} />
                  <div className="text-2xl font-black italic text-gray-800 opacity-50">VS</div>
                  <AllianceList teams={m.blue_alliance} color="blue" prediction={bluePred} />
                </div>
              </div>
            );
          })}
        </section>

        {/* RIGHT COLUMN: PREDICTION ACCURACY (POST-MORTEM) */}
        <section className="space-y-6">
  <h2 className="text-sm font-black text-red-600 uppercase tracking-[0.4em] flex items-center gap-3">
    <span className="h-1 w-8 bg-red-600"></span> Neural vs Reality
  </h2>
  {/* FIX: Check for !== null so that a score of 0 doesn't hide the match */}
  {matches.filter(m => m.red_score !== null && m.scouting_reports?.length > 0).reverse().slice(0, 7).map(m => {
    const redPred = parseFloat(getAlliancePrediction(m.red_alliance));
    const bluePred = parseFloat(getAlliancePrediction(m.blue_alliance));
    
    const isCorrect = (m.red_score > m.blue_score) === (redPred > bluePred);
    
    // FIX: Ensure values are treated as numbers to avoid NaN
    const actualTotal = (Number(m.red_score) || 0) + (Number(m.blue_score) || 0);
    const predTotal = redPred + bluePred;
    const totalDelta = Math.abs(actualTotal - predTotal).toFixed(1);

    return (
      <div key={m.id} className="bg-gray-900/20 border border-gray-800 p-6 rounded-sm relative transition-all hover:bg-gray-900/40">
        <div className={`absolute top-0 right-0 px-3 py-1 text-[8px] font-black uppercase tracking-widest ${isCorrect ? 'bg-green-600' : 'bg-red-700'}`}>
          {isCorrect ? 'Prediction Verified' : 'Neural Error'}
        </div>
        
        <div className="flex justify-between items-center mb-4">
          <span className="text-[10px] font-bold text-gray-600 uppercase">Qual {m.match_number} // Result</span>
        </div>

        <div className="grid grid-cols-3 gap-2 items-center">
          <div className="text-center">
            {/* FIX: Use red_score */}
            <p className="text-3xl font-black text-red-600">{m.red_score}</p>
            <p className="text-[9px] text-gray-500 uppercase mt-1">Proj: {redPred.toFixed(1)}</p>
          </div>
          
          <div className="text-center py-2 bg-gray-800/30 border border-gray-800 rounded-sm">
            <p className="text-[8px] font-bold text-gray-500 uppercase tracking-tighter">Variance</p>
            <p className={`text-sm font-black ${parseFloat(totalDelta) < 20 ? 'text-green-500' : 'text-amber-500'}`}>
              {totalDelta}
            </p>
          </div>

          <div className="text-center">
            {/* FIX: Use blue_score */}
            <p className="text-3xl font-black text-blue-600">{m.blue_score}</p>
            <p className="text-[9px] text-gray-500 uppercase mt-1">Proj: {bluePred.toFixed(1)}</p>
          </div>
        </div>
      </div>
    );
  })}
</section>
      </div>
    </div>
  );
}

function AllianceList({ teams, color, prediction }: any) {
  const textColor = color === 'red' ? 'text-red-500' : 'text-blue-500';
  return (
    <div className={`flex flex-col ${color === 'blue' ? 'items-end' : 'items-start'}`}>
      {teams.map((t: number) => (
        <span key={t} className={`text-xl font-black italic ${textColor}`}>{t}</span>
      ))}
      <div className="mt-2 pt-2 border-t border-gray-800">
        <span className="text-[9px] text-gray-500 uppercase font-bold">Proj: </span>
        <span className="text-sm font-black text-white">{prediction}</span>
      </div>
    </div>
  );
}