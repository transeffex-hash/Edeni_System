"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "use-intl";

interface StatsData {
  users: number;
  businesses: number;
  products: number;
}

export default function StatsBar() {
  const [stats, setStats] = useState<StatsData>({ users: 50, businesses: 25, products: 500 });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Fetch stats from backend
    const fetchStats = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"}/api/public/stats`);
        if (res.ok) {
          const data = await res.json();
          // Only update if we have meaningful numbers, otherwise keep fallback
          if (data.businesses > 0 || data.products > 0) {
            setStats(data);
          }
        }
      } catch (error) {
        console.error("Failed to fetch public stats:", error);
      }
    };

    fetchStats();
    
    // Simple mount animation
    setTimeout(() => setIsVisible(true), 500);
  }, []);

  return (
    <div className={`w-full bg-[#047857] py-8 border-y border-[#059669] transition-opacity duration-1000 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center divide-y md:divide-y-0 md:divide-x divide-[#059669]">
          
          <div className="flex flex-col items-center justify-center p-4">
            <div className="text-4xl md:text-5xl font-display font-bold text-white mb-2">
              {stats.businesses > 10 ? `${Math.floor(stats.businesses / 10) * 10}+` : stats.businesses}
            </div>
            <div className="text-[#a7f3d0] font-medium text-sm md:text-base uppercase tracking-wider">
              Active Businesses
            </div>
          </div>

          <div className="flex flex-col items-center justify-center p-4">
            <div className="text-4xl md:text-5xl font-display font-bold text-white mb-2">
              {stats.users > 10 ? `${Math.floor(stats.users / 10) * 10}+` : stats.users}
            </div>
            <div className="text-[#a7f3d0] font-medium text-sm md:text-base uppercase tracking-wider">
              System Users
            </div>
          </div>

          <div className="flex flex-col items-center justify-center p-4">
            <div className="text-4xl md:text-5xl font-display font-bold text-white mb-2">
              {stats.products > 100 ? `${Math.floor(stats.products / 100) * 100}+` : stats.products}
            </div>
            <div className="text-[#a7f3d0] font-medium text-sm md:text-base uppercase tracking-wider">
              Products Managed
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
