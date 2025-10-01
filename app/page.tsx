'use client';

import { useState } from 'react';
import { Home, ClipboardList, BarChart3 } from 'lucide-react';
import ScoutingForm from '@/components/ScoutingForm';
import DataReview from '@/components/DataReview';
import SetupPage from '@/components/SetupPage';

export default function HomePage() {
  const [currentPage, setCurrentPage] = useState<'home' | 'scout' | 'review'>('home');

  return (
  <div className="min-h-screen bg-black text-white">
      {/* Header */}
  <header className="bg-black text-white shadow-md">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-red-700 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">620</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">
                    FRC Scouting App
                  </h1>
                  <p className="text-sm text-red-300">REEFSCAPE 2025</p>
              </div>
            </div>
            
            {/* Navigation */}
            <nav className="flex space-x-2">
              <button
                onClick={() => setCurrentPage('home')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  currentPage === 'home'
                    ? 'bg-red-700 text-white'
                    : 'bg-gray-800 text-gray-200 hover:bg-gray-700'
                }`}
              >
                <Home size={20} />
                <span className="hidden sm:inline">Setup</span>
              </button>
              <button
                onClick={() => setCurrentPage('scout')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  currentPage === 'scout'
                    ? 'bg-red-700 text-white'
                    : 'bg-gray-800 text-gray-200 hover:bg-gray-700'
                }`}
              >
                <ClipboardList size={20} />
                <span className="hidden sm:inline">Scout</span>
              </button>
              <button
                onClick={() => setCurrentPage('review')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  currentPage === 'review'
                    ? 'bg-red-700 text-white'
                    : 'bg-gray-800 text-gray-200 hover:bg-gray-700'
                }`}
              >
                <BarChart3 size={20} />
                <span className="hidden sm:inline">Review</span>
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {currentPage === 'home' && <SetupPage />}
        {currentPage === 'scout' && <ScoutingForm />}
        {currentPage === 'review' && <DataReview />}
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-800 shadow-md mt-12">
        <div className="container mx-auto px-4 py-4 text-center text-gray-600 dark:text-gray-400">
          <p>FRC Team 620 Scouting System | REEFSCAPE 2025</p>
        </div>
      </footer>
    </div>
  );
}
