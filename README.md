# Photo Gallery - abdul.no

A minimal, VSCO-inspired photo gallery built with Next.js, Tailwind CSS, and Cloudinary.

## Tech Stack

- **Next.js 14** (App Router)
- **Tailwind CSS** (Dark mode: #050505)
- **Cloudinary** (Image hosting & optimization)
- **Netlify** (Deployment)

## Setup

### 1. Clone & Install

```bash
git clone <repo-url>
cd gallery
npm install
```

### 2. Cloudinary Configuration

1. Go to [cloudinary.com](https://cloudinary.com) and sign in
2. From your Dashboard, copy:
   - **Cloud Name**
   - **API Key**
   - **API Secret**

3. Create an **Upload Preset** (required for the upload widget):
   - Go to **Settings → Upload**
   - Scroll to **Upload presets** → Click **Add upload preset**
   - Set:
     - **Preset name**: `gallery_upload`
     - **Signing Mode**: `Unsigned`
     - **Folder**: `gallery`
   - Save

### 3. Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=gallery_upload
ADMIN_PASSWORD=your_secure_password
```

### 4. Run Locally

```bash
npm run dev
```

Visit:
- Gallery: http://localhost:3000
- Admin: http://localhost:3000/admin

## Netlify Deployment

### Environment Variables

In Netlify Dashboard → Site Settings → Environment Variables, add:

| Variable | Value |
|----------|-------|
| `CLOUDINARY_CLOUD_NAME` | your_cloud_name |
| `CLOUDINARY_API_KEY` | your_api_key |
| `CLOUDINARY_API_SECRET` | your_api_secret |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | your_cloud_name |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | gallery_upload |
| `ADMIN_PASSWORD` | your_secure_password |

### Custom Domain

1. In Netlify → Domain Settings → Add custom domain
2. Add `abdul.no`
3. Update your DNS to point to Netlify

## Project Structure

```
├── app/
│   ├── page.tsx          # Public gallery feed
│   ├── admin/page.tsx    # Password-protected upload portal
│   ├── api/auth/route.ts # Auth API endpoint
│   ├── layout.tsx        # Root layout with dark theme
│   └── globals.css       # Global styles
├── components/
│   └── Gallery.tsx       # Masonry gallery component
├── lib/
│   └── cloudinary.ts     # Cloudinary SDK configuration
├── netlify.toml          # Netlify deployment config
└── .env.local            # Environment variables (not committed)
```
