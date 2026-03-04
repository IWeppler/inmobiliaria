"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClientBrowser } from "@/lib/supabase-browser";
import { Loader2 } from "lucide-react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image as PDFImage,
} from "@react-pdf/renderer";
import dynamic from "next/dynamic";

const PDFViewer = dynamic(
  () => import("@react-pdf/renderer").then((mod) => mod.PDFViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-slate-800" />
        <span className="ml-4 text-lg font-medium">
          Cargando visualizador PDF...
        </span>
      </div>
    ),
  },
);

// --- TIPOS ESTRICTOS ---
interface PDFPropertyData {
  id: string;
  title: string;
  street_address: string | null;
  city: string;
  province: string;
  price: number | null;
  currency: string;
  operation_type: string;
  bedrooms: number | null;
  bathrooms: number | null;
  rooms: number | null;
  total_area: number | null;
  cocheras: number | null;
  description: string | null;
  property_images: { image_url: string }[] | null;
}

// --- ESTILOS DEL PDF ---
const styles = StyleSheet.create({
  page: {
    padding: 40,
    backgroundColor: "#ffffff",
    fontFamily: "Helvetica",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#eeeeee",
    paddingBottom: 15,
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#111827",
    width: "70%",
    lineHeight: 1.3,
  },
  price: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111",
    textAlign: "right",
    width: "30%",
  },
  location: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 5,
  },
  mainImage: {
    width: "100%",
    height: 280,
    borderRadius: 8,
    marginBottom: 20,
    objectFit: "cover",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 15,
    marginBottom: 10,
    color: "#374151",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    paddingBottom: 4,
  },
  description: {
    fontSize: 11,
    lineHeight: 1.5,
    color: "#4b5563",
    marginBottom: 15,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 10,
  },
  gridItem: {
    width: "48%",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    paddingBottom: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#374151",
  },
  value: {
    fontSize: 11,
    color: "#4b5563",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 10,
    color: "#9ca3af",
    borderTopWidth: 1,
    borderTopColor: "#eeeeee",
    paddingTop: 10,
  },
});

// --- COMPONENTE DEL DOCUMENTO PDF ---
const PropertyBrochure = ({ property }: { property: PDFPropertyData }) => {
  const mainImage =
    property.property_images?.[0]?.image_url ||
    "https://placehold.co/800x600/e0e0e0/a1a1a1?text=Sin+Foto";

  const formattedPrice = property.price
    ? new Intl.NumberFormat("es-AR", { style: "decimal" }).format(
        property.price,
      )
    : "Consultar";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Cabecera */}
        <View style={styles.header}>
          <View style={{ width: "70%" }}>
            <Text style={styles.title}>{property.title}</Text>
            <Text style={styles.location}>
              {property.street_address ? `${property.street_address}, ` : ""}
              {property.city}, {property.province}
            </Text>
          </View>
          <View style={{ width: "25%" }}>
            <Text style={styles.price}>
              {property.price
                ? `${property.currency} $${formattedPrice}`
                : "Consultar"}
            </Text>
          </View>
        </View>

        {/* Imagen Principal */}
        <PDFImage src={mainImage} style={styles.mainImage} />

        {/* Ficha Técnica */}
        <Text style={styles.sectionTitle}>Ficha Técnica</Text>
        <View style={styles.grid}>
          <View style={styles.gridItem}>
            <Text style={styles.label}>Operación:</Text>
            <Text style={styles.value}>{property.operation_type}</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.label}>Dormitorios:</Text>
            <Text style={styles.value}>{property.bedrooms || "0"}</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.label}>Baños:</Text>
            <Text style={styles.value}>{property.bathrooms || "0"}</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.label}>Ambientes:</Text>
            <Text style={styles.value}>{property.rooms || "0"}</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.label}>Sup. Total:</Text>
            <Text style={styles.value}>
              {property.total_area ? `${property.total_area} m²` : "-"}
            </Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.label}>Cocheras:</Text>
            <Text style={styles.value}>{property.cocheras || "0"}</Text>
          </View>
        </View>

        {/* Descripción */}
        <Text style={styles.sectionTitle}>Descripción</Text>
        <Text style={styles.description}>
          {property.description ||
            "No hay descripción disponible para esta propiedad."}
        </Text>

        {/* Footer */}
        <Text style={styles.footer}>
          TerraNova Inmobiliaria - Documento generado automáticamente. ID de
          Referencia: {property.id.slice(0, 8).toUpperCase()}
        </Text>
      </Page>
    </Document>
  );
};

// --- PÁGINA PRINCIPAL ---
export default function PDFPage() {
  const params = useParams();
  const id = params.id as string;
  const supabase = createClientBrowser();

  const [property, setProperty] = useState<PDFPropertyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProperty = async () => {
      if (!id) return;

      try {
        const { data, error } = await supabase
          .from("properties")
          .select(
            `
            *,
            property_images ( image_url )
          `,
          )
          .eq("id", id)
          .single();

        if (error) throw error;
        setProperty(data as PDFPropertyData);
      } catch (err) {
        console.error("Error fetching property:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Error desconocido al cargar el PDF",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchProperty();
  }, [id, supabase]);

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-zinc-50">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mb-4" />
        <h2 className="text-xl font-semibold">Generando Ficha PDF...</h2>
        <p className="text-zinc-500">
          Recopilando imágenes y datos de la propiedad
        </p>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-2">Error</h2>
          <p className="text-zinc-600">
            No se pudo generar el PDF. La propiedad no existe o hubo un error.
          </p>
        </div>
      </div>
    );
  }

  // Renderizamos el visor PDF ocupando toda la pantalla
  return (
    <div className="w-full h-screen bg-zinc-800">
      <PDFViewer style={{ width: "100%", height: "100%", border: "none" }}>
        <PropertyBrochure property={property} />
      </PDFViewer>
    </div>
  );
}
