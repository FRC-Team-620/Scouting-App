import { 
  collection, 
  addDoc, 
  setDoc,
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  query, 
  where,
  orderBy,
  onSnapshot,
  Timestamp 
} from 'firebase/firestore';
import { db } from './firebase';

// Data type definitions
export interface Competition {
  id?: string;
  name: string;
  eventKey: string;
  startDate: string;
  endDate: string;
  createdAt: number;
}

export interface Team {
  id?: string;
  teamNumber: number;
  teamName: string;
  createdAt: number;
}

export interface Match {
  id?: string;
  competitionId: string;
  matchNumber: string;
  matchType: 'qualification' | 'playoff' | 'practice';
  teams?: number[]; // team numbers participating in the match, if known
  createdAt: number;
}

export interface ScoutingData {
  id?: string;
  competitionId: string;
  matchId: string;
  teamNumber: number;
  scoutName: string;
  
  // Auto Period
  autoCoralL1: number;
  autoCoralL2: number;
  autoCoralL3: number;
  autoCoralL4: number;
  autoAlgaeBarge: number;
  autoAlgaeProcessor: number;
  autoLeaveZone: boolean;
  
  // Teleop Period
  teleopCoralL1: number;
  teleopCoralL2: number;
  teleopCoralL3: number;
  teleopCoralL4: number;
  teleopAlgaeBarge: number;
  teleopAlgaeProcessor: number;
  
  // Endgame (exclusive): one of 'deep', 'shallow', 'park', or 'none'
  endgame?: 'deep' | 'shallow' | 'park' | 'none';
  
  // Additional Notes
  playedDefense: boolean; // whether the robot played defense in this match
  defenseRating?: number; // 1-5 (optional; only present when playedDefense === true)
  driverSkill: number; // 1-5
  robotSpeed: number; // 1-5
  minorFouls?: number;
  majorFouls?: number;
  notes: string;
  
  createdAt: number;
}

// Collection names
const COLLECTIONS = {
  competitions: 'competitions',
  teams: 'teams',
  matches: 'matches',
  scoutingData: 'scoutingData'
};

// Helper functions for Firestore operations
export const firestoreDB = {
  // Competitions
  async addCompetition(data: Omit<Competition, 'id'>) {
    const docRef = await addDoc(collection(db, COLLECTIONS.competitions), data);
    return docRef.id;
  },
  
  async deleteCompetition(id: string) {
    await deleteDoc(doc(db, COLLECTIONS.competitions, id));
  },

  async updateCompetition(id: string, data: Partial<Competition>) {
    const ref = doc(db, COLLECTIONS.competitions, id);
    await updateDoc(ref, data as any);
  },
  
  subscribeToCompetitions(callback: (competitions: Competition[]) => void) {
    return onSnapshot(collection(db, COLLECTIONS.competitions), (snapshot) => {
      const competitions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Competition[];
      callback(competitions);
    });
  },
  
  // Teams
  async addTeam(data: Omit<Team, 'id'>) {
    // If a team document already exists for this teamNumber, update that doc.
    const q = query(collection(db, COLLECTIONS.teams), where('teamNumber', '==', data.teamNumber));
    const existing = await getDocs(q);
    if (!existing.empty) {
      // Update the first matching document (merge fields)
      const existingDoc = existing.docs[0];
      const ref = doc(db, COLLECTIONS.teams, existingDoc.id);
      await updateDoc(ref, data as any);
      return existingDoc.id;
    }

    // No existing document: create a deterministic id (team number) to prevent future duplicates
    const id = String(data.teamNumber);
    const ref = doc(db, COLLECTIONS.teams, id);
    await setDoc(ref, data, { merge: true });
    return id;
  },
  
  async deleteTeam(id: string) {
    await deleteDoc(doc(db, COLLECTIONS.teams, id));
  },
  
  subscribeToTeams(callback: (teams: Team[]) => void) {
    // Order teams by numeric teamNumber for predictable display
    const q = query(collection(db, COLLECTIONS.teams), orderBy('teamNumber'));
    return onSnapshot(q, (snapshot) => {
      const teams = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Team[];
      // Defensive: ensure numeric sort by teamNumber
      teams.sort((a, b) => (Number(a.teamNumber) || 0) - (Number(b.teamNumber) || 0));
      callback(teams);
    });
  },
  
  // Matches
  async addMatch(data: Omit<Match, 'id'>) {
    // Prevent duplicate matches for the same competition and matchNumber.
    // If an existing match exists, merge fields (including teams) into it.
    const q = query(
      collection(db, COLLECTIONS.matches),
      where('competitionId', '==', data.competitionId),
      where('matchNumber', '==', data.matchNumber)
    );
    const existing = await getDocs(q);
    if (!existing.empty) {
      const existingDoc = existing.docs[0];
      const ref = doc(db, COLLECTIONS.matches, existingDoc.id);
      // Merge provided data into existing doc
      await setDoc(ref, data, { merge: true });
      return existingDoc.id;
    }

    // No existing match: create a new document (random id)
    const docRef = await addDoc(collection(db, COLLECTIONS.matches), data);
    return docRef.id;
  },
  
  async deleteMatch(id: string) {
    await deleteDoc(doc(db, COLLECTIONS.matches, id));
  },
  
  subscribeToMatches(callback: (matches: Match[]) => void) {
    // Return matches sorted by competitionId, then by matchType (qualification first), then by matchNumber
    return onSnapshot(collection(db, COLLECTIONS.matches), (snapshot) => {
      const matches = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Match[];

      matches.sort((a, b) => {
        // First by competitionId
        if (a.competitionId < b.competitionId) return -1;
        if (a.competitionId > b.competitionId) return 1;

        // Then by matchType: qualification, playoff, practice
        const order = (type: string) => {
          if (type === 'qualification') return 0;
          if (type === 'playoff') return 1;
          return 2; // practice or others
        };

        const oa = order(a.matchType);
        const ob = order(b.matchType);
        if (oa !== ob) return oa - ob;

        // If both are playoff matches, try to order by playoff stage so finals appear last
        const playoffStageRank = (s: string) => {
          if (!s) return 0;
          const up = s.toUpperCase();
          // Finals start with F (e.g., F1-1)
          if (/^F\b|^F\d|\bFINAL/i.test(up)) return 3;
          // Semifinals often start with SF
          if (/^SF/i.test(up)) return 2;
          // Quarterfinals often start with QF or Q
          if (/^QF/i.test(up)) return 1;
          // Default playoff-level (unknown) keep before finals
          return 0;
        };

        if (oa === 1 && ob === 1) {
          const ra = playoffStageRank(a.matchNumber);
          const rb = playoffStageRank(b.matchNumber);
          if (ra !== rb) return ra - rb;
        }

        // Finally by matchNumber: try to extract numeric part for sensible ordering
        const extractNumber = (s: string) => {
          if (!s) return Number.MAX_SAFE_INTEGER;
          const m = s.match(/(\d+)/);
          return m ? parseInt(m[0], 10) : Number.MAX_SAFE_INTEGER;
        };

        const na = extractNumber(a.matchNumber);
        const nb = extractNumber(b.matchNumber);
        if (na !== nb) return na - nb;

        // Fallback to string compare
        if (a.matchNumber < b.matchNumber) return -1;
        if (a.matchNumber > b.matchNumber) return 1;
        return 0;
      });

      callback(matches);
    });
  },
  
  subscribeToMatchesByCompetition(competitionId: string, callback: (matches: Match[]) => void) {
    const q = query(
      collection(db, COLLECTIONS.matches),
      where('competitionId', '==', competitionId)
    );
    return onSnapshot(q, (snapshot) => {
      const matches = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Match[];

      // Sort matches so qualification matches appear first, then playoffs, then practice
      matches.sort((a, b) => {
        const order = (type: string) => {
          if (type === 'qualification') return 0;
          if (type === 'playoff') return 1;
          return 2;
        };

        const oa = order(a.matchType);
        const ob = order(b.matchType);
        if (oa !== ob) return oa - ob;

        const extractNumber = (s: string) => {
          if (!s) return Number.MAX_SAFE_INTEGER;
          const m = s.match(/(\d+)/);
          return m ? parseInt(m[0], 10) : Number.MAX_SAFE_INTEGER;
        };

        const na = extractNumber(a.matchNumber);
        const nb = extractNumber(b.matchNumber);
        if (na !== nb) return na - nb;

        if (a.matchNumber < b.matchNumber) return -1;
        if (a.matchNumber > b.matchNumber) return 1;
        return 0;
      });

      callback(matches);
    });
  },
  
  // Scouting Data
  async addScoutingData(data: Omit<ScoutingData, 'id'>) {
    // Normalize matchId: if the provided matchId appears to be a human match number or contains
    // a suffix like '<docId>-Qualification 9', attempt to resolve the canonical match document id
    // for the same competition and use that as the stored matchId.
    try {
      let candidate = String(data.matchId || '').trim();
      // If the value contains a hyphen and looks like 'docid-Qualification 9', take the suffix
      if (candidate.includes('-')) {
        const suffix = candidate.split('-').pop();
        if (suffix) candidate = suffix.trim();
      }

      if (candidate) {
        // Query matches for the competition with matchNumber equal to candidate
        const q = query(
          collection(db, COLLECTIONS.matches),
          where('competitionId', '==', data.competitionId),
          where('matchNumber', '==', candidate)
        );
        const found = await getDocs(q);
        if (!found.empty) {
          // Use the first matching document id as canonical
          const matchDoc = found.docs[0];
          data.matchId = matchDoc.id;
        }
      }
    } catch (err) {
      // If normalization fails for any reason, fall back to storing whatever was provided
      console.warn('Failed to normalize matchId for scouting data:', err);
    }

    const docRef = await addDoc(collection(db, COLLECTIONS.scoutingData), data);
    return docRef.id;
  },
  
  async deleteScoutingData(id: string) {
    await deleteDoc(doc(db, COLLECTIONS.scoutingData, id));
  },
  
  async updateScoutingData(id: string, data: Partial<ScoutingData>) {
    const ref = doc(db, COLLECTIONS.scoutingData, id);
    await updateDoc(ref, data as any);
  },
  
  subscribeToScoutingData(callback: (data: ScoutingData[]) => void) {
    return onSnapshot(collection(db, COLLECTIONS.scoutingData), (snapshot) => {
      const scoutingData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ScoutingData[];
      callback(scoutingData);
    });
  },
  
  subscribeToScoutingDataByCompetition(competitionId: string, callback: (data: ScoutingData[]) => void) {
    const q = query(
      collection(db, COLLECTIONS.scoutingData),
      where('competitionId', '==', competitionId)
    );
    return onSnapshot(q, (snapshot) => {
      const scoutingData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ScoutingData[];
      callback(scoutingData);
    });
  }
};
