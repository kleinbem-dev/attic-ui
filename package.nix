{
  lib,
  buildNpmPackage,
  fetchFromGitHub,
  nix-update-script,
  runCommand,
}:

buildNpmPackage (finalAttrs: {
  pname = "attic-ui";
  version = "0.1.0";

  src = fetchFromGitHub {
    owner = "kleinbem-dev";
    repo = "attic-ui";
    tag = "v${finalAttrs.version}";
    # Placeholder until release tag v0.1.0 is published; flake.nix overrides src locally.
    hash = lib.fakeHash;
  };

  npmDepsHash = "sha256-czKPAWFx+bMvsDd3ChQ2cXNWHgAQo5/ZfQcAHua3Q+c=";
  # npm 11 creates _cacache/tmp when installing git dependencies from the offline cache.
  makeCacheWritable = true;

  strictDeps = true;
  __structuredAttrs = true;
  allowedReferences = [ ];

  doCheck = true;
  # checkPhase binds a 127.0.0.1 mock HTTP server for cache API integration tests.
  __darwinAllowLocalNetworking = true;

  checkPhase = ''
    runHook preCheck
    npm test
    npm run check
    runHook postCheck
  '';

  installPhase = ''
    runHook preInstall
    cp -r build "$out"
    runHook postInstall
  '';

  passthru = {
    tests.smoke = runCommand "${finalAttrs.pname}-smoke" { } ''
      pkg=${finalAttrs.finalPackage}
      test -s "$pkg/index.html"
      test -s "$pkg/200.html"
      test -d "$pkg/_app/immutable"
      grep -q 'Attic UI' "$pkg/index.html"
      grep -Eq '"version":"[0-9a-f]{12}"' "$pkg/_app/version.json"
      touch "$out"
    '';
    updateScript = nix-update-script { };
  };

  meta = {
    description = "Web interface and closure inspector for Attic Nix binary caches";
    homepage = "https://github.com/kleinbem-dev/attic-ui";
    changelog = "https://github.com/kleinbem-dev/attic-ui/releases/tag/v${finalAttrs.version}";
    license = lib.licenses.mit;
    maintainers = with lib.maintainers; [ kleinbem ];
    platforms = lib.platforms.all;
  };
})
