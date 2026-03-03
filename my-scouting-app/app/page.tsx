'use client';

import Link from 'next/link';

export default function Home() {
  const sections = [
    {
      title: 'Scout Match',
      description: 'Record match statistics in real-time',
      href: '/scout'
    },
    {
      title: 'Pit Scouting',
      description: 'Document robot capabilities and design',
      href: '/pitscout'
    },
    {
      title: 'Team Analysis',
      description: 'View team performance metrics',
      href: '/analysis/teams'
    },
    {
      title: 'Match Analysis',
      description: 'Analyze match results and strategies',
      href: '/analysis/matches'
    },
    {
      title: 'Pick Lists',
      description: 'Generate and manage pick strategies',
      href: '/analysis/pick-lists'
    },
    {
      title: 'Teams',
      description: 'Browse teams and their info',
      href: '/teams'
    },
    {
      title: 'Admin',
      description: 'Import data and manage competitions',
      href: '/admin'
    },
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="bg-gradient-to-b from-red-900/40 to-black border-b border-red-600/30 px-6 py-12">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-5xl font-bold mb-2 text-white">
            Scouting Command Center
          </h1>
          <p className="text-red-400 text-lg">
            FIRST Robotics Intelligence Platform
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="group"
            >
              <div className="bg-gradient-to-br from-red-700 to-red-900 rounded-md p-6 h-full transform transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:from-red-600 hover:to-red-800 cursor-pointer">
                <h2 className="text-2xl font-bold mb-2 text-white">
                  {section.title}
                </h2>
                <p className="text-white/80">
                  {section.description}
                </p>
                <div className="mt-4 text-white/60 text-sm font-medium group-hover:text-white/100 transition-colors">
                  Open →
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-red-900/50 px-6 py-8 mt-12">
        <div className="max-w-6xl mx-auto text-center text-gray-500 text-sm">
          <p>Scouting App for FIRST Robotics Competition</p>
        </div>
      </div>
    </div>
  );
}
