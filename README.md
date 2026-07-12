<p align="center">
  <img src="public/brand/lujie-mark.svg" alt="LuJie CareerKit mark" width="72" />
</p>

<h1 align="center">LuJie CareerKit</h1>

<p align="center">
  <strong>An AI-powered career workspace from resume editing to offer acceptance, covering resume editing, JD matching, application tracking, mock interviews, and interview review.</strong>
</p>

<p align="center">
  English · <a href="README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs" />
  <img alt="React" src="https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white" />
  <img alt="Prisma" src="https://img.shields.io/badge/Prisma-6-2d3748?logo=prisma" />
  <img alt="SQLite" src="https://img.shields.io/badge/SQLite-local--data-044a64?logo=sqlite" />
  <img alt="Docker Image" src="https://github.com/Chozzc/Lujie-Careerkit/actions/workflows/docker-image.yml/badge.svg" />
  <img alt="License" src="https://img.shields.io/badge/license-Apache--2.0-blue" />
</p>

<p align="center">
  <img src="public/brand/lujie-cover_16x9.png" alt="LuJie CareerKit cover" width="900" />
</p>

## Overview

LuJie CareerKit is built for internships, campus recruiting, and career job searches. It brings resume editing, job-description matching, application tracking, interview practice, and AI review into one AI-powered career workspace. You can maintain different resume versions for different roles, turn a JD into sharper role-specific wording, track every application, and keep refining answers, feedback, and review notes before and after interviews.

## Online Preview

Try the live preview at [https://lujie.chozzc.dev](https://lujie.chozzc.dev).

## Preview

| **Control Center** | **Resume Library** |
| --- | --- |
| ![Control Center](public/images/01-dashboard.png) | ![Resume Library](public/images/02-resume-library.png) |
| **Resume Editor** | **JD Matching** |
| ![Resume Editor](public/images/03-resume-editor.png) | ![JD Matching](public/images/04-jd-match.png) |
| **JD-Optimized Resume** | **Interview Assistant** |
| ![JD-Optimized Resume](public/images/05-jd-optimized-resume.png) | ![Interview Assistant](public/images/06-interview-assistant.png) |
| **Mock Interview** | **AI Review** |
| ![Mock Interview](public/images/07-mock-interview.png) | ![AI Review](public/images/08-ai-review.png) |
| **Application Tracking** | **Pipeline Status** |
| ![Application Tracking](public/images/09-application-pipeline.png) | ![Pipeline Status](public/images/10-pipeline-status.png) |

## Highlights

- **Structured resume editing**: maintain multiple resume versions, edit education, internship, project, skill, and custom sections, switch templates and themes, and export PDF, PNG, or editable DOCX files.
- **AI resume optimization**: generate a general AI-optimized resume version from the editor, compare before and after, and keep refining it with the same templates.
- **JD matching**: paste a target job description and let AI reorder emphasis and improve wording without inventing experience.
- **Application tracking**: record companies, roles, sources, stages, deadlines, follow-up dates, priorities, notes, JD text, and linked resume versions.
- **Mock interviews and review**: generate interview questions from a resume and JD, save answer drafts, and create an AI review report you can revisit.
- **Data and privacy controls**: resumes, jobs, applications, interviews, and settings are stored in a local SQLite database for long-term personal use.

## Data and Privacy

- Resume content, resume versions, jobs, applications, interviews, and settings are stored in `prisma/dev.db`.
- API keys are configured from the in-app Settings page. They are encrypted before being saved to SQLite.
- `LUJIE_SETTINGS_SECRET` is the local encryption secret for saved AI keys. Use a long random value in `.env.local`.

## Quick Start

### Requirements

- Node.js 20.9 or later
- npm
- Chrome or Edge for the best browser speech experience

### Docker Deployment (Recommended)

```bash
docker run -d --name lujie-careerkit \
  -p 3000:3000 \
  -v lujie-data:/data \
  -e LUJIE_SETTINGS_SECRET="replace-with-a-long-random-string" \
  ghcr.io/chozzc/lujie-careerkit:latest
```

Open [http://localhost:3000](http://localhost:3000). SQLite data is stored in the Docker volume `lujie-data`. API keys are configured from the in-app Settings page.

`LUJIE_SETTINGS_SECRET` encrypts locally saved settings secrets. Replace the example value with a long random string.

Use `latest` to follow the newest `main` build. Use `v0.1.6` when you want to pin the current published Docker release.

### Local Development

```bash
git clone https://github.com/Chozzc/Lujie-Careerkit.git
cd Lujie-Careerkit
npm ci
```

Create a local environment file and generate an encryption secret:

```bash
cp .env.example .env.local
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Put the generated value into `.env.local` as `LUJIE_SETTINGS_SECRET`, then start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app creates the local schema and demo workflow data on first use.

## Environment Variables

```env
DATABASE_URL="file:./dev.db"
LUJIE_SETTINGS_SECRET="change-me-to-a-long-random-string"
OPENAI_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"
OPENAI_MODEL="qwen3.6-flash"
```

`OPENAI_BASE_URL` and `OPENAI_MODEL` only set first-run defaults. Configure the actual API key from the in-app Settings page.

## AI Provider Setup

1. Open the Settings page in the app.
2. Choose an OpenAI-compatible provider.
3. Enter the Base URL, model name, and API key.
4. Save and run the connection test.

AI features stay disabled until the settings are saved and the connection test succeeds.

## Release Notes

### v0.1.9

- Fixed PDF text extraction so supported PDFs can be structurally imported. With a configured non-Bailian model, extracted PDF and Word text can also be restored by AI into an editable resume; Alibaba Bailian API remains recommended for images and complex files.
- Updated some built-in provider and model candidates, and improved resume-import progress and setup guidance.

### v0.1.8

- The canvas now pans with either the left or middle mouse button; the wheel still zooms.
- Simplified application tracking by removing manual priority and showing Dashboard actions by upcoming dates.
- Updated built-in application dates and notes. AI features default to enabled, while a working provider and API key are still required.
- Removed the duplicate language setting in favor of the top-bar switcher.

### v0.1.7

- Work and project entries now support uploaded logos and common built-in icons.
- The Theme Editor now offers small, medium, and large Logo / icon sizes for supported resume previews.

### v0.1.6

- Fixed Dashboard due follow-up calculation: applied roles without a manual follow-up now use seven days after applying as the suggested follow-up date.
- Added a due label and clearer row background for overdue priority actions.
- Updated the pinned Docker image note. The fixed version tag is `ghcr.io/chozzc/lujie-careerkit:v0.1.6`.

### v0.1.5

- Added Chinese and English UI, with in-app language switching.
- Localized the main workspace shell, Dashboard, Resume Library, Settings, JD Matching, Interview Assistant, Application Tracking, and core Resume Editor controls.
- Kept user data, resume content, JD text, and locally stored records unchanged when switching languages.
- Fixed test/build configuration issues found during the multilingual UI update.

### v0.1.4

- Added Docker build support with persistent SQLite storage mounted at `/data`.
- Added `docker-compose.yml` for one-command local startup.
- Added a GitHub Actions workflow that publishes `ghcr.io/chozzc/lujie-careerkit:latest` and version-tagged images.

### v0.1.3

- Added AI resume optimization from the Resume Editor, generating a general optimized version without requiring a JD.
- Reused the JD matching result workspace for before/after comparison, optimization summaries, and visible change highlighting.
- Improved AI output compatibility and error messaging, including support for models that return a complete resume JSON directly.
- Included AI-optimized resume versions in the optimized history menu for easier review, comparison, and continued editing.

### v0.1.2

- Split the JD matching result page into shared resume comparison, summary, and highlight components.
- Removed duplicated preview-comparison code from the matching workspace to make similar result views easier to maintain.
- Adjusted the app header, resume workbench, and optimized-version records to provide a stable path for AI resume optimization.

### v0.1.1

- Unified resume-import setup prompts and local fallback messaging across the Resume Editor, JD Matching, and Interview Assistant.
- Improved external resume import with clearer button states, parsing progress, completion notice, and parsed-name based resume naming.
- Fixed Aliyun Bailian / Qwen defaults after data reset, preserved AI test status after saving unchanged settings, and diversified demo job sources.
- Fixed the setup dialog footer layout so action buttons stay inside the dialog.

### v0.1.0

- Initial open-source release with the resume library, structured resume editor, JD matching, application tracking, mock interviews, AI review, and local SQLite storage.

## FAQ

### 1. Do I need an API key to use it?

No. Resume editing and application tracking work locally. AI features such as JD matching, mock interviews, and AI review require an API key from an OpenAI-compatible provider.

### 2. Where is my data stored?

By default, data is stored on your machine in `prisma/dev.db`. This is local runtime data and should not be committed to GitHub.

### 3. How are Dashboard metrics calculated?

- **Applications**: roles that have entered the application tracking board, excluding JD matching drafts that have not been submitted.
- **Active flows**: roles still in progress, including applied, assessment, and interview stages.
- **Due follow-ups**: active flows only. LuJie first uses the manually set next follow-up date; applied roles without one use seven days after applying as the suggested follow-up date; assessment and interview roles use the current stage date.
- **Offers**: roles marked as Offer.

### 4. What is `LUJIE_SETTINGS_SECRET`?

It is the local encryption secret used to encrypt API keys saved in SQLite. If you change it, API keys already saved in the old database may no longer decrypt, so you may need to save the key again in Settings.

### 5. Can I use another model provider?

Yes. Any OpenAI-compatible provider can be configured by entering its Base URL, model name, and API key in Settings.

## Project Structure

```text
.github/workflows/      GitHub Actions workflows, including GHCR image publishing
Dockerfile              Production container image definition
docker-compose.yml      Local Docker startup with persistent SQLite volume
prisma/                 Prisma schema and local SQLite runtime data
src/app/                Next.js pages and API routes
src/components/         Workspace, resume, interview, and shared UI
src/hooks/              Browser hooks such as speech recognition
src/lib/                Repository, AI, export, parsing, and domain logic
src/stores/             Resume editor state
src/types/              Shared TypeScript declarations
public/brand/           Brand mark and cover assets
public/images/          README screenshots
third-party/            Third-party license notices
```

## Credits

The resume editor reuses and adapts design ideas and implementation concepts from [JadeAI](https://github.com/LingyiChen-AI/JadeAI). JadeAI is licensed under Apache License 2.0; a copy is kept in `third-party/JadeAI-LICENSE.txt`.

## License

LuJie CareerKit is released under the [Apache License 2.0](LICENSE). Third-party notices are listed in [NOTICE](NOTICE).
