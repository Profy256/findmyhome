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

  return [
    { url: 'https://your-app.vercel.app', lastModified: new Date() },
    { url: 'https://your-app.vercel.app/search', lastModified: new Date() },
    ...properties.map((p: any) => ({
      url: `https://your-app.vercel.app/properties/${p.id}`,
      lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
    })),
  ]
}
