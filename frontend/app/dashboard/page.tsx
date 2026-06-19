import { UserButton } from "@clerk/nextjs";

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-gray-500">Your digest will appear here.</p>
      <UserButton afterSignOutUrl="/" />
    </div>
  );
}
