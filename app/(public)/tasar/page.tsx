import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/components/ui/accordion";
import { AppraisalForm } from "@/features/public/AppraisalForm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import {
  ServiceStepItem,
  serviceSteps,
} from "@/features/public/ServiceStepItem";
import Image from "next/image";

export default function TasarPage() {
  return (
    <main className="flex min-h-screen w-full flex-col items-center text-foreground">
      {/* --- HERO --- */}
      <section className="relative w-full h-[50vh] min-h-[420px] flex items-center justify-center overflow-hidden">
  <Image
    src="/banner.jpg"
    alt="Banner TerraNova"
    fill
    className="object-cover brightness-75"
  />

  {/* Overlay */}
  <div className="absolute inset-0 bg-black/40" />

  {/* Contenido */}
  <div className="relative z-10 text-center px-6 max-w-4xl">
    <h1 className="text-4xl md:text-6xl font-clash font-semibold text-white leading-tight drop-shadow-lg">
      Conocé el valor de tu inmueble
    </h1>
    <p className="mt-6 text-lg md:text-xl text-white/90 leading-relaxed">
      ¿Estás pensando en vender, alquilar o simplemente saber cuánto cambió el
      valor de tu propiedad?
    </p>
    <p className="mt-4 font-medium text-white/90">
      Te damos respuestas claras basadas en datos reales.
    </p>
  </div>
</section>

      {/* --- CUERPO PRINCIPAL --- */}
      <div className="w-full max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16 py-24 px-6">

  {/* COLUMNA IZQUIERDA */}
  <section className="lg:col-span-2">
    <h2 className="text-3xl md:text-4xl font-clash font-semibold mb-6">
      Tasación Profesional
    </h2>

    <p className="text-lg text-zinc-600 mb-12 leading-relaxed max-w-xl">
      Descubrí el valor real de tu propiedad con nuestro servicio de tasación
      profesional. Combinamos experiencia local y análisis del mercado para
      brindarte una estimación precisa y confiable.
    </p>

    <div className="space-y-10">
      {serviceSteps.map((step) => (
        <ServiceStepItem
          key={step.title}
          icon={step.icon}
          title={step.title}
          description={step.description}
        />
      ))}
    </div>
  </section>

  {/* COLUMNA DERECHA: FORMULARIO */}
  <aside className="lg:col-span-2 h-fit lg:sticky top-28">
    <Card className="shadow-lg border border-zinc-200 rounded-2xl max-w-xl mx-auto w-full">
      <CardHeader className="px-8 pt-8">
        <CardTitle className="text-2xl font-clash font-semibold">
          Solicitá tu tasación
        </CardTitle>
        <CardDescription className="text-zinc-600 text-base leading-relaxed">
          Dejanos tus datos y un profesional se comunicará con vos.
        </CardDescription>
      </CardHeader>

      <CardContent className="px-8 pb-8">
        <AppraisalForm />
      </CardContent>
    </Card>
  </aside>

</div>


      {/* --- FAQ --- */}
      <section className="w-full py-24 bg-zinc-50 border-t border-zinc-200">
  <div className="max-w-4xl mx-auto px-6">

    <div className="text-center mb-12">
      <h2 className="text-3xl md:text-4xl font-clash font-semibold mb-3">
        Preguntas Frecuentes
      </h2>
      <p className="text-zinc-600 text-lg">
        Todo lo que necesitás saber antes de solicitar una tasación.
      </p>
    </div>

    <Accordion type="single" collapsible className="w-full space-y-4">
      <AccordionItem value="item-1" className="border-b border-zinc-200">
        <AccordionTrigger className="text-lg font-medium text-left">
          ¿Qué es una tasación profesional?
        </AccordionTrigger>
        <AccordionContent className="text-base text-zinc-600 leading-relaxed">
          Una tasación profesional es un análisis realizado por un agente
          inmobiliario certificado para determinar con precisión el valor
          actual de tu propiedad según el mercado.
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="item-2" className="border-b border-zinc-200">
        <AccordionTrigger className="text-lg font-medium text-left">
          ¿Cómo estiman el valor de mi propiedad?
        </AccordionTrigger>
        <AccordionContent className="text-base text-zinc-600 leading-relaxed">
          Un agente especializado visita tu propiedad, analiza su estado,
          ubicación, equipamiento y compara con ventas recientes en la zona
          para brindarte un rango de valor confiable.
        </AccordionContent>
      </AccordionItem>
    </Accordion>

  </div>
</section>

     
    </main>
  );
}
