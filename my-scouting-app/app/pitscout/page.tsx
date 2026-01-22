'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
//import { Camera, Save, ChevronLeft } from 'lucide-react';

export default function PitScoutingPage() {
  const [competitions, setCompetitions] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedCompId, setSelectedCompId] = useState<string>("");
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingPitData, setExistingPitData] = useState<any>(null);

  // Form State
  const [teamNumber, setTeamNumber] = useState<string>("");
  const [drivetrain, setDrivetrain] = useState("Swerve");
  const [canBump, setCanBump] = useState(false);
  const [canTrench, setCanTrench] = useState(false);
  const [shooterStyle, setShooterStyle] = useState("turret"); // turret, fixed_single, buckshot
  const [maxClimb, setMaxClimb] = useState(0); 
  const [hopperSize, setHopperSize] = useState(3);
  const [notes, setNotes] = useState("");

  const [canAutoClimb, setCanAutoClimb] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.from('competitions').select('*').order('year', { ascending: false });
      setCompetitions(data || []);
      
      const savedCompId = localStorage.getItem('scout_last_comp_id');
      if (savedCompId && data?.find(c => c.id === savedCompId)) {
        setSelectedCompId(savedCompId);
      } else if (data && data.length > 0) {
        setSelectedCompId(data[0].id);
      }
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    const fetchTeams = async () => {
      if (!selectedCompId) return;
      
      // Fetch all matches for this competition to get all teams
      const { data: matches } = await supabase
        .from('matches')
        .select('red_alliance, blue_alliance')
        .eq('competition_id', selectedCompId);

      // Extract unique team numbers from alliances
      const teamSet = new Set<number>();
      if (matches) {
        matches.forEach(match => {
          if (match.red_alliance) match.red_alliance.forEach((t: number) => teamSet.add(t));
          if (match.blue_alliance) match.blue_alliance.forEach((t: number) => teamSet.add(t));
        });
      }

      // Convert to array and sort
      const uniqueTeams = Array.from(teamSet)
        .sort((a, b) => a - b)
        .map(team_number => ({ team_number }));

      setTeams(uniqueTeams);
      setTeamNumber(""); // Reset team selection when competition changes
    };
    fetchTeams();
  }, [selectedCompId]);

  useEffect(() => {
    const checkExistingData = async () => {
      if (!teamNumber || !selectedCompId) {
        setExistingPitData(null);
        return;
      }

      const { data } = await supabase
        .from('pit_scouting_reports')
        .select('*')
        .eq('competition_id', selectedCompId)
        .eq('team_number', parseInt(teamNumber))
        .single();

      setExistingPitData(data || null);
    };

    const debounceTimer = setTimeout(checkExistingData, 300);
    return () => clearTimeout(debounceTimer);
  }, [teamNumber, selectedCompId]);

  const submitPitReport = async () => {
    if (!teamNumber || !selectedCompId) return alert("Enter a team number!");
    setSaving(true);

    const { error } = await supabase.from('pit_scouting_reports').upsert({
      competition_id: selectedCompId,
      team_number: parseInt(teamNumber),
      drivetrain_type: drivetrain,
      can_traverse_bump: canBump,
      can_traverse_trench: canTrench,
      shooter_style: shooterStyle,
      intake_type: "", // Add as needed
      fuel_capacity: hopperSize,
      max_climb_level: maxClimb,
      robot_weight_lbs: 0, // Add as needed
      scouter_name: "User",
      notes: notes,
      image_url: "" // Add as needed
    });

    setSaving(false);
    if (error) alert(error.message);
    else {
      alert(`Team ${teamNumber} Saved!`);
      // Reset form
      setTeamNumber("");
      setDrivetrain("Swerve");
      setCanBump(false);
      setCanTrench(false);
      setShooterStyle("turret");
      setMaxClimb(0);
      setHopperSize(3);
      setNotes("");
      setExistingPitData(null);
    }
  };

  if (loading) return <div className="p-10 text-gray-500 font-bold uppercase tracking-widest">Initialising...</div>;

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* --- STICKY HEADER --- */}
      <div className="sticky top-0 z-30 bg-black/90 backdrop-blur-md border-b border-gray-800 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-blue-500 uppercase tracking-[0.2em]">Pit Technical Report</span>
            <h1 className="text-xl font-black italic uppercase">REBUILT 2026</h1>
          </div>
          <select 
            value={selectedCompId}
            onChange={(e) => setSelectedCompId(e.target.value)}
            className="bg-gray-900 text-[10px] font-bold border border-gray-700 rounded px-2 py-1 outline-none"
          >
            {competitions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="p-6 max-w-2xl mx-auto space-y-8">
        {/* --- EXISTING DATA ALERT --- */}
        {existingPitData && teamNumber && (
          <div className="bg-amber-900/30 border border-amber-600/50 p-4 rounded-xl">
            <p className="text-amber-400 font-bold text-sm">⚠️ Pit scout data already exists for Team {teamNumber}</p>
            <p className="text-amber-300 text-xs mt-1">Last updated: {new Date(existingPitData.updated_at).toLocaleString()}</p>
          </div>
        )}

        {/* --- TEAM SELECTION --- */}
        <div className="bg-gray-900/50 p-6 rounded-3xl border border-gray-800 shadow-xl relative">
          <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-4">Target Team</label>
          <input 
            type="text"
            placeholder="Enter team number..."
            value={teamNumber}
            onChange={(e) => {
              setTeamNumber(e.target.value);
              setShowTeamDropdown(true);
            }}
            onFocus={() => setShowTeamDropdown(true)}
            onBlur={() => setTimeout(() => setShowTeamDropdown(false), 200)}
            className="bg-gray-800 border border-gray-700 text-2xl font-black w-full outline-none text-blue-500 px-4 py-3 rounded-lg"
          />
          
          {/* Dropdown */}
          {showTeamDropdown && teamNumber && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-64 overflow-y-auto z-10">
              {teams
                .filter(t => t.team_number.toString().includes(teamNumber))
                .slice(0, 10)
                .map(t => (
                  <button
                    key={t.team_number}
                    onClick={() => {
                      setTeamNumber(t.team_number.toString());
                      setShowTeamDropdown(false);
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-gray-700 border-b border-gray-700 last:border-b-0 text-xl font-bold text-blue-400 transition-colors"
                  >
                    {t.team_number}
                  </button>
                ))}
              {teams.filter(t => t.team_number.toString().includes(teamNumber)).length === 0 && (
                <div className="px-4 py-3 text-gray-500 text-center">No teams found</div>
              )}
            </div>
          )}
        </div>

        {/* --- MOBILITY SECTION --- */}
        <div className="space-y-4">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Drivetrain & Mobility</label>
          
          <div className="grid grid-cols-2 gap-3">
            {['Swerve', 'Tank', 'Mecanum', 'Other'].map(type => (
              <button 
                key={type}
                onClick={() => setDrivetrain(type)}
                className={`p-4 rounded-2xl font-bold border-2 transition-all ${drivetrain === type ? 'bg-blue-600 border-blue-400' : 'bg-gray-900 border-gray-800 text-gray-500'}`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* TOGGLES: BUMP & TRENCH */}
          <div className="grid grid-cols-3 gap-2">
            <ToggleButton 
              label="Can Traverse Bump" 
              active={canBump} 
              onClick={() => setCanBump(!canBump)} 
            />
            <ToggleButton 
              label="Can Clear Trench" 
              active={canTrench} 
              onClick={() => setCanTrench(!canTrench)} 
            />
            <ToggleButton
              label="Can Climb in Auto"
              active={canAutoClimb}
              onClick={() => setCanAutoClimb(!canAutoClimb)} 
            />
          </div>
        </div>

        {/* --- SCORING STYLE --- */}
        <div className="space-y-4">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Shooting Style</label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { id: 'turret', label: 'Turret' },
              { id: 'fixed_single', label: 'Fixed' },
              { id: 'buckshot', label: 'Spread' },
              {id: 'other', label: 'Other'}
            ].map((style) => (
              <button
                key={style.id}
                onClick={() => setShooterStyle(style.id)}
                className={`p-3 rounded-xl font-bold text-xs uppercase border-2 transition-all ${
                  shooterStyle === style.id ? 'bg-orange-600 border-orange-400' : 'bg-gray-900 border-gray-800 text-gray-600'
                }`}
              >
                {style.label}
              </button>
            ))}
          </div>
        </div>

        {/* --- HOPPER CAPACITY SLIDER --- */}
        <div className="bg-gray-900/50 p-6 rounded-3xl border border-gray-800">
          <div className="flex justify-between items-center mb-6">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Hopper Capacity</label>
            <span className="bg-purple-500/20 text-purple-400 text-[10px] font-black px-3 py-1 rounded-full uppercase">
              {hopperSize === 1 && "< 10 Fuel"}
              {hopperSize === 2 && "10-20 Fuel"}
              {hopperSize === 3 && "20-30 Fuel"}
              {hopperSize === 4 && "30-40 Fuel"}
              {hopperSize === 5 && "40+ Fuel)"}
            </span>
          </div>
          <input 
            type="range" min="1" max="5" step="1"
            value={hopperSize} 
            onChange={(e) => setHopperSize(parseInt(e.target.value))} 
            className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-purple-500" 
          />
        </div>

        {/* --- MAX CLIMB (TABS) --- */}
        <div className="space-y-4">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Highest Climb Capability</label>
          <div className="grid grid-cols-4 gap-2">
            {[0, 1, 2, 3].map((level) => (
              <button
                key={level}
                onClick={() => setMaxClimb(level)}
                className={`flex flex-col items-center justify-center p-4 rounded-2xl font-black border-2 transition-all ${
                  maxClimb === level ? 'bg-red-600 border-red-400' : 'bg-gray-900 border-gray-800 text-gray-500'
                }`}
              >
                <span className="text-2xl">{level === 0 ? "No Climb" : ` L${level} `}</span>

              </button>
            ))}
          </div>
        </div>

        {/* --- NOTES SECTION --- */}
        <div className="bg-gray-900/50 p-6 rounded-3xl border border-gray-800">
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Additional Notes</label>
          <textarea 
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-transparent text-lg font-medium text-white placeholder:text-gray-500 rounded-lg p-4 resize-none outline-none"
            rows={4}
            placeholder="Any other details about the robot's capabilities..."
          />
        </div>

        {/* --- SUBMIT BUTTON --- */}
        <div className="pt-4">
          <button 
            onClick={submitPitReport}
            className={`w-full py-4 rounded-3xl font-bold transition-all flex items-center justify-center space-x-3
            ${saving ? 'bg-blue-600/50 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'}`}
            disabled={saving}
          >
            {saving ? (
              <>Saving... <span className="animate-spin">🔄</span></>
            ) : (
              <>Save Pit Report</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ToggleButton component
function ToggleButton({ label, subtext, active, onClick }: { label: string; subtext?: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start p-4 rounded-2xl font-bold border-2 transition-all w-full text-left ${
        active ? 'bg-green-800 border-green-400 text-white' : 'bg-gray-900 border-gray-800 text-gray-400'
      }`}
    >
      <span>{label}</span>
      {subtext && <span className="text-xs text-gray-500 font-normal mt-1">{subtext}</span>}
    </button>
  );
}