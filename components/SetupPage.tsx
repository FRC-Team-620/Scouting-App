'use client';

import { useState, useEffect } from 'react';
import { firestoreDB, Competition, Team, Match } from '@/lib/db';
import { Plus, Trash2, Calendar, Download, Settings } from 'lucide-react';
import APISettingsForm from './APISettingsForm';

export default function SetupPage() {
  const [showCompForm, setShowCompForm] = useState(false);
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [showMatchForm, setShowMatchForm] = useState(false);
  const [showApiSettings, setShowApiSettings] = useState(false);

  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);

  useEffect(() => {
    const unsubCompetitions = firestoreDB.subscribeToCompetitions(setCompetitions);
    const unsubTeams = firestoreDB.subscribeToTeams(setTeams);
    const unsubMatches = firestoreDB.subscribeToMatches(setMatches);

    return () => {
      unsubCompetitions();
      unsubTeams();
      unsubMatches();
    };
  }, []);

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
  <div className="site-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-3xl font-bold text-gray-800 dark:text-white">
            Welcome to FRC Scouting
          </h2>
          <button
            onClick={() => setShowApiSettings(!showApiSettings)}
            className="flex items-center space-x-2 bg-black hover:bg-gray-900 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Settings size={20} />
            <span>FRC API Settings</span>
          </button>
        </div>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Set up your competitions, teams, and matches before you start scouting. This data will be used
          to organize and analyze match performance throughout the season.
        </p>
        {showApiSettings && <APISettingsForm onClose={() => setShowApiSettings(false)} />}
      </div>

      {/* Competitions Section */}
  <div className="site-card">
        <div className="flex items-center justify-between mb-4">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Competitions</h3>
            <button
              onClick={() => setShowCompForm(!showCompForm)}
              className="flex items-center space-x-2 btn-primary"
            >
              <Plus size={20} />
              <span>Add Competition</span>
            </button>
          </div>

        {showCompForm && <CompetitionForm onClose={() => setShowCompForm(false)} />}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {competitions?.map((comp) => (
            <CompetitionCard key={comp.id} competition={comp} />
          ))}
          {!competitions?.length && !showCompForm && (
            <p className="text-gray-500 dark:text-gray-400 col-span-full text-center py-8">
              No competitions added yet. Click "Add Competition" to get started.
            </p>
          )}
        </div>
      </div>

      {/* Teams Section */}
  <div className="site-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-2xl font-bold text-gray-800 dark:text-white">Teams</h3>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowTeamForm(!showTeamForm)}
              className="flex items-center space-x-2 btn-primary"
            >
              <Plus size={20} />
              <span>Add Team</span>
            </button>
          </div>
        </div>

        {showTeamForm && <TeamForm onClose={() => setShowTeamForm(false)} competitions={competitions} />}

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mt-4">
          {teams?.map((team) => (
            <TeamCard key={team.id} team={team} />
          ))}
          {!teams?.length && !showTeamForm && (
            <p className="text-gray-500 dark:text-gray-400 col-span-full text-center py-8">
              No teams added yet. Click "Add Team" to get started.
            </p>
          )}
        </div>
      </div>

      {/* Matches Section */}
  <div className="site-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-2xl font-bold text-gray-800 dark:text-white">Matches</h3>
          <button
            onClick={() => setShowMatchForm(!showMatchForm)}
            className="flex items-center space-x-2 btn-primary"
          >
            <Plus size={20} />
            <span>Add Match</span>
          </button>
        </div>

        {showMatchForm && <MatchForm onClose={() => setShowMatchForm(false)} competitions={competitions || []} />}

        <div className="space-y-2 mt-4">
          {competitions && competitions.length > 0 ? (
            competitions.map((comp) => {
              const compMatches = matches.filter(m => m.competitionId === comp.id);
              if (!compMatches.length) return null;

              // Separate qualification and playoff
              const qualMatches = compMatches.filter(m => m.matchType === 'qualification');
              const playoffMatches = compMatches.filter(m => m.matchType === 'playoff');

              return (
                <div key={comp.id} className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-gray-800 dark:text-white">{comp.name}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-300">{comp.eventKey}</div>
                    </div>
                  </div>

                  <MatchGroup title="Qualification Matches" matches={qualMatches} competitions={competitions} />
                  <MatchGroup title="Playoff Matches" matches={playoffMatches} competitions={competitions} />
                </div>
              );
            })
          ) : (
            !showMatchForm && (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                No matches added yet. Click "Add Match" to get started.
              </p>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function MatchGroup({ title, matches, competitions }: { title: string; matches: Match[]; competitions: Competition[] }) {
  // default closed per request
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left flex items-center justify-between bg-white dark:bg-gray-800 px-4 py-2 rounded-lg"
      >
        <span className="font-medium">{title} ({matches.length})</span>
        <span className="text-sm text-gray-600 dark:text-gray-300">{open ? '▼' : '▶'}</span>
      </button>
      {open && (
        <div className="mt-2 grid grid-cols-1 gap-2">
          {matches.map((m) => (
            <div key={m.id} className="bg-white dark:bg-gray-800 p-0 rounded">
              <MatchCard match={m} competitions={competitions} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CompetitionForm({ onClose }: { onClose: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    eventKey: '',
    startDate: '',
    endDate: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const compId = await firestoreDB.addCompetition({
      ...formData,
      createdAt: Date.now(),
    });

    // Auto-import teams and matches if event was selected from API
    if (formData.eventKey) {
      try {
        const res = await fetch(`/api/frc/competition?eventCode=${encodeURIComponent(formData.eventKey)}`);
        if (!res.ok) {
          console.warn('Failed to fetch competition data for auto-import');
          alert('Competition added, but failed to auto-import teams/matches. You can import them manually.');
        } else {
          const body = await res.json();
          const teams = body.teams || [];
          const matches = body.matches || [];

          // Import teams
          for (const team of teams) {
            await firestoreDB.addTeam({
              teamNumber: team.teamNumber,
              teamName: team.nameShort || team.nameFull,
              createdAt: Date.now(),
            });
          }

          // Import matches (include participating team numbers when available)
          for (const match of matches) {
            const matchType = match.tournamentLevel === 'Qualification' ? 'qualification' : 'playoff';
            const teamsArr = (match.teams || []).map((t: any) => Number(t.teamNumber));
            await firestoreDB.addMatch({
              competitionId: compId,
              matchNumber: match.description,
              matchType: matchType,
              teams: teamsArr.length ? teamsArr : undefined,
              createdAt: Date.now(),
            });
          }

          alert(`Competition added with ${teams.length} teams and ${matches.length} matches!`);
        }
      } catch (error) {
        console.error('Error auto-importing:', error);
        alert('Competition added, but failed to auto-import teams/matches. You can import them manually.');
      }
  }

  onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="bg-blue-50 dark:bg-gray-700 p-4 rounded-lg mb-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input
          type="text"
          placeholder="Competition Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          required
        />
        <input
          type="text"
          placeholder="Event Code (e.g., CASD)"
          value={formData.eventKey}
          onChange={(e) => setFormData({ ...formData, eventKey: e.target.value.toUpperCase() })}
          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          required
        />
        <input
          type="date"
          placeholder="Start Date"
          value={formData.startDate}
          onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          required
        />
        <input
          type="date"
          placeholder="End Date"
          value={formData.endDate}
          onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          required
        />
      </div>
      <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
        💡 Tip: After creating the competition, use "FRC API Settings" to auto-import teams and matches
      </p>
      <div className="flex space-x-2 mt-4">
        <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
          Save Competition
        </button>
        <button type="button" onClick={onClose} className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded-lg">
          Cancel
        </button>
      </div>
    </form>
  );
}

function CompetitionCard({ competition }: { competition: Competition }) {
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({
    name: competition.name || '',
    eventKey: competition.eventKey || '',
    startDate: competition.startDate || '',
    endDate: competition.endDate || ''
  });
  const handleDelete = async () => {
    if (confirm('Delete this competition? This will also delete associated matches and scouting data.')) {
      await firestoreDB.deleteCompetition(competition.id!);
      // Note: You may want to add cascade deletion for matches and scouting data
    }
  };

  const handleSaveEdit = async () => {
    try {
      await firestoreDB.updateCompetition(competition.id!, {
        name: editData.name,
        eventKey: editData.eventKey,
        startDate: editData.startDate,
        endDate: editData.endDate,
      });
      setEditing(false);
    } catch (err) {
      console.error('Failed to update competition', err);
      alert('Failed to save changes');
    }
  };

  return (
    <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900 dark:to-black p-4 rounded-lg border-2 border-red-800">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {!editing ? (
            <>
              <h4 className="font-bold text-gray-900 dark:text-white">{competition.name}</h4>
              <p className="text-sm text-gray-700 dark:text-gray-300">{competition.eventKey}</p>
              <div className="flex items-center space-x-1 mt-2 text-xs text-gray-700 dark:text-gray-300">
                <Calendar size={14} />
                <span>{competition.startDate} to {competition.endDate}</span>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <input
                value={editData.name}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                placeholder="Competition name"
              />
              <input
                value={editData.eventKey}
                onChange={(e) => setEditData({ ...editData, eventKey: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                placeholder="Event code"
              />
              <div className="flex gap-2">
                <input
                  type="date"
                  value={editData.startDate}
                  onChange={(e) => setEditData({ ...editData, startDate: e.target.value })}
                  className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
                <input
                  type="date"
                  value={editData.endDate}
                  onChange={(e) => setEditData({ ...editData, endDate: e.target.value })}
                  className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {!editing ? (
            <>
              <button
                onClick={() => setEditing(true)}
                className="text-black hover:text-gray-800 dark:text-white mr-2"
                title="Edit competition"
              >
                ✏️
              </button>
              <button
                onClick={async () => {
                  if (!competition.eventKey) {
                    alert('No event code available for this competition');
                    return;
                  }
                  if (!confirm(`Import teams and matches from event ${competition.eventKey}?`)) return;

                  try {
                    const res = await fetch(`/api/frc/competition?eventCode=${encodeURIComponent(competition.eventKey)}`);
                    if (!res.ok) {
                      const err = await res.json().catch(() => ({ message: 'Unknown error' }));
                      throw new Error(err.message || 'Failed to fetch competition data');
                    }

                    const body = await res.json();
                    const teams = body.teams || [];
                    const matches = body.matches || [];

                    for (const team of teams) {
                      await firestoreDB.addTeam({
                        teamNumber: team.teamNumber,
                        teamName: team.nameShort || team.nameFull,
                        createdAt: Date.now(),
                      });
                    }

                    for (const match of matches) {
                      const matchType = match.tournamentLevel === 'Qualification' ? 'qualification' : 'playoff';
                      const teams = (match.teams || []).map((t: any) => Number(t.teamNumber));
                      await firestoreDB.addMatch({
                        competitionId: competition.id!,
                        matchNumber: match.description,
                        matchType: matchType,
                        teams: teams.length ? teams : undefined,
                        createdAt: Date.now(),
                      });
                    }

                    alert(`Imported ${teams.length} teams and ${matches.length} matches for ${competition.name}`);
                  } catch (error: any) {
                    console.error('Import failed:', error);
                    alert(`Import failed: ${error?.message || error}`);
                  }
                }}
                className="text-red-700 hover:text-red-900 dark:text-red-300 mr-2"
                title="Import teams and matches from FRC"
              >
                <Download size={18} />
              </button>

              <button onClick={handleDelete} className="text-red-600 hover:text-red-800 dark:text-red-400">
                <Trash2 size={18} />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={handleSaveEdit} className="bg-red-800 hover:bg-black text-white px-3 py-1 rounded">
                Save
              </button>
              <button onClick={() => setEditing(false)} className="bg-gray-300 hover:bg-gray-400 text-black px-3 py-1 rounded">
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TeamForm({ onClose, competitions }: { onClose: () => void; competitions: Competition[] }) {
  const [formData, setFormData] = useState({
    teamNumber: '',
    teamName: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await firestoreDB.addTeam({
      teamNumber: parseInt(formData.teamNumber),
      teamName: formData.teamName,
      createdAt: Date.now(),
    });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="bg-green-50 dark:bg-gray-700 p-4 rounded-lg mb-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input
          type="number"
          placeholder="Team Number"
          value={formData.teamNumber}
          onChange={(e) => setFormData({ ...formData, teamNumber: e.target.value })}
          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          required
        />
        <input
          type="text"
          placeholder="Team Name"
          value={formData.teamName}
          onChange={(e) => setFormData({ ...formData, teamName: e.target.value })}
          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          required
        />
      </div>
      <div className="flex space-x-2 mt-4">
        <button type="submit" className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg">
          Save
        </button>
        <button type="button" onClick={onClose} className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded-lg">
          Cancel
        </button>
      </div>
    </form>
  );
}

function TeamCard({ team }: { team: Team }) {
  const handleDelete = async () => {
    if (confirm('Delete this team?')) {
      await firestoreDB.deleteTeam(team.id!);
    }
  };

  return (
    <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900 dark:to-black p-3 rounded-lg border border-red-800">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-lg text-gray-800 dark:text-white">{team.teamNumber}</p>
          <p className="text-xs text-gray-600 dark:text-gray-300 truncate">{team.teamName}</p>
        </div>
        <button onClick={handleDelete} className="ml-3 flex-shrink-0 btn-danger">
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

function MatchForm({ onClose, competitions }: { onClose: () => void; competitions: Competition[] }) {
  const [formData, setFormData] = useState({
    competitionId: '',
    matchNumber: '',
    matchType: 'qualification' as 'qualification' | 'playoff' | 'practice',
  });
  const [bulkImport, setBulkImport] = useState('');
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showQuickGen, setShowQuickGen] = useState(false);
  const [qualCount, setQualCount] = useState(60);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await firestoreDB.addMatch({
      competitionId: formData.competitionId,
      matchNumber: formData.matchNumber,
      matchType: formData.matchType,
      createdAt: Date.now(),
    });
    onClose();
  };

  const handleBulkImport = async () => {
    if (!formData.competitionId) {
      alert('Please select a competition first');
      return;
    }

    const lines = bulkImport.split('\n').filter(line => line.trim());
    let imported = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        await firestoreDB.addMatch({
          competitionId: formData.competitionId,
          matchNumber: trimmed,
          matchType: formData.matchType,
          createdAt: Date.now(),
        });
        imported++;
      }
    }

    alert(`Successfully imported ${imported} matches!`);
    setBulkImport('');
    setShowBulkImport(false);
    onClose();
  };

  const generateQualMatches = async () => {
    if (!formData.competitionId) {
      alert('Please select a competition first');
      return;
    }

    for (let i = 1; i <= qualCount; i++) {
      await firestoreDB.addMatch({
        competitionId: formData.competitionId,
        matchNumber: `Q${i}`,
        matchType: 'qualification',
        createdAt: Date.now(),
      });
    }

    alert(`Successfully created ${qualCount} qualification matches!`);
    setShowQuickGen(false);
    onClose();
  };

  const generatePlayoffMatches = async () => {
    if (!formData.competitionId) {
      alert('Please select a competition first');
      return;
    }

    const playoffMatches = [
      // Quarterfinals (if 8 alliances)
      'QF1-1', 'QF1-2', 'QF1-3',
      'QF2-1', 'QF2-2', 'QF2-3',
      'QF3-1', 'QF3-2', 'QF3-3',
      'QF4-1', 'QF4-2', 'QF4-3',
      // Semifinals
      'SF1-1', 'SF1-2', 'SF1-3',
      'SF2-1', 'SF2-2', 'SF2-3',
      // Finals
      'F1-1', 'F1-2', 'F1-3',
    ];

    for (const matchNum of playoffMatches) {
      await firestoreDB.addMatch({
        competitionId: formData.competitionId,
        matchNumber: matchNum,
        matchType: 'playoff',
        createdAt: Date.now(),
      });
    }

    alert(`Successfully created ${playoffMatches.length} playoff matches!`);
    setShowQuickGen(false);
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="bg-purple-50 dark:bg-gray-700 p-4 rounded-lg mb-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <select
          value={formData.competitionId}
          onChange={(e) => setFormData({ ...formData, competitionId: e.target.value })}
          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          required
        >
          <option value="">Select Competition</option>
          {competitions.map((comp) => (
            <option key={comp.id} value={comp.id}>
              {comp.name}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Match Number (e.g., Q12, SF1-2)"
          value={formData.matchNumber}
          onChange={(e) => setFormData({ ...formData, matchNumber: e.target.value })}
          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          required
        />
        <select
          value={formData.matchType}
          onChange={(e) => setFormData({ ...formData, matchType: e.target.value as any })}
          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          required
        >
          <option value="qualification">Qualification</option>
          <option value="playoff">Playoff</option>
          <option value="practice">Practice</option>
        </select>
      </div>
      
      {!showBulkImport && !showQuickGen && (
        <div className="flex flex-wrap gap-2 mt-4">
          <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg">
            Save Single Match
          </button>
          <button 
            type="button" 
            onClick={() => setShowQuickGen(true)} 
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
          >
            Quick Generate
          </button>
          <button 
            type="button" 
            onClick={() => setShowBulkImport(true)} 
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg"
          >
            Bulk Import
          </button>
          <button type="button" onClick={onClose} className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded-lg">
            Cancel
          </button>
        </div>
      )}

      {showQuickGen && (
        <div className="mt-4 space-y-4">
          <h4 className="font-semibold text-gray-800 dark:text-white">Quick Generate Matches</h4>
          
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border-2 border-gray-300 dark:border-gray-600">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Number of Qualification Matches
            </label>
            <input
              type="number"
              value={qualCount}
              onChange={(e) => setQualCount(parseInt(e.target.value) || 0)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white mb-3"
              min="1"
              max="200"
            />
            <button 
              type="button" 
              onClick={generateQualMatches}
              className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-lg font-semibold"
            >
              Generate Q1 through Q{qualCount}
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Common: 60-80 matches for regionals, 100+ for districts
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border-2 border-gray-300 dark:border-gray-600">
            <h5 className="font-semibold text-gray-800 dark:text-white mb-2">Standard Playoff Bracket</h5>
            <button 
              type="button" 
              onClick={generatePlayoffMatches}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white px-4 py-3 rounded-lg font-semibold"
            >
              Generate Full Playoff Schedule
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Creates: QF1-3, QF2-3, QF3-3, QF4-3, SF1-3, SF2-3, F1-3 (21 matches)
            </p>
          </div>

          <div className="flex space-x-2">
            <button 
              type="button" 
              onClick={() => setShowQuickGen(false)} 
              className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded-lg"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {showBulkImport && (
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Paste Match Numbers (one per line)
            </label>
            <textarea
              value={bulkImport}
              onChange={(e) => setBulkImport(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              rows={8}
              placeholder="Q1&#10;Q2&#10;Q3&#10;Q4&#10;..."
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Example: Q1, Q2, Q3... or SF1-1, SF1-2, F1...
            </p>
          </div>
          <div className="flex space-x-2">
            <button 
              type="button" 
              onClick={handleBulkImport}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg"
            >
              Import All Matches
            </button>
            <button 
              type="button" 
              onClick={() => setShowBulkImport(false)} 
              className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded-lg"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

function MatchCard({ match, competitions }: { match: Match; competitions: Competition[] }) {
  const competition = competitions.find((c) => c.id === match.competitionId);

  const handleDelete = async () => {
    if (confirm('Delete this match? This will also delete associated scouting data.')) {
      await firestoreDB.deleteMatch(match.id!);
      // Note: You may want to add cascade deletion for scouting data
    }
  };

  return (
    <div className="bg-gradient-to-r from-red-100 to-red-200 dark:from-red-900 dark:to-black p-4 rounded-lg flex items-center justify-between border border-red-800">
      <div>
        <span className="font-bold text-gray-800 dark:text-white">{match.matchNumber}</span>
        <span className="mx-2 text-gray-600 dark:text-gray-300">•</span>
        <span className="text-gray-700 dark:text-gray-300">{competition?.name || 'Unknown'}</span>
        <span className="mx-2 text-gray-600 dark:text-gray-300">•</span>
        <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">{match.matchType}</span>
      </div>
      <button onClick={handleDelete} className="btn-danger">
        <Trash2 size={18} />
      </button>
    </div>
  );
}
