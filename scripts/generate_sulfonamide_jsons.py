import importlib.util
from pathlib import Path


BASE_SCRIPT = Path(__file__).with_name("generate_tetracycline_jsons.py")


def load_base_module():
    spec = importlib.util.spec_from_file_location("generate_tetracycline_jsons_base", BASE_SCRIPT)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def main():
    module = load_base_module()
    module.OUT_DIR = r"C:\Users\Arty\Desktop\Django\pediatrics\src\modules\medications\data\sulfonamides"
    module.TETRACYCLINE_ATC_PREFIXES = ("J01EE",)
    module.main()


if __name__ == "__main__":
    main()