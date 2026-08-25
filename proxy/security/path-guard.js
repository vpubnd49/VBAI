/**
 * VBAI Path Traversal & Symlink Security Guard
 * Prevents Local File Inclusion (LFI), Directory Traversal (../), and Symlink Bypass Attacks.
 */
const fs = require('fs');
const path = require('path');

/**
 * Checks for path traversal markers or null bytes.
 */
function hasTraversalMarkers(input) {
  if (!input || typeof input !== 'string') return true;
  // Null bytes & control characters
  if (/[\0\x00-\x1f\x7f]/.test(input)) return true;
  // Traversal dots
  if (/(^|[\\/])\.\.([\\/]|$)/.test(input)) return true;
  return false;
}

/**
 * Checks if a target path is a Symbolic Link.
 */
function isSymbolicLink(targetPath) {
  try {
    const stat = fs.lstatSync(targetPath);
    return stat.isSymbolicLink();
  } catch (err) {
    return false;
  }
}

/**
 * Asserts that targetPath is securely confined inside allowedParentDir.
 * Throws an error if:
 * 1. Contains traversal markers or null bytes.
 * 2. Is a symbolic link pointing elsewhere.
 * 3. Its physical realpath falls outside allowedParentDir.
 */
function assertSafePathInside(targetPath, allowedParentDir) {
  if (hasTraversalMarkers(targetPath)) {
    throw new Error(`[Security Alert] Phát hiện chuỗi đường dẫn không an toàn (Path Traversal / Null byte): "${targetPath}"`);
  }

  const resolvedAllowedDir = path.resolve(allowedParentDir);
  const resolvedTarget = path.resolve(targetPath);

  // Initial prefix check
  if (!resolvedTarget.startsWith(resolvedAllowedDir + path.sep) && resolvedTarget !== resolvedAllowedDir) {
    throw new Error(`[Security Alert] Đường dẫn "${targetPath}" nằm ngoài vùng cho phép "${allowedParentDir}"`);
  }

  // If target exists, inspect physical realpath and symlinks
  if (fs.existsSync(resolvedTarget)) {
    if (isSymbolicLink(resolvedTarget)) {
      throw new Error(`[Security Alert] Chặn truy cập Symbolic Link (Symlink Bypass Attack): "${targetPath}"`);
    }

    const realTarget = fs.realpathSync(resolvedTarget);
    let realAllowedDir = resolvedAllowedDir;
    try {
      if (fs.existsSync(resolvedAllowedDir)) {
        realAllowedDir = fs.realpathSync(resolvedAllowedDir);
      }
    } catch (err) {
      // ignore
    }

    if (!realTarget.startsWith(realAllowedDir + path.sep) && realTarget !== realAllowedDir) {
      throw new Error(`[Security Alert] Đường dẫn thực tế "${realTarget}" thoát khỏi vùng an toàn "${realAllowedDir}"`);
    }

    return realTarget;
  }

  return resolvedTarget;
}

module.exports = {
  hasTraversalMarkers,
  isSymbolicLink,
  assertSafePathInside
};
