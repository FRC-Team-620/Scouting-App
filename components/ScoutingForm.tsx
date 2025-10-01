'use client';

import { useState, useEffect } from 'react';
import { firestoreDB, ScoutingData, Competition, Team, Match } from '@/lib/db';
import { Save, Plus, Minus, AlertCircle } from 'lucide-react';

export default function ScoutingForm() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedCompetition, setSelectedCompetition] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [apiMatches, setApiMatches] = useState<Match[] | null>(null);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiMatchesFull, setApiMatchesFull] = useState<Match[] | null>(null);
  const [matchTeamsMap, setMatchTeamsMap] = useState<Record<string, Array<{ teamNumber: number; station?: string }>>>({});
  const [matchText, setMatchText] = useState('');

  // Helper to sort matches consistently (used for both Firestore and API-sourced matches)
  const sortMatches = (arr: Match[]) => {
    const order = (type: string) => {
      if (type === 'qualification') return 0;
      if (type === 'playoff') return 1;
      return 2;
    };

    const playoffStageRank = (s: string) => {
      if (!s) return 0;
      const up = s.toUpperCase();
      if (/^F\b|^F\d|\bFINAL/i.test(up)) return 3; // Finals
      if (/^SF/i.test(up)) return 2; // Semifinals
      if (/^QF/i.test(up)) return 1; // Quarterfinals
      return 0; // default playoff stage
    };

    const extractNumber = (s: string) => {
      if (!s) return Number.MAX_SAFE_INTEGER;
      const m = s.match(/(\d+)/);
      return m ? parseInt(m[0], 10) : Number.MAX_SAFE_INTEGER;
    };

    return arr.sort((a, b) => {
      const oa = order(a.matchType);
      const ob = order(b.matchType);
      if (oa !== ob) return oa - ob;

      // If both playoff, use stage rank to order (QF < SF < F)
      if (oa === 1 && ob === 1) {
        const ra = playoffStageRank(a.matchNumber);
        const rb = playoffStageRank(b.matchNumber);
        if (ra !== rb) return ra - rb;
      }

      const na = extractNumber(a.matchNumber);
      const nb = extractNumber(b.matchNumber);
      if (na !== nb) return na - nb;
      if (a.matchNumber < b.matchNumber) return -1;
      if (a.matchNumber > b.matchNumber) return 1;
      return 0;
    });
  };
  const [allScoutingData, setAllScoutingData] = useState<ScoutingData[]>([]);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState<Omit<ScoutingData, 'id' | 'createdAt'>>({
    competitionId: '',
    matchId: '',
    teamNumber: 0,
    scoutName: '',
    autoCoralL1: 0,
    autoCoralL2: 0,
    autoCoralL3: 0,
    autoCoralL4: 0,
    autoAlgaeBarge: 0,
    autoAlgaeProcessor: 0,
    autoLeaveZone: false,
    teleopCoralL1: 0,
    teleopCoralL2: 0,
    teleopCoralL3: 0,
    teleopCoralL4: 0,
    teleopAlgaeBarge: 0,
    teleopAlgaeProcessor: 0,
    deepClimb: false,
    shallowClimb: false,
    park: false,
    playedDefense: false,
    defenseRating: undefined,
    driverSkill: 3,
    robotSpeed: 3,
    notes: '',
  });

  useEffect(() => {
    const unsubCompetitions = firestoreDB.subscribeToCompetitions(setCompetitions);
    const unsubTeams = firestoreDB.subscribeToTeams(setTeams);
    const unsubScoutingData = firestoreDB.subscribeToScoutingData(setAllScoutingData);

    return () => {
      unsubCompetitions();
      unsubTeams();
      unsubScoutingData();
    };
  }, []);

  // Auto-save draft to localStorage
  useEffect(() => {
    const saveDraft = () => {
      if (formData.competitionId && formData.matchId && formData.teamNumber) {
        localStorage.setItem('scoutingDraft', JSON.stringify(formData));
      }
    };
    const timer = setTimeout(saveDraft, 1000);
    return () => clearTimeout(timer);
  }, [formData]);

  // Load draft on mount
  useEffect(() => {
    const draft = localStorage.getItem('scoutingDraft');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        setFormData(parsed);
        setSelectedCompetition(parsed.competitionId);
        // initialize matchText if draft has a matchId (we'll resolve it when matches are loaded)
        if (parsed.matchId) setMatchText('');
      } catch (e) {
        console.error('Failed to load draft:', e);
      }
    }
  }, []);

  // Check for duplicates
  useEffect(() => {
    if (formData.competitionId && formData.matchId && formData.teamNumber) {
      const duplicate = allScoutingData.some(
        (data) =>
          data.competitionId === formData.competitionId &&
          data.matchId === formData.matchId &&
          data.teamNumber === formData.teamNumber
      );
      setIsDuplicate(duplicate);
    } else {
      setIsDuplicate(false);
    }
  }, [formData.competitionId, formData.matchId, formData.teamNumber, allScoutingData]);

  useEffect(() => {
    if (selectedCompetition) {
      const unsubMatches = firestoreDB.subscribeToMatchesByCompetition(selectedCompetition, setMatches);
      return () => unsubMatches();
    } else {
      setMatches([]);
    }
  }, [selectedCompetition]);

  // Fetch matches from FRC API for the selected competition (if it has an eventKey)
  useEffect(() => {
    let mounted = true;
    const comp = competitions.find((c) => c.id === selectedCompetition);
    if (!comp || !comp.eventKey) {
      setApiMatches(null);
      setApiError(null);
      return;
    }

    // use top-level sortMatches helper

    const fetchMatches = async () => {
      setApiLoading(true);
      setApiError(null);
      try {
        const res = await fetch(`/api/frc/matches?eventCode=${encodeURIComponent(comp.eventKey)}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.message || body?.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        // Map returned items into our Match shape if necessary
        const mapped: Match[] = (data || []).map((m: any) => {
          const id = m.id || `${comp.id}-${m.description}`;
          return {
            id,
            competitionId: comp.id!,
            matchNumber: m.description || String(m.matchNumber),
            matchType: m.tournamentLevel === 'Qualification' ? 'qualification' : (m.tournamentLevel === 'Playoff' ? 'playoff' : 'practice'),
            teams: (m.teams || []).map((t: any) => Number(t.teamNumber)),
            createdAt: Date.now(),
          } as Match;
        });

        // Build a map of matchId -> detailed teams with station info for alliance lookup
        const teamsMap: Record<string, Array<{ teamNumber: number; station?: string }>> = {};
        (data || []).forEach((m: any) => {
          const id = m.id || `${comp.id}-${m.description}`;
          teamsMap[id] = (m.teams || []).map((t: any) => ({ teamNumber: Number(t.teamNumber), station: t.station }));
        });

        if (mounted) {
          const sorted = sortMatches(mapped.slice());
          setApiMatches(sorted);
          setApiMatchesFull(sorted);
          setMatchTeamsMap(teamsMap);
        }
      } catch (err: any) {
        if (mounted) setApiError(err?.message || 'Failed to fetch API matches');
      } finally {
        if (mounted) setApiLoading(false);
      }
    };

    fetchMatches();

    return () => {
      mounted = false;
    };
  }, [selectedCompetition, competitions]);

  // Keep matchText in sync with formData.matchId and matches
  useEffect(() => {
    if (formData.matchId) {
      const selected = sourceMatches.find((m) => m.id === formData.matchId);
      if (selected) setMatchText(selected.matchNumber);
    } else {
      // if no matchId, keep whatever user typed
    }
  }, [formData.matchId, matches, apiMatches]);

  // If the user clears the team number, restore the full API match list (if we have it)
  useEffect(() => {
    if (!formData.teamNumber && apiMatchesFull) {
      setApiMatches(apiMatchesFull);
    }
  }, [formData.teamNumber, apiMatchesFull]);

  // Compute filtered lists for datalists. Prefer API-provided matches (with teams) when available.
  const sourceMatches = apiMatches && apiMatches.length ? apiMatches : matches;
  const selectedMatch = sourceMatches.find((m) => m.id === formData.matchId);
  const visibleTeams = selectedMatch && selectedMatch.teams && selectedMatch.teams.length
    ? teams.filter((t) => selectedMatch.teams!.includes(t.teamNumber))
    : teams;

  // Compute visible matches:
  // - If matchText is non-empty, filter by matchNumber substring match (helps prevent showing the whole list when the user types/backspaces)
  // - Additionally, if teamNumber is present, also require the match to include that team
  const normalizedMatchText = matchText?.toString().trim();
  let visibleMatches = sourceMatches;
  if (normalizedMatchText && normalizedMatchText.length > 0) {
    const q = normalizedMatchText.toLowerCase();
    visibleMatches = visibleMatches.filter((m) => String(m.matchNumber).toLowerCase().includes(q));
  }
  if (formData.teamNumber && formData.teamNumber > 0) {
    visibleMatches = visibleMatches.filter((m) => (m.teams || []).includes(formData.teamNumber));
  }

  // When a teamNumber is typed, and the selected competition has an eventKey, fetch filtered matches from API
  useEffect(() => {
    const comp = competitions.find((c) => c.id === selectedCompetition);
    if (!comp || !comp.eventKey || !formData.teamNumber) return;

    let mounted = true;
    const fetchFiltered = async () => {
      try {
        setApiLoading(true);
        setApiError(null);
        const res = await fetch(`/api/frc/matches?eventCode=${encodeURIComponent(comp.eventKey)}&teamNumber=${encodeURIComponent(String(formData.teamNumber))}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.message || body?.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        const mapped: Match[] = (data || []).map((m: any) => {
          const id = m.id || `${comp.id}-${m.description}`;
          return {
            id,
            competitionId: comp.id!,
            matchNumber: m.description || String(m.matchNumber),
            matchType: m.tournamentLevel === 'Qualification' ? 'qualification' : (m.tournamentLevel === 'Playoff' ? 'playoff' : 'practice'),
            teams: (m.teams || []).map((t: any) => Number(t.teamNumber)),
            createdAt: Date.now(),
          } as Match;
        });
        const teamsMap: Record<string, Array<{ teamNumber: number; station?: string }>> = {};
        (data || []).forEach((m: any) => {
          const id = m.id || `${comp.id}-${m.description}`;
          teamsMap[id] = (m.teams || []).map((t: any) => ({ teamNumber: Number(t.teamNumber), station: t.station }));
        });
        if (mounted) {
          const sorted = sortMatches(mapped.slice());
          setApiMatches(sorted);
          // don't overwrite apiMatchesFull on a filtered fetch
          setMatchTeamsMap(teamsMap);
        }
      } catch (err: any) {
        if (mounted) setApiError(err?.message || 'Failed to fetch filtered matches');
      } finally {
        if (mounted) setApiLoading(false);
      }
    };

    fetchFiltered();

    return () => { mounted = false; };
  }, [formData.teamNumber, selectedCompetition, competitions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.competitionId || !formData.matchId || !formData.teamNumber) {
      alert('Please select competition, match, and team number');
      return;
    }

    if (isDuplicate) {
      const confirmOverwrite = confirm(
        `Data already exists for Team ${formData.teamNumber} in this match. Do you want to overwrite it?`
      );
      if (!confirmOverwrite) return;
    }

    setIsSubmitting(true);
    try {
      await firestoreDB.addScoutingData({
        ...formData,
        createdAt: Date.now(),
      });

      // Clear draft
      localStorage.removeItem('scoutingDraft');
      
      alert('Scouting data saved successfully!');
      
      // Reset form but keep competition and match selection
      setFormData({
        ...formData,
        teamNumber: 0,
      autoCoralL1: 0,
      autoCoralL2: 0,
      autoCoralL3: 0,
      autoCoralL4: 0,
      autoAlgaeBarge: 0,
      autoAlgaeProcessor: 0,
      autoLeaveZone: false,
      teleopCoralL1: 0,
      teleopCoralL2: 0,
      teleopCoralL3: 0,
      teleopCoralL4: 0,
      teleopAlgaeBarge: 0,
      teleopAlgaeProcessor: 0,
      deepClimb: false,
      shallowClimb: false,
      park: false,
      defenseRating: 3,
      driverSkill: 3,
      robotSpeed: 3,
      notes: '',
    });
    } catch (error) {
      console.error('Error saving data:', error);
      alert('Failed to save data. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const incrementValue = (field: keyof Omit<ScoutingData, 'id' | 'createdAt'>, max: number = 99) => {
    setFormData((prev) => ({
      ...prev,
      [field]: Math.min((prev[field] as number) + 1, max),
    }));
  };

  const decrementValue = (field: keyof Omit<ScoutingData, 'id' | 'createdAt'>) => {
    setFormData((prev) => ({
      ...prev,
      [field]: Math.max((prev[field] as number) - 1, 0),
    }));
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="site-card">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Match Scouting</h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Match Info Section */}
          <div className="site-card p-4">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Match Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Scout Name
                </label>
                <input
                  type="text"
                  value={formData.scoutName}
                  onChange={(e) => setFormData({ ...formData, scoutName: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Competition
                </label>
                <select
                  value={formData.competitionId}
                  onChange={(e) => {
                    const compId = e.target.value;
                    setFormData({ ...formData, competitionId: compId, matchId: '' });
                    setSelectedCompetition(compId);
                  }}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  required
                >
                  <option value="">Select Competition</option>
                  {competitions?.map((comp) => (
                    <option key={comp.id} value={comp.id}>
                      {comp.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Match
                </label>
                <input
                  list="matches-list"
                  value={matchText}
                  onChange={(e) => {
                    const value = e.target.value;
                    setMatchText(value);
                    // Find match by matchNumber within the preferred source (API matches if available)
                    const match = sourceMatches.find((m) => m.matchNumber === value);
                    if (match) {
                      setFormData({ ...formData, matchId: match.id! });
                    } else {
                      // Clear matchId if typed text doesn't match a known match
                      setFormData({ ...formData, matchId: '' });
                    }
                  }}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  placeholder={selectedCompetition ? 'Type or pick a match' : 'Select competition first'}
                  required
                  disabled={!selectedCompetition}
                />
                <datalist id="matches-list">
                  {visibleMatches?.map((match) => (
                    <option key={match.id} value={match.matchNumber}>
                      {match.matchNumber} ({match.matchType})
                    </option>
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center space-x-2">
                  <span>Team Number</span>
                  {/* Alliance badge */}
                  {(() => {
                    const matchId = formData.matchId;
                    const tnum = formData.teamNumber;
                    if (matchId && tnum && matchTeamsMap && matchTeamsMap[matchId]) {
                      const entry = matchTeamsMap[matchId].find((x) => x.teamNumber === Number(tnum));
                      if (entry && entry.station) {
                        const isRed = String(entry.station).toUpperCase().startsWith('R');
                        return (
                          <span className={`text-xs font-semibold px-2 py-1 rounded ${isRed ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'}`}>
                            {isRed ? 'Red' : 'Blue'}
                          </span>
                        );
                      }
                    }
                    return null;
                  })()}
                </label>
                <input
                  list="teams-list"
                  value={formData.teamNumber ? String(formData.teamNumber) : ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    const num = parseInt(v);
                    if (!isNaN(num)) {
                      setFormData({ ...formData, teamNumber: num });
                    } else {
                      setFormData({ ...formData, teamNumber: 0 });
                    }
                  }}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  placeholder="Type team number or pick from list"
                  required
                />
                <datalist id="teams-list">
                  {visibleTeams?.map((team) => (
                    <option key={team.id} value={String(team.teamNumber)}>
                      {team.teamNumber} - {team.teamName}
                    </option>
                  ))}
                </datalist>
              </div>
            </div>
            
            {/* Duplicate Warning */}
            {isDuplicate && (
              <div className="mt-4 bg-yellow-100 dark:bg-yellow-900 border-l-4 border-yellow-500 p-4 rounded">
                <div className="flex items-center">
                  <AlertCircle className="text-yellow-700 dark:text-yellow-300 mr-2" size={20} />
                  <p className="text-yellow-700 dark:text-yellow-300 font-medium">
                    Warning: Data already exists for this team in this match. Submitting will overwrite existing data.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Autonomous Section */}
          <div className="site-card p-4">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Autonomous Period</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <CounterField
                label="Coral L1"
                value={formData.autoCoralL1}
                onIncrement={() => incrementValue('autoCoralL1')}
                onDecrement={() => decrementValue('autoCoralL1')}
              />
              <CounterField
                label="Coral L2"
                value={formData.autoCoralL2}
                onIncrement={() => incrementValue('autoCoralL2')}
                onDecrement={() => decrementValue('autoCoralL2')}
              />
              <CounterField
                label="Coral L3"
                value={formData.autoCoralL3}
                onIncrement={() => incrementValue('autoCoralL3')}
                onDecrement={() => decrementValue('autoCoralL3')}
              />
              <CounterField
                label="Coral L4"
                value={formData.autoCoralL4}
                onIncrement={() => incrementValue('autoCoralL4')}
                onDecrement={() => decrementValue('autoCoralL4')}
              />
              <CounterField
                label="Algae in Barge"
                value={formData.autoAlgaeBarge}
                onIncrement={() => incrementValue('autoAlgaeBarge')}
                onDecrement={() => decrementValue('autoAlgaeBarge')}
              />
              <CounterField
                label="Algae in Processor"
                value={formData.autoAlgaeProcessor}
                onIncrement={() => incrementValue('autoAlgaeProcessor')}
                onDecrement={() => decrementValue('autoAlgaeProcessor')}
              />
              <div className="col-span-full">
                <label className="flex items-center space-x-3 cursor-pointer p-3 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-300 dark:border-gray-600 hover:border-blue-500 transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.autoLeaveZone}
                    onChange={(e) => setFormData({ ...formData, autoLeaveZone: e.target.checked })}
                    className="w-7 h-7 rounded border-gray-300"
                  />
                  <span className="text-gray-700 dark:text-gray-300 font-medium text-lg">Left Starting Zone</span>
                </label>
              </div>
            </div>
          </div>

          {/* Teleop Section */}
          <div className="site-card p-4">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Teleoperated Period</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <CounterField
                label="Coral L1"
                value={formData.teleopCoralL1}
                onIncrement={() => incrementValue('teleopCoralL1')}
                onDecrement={() => decrementValue('teleopCoralL1')}
              />
              <CounterField
                label="Coral L2"
                value={formData.teleopCoralL2}
                onIncrement={() => incrementValue('teleopCoralL2')}
                onDecrement={() => decrementValue('teleopCoralL2')}
              />
              <CounterField
                label="Coral L3"
                value={formData.teleopCoralL3}
                onIncrement={() => incrementValue('teleopCoralL3')}
                onDecrement={() => decrementValue('teleopCoralL3')}
              />
              <CounterField
                label="Coral L4"
                value={formData.teleopCoralL4}
                onIncrement={() => incrementValue('teleopCoralL4')}
                onDecrement={() => decrementValue('teleopCoralL4')}
              />
              <CounterField
                label="Algae in Barge"
                value={formData.teleopAlgaeBarge}
                onIncrement={() => incrementValue('teleopAlgaeBarge')}
                onDecrement={() => decrementValue('teleopAlgaeBarge')}
              />
              <CounterField
                label="Algae in Processor"
                value={formData.teleopAlgaeProcessor}
                onIncrement={() => incrementValue('teleopAlgaeProcessor')}
                onDecrement={() => decrementValue('teleopAlgaeProcessor')}
              />
            </div>
          </div>

          {/* Endgame Section */}
          <div className="site-card p-4">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Endgame</h3>
            <div className="space-y-3">
              <label className="flex items-center space-x-3 cursor-pointer p-4 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-300 dark:border-gray-600 hover:border-purple-500 transition-colors">
                <input
                  type="checkbox"
                  checked={formData.deepClimb}
                  onChange={(e) => setFormData({ ...formData, deepClimb: e.target.checked })}
                  className="w-7 h-7 rounded border-gray-300"
                />
                <span className="text-gray-700 dark:text-gray-300 font-medium text-lg">Deep Climb</span>
              </label>
              <label className="flex items-center space-x-3 cursor-pointer p-4 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-300 dark:border-gray-600 hover:border-purple-500 transition-colors">
                <input
                  type="checkbox"
                  checked={formData.shallowClimb}
                  onChange={(e) => setFormData({ ...formData, shallowClimb: e.target.checked })}
                  className="w-7 h-7 rounded border-gray-300"
                />
                <span className="text-gray-700 dark:text-gray-300 font-medium text-lg">Shallow Climb</span>
              </label>
              <label className="flex items-center space-x-3 cursor-pointer p-4 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-300 dark:border-gray-600 hover:border-purple-500 transition-colors">
                <input
                  type="checkbox"
                  checked={formData.park}
                  onChange={(e) => setFormData({ ...formData, park: e.target.checked })}
                  className="w-7 h-7 rounded border-gray-300"
                />
                <span className="text-gray-700 dark:text-gray-300 font-medium text-lg">Park</span>
              </label>
            </div>
          </div>

          {/* Ratings Section */}
          <div className="site-card p-4">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Performance Ratings</h3>
              <div className="space-y-4">
                <label className="flex items-center space-x-3 cursor-pointer p-3 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-300 dark:border-gray-600 hover:border-yellow-500 transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.playedDefense}
                    onChange={(e) => setFormData({ ...formData, playedDefense: e.target.checked, defenseRating: e.target.checked ? formData.defenseRating ?? 3 : undefined })}
                    className="w-6 h-6 rounded border-gray-300"
                  />
                  <span className="text-gray-700 dark:text-gray-300 font-medium text-lg">Played Defense?</span>
                </label>

                {formData.playedDefense && (
                  <SegmentedRating
                    label="Defense Rating"
                    value={formData.defenseRating ?? 3}
                    onChange={(val) => setFormData({ ...formData, defenseRating: val })}
                  />
                )}

                <SegmentedRating
                  label="Driver Skill"
                  value={formData.driverSkill}
                  onChange={(val) => setFormData({ ...formData, driverSkill: val })}
                />

                <SegmentedRating
                  label="Robot Speed"
                  value={formData.robotSpeed}
                  onChange={(val) => setFormData({ ...formData, robotSpeed: val })}
                />
              </div>
          </div>

          {/* Notes Section */}
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Additional Notes</h3>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              rows={4}
              placeholder="Any additional observations about the robot's performance..."
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full font-bold py-4 px-6 rounded-lg flex items-center justify-center space-x-2 transition-colors text-lg ${
              isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'btn-primary'
            } text-white`}
          >
            <Save size={24} />
            <span>{isSubmitting ? 'Saving...' : 'Save Scouting Data'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}

function CounterField({
  label,
  value,
  onIncrement,
  onDecrement,
}: {
  label: string;
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  return (
    <div>
      <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-2">{label}</label>
      <div className="flex items-center space-x-3">
        <button
          type="button"
          onClick={onDecrement}
          className="bg-red-500 hover:bg-red-600 active:bg-red-700 text-white p-4 rounded-xl transition-colors touch-manipulation min-w-[60px] min-h-[60px] flex items-center justify-center"
        >
          <Minus size={28} />
        </button>
        <div className="flex-1 text-center bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-xl py-4 font-bold text-2xl min-h-[60px] flex items-center justify-center">
          {value}
        </div>
        <button
          type="button"
          onClick={onIncrement}
          className="bg-green-500 hover:bg-green-600 active:bg-green-700 text-white p-4 rounded-xl transition-colors touch-manipulation min-w-[60px] min-h-[60px] flex items-center justify-center"
        >
          <Plus size={28} />
        </button>
      </div>
    </div>
  );
}

function RatingField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}: {value}/5
      </label>
      <input
        type="range"
        min="1"
        max="5"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
      />
      <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mt-1">
        <span>Poor</span>
        <span>Average</span>
        <span>Excellent</span>
      </div>
    </div>
  );
}

// SegmentedRating: big tappable buttons for 1-5 ratings (better on touch)
function SegmentedRating({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{label}: {value}/5</label>
      <div className="inline-flex rounded-lg overflow-hidden border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800">
        {[1, 2, 3, 4, 5].map((n) => {
          const selected = n === value;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={`px-4 py-3 text-sm font-semibold focus:outline-none transition-colors ${selected ? 'bg-yellow-500 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mt-1">
        <span>Poor</span>
        <span>Average</span>
        <span>Excellent</span>
      </div>
    </div>
  );
}
