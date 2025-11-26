import { MetadataRoute } from 'next';
import { createClientServer } from '@/lib/supabase';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClientServer();
  
  // URL de tu sitio
  const baseUrl = 'https://terranova-inmobiliaria.vercel.app'; 

  // 1. Obtener todas las propiedades 
  const { data: properties } = await supabase
    .from('properties')
    .select('id, created_at');

  // 2. Generar URLs dinámicas
  const propertyUrls = (properties || []).map((prop) => ({
    url: `${baseUrl}/propiedades/${prop.id}`,
    lastModified: new Date(prop.created_at),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  // 3. Rutas estáticas 
  const staticRoutes = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 1,
    },
    {
      url: `${baseUrl}/contacto`,
      lastModified: new Date(),
      changeFrequency: 'yearly' as const,
      priority: 0.5,
    },
  ];

  return [...staticRoutes, ...propertyUrls];
}