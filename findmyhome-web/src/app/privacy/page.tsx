export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-paper">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="font-display text-4xl font-light text-ink mb-2">Privacy Policy — Find My Home</h1>
        <p className="text-sm text-stone mb-8">Effective Date: 2026-04-14</p>

        <div className="prose prose-stone max-w-none">
          <h2>1. Data We Collect</h2>
          <p>
            We collect: full name, email address, phone number, National ID or passport scan (for KYC), property listing
            details, and payment records.
          </p>

          <h2>2. Why We Collect It</h2>
          <p>
            Identity documents are collected to verify that sellers are legitimate property owners, to prevent fraud,
            and to comply with Ugandan law. Payment data is collected to process commissions and service fees.
          </p>

          <h2>3. How We Store It</h2>
          <p>
            Identity documents are stored securely on Cloudinary with restricted access. Passwords are hashed and never
            stored in plain text. Payment data is handled by Pesapal and is not stored on our servers.
          </p>

          <h2>4. Third-Party Sharing</h2>
          <p>
            We do not sell or share your personal data with third parties, except: (a) Cloudinary for document storage,
            (b) Pesapal for payment processing, (c) law enforcement if legally required.
          </p>

          <h2>5. Your Rights</h2>
          <p>
            You may request access to, correction of, or deletion of your personal data at any time by emailing
            support@findmyhome.ug. We will respond within 14 days.
          </p>

          <h2>6. Data Retention</h2>
          <p>
            We retain your data for as long as your account is active. Upon account deletion, personal data is removed
            within 30 days, except where retention is required by law.
          </p>

          <h2>7. Compliance</h2>
          <p>This policy is compliant with Uganda&apos;s Data Protection and Privacy Act 2019.</p>
        </div>
      </div>
    </main>
  )
}

