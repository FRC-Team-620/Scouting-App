'use client';

import { useState, useMemo, useEffect } from 'react';
import { firestoreDB, ScoutingData, Competition, Team } from '@/lib/db';
import { Download, Filter, TrendingUp, Award } from 'lucide-react';

export default function DataReview() {
  const [selectedCompetition, setSelectedCompetition] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'season' | 'competition'>('competition');

  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [allScoutingData, setAllScoutingData] = useState<ScoutingData[]>([]);

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

  const filteredData = useMemo(() => {
    if (!allScoutingData) return [];
    
    let data = [...allScoutingData];
    
    // Filter by view mode
    if (viewMode === 'competition' && selectedCompetition) {
      data = data.filter((d) => d.competitionId === selectedCompetition);
    }
    // If season mode, show all data (no competition filter)
    
    if (selectedTeam) {
      data = data.filter((d) => d.teamNumber === selectedTeam);
    }
    
    return data;
  }, [allScoutingData, selectedCompetition, selectedTeam, viewMode]);

  const teamStats = useMemo(() => {
    if (!filteredData.length) return [];

    const statsMap = new Map<number, {
      teamNumber: number;
      matchCount: number;
      avgAutoCoralL4: number;
      avgTeleopCoralL4: number;
      avgTeleopCoralL3: number;
      avgTeleopCoralL2: number;
      avgAlgaeBarge: number;
      avgAlgaeProcessor: number;
      deepClimbCount: number;
      shallowClimbCount: number;
      avgDriverSkill: number;
      avgDefenseRating: number;
      matchCountWithDefense: number;
      avgRobotSpeed: number;
      totalCoralL4: number;
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
        avgAlgaeBarge: 0,
        avgAlgaeProcessor: 0,
        deepClimbCount: 0,
        shallowClimbCount: 0,
        avgDriverSkill: 0,
        avgDefenseRating: 0,
        matchCountWithDefense: 0,
        avgRobotSpeed: 0,
        totalCoralL4: 0,
        totalPoints: 0,
      };

      existing.matchCount++;
      existing.avgAutoCoralL4 += data.autoCoralL4;
      existing.avgTeleopCoralL4 += data.teleopCoralL4;
      existing.avgTeleopCoralL3 += data.teleopCoralL3;
      existing.avgTeleopCoralL2 += data.teleopCoralL2;
      existing.avgAlgaeBarge += data.autoAlgaeBarge + data.teleopAlgaeBarge;
      existing.avgAlgaeProcessor += data.autoAlgaeProcessor + data.teleopAlgaeProcessor;
      existing.deepClimbCount += data.deepClimb ? 1 : 0;
      existing.shallowClimbCount += data.shallowClimb ? 1 : 0;
      existing.avgDriverSkill += data.driverSkill;
      // defenseRating may be optional; only include when playedDefense is true
      if (data.playedDefense && typeof data.defenseRating === 'number') {
        existing.avgDefenseRating += data.defenseRating;
        existing.matchCountWithDefense += 1;
      }
      existing.avgRobotSpeed += data.robotSpeed;
      existing.totalCoralL4 += data.autoCoralL4 + data.teleopCoralL4;
      // Rough point calculation (simplified)
      existing.totalPoints += (data.autoCoralL4 * 6) + (data.teleopCoralL4 * 4) + (data.deepClimb ? 12 : 0);

      statsMap.set(data.teamNumber, existing);
    });

    return Array.from(statsMap.values()).map((stats) => ({
      ...stats,
      avgAutoCoralL4: stats.avgAutoCoralL4 / stats.matchCount,
      avgTeleopCoralL4: stats.avgTeleopCoralL4 / stats.matchCount,
      avgTeleopCoralL3: stats.avgTeleopCoralL3 / stats.matchCount,
      avgTeleopCoralL2: stats.avgTeleopCoralL2 / stats.matchCount,
      avgAlgaeBarge: stats.avgAlgaeBarge / stats.matchCount,
      avgAlgaeProcessor: stats.avgAlgaeProcessor / stats.matchCount,
    avgDriverSkill: stats.avgDriverSkill / stats.matchCount,
    // Compute avgDefenseRating only from matches where defense was played
    avgDefenseRating: stats.matchCountWithDefense ? (stats.avgDefenseRating / stats.matchCountWithDefense) : 0,
      avgRobotSpeed: stats.avgRobotSpeed / stats.matchCount,
      deepClimbRate: (stats.deepClimbCount / stats.matchCount) * 100,
      shallowClimbRate: (stats.shallowClimbCount / stats.matchCount) * 100,
      avgPoints: stats.totalPoints / stats.matchCount,
    })).sort((a, b) => b.avgPoints - a.avgPoints);
  }, [filteredData]);

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
      'Deep Climb', 'Shallow Climb', 'Park',
      'Played Defense?', 'Defense Rating', 'Driver Skill', 'Robot Speed', 'Notes'
    ];

    const rows = filteredData.map((data) => [
      data.competitionId, data.matchId, data.teamNumber, data.scoutName,
      data.autoCoralL1, data.autoCoralL2, data.autoCoralL3, data.autoCoralL4,
      data.autoAlgaeBarge, data.autoAlgaeProcessor, data.autoLeaveZone,
      data.teleopCoralL1, data.teleopCoralL2, data.teleopCoralL3, data.teleopCoralL4,
      data.teleopAlgaeBarge, data.teleopAlgaeProcessor,
      data.deepClimb, data.shallowClimb, data.park,
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

  return (
    <div className="space-y-6">
      {/* Header and Filters */}
      <div className="site-card">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Data Review & Analysis</h2>
          <button onClick={exportToCSV} className="btn-primary flex items-center space-x-2">
            <Download size={20} />
            <span>Export CSV</span>
          </button>
        </div>

        {/* View Mode Toggle */}
        <div className="mt-6 flex items-center justify-center space-x-4 p-2 rounded-lg bg-transparent">
          <button
            onClick={() => setViewMode('competition')}
            className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
              viewMode === 'competition' ? 'btn-primary' : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-500'
            }`}
          >
            Competition View
          </button>
          <button
            onClick={() => setViewMode('season')}
            className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
              viewMode === 'season' ? 'btn-primary' : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-500'
            }`}
          >
            Season-Wide View
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Filter size={16} className="inline mr-1" />
              Filter by Competition
            </label>
            <select
              value={selectedCompetition || ''}
              onChange={(e) => setSelectedCompetition(e.target.value || null)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              disabled={viewMode === 'season'}
            >
              <option value="">All Competitions</option>
              {competitions?.map((comp) => (
                <option key={comp.id} value={comp.id}>
                  {comp.name}
                </option>
              ))}
            </select>
            {viewMode === 'season' && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Competition filter disabled in Season-Wide view
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Filter size={16} className="inline mr-1" />
              Filter by Team
            </label>
            <select
              value={selectedTeam || ''}
              onChange={(e) => setSelectedTeam(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="">All Teams</option>
              {teams?.map((team) => (
                <option key={team.id} value={team.teamNumber}>
                  {team.teamNumber} - {team.teamName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Statistics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-red-600 to-red-800 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm">Total Matches Scouted</p>
              <p className="text-4xl font-bold mt-2">{filteredData.length}</p>
            </div>
            <TrendingUp size={48} className="opacity-50" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-red-800 to-red-700 rounded-lg shadow-lg p-6 text-white teams-analyzed-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">Teams Analyzed</p>
              <p className="text-4xl font-bold mt-2">{teamStats.length}</p>
            </div>
            <Award size={48} className="opacity-50" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-red-600 to-red-800 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm">Avg Coral L4/Match</p>
              <p className="text-4xl font-bold mt-2">
                {filteredData.length > 0
                  ? (filteredData.reduce((sum, d) => sum + d.autoCoralL4 + d.teleopCoralL4, 0) / filteredData.length).toFixed(1)
                  : '0'}
              </p>
            </div>
            <TrendingUp size={48} className="opacity-50" />
          </div>
        </div>
      </div>

      {/* Team Statistics Table */}
        <div className="site-card">
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Team Performance Summary {viewMode === 'season' && <span className="text-red-600">(Season-Wide)</span>}
        </h3>
        
        {teamStats.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100 dark:bg-gray-700">
                <tr>
                  <th className="px-3 py-3 text-gray-700 dark:text-gray-300 font-semibold">Team</th>
                  <th className="px-3 py-3 text-gray-700 dark:text-gray-300 font-semibold">Matches</th>
                  <th className="px-3 py-3 text-gray-700 dark:text-gray-300 font-semibold">Avg Pts</th>
                  <th className="px-3 py-3 text-gray-700 dark:text-gray-300 font-semibold">Auto L4</th>
                  <th className="px-3 py-3 text-gray-700 dark:text-gray-300 font-semibold">Teleop L4</th>
                  <th className="px-3 py-3 text-gray-700 dark:text-gray-300 font-semibold">Teleop L3</th>
                  <th className="px-3 py-3 text-gray-700 dark:text-gray-300 font-semibold">Algae</th>
                  <th className="px-3 py-3 text-gray-700 dark:text-gray-300 font-semibold">Deep %</th>
                  <th className="px-3 py-3 text-gray-700 dark:text-gray-300 font-semibold">Driver</th>
                  <th className="px-3 py-3 text-gray-700 dark:text-gray-300 font-semibold">Defense</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {teamStats.map((stats) => (
                  <tr key={stats.teamNumber} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-3 py-3 font-bold text-red-600 dark:text-red-400">{stats.teamNumber}</td>
                    <td className="px-3 py-3 text-gray-800 dark:text-gray-200">{stats.matchCount}</td>
                    <td className="px-3 py-3 text-gray-800 dark:text-gray-200 font-semibold">{stats.avgPoints.toFixed(1)}</td>
                    <td className="px-3 py-3 text-gray-800 dark:text-gray-200">{stats.avgAutoCoralL4.toFixed(1)}</td>
                    <td className="px-3 py-3 text-gray-800 dark:text-gray-200">{stats.avgTeleopCoralL4.toFixed(1)}</td>
                    <td className="px-3 py-3 text-gray-800 dark:text-gray-200">{stats.avgTeleopCoralL3.toFixed(1)}</td>
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

      {/* Raw Data Table */}
  <div className="site-card">
  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Raw Scouting Data</h3>
        
        {filteredData.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100 dark:bg-gray-700">
                <tr>
                  <th className="px-3 py-2 text-gray-700 dark:text-gray-300 font-semibold">Team</th>
                  <th className="px-3 py-2 text-gray-700 dark:text-gray-300 font-semibold">Match</th>
                  <th className="px-3 py-2 text-gray-700 dark:text-gray-300 font-semibold">Scout</th>
                  <th className="px-3 py-2 text-gray-700 dark:text-gray-300 font-semibold">Auto L4</th>
                  <th className="px-3 py-2 text-gray-700 dark:text-gray-300 font-semibold">Teleop L4</th>
                  <th className="px-3 py-2 text-gray-700 dark:text-gray-300 font-semibold">Algae</th>
                  <th className="px-3 py-2 text-gray-700 dark:text-gray-300 font-semibold">Deep Climb</th>
                  <th className="px-3 py-2 text-gray-700 dark:text-gray-300 font-semibold">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredData.map((data) => (
                  <tr key={data.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-3 py-2 font-bold text-red-600 dark:text-red-400">{data.teamNumber}</td>
                    <td className="px-3 py-2 text-gray-800 dark:text-gray-200">{data.matchId}</td>
                    <td className="px-3 py-2 text-gray-800 dark:text-gray-200">{data.scoutName}</td>
                    <td className="px-3 py-2 text-gray-800 dark:text-gray-200">{data.autoCoralL4}</td>
                    <td className="px-3 py-2 text-gray-800 dark:text-gray-200">{data.teleopCoralL4}</td>
                    <td className="px-3 py-2 text-gray-800 dark:text-gray-200">
                      {data.autoAlgaeBarge + data.teleopAlgaeBarge}
                    </td>
                    <td className="px-3 py-2 text-gray-800 dark:text-gray-200">
                      {data.deepClimb ? '✓' : '✗'}
                    </td>
                    <td className="px-3 py-2 text-gray-800 dark:text-gray-200 max-w-xs truncate">
                      {data.notes || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">
            No data matches your current filters.
          </p>
        )}
      </div>
    </div>
  );
}
