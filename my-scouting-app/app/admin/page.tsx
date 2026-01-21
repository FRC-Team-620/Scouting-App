'use client';

import { useState } from 'react';

export default function AdminPage(){
    const [eventKey, setEventKey] = useState('');
    const [loading, setLoading] = useState(false);

    const handleImport = async () => {
        setLoading(true);

        const response = await fetch(`/api/import-tba?event=${eventKey}`);
        const result = await response.json();

        setLoading(false);

        if(result.success){
            alert(`Successfully imported teams and matches for ${eventKey}!`);
        }else{
            alert(`Error: ${result.error}`);
        }
    };

    return(<div className="p-10 flex flex-col gap-4 max-w-md mx-auto">
      <h1 className="text-3xl font-bold">Admin Panel</h1>
      <p className="text-gray-400">Enter a TBA Event Key (e.g., 2025txhou)</p>
      
      <input 
        type="text"
        placeholder="2026txhou"
        className="p-3 border rounded text-white"
        value={eventKey} // Link this input to our 'eventKey' state
        onChange={(e) => setEventKey(e.target.value)} // Update state as you type
      />

    
      <button 
        onClick={handleImport} // Run handleImport when clicked
        disabled={loading} // Prevent double-clicking while loading
        className="bg-blue-600 hover:bg-blue-700 p-4 rounded font-bold transition"
      >
        {loading ? 'Importing Data...' : 'Import Event Data'}
      </button>

      {/* A small help note */}
      <p className="text-xs text-gray-500 italic">
        Note: You can find event keys on the URL of any event on TheBlueAlliance.com
      </p>
    </div>
  );
}