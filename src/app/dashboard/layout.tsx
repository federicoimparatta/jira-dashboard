import { Suspense } from "react";
import { DashboardNav } from "./components/nav";

export const metadata = {
  title: "Engineering",
  description: "Sprint tracking, backlog health, and velocity trends",
};

function NavFallback() {
  return (
    <nav className="smg-gradient-nav shadow-lg">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="1" y="1" width="7" height="7" rx="2" fill="white" opacity="0.9"/>
                <rect x="10" y="1" width="7" height="7" rx="2" fill="white" opacity="0.6"/>
                <rect x="1" y="10" width="7" height="7" rx="2" fill="white" opacity="0.6"/>
                <rect x="10" y="10" width="7" height="7" rx="2" fill="white" opacity="0.3"/>
              </svg>
            </div>
            <span className="text-lg font-semibold tracking-tight text-white">
              Engineering
            </span>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-smg-gray-50">
      <Suspense fallback={<NavFallback />}>
        <DashboardNav />
      </Suspense>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
