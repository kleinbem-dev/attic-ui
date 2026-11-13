{
  description = "Web interface and closure inspector for Attic Nix binary caches";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs =
    { self, nixpkgs }:
    let
      inherit (nixpkgs) lib;
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forAllSystems = lib.genAttrs systems;
      localSrc = lib.fileset.toSource {
        root = ./.;
        fileset = lib.fileset.unions [
          ./LICENSE
          ./package.json
          ./package-lock.json
          ./src
          ./test
          ./tsconfig.json
          ./vite.config.ts
        ];
      };
    in
    {
      formatter = forAllSystems (system: nixpkgs.legacyPackages.${system}.nixfmt-tree);

      packages = forAllSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          attic-ui = (pkgs.callPackage ./package.nix { }).overrideAttrs (prevAttrs: {
            src = localSrc;
            npmDeps = pkgs.fetchNpmDeps {
              pname = "${prevAttrs.pname}-npm-deps";
              inherit (prevAttrs) version;
              src = localSrc;
              hash = prevAttrs.npmDepsHash;
            };
          });
        in
        {
          inherit attic-ui;
          default = attic-ui;
        }
      );

      checks = forAllSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          pkg = self.packages.${system}.default;
          nixSrc = lib.fileset.toSource {
            root = ./.;
            fileset = lib.fileset.unions [
              ./flake.nix
              ./package.nix
            ];
          };
        in
        {
          default = pkg;
          inherit (pkg.passthru.tests) smoke;
          nix-lint =
            pkgs.runCommand "attic-ui-nix-lint"
              {
                nativeBuildInputs = [
                  pkgs.nixfmt
                  pkgs.deadnix
                  pkgs.statix
                ];
              }
              ''
                nixfmt --check "${nixSrc}/flake.nix" "${nixSrc}/package.nix"
                deadnix --fail "${nixSrc}"
                statix check "${nixSrc}"
                touch "$out"
              '';
        }
      );

      devShells = forAllSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
        in
        {
          default = pkgs.mkShell {
            packages = with pkgs; [
              nodejs
              just
              nixfmt
              deadnix
              statix
              prefetch-npm-deps
            ];
          };
        }
      );
    };
}
