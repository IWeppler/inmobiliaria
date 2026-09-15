import { PropertyForm } from "@/features/dashboard/property/PropertyForm";

export default function DashboardPage() {
  return (
    <div className="theme-tn flex min-h-screen items-start justify-center font-sans">
      <main className="w-full max-w-6xl p-4 md:p-8">
        <h1 className="text-4xl font-serif font-semibold text-center mb-8 text-foreground">
          Formulario de Nueva Propiedad
        </h1>
        <PropertyForm propertyTypes={[]} />
      </main>
    </div>
  );
}
