import { Suspense } from "react";
import { DashboardNav } from "./components/nav";

export const metadata = {
  title: "Jira Dashboard",
  description: "Sprint tracking, backlog health, and velocity trends",
};

function NavFallback() {
  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <span className="text-lg font-bold text-gray-900">Jira Dashboard</span>
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
    <div className="min-h-screen bg-gray-50">
      <Suspense fallback={<NavFallback />}>
        <DashboardNav />
      </Suspense>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
