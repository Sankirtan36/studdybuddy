import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site, url }) => {
  const baseUrl = site || url.origin;

  const robotsTxt = `User-agent: *
Allow: /
Allow: /resources
Allow: /university
Allow: /about
Allow: /privacy
Allow: /terms
Allow: /copyright

# Protect private account, admin, and server mutation routes
Disallow: /admin
Disallow: /admin/
Disallow: /dashboard
Disallow: /dashboard/
Disallow: /api/
Disallow: /login
Disallow: /register

Sitemap: ${baseUrl}/sitemap.xml
`;

  return new Response(robotsTxt, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
};
