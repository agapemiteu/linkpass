# LinkPass

**Safe spending for every child.** Their freedom. Your rules.

Children find things they want on Instagram, TikTok and WhatsApp. LinkPass lets them buy safely, inside rules their parent sets once.

**Try it:** https://linkpass-iota.vercel.app (preview with a pretend bank)

## How it works

1. **The parent sets the rules once:** trusted shops, categories, spending limits and an allowance.
2. **The child pastes a product link.** AI finds the product and checks the seller.
3. **Inside the rules, Access Bank pays the seller.** Outside the rules, the parent is asked first.
4. **Fake shop?** LinkPass blocks it and offers the same item from a verified seller.

Nothing is marked paid until the bank confirms it.

## Built with

- Next.js and TypeScript
- Access (Xtradot) bank sandbox for real test payments
- Huawei AI for reading product links
- Cloudflare R2 to keep records safe

## Run it yourself

```bash
npm install
npm run dev
```

Open http://localhost:3000. It uses a pretend bank, so no keys are needed.

## Team

Team Pak, built for the Access Youth Tech Forge 2026 (Payments and Financial Infrastructure).

- Agape Justice Miteu
- Michael Omoniyi
