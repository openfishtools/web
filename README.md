# OpenFishTools Web

Web platform for OpenFishTools: client-side video tools, presets, motion graphics resources, and creator suite.

---

## Directory Structure

```text
web/
├── api/                    # Express backend & database models
│   ├── index.js            # Server entrypoint
│   └── models/             # Mongoose schemas (Admin, Session)
│
├── assets/                 # Static static assets
│   ├── fonts/              # Icon fonts and typography
│   ├── icon/               # Application and plugin icons
│   ├── jszip/              # Client-side archive utility
│   ├── svg/                # Brand vectors and decorative graphics
│   └── upscale/            # Neural network worker scripts
│
├── functions/              # Cloudflare Pages edge functions
│   ├── api/                # Edge proxy and caching
│   └── realesrgan/         # AI upscaler proxy
│
├── scripts/                # Frontend application logic & build scripts
│   ├── admin.js            # Admin panel controller
│   ├── build.js            # Universal build script
│   ├── build-cf.js         # Cloudflare Pages staging bundler
│   ├── deploy-check.js     # Cache and version sync monitor
│   ├── ffmpeg-loader.js    # FFmpeg WebAssembly loader
│   ├── i18n.js             # Multilingual localization
│   ├── onnx-loader.js      # ONNX Runtime Web engine loader
│   ├── portfolio.js        # Core UI controller & event binder
│   ├── presets.js          # Preset catalog manager
│   ├── theme-init.js       # Dark/light theme initialization
│   ├── tools-bundle.js     # Fallback offline tools bundle
│   └── tools-loader.js     # Remote dynamic tools CDN loader
│
├── styles/                 # Stylesheets
│   ├── admin.css           # Admin dashboard styling
│   └── main.css            # Primary UI theme and components
│
├── userscript/             # Helper browser scripts
│   └── tiktok-cloud-disabler.user.js
│
├── admin.html              # Management dashboard interface
├── index.html              # Primary application interface
├── worker.js               # Cloudflare Worker script
├── wrangler.jsonc          # Cloudflare configuration
└── t_version.json          # Tool version registry
```

---

## Development & Build

### Running Locally

```bash
# Start backend server
npm start

# Development mode with auto-reload
npm run dev
```

### Staging for Cloudflare Pages

```bash
npm run build:cf
```

---

## License

Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International (CC BY-NC-ND 4.0).
See [LICENSE](LICENSE) for full legal terms.
