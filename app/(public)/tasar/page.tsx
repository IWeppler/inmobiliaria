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
      <section className="w-full relative text-center py-20 px-6 border-b border-zinc-200">
        <Image
          src="/banner.jpg"
          alt="banner inmobiliaria"
          fill
          className="object-cover"
        />

        <div className="absolute inset-0 bg-black/60" />
        <div className="relative z-10 text-white text-center px-6">
          <h1 className="text-4xl md:text-5xl font-bold mt-4 mb-6">
            Conocé el valor de tu Inmueble
          </h1>
          <p className="text-lg text-white leading-relaxed max-w-2xl mx-auto">
            ¿Estás pensando en vender, alquilar o simplemente saber cuánto
            cambió el valor de tu propiedad desde que la compraste?
          </p>
          <p className="font-semibold mt-3 text-white">
            Tenemos las respuestas.
          </p>
        </div>
      </section>

      {/* --- CUERPO PRINCIPAL --- */}
      <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-10 py-20">
        {/* Columna Izquierda */}
        <section className="lg:col-span-2">
          <h2 className="text-3xl font-bold mb-4">Tasar con un profesional</h2>
          <p className="text-lg text-zinc-600 mb-12">
            Descubrí el valor de tu propiedad con nuestro servicio de tasación
            profesional.
          </p>

          <div className="space-y-12">
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

        {/* Columna Derecha */}
        <aside className="lg:col-span-2 h-fit lg:sticky top-28">
          <Card className="shadow-xl border border-zinc-200 rounded-2xl max-w-lg mx-auto w-full">
            <CardHeader className="px-8">
              <CardTitle className="text-2xl font-semibold">
                Solicitá tu Tasación
              </CardTitle>
              <CardDescription className="text-zinc-600">
                Dejanos tus datos y te contactaremos a la brevedad.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-8">
              <AppraisalForm />
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* --- FAQ --- */}
      <section className="w-full py-20 bg-zinc-50 border-t border-zinc-200">
        <div className="max-w-4xl mx-auto px-6">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold mb-2">Preguntas Frecuentes</h2>
            <p className="text-zinc-600">¿Tenés dudas? Te respondemos.</p>
          </div>

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger className="text-lg font-medium text-left">
                ¿Qué es una tasación profesional?
              </AccordionTrigger>
              <AccordionContent className="text-base text-zinc-600 leading-relaxed">
                Una tasación profesional es la inspección realizada por un
                agente inmobiliario para determinar el valor actual de tu
                propiedad.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2">
              <AccordionTrigger className="text-lg font-medium text-left">
                ¿Cómo estiman el valor de mi propiedad?
              </AccordionTrigger>
              <AccordionContent className="text-base text-zinc-600 leading-relaxed">
                El agente inmobiliario visitará tu propiedad y te dará un valor
                estimado según su conocimiento del mercado inmobiliario local.
                También puede darte un rango del mayor precio que tu propiedad
                podría alcanzar. No te preocupes, una tasación profesional no
                implica un compromiso de venta.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>
    </main>
  );
}
