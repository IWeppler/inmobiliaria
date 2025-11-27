import Link from "next/link";
import { Mail, Home, Calculator, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/shared/components/ui/badge";

// Mapeo de iconos según la fuente
const getSourceIcon = (source: string) => {
  const s = source?.toUpperCase() || "";
  if (s.includes("PROPIEDAD")) return <Home className="w-4 h-4 text-blue-600" />;
  if (s.includes("TASACION") || s.includes("TASAR")) return <Calculator className="w-4 h-4 text-purple-600" />;
  if (s.includes("CONTACTO")) return <Mail className="w-4 h-4 text-orange-600" />;
  return <MessageSquare className="w-4 h-4 text-zinc-500" />;
};

export function LeadsWidget({ leads }: { leads: any[] }) {
  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-400 p-8 text-center">
        <Mail className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-sm">No hay consultas recientes.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-zinc-100">
      {leads.map((lead) => (
        <Link 
          key={lead.id} 
          href={`/dashboard/leads/${lead.id}`}
          className="flex items-start gap-3 p-4 hover:bg-zinc-50 transition-colors group"
        >
          {/* Icono de Fuente */}
          <div className="mt-1 p-2 bg-white border rounded-full shadow-sm shrink-0 group-hover:border-zinc-300 transition-colors">
            {getSourceIcon(lead.source)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start">
              <p className="text-sm font-semibold text-zinc-900 truncate pr-2">
                {lead.name}
              </p>
              <span className="text-[10px] text-zinc-400 whitespace-nowrap">
                {format(new Date(lead.created_at), "d MMM", { locale: es })}
              </span>
            </div>
            
            {/* Si viene de una propiedad, mostramos cual */}
            {lead.properties ? (
               <p className="text-xs text-blue-600 truncate mt-0.5 font-medium">
                 Ref: {lead.properties.title}
               </p>
            ) : (
               <p className="text-xs text-zinc-500 truncate mt-0.5 capitalize">
                 {lead.source.toLowerCase().replace("_", " ")}
               </p>
            )}

            {/* Mensaje corto */}
            {lead.notes && (
                <p className="text-xs text-zinc-400 mt-1 line-clamp-1 italic">
                    "{lead.notes}"
                </p>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}