# X.com Auto Translator

A Chrome extension that automatically translates tweets on X.com (formerly Twitter) into your preferred language. Supports both text translation and image OCR translation.

## Features

- **Auto Text Translation** - Automatically detects and translates non-target-language tweets
- **Image OCR Translation** - Extracts text from images using Tesseract.js and translates it (individual tweet pages only)
- **15 Target Languages** - Japanese, English, Chinese (Simplified/Traditional), Korean, Spanish, French, German, Portuguese, Russian, Arabic, Hindi, Thai, Vietnamese, Indonesian
- **Multiple Translation Engines** - Google Translate, LibreTranslate, or Google with LibreTranslate fallback
- **Smart Detection** - Skips tweets already in your target language to avoid unnecessary API calls
- **Lightweight** - OCR only runs on individual tweet pages (`/status/`), not on the home timeline

## Installation

### From Source (Developer Mode)

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked** and select the repository folder
5. The extension icon will appear in the Chrome toolbar

## Usage

1. Click the extension icon to open the settings popup
2. **Auto-Translation** - Toggle translation on/off
3. **Translation Engine** - Choose between:
   - **Google Translate** (default) - Uses Google's free translation API
   - **LibreTranslate** - Uses a self-hosted or public LibreTranslate instance
   - **Google (Libre Fallback)** - Tries Google first, falls back to LibreTranslate on failure
4. **Translation Language** - Select your preferred target language
5. **LibreTranslate URL** - If using LibreTranslate, enter the server URL (e.g., `http://localhost:5000/translate`)

### Text Translation

Navigate to X.com. All tweets not in your target language will be automatically translated. Hover over a translated tweet to see the original text in a tooltip.

### Image OCR Translation

Open an individual tweet (click on a tweet to go to its `/status/` page). Images containing text will be processed by OCR and the translated text will appear below the image.

> **Note:** OCR is intentionally disabled on the home timeline to avoid performance issues during scrolling.

## Running LibreTranslate Locally

```bash
docker run -ti --rm -p 5000:5000 libretranslate/libretranslate
```

Then set the LibreTranslate URL to `http://localhost:5000/translate` in the extension settings.

## Tech Stack

- **Manifest V3** Chrome Extension
- **Tesseract.js v7** for browser-based OCR (bundled locally)
- **Google Translate API** (unofficial `translate.googleapis.com` endpoint)
- **LibreTranslate** as an alternative/fallback translation engine

## Project Structure

```
├── manifest.json          # Extension manifest (Manifest V3)
├── background.js          # Service worker - handles translation requests
├── translator.js          # Translation engine (Google / LibreTranslate)
├── content.js             # Content script - DOM manipulation & OCR coordination
├── popup.html/css/js      # Extension popup UI
├── ocr-sandbox.html/js    # Sandboxed iframe for Tesseract.js OCR
├── tesseract.min.js       # Tesseract.js library
├── worker.min.js          # Tesseract.js web worker
├── tesseract-core-*.js    # Tesseract WASM core (LSTM models)
└── icons/                 # Extension icons
```

## Known Limitations

- **OCR Accuracy** - Tesseract.js is a browser-based OCR engine. Accuracy may vary depending on image quality, font, and background complexity.
- **Google Translate API** - Uses an unofficial endpoint that may be rate-limited or blocked. Consider using LibreTranslate for heavy usage.
- **X.com DOM Changes** - The extension relies on X.com's DOM structure (`data-testid` attributes). Updates to X.com may require adjustments.

## License

This project is licensed under the Apache License 2.0. See [LICENSE](LICENSE) for details.

This project includes third-party software licensed under Apache 2.0, MIT, and BSD-3-Clause. See [NOTICE](NOTICE) for details.
