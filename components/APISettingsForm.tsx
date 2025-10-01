 'use client';

import { useState } from 'react';
import { firestoreDB } from '@/lib/db';
import { Download } from 'lucide-react';

interface APISettingsFormProps {
  onClose: () => void;
}

export default function APISettingsForm({ onClose }: APISettingsFormProps) {
  const [eventCode, setEventCode] = useState('');
  const [competitionId, setCompetitionId] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  // Import teams via our server endpoint (/api/frc/teams)
  const importTeams = async () => {
    if (!eventCode) {
      alert('Please enter an event code');
      return;
    }

    setIsImporting(true);
    try {
      const res = await fetch(`/api/frc/teams?eventCode=${encodeURIComponent(eventCode.toUpperCase())}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(err.message || 'Failed to fetch teams');
      }

      const body = await res.json();
      const teams = body.teams || [];

      for (const team of teams) {
        await firestoreDB.addTeam({
          teamNumber: team.teamNumber,
          teamName: team.nameShort || team.nameFull,
          createdAt: Date.now(),
        });
      }

      alert(`Successfully imported ${teams.length} teams!`);
      onClose();
    } catch (error: any) {
      console.error('Error importing teams:', error);
      alert(`Failed to import teams: ${error?.message || error}`);
    } finally {
      setIsImporting(false);
    }
  };

  // Import matches via our server endpoint (/api/frc/matches)
  const importMatches = async () => {
    if (!eventCode || !competitionId) {
      alert('Please enter event code and select a competition');
      return;
    }

    setIsImporting(true);
    try {
      const res = await fetch(`/api/frc/matches?eventCode=${encodeURIComponent(eventCode.toUpperCase())}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(err.message || 'Failed to fetch matches');
      }

      const matches = await res.json();

      // matches endpoint returns an array — include participating teams when provided
      for (const match of matches) {
        const matchType = match.tournamentLevel === 'Qualification' ? 'qualification' : 'playoff';
        const teams = (match.teams || []).map((t: any) => Number(t.teamNumber));
        await firestoreDB.addMatch({
          competitionId: competitionId,
          matchNumber: match.description,
          matchType: matchType,
          teams: teams.length ? teams : undefined,
          createdAt: Date.now(),
        });
      }

      alert(`Successfully imported ${matches.length} matches!`);
      onClose();
    } catch (error: any) {
      console.error('Error importing matches:', error);
      alert(`Failed to import matches: ${error?.message || error}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="site-card mt-4 space-y-6">
      <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-4">FRC Events Import</h4>

      <div className="site-card p-4">
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
          Note: The FRC Events API key must be set on the server as <code>FRC_API_KEY</code>. This is required and cannot be changed from the UI for security.
        </p>
      </div>

      {/* Import Teams Section */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
        <h5 className="font-semibold text-gray-800 dark:text-white mb-3">Import Teams from Event</h5>
        <input
          type="text"
          value={eventCode}
          onChange={(e) => setEventCode(e.target.value.toLowerCase())}
          placeholder="Event Code (e.g., casd, txda)"
          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white mb-3"
        />
        <button
          onClick={importTeams}
          disabled={isImporting}
          className="btn-primary w-full flex items-center justify-center space-x-2 disabled:bg-gray-400"
        >
          <Download size={20} />
          <span>{isImporting ? 'Importing...' : 'Import All Teams'}</span>
        </button>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Example codes: casd (San Diego), txda (Dallas), nytr (Troy)
        </p>
      </div>

      {/* Import Matches Section */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
        <h5 className="font-semibold text-gray-800 dark:text-white mb-3">Import Match Schedule</h5>
        <input
          type="text"
          value={competitionId}
          onChange={(e) => setCompetitionId(e.target.value)}
          placeholder="Competition ID (from your competitions list)"
          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white mb-3"
        />
        <button
          onClick={importMatches}
          disabled={isImporting}
          className="btn-primary w-full flex items-center justify-center space-x-2 disabled:bg-gray-400"
        >
          <Download size={20} />
          <span>{isImporting ? 'Importing...' : 'Import Match Schedule'}</span>
        </button>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Imports all qualification and playoff matches from the event
        </p>
      </div>

      <button
        onClick={onClose}
        className="w-full bg-black hover:bg-gray-900 text-white px-4 py-2 rounded-lg"
      >
        Close
      </button>
    </div>
  );
}
