import importlib.util
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "scripts" / "import_medications_json_batch.py"

spec = importlib.util.spec_from_file_location("import_medications_json_batch", MODULE_PATH)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ImporterSanitizationTests(unittest.TestCase):
    def test_sanitize_full_instruction_removes_html(self):
        value = {
            "dosage": "<p>Детям <b>10-15</b> мг/кг</p>",
            "specialInstruction": "<div>Не превышать <i>дозу</i></div>",
            "empty": "   ",
            "none": None,
        }

        cleaned = module.sanitize_full_instruction(value)

        self.assertIsInstance(cleaned, str)
        self.assertIn("Детям 10-15 мг/кг", cleaned)
        self.assertIn("Не превышать дозу", cleaned)
        self.assertNotIn("<", cleaned)
        self.assertNotIn(">", cleaned)

    def test_map_payload_saves_sanitized_full_instruction_json(self):
        payload = {
            "nameRu": "Тестовый препарат",
            "activeSubstance": "Тест",
            "contraindications": "-",
            "fullInstruction": {
                "indication": "<p>Лихорадка</p>",
                "dosage": "<p>По <b>10</b> мг/кг</p>",
            },
        }

        row = module.map_payload(payload)
        full_instruction_raw = row.get("full_instruction")
        self.assertIsNotNone(full_instruction_raw)
        self.assertIn("Лихорадка", full_instruction_raw)
        self.assertIn("По 10 мг/кг", full_instruction_raw)
        self.assertNotIn("<", full_instruction_raw)
        self.assertNotIn(">", full_instruction_raw)


if __name__ == "__main__":
    unittest.main()
