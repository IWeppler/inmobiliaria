import { BarChart3, Search, Building2, FileText } from "lucide-react";

// 1. El componente para cada item (tarjeta)
export function ServiceStepItem({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="shrink-0 p-2 bg-blue-50 rounded-lg">
        <Icon className="w-6 h-6 text-main" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-1">
          {title}
        </h3>
        <p className="text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}

// 2. Los datos de los pasos
export const serviceSteps = [
  {
    icon: BarChart3,
    title: "Análisis del mercado",
    description:
      "Revisamos las tendencias del mercado inmobiliario, los precios de venta recientes y las propiedades similares en venta en la zona.",
  },
  {
    icon: Search,
    title: "Inspección de la propiedad",
    description:
      "Visitamos la unidad para evaluar su estado, tamaño, ubicación y características únicas.",
  },
  {
    icon: Building2,
    title: "Análisis de factores externos",
    description:
      "Consideramos ciertos factores como la ubicación, el acceso a servicios y la demanda en la zona.",
  },
  {
    icon: FileText,
    title: "Informe de tasación",
    description:
      "Detallamos nuestra valoración y la justificación de la misma para que tengas total claridad.",
  },
];