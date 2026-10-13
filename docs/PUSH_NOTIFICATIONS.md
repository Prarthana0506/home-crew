# Firebase Cloud Messaging & Web Push Architecture

## 1. Overview
UrbanClap implements completely free web push notifications using **Firebase Cloud Messaging (FCM) HTTP v1** and standard **W3C Push API / Service Workers** across all three progressive web applications (PWAs):
- **Customer App** (`apps/customer`)
- **Partner / Provider Portal** (`apps/provider`)
- **Operations Console / Admin** (`apps/admin`)

Every notification event is paired with an in-app fallback inbox stored in PostgreSQL (`public.notifications`) and updated in real time via Supabase Realtime. No paid SMS gateways are used.

---

## 2. iOS Limitation (Apple Web Push Requirements)

> [!IMPORTANT]
> **iOS Web Push Limitation:**
> On Apple devices running iOS / iPadOS (Safari 16.4+), Web Push notifications are **disabled** inside normal browser tabs. Push notifications only function after the user installs the PWA to their device home screen:
> 
> 1. Open the PWA in **Safari**.
> 2. Tap the **Share** button (box with an arrow pointing up).
> 3. Select **Add to Home Screen**.
> 4. Launch the app from the Home Screen icon.
> 
> The UI includes proactive detection via `isIOS()` and `!isIOSStandalone()`, warning iOS users and guiding them to complete the "Add to Home Screen" step before prompting for notification permissions.

---

## 3. Database Schema & State

### `public.device_tokens`
Stores FCM registration tokens per user:
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key to `auth.users`)
- `token` (TEXT, unique FCM device token)
- `platform` (TEXT: `'web'`, `'ios'`, `'android'`)
- `created_at`, `updated_at` (TIMESTAMPTZ)

### `public.notifications`
Stores notification records, delivery status, and open tracking:
- `id` (UUID, Primary Key)
- `user_id` (UUID, recipient)
- `type` (TEXT, event type name)
- `title` (TEXT, localized title)
- `body` (TEXT, localized message body)
- `data` (JSONB, action URLs, booking IDs, images, extra parameters)
- `read` (BOOLEAN, in-app read status)
- `opened_at` (TIMESTAMPTZ, tracks when the user opened the notification)
- `priority` (TEXT: `'emergency'`, `'high'`, `'normal'`)
- `push_delivered` (BOOLEAN, whether delivered immediately or queued due to quiet hours)
- `created_at` (TIMESTAMPTZ)

---

## 4. Supported Events & Templates (English & Tamil)

The system supports 12 standardized event types with automatic localization in **English** and **Tamil**:

| Event Key | Priority | Default English Template | Default Tamil Template | Action Target / Screen |
| :--- | :--- | :--- | :--- | :--- |
| `bid_invite` | Emergency | **Emergency Bid Invite: {job_title}**<br>New emergency request broadcasted! {coins} coins required to bid. | **அவசர ஏல அழைப்பு: {job_title}**<br>புதிய அவசர சேவை வந்துள்ளது! ஏலம் எடுக்க {coins} நாணயங்கள் தேவை. | `?tab=bidding&req={request_id}` (Actions: *Interested*, *Not Interested*) |
| `bid_opened` | Emergency | **Emergency Bidding Open: {job_title}**<br>Bidding has started. Place your coin bid now. | **அவசர ஏலம் தொடங்கியது: {job_title}**<br>ஏலம் துவங்கியுள்ளது. உங்கள் நாணய ஏலத்தை பதிவு செய்யவும். | `?tab=bidding&req={request_id}` |
| `outbid` | High | **You have been outbid!**<br>Current highest bid is {coins} coins. Bid higher to win this booking. | **உங்கள் ஏலம் முறியடிக்கப்பட்டது!**<br>தற்போதைய அதிகபட்ச ஏலம் {coins} நாணயங்கள். வெல்ல மீண்டும் ஏலம் எடுக்கவும். | `?tab=bidding&req={request_id}` |
| `bid_closing_soon` | High | **Bidding closing in 5 minutes!**<br>Final chance to place a winning coin bid for {job_title}. | **ஏலம் 5 நிமிடங்களில் முடிகிறது!**<br>{job_title} பணிக்கான இறுதி ஏல வாய்ப்பு. | `?tab=bidding&req={request_id}` |
| `bid_won` | Emergency | **Congratulations! You won the job.**<br>You placed the winning bid for {job_title}. Proceed to contact customer. | **வாழ்த்துக்கள்! ஏலத்தில் வெற்றி பெற்றீர்கள்.**<br>{job_title} பணிக்கான உங்கள் ஏலம் ஏற்கப்பட்டது. வாடிக்கையாளரை தொடர்பு கொள்ளவும். | `?tab=calendar&req={request_id}` |
| `job_accepted` | Normal | **Booking Accepted!**<br>A qualified service provider has accepted your booking for {job_title}. | **முன்பதிவு ஏற்கப்பட்டது!**<br>{job_title} பணிக்கான சேவை வல்லுநர் உங்கள் முன்பதிவை ஏற்றுக்கொண்டார். | `?tab=calendar&req={request_id}` |
| `time_confirmed` | Normal | **Service Time Confirmed: {time}**<br>Both parties confirmed the appointment time. | **பணி நேரம் உறுதி செய்யப்பட்டது: {time}**<br>இரு தரப்பினரும் பணி நேரத்தை உறுதி செய்துள்ளனர். | `?tab=calendar&req={request_id}` |
| `provider_on_the_way` | High | **Provider On The Way!**<br>{provider_name} has departed and is heading to your service location. | **வல்லுநர் புறப்பட்டுவிட்டார்!**<br>{provider_name} உங்கள் முகவரிக்கு புறப்பட்டுள்ளார். | `?tab=calendar&req={request_id}` |
| `mark_complete_reminder`| Normal | **Work Order Completion Reminder**<br>Please mark {job_title} complete if service has concluded. | **பணி நிறைவு நினைவூட்டல்**<br>சேவை முடிந்திருந்தால் {job_title} பணியை நிறைவு செய்ததாக குறிக்கவும். | `?tab=calendar&req={request_id}` |
| `review_reminder` | Normal | **Share Your Service Review**<br>Your blind rating for {job_title} is now open. Rate your experience! | **மதிப்பாய்வு பகிரவும்**<br>{job_title} பணிக்கான மதிப்பாய்வு திறக்கப்பட்டுள்ளது. உங்கள் கருத்தை பகிரவும்! | `?tab=history&req={request_id}` |
| `noshow` | Emergency | **No-Show Incident Reported**<br>A no-show claim was filed for {job_title}. Please check your order details. | **வருகை தராமை புகார் பதிவு**<br>{job_title} பணிக்காக வருகை தராமை பதிவு செய்யப்பட்டுள்ளது. விவரங்களை சரிபார்க்கவும். | `?tab=history&req={request_id}` |
| `dispute_opened` | High | **Dispute Opened on Booking**<br>A dispute has been raised and escalated for review. | **சிக்கல் புகார் பதிவு செய்யப்பட்டது**<br>முன்பதிவில் புகார் பதிவு செய்யப்பட்டு ஆய்வுக்கு அனுப்பப்பட்டுள்ளது. | `?tab=disputes&req={request_id}` |

---

## 5. Quiet Hours Policy

- Configured in application settings (`public.settings`):
  - `quiet_hours_start`: `"22:00"` (10:00 PM IST)
  - `quiet_hours_end`: `"07:00"` (7:00 AM IST)
  - Timezone: Indian Standard Time (UTC+05:30)
- **Emergency Priority Events (`is_emergency = true`):**
  - Always deliver **immediately**, completely bypassing quiet hours.
- **Ordinary Events (`is_emergency = false`):**
  - If triggered during quiet hours, `push_delivered` is flagged `FALSE`, logged to the in-app inbox without triggering audible device rings or vibrations during sleep hours.

---

## 6. Service Worker Implementation (`public/sw.js`)

Each PWA includes a dedicated service worker handling:
1. `push` event:
   - Formats notification title, body, icon (`/icons/icon-192.png`), badge (`/icons/icon-192.png`), and image banner.
   - Sets vibration pattern (`[200, 100, 200]` for emergency alerts).
   - Attaches interactive action buttons for emergency bid invites:
     - Button 1: **Interested** (`action: 'interested'`)
     - Button 2: **Not interested** (`action: 'not_interested'`)
2. `notificationclick` event:
   - Dismisses notification.
   - Appends `?notif_id={id}` query parameter to log open status.
   - Focuses existing browser window or opens the target screen (`client.openWindow(targetUrl)`).
   - In Partner PWA, automatically triggers interest response if "Interested" or "Not interested" action button was pressed.

---

## 7. Supabase Edge Function (`supabase/functions/push-notifications`)

The edge function `push-notifications` handles:
- **Webhook invocations** from database triggers on `public.notifications` table.
- **Direct RPC calls** with payload:
  ```json
  {
    "user": "USER_UUID",
    "template": "bid_invite",
    "data": { "job_title": "Pipe Leak", "coins": 35 },
    "is_emergency": true
  }