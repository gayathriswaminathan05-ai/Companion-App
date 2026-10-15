// electron-builder afterPack hook: ad-hoc sign the packaged Mac app ourselves.
// (@electron/osx-sign crashes in isbinaryfile on our model files, so the
// builder's own signing is turned off with mac.identity = null.)
// Ad-hoc signing gives a valid bundle seal: downloaded copies then get the
// normal "can't verify developer → Open Anyway" path instead of "damaged".
// Replace with Developer ID signing + notarization once the Apple Developer
// account exists.
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function machOFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isSymbolicLink()) continue;
    if (e.isDirectory()) machOFiles(p, out);
    else if (/\.(node|dylib|so)$/.test(e.name)) out.push(p);
  }
  return out;
}

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  const unpacked = path.join(app, "Contents", "Resources", "app.asar.unpacked");
  // Native addons and their dylibs first (codesign --deep skips loose files in Resources).
  const loose = fs.existsSync(unpacked) ? machOFiles(unpacked) : [];
  for (const f of loose) {
    execFileSync("codesign", ["--force", "--sign", "-", f], { stdio: "inherit" });
  }
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", app], { stdio: "inherit" });
  execFileSync("codesign", ["--verify", "--deep", "--strict", app], { stdio: "inherit" });
  console.log(`  • ad-hoc signed ${path.basename(app)} (+${loose.length} native files)`);
};
