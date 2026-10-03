import { redirect } from "next/navigation";

// Los compradores viven ahora en Leads, pestaña "Demanda". Esta ruta queda
// solo para que los enlaces y favoritos viejos sigan funcionando.
export default function BuyersRedirect() {
  redirect("/dashboard/leads?vista=demanda");
}
