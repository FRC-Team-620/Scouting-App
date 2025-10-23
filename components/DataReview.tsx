'use client';

import { useState, useMemo, useEffect } from 'react';
import { firestoreDB, ScoutingData, Competition, Team, Match } from '@/lib/db';
import { Download, Filter, TrendingUp, Award } from 'lucide-react';

export default function DataReview() {
  const [selectedCompetition, setSelectedCompetition] = useState<string | null>(null);
  const [searchText, setSearchText] = useState<string>('');
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [selectedTeamNumber, setSelectedTeamNumber] = useState<number | null>(null);
  const [selectedMatchNumber, setSelectedMatchNumber] = useState<string | null>(null);

  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [allScoutingData, setAllScoutingData] = useState<ScoutingData[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

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

  // Subscribe to matches for the selected competition so we can show human-friendly match numbers
  useEffect(() => {
    // Clear any previous selections/search when competition changes to avoid cross-competition mismatch
    setSelectedMatchId(null);
    setSelectedMatchNumber(null);
    setSelectedTeamNumber(null);
    setSearchText('');
    setShowSuggestions(false);

    if (!selectedCompetition) {
      setMatches([]);
      return;
    }
    const unsub = firestoreDB.subscribeToMatchesByCompetition(selectedCompetition, setMatches);
    return () => unsub();
  }, [selectedCompetition]);

  const filteredData = useMemo(() => {
    if (!allScoutingData) return [];
    
    let data = [...allScoutingData];
    
    // Filter to selected competition (if any)
    if (selectedCompetition) {
      data = data.filter((d) => d.competitionId === selectedCompetition);
    }

    // If a suggestion was chosen, prefer the explicit selection
    if (selectedMatchId || selectedMatchNumber) {
      // Build lookup of matchId -> matchNumber
      const localMatchNumberById = new Map<string, string>();
      matches.forEach((m) => {
        if (m.id) localMatchNumberById.set(m.id, String(m.matchNumber || ''));
      });

      data = data.filter((d) => {
        const stored = String(d.matchId || '');
        const storedMatchNumber = localMatchNumberById.get(stored) || '';
        // Match if scouting row stored the match document id, or the human match number, or the lookup resolves to the selected number
        const byDocId = selectedMatchId ? stored === selectedMatchId : false;
        const byStoredNumber = selectedMatchNumber ? stored === selectedMatchNumber : false;
        const byResolvedNumber = selectedMatchNumber ? storedMatchNumber === selectedMatchNumber : false;
        return byDocId || byStoredNumber || byResolvedNumber;
      });
      return data;
    }
    if (selectedTeamNumber) {
      data = data.filter((d) => d.teamNumber === selectedTeamNumber);
      return data;
    }

    // Apply match/team search: only when a competition is selected. Match against team number, match number (from matches), or scout name
    if (selectedCompetition && searchText && searchText.trim().length > 0) {
      const q = searchText.trim().toLowerCase();
      const asNum = Number(q);
      // Build a quick lookup of matchId -> matchNumber
      const localMatchNumberById = new Map<string, string>();
      matches.forEach((m) => {
        if (m.id) localMatchNumberById.set(m.id, String(m.matchNumber || ''));
      });

      data = data.filter((d) => {
        const matchNumber = String(localMatchNumberById.get(d.matchId) || '').toLowerCase();
        const byTeam = !isNaN(asNum) && Number(d.teamNumber) === asNum;
        const byMatchNumber = matchNumber.includes(q);
        const byScout = String(d.scoutName || '').toLowerCase().includes(q);
        return byTeam || byMatchNumber || byScout;
      });
  }
    
    return data;
  }, [allScoutingData, selectedCompetition, searchText]);

  // Compute match points according to the scoring reference image:
  // - Auto coral: L4=7, L3=6, L2=4, L1=3
  // - Teleop coral: L4=5, L3=4, L2=3, L1=2
  // - Algae: Barge = 2 pts each (auto and teleop), Processor = 6 pts each
  // - Auto: leaving starting zone = 3 pts
  // - Endgame: deep climb = 12, shallow climb = 6, park = 2
  // - Fouls: minor = 2 (deduct), major = 6 (deduct)
  const computePoints = (d: ScoutingData) => {
    const autoCoral = (d.autoCoralL4 || 0) * 7 + (d.autoCoralL3 || 0) * 6 + (d.autoCoralL2 || 0) * 4 + (d.autoCoralL1 || 0) * 3;
    const teleopCoral = (d.teleopCoralL4 || 0) * 5 + (d.teleopCoralL3 || 0) * 4 + (d.teleopCoralL2 || 0) * 3 + (d.teleopCoralL1 || 0) * 2;
    const autoAlgae = (d.autoAlgaeBarge || 0) * 2 + (d.autoAlgaeProcessor || 0) * 6;
    const teleAlgae = (d.teleopAlgaeBarge || 0) * 2 + (d.teleopAlgaeProcessor || 0) * 6;
    const autoBonus = d.autoLeaveZone ? 3 : 0;
    const endgamePts = d.endgame === 'deep' ? 12 : d.endgame === 'shallow' ? 6 : d.endgame === 'park' ? 2 : 0;
    const fouls = -((d.minorFouls || 0) * 2 + (d.majorFouls || 0) * 6);
    return autoCoral + teleopCoral + autoAlgae + teleAlgae + autoBonus + endgamePts + fouls;
  };
  const teamStats = useMemo(() => {
  if (!filteredData.length) return [];

  const statsMap = new Map<number, {
      teamNumber: number;
      matchCount: number;
      avgAutoCoralL4: number;
      avgTeleopCoralL4: number;
      avgTeleopCoralL3: number;
  avgTeleopCoralL2: number;
      avgTeleopCoralL1: number;
      avgAutoCoralL1: number;
      avgAutoCoralL2: number;
  avgAutoCoralL3: number;
      avgAlgaeBarge: number;
      avgAlgaeProcessor: number;
  avgAutoAlgaeInNet?: number;
  avgTeleopAlgaeInNet?: number;
      totalMinorFouls: number;
      totalMajorFouls: number;
  endgameDeepCount: number;
  endgameShallowCount: number;
  endgameParkCount: number;
      avgDriverSkill: number;
      avgDefenseRating: number;
      matchCountWithDefense: number;
      avgRobotSpeed: number;
    totalCoralL4: number;
    totalAutoCoral: number;
    totalTeleopCoral: number;
    totalCoral: number;
    totalAlgae: number;
      totalPoints: number;
    }>();

    filteredData.forEach((data) => {
      const existing = statsMap.get(data.teamNumber) || {
        teamNumber: data.teamNumber,
        matchCount: 0,
        avgAutoCoralL4: 0,
        avgTeleopCoralL4: 0,
        avgTeleopCoralL3: 0,
        avgTeleopCoralL2: 0,
        avgTeleopCoralL1: 0,
        avgAutoCoralL1: 0,
        avgAutoCoralL2: 0,
  avgAutoCoralL3: 0,
        avgAlgaeBarge: 0,
        avgAlgaeProcessor: 0,
    // removed in-net metrics (kept optional fields for backward compatibility)
        totalMinorFouls: 0,
        totalMajorFouls: 0,
  endgameDeepCount: 0,
  endgameShallowCount: 0,
  endgameParkCount: 0,
        avgDriverSkill: 0,
        avgDefenseRating: 0,
        matchCountWithDefense: 0,
        avgRobotSpeed: 0,
    totalCoralL4: 0,
    totalAutoCoral: 0,
    totalTeleopCoral: 0,
    totalCoral: 0,
    totalAlgae: 0,
        totalPoints: 0,
      };

      existing.matchCount++;
      // Accumulate coral levels (auto + teleop where present)
      existing.avgAutoCoralL1 += (data.autoCoralL1 || 0);
      existing.avgAutoCoralL2 += (data.autoCoralL2 || 0);
      existing.avgAutoCoralL3 += (data.autoCoralL3 || 0);
      existing.avgAutoCoralL4 += data.autoCoralL4;
      existing.avgTeleopCoralL4 += data.teleopCoralL4;
      existing.avgTeleopCoralL3 += data.teleopCoralL3;
      existing.avgTeleopCoralL2 += data.teleopCoralL2;
      existing.avgTeleopCoralL1 += (data.teleopCoralL1 || 0);
      existing.avgTeleopCoralL2 += data.teleopCoralL2;
  const algaeSum = (data.autoAlgaeBarge || 0) + (data.teleopAlgaeBarge || 0) + (data.autoAlgaeProcessor || 0) + (data.teleopAlgaeProcessor || 0);
  existing.avgAlgaeBarge += (data.autoAlgaeBarge || 0) + (data.teleopAlgaeBarge || 0);
  existing.avgAlgaeProcessor += (data.autoAlgaeProcessor || 0) + (data.teleopAlgaeProcessor || 0);
  // in-net values removed; only track barge/processor
    // Totals
    const autoCoralSum = (data.autoCoralL1 || 0) + (data.autoCoralL2 || 0) + (data.autoCoralL3 || 0) + (data.autoCoralL4 || 0);
    const teleopCoralSum = (data.teleopCoralL1 || 0) + (data.teleopCoralL2 || 0) + (data.teleopCoralL3 || 0) + (data.teleopCoralL4 || 0);
    existing.totalAutoCoral += autoCoralSum;
    existing.totalTeleopCoral += teleopCoralSum;
    existing.totalCoral += autoCoralSum + teleopCoralSum;
    existing.totalAlgae += algaeSum;
      existing.totalMinorFouls += (data.minorFouls || 0);
      existing.totalMajorFouls += (data.majorFouls || 0);
  existing.endgameDeepCount += (data.endgame === 'deep') ? 1 : 0;
  existing.endgameShallowCount += (data.endgame === 'shallow') ? 1 : 0;
  existing.endgameParkCount += (data.endgame === 'park') ? 1 : 0;
      existing.avgDriverSkill += data.driverSkill;
      // defenseRating may be optional; only include when playedDefense is true
      if (data.playedDefense && typeof data.defenseRating === 'number') {
        existing.avgDefenseRating += data.defenseRating;
        existing.matchCountWithDefense += 1;
      }
      existing.avgRobotSpeed += data.robotSpeed;
      existing.totalCoralL4 += data.autoCoralL4 + data.teleopCoralL4;
    // Use computePoints helper for accurate scoring
    existing.totalPoints += computePoints(data);

      statsMap.set(data.teamNumber, existing);
    });

    return Array.from(statsMap.values()).map((stats) => ({
      ...stats,
      // Auto coral L1-L4 averages
      avgAutoCoralL1: stats.avgAutoCoralL1 / stats.matchCount,
      avgAutoCoralL2: stats.avgAutoCoralL2 / stats.matchCount,
      avgAutoCoralL3: stats.avgAutoCoralL3 / stats.matchCount,
      avgAutoCoralL4: stats.avgAutoCoralL4 / stats.matchCount,
      // Teleop coral L1-L4 averages
      avgTeleopCoralL1: stats.avgTeleopCoralL1 / stats.matchCount,
      avgTeleopCoralL2: stats.avgTeleopCoralL2 / stats.matchCount,
      avgTeleopCoralL3: stats.avgTeleopCoralL3 / stats.matchCount,
      avgTeleopCoralL4: stats.avgTeleopCoralL4 / stats.matchCount,
      // Algae averages
      avgAlgaeBarge: stats.avgAlgaeBarge / stats.matchCount,
      avgAlgaeProcessor: stats.avgAlgaeProcessor / stats.matchCount,
  avgAutoAlgaeInNet: 0,
  avgTeleopAlgaeInNet: 0,
      // Fouls
      avgMinorFouls: stats.totalMinorFouls / stats.matchCount,
      avgMajorFouls: stats.totalMajorFouls / stats.matchCount,
      // Other averages
      avgDriverSkill: stats.avgDriverSkill / stats.matchCount,
      avgDefenseRating: stats.matchCountWithDefense ? (stats.avgDefenseRating / stats.matchCountWithDefense) : 0,
      avgRobotSpeed: stats.avgRobotSpeed / stats.matchCount,
  deepClimbRate: (stats.endgameDeepCount / stats.matchCount) * 100,
  shallowClimbRate: (stats.endgameShallowCount / stats.matchCount) * 100,
      avgPoints: stats.totalPoints / stats.matchCount,
    })).sort((a, b) => b.avgPoints - a.avgPoints);
  }, [filteredData]);

  // Sorting for Team Performance Summary
  type SortKey =
    | 'teamNumber'
    | 'avgPoints'
    | 'avgAutoCoralL4'
    | 'avgTeleopCoralL4'
    | 'avgTeleopCoralL3'
    | 'avgAlgaeBarge'
    | 'deepClimbRate'
    | 'avgDriverSkill'
    | 'avgDefenseRating'
    | 'totalCoral';

  const [sortKey, setSortKey] = useState<SortKey>('avgPoints');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sortedTeamStats = useMemo(() => {
    const arr = [...teamStats];
    arr.sort((a: any, b: any) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      let cmp = 0;
      if (typeof va === 'string' && typeof vb === 'string') {
        cmp = va.localeCompare(vb);
      } else {
        const na = Number(va);
        const nb = Number(vb);
        cmp = na === nb ? 0 : na < nb ? -1 : 1;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [teamStats, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      // Default to descending for metrics; teamNumber/matchCount can also benefit from desc by default
      setSortDir('desc');
    }
  };

  // Map of matchId -> human-friendly matchNumber (for display)
  const matchNumberById = useMemo(() => {
    const m = new Map<string, string>();
    matches.forEach((mi) => {
      if (mi.id) m.set(mi.id, String(mi.matchNumber || ''));
    });
    return m;
  }, [matches]);

  

  const displayMatchLabel = (raw: string | undefined) => {
    if (!raw) return '';
    const rawStr = String(raw);
    const looked = matchNumberById.get(rawStr);
    if (looked) return looked;
    if (rawStr.includes('-')) {
      const last = rawStr.split('-').pop()!.trim();
      if (last.length > 0) return last;
    }
    if (rawStr.length > 40) return rawStr.slice(0, 36) + '...';
    return rawStr;
  };

  // When a team is selected show per-match series for charts
  const selectedTeamRows = useMemo(() => {
    if (!selectedTeamNumber) return [] as ScoutingData[];
    return filteredData.filter((d) => d.teamNumber === selectedTeamNumber);
  }, [filteredData, selectedTeamNumber]);

  const pointsSeries = useMemo(() => {
    // per-match points (using same simplified calculation)
    return selectedTeamRows.map((d) => {
  const pts = computePoints(d);
      return {
        label: displayMatchLabel(d.matchId),
        points: pts || 0,
      };
    });
  }, [selectedTeamRows]);


  const driverSeries = useMemo(() => {
    return selectedTeamRows.map((d) => ({ label: displayMatchLabel(d.matchId), value: Number(d.driverSkill) || 0 }));
  }, [selectedTeamRows]);

 

  // Interactive metric selectors for the trend graph
  const metricOptions = useMemo(() => ([
    { key: 'driverSkill', label: 'Driver Skill', color: '#f97316', accessor: (r: ScoutingData) => Number(r.driverSkill) || 0 },
    { key: 'defenseRating', label: 'Defense Rating', color: '#06b6d4', accessor: (r: ScoutingData) => (r.playedDefense ? (Number(r.defenseRating) || 0) : 0) },
    { key: 'robotSpeed', label: 'Robot Speed', color: '#10b981', accessor: (r: ScoutingData) => Number(r.robotSpeed) || 0 },
  { key: 'points', label: 'Points', color: '#ef4444', accessor: (r: ScoutingData) => computePoints(r) },
    { key: 'minorFouls', label: 'Minor Fouls', color: '#8b5cf6', accessor: (r: ScoutingData) => Number(r.minorFouls) || 0 },
    { key: 'majorFouls', label: 'Major Fouls', color: '#a78bfa', accessor: (r: ScoutingData) => Number(r.majorFouls) || 0 },
  ]), []);

  // single-metric selection for trend explorer
  const [selectedMetric, setSelectedMetric] = useState<string>('driverSkill');

  const metricSeriesMap = useMemo(() => {
    // produce a map: key -> [{label, value}]
    const map: Record<string, Array<{ label: string; value: number }>> = {};
    metricOptions.forEach((m) => {
      map[m.key] = selectedTeamRows.map((r) => ({ label: displayMatchLabel(r.matchId), value: m.accessor(r) }));
    });
    return map;
  }, [metricOptions, selectedTeamRows]);

  // Compute mean, sample std deviation, and count for each metric option for the selected team
  const metricStats = useMemo(() => {
    return metricOptions.map((m) => {
      const vals = selectedTeamRows.map((r) => Number(m.accessor(r) || 0));
      const count = vals.length;
      const mean = count ? vals.reduce((s, v) => s + v, 0) / count : 0;
      const sd = count > 1 ? Math.sqrt(vals.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (count - 1)) : 0;
      return { key: m.key, label: m.label, mean, sd, count, color: m.color };
    });
  }, [metricOptions, selectedTeamRows]);

  // convenience: stats for the currently selected team (single object)
  const selectedTeamStats = useMemo(() => {
    if (!selectedTeamNumber) return null;
    return teamStats.find((t) => t.teamNumber === selectedTeamNumber) || null;
  }, [teamStats, selectedTeamNumber]);

  const exportToCSV = () => {
    if (!filteredData.length) {
      alert('No data to export');
      return;
    }

    const headers = [
      'Competition ID', 'Match ID', 'Team Number', 'Scout Name',
      'Auto Coral L1', 'Auto Coral L2', 'Auto Coral L3', 'Auto Coral L4',
      'Auto Algae Barge', 'Auto Algae Processor', 'Auto Leave Zone',
      'Teleop Coral L1', 'Teleop Coral L2', 'Teleop Coral L3', 'Teleop Coral L4',
      'Teleop Algae Barge', 'Teleop Algae Processor',
  'Endgame',
      'Played Defense?', 'Defense Rating', 'Driver Skill', 'Robot Speed', 'Notes'
    ];

    const rows = filteredData.map((data) => [
      data.competitionId, data.matchId, data.teamNumber, data.scoutName,
      data.autoCoralL1, data.autoCoralL2, data.autoCoralL3, data.autoCoralL4,
      data.autoAlgaeBarge, data.autoAlgaeProcessor, data.autoLeaveZone,
      data.teleopCoralL1, data.teleopCoralL2, data.teleopCoralL3, data.teleopCoralL4,
      data.teleopAlgaeBarge, data.teleopAlgaeProcessor,
  data.endgame || 'none',
      data.playedDefense ? 'Yes' : 'No', (data.playedDefense ? data.defenseRating : ''), data.driverSkill, data.robotSpeed, `"${(data.notes || '')}"`
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scouting-data-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Suggestions for search-as-you-type: combine matches (for selected competition) and teams
  const suggestions = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!selectedCompetition || !q) return [] as Array<{ type: 'match' | 'team'; id: string; label: string; value: string }>;

    const results: Array<{ type: 'match' | 'team'; id: string; label: string; value: string }> = [];

    // Match suggestions (from selected competition)
    matches.forEach((m) => {
      const label = `${m.matchNumber} (${m.matchType})`;
      if (label.toLowerCase().includes(q) || String(m.matchNumber).toLowerCase().includes(q)) {
        results.push({ type: 'match', id: m.id || '', label, value: String(m.matchNumber) });
      }
    });

    // Team suggestions: prefer teams listed on matches for this competition
    const teamNumbersInMatches = new Set<number>();
    matches.forEach((m) => {
      if (Array.isArray(m.teams)) {
        m.teams.forEach((tn) => teamNumbersInMatches.add(Number(tn)));
      }
    });

    // If matches don't include team lists, fallback to scouting rows for this competition
    if (teamNumbersInMatches.size === 0) {
      allScoutingData.forEach((d) => {
        if (d.competitionId === selectedCompetition) teamNumbersInMatches.add(Number(d.teamNumber));
      });
    }

    // Build a lookup for teamNumber -> Team doc (to include teamName when available)
    const teamByNumber = new Map<number, Team>();
    teams.forEach((t) => teamByNumber.set(Number(t.teamNumber), t));

    Array.from(teamNumbersInMatches).forEach((tn) => {
      const teamDoc = teamByNumber.get(Number(tn));
      const label = teamDoc ? `${tn} - ${teamDoc.teamName}` : String(tn);
      if (label.toLowerCase().includes(q) || String(tn).toLowerCase().includes(q)) {
        results.push({ type: 'team', id: teamDoc?.id || '', label, value: String(tn) });
      }
    });

    // Limit to top 12 suggestions
    return results.slice(0, 12);
  }, [searchText, matches, teams, allScoutingData, selectedCompetition]);

  const applySuggestion = (s: { type: 'match' | 'team'; id: string; label: string; value: string }) => {
    setShowSuggestions(false);
    setHighlightedIndex(-1);
    if (s.type === 'match') {
      // s.id is the match document id; s.value is the human match number/label
      setSelectedMatchId(s.id || null);
      setSelectedMatchNumber(s.value || null);
      setSelectedTeamNumber(null);
      setSearchText(String(s.value));
    } else {
      // team suggestion
      const num = Number(s.value);
      setSelectedTeamNumber(!isNaN(num) ? num : null);
      setSelectedMatchId(null);
      setSelectedMatchNumber(null);
      setSearchText(String(s.value));
    }
  };

  // Reset highlighted index when suggestions list changes or when suggestions are shown/hidden
  useEffect(() => {
    if (showSuggestions && suggestions.length > 0) setHighlightedIndex(0);
    else setHighlightedIndex(-1);
  }, [showSuggestions, suggestions.length]);

  

  // Normalize match ids: update scouting rows that reference a human-readable match label
  // or an alternate id to point to the canonical match document id for the selected competition and matchNumber.
  const normalizeSelectedMatchIds = async () => {
    if (!selectedCompetition || !selectedMatchNumber) {
      alert('Select a competition and a match (via suggestions) before normalizing.');
      return;
    }

    // Find canonical matches in this competition with that matchNumber
    const canonical = matches.filter((m) => String(m.matchNumber) === String(selectedMatchNumber));
    if (!canonical.length) {
      alert('No canonical match document found for the selected match number in this competition.');
      return;
    }

    // Choose first canonical id (if duplicates exist, we pick the first)
    const canonicalId = canonical[0].id;
    if (!canonicalId) {
      alert('Canonical match document id not found.');
      return;
    }

    // Find scouting rows in the same competition that appear to reference this match (by display or raw)
    const toUpdate = allScoutingData.filter((d) => {
      if (d.competitionId !== selectedCompetition) return false;
      const raw = String(d.matchId || '');
      // match if raw equals canonical id already
      if (raw === canonicalId) return false; // already normalized
      // if raw equals the display label
  if (displayMatchLabel(raw) === selectedMatchNumber) return true;
      // if raw contains the display label as suffix (docid-Qualification 9)
      if (raw.endsWith(selectedMatchNumber)) return true;
      // if raw equals the human matchNumber itself
      if (raw === String(selectedMatchNumber)) return true;
      return false;
    });

    if (!toUpdate.length) {
      alert('No scouting rows found that reference this match (nothing to normalize).');
      return;
    }

    if (!confirm(`Normalize ${toUpdate.length} scouting rows to canonical match id ${canonicalId}?`)) return;

    try {
      for (const row of toUpdate) {
        await firestoreDB.updateScoutingData(row.id!, { matchId: canonicalId });
      }
      alert(`Updated ${toUpdate.length} scouting rows.`);
    } catch (err) {
      console.error('Normalization failed', err);
      alert('Failed to normalize some rows. See console for details.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Filters */}
      <div className="site-card">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Data Review & Analysis</h2>
          <div className="flex items-center space-x-2">
            <button onClick={exportToCSV} className="btn-primary flex items-center space-x-2">
              <Download size={20} />
              <span>Export CSV</span>
            </button>
            <button onClick={normalizeSelectedMatchIds} disabled={!selectedMatchNumber || !selectedCompetition} className="ml-2 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg">
              Normalize Match IDs
            </button>
          </div>
        </div>

        {/* Competition selector + Match/Team search */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Competition</label>
            <select
              value={selectedCompetition || ''}
              onChange={(e) => setSelectedCompetition(e.target.value || null)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Select Competition</option>
              {competitions?.map((comp) => (
                <option key={comp.id} value={comp.id}>
                  {comp.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Match / Team Search</label>
            <div className="relative">
              <input
                type="text"
                value={searchText}
                onChange={(e) => { setSearchText(e.target.value); setShowSuggestions(true); setSelectedMatchId(null); setSelectedTeamNumber(null); }}
                onFocus={() => {
                  setShowSuggestions(true);
                  // If a match/team is already selected, keep the input populated when re-focusing
                  if (!searchText) {
                    if (selectedMatchNumber) setSearchText(String(selectedMatchNumber));
                    else if (selectedTeamNumber) setSearchText(String(selectedTeamNumber));
                  }
                }}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (showSuggestions && suggestions.length > 0) {
                      e.preventDefault();
                      const idx = Math.max(0, highlightedIndex >= 0 ? highlightedIndex : 0);
                      applySuggestion(suggestions[idx]);
                    }
                  } else if (e.key === 'Escape') {
                    setShowSuggestions(false);
                  } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    if (!showSuggestions) setShowSuggestions(true);
                    setHighlightedIndex((i) => Math.min((suggestions.length - 1) || 0, Math.max(0, i + 1)));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setHighlightedIndex((i) => Math.max(0, i - 1));
                  }
                }}
                placeholder="Type match number, team number or team name"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />

              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-20 left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded mt-1 max-h-60 overflow-auto shadow-lg">
                  {suggestions.map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onMouseDown={() => applySuggestion(s)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={`w-full text-left px-4 py-2 transition-colors flex items-center space-x-2 ${highlightedIndex === idx ? 'bg-gray-100 dark:bg-gray-700' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                    >
                      <span className="text-xs text-gray-500 dark:text-gray-400">{s.type === 'match' ? 'Match' : 'Team'}</span>
                      <span className="font-medium">{s.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* old separate filters removed: use Competition dropdown and Match/Team search above */}
      </div>

      {/* Summary cards removed per request */}

      {/* Team Statistics Table */}
      <div className="site-card">
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Team Performance Summary</h3>

        {selectedTeamNumber ? (
          // Detailed view with Per-match Details in the large left column
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="col-span-2 space-y-4">
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                <h4 className="text-lg font-semibold mb-2">Per-match Details</h4>
                <div className="max-h-72 overflow-auto">
                  <table className="w-full text-xs table-auto">
                    <thead className="text-xs text-gray-500 sticky top-0 bg-white dark:bg-gray-800">
                      <tr>
                        <th className="px-2 py-1">Match</th>
                        <th className="px-2 py-1">Pts</th>
                        <th className="px-2 py-1">Scout</th>
                        <th className="px-2 py-1">Auto L1</th>
                        <th className="px-2 py-1">Auto L2</th>
                        <th className="px-2 py-1">Auto L3</th>
                        <th className="px-2 py-1">Auto L4</th>
                        <th className="px-2 py-1">Auto Algae Barge</th>
                        {/* Auto Algae InNet removed */}
                        <th className="px-2 py-1">Auto Processor</th>
                        <th className="px-2 py-1">Tele L1</th>
                        <th className="px-2 py-1">Tele L2</th>
                        <th className="px-2 py-1">Tele L3</th>
                        <th className="px-2 py-1">Tele L4</th>
                        <th className="px-2 py-1">Tele Algae Barge</th>
                        {/* Tele Algae InNet removed */}
                        <th className="px-2 py-1">Tele Processor</th>
                        <th className="px-2 py-1">Endgame</th>
                        <th className="px-2 py-1">Played Def</th>
                        <th className="px-2 py-1">Def Rating</th>
                        <th className="px-2 py-1">Driver</th>
                        <th className="px-2 py-1">Speed</th>
                        <th className="px-2 py-1">Minor Fouls</th>
                        <th className="px-2 py-1">Major Fouls</th>
                        <th className="px-2 py-1">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedTeamRows.map((r, idx) => (
                        <tr key={idx} className="odd:bg-white even:bg-gray-50 dark:odd:bg-gray-800 dark:even:bg-gray-700 text-xs">
                          <td className="px-2 py-1">{displayMatchLabel(r.matchId)}</td>
                          <td className="px-2 py-1">{computePoints(r)}</td>
                          <td className="px-2 py-1">{r.scoutName || '-'}</td>
                          <td className="px-2 py-1">{r.autoCoralL1 ?? 0}</td>
                          <td className="px-2 py-1">{r.autoCoralL2 ?? 0}</td>
                          <td className="px-2 py-1">{r.autoCoralL3 ?? 0}</td>
                          <td className="px-2 py-1">{r.autoCoralL4 ?? 0}</td>
                          <td className="px-2 py-1">{r.autoAlgaeBarge ?? 0}</td>
                          <td className="px-2 py-1">{r.autoAlgaeBarge ?? 0}</td>
                          <td className="px-2 py-1">{r.autoAlgaeProcessor ?? 0}</td>
                          <td className="px-2 py-1">{r.teleopCoralL1 ?? 0}</td>
                          <td className="px-2 py-1">{r.teleopCoralL2 ?? 0}</td>
                          <td className="px-2 py-1">{r.teleopCoralL3 ?? 0}</td>
                          <td className="px-2 py-1">{r.teleopCoralL4 ?? 0}</td>
                          <td className="px-2 py-1">{r.teleopAlgaeBarge ?? 0}</td>
                          <td className="px-2 py-1">{r.teleopAlgaeBarge ?? 0}</td>
                          <td className="px-2 py-1">{r.teleopAlgaeProcessor ?? 0}</td>
                          <td className="px-2 py-1">{r.endgame ? (r.endgame === 'none' ? 'None' : (r.endgame === 'deep' ? 'Deep Climb' : r.endgame === 'shallow' ? 'Shallow Climb' : r.endgame === 'park' ? 'Park' : r.endgame)) : 'None'}</td>
                          <td className="px-2 py-1">{r.playedDefense ? 'Yes' : 'No'}</td>
                          <td className="px-2 py-1">{r.playedDefense ? (r.defenseRating ?? '-') : '-'}</td>
                          <td className="px-2 py-1">{r.driverSkill ?? '-'}</td>
                          <td className="px-2 py-1">{r.robotSpeed ?? '-'}</td>
                          <td className="px-2 py-1">{r.minorFouls ?? 0}</td>
                          <td className="px-2 py-1">{r.majorFouls ?? 0}</td>
                          <td className="px-2 py-1 max-w-xs truncate">{r.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                <h4 className="text-lg font-semibold mb-2">Averages</h4>
                {/* Metric averages and variability for the selected team */}
                <div className="w-full overflow-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-800 sticky top-0">
                      <tr>
                        <th className="px-2 py-2">Statistics</th>
                        <th className="px-2 py-2 text-right">Mean</th>
                        <th className="px-2 py-2 text-right">Std Dev</th>
                        <th className="px-2 py-2 text-right">#</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metricStats.map((m) => (
                        <tr key={m.key} className="odd:bg-white even:bg-gray-50 dark:odd:bg-gray-800 dark:even:bg-gray-700">
                          <td className="px-2 py-2 font-medium flex items-center gap-2">
                            <span className="w-3 h-3 rounded" style={{ background: m.color }} />
                            {m.label}
                          </td>
                          <td className="px-2 py-2 text-right font-semibold">{m.mean.toFixed(2)}</td>
                          <td className="px-2 py-2 text-right">{m.sd.toFixed(2)}</td>
                          <td className="px-2 py-2 text-right">{m.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                <div className="flex items-start justify-between">
                  <h4 className="text-lg font-semibold mb-2">Trend Explorer</h4>
                  <div className="flex items-center space-x-2">
                    <label className="text-xs">Metric:</label>
                    <select
                      value={selectedMetric}
                      onChange={(e) => setSelectedMetric(e.target.value)}
                      className="text-sm px-2 py-1 rounded border"
                    >
                      {metricOptions.map((m) => (
                        <option key={m.key} value={m.key}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="w-full h-48 bg-gray-50 dark:bg-gray-900 p-2 rounded mt-2 overflow-hidden">
                  <svg width="100%" height="100%" viewBox="0 0 120 60" preserveAspectRatio="none">
                    {(() => {
                      const key = selectedMetric || 'driverSkill';
                      const series = metricSeriesMap[key] || [];
                      const count = Math.max(1, series.length);
                      const leftPadding = 12; // leave space for Y axis labels
                      const width = 100;
                      const height = 48;
                      const stepX = count > 1 ? width / (count - 1) : 0;
                      const values = series.map((s) => s.value);
                      const max = Math.max(...values, 1);
                      const min = Math.min(...values, 0);
                      // build path
                      let path = '';
                      series.forEach((pt, idx) => {
                        const x = leftPadding + (idx * stepX);
                        const y = height - ((pt.value - min) / Math.max(1, (max - min))) * (height - 6) - 2;
                        path += (idx === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`);
                      });

                      // Y axis ticks (3 ticks: min, mid, max)
                      const ticks = [min, min + (max - min) / 2, max];

                      const color = metricOptions.find((m) => m.key === key)?.color || '#fff';

                      return (
                        <g>
                          {/* axis labels */}
                          {ticks.map((t, i) => {
                            const y = height - ((t - min) / Math.max(1, (max - min))) * (height - 6) - 2;
                            return (
                              <g key={`tick-${i}`}>
                                <text x={2} y={y + 3} fontSize={6} fill="#9CA3AF">{Math.round(t)}</text>
                                <line x1={leftPadding} x2={leftPadding + width} y1={y} y2={y} stroke="#e5e7eb" strokeWidth={0.3} />
                              </g>
                            );
                          })}

                          {/* metric path */}
                          <path d={path} stroke={color} strokeWidth={1.6} fill="none" opacity={0.95} />

                          {/* points (smaller dots) */}
                          {series.map((pt, idx) => {
                            const x = leftPadding + (idx * stepX);
                            const y = height - ((pt.value - min) / Math.max(1, (max - min))) * (height - 6) - 2;
                            return <circle key={idx} cx={x} cy={y} r={1.6} fill={color} />;
                          })}
                        </g>
                      );
                    })()}
                  </svg>
                </div>
                <div className="mt-2 text-xs">
                  <strong>Legend:</strong>
                  <span className="ml-2 inline-flex items-center">
                    <span className="w-3 h-3 mr-1" style={{ background: metricOptions.find((m) => m.key === selectedMetric)?.color }} />
                    {metricOptions.find((m) => m.key === selectedMetric)?.label}
                  </span>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                <h4 className="text-xl font-semibold">Team {selectedTeamNumber} — Summary</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                  {teamStats.filter((t) => t.teamNumber === selectedTeamNumber).map((s) => (
                    <div key={s.teamNumber} className="p-3 border rounded bg-gray-50 dark:bg-gray-700">
                      <div className="text-sm text-gray-500">Matches</div>
                      <div className="text-2xl font-bold">{s.matchCount}</div>
                      <div className="text-xs text-gray-400">Avg Pts: {s.avgPoints.toFixed(1)}</div>
                    </div>
                  ))}
                  {teamStats.filter((t) => t.teamNumber === selectedTeamNumber).map((s) => (
                    <div key={`more-${s.teamNumber}`} className="p-3 border rounded bg-gray-50 dark:bg-gray-700">
                      <div className="text-sm text-gray-500">Deep Climb %</div>
                      <div className="text-2xl font-bold">{s.deepClimbRate.toFixed(0)}%</div>
                      <div className="text-xs text-gray-400">Shallow: {s.shallowClimbRate.toFixed(0)}%</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {teamStats.filter((t) => t.teamNumber === selectedTeamNumber).map((s) => (
                    <div key={`fouls-${s.teamNumber}`} className="p-3 border rounded bg-gray-50 dark:bg-gray-700">
                      <div className="text-sm text-gray-500">Avg Minor Fouls</div>
                      <div className="text-lg font-semibold">{(s.avgMinorFouls || 0).toFixed(2)}</div>
                      <div className="text-sm text-gray-400">Avg Major: {(s.avgMajorFouls || 0).toFixed(2)}</div>
                    </div>
                  ))}
                  {teamStats.filter((t) => t.teamNumber === selectedTeamNumber).map((s) => (
                    <div key={`def-${s.teamNumber}`} className="p-3 border rounded bg-gray-50 dark:bg-gray-700">
                      <div className="text-sm text-gray-500">Defense Rating</div>
                      <div className="text-lg font-semibold">{s.avgDefenseRating.toFixed(1)}</div>
                      <div className="text-sm text-gray-400">Driver: {s.avgDriverSkill.toFixed(1)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : teamStats.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100 dark:bg-gray-700">
                <tr>
                  <th className="px-3 py-3 text-gray-700 dark:text-gray-300 font-semibold cursor-pointer select-none" onClick={() => toggleSort('teamNumber')}>
                    Team {sortKey === 'teamNumber' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th className="px-3 py-3 text-gray-700 dark:text-gray-300 font-semibold cursor-pointer select-none" onClick={() => toggleSort('avgPoints')}>
                    Avg Pts {sortKey === 'avgPoints' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th className="px-3 py-3 text-gray-700 dark:text-gray-300 font-semibold cursor-pointer select-none" onClick={() => toggleSort('avgAutoCoralL4')}>
                    Auto L4 {sortKey === 'avgAutoCoralL4' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th className="px-3 py-3 text-gray-700 dark:text-gray-300 font-semibold cursor-pointer select-none" onClick={() => toggleSort('avgTeleopCoralL4')}>
                    Teleop L4 {sortKey === 'avgTeleopCoralL4' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th className="px-3 py-3 text-gray-700 dark:text-gray-300 font-semibold cursor-pointer select-none" onClick={() => toggleSort('avgTeleopCoralL3')}>
                    Teleop L3 {sortKey === 'avgTeleopCoralL3' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th className="px-3 py-3 text-gray-700 dark:text-gray-300 font-semibold cursor-pointer select-none" onClick={() => toggleSort('totalCoral')}>
                    Total Coral {sortKey === 'totalCoral' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th className="px-3 py-3 text-gray-700 dark:text-gray-300 font-semibold cursor-pointer select-none" onClick={() => toggleSort('avgAlgaeBarge')}>
                    Algae {sortKey === 'avgAlgaeBarge' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th className="px-3 py-3 text-gray-700 dark:text-gray-300 font-semibold cursor-pointer select-none" onClick={() => toggleSort('deepClimbRate')}>
                    Deep % {sortKey === 'deepClimbRate' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th className="px-3 py-3 text-gray-700 dark:text-gray-300 font-semibold cursor-pointer select-none" onClick={() => toggleSort('avgDriverSkill')}>
                    Driver {sortKey === 'avgDriverSkill' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th className="px-3 py-3 text-gray-700 dark:text-gray-300 font-semibold cursor-pointer select-none" onClick={() => toggleSort('avgDefenseRating')}>
                    Defense {sortKey === 'avgDefenseRating' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {sortedTeamStats.map((stats) => (
                  <tr key={stats.teamNumber} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-3 py-3 font-bold text-red-600 dark:text-red-400">{stats.teamNumber}</td>
                    <td className="px-3 py-3 text-gray-800 dark:text-gray-200 font-semibold">{stats.avgPoints.toFixed(1)}</td>
                    <td className="px-3 py-3 text-gray-800 dark:text-gray-200">{stats.avgAutoCoralL4.toFixed(1)}</td>
                    <td className="px-3 py-3 text-gray-800 dark:text-gray-200">{stats.avgTeleopCoralL4.toFixed(1)}</td>
                    <td className="px-3 py-3 text-gray-800 dark:text-gray-200">{stats.avgTeleopCoralL3.toFixed(1)}</td>
                    <td className="px-3 py-3 text-gray-800 dark:text-gray-200">{stats.totalCoral}</td>
                    <td className="px-3 py-3 text-gray-800 dark:text-gray-200">{stats.avgAlgaeBarge.toFixed(1)}</td>
                    <td className="px-3 py-3 text-gray-800 dark:text-gray-200">{stats.deepClimbRate.toFixed(0)}%</td>
                    <td className="px-3 py-3 text-gray-800 dark:text-gray-200">{stats.avgDriverSkill.toFixed(1)}</td>
                    <td className="px-3 py-3 text-gray-800 dark:text-gray-200">{stats.avgDefenseRating.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">
            No scouting data available. Start scouting matches to see team statistics here.
          </p>
        )}
      </div>
    </div>
  );
}
