-- Contrato desde plantilla (E4.16).
--
-- Plantillas de texto con variables {{nombre}} que se completan con los
-- datos del contrato. Las lee cualquier agente; las edita solo admin. Una
-- sola plantilla por defecto. Formato del cuerpo: párrafos separados por
-- línea en blanco; "# " título, "## " encabezado de cláusula.

create table public.rental_contract_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 120),
  body text not null check (char_length(body) between 20 and 60000),
  is_default boolean not null default false,
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index rental_contract_templates_one_default on public.rental_contract_templates(is_default) where is_default;

alter table public.rental_contract_templates enable row level security;
revoke all on public.rental_contract_templates from anon, authenticated;
grant select, insert, update, delete on public.rental_contract_templates to authenticated;
create policy "Plantillas: lectura interna" on public.rental_contract_templates
  for select to authenticated using (true);
create policy "Plantillas: admin escribe" on public.rental_contract_templates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Plantilla modelo. Revisarla con un asesor legal antes de usarla.
insert into public.rental_contract_templates (name, is_default, updated_by, body) values (
'Locación de vivienda (modelo)', true, null,
$tpl$# CONTRATO DE LOCACIÓN

En la ciudad de {{ciudad_firma}}, a los {{fecha_firma}}, entre {{locadores}}, en adelante "LA PARTE LOCADORA", con domicilio en {{locador_domicilio}}; y {{locatarios}}, en adelante "LA PARTE LOCATARIA", con domicilio en {{locatario_domicilio}}; se celebra el presente contrato de locación, sujeto a las disposiciones del Código Civil y Comercial de la Nación y a las siguientes cláusulas:

## PRIMERA. OBJETO

LA PARTE LOCADORA da en locación a LA PARTE LOCATARIA el inmueble ubicado en {{inmueble_direccion}}, que esta declara conocer y recibir en buen estado de conservación, conforme al inventario que las partes firman por separado.

## SEGUNDA. DESTINO

El inmueble se destinará exclusivamente a vivienda de LA PARTE LOCATARIA y su grupo familiar. Queda prohibido darle otro destino, subarrendarlo total o parcialmente o ceder este contrato sin el consentimiento previo y por escrito de LA PARTE LOCADORA.

## TERCERA. PLAZO

El plazo de la locación es de {{plazo_meses}} meses, desde el {{fecha_inicio}} hasta el {{fecha_fin}}. A su vencimiento, LA PARTE LOCATARIA deberá restituir el inmueble libre de ocupantes y en el mismo estado en que lo recibió, salvo el desgaste producido por el uso normal.

## CUARTA. PRECIO

El canon locativo mensual se fija en {{canon_letras}} ({{canon}}), pagadero por mes adelantado entre el día 1 y el día {{dia_vencimiento}} de cada mes, en el domicilio de {{inmobiliaria}} o en la cuenta bancaria que esta indique por escrito.

## QUINTA. ACTUALIZACIÓN DEL CANON

{{ajuste}}

## SEXTA. MORA

La mora se producirá de pleno derecho por el solo vencimiento de los plazos, sin necesidad de interpelación judicial ni extrajudicial. En caso de mora, LA PARTE LOCATARIA abonará {{punitorio}}, sin perjuicio del derecho de LA PARTE LOCADORA a reclamar la resolución del contrato y el desalojo.

## SÉPTIMA. DEPÓSITO EN GARANTÍA

LA PARTE LOCATARIA entrega en este acto la suma de {{deposito_letras}} ({{deposito}}) en concepto de depósito en garantía, que será restituida al finalizar la locación, una vez verificado el estado del inmueble y la cancelación de todas las obligaciones a su cargo.

## OCTAVA. SERVICIOS, IMPUESTOS Y EXPENSAS

Estarán a cargo de LA PARTE LOCATARIA los servicios de luz, gas, agua, internet y telefonía, y las expensas ordinarias que correspondan al inmueble. Los impuestos que gravan la propiedad y las expensas extraordinarias estarán a cargo de LA PARTE LOCADORA.

## NOVENA. CONSERVACIÓN Y MEJORAS

LA PARTE LOCATARIA deberá conservar el inmueble en buen estado y comunicar de inmediato cualquier desperfecto. Las reparaciones originadas en el desgaste normal o en vicios del inmueble estarán a cargo de LA PARTE LOCADORA. No podrán realizarse mejoras ni modificaciones sin autorización escrita; las que se hicieran quedarán en beneficio del inmueble sin derecho a reclamo alguno.

## DÉCIMA. RESCISIÓN ANTICIPADA

LA PARTE LOCATARIA podrá rescindir el contrato en cualquier momento, notificando su decisión en forma fehaciente, y abonará en tal caso una indemnización equivalente al diez por ciento (10 %) del saldo del canon locativo futuro, calculado desde la fecha de la notificación hasta la finalización del contrato.

## UNDÉCIMA. GARANTÍA

{{garantia}}

## DUODÉCIMA. DOMICILIOS Y JURISDICCIÓN

Las partes constituyen domicilio en los indicados en el encabezado, donde serán válidas todas las notificaciones, y se someten a la jurisdicción de los tribunales ordinarios de {{ciudad_firma}}, con renuncia a cualquier otro fuero.

En prueba de conformidad se firman dos ejemplares de un mismo tenor y a un solo efecto, en el lugar y fecha indicados.



_____________________________
LA PARTE LOCADORA



_____________________________
LA PARTE LOCATARIA$tpl$
);
