'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
// Import Drag and Drop components
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

export default function PickListsPage() {
  const [competitions, setCompetitions] = useState<any[]>([]);
  const [selectedCompId, setSelectedCompId] = useState<string>("");
  const [teamStats, setTeamStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Pick List State
  const [firstPickList, setFirstPickList] = useState<number[]>([]);
  const [secondPickList, setSecondPickList] = useState<number[]>([]);
  const [pickedTeams, setPickedTeams] = useState<Set<number>>(new Set());

  // Filter State
  const [minScore, setMinScore] = useState(0);
  const [minDefense, setMinDefense] = useState(0);
  const [minHopper, setMinHopper] = useState(0);
  const [minClimb, setMinClimb] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      const { data: compData } = await supabase.from('competitions').select('*').order('year', { ascending: false });
      if (!compData || compData.length === 0) return;
      setCompetitions(compData);

      const savedCompId = localStorage.getItem('analysis_last_comp_id') || compData[0].id.toString();
      setSelectedCompId(savedCompId);

      const { data: stats } = await supabase.from('team_averages').select('*').eq('competition_id', savedCompId);
      setTeamStats(stats || []);

      // Load saved lists from local storage
      const saved1st = localStorage.getItem(`pick_1st_${savedCompId}`);
      const saved2nd = localStorage.getItem(`pick_2nd_${savedCompId}`);
      const savedPicked = localStorage.getItem(`picked_${savedCompId}`);
      
      if (saved1st) setFirstPickList(JSON.parse(saved1st));
      else setFirstPickList([]); // Reset if no saved data for this comp

      if (saved2nd) setSecondPickList(JSON.parse(saved2nd));
      else setSecondPickList([]);

      if (savedPicked) setPickedTeams(new Set(JSON.parse(savedPicked)));
      else setPickedTeams(new Set());

      setLoading(false);
    };
    init();
  }, [selectedCompId]);

  // Persist lists when they change
  useEffect(() => {
    if (!selectedCompId || loading) return; // Guard clause
    
    localStorage.setItem(`pick_1st_${selectedCompId}`, JSON.stringify(firstPickList));
    localStorage.setItem(`pick_2nd_${selectedCompId}`, JSON.stringify(secondPickList));
    localStorage.setItem(`picked_${selectedCompId}`, JSON.stringify(Array.from(pickedTeams)));
  }, [firstPickList, secondPickList, pickedTeams, selectedCompId, loading]);

  // DRAG AND DROP HANDLER
  const onDragEnd = (result: DropResult) => {
    const { source, destination } = result;

    // Dropped outside a list
    if (!destination) return;

    // Reordering within the same list
    if (source.droppableId === destination.droppableId) {
      const list = source.droppableId === 'firstPick' ? [...firstPickList] : [...secondPickList];
      const [removed] = list.splice(source.index, 1);
      list.splice(destination.index, 0, removed);

      if (source.droppableId === 'firstPick') setFirstPickList(list);
      else setSecondPickList(list);
    } 
    // Moving between lists
    else {
      const sourceList = source.droppableId === 'firstPick' ? [...firstPickList] : [...secondPickList];
      const destList = destination.droppableId === 'firstPick' ? [...firstPickList] : [...secondPickList];
      
      const [removed] = sourceList.splice(source.index, 1);
      destList.splice(destination.index, 0, removed);

      if (source.droppableId === 'firstPick') {
        setFirstPickList(sourceList);
        setSecondPickList(destList);
      } else {
        setSecondPickList(sourceList);
        setFirstPickList(destList);
      }
    }
  };

  const togglePicked = (num: number) => {
    const newPicked = new Set(pickedTeams);
    if (newPicked.has(num)) newPicked.delete(num);
    else newPicked.add(num);
    setPickedTeams(newPicked);
  };

  const handleTeamClick = (teamNumber: number) => {
    router.push(`/analysis/teams/team/${teamNumber}`);
  }; 

  const addToList = (num: number, listType: '1st' | '2nd') => {
    if (listType === '1st' && !firstPickList.includes(num)) setFirstPickList([...firstPickList, num]);
    if (listType === '2nd' && !secondPickList.includes(num)) setSecondPickList([...secondPickList, num]);
  };

  const removeFromList = (num: number, listType: '1st' | '2nd') => {
    if (listType === '1st') setFirstPickList(firstPickList.filter(t => t !== num));
    if (listType === '2nd') setSecondPickList(secondPickList.filter(t => t !== num));
  };

  const filteredPool = teamStats.filter(t => 
    t.avg_score >= minScore &&
    t.avg_defense >= minDefense &&
    t.avg_hopper >= minHopper && 
    t.avg_climb >= minClimb &&
    !firstPickList.includes(t.team_number) &&
    !secondPickList.includes(t.team_number)
  ).sort((a, b) => b.avg_score - a.avg_score);

  if (loading) return <div className="p-20 text-center font-mono text-red-500 animate-pulse">LOADING TACTICAL ASSETS...</div>;

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="p-8 max-w-[1600px] mx-auto space-y-8 bg-black min-h-screen text-white font-mono">
        {/* HEADER */}
        <div className="flex justify-between items-end border-b border-gray-800 pb-6">
          <div>
            <h1 className="text-5xl font-black text-amber-500 italic tracking-tighter uppercase">Pick-List Command</h1>
            <p className="text-gray-500 text-xs mt-1 tracking-[0.3em]">Alliance Selection Strategy Interface</p>
          </div>
          <select 
            value={selectedCompId} 
            onChange={(e) => setSelectedCompId(e.target.value)}
            className="bg-gray-900 border border-gray-800 p-2 rounded text-[10px] font-bold uppercase"
          >
            {competitions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* FILTER PANEL */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-900/40 p-6 border border-gray-800 rounded-sm">
          <FilterSlider label="Min Avg Score" value={minScore} onChange={setMinScore} max={60} />
          <FilterSlider label="Min Defense" value={minDefense} onChange={setMinDefense} max={5} />
          <FilterSlider label="Min Hopper/Intake" value={minHopper} onChange={setMinHopper} max={5} />
          <FilterSlider label="Min Climb Level" value={minClimb} onChange={setMinClimb} max={3} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* COLUMN 1: FILTERED POOL */}
          <section className="space-y-4">
            <h2 className="text-sm font-black text-blue-500 uppercase">Available Assets</h2>
            <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
              {filteredPool.map(team => (
                <TeamCard 
                  key={team.team_number} 
                  team={team} 
                  isPicked={pickedTeams.has(team.team_number)}
                  onTogglePicked={() => togglePicked(team.team_number)}
                  onTeamClick={() => handleTeamClick(team.team_number)}
                  actions={
                    <div className="flex gap-2">
                      <button onClick={(e) => { e.stopPropagation(); addToList(team.team_number, '1st'); }} className="bg-blue-600/20 hover:bg-blue-600 text-[10px] px-2 py-1 rounded-sm border border-blue-600/50">1st</button>
                      <button onClick={(e) => { e.stopPropagation(); addToList(team.team_number, '2nd'); }} className="bg-purple-600/20 hover:bg-purple-600 text-[10px] px-2 py-1 rounded-sm border border-purple-600/50">2nd</button>
                    </div>
                  }
                />
              ))}
            </div>
          </section>

          {/* COLUMN 2: 1ST PICK LIST */}
          <Droppable droppableId="firstPick">
            {(provided) => (
              <section className="space-y-4" {...provided.droppableProps} ref={provided.innerRef}>
                <h2 className="text-sm font-black text-amber-500 uppercase tracking-widest border-l-4 border-amber-500 pl-3">1st Picks</h2>
                <div className="space-y-2 bg-amber-500/5 border border-amber-500/20 p-4 rounded-sm min-h-[50vh]">
                  {firstPickList.map((num, index) => (
                    <DraggableTeamCard 
                      key={num} 
                      num={num} 
                      index={index} 
                      teamStats={teamStats} 
                      pickedTeams={pickedTeams} 
                      togglePicked={togglePicked} 
                      removeFromList={() => removeFromList(num, '1st')} 
                      onTeamClick={handleTeamClick}
                    />
                  ))}
                  {provided.placeholder}
                </div>
              </section>
            )}
          </Droppable>

          {/* COLUMN 3: 2ND PICK LIST */}
          <Droppable droppableId="secondPick">
            {(provided) => (
              <section className="space-y-4" {...provided.droppableProps} ref={provided.innerRef}>
                <h2 className="text-sm font-black text-purple-500 uppercase tracking-widest border-l-4 border-purple-500 pl-3">2nd Picks</h2>
                <div className="space-y-2 bg-purple-500/5 border border-purple-500/20 p-4 rounded-sm min-h-[50vh]">
                  {secondPickList.map((num, index) => (
                    <DraggableTeamCard 
                      key={num} 
                      num={num} 
                      index={index} 
                      teamStats={teamStats} 
                      pickedTeams={pickedTeams} 
                      togglePicked={togglePicked} 
                      removeFromList={() => removeFromList(num, '2nd')} 
                      onTeamClick={handleTeamClick}
                    />
                  ))}
                  {provided.placeholder}
                </div>
              </section>
            )}
          </Droppable>
        </div>
      </div>
    </DragDropContext>
  );
}

// DRAGGABLE WRAPPER COMPONENT
function DraggableTeamCard({ num, index, teamStats, pickedTeams, togglePicked, removeFromList, onTeamClick }: any) {
  const team = teamStats.find((t: any) => t.team_number === num);
  if (!team) return null;

  return (
    <Draggable draggableId={num.toString()} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          style={{
            ...provided.draggableProps.style,
            opacity: snapshot.isDragging ? 0.8 : 1,
          }}
        >
          <TeamCard 
            team={team} 
            isPicked={pickedTeams.has(num)}
            rank={index + 1}
            onTogglePicked={() => togglePicked(num)}
            onTeamClick={() => onTeamClick(num)}
            actions={
              <button 
                onClick={(e) => { e.stopPropagation(); removeFromList(); }} 
                className="text-gray-500 hover:text-red-500 text-xs px-2"
              >
                ✕
              </button>
            }
          />
        </div>
      )}
    </Draggable>
  );
}

function FilterSlider({ label, value, onChange, max }: any) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between">
        <label className="text-[10px] font-bold text-gray-500 uppercase">{label}</label>
        <span className="text-amber-500 font-bold text-xs">{value}</span>
      </div>
      <input 
        type="range" min="0" max={max} step="0.1" value={value} 
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
      />
    </div>
  );
}

function TeamCard({ team, isPicked, actions, rank, onTogglePicked, onTeamClick }: any) {
  if (!team) return null;

  return (
    <div 
      onClick={onTeamClick} 
      className={`p-4 border cursor-pointer transition-all relative ${
        isPicked ? 'bg-gray-900 border-gray-800 opacity-40 grayscale' : 'bg-gray-800/40 border-gray-700 hover:border-blue-500'
      }`}
    >
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          {rank && <span className="text-xs font-black text-gray-600 w-4">{rank}</span>}
          <button 
            onClick={(e) => { 
              e.stopPropagation(); 
              onTogglePicked(); 
            }} 
            className={`h-4 w-4 flex items-center justify-center border ${isPicked ? 'bg-red-600 border-red-500 text-white' : 'border-gray-600'} rounded-sm text-[10px]`}
          >
            {isPicked && '✓'}
          </button>
          <div>
            <h3 className={`text-xl font-black italic tracking-tighter ${isPicked ? 'line-through' : ''}`}>
              #{team.team_number}
            </h3>
            <div className="flex gap-2 text-[8px] font-bold uppercase text-gray-500">
              <span>Auto: {team.avg_auto}</span>
              <span>Tele: {team.avg_teleop}</span>
              <span>Def: {team.avg_defense}</span>
            </div>
          </div>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
           {actions}
        </div>
      </div>
    </div>
  );
}