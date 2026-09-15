export function PropertyJsonLd({ property }: { property: any }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SingleFamilyResidence", 
    "name": property.title,
    "image": property.property_images.map((img: any) => img.image_url),
    "description": property.description,
    "address": {
      "@type": "PostalAddress",
      "streetAddress": property.street_address,
      "addressLocality": property.city,
      "addressRegion": property.province,
      "addressCountry": "AR"
    },
    "numberOfRooms": property.rooms,
    "floorSize": {
      "@type": "QuantitativeValue",
      "value": property.total_area,
      "unitCode": "MTK" 
    },
    "offers": {
      "@type": "Offer",
      "priceCurrency": property.currency,
      "price": property.price,
      "availability": property.status === 'EN_VENTA' || property.status === 'EN_ALQUILER' 
        ? "https://schema.org/InStock" 
        : "https://schema.org/SoldOut"
    }
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}