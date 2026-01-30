'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { report } from 'process';

const labels = ["Speed", "Shooting", "Teleop", "Climb", "Defense"];

export default function TeamDetailPage() {
  const { teamNumber } = useParams();
  const router = useRouter();
  const [reports, setReports] = useState<any[]>([]);
  const [teamStats, setTeamStats] = useState<any>(null);
  const [pitData, setPitData] = useState<any>(null);
  const [maxTeleop, setMaxTeleop] = useState<number>(1);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    const fetchTeamData = async () => {
      try {

        // Fetch scouting reports for match details
        // --- UPDATE THIS SECTION IN TeamDetailPage.tsx ---
      
      //.order('created_at', { ascending: false });

  
        
        // Fetch team averages from database view
        const { data: statsData, error: statsError } = await supabase
          .from('team_averages')
          .select('*')
          .eq('team_number', parseInt(teamNumber as string));

        if (statsError) console.error('Error fetching stats:', statsError);

        // Fetch pit scouting data
        // Use the same key used in your MatchSelector and PitScoutingPage
        const competitionId = localStorage.getItem('scout_last_comp_id');
        console.log('Competition ID from localStorage:', competitionId);
        
        if (competitionId) {
          const { data: pitData, error: pitError } = await supabase
            .from('pit_scouting_reports')
            .select('*')
            .eq('team_number', parseInt(teamNumber as string))
            .eq('competition_id', competitionId)
            .maybeSingle();
          
          if (pitError) console.error('Error fetching pit data:', pitError);
          console.log('Pit data fetched:', pitData);
          setPitData(pitData || null);
          } else {
            console.warn('No competition ID found in localStorage');
            setPitData(null);
          }

        const { data: reportData, error: reportError } = await supabase
          .from('scouting_reports')
          .select(`
            *,
            matches!fk_match (
              match_number
            )
          `) 
          .eq('team_number', parseInt(teamNumber as string))
          .order('created_at', { ascending: false });

        console.log("RAW DATA FROM SUPABASE:", reportData);
  
        if (reportError) console.error('Error fetching reports:', reportError.message);
        console.log('Reports fetched:', reportData);

        setReports(reportData || []);
        setTeamStats(statsData?.[0] || null);
        setMaxTeleop(reportData && reportData.length > 0 ? Math.max(...reportData.map(r => r.teleop_score || 0)) : 1);
        setLoading(false);
      } catch (err) {
        console.error('Fetch error:', err);
        setLoading(false);
      }
    };
    fetchTeamData();
  }, [teamNumber]);

  // Helper functions for individual match stats
  const max = (key: string) => reports.length > 0 ? Math.max(...reports.map(r => r[key] || 0)) : 0;
  
  // Normalized values for the spider graph (0-100 scale) using database averages
  const spiderData = teamStats ? [
    Math.min((teamStats.avg_speed || 0) / 5 * 100, 100),
    Math.min((teamStats.avg_shooting_speed || 0) / 5 * 100, 100),
    Math.min((teamStats.avg_teleop / maxTeleop) * 100, 100),
    (teamStats.avg_climb / 3) * 100,
    Math.min((teamStats.avg_defense || 0) / 5 * 100, 100)
  ] : [0, 0, 0, 0, 0];


  const getPoints = (values: number[]) => {
    return values.map((val, i) => {
      const angle = (Math.PI * 2 * i) / values.length - Math.PI / 2;
      const r = (val / 100) * 80;
      return `${100 + r * Math.cos(angle)},${100 + r * Math.sin(angle)}`;
    }).join(' ');
  };

  // Color map for each node
  const nodeColors = ['#22c55e', '#f97316', '#3b82f6', '#a855f7', '#ef4444']; // Green, Orange, Blue, Purple, Red
  const nodeColorNames = ['fill-green-500', 'fill-orange-500', 'fill-blue-500', 'fill-purple-500', 'fill-red-500'];

  if (loading) return <div className="p-10 text-white">Accessing Neural Records...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-12 text-white">
      <button onClick={() => router.back()} className="text-gray-500 hover:text-white font-bold text-xs uppercase tracking-widest">← Back to Hub</button>

      <div className="flex flex-col lg:flex-row items-start gap-12">
        {/* --- SPIDER GRAPH --- */}
        <div className="w-full lg:w-1/2">
          <div className="relative group bg-gray-900/50 border border-gray-800 rounded-2xl p-6">
            <svg width="100%" height="400" viewBox="0 0 500 500" className="drop-shadow-[0_0_20px_rgba(245,158,11,0.2)]" preserveAspectRatio="xMidYMid meet">
              {/* Background circles */}
              <circle cx="250" cy="250" r="160" className="fill-none stroke-gray-600 stroke-1" opacity="0.5" />
              <circle cx="250" cy="250" r="120" className="fill-none stroke-gray-600 stroke-1" opacity="0.5" />
              <circle cx="250" cy="250" r="80" className="fill-none stroke-gray-600 stroke-1" opacity="0.5" />
              <circle cx="250" cy="250" r="40" className="fill-none stroke-gray-600 stroke-1" opacity="0.5" />
              
              {/* Radial lines */}
              {labels.map((_, i) => {
                const angle = (Math.PI * 2 * i) / labels.length - Math.PI / 2;
                const x = 250 + 160 * Math.cos(angle);
                const y = 250 + 160 * Math.sin(angle);
                return (
                  <line key={`line-${i}`} x1="250" y1="250" x2={x} y2={y} className="stroke-gray-600 stroke-1" opacity="0.5" />
                );
              })}
              
              {/* The Actual Data Shape */}
              <polygon 
                points={labels.map((_, i) => {
                  const angle = (Math.PI * 2 * i) / labels.length - Math.PI / 2;
                  const r = (spiderData[i] / 100) * 160;
                  return `${250 + r * Math.cos(angle)},${250 + r * Math.sin(angle)}`;
                }).join(' ')}
                className="fill-gray-100/25 stroke-gray-500 stroke-2.5 transition-all duration-1000" opacity="0.7"
              />
              
              {/* Data points */}
              {labels.map((_, i) => {
                const angle = (Math.PI * 2 * i) / labels.length - Math.PI / 2;
                const r = (spiderData[i] / 100) * 160;
                return (
                  <circle 
                    key={`dot-${i}`} 
                    cx={250 + r * Math.cos(angle)} 
                    cy={250 + r * Math.sin(angle)} 
                    r="6" 
                    fill={nodeColors[i]} 
                    stroke={nodeColors[i]} 
                    strokeWidth="1"
                  />
                );
              })}
              
              {/* Labels */}
              {labels.map((label, i) => {
                const angle = (Math.PI * 2 * i) / labels.length - Math.PI / 2;
                return (
                  <text 
                    key={label} 
                    x={250 + 200 * Math.cos(angle)} 
                    y={250 + 200 * Math.sin(angle)} 
                    textAnchor="middle" 
                    dominantBaseline="middle" 
                    fill={nodeColors[i]}
                    className="text-sm font-bold uppercase"
                  >
                    {label}
                  </text>
                );
              })}
            </svg>
          </div>
        </div>

        {/* --- TEAM INFO & STATS --- */}
        <div className="flex-1 space-y-8">
          <div>
            <h1 className="text-7xl font-black italic tracking-tighter text-white">#{teamNumber}</h1>
            {teamStats && <p className="text-gray-400 text-sm mt-2">Matches Analyzed: <span className="text-amber-400 font-bold">{teamStats.total_matches}</span></p>}
          </div>

          {/* Performance Badges */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
              <p className="text-[10px] text-blue-400 font-black uppercase mb-1">Speed Avg</p>
              <p className="text-2xl font-black text-blue-300">{teamStats?.avg_speed?.toFixed(1) || '0'}</p>
              <p className="text-[9px] text-gray-500 mt-1">Max: 5</p>
            </div>
            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4">
              <p className="text-[10px] text-cyan-400 font-black uppercase mb-1">Shooting Avg</p>
              <p className="text-2xl font-black text-cyan-300">{teamStats?.avg_shooting_speed?.toFixed(1) || '0'}</p>
              <p className="text-[9px] text-gray-500 mt-1">Max: 5</p>
            </div>
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
              <p className="text-[10px] text-orange-400 font-black uppercase mb-1">Teleop Avg</p>
              <p className="text-2xl font-black text-orange-300">{teamStats?.avg_teleop?.toFixed(1) || '0'}</p>
              <p className="text-[9px] text-gray-500 mt-1">Max: {max('teleop_score').toFixed(0)}</p>
            </div>
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
              <p className="text-[10px] text-green-400 font-black uppercase mb-1">Climb Avg</p>
              <p className="text-2xl font-black text-green-300">L{teamStats?.avg_climb?.toFixed(1) || '0'}</p>
              <p className="text-[9px] text-gray-500 mt-1">Max: L3</p>
            </div>
          </div>

          {/* Event Stats */}
          {teamStats && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider">Event Info</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex justify-between bg-gray-800/50 p-2 rounded">
                  <span className="text-gray-500">Event:</span>
                  <span className="font-mono text-amber-400 text-xs">{teamStats.event_key}</span>
                </div>
                <div className="flex justify-between bg-gray-800/50 p-2 rounded">
                  <span className="text-gray-500">Competition:</span>
                  <span className="font-bold text-xs">{teamStats.competition_id}</span>
                </div>
                <div className="flex justify-between bg-gray-800/50 p-2 rounded col-span-2">
                  <span className="text-gray-500">Capacity:</span>
                  <span className="font-bold text-yellow-400">{teamStats.avg_hopper?.toFixed(1) || '0'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Pit Intel */}
          {pitData ? (
            <div className="bg-gradient-to-br from-purple-900/30 to-indigo-900/30 border border-purple-700/50 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-black text-purple-300 uppercase tracking-wider">Pit Intel</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {pitData.drivetrain_type && (
                  <div className="bg-purple-800/50 p-3 rounded border-l-2 border-purple-500">
                    <p className="text-[9px] text-purple-400 uppercase mb-1">Drivetrain</p>
                    <p className="font-bold text-purple-100">{pitData.drivetrain_type}</p>
                  </div>
                )}
                {pitData.max_climb_level !== null && (
                  <div className="bg-purple-800/50 p-3 rounded border-l-2 border-purple-500">
                    <p className="text-[9px] text-purple-400 uppercase mb-1">Max Climb</p>
                    <p className="font-bold text-purple-100">L{pitData.max_climb_level}</p>
                  </div>
                )}
                {pitData.can_traverse_bump !== null && (
                  <div className="bg-purple-800/50 p-3 rounded border-l-2 border-purple-500">
                    <p className="text-[9px] text-purple-400 uppercase mb-1">Traverse Bump</p>
                    <p className="font-bold text-purple-100">{pitData.can_traverse_bump ? 'Yes' : 'No'}</p>
                  </div>
                )}
                {pitData.can_traverse_trench !== null && (
                  <div className="bg-purple-800/50 p-3 rounded border-l-2 border-purple-500">
                    <p className="text-[9px] text-purple-400 uppercase mb-1">Traverse Trench</p>
                    <p className="font-bold text-purple-100">{pitData.can_traverse_trench ? 'Yes' : 'No'}</p>
                  </div>
                )}
                {pitData.shooter_style && (
                  <div className="bg-purple-800/50 p-3 rounded border-l-2 border-purple-500">
                    <p className="text-[9px] text-purple-400 uppercase mb-1">Shooter Style</p>
                    <p className="font-bold text-purple-100">{pitData.shooter_style}</p>
                  </div>
                )}
                {pitData.intake_type && (
                  <div className="bg-purple-800/50 p-3 rounded border-l-2 border-purple-500">
                    <p className="text-[9px] text-purple-400 uppercase mb-1">Intake Type</p>
                    <p className="font-bold text-purple-100">{pitData.intake_type}</p>
                  </div>
                )}
                {pitData.fuel_capacity !== null && (
                  <div className="bg-purple-800/50 p-3 rounded border-l-2 border-purple-500">
                    <p className="text-[9px] text-purple-400 uppercase mb-1">Fuel Capacity</p>
                    <p className="font-bold text-purple-100">{pitData.fuel_capacity}/5</p>
                  </div>
                )}
              </div>
              {pitData.notes && (
                <div className="bg-purple-800/50 p-3 rounded border-l-2 border-purple-500 col-span-2">
                  <p className="text-[9px] text-purple-400 uppercase mb-1">Pit Notes</p>
                  <p className="text-purple-100 text-sm italic">{pitData.notes}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-4 text-center">
              <p className="text-[9px] text-gray-500 uppercase tracking-widest">No pit data scouted yet</p>
            </div>
          )}
        </div>
      </div>

      {/* --- MATCH LOGS --- */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold uppercase tracking-widest text-gray-500">Field Logs</h2>
        <div className="grid grid-cols-1 gap-3">
          {reports.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 p-5 rounded-xl text-gray-400 text-center">
              No scouting reports found for this team.
            </div>
          ) : (
            reports.map((r, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 p-5 rounded-xl hover:border-amber-600/50 transition-colors">
                <div className="space-y-4">
                  {/* Header with match and scouter info */}
                  <div className="flex justify-between items-start border-b border-gray-700 pb-3">
                    <div>
                      <span className="text-[10px] font-black text-amber-600 block mb-1">MATCH {r.matches?.match_number || "N/A"}</span>
                      <p className="text-sm text-gray-400">Scouter: <span className="text-white font-semibold">{r.scouter_name || 'Unknown'}</span></p>
                    </div>
                    <p className="text-[9px] text-gray-500">{new Date(r.created_at).toLocaleString()}</p>
                  </div>

                  {/* Scoring Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="bg-gray-800/50 p-3 rounded">
                      <p className="text-[9px] text-gray-500 uppercase mb-1">Auto Score</p>
                      <p className="font-bold text-blue-300 text-lg">{r.auto_score || 0}</p>
                    </div>
                    <div className="bg-gray-800/50 p-3 rounded">
                      <p className="text-[9px] text-gray-500 uppercase mb-1">Teleop Score</p>
                      <p className="font-bold text-orange-300 text-lg">{r.teleop_score || 0}</p>
                    </div>
                    <div className="bg-gray-800/50 p-3 rounded">
                      <p className="text-[9px] text-gray-500 uppercase mb-1">Endgame Climb Level</p>
                      <p className="font-bold text-green-300 text-lg">L{r.climb_level || 0}</p>
                    </div>
                    <div className="bg-gray-800/50 p-3 rounded">
                      <p className="text-[9px] text-gray-500 uppercase mb-1">Auto Climb</p>
                      <p className="font-bold text-purple-300 text-lg">{r.auto_climb ? '✓' : '✗'}</p>
                    </div>
                    <div className="bg-gray-800/50 p-3 rounded">
                      <p className="text-[9px] text-gray-500 uppercase mb-1">Speed</p>
                      <p className="font-bold text-cyan-300 text-lg">{r.speed || 0}</p>
                    </div>
                    <div className="bg-gray-800/50 p-3 rounded">
                      <p className="text-[9px] text-gray-500 uppercase mb-1">Defense Rating</p>
                      <p className="font-bold text-red-300 text-lg">{r.defense || 0}</p>
                    </div>
                  </div>

                  {/* Mechanics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-gray-800/50 p-3 rounded">
                      <p className="text-[9px] text-gray-500 uppercase mb-1">Hopper Size</p>
                      <p className="font-bold text-yellow-300">{r.hopper_size || 0}</p>
                    </div>
                    <div className="bg-gray-800/50 p-3 rounded">
                      <p className="text-[9px] text-gray-500 uppercase mb-1">Shooting Speed</p>
                      <p className="font-bold text-yellow-300">{r.shooting_speed || 0}</p>
                    </div>
                    <div className="bg-gray-800/50 p-3 rounded col-span-2">
                      <p className="text-[9px] text-gray-500 uppercase mb-1">Pickup Positions</p>
                      <p className="font-bold text-gray-300 text-sm">{r.pickup_positions || 'N/A'}</p>
                    </div>
                  </div>

                  {/* Notes */}
                  {r.notes && (
                    <div className="bg-gray-800/50 p-3 rounded border-l-2 border-amber-500">
                      <p className="text-[9px] text-gray-500 uppercase mb-1">Notes</p>
                      <p className="text-gray-300 italic">{r.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}