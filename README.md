# MyAIworker.online

AI Workers for Small Business — voice + chat AI receptionists, built and deployed by [SomeTechDude.com](https://sometechdude.com)

---

## Deploy to GitHub Pages (5 Steps)

### 1. Upload these files to your `MyAIworker` repo

Drag and drop everything into the repo root on GitHub.com, or use Git:

```bash
git clone https://github.com/YOURUSERNAME/MyAIworker.git
cd MyAIworker
# copy all files here
git add .
git commit -m "Initial site launch"
git push
```

### 2. Enable GitHub Pages

- Go to your repo → **Settings** → **Pages**
- Source: **Deploy from a branch**
- Branch: **main** → **/ (root)**
- Click Save
- Your site will be live at `https://YOURUSERNAME.github.io/MyAIworker/` in ~2 minutes

### 3. Point your domain (myaiworker.online)

In your domain registrar (GoDaddy, Namecheap, etc.), add these DNS records:

| Type  | Name | Value                  |
|-------|------|------------------------|
| A     | @    | 185.199.108.153        |
| A     | @    | 185.199.109.153        |
| A     | @    | 185.199.110.153        |
| A     | @    | 185.199.111.153        |
| CNAME | www  | YOURUSERNAME.github.io |

Then in GitHub Pages settings, add `myaiworker.online` as a custom domain.

---

## Set Up Formspree (Onboarding Form)

1. Go to [formspree.io](https://formspree.io) and create a free account
2. Create a new form — set the destination email to `sometechdude76@gmail.com`
3. In form settings, **enable file uploads**
4. Copy your Form ID (looks like `xpzvqkla`)
5. Open `onboard.html` and replace `YOUR_FORMSPREE_ID` with your actual ID:

```html
action="https://formspree.io/f/xpzvqkla"
```

---

## Set Up Stripe Redirects

After each purchase in Stripe, set the **Success URL** to:

```
https://myaiworker.online/onboard.html
```

To do this in Stripe:
- Dashboard → **Payment Links** (or Products)
- Edit your payment link → **After payment** → set redirect URL to the above

---

## Add Your Stripe Buy Links

Open `index.html` and find these 3 anchor tags — replace `#placeholder` with your real Stripe Payment Link URLs:

```html
<!-- Voice Chat Setup -->
<a href="#buy-setup-placeholder" ...>

<!-- AI Receptionist -->  
<a href="#buy-receptionist-placeholder" ...>

<!-- Busy Business AI -->
<a href="#buy-busybiz-placeholder" ...>
```

---

## Add Your API Key to the Bot

The widget currently asks visitors for their own API key (demo mode).

For production, you have two options:

**Option A (Quick):** Hardcode your key in `js/bot.js`:
```js
// Find this line:
let apiKey = '';
// Change to:
let apiKey = 'sk-ant-YOUR-KEY-HERE';
// Then remove the setup screen from index.html (#aiw-setup section)
```
⚠️ Only do this if your site has no sensitive data — the key will be visible in source.

**Option B (Secure — Recommended):** Set up a Cloudflare Worker as a proxy (free tier). This hides your API key server-side. Ask for setup help at $95/hr.

---

## File Structure

```
MyAIworker/
├── index.html          ← Main sales page
├── onboard.html        ← Post-payment onboarding form
├── css/
│   ├── style.css       ← Main styles, variables, typography
│   ├── pricing.css     ← Pricing cards
│   ├── widget.css      ← Chat/voice widget
│   └── onboard.css     ← Onboarding form
├── js/
│   └── bot.js          ← AI chat + voice logic
├── images/
│   └── (your images)
└── README.md
```

---

## Customization Checklist

- [ ] Replace `YOUR_FORMSPREE_ID` in `onboard.html`
- [ ] Replace `#buy-setup-placeholder`, `#buy-receptionist-placeholder`, `#buy-busybiz-placeholder` in `index.html` with real Stripe links
- [ ] Set Stripe success URL redirect to `https://myaiworker.online/onboard.html`
- [ ] Add your logo to `/images/` and reference it in the nav if desired
- [ ] Enable GitHub Pages
- [ ] Point `myaiworker.online` DNS to GitHub Pages
- [ ] Decide on API key strategy (hardcode vs. Cloudflare proxy)
- [ ] Test the full purchase → onboard flow end to end

---

Built by [SomeTechDude.com](https://sometechdude.com) · Powered by caffeine, stubbornness, and a little AI.
