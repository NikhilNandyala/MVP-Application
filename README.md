# MDX Blog Builder

An MVP Next.js application for converting raw text into structured MDX blog posts with auto-tagging capabilities, specifically designed for Azure content.

## Features

- **Text to MDX Conversion**: Paste raw text and convert it to structured MDX with proper front matter
- **Auto-tagging**: Automatically detect and tag Azure-related keywords
- **Validation**: Validate MDX structure and format
- **Export**: Copy or download generated MDX files
- **Azure App Service Ready**: Configured for deployment on Azure App Service with Node 22 LTS

## Tech Stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- Node.js 22 LTS

## Getting Started

### Prerequisites

- Node.js 22 or higher
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Building for Production

```bash
# Build the application
npm run build

# Start production server
npm start
```

## Deployment to Azure App Service

### Prerequisites

1. Azure account
2. GitHub repository
3. Azure App Service (Linux) with Node 22 LTS runtime

### Steps

1. **Create Azure Web App**:
   - Go to Azure Portal
   - Create new App Service (Linux)
   - Select Node 22 LTS runtime
   - Configure deployment source (GitHub)

2. **Configure GitHub Deployment**:
   - In Azure Portal, go to Deployment Center
   - Select GitHub as source
   - Authorize Azure to access your GitHub repository
   - Select repository and branch
   - Azure will create a GitHub Actions workflow automatically

3. **Environment Configuration**:
   - No environment variables required for MVP
   - Ensure `PORT` environment variable is available (automatically set by Azure)

4. **Deploy**:
   - Push code to GitHub
   - GitHub Actions will automatically build and deploy to Azure

## Project Structure

```
├── app/
│   ├── api/
│   │   └── convert/
│   │       └── route.ts          # API endpoint for text conversion
│   ├── globals.css                # Global styles
│   ├── layout.tsx                 # Root layout
│   └── page.tsx                   # Main UI page
├── lib/
│   └── mdx/
│       ├── tagger.ts              # Auto-tagging logic
│       ├── validator.ts           # MDX validation
│       └── slug.ts                # Filename generation
├── next.config.ts                 # Next.js configuration
├── tailwind.config.ts             # Tailwind configuration
├── tsconfig.json                  # TypeScript configuration
└── package.json                   # Dependencies and scripts
```

## Usage

1. **Enter Content**: Paste your raw text in the left textarea
2. **Configure** (optional): Set title, category, and severity
3. **Convert**: Click "Convert" to generate MDX
4. **Review**: Check auto-detected tags and warnings
5. **Validate**: Click "Validate" to check MDX structure
6. **Export**: Use "Copy" or "Download" to save your MDX

## Auto-tagging Keywords

The application automatically detects and tags content based on Azure keywords:

- Front Door, AFD → Azure, Front Door, WAF
- WAF, OWASP → Azure, WAF, Security
- Storage Account, Blob, SAS → Azure, Storage
- Private Endpoint, Private Link → Azure, Networking, Private Link
- NSG, UDR, Route Table → Azure, Networking
- ExpressRoute, BGP → Azure, Networking, ExpressRoute
- Application Gateway → Azure, Application Gateway
- Key Vault → Azure, Key Vault, Security
- And many more...

## License

MIT