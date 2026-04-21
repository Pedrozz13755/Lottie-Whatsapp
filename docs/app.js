const TEMPLATE_BASE = "./templates/exemple";
const TEMPLATE_FILES = [
  "animation/animation.json",
  "animation/animation.json.overridden_metadata",
  "animation/animation.json.trust_token",
  "animation/animation_secondary.json",
  "animation/animation_secondary.json.trust_token"
];
const JSON_FILES = TEMPLATE_FILES.filter(relativePath => relativePath.endsWith(".json"));

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);
const MIME_BY_EXT = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp"
};

const form = document.getElementById("builder-form");
const imageInput = document.getElementById("image-input");
const lottieJsonInput = document.getElementById("lottie-json-input");
const applyToAllInput = document.getElementById("apply-to-all-json");
const jsonPathSelect = document.getElementById("json-path");
const outputNameInput = document.getElementById("output-name");
const buildButton = document.getElementById("build-button");
const statusText = document.getElementById("status-text");
const statusWrap = document.querySelector(".status");
const preview = document.getElementById("image-preview");

function syncTargetControlState() {
  jsonPathSelect.disabled = applyToAllInput.checked;
}

imageInput.addEventListener("change", () => {
  const file = imageInput.files && imageInput.files[0];

  if (!file) {
    preview.hidden = true;
    setStatus("Select an image to start.");
    return;
  }

  preview.src = URL.createObjectURL(file);
  preview.hidden = false;
  setStatus(`Ready: ${file.name}`);
});

lottieJsonInput.addEventListener("change", () => {
  const file = lottieJsonInput.files && lottieJsonInput.files[0];

  if (!file) {
    setStatus("Use an image or a Lottie JSON file to start.");
    return;
  }

  setStatus(`Lottie JSON loaded: ${file.name}`);
});

applyToAllInput.addEventListener("change", syncTargetControlState);
syncTargetControlState();

form.addEventListener("submit", async event => {
  event.preventDefault();

  const imageFile = imageInput.files && imageInput.files[0];
  const lottieJsonFile = lottieJsonInput.files && lottieJsonInput.files[0];
  const applyToAll = applyToAllInput.checked;

  if (!imageFile && !lottieJsonFile) {
    setError("Please choose an image or a Lottie JSON file first.");
    return;
  }

  const mime = imageFile ? detectMime(imageFile) : null;
  if (imageFile && !mime) {
    setError("Unsupported image format. Use PNG, JPG/JPEG, or WEBP.");
    return;
  }

  const outputName = normalizeOutputName(outputNameInput.value || "sticker.was");
  const jsonTargetPath = jsonPathSelect.value;

  buildButton.disabled = true;
  setStatus("Loading template files...");

  try {
    const templateEntries = await loadTemplateFiles();
    const lottieJsonText = lottieJsonFile ? await fileToText(lottieJsonFile) : null;
    const dataUri = imageFile ? await fileToDataUri(imageFile, mime) : null;

    const targetJsonPaths = applyToAll ? JSON_FILES : [jsonTargetPath];

    if (lottieJsonFile) {
      setStatus("Validating Lottie JSON...");
      const jsonPayload = dataUri ? replaceBase64Image(lottieJsonText, dataUri) : validateLottieJson(lottieJsonText);

      for (const targetPath of targetJsonPaths) {
        if (!templateEntries.has(targetPath)) {
          throw new Error(`Template JSON not found: ${targetPath}`);
        }

        templateEntries.set(targetPath, jsonPayload);
      }
    } else {
      setStatus("Injecting image into Lottie JSON...");

      for (const targetPath of targetJsonPaths) {
        const currentJson = templateEntries.get(targetPath);
        if (!currentJson) {
          throw new Error(`Template JSON not found: ${targetPath}`);
        }

        templateEntries.set(targetPath, replaceBase64Image(currentJson, dataUri));
      }
    }

    setStatus("Building sticker package...");
    const blob = await createWasBlob(templateEntries);

    downloadBlob(blob, outputName);
    setStatus(`Done. Downloaded ${outputName}`);
  } catch (error) {
    setError(error.message || "Unknown error while creating sticker.");
  } finally {
    buildButton.disabled = false;
  }
});

function setStatus(message) {
  statusWrap.classList.remove("error");
  statusText.textContent = message;
}

function setError(message) {
  statusWrap.classList.add("error");
  statusText.textContent = message;
}

function normalizeOutputName(name) {
  const safe = name.trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, "_") || "sticker.was";
  return safe.toLowerCase().endsWith(".was") ? safe : `${safe}.was`;
}

function detectMime(file) {
  if (ALLOWED_MIME.has(file.type)) {
    return file.type;
  }

  const parts = file.name.split(".");
  const ext = parts.length > 1 ? parts.pop().toLowerCase() : "";
  return MIME_BY_EXT[ext] || null;
}

function fileToDataUri(file, mime) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const buffer = reader.result;
      if (!(buffer instanceof ArrayBuffer)) {
        reject(new Error("Failed to read file as binary data."));
        return;
      }

      const base64 = arrayBufferToBase64(buffer);
      resolve(`data:${mime};base64,${base64}`);
    };

    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.readAsArrayBuffer(file);
  });
}

function fileToText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const text = reader.result;
      if (typeof text !== "string") {
        reject(new Error("Failed to read JSON file."));
        return;
      }

      resolve(text);
    };

    reader.onerror = () => reject(new Error("Failed to read JSON file."));
    reader.readAsText(file);
  });
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

async function loadTemplateFiles() {
  const entries = await Promise.all(
    TEMPLATE_FILES.map(async relativePath => {
      const response = await fetch(`${TEMPLATE_BASE}/${relativePath}`);
      if (!response.ok) {
        throw new Error(`Template file missing: ${relativePath}`);
      }

      const content = await response.text();
      return [relativePath, content];
    })
  );

  return new Map(entries);
}

function replaceBase64Image(rawJson, dataUri) {
  const json = JSON.parse(rawJson);

  if (!Array.isArray(json.assets)) {
    throw new Error("Invalid Lottie JSON: missing assets.");
  }

  const imageAsset = json.assets.find(asset => typeof asset?.p === "string" && asset.p.startsWith("data:image/"));
  if (!imageAsset) {
    throw new Error("No embedded base64 image found in selected Lottie JSON.");
  }

  imageAsset.p = dataUri;
  return JSON.stringify(json);
}

function validateLottieJson(rawJson) {
  const json = JSON.parse(rawJson);

  if (!Array.isArray(json.assets)) {
    throw new Error("Invalid Lottie JSON: missing assets.");
  }

  const imageAsset = json.assets.find(asset => typeof asset?.p === "string" && asset.p.startsWith("data:image/"));
  if (!imageAsset) {
    throw new Error("No embedded base64 image found in the selected Lottie JSON.");
  }

  return JSON.stringify(json);
}

async function createWasBlob(templateEntries) {
  if (!window.JSZip) {
    throw new Error("JSZip failed to load. Check your internet connection.");
  }

  const zip = new window.JSZip();

  for (const [relativePath, content] of templateEntries.entries()) {
    zip.file(relativePath, content);
  }

  return zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 }
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}
