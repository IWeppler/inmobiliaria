import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://terranova-demo.vercel.app';

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // /estado/: links privados de estado de cuenta (además llevan noindex).
      disallow: ['/dashboard/', '/admin/', '/login', '/estado/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}