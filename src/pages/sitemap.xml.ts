import type { APIRoute } from 'astro';
import { getUniversities, getFacultiesByUniversity } from '../server/repositories/catalogRepository';
import { searchResources } from '../server/repositories/resourceRepository';

export const GET: APIRoute = async ({ site, url }) => {
  const baseUrl = site || url.origin;

  const staticUrls = [
    '',
    '/resources',
    '/pdf-tools',
    '/community',
    '/about',
    '/privacy',
    '/terms',
    '/copyright',
    '/contact',
  ];

  // Fetch approved resources
  const resResult = await searchResources({ status: 'approved', limit: 100 });
  const approvedResources = resResult.resources;

  // Fetch universities and faculties
  const universities = await getUniversities();
  const faculties = await getFacultiesByUniversity('parul-university');

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${staticUrls
    .map(
      (path) => `
  <url>
    <loc>${baseUrl}${path}</loc>
    <changefreq>daily</changefreq>
    <priority>${path === '' ? '1.0' : '0.8'}</priority>
  </url>`
    )
    .join('')}

  ${universities
    .map(
      (u) => `
  <url>
    <loc>${baseUrl}/university/${u.slug}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>`
    )
    .join('')}

  ${faculties
    .map(
      (f) => `
  <url>
    <loc>${baseUrl}/university/parul-university/${f.slug}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`
    )
    .join('')}

  ${approvedResources
    .map(
      (r) => `
  <url>
    <loc>${baseUrl}/resources/${r._id}</loc>
    <lastmod>${new Date(r.updatedAt || r.createdAt).toISOString()}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`
    )
    .join('')}
</urlset>`;

  return new Response(sitemapXml.trim(), {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
