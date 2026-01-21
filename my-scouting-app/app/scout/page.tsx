'use client';

import {useState, useEffect} from 'react';
import {supabase} from '@/lib/supabase';

export default function MatchSelector(){
    const [competitions, setCompetitions] = useState<any[]>([]);
    const [selectedCompId, setSelectedCompId] = useState<string>("");

    const [allMatches, setAllMatches] = useState<any[]>([]);
    const [selectedMatch, setSelectedMatch] = useState<any>(null);
    const [scoutingTeam, setScoutingTeam] = useState<number | null>(null);
    const [autoNotes, setAutoNotes] = useState(0);
    const [loading, setLoading] = useState(true);
    const [teleopScore, setTeleopScore] = useState(0);
    const [climbLevel, setClimbLevel] = useState(0); // 0=None, 1=Park, 2=Low, 3=High
    const [speed, setSpeed] = useState(3); // Default to middle (3)
    const [defense, setDefense] = useState(0); // Default to low (1)
    const [notes, setNotes] = useState("");
    const [pickupPositions, setPickupPositions] = useState<string[]>([]);
    const [hopperSize, setHopperSize] = useState(3);
    const [shootingSpeed, setShootingSpeed] = useState(3);
    const [autoClimb, setAutoClimb] = useState(false);
    
    useEffect(() => {
      const fetchCompetitions = async () => {
        const { data, error } = await supabase.from('competitions').select('*').order('year', {ascending:false});
        setCompetitions(data || []);
        
        if(data && data.length > 0) {
          setSelectedCompId(data[0].id);
        }

        if(error){
                console.error('Error fetching competitions', error.message);
            }else{
                setCompetitions(data || []);
                const savedCompId = localStorage.getItem('scout_last_comp_id');

                if(savedCompId && data.find(c => c.id === savedCompId)){
                  setSelectedCompId(savedCompId);
                }else if(data && data.length > 0){
                  setSelectedCompId(data[0].id);
                }
         }
         setLoading(false);
      };

      
      fetchCompetitions();
    },[])

    useEffect(() => {
        if(!selectedCompId) return;

        localStorage.setItem('scout_last_comp_id', selectedCompId);

        const fetchMatches = async () =>{
            const {data, error} = await supabase
                .from('matches')
                .select('*')
                .eq('competition_id', selectedCompId)
                .order('match_number', {ascending: true});
            
            if(error){
                console.error('Error fetching matches', error.message);
            }else{
                console.log("Comps Found:", data);
                setAllMatches(data || []);
            }
            setLoading(false);
        };

        fetchMatches();
    },[selectedCompId]);

    const resetForm = () => {
      setScoutingTeam(null);
      setAutoNotes(0);
      setTeleopScore(0);
      setClimbLevel(0);
      setSpeed(3);
      setDefense(0);
      setNotes("");
      setPickupPositions([]);
      setShootingSpeed(3);
      setHopperSize(3);
      setAutoClimb(false);
    };

    const submitData = async () => {
        const { error } = await supabase.from('scouting_reports').insert([
            {
                match_id: selectedMatch.id,
                team_number: scoutingTeam,
                auto_score: autoNotes,
                teleop_score: teleopScore,
                climb_level: climbLevel,
                speed: speed,
                defense: defense,
                notes: notes,
                pickup_positions: pickupPositions,
                scouter_name: "User",
                shooting_speed: shootingSpeed,
                hopper_size: hopperSize,
                auto_climb: autoClimb,

            }
        ]);

        if(error){
            alert("Error saving: " + error.message);
        }else{

            const nextMatchNumber = selectedMatch.match_number + 1;

            const nextMatch = allMatches.find(m => m.match_number === nextMatchNumber);

            if (nextMatch) {
                setSelectedMatch(nextMatch);
            } else {
                setSelectedMatch(null);
            }

            alert("Success! Data Saved.");
            
            resetForm();
        }
    }


    const handleMatchChange = (matchNumber: string) => {
        const match = allMatches.find(m => m.match_number.toString() === matchNumber);
        setSelectedMatch(match);
    }

    const handleCompChange = (compId: string) => {
      const comp = competitions.find(m => m.id === compId);
      setSelectedCompId(comp);
    }

    if (loading) return <div className="p-10">Loading...</div>;

  // --- UI PART 1: THE SCORING FORM ---
  // If a team is selected, show the "plus/minus" buttons instead of the match list
  if (scoutingTeam) {
    return (
      <div className="space-y-8 pb-20">

  {/* --- SCOUTING HEADER & NAVIGATION --- */}
<div className="sticky top-0 z-30 bg-black/90 backdrop-blur-md border-b border-gray-800 -mx-8 px-8 py-4 mb-6">
  <div className="flex items-center justify-between max-w-2xl mx-auto">
    <div className="flex flex-col">
      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">
        Scouting Match {selectedMatch?.match_number}
      </span>
      <h2 className="text-2xl font-black text-blue-500">
        TEAM {scoutingTeam}
      </h2>
    </div>

    <button 
      onClick={() => {
        if(confirm("Discard changes and return to team select?")) {
          resetForm();
        }
      }}
      className="px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-xs font-bold text-gray-400 hover:text-white hover:border-red-500 transition-all"
    >
      ← CHANGE TEAM
    </button>
  </div>
</div>

  {/* --- TELEOP SCORE --- */}
  <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800">
    <label className="block text-center mb-4 font-bold text-gray-400 uppercase text-xs">Teleop Points</label>
    <div className="flex items-center justify-between">
      <button onClick={() => setTeleopScore(Math.max(0, teleopScore - 1))} className="bg-gray-800 h-16 w-16 rounded-xl text-2xl">-</button>
      <span className="text-4xl font-black">{teleopScore}</span>
      <button onClick={() => setTeleopScore(teleopScore + 1)} className="bg-gray-800 h-16 w-16 rounded-xl text-2xl">+</button>
    </div>
  </div>

  <div className="space-y-6">
  {/* --- AUTO CLIMB (TOGGLE) --- */}
  <div className="bg-gray-900/50 p-4 rounded-2xl border border-gray-800">
    <div className="flex items-center justify-between">
      <div>
        <label className="block font-bold text-gray-400 uppercase text-xs tracking-widest">
          Auto Climb
        </label>
        <p className="text-[10px] text-gray-500 italic">Level 1 Climb during Auto</p>
      </div>
      <button
        onClick={() => setAutoClimb(!autoClimb)}
        className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors focus:outline-none ${
          autoClimb ? 'bg-blue-600' : 'bg-gray-700'
        }`}
      >
        <span
          className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
            autoClimb ? 'translate-x-9' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  </div>

  {/* --- TELEOP CLIMB (TABS) --- */}
  <div className="space-y-3">
    <label className="font-bold text-gray-400 uppercase text-xs tracking-widest">
      Teleop Climb Level
    </label>
    <div className="grid grid-cols-4 gap-2">
      {[0, 1, 2, 3].map((level) => (
        <button
          key={level}
          onClick={() => setClimbLevel(level)}
          className={`flex flex-col items-center justify-center p-3 rounded-xl font-bold transition-all border-2 ${
            climbLevel === level 
              ? 'bg-blue-600 border-blue-400 shadow-[0_0_15px_rgba(37,99,235,0.4)]' 
              : 'bg-gray-900 border-gray-800 text-gray-500'
          }`}
        >
          <span className="text-lg">{level === 0 ? '' : `L${level}`}</span>
          <span className="text-[10px] uppercase">{level === 0 ? 'None' : 'Level'}</span>
        </button>
      ))}
    </div>
  </div>
</div>

  {/* --- PICKUP POSITIONS --- */}
  <div className="space-y-3">
    <label className="font-bold text-gray-400 uppercase text-xs">Pickup From</label>
    <div className="flex gap-2">
      {['Ground', 'Outpost'].map((pos) => (
        <button
          key={pos}
          onClick={() => {
            setPickupPositions(prev => 
              prev.includes(pos) ? prev.filter(p => p !== pos) : [...prev, pos]
            )
          }}
          className={`flex-1 p-4 rounded-xl font-bold border transition ${pickupPositions.includes(pos) ? 'bg-green-600 border-transparent' : 'bg-gray-900 border-gray-800'}`}
        >
          {pos}
        </button>
      ))}
    </div>
  </div>

  {/* --- SLIDERS (SPEED & DEFENSE) --- */}
  <div className="grid grid-cols-2 gap-4">
    <div className="bg-gray-900 p-4 rounded-2xl border border-gray-800">
  <div className="flex justify-between items-center mb-2">
    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
      Speed
    </label>
    {/* Dynamic Badge */}
    <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${
      speed >= 4 ? 'bg-green-500/20 text-green-400' : 
      speed >= 3 ? 'bg-blue-500/20 text-blue-400' : 
      'bg-gray-800 text-gray-400'
    }`}>
      {speed === 1 && "Slow"}
      {speed === 2 && "Below Avg"}
      {speed === 3 && "Average"}
      {speed === 4 && "Fast"}
      {speed === 5 && "Elite"}
    </span>
  </div>

  <input 
    type="range" 
    min="1" 
    max="5" 
    step="1"
    value={speed} 
    onChange={(e) => setSpeed(parseInt(e.target.value))} 
    className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-green-500 transition-all" 
  />
  
  {/* Optional Tick Marks for clarity */}
  <div className="flex justify-between mt-2 px-1">
    {[1, 2, 3, 4, 5].map((val) => (
      <span key={val} className={`text-[10px] font-bold ${speed === val ? 'text-white' : 'text-gray-600'}`}>
        {val}
      </span>
    ))}
  </div>
</div>

{/*defense slider */}
  
<div className="bg-gray-900 p-4 rounded-2xl border border-gray-800">
  <div className="flex justify-between items-center mb-2">
    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
      Defense
    </label>
    {/* Dynamic Badge for Defense */}
    <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${
      defense >= 4 ? 'bg-red-500/20 text-red-400' : 
      defense >= 1 ? 'bg-blue-500/20 text-blue-400' : 
      'bg-gray-800 text-gray-400'
    }`}>
      {defense === 0 && "Did Not Play"}
      {defense === 1 && "Poor"}
      {defense === 2 && "Below Avg"}
      {defense === 3 && "Average"}
      {defense === 4 && "Strong"}
      {defense === 5 && "Elite"}
    </span>
  </div>

  <input 
    type="range" 
    min="0" 
    max="5" 
    step="1"
    value={defense} 
    onChange={(e) => setDefense(parseInt(e.target.value))} 
    className={`w-full h-2 rounded-lg appearance-none cursor-pointer transition-all ${
      defense === 0 ? 'bg-gray-800 accent-gray-600' : 'bg-gray-800 accent-red-500'
    }`} 
  />
  
  {/* Tick Marks with N/A for 0 */}
  <div className="flex justify-between mt-2 px-1">
    {[0, 1, 2, 3, 4, 5].map((val) => (
      <span key={val} className={`text-[10px] font-bold ${defense === val ? 'text-white' : 'text-gray-600'}`}>
        {val === 0 ? 'N/A' : val}
      </span>
    ))}
  </div>
</div>

  {/* --- HOPPER SIZE SLIDER --- */}
  <div className="bg-gray-900 p-4 rounded-2xl border border-gray-800">
    <div className="flex justify-between items-center mb-2">
      <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
        Hopper
      </label>
      <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${
        hopperSize >= 4 ? 'bg-purple-500/20 text-purple-400' : 
        hopperSize >= 1 ? 'bg-blue-500/20 text-blue-400' : 
          'bg-gray-800 text-gray-400'
      }`}>
        {hopperSize === 1 && "Less Than 10 Fuel"}
        {hopperSize === 2 && "15 Fuel or Less"}
        {hopperSize === 3 && "15-25 Fuel"}
        {hopperSize === 4 && "25-35 Fuel"}
        {hopperSize === 5 && "More than 35 Fuel"}
      </span>
    </div>
    <input 
      type="range" min="1" max="5" step="1"
      value={hopperSize} 
      onChange={(e) => setHopperSize(parseInt(e.target.value))} 
      className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-purple-500 transition-all" 
    />
    <div className="flex justify-between mt-2 px-1">
      {[1, 2, 3, 4, 5].map((val) => (
        <span key={val} className={`text-[10px] font-bold ${hopperSize === val ? 'text-white' : 'text-gray-600'}`}>
          {val === 5 ? '5+' : val}
        </span>
      ))}
    </div>
  </div>

  {/* --- SHOOTING SPEED SLIDER --- */}
  <div className="bg-gray-900 p-4 rounded-2xl border border-gray-800">
    <div className="flex justify-between items-center mb-2">
      <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
        Shooting Speed
      </label>
      <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${
        shootingSpeed >= 4 ? 'bg-orange-500/20 text-orange-400' : 
        shootingSpeed == 3 ? 'bg-blue-500/20 text-blue-400':
        'bg-gray-800 text-gray-400'
      }`}>
        {shootingSpeed === 1 && "Slow"}
        {shootingSpeed === 2 && "Below Avg"}
        {shootingSpeed === 3 && "Average"}
        {shootingSpeed === 4 && "Fast"}
        {shootingSpeed === 5 && "Elite"}
      </span>
    </div>
    <input 
      type="range" min="1" max="5" step="1"
      value={shootingSpeed} 
      onChange={(e) => setShootingSpeed(parseInt(e.target.value))} 
      className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-orange-500 transition-all" 
    />
    <div className="flex justify-between mt-2 px-1">
      {[1, 2, 3, 4, 5].map((val) => (
        <span key={val} className={`text-[10px] font-bold ${shootingSpeed === val ? 'text-white' : 'text-gray-600'}`}>
          {val}
        </span>
      ))}
    </div>
  </div>

  </div>

  {/* --- NOTES --- */}
  <textarea
    placeholder="Extra notes (driver skill, breaks, etc...)"
    className="w-full bg-gray-900 border border-gray-800 p-4 rounded-2xl h-32 focus:border-blue-500 outline-none"
    value={notes}
    onChange={(e) => setNotes(e.target.value)}
  />

  <button onClick={submitData} className="w-full bg-blue-600 p-6 rounded-2xl font-black text-xl shadow-lg shadow-blue-900/20">
    SUBMIT REPORT
  </button>
</div>
    );
  }

  // --- UI PART 2: THE MATCH/TEAM SELECTOR ---
  return (
    // Inside your ScoutPage component...
  <div className="p-8 max-w-2xl mx-auto flex flex-col gap-8">
    <h1 className="text-3xl font-black tracking-tighter uppercase">Scout Entry</h1>

    <div className="space-y-6">
      {/* --- STEP 1: COMPETITION SELECTOR --- */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">
          1. Select Competition
        </label>
        <select 
          className="bg-gray-900 text-white p-4 rounded-xl border border-gray-800 focus:border-blue-500 outline-none transition"
          value={selectedCompId}
          onChange={(e) => setSelectedCompId(e.target.value)}
        >
          {competitions.map((comp) => (
            <option key={comp.id} value={comp.id}>
              {comp.year} - {comp.name}
            </option>
          ))}
        </select>
      </div>

      {/* --- STEP 2: MATCH SELECTOR --- */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">
          2. Select Match
        </label>
        <select 
          className="bg-gray-800 text-white p-4 rounded-xl border border-gray-700 focus:border-blue-500 outline-none transition"
          // We use the UUID (id) as the value to ensure uniqueness
          value={selectedMatch ? selectedMatch.id : ""} 
          onChange={(e) => {
            const val = e.target.value;
            if (val === "") {
              setSelectedMatch(null);
            } else {
              // Find the match object by its unique database ID
              const match = allMatches.find(m => m.id === val);
              setSelectedMatch(match);
            }
          }}
        >
          <option value="">-- {allMatches.length > 0 ? 'Select a Match' : 'No Matches Found'} --</option>
          {allMatches.map((m) => (
            <option key={m.id} value={m.id}>
              Match {m.match_number}
            </option>
          ))}
        </select>
      </div>
    </div>

    {/* --- STEP 3: TEAM SELECTION --- */}
    {selectedMatch && (
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1 block text-center">
          3. Select Team to Scout
        </label>
        <div className="grid grid-cols-2 gap-4">
          {/* RED ALLIANCE */}
          <div className="flex flex-col gap-3">
            <p className="text-red-500 font-black text-center text-sm tracking-tighter uppercase">Red Alliance</p>
            {selectedMatch.red_alliance.map((num: number) => (
              <button 
                key={num} 
                onClick={() => setScoutingTeam(num)} 
                className="bg-red-900/10 border-2 border-red-600/30 hover:border-red-500 hover:bg-red-900/20 p-5 rounded-2xl font-black text-xl transition-all active:scale-95"
              >
                {num}
              </button>
            ))}
          </div>

          {/* BLUE ALLIANCE */}
          <div className="flex flex-col gap-3">
            <p className="text-blue-500 font-black text-center text-sm tracking-tighter uppercase">Blue Alliance</p>
            {selectedMatch.blue_alliance.map((num: number) => (
              <button 
                key={num} 
                onClick={() => setScoutingTeam(num)} 
                className="bg-blue-900/10 border-2 border-blue-600/30 hover:border-blue-500 hover:bg-blue-900/20 p-5 rounded-2xl font-black text-xl transition-all active:scale-95"
              >
                {num}
              </button>
            ))}
          </div>
        </div>
      </div>
    )}
  </div>
  );
}