import React, { useState } from 'react';

// ─── Shared legal page shell ──────────────────────────────────────────────────
const CONTACT_EMAIL = 'legal@homecrew.in'; // FILL IN before going live
const LAST_UPDATED  = '13 October 2025';

const LegalShell: React.FC<{
  title: string;
  titleTa: string;
  lang: 'en' | 'ta';
  onChangeLang: (l: 'en' | 'ta') => void;
  children: React.ReactNode;
}> = ({ title, titleTa, lang, onChangeLang, children }) => (
  <div style={{
    maxWidth: '820px', margin: '0 auto', padding: '32px 20px 80px',
    fontFamily: 'Georgia, "Times New Roman", serif', lineHeight: 1.8, color: '#1e293b',
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '8px' }}>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 900, margin: 0, fontFamily: 'system-ui, sans-serif', color: 'var(--color-teal-dark, #0e7490)' }}>
        {lang === 'en' ? title : titleTa}
      </h1>
      <div style={{ display: 'flex', gap: '6px' }}>
        {(['en', 'ta'] as const).map(l => (
          <button key={l} onClick={() => onChangeLang(l)}
            style={{ padding: '5px 14px', borderRadius: '6px', border: '2px solid var(--color-teal-dark, #0e7490)', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', backgroundColor: lang === l ? 'var(--color-teal-dark, #0e7490)' : '#fff', color: lang === l ? '#fff' : 'var(--color-teal-dark, #0e7490)' }}>
            {l === 'en' ? 'English' : 'தமிழ்'}
          </button>
        ))}
      </div>
    </div>
    <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '28px', fontFamily: 'system-ui, sans-serif' }}>
      {lang === 'en' ? `Last updated: ${LAST_UPDATED}` : `கடைசியாக புதுப்பிக்கப்பட்டது: ${LAST_UPDATED}`}
    </p>
    <div style={{ backgroundColor: '#fff9f0', border: '2px solid #f59e0b', borderRadius: '8px', padding: '12px 16px', marginBottom: '28px', fontSize: '0.85rem', fontFamily: 'system-ui, sans-serif' }}>
      <strong>Note to operator:</strong> These legal texts must be reviewed and approved by a qualified lawyer admitted to practice in India before this platform is used commercially or made available to the public. Replace <code>{CONTACT_EMAIL}</code> with your actual contact email before launch.
    </div>
    {children}
  </div>
);

const Section: React.FC<{ heading: string; children: React.ReactNode }> = ({ heading, children }) => (
  <section style={{ marginBottom: '28px' }}>
    <h2 style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'system-ui, sans-serif', color: '#0f172a', borderBottom: '2px solid #e2e8f0', paddingBottom: '6px', marginBottom: '12px' }}>{heading}</h2>
    {children}
  </section>
);

const P: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p style={{ margin: '0 0 10px' }}>{children}</p>
);

const Ul: React.FC<{ items: React.ReactNode[] }> = ({ items }) => (
  <ul style={{ margin: '0 0 12px 20px', padding: 0 }}>
    {items.map((item, i) => <li key={i} style={{ marginBottom: '6px' }}>{item}</li>)}
  </ul>
);

// ══════════════════════════════════════════════════════════════════════════════
// PRIVACY POLICY
// ══════════════════════════════════════════════════════════════════════════════

const PrivacyEn: React.FC = () => (
  <>
    <Section heading="1. Who We Are">
      <P>HomeCrew is a platform that connects customers in Coimbatore with independent home-service providers and technicians. We operate the HomeCrew Customer App, the HomeCrew Partner App, and the HomeCrew Operations Console. Our contact email is <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</P>
      <P>This Privacy Policy explains what personal data we collect, why we collect it, who can see it, how long we keep it, and what rights you have under India's <strong>Digital Personal Data Protection Act, 2023 (DPDP Act)</strong>.</P>
    </Section>

    <Section heading="2. Data We Collect and Why">
      <P><strong>All users (customers and providers):</strong></P>
      <Ul items={[
        <><strong>Full name</strong> — to personalise your account and display to the other party after a job is confirmed.</>,
        <><strong>Email address</strong> — for account login, password reset, and important service notifications.</>,
        <><strong>Mobile phone number</strong> — for OTP verification at registration and for masked in-app call routing during active jobs. Your number is never shown directly to the other party.</>,
        <><strong>Coimbatore locality (area) and pincode</strong> — to match you with service providers or jobs within your radius, and to calculate emergency dispatch distances.</>,
        <><strong>Language preference</strong> — to display the app in English or Tamil.</>,
        <><strong>Device push-notification token (FCM)</strong> — to send you real-time alerts about bids, job status changes, emergency dispatch opportunities, and review reminders. You can turn push notifications off at any time in your device's notification settings or from the app's profile screen. Turning them off will not affect your ability to use the platform, but you may miss time-sensitive emergency alerts.</>,
      ]} />
      <P><strong>Customers only:</strong></P>
      <Ul items={[
        <><strong>Job description, photos, and preferred start time</strong> — to describe the service needed to potential providers.</>,
        <><strong>Confidential home address</strong> — stored encrypted. It is shared with a confirmed provider only after the customer explicitly taps the "Share Address" card. It is hidden again after the job is marked complete. It is never shown during the bidding stage.</>,
        <><strong>Review text and star rating</strong> — entered voluntarily after job completion.</>,
        <><strong>Chat messages with providers</strong> — stored and visible to both parties for 7 days after job completion, then set to read-only and inaccessible after that period.</>,
      ]} />
      <P><strong>Service providers and technicians only:</strong></P>
      <Ul items={[
        <><strong>Government-issued ID document (Aadhaar / Trade License / equivalent)</strong> — submitted for identity verification by our operations team. The document reference is stored; we do not store raw scans in end-user-accessible storage.</>,
        <><strong>Selfie photograph</strong> — submitted for live identity matching at verification stage.</>,
        <><strong>Professional categories, years of experience, and working hours</strong> — to match you with relevant jobs and display to customers.</>,
        <><strong>Coin ledger (bid history, earnings, penalties)</strong> — to maintain transparent reward records for bidding eligibility.</>,
        <><strong>Calendar bookings and availability</strong> — to enforce scheduling rules and prevent clashes.</>,
      ]} />
    </Section>

    <Section heading="3. Photo EXIF Metadata">
      <P>Job photos uploaded by customers are processed to <strong>strip all EXIF metadata</strong> (including GPS coordinates, device model, and timestamps) before storage. This means photos cannot be used to identify a customer's precise location beyond what is explicitly shared.</P>
    </Section>

    <Section heading="4. Who Can See Your Data">
      <P>Access to your data is strictly limited:</P>
      <Ul items={[
        <>Your <strong>confirmed provider</strong> can see your first name, locality, and the job description. Your full address is only revealed when you tap "Share Address" and is hidden after completion.</>,
        <>Your <strong>customer</strong> can see your first name, profile photo, overall rating, and service categories if you are a provider who has bid or been assigned to their job.</>,
        <>Our <strong>operations team</strong> (admin console users) can view platform-wide data to manage disputes, verify identities, and maintain platform integrity. Access is role-restricted (super / support / finance).</>,
        <>We do <strong>not</strong> sell, rent, or trade your personal data to any third party for marketing purposes.</>,
      ]} />
    </Section>

    <Section heading="5. Chat Messages">
      <P>Chat between customers and providers is available during an active job and for 7 days after completion (read-only). After 7 days, the chat thread is no longer accessible through the app. Our operations team may access chat messages to investigate disputes.</P>
    </Section>

    <Section heading="6. Cookies and Local Storage">
      <P>We do not use advertising or analytics cookies. We use browser <strong>localStorage</strong> and <strong>IndexedDB</strong> only to:</P>
      <Ul items={[
        <>Store your Supabase authentication session token so you stay logged in across browser sessions.</>,
        <>Cache the app shell (HTML, CSS, JS) in the service worker for offline functionality.</>,
        <>Store your UI language preference.</>,
      ]} />
      <P>You can clear this data at any time through your browser's settings. Doing so will log you out.</P>
    </Section>

    <Section heading="7. Data Processors">
      <P>We use the following sub-processors to operate the platform. Your data may be transferred to and stored on their servers, which are located outside India:</P>
      <Ul items={[
        <><strong>Supabase, Inc. (USA)</strong> — database, authentication, real-time data, and file storage. <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">Supabase Privacy Policy</a>.</>,
        <><strong>Google Firebase / Google LLC (USA)</strong> — push notification delivery via Firebase Cloud Messaging. <a href="https://firebase.google.com/support/privacy" target="_blank" rel="noopener noreferrer">Firebase Privacy Policy</a>.</>,
        <><strong>Vercel, Inc. (USA)</strong> — web application hosting and content delivery. <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">Vercel Privacy Policy</a>.</>,
      ]} />
      <P>These transfers are made with appropriate safeguards consistent with the DPDP Act 2023 and applicable cross-border transfer rules notified by the Government of India.</P>
    </Section>

    <Section heading="8. Data Retention">
      <Ul items={[
        <>Active account data is retained as long as your account is open.</>,
        <>Completed job data (descriptions, pricing, reviews) is retained for 3 years for dispute resolution and regulatory purposes.</>,
        <>Chat messages are set to read-only 7 days after job completion and are permanently deleted after 90 days.</>,
        <>Verification documents (ID reference, selfie) are retained for 2 years after account closure to comply with anti-fraud and regulatory obligations.</>,
        <>Push-notification tokens are deleted within 30 days of account closure.</>,
      ]} />
    </Section>

    <Section heading="9. Your Rights (DPDP Act 2023)">
      <P>Under the Digital Personal Data Protection Act, 2023, you have the right to:</P>
      <Ul items={[
        <><strong>Access</strong> — request a summary of the personal data we hold about you.</>,
        <><strong>Correction</strong> — ask us to correct inaccurate data.</>,
        <><strong>Erasure</strong> — request deletion of your account and associated personal data, subject to retention obligations described above.</>,
        <><strong>Grievance Redressal</strong> — raise a complaint with our Data Protection Officer.</>,
        <><strong>Nomination</strong> — nominate another individual to exercise these rights on your behalf in the event of your death or incapacity.</>,
      ]} />
      <P>To exercise any of these rights, email us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> with the subject line "Privacy Request". We will respond within 30 days.</P>
    </Section>

    <Section heading="10. Children">
      <P>Our platform is not intended for use by persons under 18 years of age. We do not knowingly collect personal data from minors. If you believe a minor has registered, please contact us immediately.</P>
    </Section>

    <Section heading="11. Changes to This Policy">
      <P>We will notify you of material changes by posting a notice in the app and updating the "Last updated" date above. Continued use of the platform after the effective date constitutes acceptance of the updated policy.</P>
    </Section>

    <Section heading="12. Contact Us">
      <P>Data Protection Officer / Grievance Officer<br />Email: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></P>
    </Section>
  </>
);

const PrivacyTa: React.FC = () => (
  <>
    <Section heading="1. நாம் யார்">
      <P>ஹோம்க்ரூ என்பது கோயம்புத்தூரில் உள்ள வாடிக்கையாளர்களையும் சுயாதீன வீட்டு சேவை வழங்குநர்களையும் இணைக்கும் ஒரு தளம். தொடர்புக்கு: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</P>
      <P>இந்த தனியுரிமைக் கொள்கை, இந்தியாவின் <strong>டிஜிட்டல் தனிப்பட்ட தரவு பாதுகாப்பு சட்டம் 2023 (DPDP சட்டம்)</strong> இன் கீழ் நாம் என்ன தரவு சேகரிக்கிறோம், ஏன் சேகரிக்கிறோம், யார் பார்க்கலாம், எவ்வளவு காலம் வைத்திருப்போம் என்பதை விளக்குகிறது.</P>
    </Section>

    <Section heading="2. நாம் சேகரிக்கும் தரவு மற்றும் ஏன்">
      <P><strong>அனைத்து பயனர்களுக்கும் (வாடிக்கையாளர்கள் மற்றும் வழங்குநர்கள்):</strong></P>
      <Ul items={[
        <><strong>முழு பெயர்</strong> — உங்கள் கணக்கை தனிப்பயனாக்கவும், பணி உறுதிப்படுத்தப்பட்ட பிறகு மற்ற தரப்பினருக்கு காட்டவும்.</>,
        <><strong>மின்னஞ்சல் முகவரி</strong> — உள்நுழைவு, கடவுச்சொல் மீட்டமைப்பு மற்றும் முக்கிய சேவை அறிவிப்புகளுக்காக.</>,
        <><strong>கைபேசி எண்</strong> — பதிவின்போது OTP சரிபார்ப்புக்கும், செயலில் உள்ள பணிகளில் மறைக்கப்பட்ட அழைப்பு வழிப்பாடலுக்கும். உங்கள் எண் மற்ற தரப்பினருக்கு நேரடியாக காட்டப்படாது.</>,
        <><strong>கோயம்புத்தூர் பகுதி மற்றும் பின்கோடு</strong> — உங்கள் அருகில் உள்ள வழங்குநர்கள் அல்லது பணிகளை கண்டறியவும், அவசர சேவை தூரம் கணக்கிடவும்.</>,
        <><strong>மொழி விருப்பம்</strong> — ஆங்கிலம் அல்லது தமிழில் பயன்பாட்டை காட்டவும்.</>,
        <><strong>FCM சாதன நோட்டிபிகேஷன் டோக்கன்</strong> — நிகழ்நேர எச்சரிக்கைகளுக்காக. உங்கள் சாதன அமைப்புகளில் அல்லது பயன்பாட்டு சுயவிவர திரையில் எந்த நேரத்திலும் இதை அணைக்கலாம்.</>,
      ]} />
      <P><strong>வாடிக்கையாளர்களுக்கு மட்டும்:</strong></P>
      <Ul items={[
        <><strong>பணி விவரங்கள், புகைப்படங்கள், விரும்பிய தொடக்க நேரம்</strong> — வழங்குநர்களுக்கு சேவையை விவரிக்க.</>,
        <><strong>ரகசிய வீட்டு முகவரி</strong> — என்க்ரிப்ட் செய்து சேமிக்கப்படும். வாடிக்கையாளர் "முகவரி பகிர்" என்பதை தட்டினால் மட்டும் உறுதிப்படுத்தப்பட்ட வழங்குநருக்கு காட்டப்படும். பணி முடிந்தவுடன் மறைக்கப்படும்.</>,
        <><strong>மதிப்பீட்டு உரை மற்றும் நட்சத்திர மதிப்பீடு</strong> — பணி முடிந்த பிறகு தன்னார்வமாக உள்ளிடப்படும்.</>,
        <><strong>வழங்குநர்களுடன் அரட்டை செய்திகள்</strong> — பணி முடிந்த 7 நாட்களுக்கு பார்க்க முடியும்; பிறகு படிக்க மட்டுமே.</>,
      ]} />
    </Section>

    <Section heading="3. புகைப்பட EXIF தரவு நீக்கம்">
      <P>வாடிக்கையாளர்கள் பதிவேற்றும் பணி புகைப்படங்களிலிருந்து சேமிப்பிற்கு முன்பே <strong>அனைத்து EXIF மெட்டாடேட்டாவும் (GPS ஒருங்கினைப்பு உட்பட) நீக்கப்படும்.</strong></P>
    </Section>

    <Section heading="4. உங்கள் தரவை யார் பார்க்கலாம்">
      <Ul items={[
        <>உங்கள் <strong>உறுதிப்படுத்தப்பட்ட வழங்குநர்</strong> மட்டும் உங்கள் முதல் பெயர், பகுதி மற்றும் பணி விவரங்களை பார்க்கலாம். முழு முகவரி "முகவரி பகிர்" தட்டினால் மட்டும் காட்டப்படும்.</>,
        <>மூன்றாம் தரப்பினருக்கு உங்கள் தரவை <strong>விற்கவோ, வாடகைக்கு கொடுக்கவோ செய்வதில்லை.</strong></>,
      ]} />
    </Section>

    <Section heading="5. அரட்டை செய்திகள்">
      <P>பணி முடிந்த 7 நாட்களுக்கு அரட்டை படிக்க மட்டுமே கிடைக்கும். 90 நாட்களுக்குப் பிறகு நிரந்தரமாக நீக்கப்படும்.</P>
    </Section>

    <Section heading="6. குக்கீகள் மற்றும் உள்ளூர் சேமிப்பு">
      <P>விளம்பர அல்லது பகுப்பாய்வு குக்கீகளை நாங்கள் பயன்படுத்துவதில்லை. உள்நுழைவு அமர்வு டோக்கன், பயன்பாட்டு ஷெல் கேஷிங், மொழி விருப்பம் ஆகியவற்றுக்கு மட்டும் localStorage மற்றும் service worker cache பயன்படுத்தப்படுகிறது.</P>
    </Section>

    <Section heading="7. தரவு செயலாக்கத்தாரர்கள்">
      <Ul items={[
        <><strong>Supabase, Inc.</strong> — தரவுத்தளம், அங்கீகாரம், கோப்பு சேமிப்பு.</>,
        <><strong>Google Firebase (Google LLC)</strong> — புஷ் நோட்டிபிகேஷன்.</>,
        <><strong>Vercel, Inc.</strong> — வலை பயன்பாட்டு ஹோஸ்டிங்.</>,
      ]} />
    </Section>

    <Section heading="8. தரவு தக்கவைப்பு காலம்">
      <Ul items={[
        <>செயலில் உள்ள கணக்கு தரவு — கணக்கு திறந்திருக்கும் வரை.</>,
        <>நிறைவடைந்த பணி தரவு — 3 ஆண்டுகள்.</>,
        <>அரட்டை செய்திகள் — 90 நாட்களுக்குப் பிறகு நீக்கப்படும்.</>,
        <>சரிபார்ப்பு ஆவணங்கள் — கணக்கு மூடப்பட்ட 2 ஆண்டுகள் வரை.</>,
      ]} />
    </Section>

    <Section heading="9. உங்கள் உரிமைகள் (DPDP சட்டம் 2023)">
      <P>தரவு அணுகல், திருத்தம், நீக்கம், குறைதீர்வு, மற்றும் நாமினேஷன் உரிமைகள் உள்ளன. இவற்றை பெற மின்னஞ்சல் செய்யுங்கள்: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</P>
    </Section>

    <Section heading="10. இந்த கொள்கையில் மாற்றங்கள்">
      <P>முக்கிய மாற்றங்களை பயன்பாட்டில் அறிவிப்பு வழியாக தெரிவிப்போம். மேலே உள்ள "கடைசியாக புதுப்பிக்கப்பட்டது" தேதியை சரிபார்க்கவும்.</P>
    </Section>
  </>
);

// ══════════════════════════════════════════════════════════════════════════════
// TERMS AND CONDITIONS
// ══════════════════════════════════════════════════════════════════════════════

const TermsEn: React.FC = () => (
  <>
    <Section heading="1. Platform Nature — We Are Not Your Employer or Contractor">
      <P>HomeCrew is an <strong>online marketplace and technology platform</strong> that enables customers to post home-service jobs and service providers to bid on or accept them. HomeCrew is <strong>not a party to any contract</strong> between a customer and a service provider. We do not employ, supervise, or direct any service provider. Service providers are independent professionals who decide their own working methods.</P>
      <P>By using this platform, you acknowledge that HomeCrew is solely a platform intermediary and that any arrangement for services is between you and the other party directly.</P>
    </Section>

    <Section heading="2. Eligibility">
      <P>You must be at least 18 years old and legally capable of entering binding contracts under Indian law to use this platform. By registering, you confirm these conditions are met.</P>
    </Section>

    <Section heading="3. Payments — Direct Between Customer and Provider">
      <P>All payment for the actual home service work is made <strong>directly between the customer and the service provider</strong>, outside the HomeCrew platform. HomeCrew does not process service payments, does not hold funds in escrow, and is not responsible for any payment disputes between users.</P>
      <P>The only fees collected by HomeCrew are:</P>
      <Ul items={[
        <><strong>Emergency dispatch platform fee:</strong> A fee charged to the customer at the time of posting an emergency service request. This fee is set by the platform administrator through the admin console and may change over time. The current fee amount is displayed clearly before the customer confirms an emergency post. Existing emergency posts are not retroactively affected by fee changes.</>,
      ]} />
    </Section>

    <Section heading="4. Pricing Rules">
      <Ul items={[
        <><strong>Ordinary jobs:</strong> Customers set an offered price and a minimum acceptable price. Providers may negotiate. The final agreed amount is paid directly.</>,
        <><strong>Emergency jobs:</strong> The offered price carries a mandatory <strong>+30% emergency service surcharge</strong> applied automatically to the base price. This surcharge compensates for immediate availability requirements.</>,
        <><strong>Base prices by service category</strong> are set by the platform administrator and are indicative minimums, not fixed charges.</>,
      ]} />
    </Section>

    <Section heading="5. Bidding Rules — Emergency Jobs">
      <Ul items={[
        <>Providers must meet <strong>all five eligibility criteria</strong> to participate in emergency bidding: minimum 35 coin balance, minimum 3 completed reviews, average customer rating of at least 3.5 stars, no active bid-ban, and no confirmed job overlapping the requested time slot (including the mandatory 8-hour rest gap).</>,
        <>The provider who places the <strong>highest coin bid wins</strong> the job when the customer accepts. Coins are deducted only from the winning bidder. Losing bids are fully refunded.</>,
        <>Customers choose which bid to accept; there is no obligation to accept the highest bidder.</>,
        <>Bids are binding once placed. Withdrawing a bid after placement incurs penalties (see Section 6).</>,
      ]} />
    </Section>

    <Section heading="6. Coins — Rules and Limitations">
      <Ul items={[
        <>Coins are a <strong>platform rewards and bidding mechanism only</strong>. They have no cash value, cannot be transferred between providers, cannot be sold, and cannot be redeemed for money.</>,
        <>Coins are earned by completing jobs successfully (20 base coins + star rating bonus up to 5 additional coins). An onboarding grant of 35 coins is given upon first approval.</>,
        <>Coins are deducted only when a provider wins and is assigned an emergency job. If a bid is lost, coins are refunded immediately.</>,
        <><strong>Withdrawal penalty:</strong> If a provider withdraws from an accepted emergency job before the job starts, 50% of the winning bid coins are forfeited permanently, the provider's average rating is reduced by 0.1 stars, and the provider is suspended from emergency bidding for 3 days.</>,
        <><strong>No-show penalty:</strong> If a provider does not appear for a confirmed job, the same 50% coin forfeiture, 0.1 star rating reduction, and 3-day emergency bid suspension apply. A dispute may also be opened by the customer.</>,
      ]} />
    </Section>

    <Section heading="7. Reviews — Compulsory and Blind">
      <P>After every completed job, both the customer and the service provider must submit a review before either party can post a new job or bid on a new job. Reviews are <strong>blind</strong>: neither party can see the other's review until both have submitted, or until 7 days have elapsed. This prevents strategic or retaliatory rating.</P>
    </Section>

    <Section heading="8. Auto-Completion Timers">
      <P>If a provider marks a job complete but the customer does not respond within <strong>48 hours</strong>, the job is automatically marked as completed. If the customer marks complete but the provider does not respond within <strong>24 hours</strong>, the same applies. Auto-completion triggers the review window and coin reward.</P>
    </Section>

    <Section heading="9. Chat Rules">
      <P>The in-app job chat is provided strictly for communication about the active job. The following are prohibited:</P>
      <Ul items={[
        <>Sharing personal phone numbers, email addresses, or links to external platforms to solicit off-platform business.</>,
        <>Abusive, threatening, discriminatory, or obscene language.</>,
        <>Fraudulent communications or false representations.</>,
      ]} />
      <P>Violations may result in immediate account suspension. Chat messages may be reviewed by our operations team in the context of disputes.</P>
    </Section>

    <Section heading="10. Account Suspension and Termination">
      <P>HomeCrew reserves the right to suspend or terminate any account, without prior notice, for reasons including but not limited to: fraudulent activity, repeated no-shows, abuse of the bidding system, repeated policy violations, or any conduct harmful to other users. Suspended providers lose access to bidding. Coins in suspended accounts are frozen and non-refundable.</P>
    </Section>

    <Section heading="11. Dispute Handling">
      <P>Disputes between customers and providers are submitted through the platform and reviewed by our operations team. HomeCrew's decision is <strong>final within the platform</strong> (for example, whether to reverse a coin penalty or apply a ban). However, HomeCrew's dispute resolution does not constitute legal arbitration and does not prevent either party from seeking legal remedies independently.</P>
    </Section>

    <Section heading="12. Limitation of Liability">
      <P>To the fullest extent permitted by applicable law, HomeCrew's aggregate liability to you for any claim arising from your use of the platform shall not exceed <strong>the total emergency dispatch fees, if any, paid by you to HomeCrew in the 12 months preceding the claim</strong>. HomeCrew is not liable for: the quality, safety, or legality of any service performed; the ability of a provider to perform a service; personal injury, property damage, or economic loss arising from a service; or any indirect, consequential, or punitive damages.</P>
    </Section>

    <Section heading="13. Governing Law">
      <P>These Terms are governed by the laws of <strong>India</strong>. Any dispute arising from these Terms or your use of the platform shall be subject to the exclusive jurisdiction of the courts at <strong>Coimbatore, Tamil Nadu</strong>.</P>
    </Section>

    <Section heading="14. Changes to These Terms">
      <P>We may update these Terms from time to time. Material changes will be communicated by posting a notice within the app for at least 14 days before the change takes effect. Your continued use of the platform after the effective date of the update constitutes acceptance. If you do not agree, you must stop using the platform and may request account deletion.</P>
    </Section>

    <Section heading="15. Contact">
      <P>For any questions about these Terms, contact us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</P>
    </Section>
  </>
);

const TermsTa: React.FC = () => (
  <>
    <Section heading="1. தளத்தின் தன்மை — நாங்கள் உங்கள் முதலாளி அல்ல">
      <P>ஹோம்க்ரூ என்பது வீட்டு சேவை வேலைகளை பதிவிட வாடிக்கையாளர்களையும் அதில் ஏலம் போட வழங்குநர்களையும் இணைக்கும் ஒரு <strong>தொழில்நுட்ப சந்தை தளம்</strong> மட்டுமே. ஹோம்க்ரூ வாடிக்கையாளருக்கும் வழங்குநருக்கும் இடையிலான ஒப்பந்தத்தில் <strong>தரப்பினர் இல்லை.</strong> வழங்குநர்கள் சுயாதீன தொழில் வல்லுநர்கள்.</P>
    </Section>

    <Section heading="2. தகுதி">
      <P>இந்த தளத்தை பயன்படுத்த குறைந்தது 18 வயது ஆகியிருக்க வேண்டும். பதிவு செய்வதன் மூலம் இதை உறுதிப்படுத்துகிறீர்கள்.</P>
    </Section>

    <Section heading="3. கட்டணம் — வாடிக்கையாளருக்கும் வழங்குநருக்கும் நேரடியாக">
      <P>வீட்டு சேவை பணிக்கான அனைத்து கட்டணமும் வாடிக்கையாளருக்கும் வழங்குநருக்கும் <strong>நேரடியாக</strong> செலுத்தப்படும். ஹோம்க்ரூ சேவை கட்டணங்களை செயலாக்குவதில்லை. நிர்வாகியால் அமைக்கப்பட்ட அவசர சேவை தள கட்டணம் மட்டும் ஹோம்க்ரூவால் வசூலிக்கப்படும்.</P>
    </Section>

    <Section heading="4. விலை விதிகள்">
      <Ul items={[
        <><strong>வழக்கமான பணிகள்:</strong> வாடிக்கையாளர் விலையை நிர்ணயிக்கிறார்.</>,
        <><strong>அவசர பணிகள்:</strong> அடிப்படை விலையில் <strong>+30% கட்டாய அவசர கட்டணம்</strong> சேர்க்கப்படும்.</>,
      ]} />
    </Section>

    <Section heading="5. ஏல விதிகள் — அவசர பணிகள்">
      <Ul items={[
        <>ஏலம் போட குறைந்தது 35 நாணயங்கள், 3 மதிப்பீடுகள், 3.5 நட்சத்திர மதிப்பீடு, ஏல தடை இல்லாமல், அட்டவணை மோதல் இல்லாமல் இருக்க வேண்டும்.</>,
        <><strong>அதிக நாணயங்கள் போட்ட வழங்குநர் வெல்கிறார்.</strong> தோல்வியடைந்த ஏலங்களுக்கு நாணயங்கள் திரும்பப்பெறப்படும்.</>,
      ]} />
    </Section>

    <Section heading="6. நாணயங்கள் — விதிகள் மற்றும் வரம்புகள்">
      <Ul items={[
        <>நாணயங்களுக்கு <strong>பணம் மதிப்பு இல்லை</strong>, மாற்ற முடியாது, விற்க முடியாது.</>,
        <><strong>திரும்பப்பெறல் தண்டனை:</strong> ஏற்றுக்கொள்ளப்பட்ட பணியிலிருந்து திரும்பிச் சென்றால் — 50% நாணயம் இழப்பு, 0.1 மதிப்பீடு குறைப்பு, 3 நாள் ஏல தடை.</>,
        <><strong>வரவில்லை தண்டனை:</strong> அதே விதிகள் பொருந்தும்.</>,
      ]} />
    </Section>

    <Section heading="7. மதிப்பீடுகள் — கட்டாயம் மற்றும் மறைக்கப்பட்டவை">
      <P>ஒவ்வொரு பணி முடிந்த பிறகும் இரு தரப்பும் மதிப்பீடு சமர்ப்பிக்க வேண்டும். இல்லாவிட்டால் புதிய பணி பதிவிட அல்லது ஏலம் போட முடியாது. மதிப்பீடுகள் இரண்டும் சமர்ப்பிக்கப்படும் வரை மறைக்கப்பட்டிருக்கும்.</P>
    </Section>

    <Section heading="8. தானியங்கி நிறைவு நேரங்கள்">
      <P>வழங்குநர் நிறைவாக குறித்த பிறகு வாடிக்கையாளர் <strong>48 மணி நேரத்திற்குள்</strong> பதிலளிக்காவிட்டால் தானாக நிறைவாகும். வாடிக்கையாளர் குறித்த பிறகு வழங்குநர் <strong>24 மணி நேரத்திற்குள்</strong> பதிலளிக்காவிட்டால் தானாக நிறைவாகும்.</P>
    </Section>

    <Section heading="9. அரட்டை விதிகள்">
      <P>தொலைபேசி எண்கள், வெளி இணைப்புகள் அனுப்புவது, அல்லது துஷ்பிரயோக செய்திகள் அனுப்புவது தடைசெய்யப்பட்டுள்ளது. மீறல்கள் கணக்கு இடைநிறுத்தத்திற்கு வழிவகுக்கலாம்.</P>
    </Section>

    <Section heading="10. கணக்கு இடைநிறுத்தம்">
      <P>மோசடி, திரும்பப்பட்ட வரவில்லை, கொள்கை மீறல்கள் ஆகியவற்றிற்கு ஹோம்க்ரூ எந்த கணக்கையும் முன்னறிவிப்பின்றி இடைநிறுத்தலாம்.</P>
    </Section>

    <Section heading="11. தகராறு தீர்வு">
      <P>தகராறுகள் நிர்வாக குழுவால் மதிப்பாய்வு செய்யப்படும். ஹோம்க்ரூவின் தீர்வு தளத்திற்குள் இறுதியானது, ஆனால் வெளி சட்ட நடவடிக்கைகளை தடுக்காது.</P>
    </Section>

    <Section heading="12. பொறுப்பு வரம்பு">
      <P>ஹோம்க்ரூவின் அதிகபட்ச பொறுப்பு கடந்த 12 மாதங்களில் நீங்கள் செலுத்திய அவசர கட்டணத்தை தாண்டாது. சேவை தரம், சொத்து சேதம், மறைமுக இழப்புகள் ஆகியவற்றுக்கு நாங்கள் பொறுப்பாளிகள் இல்லை.</P>
    </Section>

    <Section heading="13. ஆளும் சட்டம்">
      <P>இந்த விதிமுறைகள் <strong>இந்திய சட்டங்களால்</strong> நிர்வகிக்கப்படுகின்றன. எந்தவொரு தகராறும் <strong>கோயம்புத்தூர், தமிழ்நாடு</strong> நீதிமன்றங்களில் தீர்க்கப்படும்.</P>
    </Section>

    <Section heading="14. விதிமுறை மாற்றங்கள்">
      <P>முக்கிய மாற்றங்களை திட்டமிடப்பட்ட நாளுக்கு குறைந்தது 14 நாட்கள் முன்பு பயன்பாட்டில் அறிவிப்பு வழியாக தெரிவிப்போம்.</P>
    </Section>
  </>
);

// ══════════════════════════════════════════════════════════════════════════════
// EXPORTED PAGE COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════

export const PrivacyPolicyPage: React.FC<{ defaultLang?: 'en' | 'ta' }> = ({ defaultLang = 'en' }) => {
  const [lang, setLang] = useState<'en' | 'ta'>(defaultLang);
  return (
    <LegalShell
      title="Privacy Policy"
      titleTa="தனியுரிமைக் கொள்கை"
      lang={lang}
      onChangeLang={setLang}
    >
      {lang === 'en' ? <PrivacyEn /> : <PrivacyTa />}
    </LegalShell>
  );
};

export const TermsPage: React.FC<{ defaultLang?: 'en' | 'ta' }> = ({ defaultLang = 'en' }) => {
  const [lang, setLang] = useState<'en' | 'ta'>(defaultLang);
  return (
    <LegalShell
      title="Terms and Conditions"
      titleTa="விதிமுறைகள் மற்றும் நிபந்தனைகள்"
      lang={lang}
      onChangeLang={setLang}
    >
      {lang === 'en' ? <TermsEn /> : <TermsTa />}
    </LegalShell>
  );
};

// ──────────────────────────────────────────────────────────────────────────────
// App Footer with legal links
// ──────────────────────────────────────────────────────────────────────────────

export const AppFooter: React.FC<{
  onPrivacy: () => void;
  onTerms: () => void;
  lang?: 'en' | 'ta';
}> = ({ onPrivacy, onTerms, lang = 'en' }) => (
  <footer style={{
    borderTop: '2px solid var(--color-border, #e2e8f0)',
    padding: '20px 24px',
    textAlign: 'center',
    backgroundColor: 'var(--bg-sand, #fdf8f3)',
    marginTop: 'auto',
  }}>
    <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', flexWrap: 'wrap', marginBottom: '8px' }}>
      <button
        onClick={onPrivacy}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-teal-dark, #0e7490)', fontWeight: 700, fontSize: '0.82rem', textDecoration: 'underline' }}
      >
        {lang === 'ta' ? 'தனியுரிமைக் கொள்கை' : 'Privacy Policy'}
      </button>
      <button
        onClick={onTerms}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-teal-dark, #0e7490)', fontWeight: 700, fontSize: '0.82rem', textDecoration: 'underline' }}
      >
        {lang === 'ta' ? 'விதிமுறைகள்' : 'Terms & Conditions'}
      </button>
      <a
        href="mailto:legal@homecrew.in"
        style={{ color: 'var(--color-teal-dark, #0e7490)', fontWeight: 700, fontSize: '0.82rem', textDecoration: 'underline' }}
      >
        {lang === 'ta' ? 'தொடர்புகொள்ள' : 'Contact'}
      </a>
    </div>
    <p style={{ fontSize: '0.74rem', color: 'var(--color-muted, #64748b)', margin: 0 }}>
      &copy; {new Date().getFullYear()} HomeCrew. {lang === 'ta' ? 'அனைத்து உரிமைகளும் பாதுகாக்கப்பட்டவை.' : 'All rights reserved.'}
    </p>
  </footer>
);
