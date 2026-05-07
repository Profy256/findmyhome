import { MetadataRoute } from 'next'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let properties = []
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/properties`, { next: { revalidate: 3600 } })
    if (res.ok) {
      const data = await res.json()
      properties = data.data || []
    }
  } catch (e) {
    console.error('Failed to fetch properties for sitemap', e)
  }

  const base = 'https://findmyhomeuganda.com'

  return [
    { url: base, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 1 },
    { url: `${base}/search`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.8 },
    ...properties.map((p: any) => ({
      url: `${base}/properties/${p.id}`,
      lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ]
}
