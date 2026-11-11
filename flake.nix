{
  description = "Next-generation web interface and store inspector for Attic Nix binary cache";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      nixpkgs,
      flake-utils,
      ...
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        formatter = pkgs.nixfmt;

        packages.default = pkgs.buildNpmPackage {
          pname = "attic-ui";
          version = "0.1.0";
          src = ./.;
          npmDeps = pkgs.importNpmLock { npmRoot = ./.; };
          npmConfigHook = pkgs.importNpmLock.npmConfigHook;
          installPhase = ''
            mkdir -p $out
            cp -r build/* $out/
          '';
          meta = with pkgs.lib; {
            description = "Web interface and store inspector for Attic Nix binary cache";
            homepage = "https://github.com/kleinbem-dev/attic-ui";
            license = licenses.mit;
          };
        };

        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs_22
            just
          ];
        };
      }
    );
}
