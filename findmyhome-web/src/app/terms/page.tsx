export default function TermsPage() {
  return (
    <main className="min-h-screen bg-paper">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="font-display text-4xl font-light text-ink mb-2">Terms &amp; Conditions — Find My Home</h1>
        <p className="text-sm text-stone mb-8">Effective Date: 2026-04-14</p>

        <div className="prose prose-stone max-w-none">
          <h2>1. About the Platform</h2>
          <p>
            Find My Home is an online marketplace that connects property owners (sellers and landlords) with buyers and
            renters in Uganda. The platform does not own any property listed and does not act as an estate agent. All
            transactions are between users.
          </p>

          <h2>2. User Obligations</h2>
          <p>
            All users must provide accurate, truthful information. False information may result in immediate account
            suspension. Users must be at least 18 years old. Users are solely responsible for all activity under their
            account.
          </p>

          <h2>3. Seller Obligations</h2>
          <p>
            Sellers must complete KYC verification before publishing listings. Land sellers must upload a valid,
            government-issued land title for each land listing. Listings must be accurate and not misleading.
            Double-listing the same property is prohibited and will result in suspension.
          </p>

          <h2>4. Commission</h2>
          <p>
            A commission of 5% of the confirmed sale price is payable to Find My Home on every sale completed through
            the platform. Registered companies pay 3%. Commission is due within 14 days of sale confirmation. Accounts
            that fail to pay commission after 3 completed transactions will be suspended.
          </p>

          <h2>5. Platform Liability</h2>
          <p>
            Find My Home is not liable for the accuracy of listings, for transactions conducted outside the platform,
            for disputes between buyers and sellers, or for losses arising from fraudulent listings.
          </p>

          <h2>6. Termination</h2>
          <p>
            Find My Home reserves the right to suspend or permanently ban any account that violates these Terms, without
            prior notice.
          </p>

          <h2>7. Governing Law</h2>
          <p>These Terms are governed by the laws of the Republic of Uganda.</p>
        </div>
      </div>
    </main>
  )
}

