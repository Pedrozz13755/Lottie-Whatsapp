const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });

  for (const item of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, item.name);
    const to = path.join(dest, item.name);

    if (item.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

function collectJsonFiles(folder) {
  const files = [];

  for (const item of fs.readdirSync(folder, { withFileTypes: true })) {
    const fullPath = path.join(folder, item.name);

    if (item.isDirectory()) {
      files.push(...collectJsonFiles(fullPath));
      continue;
    }

    if (item.isFile() && fullPath.toLowerCase().endsWith(".json")) {
      files.push(fullPath);
    }
  }

  return files;
}

function getMime(filePath, mime) {
  if (mime) return mime;
  return MIME[path.extname(filePath || "").toLowerCase()] || null;
}

function toDataUri(buffer, mime) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error("Buffer inválido.");
  }

  if (!mime) {
    throw new Error("Mime não detectado. Informe imagePath ou mime.");
  }

  return `data:${mime};base64,${buffer.toString("base64")}`;
}

function replaceBase64Image(jsonPath, dataUri) {
  const json = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

  if (!Array.isArray(json.assets)) {
    throw new Error("JSON sem assets.");
  }

  const asset = json.assets.find(a => typeof a?.p === "string" && a.p.startsWith("data:image/"));
  if (!asset) {
    throw new Error("Nenhuma imagem base64 encontrada no Lottie.");
  }

  asset.p = dataUri;
  fs.writeFileSync(jsonPath, JSON.stringify(json));
}

function replaceBase64ImageText(rawJson, dataUri) {
  const json = JSON.parse(rawJson);

  if (!Array.isArray(json.assets)) {
    throw new Error("JSON sem assets.");
  }

  const asset = json.assets.find(a => typeof a?.p === "string" && a.p.startsWith("data:image/"));
  if (!asset) {
    throw new Error("Nenhuma imagem base64 encontrada no Lottie.");
  }

  asset.p = dataUri;
  return JSON.stringify(json);
}

function readJsonSource({ lottieJsonPath, lottieJsonBuffer }) {
  if (lottieJsonBuffer) {
    return Buffer.isBuffer(lottieJsonBuffer) ? lottieJsonBuffer.toString("utf8") : String(lottieJsonBuffer);
  }

  if (lottieJsonPath) {
    if (!fs.existsSync(lottieJsonPath)) {
      throw new Error("Lottie JSON não encontrado.");
    }

    return fs.readFileSync(lottieJsonPath, "utf8");
  }

  return null;
}

function escapePowerShellString(value) {
  return String(value).replace(/'/g, "''");
}

function zipWithPowerShell(folder, zipPath) {
  const sourcePath = path.join(folder, "*");
  const command = [
    "$ErrorActionPreference = 'Stop'",
    `Compress-Archive -Path '${escapePowerShellString(sourcePath)}' -DestinationPath '${escapePowerShellString(zipPath)}' -Force`
  ].join("; ");

  try {
    execFileSync("powershell", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", command], {
      stdio: "ignore"
    });
  } catch {
    execFileSync("pwsh", ["-NoProfile", "-NonInteractive", "-Command", command], {
      stdio: "ignore"
    });
  }
}

function zipWithCommand(folder, zipPath) {
  execFileSync("zip", ["-r", zipPath, "."], { cwd: folder, stdio: "ignore" });
}

function zipToWas(folder, output) {
  fs.mkdirSync(path.dirname(output), { recursive: true });

  const zipPath = output.replace(/\.was$/i, ".zip");
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  if (fs.existsSync(output)) fs.unlinkSync(output);

  try {
    if (process.platform === "win32") {
      zipWithPowerShell(folder, zipPath);
    } else {
      zipWithCommand(folder, zipPath);
    }
  } catch {
    if (process.platform !== "win32") {
      throw new Error("zip não encontrado. Instale o comando zip no sistema.");
    }

    throw new Error(
      "Falha ao compactar no Windows. Use PowerShell 5+ (Compress-Archive) ou instale zip e execute em ambiente compatível."
    );
  }

  if (zipPath !== output) {
    fs.renameSync(zipPath, output);
  }
}

async function buildLottieSticker({
  baseFolder,
  output = path.resolve("./jurubeba.was"),
  imagePath,
  buffer,
  mime,
  jsonRelativePath = "animation/animation_secondary.json",
  lottieJsonPath,
  lottieJsonBuffer,
  applyJsonToAll = false
}) {
  if (!fs.existsSync(baseFolder)) throw new Error("baseFolder não encontrado.");

  const sourceJson = readJsonSource({ lottieJsonPath, lottieJsonBuffer });

  if (!buffer && !imagePath && !sourceJson) {
    throw new Error("Envie imagePath, buffer, lottieJsonPath ou lottieJsonBuffer.");
  }

  if (!buffer && imagePath) {
    if (!fs.existsSync(imagePath)) throw new Error("Imagem não encontrada.");
    buffer = fs.readFileSync(imagePath);
  }

  if (buffer || imagePath) {
    mime = getMime(imagePath, mime);
    if (!mime) throw new Error("Formato não suportado. Use PNG, JPG, JPEG ou WEBP.");
  }

  const temp = path.join(os.tmpdir(), `lottie-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`);

  try {
    copyDir(baseFolder, temp);

    const imageDataUri = buffer || imagePath ? toDataUri(buffer, mime) : null;
    if (sourceJson) {
      const payload = imageDataUri ? replaceBase64ImageText(sourceJson, imageDataUri) : sourceJson;

      if (applyJsonToAll) {
        for (const jsonPath of collectJsonFiles(temp)) {
          fs.writeFileSync(jsonPath, payload);
        }
      } else {
        const targetPath = path.join(temp, jsonRelativePath);
        if (!fs.existsSync(targetPath)) {
          throw new Error(`JSON de destino não encontrado: ${jsonRelativePath}`);
        }

        fs.writeFileSync(targetPath, payload);
      }
    } else {
      replaceBase64Image(path.join(temp, jsonRelativePath), imageDataUri);

      if (applyJsonToAll) {
        const payload = fs.readFileSync(path.join(temp, jsonRelativePath), "utf8");
        for (const jsonPath of collectJsonFiles(temp)) {
          fs.writeFileSync(jsonPath, payload);
        }
      }
    }

    zipToWas(temp, output);
    return output;
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

module.exports = { buildLottieSticker };