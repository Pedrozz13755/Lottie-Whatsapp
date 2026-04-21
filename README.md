# 🧩 Lottie Sticker Builder (WAS) — Beta

Turns an image (**buffer** or **file**) into an animated `.was` (Lottie) sticker ready to send on WhatsApp.

---

## ⚡ Installation

### 1. Clone or download the project

```bash
git clone https://github.com/Pedrozz13755/Lottie-Whatsapp.git
cd Lottie-Whatsapp
```

Or, if you prefer, you can copy the files directly into your own project.

---

### 2. Install required dependencies

This project only uses native Node.js modules.

On **Windows**, no extra tool is required (it uses built-in PowerShell `Compress-Archive`).

On **Linux / Termux / Ubuntu**, install `zip`:

```bash
pkg install zip
# or
apt install zip
```

On **macOS**, the `zip` command is usually already available.

---

## 📦 Expected structure

You need a base folder containing the Lottie files. Example:

```
src/
 └── exemple/
      └── animation/
           └── animation_secondary.json
```

This JSON file must already include a base64 image, since the builder only replaces the existing embedded image.

---

## 🚀 How to use

### Import the function

```js
const { buildLottieSticker } = require("./src/index");
```

---

### Simple example

```js
const path = require("path");
const { buildLottieSticker } = require("./src/index");

const output = await buildLottieSticker({
  baseFolder: path.resolve(__dirname, "src", "exemple"),
  buffer: dfileBuffer,
  mime: "image/jpeg",
  output: path.resolve(__dirname, "jurubeba.was")
});
```

---

### Send on WhatsApp with Baileys

```js
const fs = require("fs");

await client.sendMessage(from, {
  sticker: fs.readFileSync("./jurubeba.was"),
  mimetype: "application/was"
});
```

---

## 🌐 Web App (GitHub Pages)

This repository now includes a static web app in `docs/` that builds `.was` files directly in the browser.

- No backend
- No database
- Works on GitHub Pages

### Web app location

- `docs/index.html`
- `docs/app.js`
- `docs/styles.css`
- `docs/templates/exemple/animation/*`

### Run locally

Use any static server and point it to `docs/`.

Example with Python:

```bash
python -m http.server 5500 --directory docs
```

Then open `http://localhost:5500`.
---

## 🧠 Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `baseFolder` | string | ✅ | Base Lottie folder |
| `buffer` | Buffer | ❌ | In-memory image |
| `imagePath` | string | ❌ | Path to the image |
| `mime` | string | ❌ | Image MIME type (automatically detected if you use `imagePath`) |
| `output` | string | ❌ | Output path for the final `.was` file |
| `jsonRelativePath` | string | ❌ | Path to the JSON file inside the base folder |

---

## ⚠️ Important rules

- You must provide **`buffer` or `imagePath`**
- Supported formats:
  - PNG
  - JPG / JPEG
  - WEBP
- The Lottie JSON must already contain an embedded base64 image
- This code only replaces the existing image; it does not generate a Lottie structure from scratch

---

## 💥 Common errors

### `Mime not detected`
You did not provide `mime` or `imagePath`.

### `JSON without assets`
The JSON file is invalid or does not match the expected structure.

### `No base64 image found in Lottie`
Your Lottie file does not include an embedded base64 image to replace.

### `zip not found`
The `zip` command is not installed on your system (Linux/macOS path).

On Windows, this project uses PowerShell compression by default.

---

## 🛠️ Useful tip

If you want to use an image received from WhatsApp directly, get the buffer and pass it to the builder:

```js
const buffer = await getFileBuffer(message, "image");

const output = await buildLottieSticker({
  baseFolder: path.resolve(__dirname, "src", "exemple"),
  buffer,
  mime: "image/jpeg",
  output: path.resolve(__dirname, "jurubeba.was")
});
```

---

## 🚧 Project status

> ⚠️ **BETA VERSION**
>
> This project is still in beta.
> Depending on the Lottie file you use, some animations may not work as expected.
> Full compatibility with all Lottie structures is not guaranteed yet.

---

## 👑 Credits

Developed by **Pedrozz Mods**

This project is still under development and currently in beta.
If you use, modify, or share it, please keep the original credits.

---

### Footer

Made by **Rizal Anditama**  
Project is in **beta**, subject to changes and possible issues.
