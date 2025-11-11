import { PropertyForm } from "@/features/dashboard/PropertyForm";

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen items-start justify-center font-sans">
      <main className="w-full max-w-6xl p-4 md:p-8">
        <h1 className="text-3xl font-bold text-center mb-8">Panel de Agente</h1>

        <PropertyForm propertyTypes={[]} />
      </main>
    </div>
  );
}
