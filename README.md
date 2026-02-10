# Trustie - Verify AI Claims with Real Sources

**No more blind trusting AI.** Paste what an AI told you. We find the facts.

## Features

### 🔍 Search with Trust Scores
- AI-powered search that prioritizes trusted sources
- Trust scores (0-100%) based on source quality
- Cross-reference indicator showing how many sources agree
- Source quality badges (High Trust, Medium Trust, Verify Manually)
- No filter bubbles - same results for everyone
- Privacy-first - we do not track your searches

### ✓ Verify AI Output
- Paste any AI response to fact-check it
- Claims marked as: Verified Truth ✓, Proven False ✗, Unconfirmed ?, Opinion ○
- Real source links you can click and verify yourself
- Source quality indicators (.edu, .gov = high trust)
- Cross-referencing shows how many sources agree

### 🏆 AI Truth Rankings
- See which AI models are most accurate based on real user verifications
- Rankings based on verified vs false claim percentages
- Updated in real-time as users verify AI outputs

### 💬 Ask Trustie
- One-step convenience mode
- Ask any question, get verified answers with sources

### 📝 User Experience
- Dark/Light/Auto mode
- Loading facts while you wait
- Copy results button
- Mobile-friendly responsive design
- Professional writing (no contractions)
- Settings modal with customization options
- Sign in/Sign up placeholders (coming soon)

## Tech Stack

- **Frontend:** Next.js 14, React 18, TypeScript, Tailwind CSS
- **AI:** Claude API (Anthropic) with web search
- **Hosting:** Vercel
- **Future:** Supabase for persistent database, Clerk for auth

## Quick Start

### 1. Clone or Download

```bash
git clone https://github.com/UseTrustie/Trustieapp.git
cd Trustieapp
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment

Create a `.env.local` file:

```
ANTHROPIC_API_KEY=your_api_key_here
```

Get your API key at: https://console.anthropic.com

### 4. Run Locally

```bash
npm run dev
```

Open http://localhost:3000

### 5. Deploy to Vercel

1. Push to GitHub
2. Go to vercel.com/new
3. Import your repository
4. Add environment variable: `ANTHROPIC_API_KEY`
5. Deploy!

## File Structure

```
trustie/
├── src/
│   ├── app/
│   │   ├── page.tsx        # Main UI component
│   │   ├── layout.tsx      # Root layout
│   │   └── globals.css     # Global styles
│   └── pages/
│       └── api/
│           ├── search.ts   # Search API with trust scoring
│           ├── verify.ts   # Verification API
│           └── rankings.ts # AI rankings API
├── package.json
├── tailwind.config.js
├── tsconfig.json
├── next.config.js
├── vercel.json
└── README.md
```

## API Endpoints

### POST /api/search
Search with trust scoring and cross-referencing.

```json
{
  "query": "your search query"
}
```

### POST /api/verify
Verify AI output against real sources.

```json
{
  "content": "AI text to verify",
  "aiSource": "ChatGPT"
}
```

### GET /api/rankings
Get AI truth rankings based on user verifications.

### POST /api/rankings
Log a new verification result.

## Roadmap

### Phase 1 (Current) ✅
- [x] Core verification functionality
- [x] Search with trust scores
- [x] AI rankings
- [x] Dark/Light mode
- [x] Mobile responsive
- [x] Settings modal
- [x] Auth UI placeholders

### Phase 2 (Next)
- [ ] Persistent database (Supabase)
- [ ] User authentication (Clerk)
- [ ] Save verification history
- [ ] Stripe payments for premium

### Phase 3 (Future)
- [ ] Browser extension
- [ ] Image/document scanning
- [ ] API access for developers
- [ ] Enterprise features

## Contributing

Feedback and contributions welcome! Open an issue or submit a PR.

## License

© 2025 Trustie. All rights reserved.

---

**Built with ❤️ to make AI more trustworthy.**
