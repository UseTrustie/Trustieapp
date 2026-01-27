# Trust Check

**Verify AI claims against real sources. See which AIs are most reliable.**

## What It Does

1. Select which AI generated the output (ChatGPT, Claude, Gemini, etc.)
2. Paste the AI output
3. Get each claim verified against real sources
4. See: Supported, Contradicted, or Unverified — with actual links
5. View rankings of which AIs are most reliable based on real user data

**You see the evidence. You decide what to trust.**

## Features

- **Claim Verification**: Extracts factual claims and searches for real sources
- **AI Rankings**: See which AI tools are most/least reliable based on user verifications
- **Source Links**: Every claim shows actual sources you can click and verify
- **Data Collection**: Builds a database of AI reliability from real usage

## Why This Exists

AI sounds confident even when it's wrong. You need:
1. A way to check claims against real sources
2. Data on which AIs are more reliable for different tasks

## Quick Start

### 1. Get an Anthropic API Key

Go to [console.anthropic.com](https://console.anthropic.com) and create an API key.

### 2. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/trust-check.git
cd trust-check
npm install
```

### 3. Add your API key

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deploy to Vercel (Free)

1. Push to GitHub
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your repo
4. Add environment variable: `ANTHROPIC_API_KEY`
5. Deploy

**Note**: The simple file-based storage works for testing. For production, add Supabase or another database for persistent rankings data.

## How Rankings Work

Every time someone verifies an AI output:
- The claim results are tracked (supported/contradicted/unverified)
- This data builds per-AI reliability scores
- Rankings show which AIs have the best track record

More verifications = more accurate rankings.

## Tech Stack

- Next.js 14
- Tailwind CSS
- Anthropic Claude API (with web search)
- Vercel (hosting)

## Roadmap

- [ ] Persistent database (Supabase)
- [ ] Rankings by category (coding, health, business, etc.)
- [ ] Embed widget for other sites
- [ ] API access for developers
- [ ] Enterprise dashboard

## Cost

~$0.01-0.05 per verification depending on claim count.

## License

MIT

---

Built because confidence isn't the same as correctness.
