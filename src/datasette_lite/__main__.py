import click
from .build import build_all
from .serve import Rebuilder
from pathlib import Path


@click.group()
def cli():
    pass


@cli.command()
@click.option("--output-dir", default="_site")
@click.option("--config-dir", default="_config")
def build(output_dir: str, config_dir: str):
    build_all(Path(output_dir), Path(config_dir))


@cli.command()
@click.option("--serve-dir", default="_site")
@click.option("--config-dir", default="_config")
def serve(serve_dir: str, config_dir: str):
    Rebuilder(
        port=4000,
        customization_path=Path(config_dir),
        serve_path=Path(serve_dir),
        watch_folders=[Path("src"), Path(config_dir)],
    ).run()


if __name__ == "__main__":
    cli()
