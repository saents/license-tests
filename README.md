# ՎԻՎ Քննություն — Driving Theory Exam Trainer

Fast, offline-capable quiz app for the Armenian driver's license theory exam
(categories **A·B·C** and **D·T**), in **Armenian, Russian and English**.

Questions, answers and images were extracted from the official question bank at
<https://roadpolice.am/hy/viv-exam>.

| Set   | Groups | Questions | With images |
|-------|--------|-----------|-------------|
| A·B·C | 10     | 1050      | 715         |
| D·T   | 10     | 1380      | 796         |

## Features
- **Exam simulation**: 20 questions (2 from each group), 30-minute timer, pass with at most 2 mistakes, then a review of your errors
- **Practice by group**: instant feedback, resumes where you stopped, optional shuffle
- **Marathon**: all questions, wrong ones first, then unanswered, then the rest
- **My mistakes / Bookmarks**: drill what you got wrong or saved
- Progress, stats and exam history are stored in your browser (localStorage)
- Switch language mid-quiz without losing your place
- Keyboard: `1–5` answer · `Enter`/`→` next · `←` back · `B` bookmark · `Esc` home
- Dark/light theme follows the system; works on mobile; installable PWA with offline cache

## Project layout
```
app/                 Vite + Preact + TypeScript web app
  public/data/       extracted questions: <set>.<lang>.json, img/<hash>.webp
  src/               UI code
tools/               extraction scripts (Node)
  download.sh        downloads the 60 source PDFs into raw/pdf
  extract.mjs        PDF -> JSON + WebP images
  finalize.mjs       adds image dimensions
.github/workflows/   GitHub Pages deployment
raw/                 source PDFs (git-ignored)
```

## Develop
```bash
cd app
npm install
npm run dev
```

## Rebuild the data (only if roadpolice.am updates the PDFs)
```bash
bash tools/download.sh
cd tools && npm install
node extract.mjs ../raw/pdf ../app/public/data
node finalize.mjs ../app/public/data
```

## Publish on GitHub Pages
1. Create a GitHub repository and push this folder to the `main` branch.
2. In the repository, open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Every push to `main` builds and deploys to `https://<user>.github.io/<repo>/`.
