import { Metadata } from 'next'

async function fetchProperty(id: string) {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/properties/${id}`, { next: { revalidate: 60 } })
    if (!res.ok) return null
    const data = await res.json()
    return data.property
  } catch (e) {
    return null
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const property = await fetchProperty(resolvedParams.id)
  
  if (!property) return { title: 'Property Not Found — Find My Home' }

  return {
    title: `${property.title} — Find My Home`,
    description: `${property.bedrooms ? property.bedrooms + ' bed, ' : ''}${property.bathrooms ? property.bathrooms + ' bath in ' : ''}${property.location}. UGX ${property.price?.toLocaleString()}.`,
    openGraph: {
      images: property.photos?.length ? [property.photos[0]] : [],
    },
    alternates: { canonical: `https://your-app.vercel.app/properties/${resolvedParams.id}` },
  }
}

export default async function PropertyLayout({ children, params }: { children: React.ReactNode, params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const property = await fetchProperty(resolvedParams.id)
  
  if (!property) return <>{children}</>

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: property.title,
    description: property.description,
    url: `https://your-app.vercel.app/properties/${property.id}`,
    image: property.photos,
    price: property.price,
    priceCurrency: 'UGX',
    address: {
      '@type': 'PostalAddress',
      addressLocality: property.location,
      addressCountry: 'UG',
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  )
}
