# LibreTranslate Self-Hosting Instructions

LibreTranslate can be run locally as a fallback if Google Translate is unavailable due to rate limits or other reasons.

## Starting with Docker

```bash
docker run -d -p 5000:5000 libretranslate/libretranslate
```

## Verifying Startup

```bash
curl http://localhost:5000/languages
```

A successful response indicates startup.

## Configuring the Extension

1. Click the extension icon in the Chrome toolbar.
2. Enter `http://localhost:5000/translate` in the "LibreTranslate URL" field.
3. Click "Save."

If Google Translate fails, it will automatically fall back to this URL.

## About the API Key

An API key is not required by default. If you run the program with the `--api-keys` flag, you will need an API key. However, for local use, we recommend running the program without the flag.

## GPU Support (Optional)

To improve translation speed:

```bash
docker run -d -p 5000:5000 --gpus all libretranslate/libretranslate
```

NVIDIA GPU and nvidia-docker are required.